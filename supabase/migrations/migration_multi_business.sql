-- Migration Script for Multi-Business Support & Contact Types
-- Run this in the Supabase SQL Editor to update your existing database.

-- 1. Create businesses table if it doesn't exist
create table if not exists public.businesses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);

-- 2. Enable RLS on businesses
alter table public.businesses enable row level security;

-- 3. Add RLS policies for businesses (Safe to run even if they exist, but better to check or drop first if unsure. Here we use 'create policy if not exists' logic by wrapping in DO block or just letting it fail if exists, but standard SQL doesn't have 'IF NOT EXISTS' for policies easily. We'll drop and recreate to be safe.)
drop policy if exists "Users can view own businesses" on public.businesses;
create policy "Users can view own businesses" on public.businesses for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own businesses" on public.businesses;
create policy "Users can insert own businesses" on public.businesses for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own businesses" on public.businesses;
create policy "Users can update own businesses" on public.businesses for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own businesses" on public.businesses;
create policy "Users can delete own businesses" on public.businesses for delete using (auth.uid() = user_id);

-- 4. Seed default business for EXISTING users who don't have one
insert into public.businesses (user_id, name)
select id, 'My Business'
from public.profiles
where id not in (select user_id from public.businesses);

-- 5. Add columns to contacts
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'contacts' and column_name = 'business_id') then
        alter table public.contacts add column business_id uuid references public.businesses(id) on delete cascade;
    end if;
    
    if not exists (select 1 from information_schema.columns where table_name = 'contacts' and column_name = 'type') then
        -- If type column doesn't exist, add it
        alter table public.contacts add column type text check (type in ('CUSTOMER', 'SUPPLIER', 'OTHER')) default 'CUSTOMER';
    else
        -- If it exists (e.g. old 'VENDOR' check), we need to update the constraint
        alter table public.contacts drop constraint if exists contacts_type_check;
        alter table public.contacts add constraint contacts_type_check check (type in ('CUSTOMER', 'SUPPLIER', 'OTHER'));
    end if;
end $$;

-- 6. Backfill business_id for existing contacts
-- Link contacts to the user's default business
update public.contacts c
set business_id = b.id
from public.businesses b
where c.user_id = b.user_id
and c.business_id is null;

-- 7. Add columns to transactions
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'transactions' and column_name = 'business_id') then
        alter table public.transactions add column business_id uuid references public.businesses(id) on delete cascade;
    end if;
end $$;

-- 8. Backfill business_id for existing BUSINESS transactions
update public.transactions t
set business_id = b.id
from public.businesses b
where t.user_id = b.user_id
and t.mode = 'BUSINESS'
and t.business_id is null;

-- 9. Create trigger for NEW users to automatically create a business
create or replace function public.seed_default_business()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.businesses (user_id, name)
  values (new.id, 'My Business');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_seed_business on auth.users;
create trigger on_auth_user_created_seed_business
  after insert on auth.users
  for each row execute procedure public.seed_default_business();
