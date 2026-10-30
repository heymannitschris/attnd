-- Unlisted events: bookable via direct link, hidden from feeds, map and host profiles.
alter table public.events add column if not exists unlisted boolean not null default false;
