-- Migration Script for User Settings (Theme & Accents)
-- Run this in the Supabase SQL Editor.

-- 1. Create user_settings table
create table if not exists public.user_settings (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  business_theme text check (business_theme in ('light', 'dark')) default 'light',
  personal_theme text check (personal_theme in ('light', 'dark')) default 'dark',
  business_accent text default 'blue', -- preset name or hex
  personal_accent text default 'green', -- preset name or hex
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Enable RLS
alter table public.user_settings enable row level security;

-- 3. RLS Policies
create policy "Users can view own settings" on public.user_settings
  for select using (auth.uid() = user_id);

create policy "Users can insert own settings" on public.user_settings
  for insert with check (auth.uid() = user_id);

create policy "Users can update own settings" on public.user_settings
  for update using (auth.uid() = user_id);

-- 4. Function to handle updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_user_settings_updated
  before update on public.user_settings
  for each row execute procedure public.handle_updated_at();

-- 5. Seed default settings for existing users
insert into public.user_settings (user_id)
select id from public.profiles
where id not in (select user_id from public.user_settings);

-- 6. Trigger to seed settings for NEW users
create or replace function public.seed_default_settings()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_settings (user_id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created_seed_settings
  after insert on auth.users
  for each row execute procedure public.seed_default_settings();
