create table if not exists public.host_reviews (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 5 and 1500),
  status text not null default 'published' check (status in ('published','hidden')),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (host_id, event_id, user_id)
);

alter table public.host_reviews enable row level security;

drop policy if exists "published host reviews public read" on public.host_reviews;
drop policy if exists "reviewers read own host reviews" on public.host_reviews;
create policy "published host reviews public read" on public.host_reviews
  for select to anon, authenticated using (status = 'published' or user_id = (select auth.uid()));

create index if not exists host_reviews_host_status_idx on public.host_reviews(host_id, status, created_at desc);
create index if not exists host_reviews_user_event_idx on public.host_reviews(user_id, event_id);
