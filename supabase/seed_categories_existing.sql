-- Insert missing categories for ALL existing users
-- This will ignore duplicates based on (user_id, name) if you have a unique constraint, 
-- but since we don't strictly have one in the schema provided earlier (only primary key),
-- we should be careful. 
-- Ideally, we check if it exists.

do $$
declare
  r record;
begin
  for r in select id from public.profiles loop
    insert into public.categories (user_id, name, icon, type)
    select r.id, name, icon, type
    from (values
      ('Food', '🍔', 'EXPENSE'),
      ('Transport', '🚗', 'EXPENSE'),
      ('Shopping', '🛍️', 'EXPENSE'),
      ('Entertainment', '🎬', 'EXPENSE'),
      ('Bills', '💡', 'EXPENSE'),
      ('Health', '🏥', 'EXPENSE'),
      ('Education', '📚', 'EXPENSE'),
      ('Groceries', '🛒', 'EXPENSE'),
      ('Rent', '🏠', 'EXPENSE'),
      ('Utilities', '⚡', 'EXPENSE'),
      ('Insurance', '🛡️', 'EXPENSE'),
      ('Savings', '💰', 'EXPENSE'),
      ('Investment', '📈', 'EXPENSE'),
      ('Gifts', '🎁', 'EXPENSE'),
      ('Travel', '✈️', 'EXPENSE'),
      ('Fuel', '⛽', 'EXPENSE'),
      ('Maintenance', '🔧', 'EXPENSE'),
      ('Pets', '🐾', 'EXPENSE'),
      ('Kids', '🧸', 'EXPENSE'),
      ('Salary', '💵', 'INCOME'),
      ('Business', '💼', 'INCOME'),
      ('Interest', '🏦', 'INCOME')
    ) as v(name, icon, type)
    where not exists (
      select 1 from public.categories c 
      where c.user_id = r.id and c.name = v.name
    );
  end loop;
end;
$$;
