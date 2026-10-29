create table if not exists public.admin_users (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'admin' check (role in ('super_admin','admin','support','finance','moderator')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.admin_users (user_id, role)
values ('c2d48231-5e0a-45dd-b119-4bc950b19c91', 'super_admin')
on conflict (user_id) do update set role = excluded.role, active = true;

alter table public.profiles
  add column if not exists account_status text not null default 'active' check (account_status in ('active','suspended')),
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references public.profiles(id) on delete set null,
  add column if not exists suspension_reason text not null default '';

alter table public.events
  add column if not exists admin_suspended boolean not null default false,
  add column if not exists admin_suspended_at timestamptz,
  add column if not exists admin_suspended_by uuid references public.profiles(id) on delete set null,
  add column if not exists admin_suspension_reason text not null default '';

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 5 and 1000),
  status text not null default 'open' check (status in ('open','approved','rejected','needs_info')),
  resolution_note text not null default '',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id text not null,
  note text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_payment_cases (
  order_id uuid primary key references public.orders(id) on delete cascade,
  status text not null default 'open' check (status in ('open','resolved','ignored')),
  note text not null default '',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.refund_requests enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.admin_payment_cases enable row level security;

create policy "admins read own role" on public.admin_users for select to authenticated using (user_id = (select auth.uid()));
create policy "buyers create refund requests" on public.refund_requests for insert to authenticated
  with check (requester_id = (select auth.uid()) and exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = (select auth.uid()) and o.payment_status = 'paid'));
create policy "buyers read own refund requests" on public.refund_requests for select to authenticated using (requester_id = (select auth.uid()));

drop policy if exists "profiles public read" on public.profiles;
create policy "active profiles public read" on public.profiles for select to anon, authenticated
  using (account_status = 'active' or id = (select auth.uid()));

drop policy if exists "published events public read" on public.events;
create policy "published active events public read" on public.events for select to anon, authenticated
  using ((status = 'published' and not admin_suspended) or host_id = (select auth.uid()));

create index if not exists profiles_account_status_idx on public.profiles(account_status, created_at desc);
create index if not exists events_admin_suspended_idx on public.events(admin_suspended, status, created_at desc);
create index if not exists refund_requests_status_idx on public.refund_requests(status, created_at desc);
create index if not exists admin_audit_created_idx on public.admin_audit_log(created_at desc);

create or replace function public.protect_admin_moderation_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then
    if tg_table_name = 'profiles' and (
      new.account_status is distinct from old.account_status or new.suspended_at is distinct from old.suspended_at or
      new.suspended_by is distinct from old.suspended_by or new.suspension_reason is distinct from old.suspension_reason
    ) then raise exception 'Moderation fields can only be changed by Attnd administrators'; end if;
    if tg_table_name = 'events' and (
      new.admin_suspended is distinct from old.admin_suspended or new.admin_suspended_at is distinct from old.admin_suspended_at or
      new.admin_suspended_by is distinct from old.admin_suspended_by or new.admin_suspension_reason is distinct from old.admin_suspension_reason
    ) then raise exception 'Moderation fields can only be changed by Attnd administrators'; end if;
  end if;
  return new;
end; $$;

drop trigger if exists protect_profile_moderation_fields on public.profiles;
create trigger protect_profile_moderation_fields before update on public.profiles for each row execute function public.protect_admin_moderation_fields();
drop trigger if exists protect_event_moderation_fields on public.events;
create trigger protect_event_moderation_fields before update on public.events for each row execute function public.protect_admin_moderation_fields();
