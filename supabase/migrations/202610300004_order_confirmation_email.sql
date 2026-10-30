-- Idempotency marker for the buyer's order-confirmation email (sent from the Stripe webhook,
-- which Stripe may deliver more than once). The webhook claims the row with
--   update orders set confirmation_email_sent_at = now() where id = $1 and confirmation_email_sent_at is null
-- and only sends when that update returned a row. Until this migration is applied the
-- webhook simply skips the confirmation email (no error, no duplicate).
alter table public.orders add column if not exists confirmation_email_sent_at timestamptz;
