-- Migration: Fix Group Deletion Constraint
-- 
-- Goal: Change the Foreign Key on `transactions.group_id` from RESTRICT (default) to SET NULL.
-- This allows a Group to be deleted while keeping the Transactions (as personal transactions).

DO $$
BEGIN
    -- 1. Drop existing constraint if it exists (standard name)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'transactions_group_id_fkey' 
        AND table_name = 'transactions'
    ) THEN
        ALTER TABLE public.transactions DROP CONSTRAINT transactions_group_id_fkey;
    END IF;

    -- 2. Add the constraint back with ON DELETE SET NULL
    -- We check if it doesn't exist first to be safe, though we just dropped it.
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'transactions_group_id_fkey' 
        AND table_name = 'transactions'
    ) THEN
        ALTER TABLE public.transactions
        ADD CONSTRAINT transactions_group_id_fkey
        FOREIGN KEY (group_id)
        REFERENCES public.groups(id)
        ON DELETE SET NULL;
    END IF;
END $$;
