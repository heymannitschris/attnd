create table if not exists public.event_reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 5 and 1500),
  status text not null default 'published' check (status in ('published','hidden')),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists public.event_review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.event_reviews(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at timestamptz not null default now(),
  unique (review_id, reporter_id)
);

alter table public.event_reviews enable row level security;
alter table public.event_review_reports enable row level security;

drop policy if exists "published reviews public read" on public.event_reviews;
drop policy if exists "checked in guests create reviews" on public.event_reviews;
drop policy if exists "reviewers update own reviews" on public.event_reviews;
drop policy if exists "reviewers delete own reviews" on public.event_reviews;
drop policy if exists "users report reviews" on public.event_review_reports;
drop policy if exists "users read own review reports" on public.event_review_reports;
create policy "published reviews public read" on public.event_reviews for select to anon, authenticated using (status = 'published' or user_id = (select auth.uid()));
create policy "checked in guests create reviews" on public.event_reviews for insert to authenticated with check (user_id = (select auth.uid()) and exists (select 1 from public.tickets t where t.event_id = event_reviews.event_id and t.owner_id = (select auth.uid()) and t.status = 'used'));
create policy "reviewers update own reviews" on public.event_reviews for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and status = 'published');
create policy "reviewers delete own reviews" on public.event_reviews for delete to authenticated using (user_id = (select auth.uid()));
create policy "users report reviews" on public.event_review_reports for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "users read own review reports" on public.event_review_reports for select to authenticated using (reporter_id = (select auth.uid()));

create index if not exists event_reviews_event_status_idx on public.event_reviews(event_id, status, created_at desc);
create index if not exists event_review_reports_status_idx on public.event_review_reports(status, created_at desc);
