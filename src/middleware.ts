// Next.js only auto-loads middleware from a file named `middleware.ts` at the
// project (or src/) root. The actual logic lives in ./proxy.ts — the edu.
// conviqt.com host→/edu rewrite and the logged-out /chat,/research redirect
// guard. Without this thin re-export Next never runs any of it, leaving the
// host isolation and the auth UX guard silently inert. This file is the wiring.
export { proxy as middleware, config } from "./proxy";
