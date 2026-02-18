-- 1. Policy for INSERT
-- Allow users to add splits if they own the parent transaction
CREATE POLICY "Creators can insert splits" ON public.transaction_splits
    FOR INSERT
    WITH CHECK (
        is_transaction_creator(transaction_id)
    );

-- 2. Policy for UPDATE
-- Allow creators to modify splits (e.g. changing amounts)
CREATE POLICY "Creators can update splits" ON public.transaction_splits
    FOR UPDATE
    USING (
        is_transaction_creator(transaction_id)
    );

-- 3. Policy for DELETE
-- Allow creators to remove splits
CREATE POLICY "Creators can delete splits" ON public.transaction_splits
    FOR DELETE
    USING (
        is_transaction_creator(transaction_id)
    );
