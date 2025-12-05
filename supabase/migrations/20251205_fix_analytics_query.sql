-- Update get_monthly_category_spend to include Uncategorized transactions
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
    coalesce(c.name, 'Uncategorized') as category_name,
    coalesce(c.icon, '❓') as category_color,
    sum(t.amount) as total_spent
  from transactions t
  left join categories c on t.category_id = c.id
  where t.user_id = p_user_id
    and t.mode = 'PERSONAL'
    and t.flow = 'OUT'
    and extract(month from t.date) = p_month
    and extract(year from t.date) = p_year
  group by c.name, c.icon;
end;
$$;
