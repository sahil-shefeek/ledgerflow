-- 1. Create recurring_transactions table
create table if not exists public.recurring_transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric not null check (amount > 0),
  flow text check (flow in ('IN', 'OUT')) default 'OUT',
  description text,
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  frequency text check (frequency in ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')) not null,
  start_date timestamptz not null default now(),
  next_run_date timestamptz not null,
  last_run_date timestamptz,
  active boolean default true,
  created_at timestamptz default now()
);

-- RLS for recurring_transactions
alter table public.recurring_transactions enable row level security;

create policy "Users can view own recurring transactions" on public.recurring_transactions
  for select using (auth.uid() = user_id);

create policy "Users can insert own recurring transactions" on public.recurring_transactions
  for insert with check (auth.uid() = user_id);

create policy "Users can update own recurring transactions" on public.recurring_transactions
  for update using (auth.uid() = user_id);

create policy "Users can delete own recurring transactions" on public.recurring_transactions
  for delete using (auth.uid() = user_id);

-- 2. Update seed_default_categories function
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
    (new.id, 'Shopping', '🛍️', 'EXPENSE'),
    (new.id, 'Entertainment', '🎬', 'EXPENSE'),
    (new.id, 'Bills', '💡', 'EXPENSE'),
    (new.id, 'Health', '🏥', 'EXPENSE'),
    (new.id, 'Education', '📚', 'EXPENSE'),
    (new.id, 'Groceries', '🛒', 'EXPENSE'),
    (new.id, 'Rent', '🏠', 'EXPENSE'),
    (new.id, 'Utilities', '⚡', 'EXPENSE'),
    (new.id, 'Insurance', '🛡️', 'EXPENSE'),
    (new.id, 'Savings', '💰', 'EXPENSE'),
    (new.id, 'Investment', '📈', 'EXPENSE'),
    (new.id, 'Gifts', '🎁', 'EXPENSE'),
    (new.id, 'Travel', '✈️', 'EXPENSE'),
    (new.id, 'Fuel', '⛽', 'EXPENSE'),
    (new.id, 'Maintenance', '🔧', 'EXPENSE'),
    (new.id, 'Pets', '🐾', 'EXPENSE'),
    (new.id, 'Kids', '🧸', 'EXPENSE'),
    (new.id, 'Salary', '💵', 'INCOME'),
    (new.id, 'Business', '💼', 'INCOME'),
    (new.id, 'Interest', '🏦', 'INCOME');
  return new;
end;
$$;
