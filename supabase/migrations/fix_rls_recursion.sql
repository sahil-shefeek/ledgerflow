-- 1. Helper function to get user's group IDs (Bypasses RLS to avoid loop)
CREATE OR REPLACE FUNCTION get_my_group_ids()
RETURNS TABLE (group_id UUID)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY SELECT gm.group_id FROM public.group_members gm WHERE gm.user_id = auth.uid();
END;
$$;

-- 2. Helper function to check transaction ownership (Bypasses RLS to avoid loop)
CREATE OR REPLACE FUNCTION is_transaction_creator(txn_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = txn_id AND t.user_id = auth.uid());
END;
$$;

-- 3. Fix 'group_members' Policy
DROP POLICY IF EXISTS "Members can view other members" ON public.group_members;
CREATE POLICY "Members can view other members" ON public.group_members
    FOR SELECT
    USING (group_id IN (SELECT * FROM get_my_group_ids()));

-- 4. Fix 'transaction_splits' Policy
DROP POLICY IF EXISTS "View splits if creator or involved" ON public.transaction_splits;
CREATE POLICY "View splits if creator or involved" ON public.transaction_splits
    FOR SELECT
    USING (
        auth.uid() = user_id
        OR
        is_transaction_creator(transaction_id)
    );

-- 5. Fix 'groups' Policy (just to be safe)
DROP POLICY IF EXISTS "Group members can view/edit groups" ON public.groups;
CREATE POLICY "Group members can view/edit groups" ON public.groups
    FOR ALL
    USING (id IN (SELECT * FROM get_my_group_ids()));
