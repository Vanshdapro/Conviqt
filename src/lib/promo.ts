// Signup-week promo: accounts created in this window get a free month of Pro,
// no card, no Stripe (see grantFreeMonthIfEligible in subscription.ts).
// Shared by client-side pricing copy and the server-side grant so the two
// can't drift apart. Delete this file once the window and every grantee's
// month have passed.

export const FREE_MONTH_SIGNUP_WINDOW_START = new Date("2026-07-04T00:00:00Z").getTime();
export const FREE_MONTH_SIGNUP_WINDOW_END   = new Date("2026-07-11T00:00:00Z").getTime();

export function isSignupPromoActive(now: number = Date.now()): boolean {
  return now >= FREE_MONTH_SIGNUP_WINDOW_START && now < FREE_MONTH_SIGNUP_WINDOW_END;
}
