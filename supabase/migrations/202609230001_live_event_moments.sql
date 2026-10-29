alter table public.events
  add column if not exists live_discovery_enabled boolean not null default false,
  add column if not exists ticket_sales_during_event boolean not null default false;

create table if not exists public.event_live_moments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  kind text not null check (kind in ('photo', 'video')),
  caption text not null default '',
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now()
);

create index if not exists event_live_moments_event_created_idx on public.event_live_moments(event_id, created_at desc);
alter table public.event_live_moments enable row level security;

create policy "published live moments public read" on public.event_live_moments
for select to anon, authenticated using (
  status = 'published' and exists (
    select 1 from public.events e where e.id = event_id and e.status = 'published'
  )
);

create policy "checked in guests create live moments" on public.event_live_moments
for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.tickets t
    join public.ticket_checkins c on c.ticket_id = t.id
    where t.event_id = event_live_moments.event_id and t.owner_id = (select auth.uid())
  )
);

create policy "owners hide live moments" on public.event_live_moments
for update to authenticated using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.events e where e.id = event_live_moments.event_id and e.host_id = (select auth.uid())
  )
) with check (
  user_id = (select auth.uid()) or exists (
    select 1 from public.events e where e.id = event_live_moments.event_id and e.host_id = (select auth.uid())
  )
);
