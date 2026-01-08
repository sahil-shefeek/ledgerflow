-- Migration: GA Performance Hardening
-- Description: Adds missing FK indexes, RLS indexes, and specific composite indexes for analytics.

-- 1. Indexes for RLS Performance (user_id is used in almost every policy)
-- Note: 'profiles' and 'goals' already have user_id indexes or are primary keys.
create index if not exists categories_user_id_idx on public.categories(user_id);
create index if not exists accounts_user_id_idx on public.accounts(user_id);
create index if not exists businesses_user_id_idx on public.businesses(user_id);
create index if not exists recurring_transactions_user_id_idx on public.recurring_transactions(user_id);

-- 2. Indexes for Foreign Keys to avoid full table scans during joins and cascades
-- Transactions table FKs
create index if not exists transactions_category_id_idx on public.transactions(category_id);
create index if not exists transactions_contact_id_idx on public.transactions(contact_id);
create index if not exists transactions_account_id_idx on public.transactions(account_id);
create index if not exists transactions_business_id_idx on public.transactions(business_id);

-- Recurring Transactions table FKs
create index if not exists recurring_transactions_category_id_idx on public.recurring_transactions(category_id);
create index if not exists recurring_transactions_account_id_idx on public.recurring_transactions(account_id);

-- 3. Indexes for frequently filtered columns
-- Contacts are often filtered by type
create index if not exists contacts_type_idx on public.contacts(type);
-- Categories are filtered by active status
create index if not exists categories_active_idx on public.categories(active);

-- 4. Composite Indexes for Specific Query Patterns
-- Analytics: get_monthly_category_spend uses: user_id, mode='PERSONAL', flow='OUT', date range
-- This index covers all those predicates to allow an Index Only Scan (or close to it)
create index if not exists transactions_analytics_idx on public.transactions(user_id, mode, date);
