alter table public.events add column if not exists live_notification_sent_at timestamptz;
alter table public.affiliate_link_visits add column if not exists moment_id uuid references public.event_live_moments(id) on delete set null;
alter table public.orders add column if not exists affiliate_moment_id uuid references public.event_live_moments(id) on delete set null;

create table if not exists public.event_live_moment_reports (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.event_live_moments(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null default 'inappropriate',
  status text not null default 'open' check (status in ('open','reviewed','dismissed')),
  created_at timestamptz not null default now(),
  unique(moment_id, reporter_id)
);

create table if not exists public.event_live_moment_shares (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.event_live_moments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists live_moment_reports_moment_idx on public.event_live_moment_reports(moment_id, status);
create index if not exists live_moment_shares_moment_idx on public.event_live_moment_shares(moment_id, created_at desc);
create index if not exists affiliate_visits_moment_idx on public.affiliate_link_visits(moment_id, created_at desc);
create index if not exists orders_affiliate_moment_idx on public.orders(affiliate_moment_id) where affiliate_moment_id is not null;

alter table public.event_live_moment_reports enable row level security;
alter table public.event_live_moment_shares enable row level security;

create policy "users create moment reports" on public.event_live_moment_reports
for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "users read own moment reports" on public.event_live_moment_reports
for select to authenticated using (reporter_id = (select auth.uid()));
create policy "users create moment shares" on public.event_live_moment_shares
for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users read own moment shares" on public.event_live_moment_shares
for select to authenticated using (user_id = (select auth.uid()));
