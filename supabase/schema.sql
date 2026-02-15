-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- 1. Table: profiles (Extends Supabase Auth)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  business_name text,
  currency_symbol text default '₹',
  phone text,
  avatar_url text,
  created_at timestamptz default now()
);

-- 2. Table: businesses (For Multiple Khatabooks)
create table public.businesses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);

-- 3. Table: contacts (The "Khata" entities)
create table public.contacts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null,
  image_url text,
  phone text,
  type text check (type in ('CUSTOMER', 'SUPPLIER', 'OTHER')) default 'CUSTOMER',
  net_balance numeric default 0.00,
  last_transaction_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Index for faster lookups
create index contacts_user_id_idx on public.contacts(user_id);
create index contacts_business_id_idx on public.contacts(business_id);

-- 4. Table: categories (For Personal Expense tracking)
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  icon text, -- Lucide icon name
  type text check (type in ('INCOME', 'EXPENSE')),
  budget_limit numeric,
  active boolean default true,
  created_at timestamptz default now()
);

-- 5. Table: transactions (The Single Source of Truth)
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  business_id uuid references public.businesses(id) on delete cascade,
  amount numeric not null check (amount > 0),
  flow text check (flow in ('IN', 'OUT')),
  mode text check (mode in ('BUSINESS', 'PERSONAL')),
  contact_id uuid references public.contacts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  date timestamptz not null default now(),
  name text not null,
  note text,
  attachment_url text,
  created_at timestamptz default now()
);

-- 5. Table: goals (For Personal Savings Goals)
create table public.goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  target_amount numeric not null check (target_amount > 0),
  current_amount numeric default 0 check (current_amount >= 0),
  deadline timestamptz,
  created_at timestamptz default now()
);

-- Indexes for performance
create index transactions_user_id_date_idx on public.transactions(user_id, date);
create index transactions_mode_idx on public.transactions(mode);
create index goals_user_id_idx on public.goals(user_id);

-- RLS Policies
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;

-- Profiles: Users can only see their own profile
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Contacts: Users can only see/edit their own contacts
create policy "Users can view own contacts" on public.contacts
  for select using (auth.uid() = user_id);

create policy "Users can insert own contacts" on public.contacts
  for insert with check (auth.uid() = user_id);

create policy "Users can update own contacts" on public.contacts
  for update using (auth.uid() = user_id);

create policy "Users can delete own contacts" on public.contacts
  for delete using (auth.uid() = user_id);

-- Categories: Users can only see/edit their own categories
create policy "Users can view own categories" on public.categories
  for select using (auth.uid() = user_id);

create policy "Users can insert own categories" on public.categories
  for insert with check (auth.uid() = user_id);

create policy "Users can update own categories" on public.categories
  for update using (auth.uid() = user_id);

create policy "Users can delete own categories" on public.categories
  for delete using (auth.uid() = user_id);

-- Transactions: Users can only see/edit their own transactions
create policy "Users can view own transactions" on public.transactions
  for select using (auth.uid() = user_id);

create policy "Users can insert own transactions" on public.transactions
  for insert with check (auth.uid() = user_id);

create policy "Users can update own transactions" on public.transactions
  for update using (auth.uid() = user_id);

create policy "Users can delete own transactions" on public.transactions
  for delete using (auth.uid() = user_id);

-- Goals: Users can only see/edit their own goals
create policy "Users can view own goals" on public.goals
  for select using (auth.uid() = user_id);

create policy "Users can insert own goals" on public.goals
  for insert with check (auth.uid() = user_id);

create policy "Users can update own goals" on public.goals
  for update using (auth.uid() = user_id);

create policy "Users can delete own goals" on public.goals
  for delete using (auth.uid() = user_id);


-- Functions & Triggers

-- Function to auto-update contact balance
create or replace function update_contact_balance()
returns trigger as $$
begin
  -- Logic for INSERT
  if (TG_OP = 'INSERT' AND NEW.contact_id IS NOT NULL) then
    update contacts
    set 
      net_balance = net_balance + (case when NEW.flow = 'OUT' then NEW.amount else -NEW.amount end),
      last_transaction_at = NEW.date
    where id = NEW.contact_id;
  end if;

  -- Logic for UPDATE
  if (TG_OP = 'UPDATE') then
    -- Reverse OLD impact
    if (OLD.contact_id IS NOT NULL) then
      update contacts
      set net_balance = net_balance - (case when OLD.flow = 'OUT' then OLD.amount else -OLD.amount end)
      where id = OLD.contact_id;
    end if;

    -- Apply NEW impact
    if (NEW.contact_id IS NOT NULL) then
      update contacts
      set 
        net_balance = net_balance + (case when NEW.flow = 'OUT' then NEW.amount else -NEW.amount end),
        last_transaction_at = NEW.date
      where id = NEW.contact_id;
    end if;
  end if;

  -- Logic for DELETE
  if (TG_OP = 'DELETE' AND OLD.contact_id IS NOT NULL) then
    update contacts
    set net_balance = net_balance - (case when OLD.flow = 'OUT' then OLD.amount else -OLD.amount end)
    where id = OLD.contact_id;
  end if;
  
  return null;
end;
$$ language plpgsql;

-- Attach Trigger to Transactions Table
create trigger trigger_update_balance
after insert or update or delete on transactions
for each row
execute function update_contact_balance();


-- Trigger to create a public profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.phone);
  return new;
end;
$$;

-- Attach the trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Function to get monthly spending breakdown (Analytics)
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


-- Seed default categories for new users
-- Note: This trigger ensures every new user gets a default set of categories
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

-- Attach trigger to auth.users to seed categories on signup
create trigger on_auth_user_created_seed_categories
  after insert on auth.users
  for each row execute procedure public.seed_default_categories();

-- 6. Table: accounts (For Personal Finance - Cash, Bank, Wallet)
create table public.accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  type text check (type in ('CASH', 'BANK', 'WALLET', 'OTHER')),
  balance numeric default 0.00,
  is_default boolean default false,
  created_at timestamptz default now()
);

-- Add account_id to transactions
alter table public.transactions 
add column account_id uuid references public.accounts(id) on delete set null;

alter table public.transactions
add column due_date timestamptz;

-- RLS for Accounts
alter table public.accounts enable row level security;

create policy "Users can view own accounts" on public.accounts
  for select using (auth.uid() = user_id);

create policy "Users can insert own accounts" on public.accounts
  for insert with check (auth.uid() = user_id);

create policy "Users can update own accounts" on public.accounts
  for update using (auth.uid() = user_id);

create policy "Users can delete own accounts" on public.accounts
  for delete using (auth.uid() = user_id);

-- Function to auto-update account balance
create or replace function update_account_balance()
returns trigger as $$
begin
  -- Logic for INSERT
  if (TG_OP = 'INSERT' AND NEW.mode = 'PERSONAL' AND NEW.account_id IS NOT NULL) then
    update accounts
    set 
      balance = balance + (case when NEW.flow = 'IN' then NEW.amount else -NEW.amount end)
    where id = NEW.account_id;
  end if;

  -- Logic for UPDATE
  if (TG_OP = 'UPDATE') then
    -- Reverse OLD
    if (OLD.mode = 'PERSONAL' AND OLD.account_id IS NOT NULL) then
      update accounts
      set balance = balance - (case when OLD.flow = 'IN' then OLD.amount else -OLD.amount end)
      where id = OLD.account_id;
    end if;

    -- Apply NEW
    if (NEW.mode = 'PERSONAL' AND NEW.account_id IS NOT NULL) then
      update accounts
      set balance = balance + (case when NEW.flow = 'IN' then NEW.amount else -NEW.amount end)
      where id = NEW.account_id;
    end if;
  end if;

  -- Logic for DELETE
  if (TG_OP = 'DELETE' AND OLD.mode = 'PERSONAL' AND OLD.account_id IS NOT NULL) then
    update accounts
    set balance = balance - (case when OLD.flow = 'IN' then OLD.amount else -OLD.amount end)
    where id = OLD.account_id;
  end if;
  
  return null;
end;
$$ language plpgsql;

-- Attach Trigger to Transactions Table for Accounts
create trigger trigger_update_account_balance
after insert or update or delete on transactions
for each row
execute function update_account_balance();

-- Seed default accounts for new users
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

-- Attach trigger to auth.users to seed accounts on signup
  for each row execute procedure public.seed_default_accounts();

-- 7. Table: businesses (For Multiple Khatabooks)


-- RLS for Businesses
alter table public.businesses enable row level security;

create policy "Users can view own businesses" on public.businesses
  for select using (auth.uid() = user_id);

create policy "Users can insert own businesses" on public.businesses
  for insert with check (auth.uid() = user_id);

create policy "Users can update own businesses" on public.businesses
  for update using (auth.uid() = user_id);

create policy "Users can delete own businesses" on public.businesses
  for delete using (auth.uid() = user_id);

-- Seed default business for new users
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

create trigger on_auth_user_created_seed_business
  after insert on auth.users
  for each row execute procedure public.seed_default_business();


-- 1. Create recurring_transactions table
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

-- Indexes for performance (GA Hardening)
-- 1. RLS Support
create index if not exists categories_user_id_idx on public.categories(user_id);
create index if not exists accounts_user_id_idx on public.accounts(user_id);
create index if not exists businesses_user_id_idx on public.businesses(user_id);
create index if not exists recurring_transactions_user_id_idx on public.recurring_transactions(user_id);

-- 2. Foreign Keys
create index if not exists transactions_category_id_idx on public.transactions(category_id);
create index if not exists transactions_contact_id_idx on public.transactions(contact_id);
create index if not exists transactions_account_id_idx on public.transactions(account_id);
create index if not exists transactions_business_id_idx on public.transactions(business_id);
create index if not exists recurring_transactions_category_id_idx on public.recurring_transactions(category_id);
create index if not exists recurring_transactions_account_id_idx on public.recurring_transactions(account_id);

-- 3. Frequently Filtered
create index if not exists contacts_type_idx on public.contacts(type);
create index if not exists categories_active_idx on public.categories(active);

-- 4. Analytics
-- Supersedes specific user_id+date index if we want, but keeping both is safer for now unless strictly redundant.
-- Constructing purely for the `get_monthly_category_spend` pattern.
create index if not exists transactions_analytics_idx on public.transactions(user_id, mode, date);

-- RLS for recurring_transactions
alter table public.recurring_transactions enable row level security;

create policy "Users can view own recurring transactions" on public.recurring_transactions
  for select using (auth.uid() = user_id);

create policy "Users can insert own recurring transactions" on public.recurring_transactions
  for insert with check (auth.uid() = user_id);

create policy "Users can update own recurring transactions" on public.recurring_transactions
  for update using (auth.uid() = user_id);

-- 20260215_shared_expenses_schema.sql

-- 1. Create tables first (ORDER MATTERS for Foreign Keys and Policies)

-- groups
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES public.profiles(id),
    avatar_url TEXT,
    type TEXT DEFAULT 'GENERAL',
    invite_code UUID DEFAULT gen_random_uuid() UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- group_members
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    ghost_name TEXT,
    avatar_url TEXT,
    joined_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT check_user_or_ghost CHECK ((user_id IS NOT NULL) OR (ghost_name IS NOT NULL)),
    UNIQUE (group_id, user_id)
);

-- friendships
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id_1 UUID REFERENCES public.profiles(id),
    user_id_2 UUID REFERENCES public.profiles(id),
    status TEXT CHECK (status IN ('PENDING', 'ACCEPTED')),
    CONSTRAINT check_user_order CHECK (user_id_1 < user_id_2) -- Prevent duplicates
);

-- transaction_splits
CREATE TABLE IF NOT EXISTS public.transaction_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    group_member_id UUID REFERENCES public.group_members(id),
    amount NUMERIC NOT NULL,
    percentage NUMERIC,
    is_settled BOOLEAN DEFAULT false
);

-- notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id),
    type TEXT CHECK (type IN ('FRIEND_REQ', 'GROUP_INVITE', 'EXPENSE_ADDED')),
    title TEXT,
    message TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);


-- 2. Update Existing Tables

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'group_id') THEN
        ALTER TABLE public.transactions ADD COLUMN group_id UUID REFERENCES public.groups(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'payer_id') THEN
        ALTER TABLE public.transactions ADD COLUMN payer_id UUID REFERENCES public.profiles(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'split_type') THEN
        ALTER TABLE public.transactions ADD COLUMN split_type TEXT DEFAULT 'EQUALLY' CHECK (split_type IN ('EQUALLY', 'BY_AMOUNT', 'BY_PERCENTAGE'));
    END IF;
END $$;


-- 3. Enable RLS and Create Policies (Now that all tables exist)

-- groups policies
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'groups' AND policyname = 'Group members can view/edit groups'
    ) THEN
        CREATE POLICY "Group members can view/edit groups" ON public.groups
            FOR ALL
            USING (auth.uid() IN (SELECT user_id FROM public.group_members WHERE group_id = id));
    END IF;
END $$;

-- group_members policies
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'group_members' AND policyname = 'Members can view other members'
    ) THEN
        CREATE POLICY "Members can view other members" ON public.group_members
            FOR SELECT
            USING (group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid()));
    END IF;
END $$;

-- friendships policies
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'friendships' AND policyname = 'Users can view their friendships'
    ) THEN
        CREATE POLICY "Users can view their friendships" ON public.friendships
            FOR SELECT
            USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);
    END IF;
END $$;

-- transaction_splits policies
ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'transaction_splits' AND policyname = 'View splits if creator or involved'
    ) THEN
        CREATE POLICY "View splits if creator or involved" ON public.transaction_splits
            FOR SELECT
            USING (
                auth.uid() = user_id
                OR
                EXISTS (
                    SELECT 1 FROM public.transactions t
                    WHERE t.id = transaction_id AND t.user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- notifications policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notifications' AND policyname = 'Users can view own notifications'
    ) THEN
        CREATE POLICY "Users can view own notifications" ON public.notifications
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notifications' AND policyname = 'Users can update own notifications'
    ) THEN
        CREATE POLICY "Users can update own notifications" ON public.notifications
            FOR UPDATE
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- transactions policies
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;

CREATE POLICY "Users can view own or involved transactions" ON public.transactions
    FOR SELECT
    USING (
        auth.uid() = user_id 
        OR 
        auth.uid() IN (SELECT user_id FROM public.transaction_splits WHERE transaction_id = id)
    );
-- 1. Helper function to get user's group IDs (Bypasses RLS to avoid loop)
CREATE OR REPLACE FUNCTION get_my_group_ids()
RETURNS TABLE (group_id UUID)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY SELECT gm.group_id FROM public.group_members gm WHERE gm.user_id = auth.uid();
END;
$$;

-- 2. Helper function to check transaction ownership (Bypasses RLS to avoid loop)
CREATE OR REPLACE FUNCTION is_transaction_creator(txn_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = txn_id AND t.user_id = auth.uid());
END;
$$;

-- 3. Fix 'group_members' Policy
DROP POLICY IF EXISTS "Members can view other members" ON public.group_members;
CREATE POLICY "Members can view other members" ON public.group_members
    FOR SELECT
    USING (group_id IN (SELECT * FROM get_my_group_ids()));

-- 4. Fix 'transaction_splits' Policy
DROP POLICY IF EXISTS "View splits if creator or involved" ON public.transaction_splits;
CREATE POLICY "View splits if creator or involved" ON public.transaction_splits
    FOR SELECT
    USING (
        auth.uid() = user_id
        OR
        is_transaction_creator(transaction_id)
    );

-- 5. Fix 'groups' Policy (just to be safe)
DROP POLICY IF EXISTS "Group members can view/edit groups" ON public.groups;
CREATE POLICY "Group members can view/edit groups" ON public.groups
    FOR ALL
    USING (id IN (SELECT * FROM get_my_group_ids()));
