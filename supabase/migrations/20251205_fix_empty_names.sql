-- Fix empty names resulting from previous migration
-- User requested to fill empty name cells with 'Unnamed'

update public.transactions
set name = 'Unnamed'
where name is null or name = '';

update public.recurring_transactions
set name = 'Unnamed'
where name is null or name = '';
