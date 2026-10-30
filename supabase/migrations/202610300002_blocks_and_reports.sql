-- App Store 1.2: users can block other users and report profiles, events, reviews (comments) and live moments.
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('profile', 'event', 'review', 'moment')),
  target_id uuid not null,
  reason text not null default 'inappropriate',
  details text,
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (reporter_id, target_type, target_id)
);
create index if not exists content_reports_open_idx on public.content_reports(status, created_at);

alter table public.user_blocks enable row level security;
alter table public.content_reports enable row level security;

create policy "users read own blocks" on public.user_blocks for select to authenticated using (blocker_id = auth.uid());
create policy "users create own blocks" on public.user_blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy "users delete own blocks" on public.user_blocks for delete to authenticated using (blocker_id = auth.uid());
create policy "users create reports" on public.content_reports for insert to authenticated with check (reporter_id = auth.uid());
