-- Supabase-only setup for /admin. Not a Drizzle migration: it touches the auth
-- and storage schemas, which PGlite (local dev + tests) doesn't have.
-- Apply once per project, after drizzle/0001_admin.sql. Safe to re-run.
-- Applied to house-of-track (gdfnftdtnilipnbutyep) on 2026-11-11.

-- Is the signed-in Supabase user on the admin list? SECURITY DEFINER because
-- public.admins has RLS on with no policies (only the app's owner role reads
-- it); this function reads exactly one fact for the caller and nothing else.
-- Owner must be postgres, NOT hot_app: the function calls auth.uid(), and
-- Supabase won't let hot_app have USAGE on the auth schema ("permission denied
-- for schema auth"). postgres bypasses RLS and can read admins.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;
alter function public.is_admin() owner to postgres;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Product photos. Public read (they're on the shop and in emails); only admins
-- upload, replace or delete, straight from the browser with their own session.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media admin select" on storage.objects;
drop policy if exists "media admin insert" on storage.objects;
drop policy if exists "media admin update" on storage.objects;
drop policy if exists "media admin delete" on storage.objects;
-- Storage needs SELECT to delete or overwrite; public URLs don't use this policy.
create policy "media admin select" on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.is_admin());
create policy "media admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());
create policy "media admin update" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin());
create policy "media admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());
