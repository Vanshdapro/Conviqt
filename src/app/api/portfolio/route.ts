import { getVerifiedUser } from "@/lib/auth";
import {
  listPortfolios,
  getPortfolio,
  getLatestAudit,
  getAuditHistory,
  savePortfolio,
  deletePortfolio,
  sanitizeHoldings,
} from "@/lib/portfolio/store";

// /api/portfolio
//   GET            → list the user's portfolios (+ latest health score each).
//   GET ?id=<uuid> → one portfolio with its latest full audit + health history.
//   POST           → create or update a portfolio's holdings/name.
//   DELETE ?id=    → delete a portfolio (cascades its audits).
//
// Identity always comes from the verified session, never the request body.
// Saving/listing portfolios is free — no credits. Only running a fresh audit
// (see /api/portfolio/audit) costs credits.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: Request) {
  const user = await getVerifiedUser();
  if (!user) return json({ error: "Please sign in.", code: "auth_required" }, 401);

  const id = new URL(req.url).searchParams.get("id");

  if (id) {
    const portfolio = await getPortfolio(user.email, id);
    if (!portfolio) return json({ error: "Portfolio not found." }, 404);
    const [latestAudit, history] = await Promise.all([
      getLatestAudit(user.email, id),
      getAuditHistory(user.email, id),
    ]);
    return json({ portfolio, latestAudit, history });
  }

  const portfolios = await listPortfolios(user.email);
  // Attach each portfolio's latest health score for the list view.
  const withHealth = await Promise.all(
    portfolios.map(async (p) => {
      const audit = await getLatestAudit(user.email, p.id);
      return {
        ...p,
        latestHealthScore: audit?.healthScore ?? null,
        lastAuditedAt: audit?.createdAt ?? null,
      };
    })
  );
  return json({ portfolios: withHealth });
}

export async function POST(req: Request) {
  const user = await getVerifiedUser();
  if (!user) return json({ error: "Please sign in.", code: "auth_required" }, 401);

  let body: { id?: string; name?: string; holdings?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const holdings = sanitizeHoldings(body.holdings);
  if (holdings.length === 0) {
    return json({ error: "No valid holdings. Each needs a ticker and a positive share count." }, 400);
  }

  const saved = await savePortfolio(user.email, {
    id: body.id,
    name: (body.name ?? "My Portfolio").toString(),
    holdings,
  });
  if (!saved) return json({ error: "Could not save portfolio. Storage may be unavailable." }, 503);

  return json({ portfolio: saved });
}

export async function DELETE(req: Request) {
  const user = await getVerifiedUser();
  if (!user) return json({ error: "Please sign in.", code: "auth_required" }, 401);

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "Missing portfolio id." }, 400);

  const ok = await deletePortfolio(user.email, id);
  if (!ok) return json({ error: "Could not delete portfolio." }, 503);
  return json({ ok: true });
}
