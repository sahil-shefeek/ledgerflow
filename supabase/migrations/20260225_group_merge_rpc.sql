CREATE OR REPLACE FUNCTION link_ghost_to_friend(
    p_group_id UUID,
    p_ghost_member_id UUID,
    p_friend_user_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_friend_exists_in_group BOOLEAN;
BEGIN
    -- 1. Check Permissions (Must be Group Creator)
    SELECT (created_by = auth.uid()) INTO v_is_admin
    FROM public.groups WHERE id = p_group_id;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Only group admin can link members';
    END IF;

    -- 2. Check if Friend is ALREADY in the group
    -- (Merging two existing members is too complex for V1, we abort)
    SELECT EXISTS (
        SELECT 1 FROM public.group_members 
        WHERE group_id = p_group_id AND user_id = p_friend_user_id
    ) INTO v_friend_exists_in_group;

    IF v_friend_exists_in_group THEN
        RAISE EXCEPTION 'This friend is already a member of the group. Cannot merge.';
    END IF;

    -- 3. Perform the Link
    UPDATE public.group_members
    SET 
        user_id = p_friend_user_id,
        ghost_name = NULL, -- Remove ghost status
        avatar_url = NULL -- Reset to use profile avatar
    WHERE id = p_ghost_member_id
    AND group_id = p_group_id
    AND user_id IS NULL; -- Ensure target is actually a ghost

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ghost member not found';
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;
