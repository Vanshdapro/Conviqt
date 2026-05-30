import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Routes that require an authenticated session. Visiting them while logged out
// redirects to /login. NOTE: this middleware is a UX guard only — the real
// security boundary is the per-request auth check inside the API routes, which
// fail closed. So if env is missing we fail OPEN here to avoid bricking the site.
const PROTECTED_PREFIXES = ["/chat", "/alpha"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
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

export const config = {
  matcher: ["/chat/:path*", "/alpha/:path*"],
};
