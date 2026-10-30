-- App Store 5.1.1(v): in-app account deletion.
-- Orders and tickets are kept for accounting, but detached from the deleted person.
-- Every foreign key to public.profiles that would block deletion becomes nullable + ON DELETE SET NULL.

do $$
declare
  fk record;
begin
  for fk in
    select c.conname, c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.profiles'::regclass
      and array_length(c.conkey, 1) = 1
      and c.confdeltype in ('a', 'r')
  loop
    execute format('alter table %s alter column %I drop not null', fk.tbl, fk.col);
    execute format('alter table %s drop constraint %I', fk.tbl, fk.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references public.profiles(id) on delete set null', fk.tbl, fk.conname, fk.col);
  end loop;
end $$;

alter table public.orders add column if not exists buyer_deleted_at timestamptz;

-- Called by the service role right before auth.admin.deleteUser.
create or replace function public.anonymize_account_for_deletion(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tickets
     set attendee_name = 'Deleted user', attendee_email = null
   where owner_id = target_user;

  update public.order_attendees
     set first_name = 'Deleted', last_name = 'user', email = null
   where order_id in (select id from public.orders where buyer_id = target_user);

  update public.orders set buyer_deleted_at = now() where buyer_id = target_user;
end;
$$;

revoke all on function public.anonymize_account_for_deletion(uuid) from public, anon, authenticated;
grant execute on function public.anonymize_account_for_deletion(uuid) to service_role;
