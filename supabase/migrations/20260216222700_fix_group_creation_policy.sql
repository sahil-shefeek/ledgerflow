-- Drop the strict member-only policies
DROP POLICY IF EXISTS "Members can view/edit groups" ON public.groups;
DROP POLICY IF EXISTS "Members can update groups" ON public.groups;
DROP POLICY IF EXISTS "Members can delete groups" ON public.groups;

-- Recreate with "OR created_by = auth.uid()" logic

-- SELECT: Allow Members OR the Creator
CREATE POLICY "Members or Creator can view groups" ON public.groups
    FOR SELECT USING (
        id IN (SELECT * FROM get_my_group_ids()) 
        OR 
        created_by = auth.uid()
    );

-- UPDATE: Allow Members OR the Creator
CREATE POLICY "Members or Creator can update groups" ON public.groups
    FOR UPDATE USING (
        id IN (SELECT * FROM get_my_group_ids()) 
        OR 
        created_by = auth.uid()
    );

-- DELETE: Allow Members OR the Creator
CREATE POLICY "Members or Creator can delete groups" ON public.groups
    FOR DELETE USING (
        id IN (SELECT * FROM get_my_group_ids()) 
        OR 
        created_by = auth.uid()
    );
