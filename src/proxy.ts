import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Routes that require an authenticated session. Visiting them while logged out
// redirects to /login. NOTE: this proxy is a UX guard only — the real
// security boundary is the per-request auth check inside the API routes, which
// fail closed. So if env is missing we fail OPEN here to avoid bricking the site.
const PROTECTED_PREFIXES = ["/chat", "/research"];

// Academic subdomain (edu.conviqt.com) host match. The portal lives under the
// real /edu segment; we keep that prefix OUT of the public URL by rewriting
// host → path here. See src/app/edu/.
const EDU_HOST_RE = /^edu\./i;

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Host isolation: retail (conviqt.com) vs academic (edu.conviqt.com) ────
  const onEduHost = EDU_HOST_RE.test(req.headers.get("host") ?? "");
  const isEduPath = pathname === "/edu" || pathname.startsWith("/edu/");

  if (onEduHost) {
    // Transparently map the public path into the /edu app segment:
    //   edu.conviqt.com/sandbox → /edu/sandbox,  edu.conviqt.com/ → /edu.
    // Already-prefixed (internal) requests pass straight through.
    if (!isEduPath) {
      const url = req.nextUrl.clone();
      url.pathname = pathname === "/" ? "/edu" : `/edu${pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Retail host must never expose the academic segment directly.
  if (isEduPath) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // ── Retail auth guard (unchanged) ─────────────────────────────────────────
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (!isProtected) return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next(); // misconfigured — don't lock out

  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        );
      },
    },
  });

  // UX guard only — read the session from the cookie instead of calling
  // getUser(), which makes a network round-trip to Supabase's auth server on
  // EVERY navigation to a protected route (the cause of slow sign-ins and the
  // "refresh once and it works" behavior). getSession() decodes the cookie
  // locally and only hits the network when an expired token needs refreshing.
  // The real security boundary stays in the API routes, which call getUser()
  // and fail closed.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

// Runs on all page navigations except Next internals, API routes, and static
// files. The function early-returns for ordinary retail paths (a host check +
// NextResponse.next()), so the added breadth is near-zero cost; the breadth is
// required because host-based edu rewriting can't be expressed as a path matcher.
export const config = {
  matcher: ["/((?!_next/|api/|favicon.ico|.*\\.[^/]+$).*)"],
};
