-- 1. Auto-assign 'created_by' on insert (Security best practice)
CREATE OR REPLACE FUNCTION public.handle_group_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Always set created_by to the current user, preventing spoofing
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_group_created_by ON public.groups;
CREATE TRIGGER set_group_created_by
BEFORE INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.handle_group_creation();

-- 2. Fix 'groups' Policies
DROP POLICY IF EXISTS "Group members can view/edit groups" ON public.groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;
DROP POLICY IF EXISTS "Members can view/edit groups" ON public.groups;
DROP POLICY IF EXISTS "Members can update groups" ON public.groups;
DROP POLICY IF EXISTS "Members can delete groups" ON public.groups;

-- INSERT: Allow any authenticated user to create a group (Trigger ensures ownership)
CREATE POLICY "Authenticated users can create groups" ON public.groups
    FOR INSERT TO authenticated WITH CHECK (true);

-- SELECT/UPDATE/DELETE: Only members (using our helper function)
CREATE POLICY "Members can view/edit groups" ON public.groups
    FOR SELECT USING (id IN (SELECT * FROM get_my_group_ids()));

CREATE POLICY "Members can update groups" ON public.groups
    FOR UPDATE USING (id IN (SELECT * FROM get_my_group_ids()));

CREATE POLICY "Members can delete groups" ON public.groups
    FOR DELETE USING (id IN (SELECT * FROM get_my_group_ids()));

-- 3. Fix 'group_members' Policies
DROP POLICY IF EXISTS "Members can view other members" ON public.group_members;
DROP POLICY IF EXISTS "Members can view group roster" ON public.group_members;
DROP POLICY IF EXISTS "Admins can add members" ON public.group_members;
DROP POLICY IF EXISTS "Admins or Self can remove members" ON public.group_members;

-- SELECT: View members of your groups
CREATE POLICY "Members can view group roster" ON public.group_members
    FOR SELECT USING (group_id IN (SELECT * FROM get_my_group_ids()));

-- INSERT: Allow if you are the Group Creator OR an existing Member
CREATE POLICY "Admins can add members" ON public.group_members
    FOR INSERT WITH CHECK (
        -- Check if user is the creator of the target group
        EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND created_by = auth.uid())
        OR
        -- Check if user is already a member
        group_id IN (SELECT * FROM get_my_group_ids())
    );

-- DELETE: Allow if you are the Creator OR you are removing yourself
CREATE POLICY "Admins or Self can remove members" ON public.group_members
    FOR DELETE USING (
        -- Creator can remove anyone
        EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND created_by = auth.uid())
        OR
        -- User can remove themselves (Leave group)
        user_id = auth.uid()
    );

-- 4. Enable Realtime Notifications
-- Add 'notifications' table to the 'supabase_realtime' publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;
