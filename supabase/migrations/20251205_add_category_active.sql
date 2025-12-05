-- Add active column to categories table
alter table public.categories 
add column if not exists active boolean default true;

-- Backfill existing categories to be active
update public.categories 
set active = true 
where active is null;

-- Update the seed_default_categories function to include active = true
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
    (new.id, 'Entertainment', '🎬', 'EXPENSE', true),
    (new.id, 'Shopping', '🛍️', 'EXPENSE', true),
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
