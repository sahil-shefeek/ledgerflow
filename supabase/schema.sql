-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- 1. Table: profiles (Extends Supabase Auth)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  business_name text,
  currency_symbol text default '₹',
  phone text,
  created_at timestamptz default now()
);

-- 2. Table: contacts (The "Khata" entities)
create table public.contacts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  phone text,
  type text check (type in ('CUSTOMER', 'VENDOR')),
  net_balance numeric default 0.00,
  last_transaction_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Index for faster lookups
create index contacts_user_id_idx on public.contacts(user_id);

-- 3. Table: categories (For Personal Expense tracking)
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  icon text, -- Lucide icon name
  type text check (type in ('INCOME', 'EXPENSE')),
  budget_limit numeric,
  created_at timestamptz default now()
);

-- 4. Table: transactions (The Single Source of Truth)
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric not null check (amount > 0),
  flow text check (flow in ('IN', 'OUT')),
  mode text check (mode in ('BUSINESS', 'PERSONAL')),
  contact_id uuid references public.contacts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  date timestamptz not null default now(),
  description text,
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
  if (TG_OP = 'INSERT' AND NEW.mode = 'BUSINESS') then
    update contacts
    set 
      net_balance = net_balance + (case when NEW.flow = 'OUT' then NEW.amount else -NEW.amount end),
      last_transaction_at = NEW.date
    where id = NEW.contact_id;
  end if;

  -- Logic for DELETE (Reverse the math)
  if (TG_OP = 'DELETE' AND OLD.mode = 'BUSINESS') then
    update contacts
    set net_balance = net_balance - (case when OLD.flow = 'OUT' then OLD.amount else -OLD.amount end)
    where id = OLD.contact_id;
  end if;
  
  return null;
end;
$$ language plpgsql;

-- Attach Trigger to Transactions Table
create trigger trigger_update_balance
after insert or delete on transactions
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
  insert into public.categories (user_id, name, icon, type)
  values
    (new.id, 'Food', '🍔', 'EXPENSE'),
    (new.id, 'Transport', '🚗', 'EXPENSE'),
    (new.id, 'Entertainment', '🎬', 'EXPENSE'),
    (new.id, 'Shopping', '🛍️', 'EXPENSE'),
    (new.id, 'Bills', '💡', 'EXPENSE'),
    (new.id, 'Health', '🏥', 'EXPENSE');
  return new;
end;
$$;

-- Attach trigger to auth.users to seed categories on signup
create trigger on_auth_user_created_seed_categories
  after insert on auth.users
  for each row execute procedure public.seed_default_categories();

