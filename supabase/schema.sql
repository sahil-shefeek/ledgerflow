-- 
-- LedgerFlow: Complete Database Schema
-- Last Updated: 2026-02-19
-- 
-- This idempotent schema file represents the final state of the database.
-- It works on a fresh Supabase instance or can be used as a reference.
-- 

-- ==========================================
-- 1. EXTENSIONS
-- ==========================================
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";
create extension if not exists "pg_net";


-- ==========================================
-- 2. TABLES
-- ==========================================

-- 2.1 Profiles (Extends Supabase Auth)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  username text unique,
  email text,
  business_name text,
  currency_symbol text default '₹',
  phone text,
  avatar_url text, -- Added from migration_storage_profile.sql
  discoverable_by_phone boolean default true,
  discoverable_by_username boolean default true,
  friend_invite_token uuid default gen_random_uuid() unique,
  created_at timestamptz default now()
);

-- 2.2 User Settings
create table if not exists public.user_settings (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  business_theme text check (business_theme in ('light', 'dark')) default 'light',
  personal_theme text check (personal_theme in ('light', 'dark')) default 'dark',
  business_accent text default 'blue',
  personal_accent text default 'green',
  sync_themes boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.3 Businesses (For Multiple Khatabooks)
create table if not exists public.businesses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);

-- 2.4 Contacts (The "Khata" entities)
create table if not exists public.contacts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null,
  image_url text,
  phone text,
  type text check (type in ('CUSTOMER', 'SUPPLIER', 'OTHER')) default 'CUSTOMER',
  net_balance numeric default 0.00,
  transaction_count integer default 0, -- Added from migration_personal_people.sql
  last_transaction_at timestamptz default now(),
  created_at timestamptz default now()
);

-- 2.5 Categories
create table if not exists public.categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  icon text,
  type text check (type in ('INCOME', 'EXPENSE')),
  budget_limit numeric,
  active boolean default true, -- Added from 20251205_add_category_active.sql
  created_at timestamptz default now()
);

-- 2.6 Accounts
create table if not exists public.accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  type text check (type in ('CASH', 'BANK', 'WALLET', 'OTHER')),
  balance numeric default 0.00,
  is_default boolean default false,
  created_at timestamptz default now()
);

-- 2.7 Groups
create table if not exists public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by uuid references public.profiles(id),
  avatar_url text,
  type text default 'GENERAL',
  invite_code uuid default gen_random_uuid() unique,
  created_at timestamptz default now()
);

-- 2.8 Group Members
create table if not exists public.group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.profiles(id),
  ghost_name text,
  avatar_url text,
  joined_at timestamptz default now(),
  constraint check_user_or_ghost check ((user_id is not null) or (ghost_name is not null)),
  unique (group_id, user_id)
);

-- 2.9 Friendships
create table if not exists public.friendships (
  id uuid default gen_random_uuid() primary key,
  user_id_1 uuid references public.profiles(id),
  user_id_2 uuid references public.profiles(id),
  status text check (status in ('PENDING', 'ACCEPTED')),
  constraint check_user_order check (user_id_1 < user_id_2) -- Prevent duplicates
);

-- 2.10 Transactions (The Single Source of Truth)
create table if not exists public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  business_id uuid references public.businesses(id) on delete cascade,
  
  -- Core Data
  amount numeric not null check (amount > 0),
  flow text check (flow in ('IN', 'OUT')),
  mode text check (mode in ('BUSINESS', 'PERSONAL')),
  name text not null, -- Renamed from description
  note text,
  date timestamptz not null default now(),
  
  -- Relationships
  contact_id uuid references public.contacts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  
  -- Groups Integration
  group_id uuid references public.groups(id) on delete set null, -- Nullable for soft delete
  payer_id uuid references public.profiles(id),
  split_type text default 'EQUALLY' check (split_type in ('EQUALLY', 'BY_AMOUNT', 'BY_PERCENTAGE')),

  -- Metadata
  attachment_url text,
  due_date timestamptz,
  created_at timestamptz default now()
);

-- 2.11 Transaction Splits
create table if not exists public.transaction_splits (
  id uuid default gen_random_uuid() primary key,
  transaction_id uuid references public.transactions(id) on delete cascade,
  user_id uuid references public.profiles(id),
  group_member_id uuid references public.group_members(id) on delete set null, -- Fix for group deletion
  member_name_snapshot text, -- Snapshot of name at time of transaction
  amount numeric not null,
  percentage numeric,
  is_settled boolean default false
);

-- 2.12 Recurring Transactions
create table if not exists public.recurring_transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric not null check (amount > 0),
  flow text check (flow in ('IN', 'OUT')) default 'OUT',
  name text not null,
  note text,
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  frequency text check (frequency in ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')) not null,
  start_date timestamptz not null default now(),
  next_run_date timestamptz not null,
  last_run_date timestamptz,
  active boolean default true,
  created_at timestamptz default now()
);

-- 2.13 Notifications
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id),
  type text check (type in ('FRIEND_REQ', 'GROUP_INVITE', 'EXPENSE_ADDED')),
  title text,
  message text,
  data jsonb,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- 2.14 Goals
create table if not exists public.goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  target_amount numeric not null check (target_amount > 0),
  current_amount numeric default 0 check (current_amount >= 0),
  deadline timestamptz,
  created_at timestamptz default now()
);


-- ==========================================
-- 3. STORAGE
-- ==========================================

-- Create "avatars" bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'avatars' );

create policy "Users can upload own avatar"
on storage.objects for insert
with check (
  bucket_id = 'avatars' 
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update own avatar"
on storage.objects for update
using (
  bucket_id = 'avatars' 
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own avatar"
on storage.objects for delete
using (
  bucket_id = 'avatars' 
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);


-- ==========================================
-- 4. INDEXES
-- ==========================================

-- RLS Performance
create index if not exists contacts_user_id_idx on public.contacts(user_id);
create index if not exists categories_user_id_idx on public.categories(user_id);
create index if not exists accounts_user_id_idx on public.accounts(user_id);
create index if not exists businesses_user_id_idx on public.businesses(user_id);
create index if not exists recurring_transactions_user_id_idx on public.recurring_transactions(user_id);
create index if not exists goals_user_id_idx on public.goals(user_id);

-- Foreign Keys
create index if not exists contacts_business_id_idx on public.contacts(business_id);
create index if not exists transactions_user_id_date_idx on public.transactions(user_id, date);
create index if not exists transactions_mode_idx on public.transactions(mode);
create index if not exists transactions_category_id_idx on public.transactions(category_id);
create index if not exists transactions_contact_id_idx on public.transactions(contact_id);
create index if not exists transactions_account_id_idx on public.transactions(account_id);
create index if not exists transactions_business_id_idx on public.transactions(business_id);
create index if not exists recurring_transactions_category_id_idx on public.recurring_transactions(category_id);
create index if not exists recurring_transactions_account_id_idx on public.recurring_transactions(account_id);

-- Filter Columns
create index if not exists contacts_type_idx on public.contacts(type);
create index if not exists categories_active_idx on public.categories(active);

-- Analytics
create index if not exists transactions_analytics_idx on public.transactions(user_id, mode, date);


-- ==========================================
-- 5. FUNCTIONS
-- ==========================================

-- 5.1 RLS Helpers (SECURITY DEFINER REQUIRED)
create or replace function get_my_group_ids()
returns table (group_id uuid)
security definer
set search_path = public
language plpgsql
as $$
begin
  return query select gm.group_id from public.group_members gm where gm.user_id = auth.uid();
end;
$$;

create or replace function is_transaction_creator(txn_id uuid)
returns boolean
security definer
set search_path = public
language plpgsql
as $$
begin
  return exists (select 1 from public.transactions t where t.id = txn_id and t.user_id = auth.uid());
end;
$$;


-- 5.2 User Management
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email, phone)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email,
    new.phone
  );
  return new;
end;
$$;

create or replace function public.seed_default_categories()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.categories (user_id, name, icon, type, active)
  values
    (new.id, 'Food', '🍔', 'EXPENSE', true),
    (new.id, 'Transport', '🚗', 'EXPENSE', true),
    (new.id, 'Shopping', '🛍️', 'EXPENSE', true),
    (new.id, 'Entertainment', '🎬', 'EXPENSE', true),
    (new.id, 'Bills', '💡', 'EXPENSE', true),
    (new.id, 'Health', '🏥', 'EXPENSE', true),
    (new.id, 'Education', '📚', 'EXPENSE', true),
    (new.id, 'Groceries', '🛒', 'EXPENSE', true),
    (new.id, 'Rent', '🏠', 'EXPENSE', true),
    (new.id, 'Utilities', '⚡', 'EXPENSE', true),
    (new.id, 'Insurance', '🛡️', 'EXPENSE', true),
    (new.id, 'Savings', '💰', 'EXPENSE', true),
    (new.id, 'Investment', '📈', 'EXPENSE', true),
    (new.id, 'Gifts', '🎁', 'EXPENSE', true),
    (new.id, 'Travel', '✈️', 'EXPENSE', true),
    (new.id, 'Fuel', '⛽', 'EXPENSE', true),
    (new.id, 'Maintenance', '🔧', 'EXPENSE', true),
    (new.id, 'Pets', '🐾', 'EXPENSE', true),
    (new.id, 'Kids', '🧸', 'EXPENSE', true),
    (new.id, 'Salary', '💵', 'INCOME', true),
    (new.id, 'Business', '💼', 'INCOME', true),
    (new.id, 'Interest', '🏦', 'INCOME', true);
  return new;
end;
$$;

create or replace function public.seed_default_accounts()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.accounts (user_id, name, type, balance, is_default)
  values
    (new.id, 'Cash', 'CASH', 0, true),
    (new.id, 'Bank Account', 'BANK', 0, false);
  return new;
end;
$$;

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


-- 5.3 Group Management
create or replace function public.handle_group_creation()
returns trigger as $$
begin
  -- Always set created_by to the current user, preventing spoofing
  new.created_by := auth.uid();
  return new;
end;
$$ language plpgsql security definer;


-- 5.4 Logic Triggers (Balances)
create or replace function update_contact_balance()
returns trigger as $$
begin
  -- Logic for INSERT
  if (tg_op = 'INSERT' and new.contact_id is not null) then
    update contacts
    set 
      net_balance = net_balance + (case when new.flow = 'OUT' then new.amount else -new.amount end),
      transaction_count = transaction_count + 1,
      last_transaction_at = new.date
    where id = new.contact_id;
  end if;

  -- Logic for UPDATE
  if (tg_op = 'UPDATE') then
    -- Reverse OLD impact
    if (old.contact_id is not null) then
      update contacts
      set 
        net_balance = net_balance - (case when old.flow = 'OUT' then old.amount else -old.amount end),
        transaction_count = greatest(0, transaction_count - 1)
      where id = old.contact_id;
    end if;

    -- Apply NEW impact
    if (new.contact_id is not null) then
      update contacts
      set 
        net_balance = net_balance + (case when new.flow = 'OUT' then new.amount else -new.amount end),
        transaction_count = transaction_count + 1,
        last_transaction_at = new.date
      where id = new.contact_id;
    end if;
  end if;

  -- Logic for DELETE
  if (tg_op = 'DELETE' and old.contact_id is not null) then
    update contacts
    set 
      net_balance = net_balance - (case when old.flow = 'OUT' then old.amount else -old.amount end),
      transaction_count = greatest(0, transaction_count - 1)
    where id = old.contact_id;
  end if;
  
  return null;
end;
$$ language plpgsql;

create or replace function update_account_balance()
returns trigger as $$
begin
  -- Logic for INSERT
  if (tg_op = 'INSERT' and new.mode = 'PERSONAL' and new.account_id is not null) then
    update accounts
    set 
      balance = balance + (case when new.flow = 'IN' then new.amount else -new.amount end)
    where id = new.account_id;
  end if;

  -- Logic for UPDATE
  if (tg_op = 'UPDATE') then
    -- Reverse OLD
    if (old.mode = 'PERSONAL' and old.account_id is not null) then
      update accounts
      set balance = balance - (case when old.flow = 'IN' then old.amount else -old.amount end)
      where id = old.account_id;
    end if;

    -- Apply NEW
    if (new.mode = 'PERSONAL' and new.account_id is not null) then
      update accounts
      set balance = balance + (case when new.flow = 'IN' then new.amount else -new.amount end)
      where id = new.account_id;
    end if;
  end if;

  -- Logic for DELETE
  if (tg_op = 'DELETE' and old.mode = 'PERSONAL' and old.account_id is not null) then
    update accounts
    set balance = balance - (case when old.flow = 'IN' then old.amount else -old.amount end)
    where id = old.account_id;
  end if;
  
  return null;
end;
$$ language plpgsql;

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- 5.5 Analytics
create or replace function get_monthly_category_spend(
  p_user_id uuid, 
  p_month int, 
  p_year int
)
returns table (
  category_name text,
  category_color text,
  total_spent numeric
)
language plpgsql
as $$
begin
  return query
  select 
    c.name as category_name,
    c.icon as category_color,
    sum(t.amount) as total_spent
  from transactions t
  join categories c on t.category_id = c.id
  where t.user_id = p_user_id
    and t.mode = 'PERSONAL'
    and t.flow = 'OUT'
    and extract(month from t.date) = p_month
    and extract(year from t.date) = p_year
  group by c.name, c.icon;
end;
$$;


create or replace function accept_friend_invite(invite_token uuid)
returns json
security definer
as $$
declare
    target_user record;
    uid uuid;
    existing_friendship record;
begin
    uid := auth.uid();
    if uid is null then
        raise exception 'Not authenticated';
    end if;

    -- Find the user who owns the invite token
    select * into target_user from public.profiles where friend_invite_token = invite_token;

    if not found then
        raise exception 'Invalid or expired invite link';
    end if;

    -- Prevent self-invite
    if target_user.id = uid then
        raise exception 'You cannot become friends with yourself';
    end if;

    -- Check if friendship already exists
    select * into existing_friendship from public.friendships 
    where (user_id_1 = target_user.id and user_id_2 = uid)
       or (user_id_1 = uid and user_id_2 = target_user.id);

    if not found then
        -- Insert friendship in deterministic order
        if target_user.id < uid then
            insert into public.friendships (user_id_1, user_id_2, status) 
            values (target_user.id, uid, 'ACCEPTED');
        else
            insert into public.friendships (user_id_1, user_id_2, status) 
            values (uid, target_user.id, 'ACCEPTED');
        end if;
    else
        -- Update to ACCEPTED if it was PENDING
        if existing_friendship.status = 'PENDING' then
            update public.friendships 
            set status = 'ACCEPTED' 
            where id = existing_friendship.id;
        end if;
    end if;

    return json_build_object(
        'success', true,
        'target_name', target_user.full_name
    );
end;
$$ language plpgsql;


-- ==========================================
-- 6. TRIGGERS
-- ==========================================

-- Auth Triggers
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create trigger on_auth_user_created_seed_categories
  after insert on auth.users
  for each row execute procedure public.seed_default_categories();

create trigger on_auth_user_created_seed_accounts
  after insert on auth.users
  for each row execute procedure public.seed_default_accounts();

create trigger on_auth_user_created_seed_business
  after insert on auth.users
  for each row execute procedure public.seed_default_business();

create trigger on_auth_user_created_seed_settings
  after insert on auth.users
  for each row execute procedure public.seed_default_settings();

-- Group Triggers
create trigger set_group_created_by
  before insert on public.groups
  for each row execute function public.handle_group_creation();

-- Transaction Triggers
create trigger trigger_update_balance
  after insert or update or delete on transactions
  for each row execute function update_contact_balance();

create trigger trigger_update_account_balance
  after insert or update or delete on transactions
  for each row execute function update_account_balance();

-- User Settings Triggers
create trigger on_user_settings_updated
  before update on public.user_settings
  for each row execute procedure public.handle_updated_at();


-- ==========================================
-- 7. RLS POLICIES
-- ==========================================

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.businesses enable row level security;
alter table public.contacts enable row level security;
alter table public.categories enable row level security;
alter table public.accounts enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.friendships enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_splits enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.goals enable row level security;

-- Profiles
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- User Settings
create policy "Users can view own settings" on public.user_settings for select using (auth.uid() = user_id);
create policy "Users can insert own settings" on public.user_settings for insert with check (auth.uid() = user_id);
create policy "Users can update own settings" on public.user_settings for update using (auth.uid() = user_id);

-- Businesses
create policy "Users can view own businesses" on public.businesses for select using (auth.uid() = user_id);
create policy "Users can insert own businesses" on public.businesses for insert with check (auth.uid() = user_id);
create policy "Users can update own businesses" on public.businesses for update using (auth.uid() = user_id);
create policy "Users can delete own businesses" on public.businesses for delete using (auth.uid() = user_id);

-- Contacts
create policy "Users can view own contacts" on public.contacts for select using (auth.uid() = user_id);
create policy "Users can insert own contacts" on public.contacts for insert with check (auth.uid() = user_id);
create policy "Users can update own contacts" on public.contacts for update using (auth.uid() = user_id);
create policy "Users can delete own contacts" on public.contacts for delete using (auth.uid() = user_id);

-- Categories
create policy "Users can view own categories" on public.categories for select using (auth.uid() = user_id);
create policy "Users can insert own categories" on public.categories for insert with check (auth.uid() = user_id);
create policy "Users can update own categories" on public.categories for update using (auth.uid() = user_id);
create policy "Users can delete own categories" on public.categories for delete using (auth.uid() = user_id);

-- Accounts
create policy "Users can view own accounts" on public.accounts for select using (auth.uid() = user_id);
create policy "Users can insert own accounts" on public.accounts for insert with check (auth.uid() = user_id);
create policy "Users can update own accounts" on public.accounts for update using (auth.uid() = user_id);
create policy "Users can delete own accounts" on public.accounts for delete using (auth.uid() = user_id);

-- Goals
create policy "Users can view own goals" on public.goals for select using (auth.uid() = user_id);
create policy "Users can insert own goals" on public.goals for insert with check (auth.uid() = user_id);
create policy "Users can update own goals" on public.goals for update using (auth.uid() = user_id);
create policy "Users can delete own goals" on public.goals for delete using (auth.uid() = user_id);

-- Recurring Transactions
create policy "Users can view own recurring transactions" on public.recurring_transactions for select using (auth.uid() = user_id);
create policy "Users can insert own recurring transactions" on public.recurring_transactions for insert with check (auth.uid() = user_id);
create policy "Users can update own recurring transactions" on public.recurring_transactions for update using (auth.uid() = user_id);

-- Groups
create policy "Authenticated users can create groups" on public.groups for insert to authenticated with check (true);

create policy "Members or Creator can view groups" on public.groups for select
using (id in (select * from get_my_group_ids()) or created_by = auth.uid());

create policy "Members or Creator can update groups" on public.groups for update
using (id in (select * from get_my_group_ids()) or created_by = auth.uid());

create policy "Members or Creator can delete groups" on public.groups for delete
using (id in (select * from get_my_group_ids()) or created_by = auth.uid());

-- Group Members
create policy "Members can view group roster" on public.group_members for select
using (group_id in (select * from get_my_group_ids()));

create policy "Admins can add members" on public.group_members for insert with check (
  exists (select 1 from public.groups where id = group_id and created_by = auth.uid())
  or
  group_id in (select * from get_my_group_ids())
);

create policy "Admins or Self can remove members" on public.group_members for delete using (
  exists (select 1 from public.groups where id = group_id and created_by = auth.uid())
  or
  user_id = auth.uid()
);

-- Friendships
create policy "Users can view their friendships" on public.friendships for select
using (auth.uid() = user_id_1 or auth.uid() = user_id_2);

-- Notifications
create policy "Users can view own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Users can update own notifications" on public.notifications for update using (auth.uid() = user_id);

-- Transactions
create policy "Users can view own or involved transactions" on public.transactions for select
using (
  auth.uid() = user_id 
  or 
  auth.uid() in (select user_id from public.transaction_splits where transaction_id = id)
);

create policy "Users can insert own transactions" on public.transactions for insert with check (auth.uid() = user_id);
create policy "Users can update own transactions" on public.transactions for update using (auth.uid() = user_id);
create policy "Users can delete own transactions" on public.transactions for delete using (auth.uid() = user_id);

-- Transaction Splits
create policy "View splits if creator or involved" on public.transaction_splits for select
using (
  auth.uid() = user_id
  or
  is_transaction_creator(transaction_id)
);

create policy "Creators can insert splits" on public.transaction_splits for insert
with check (is_transaction_creator(transaction_id));

create policy "Creators can update splits" on public.transaction_splits for update
using (is_transaction_creator(transaction_id));

create policy "Creators can delete splits" on public.transaction_splits for delete
using (is_transaction_creator(transaction_id));


-- ==========================================
-- 8. REALTIME & CRON
-- ==========================================

-- Realtime
alter publication supabase_realtime add table notifications;

-- Cron Schedule
-- Runs at midnight UTC
select cron.schedule(
  'process-recurring-transactions',
  '0 0 * * *',
  $$
  select
    net.http_post(
        url:='https://qfoalcsdorwfogayfcdn.supabase.co/functions/v1/process-recurring',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmb2FsY3Nkb3J3Zm9nYXlmY2RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTQzMjksImV4cCI6MjA3OTk5MDMyOX0.123luyhXoQlFl2PYaS5gV4FJEsYdRxI0l276ceYqbH0"}'::jsonb
    ) as request_id;
  $$
);
