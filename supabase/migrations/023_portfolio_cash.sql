-- Migration 023: Cash in the portfolio.
--
-- Investors hold uninvested cash (dry powder) alongside their positions and
-- want their total portfolio value to reflect it. We store it as a single
-- non-negative dollar amount on the portfolio row — not as a holding, because
-- it has no ticker, no price feed, and no market risk.
--
-- It folds into two places:
--   • the live Total value (invested holdings + cash), shown on the surface.
--   • the audit metrics — cash dilutes concentration/sector weights and reads
--     as a zero-risk buffer, so the Health Check accounts for it automatically.

alter table portfolios
  add column if not exists cash numeric not null default 0;

-- Guard: cash can never be negative (a debit balance isn't a portfolio value).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'portfolios_cash_nonneg'
  ) then
    alter table portfolios
      add constraint portfolios_cash_nonneg check (cash >= 0);
  end if;
end $$;
