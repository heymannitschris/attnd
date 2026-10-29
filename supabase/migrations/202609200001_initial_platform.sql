create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (char_length(username) between 3 and 24),
  first_name text check (first_name is null or char_length(first_name) between 2 and 40),
  gender text check (gender in ('woman', 'man')),
  avatar_url text,
  city text,
  latitude double precision,
  longitude double precision,
  search_radius_km integer not null default 25 check (search_radius_km between 1 and 250),
  language text not null default 'English',
  interests text[] not null default '{}',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  host_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled', 'past')),
  title text not null default '',
  description text not null default '',
  category text,
  audience text not null default 'all' check (audience in ('all', 'women', 'men')),
  event_kind text not null default 'single' check (event_kind in ('single', 'series')),
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text not null default 'Asia/Bangkok',
  location_kind text not null default 'venue' check (location_kind in ('venue', 'online')),
  venue_name text,
  address text,
  city text,
  latitude double precision,
  longitude double precision,
  google_maps_url text,
  online_url text,
  location_notes text,
  cover_url text,
  schedule jsonb not null default '[]'::jsonb,
  expectations jsonb not null default '[]'::jsonb,
  affiliate_commission smallint not null default 0 check (affiliate_commission between 0 and 50),
  max_attendees integer check (max_attendees is null or max_attendees > 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  kind text not null check (kind in ('photo', 'video')),
  category text not null default 'Atmosphere',
  description text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text not null default '',
  price_minor integer not null default 0 check (price_minor >= 0),
  currency text not null default 'thb' check (currency ~ '^[a-z]{3}$'),
  quantity integer not null check (quantity > 0),
  sold_count integer not null default 0 check (sold_count >= 0),
  reserved_count integer not null default 0 check (reserved_count >= 0),
  sales_end_at timestamptz,
  benefits text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id),
  event_id uuid not null references public.events(id),
  stripe_checkout_session_id text unique,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'free', 'failed', 'refunded')),
  currency text not null,
  subtotal_minor integer not null default 0,
  platform_fee_minor integer not null default 0,
  total_minor integer not null default 0,
  affiliate_user_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id),
  quantity integer not null check (quantity > 0),
  unit_price_minor integer not null check (unit_price_minor >= 0)
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_id uuid not null references public.events(id),
  ticket_type_id uuid not null references public.ticket_types(id),
  owner_id uuid not null references public.profiles(id),
  attendee_name text,
  attendee_email text,
  qr_token uuid not null unique default gen_random_uuid(),
  status text not null default 'valid' check (status in ('valid', 'used', 'transferred', 'cancelled', 'refunded')),
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_checkins (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references public.tickets(id),
  event_id uuid not null references public.events(id),
  checked_in_by uuid not null references public.profiles(id),
  checked_in_at timestamptz not null default now()
);

create index if not exists events_host_idx on public.events(host_id);
create index if not exists events_status_start_idx on public.events(status, starts_at);
create index if not exists ticket_types_event_idx on public.ticket_types(event_id);
create index if not exists tickets_owner_idx on public.tickets(owner_id);
create index if not exists tickets_event_idx on public.tickets(event_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, first_name, username)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'member'), '@', 1)), 40),
    left(regexp_replace(lower(split_part(coalesce(new.email, new.id::text), '@', 1)), '[^a-z0-9_]', '', 'g') || '_' || left(new.id::text, 6), 24)
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_media enable row level security;
alter table public.ticket_types enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_checkins enable row level security;

create policy "profiles public read" on public.profiles for select to anon, authenticated using (true);
create policy "profiles own insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles own update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "published events public read" on public.events for select to anon, authenticated using (status = 'published' or host_id = (select auth.uid()));
create policy "hosts create events" on public.events for insert to authenticated with check (host_id = (select auth.uid()));
create policy "hosts update events" on public.events for update to authenticated using (host_id = (select auth.uid())) with check (host_id = (select auth.uid()));
create policy "hosts delete draft events" on public.events for delete to authenticated using (host_id = (select auth.uid()) and status = 'draft');

create policy "event media public read" on public.event_media for select to anon, authenticated using (exists (select 1 from public.events e where e.id = event_id and (e.status = 'published' or e.host_id = (select auth.uid()))));
create policy "hosts manage event media" on public.event_media for all to authenticated using (exists (select 1 from public.events e where e.id = event_id and e.host_id = (select auth.uid()))) with check (exists (select 1 from public.events e where e.id = event_id and e.host_id = (select auth.uid())));

create policy "ticket types public read" on public.ticket_types for select to anon, authenticated using (exists (select 1 from public.events e where e.id = event_id and (e.status = 'published' or e.host_id = (select auth.uid()))));
create policy "hosts manage ticket types" on public.ticket_types for all to authenticated using (exists (select 1 from public.events e where e.id = event_id and e.host_id = (select auth.uid()))) with check (exists (select 1 from public.events e where e.id = event_id and e.host_id = (select auth.uid())));

create policy "buyers and hosts read orders" on public.orders for select to authenticated using (buyer_id = (select auth.uid()) or exists (select 1 from public.events e where e.id = event_id and e.host_id = (select auth.uid())));
create policy "buyers create pending orders" on public.orders for insert to authenticated with check (buyer_id = (select auth.uid()) and payment_status in ('pending', 'free'));
create policy "order items visible with order" on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = (select auth.uid()) or exists (select 1 from public.events e where e.id = o.event_id and e.host_id = (select auth.uid())))));
create policy "buyers create order items" on public.order_items for insert to authenticated with check (exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = (select auth.uid()) and o.payment_status = 'pending'));

create policy "owners and hosts read tickets" on public.tickets for select to authenticated using (owner_id = (select auth.uid()) or exists (select 1 from public.events e where e.id = event_id and e.host_id = (select auth.uid())));
create policy "hosts read checkins" on public.ticket_checkins for select to authenticated using (exists (select 1 from public.events e where e.id = event_id and e.host_id = (select auth.uid())));
create policy "hosts create checkins" on public.ticket_checkins for insert to authenticated with check (checked_in_by = (select auth.uid()) and exists (select 1 from public.events e where e.id = event_id and e.host_id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-media', 'event-media', true, 52428800, array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "event media public objects" on storage.objects for select to public using (bucket_id = 'event-media');
create policy "authenticated event media upload" on storage.objects for insert to authenticated with check (bucket_id = 'event-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owners update event media" on storage.objects for update to authenticated using (bucket_id = 'event-media' and owner_id = (select auth.uid()::text));
create policy "owners delete event media" on storage.objects for delete to authenticated using (bucket_id = 'event-media' and owner_id = (select auth.uid()::text));
