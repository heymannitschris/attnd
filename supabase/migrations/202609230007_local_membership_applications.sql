alter table public.local_memberships
  add column if not exists proof_storage_path text,
  add column if not exists proof_original_name text,
  add column if not exists proof_mime_type text,
  add column if not exists review_note text not null default '',
  add column if not exists submitted_at timestamptz not null default now(),
  add column if not exists rejected_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'local-membership-proofs',
  'local-membership-proofs',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "members upload own local proof" on storage.objects;
create policy "members upload own local proof" on storage.objects for insert to authenticated
  with check (bucket_id = 'local-membership-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "members read own local proof" on storage.objects;
create policy "members read own local proof" on storage.objects for select to authenticated
  using (bucket_id = 'local-membership-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "members replace own local proof" on storage.objects;
create policy "members replace own local proof" on storage.objects for update to authenticated
  using (bucket_id = 'local-membership-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'local-membership-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "members remove own local proof" on storage.objects;
create policy "members remove own local proof" on storage.objects for delete to authenticated
  using (bucket_id = 'local-membership-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);
