import { getVerifiedUser } from "@/lib/auth";
import {
  saveHistory,
  listHistory,
  getHistoryItem,
  deleteHistoryItem,
  isHistoryKind,
} from "@/lib/history/store";

// /api/history — the user's saved Research analyses.
//   GET            → list the user's saved analyses (lightweight, no payloads).
//   GET ?id=<uuid> → one saved analysis with its full payload (to re-render).
//   POST           → save one completed analysis.
//   DELETE ?id=    → delete one saved analysis.
//
// Identity always comes from the verified session, never the request body.
// Saving, listing, and reopening history are ALL free — no credits, no Free
// deep-slot consumption, no model/API spend. Re-reading a past analysis is a
// pure DB read by design (the whole point of the feature). Only a brand-new
// run on the Research surface (/api/chat, /api/allocator, /api/portfolio/audit)
// costs anything.

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
    const item = await getHistoryItem(user.email, id);
    if (!item) return json({ error: "Analysis not found." }, 404);
    return json({ item });
  }

  const items = await listHistory(user.email);
  return json({ items });
}

export async function POST(req: Request) {
  const user = await getVerifiedUser();
  if (!user) return json({ error: "Please sign in.", code: "auth_required" }, 401);

  let body: {
    kind?: unknown;
    skillId?: unknown;
    title?: unknown;
    tickers?: unknown;
    payload?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  if (!isHistoryKind(body.kind)) {
    return json({ error: "Unknown analysis kind." }, 400);
  }
  if (typeof body.title !== "string" || body.title.trim() === "") {
    return json({ error: "Missing analysis title." }, 400);
  }
  if (body.payload === undefined || body.payload === null) {
    return json({ error: "Missing analysis payload." }, 400);
  }

  const saved = await saveHistory(user.email, {
    kind: body.kind,
    skillId: typeof body.skillId === "string" ? body.skillId : null,
    title: body.title,
    tickers: Array.isArray(body.tickers)
      ? body.tickers.filter((t): t is string => typeof t === "string")
      : [],
    payload: body.payload,
  });

  // Soft failure: the analysis already rendered for the user; we just couldn't
  // persist it (store down or payload too large). The UI treats this quietly.
  if (!saved) return json({ error: "Could not save to history.", code: "save_failed" }, 503);

  return json({ item: saved });
}

export async function DELETE(req: Request) {
  const user = await getVerifiedUser();
  if (!user) return json({ error: "Please sign in.", code: "auth_required" }, 401);

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "Missing analysis id." }, 400);

  const ok = await deleteHistoryItem(user.email, id);
  if (!ok) return json({ error: "Could not delete analysis." }, 503);
  return json({ ok: true });
}
