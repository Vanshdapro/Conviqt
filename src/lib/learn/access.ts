// Conviqt Learn — access control (server-only).
//
// Learn is normally members-only: a verified, signed-in account is required and
// each lesson is metered against the user's credits. For local development (and
// any environment that explicitly opts in) we want to *preview* the experience
// without an account, so the whole funnel can be clicked through end to end.
//
// Open access is on by default in development and OFF in production, so shipping
// to conviqt.com keeps Learn gated to members unless LEARN_OPEN_ACCESS=1 is set.
// When we deploy, restricting to Conviqt members is the default — no code change
// needed, just don't set the flag.

import { getVerifiedUser } from "@/lib/auth";

// LEARN_OPEN_ACCESS:  "1" → always open, "0" → always gated,
// unset → open in development only.
export const LEARN_OPEN_ACCESS =
  process.env.LEARN_OPEN_ACCESS === "1" ||
  (process.env.LEARN_OPEN_ACCESS !== "0" &&
    process.env.NODE_ENV !== "production");

// Shared identity for every anonymous local previewer. Progress (XP/streak) is
// stored under this email so a guest still sees the gamification work — it just
// isn't tied to a real account.
export const GUEST_EMAIL = "guest@local.conviqt";

export interface LearnUser {
  email: string;
  /** True when this is the anonymous open-access previewer, not a real account. */
  guest: boolean;
}

// Resolves the Learn user: a real verified member when signed in, otherwise the
// guest previewer when open access is enabled, otherwise null (gated → 401).
export async function getLearnUser(): Promise<LearnUser | null> {
  const user = await getVerifiedUser();
  if (user) return { email: user.email, guest: false };
  if (LEARN_OPEN_ACCESS) return { email: GUEST_EMAIL, guest: true };
  return null;
}
