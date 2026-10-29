-- Keep profile and event moderation checks in separate trigger functions.
-- A polymorphic NEW record cannot safely reference columns from both tables.
create or replace function public.protect_profile_moderation_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' and (
    new.account_status is distinct from old.account_status or
    new.suspended_at is distinct from old.suspended_at or
    new.suspended_by is distinct from old.suspended_by or
    new.suspension_reason is distinct from old.suspension_reason
  ) then
    raise exception 'Moderation fields can only be changed by Attnd administrators';
  end if;
  return new;
end;
$$;

create or replace function public.protect_event_moderation_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' and (
    new.admin_suspended is distinct from old.admin_suspended or
    new.admin_suspended_at is distinct from old.admin_suspended_at or
    new.admin_suspended_by is distinct from old.admin_suspended_by or
    new.admin_suspension_reason is distinct from old.admin_suspension_reason
  ) then
    raise exception 'Moderation fields can only be changed by Attnd administrators';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_moderation_fields on public.profiles;
create trigger protect_profile_moderation_fields
before update on public.profiles
for each row execute function public.protect_profile_moderation_fields();

drop trigger if exists protect_event_moderation_fields on public.events;
create trigger protect_event_moderation_fields
before update on public.events
for each row execute function public.protect_event_moderation_fields();

