create table if not exists public.affiliate_link_visits (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  visitor_key uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_visits_user_time_idx on public.affiliate_link_visits(affiliate_user_id, created_at desc);
create index if not exists affiliate_visits_event_idx on public.affiliate_link_visits(affiliate_user_id, event_id);

create table if not exists public.user_referrals (
  referred_user_id uuid primary key references public.profiles(id) on delete cascade,
  affiliate_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (referred_user_id <> affiliate_user_id)
);
create index if not exists user_referrals_affiliate_idx on public.user_referrals(affiliate_user_id, created_at desc);

create table if not exists public.event_cohosts (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  revenue_share_percent smallint not null default 0 check (revenue_share_percent between 0 and 100),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (event_id, user_id)
);
create index if not exists event_cohosts_user_idx on public.event_cohosts(user_id, status);

alter table public.affiliate_link_visits enable row level security;
alter table public.user_referrals enable row level security;
alter table public.event_cohosts enable row level security;

create policy "affiliates read own visits" on public.affiliate_link_visits for select to authenticated using (affiliate_user_id = (select auth.uid()));
create policy "affiliates read own referrals" on public.user_referrals for select to authenticated using (affiliate_user_id = (select auth.uid()) or referred_user_id = (select auth.uid()));
create policy "cohosts and hosts read collaborations" on public.event_cohosts for select to authenticated using (
  user_id = (select auth.uid()) or invited_by = (select auth.uid()) or exists (
    select 1 from public.events where events.id = event_cohosts.event_id and events.host_id = (select auth.uid())
  )
);
