-- 1. Add new columns to transactions table
alter table public.transactions
add column name text,
add column note text;

-- 2. Migrate existing data for transactions
-- Use description as name, default to 'Untitled' if null
update public.transactions
set name = coalesce(description, 'Untitled');

-- 3. Make name required after migration
alter table public.transactions
alter column name set not null;

-- 4. Drop description column from transactions (optional, but requested to "use that to seed the name column")
-- We will keep it for now but stop using it, or drop it if we are sure. 
-- User said: "For transactions that have a 'desciptiion' a sper current schema, use that to seed the name column."
-- Let's drop it to be clean as per plan.
alter table public.transactions
drop column description;


-- 5. Repeat for recurring_transactions
alter table public.recurring_transactions
add column name text,
add column note text;

update public.recurring_transactions
set name = coalesce(description, 'Untitled');

alter table public.recurring_transactions
alter column name set not null;

alter table public.recurring_transactions
drop column description;
