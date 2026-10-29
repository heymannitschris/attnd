create table if not exists public.user_stripe_customers (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_stripe_customers enable row level security;
revoke all on table public.user_stripe_customers from anon, authenticated;

