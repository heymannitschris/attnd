create table if not exists public.profile_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint profile_follows_not_self check (follower_id <> following_id)
);

create index if not exists profile_follows_following_idx on public.profile_follows(following_id, created_at desc);
create index if not exists profile_follows_follower_idx on public.profile_follows(follower_id, created_at desc);

alter table public.profile_follows enable row level security;

drop policy if exists "users read profile follows" on public.profile_follows;
drop policy if exists "users create own follows" on public.profile_follows;
drop policy if exists "users delete own follows" on public.profile_follows;

create policy "users read profile follows" on public.profile_follows
  for select to authenticated using (true);

create policy "users create own follows" on public.profile_follows
  for insert to authenticated with check (follower_id = (select auth.uid()));

create policy "users delete own follows" on public.profile_follows
  for delete to authenticated using (follower_id = (select auth.uid()));
