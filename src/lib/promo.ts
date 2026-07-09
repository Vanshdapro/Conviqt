// Signup-week promo: accounts created in this window get a free month of Pro,
// no card, no Stripe (see grantFreeMonthIfEligible in subscription.ts).
// Shared by client-side pricing copy and the server-side grant so the two
// can't drift apart. Delete this file once the window and every grantee's
// month have passed.

export const FREE_MONTH_SIGNUP_WINDOW_START = new Date("2026-07-04T00:00:00Z").getTime();
// Inclusive of all of Jul 12 (founder: "free till 12th July").
export const FREE_MONTH_SIGNUP_WINDOW_END   = new Date("2026-07-13T00:00:00Z").getTime();

// Free-Pro signup promo ENDED 2026-07-09 (founder call): Conviqt Pro is now
// $4/month and EVERYONE pays. The only free path left is an Edge founding-member
// promo code, redeemed at /redeem (see src/app/api/redeem/route.ts). Existing
// promo_free_month grantees keep their remaining month; no new free grants.
export function isSignupPromoActive(_now: number = Date.now()): boolean {
  return false;
}
