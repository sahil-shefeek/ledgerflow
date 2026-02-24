-- Fix variable shadowing by adding table aliases (g and gm)
CREATE OR REPLACE FUNCTION get_group_by_invite(invite_code_input UUID)
RETURNS TABLE (
    group_id UUID,
    group_name TEXT,
    group_avatar_url TEXT,
    ghost_members JSONB
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    target_group_id UUID;
    t_group_name TEXT;
    t_group_avatar TEXT;
BEGIN
    -- 1. Find Group
    SELECT g.id, g.name, g.avatar_url INTO target_group_id, t_group_name, t_group_avatar
    FROM public.groups g
    WHERE g.invite_code = invite_code_input;

    IF target_group_id IS NULL THEN
        RETURN; -- Returns empty if not found
    END IF;

    -- 2. Return details + list of unclaimed ghost members
    RETURN QUERY
    SELECT 
        target_group_id,
        t_group_name,
        t_group_avatar,
        (
            SELECT jsonb_agg(jsonb_build_object('id', gm.id, 'name', gm.ghost_name, 'avatar_url', gm.avatar_url))
            FROM public.group_members gm
            WHERE gm.group_id = target_group_id 
            AND gm.user_id IS NULL -- Only ghosts
        );
END;
$$;
