-- Add sync_themes column to user_settings
alter table public.user_settings
add column if not exists sync_themes boolean default false;
