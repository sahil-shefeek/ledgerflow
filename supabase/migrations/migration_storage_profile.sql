-- 1. Add avatar_url to profiles
alter table public.profiles
add column avatar_url text;

-- 2. Create "avatars" bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 3. RLS for Avatars Bucket

-- Policy: Public can view avatars (since bucket is public, but let's be explicit if needed, 
-- though 'public' bucket usually implies public read). 
-- However, storage.objects RLS is what truly controls access.

-- Allow public read access to all files in "avatars" bucket
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'avatars' );

-- Allow authenticated users to upload files to their own folder: avatars/{user_id}/*
create policy "Users can upload own avatar"
on storage.objects for insert
with check (
  bucket_id = 'avatars' 
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own avatar
create policy "Users can update own avatar"
on storage.objects for update
using (
  bucket_id = 'avatars' 
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own avatar
create policy "Users can delete own avatar"
on storage.objects for delete
using (
  bucket_id = 'avatars' 
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
