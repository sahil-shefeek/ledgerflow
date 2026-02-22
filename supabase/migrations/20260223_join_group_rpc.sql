-- Function to search for a group by invite code and return details + ghost members
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
    SELECT id, name, avatar_url INTO target_group_id, t_group_name, t_group_avatar
    FROM public.groups
    WHERE invite_code = invite_code_input;

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
            SELECT jsonb_agg(jsonb_build_object('id', id, 'name', ghost_name, 'avatar_url', avatar_url))
            FROM public.group_members
            WHERE group_id = target_group_id 
            AND user_id IS NULL -- Only ghosts
        );
END;
$$;

-- Function to join a group (Claim Ghost or New Member)
CREATE OR REPLACE FUNCTION join_group(
    invite_code_input UUID,
    claim_ghost_member_id UUID DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    target_group_id UUID;
    v_user_id UUID := auth.uid();
    existing_member_id UUID;
BEGIN
    -- 1. Validate Invite Code
    SELECT id INTO target_group_id FROM public.groups WHERE invite_code = invite_code_input;
    IF target_group_id IS NULL THEN
        RAISE EXCEPTION 'Invalid invite code';
    END IF;

    -- 2. Check if already a member
    SELECT id INTO existing_member_id FROM public.group_members 
    WHERE group_id = target_group_id AND user_id = v_user_id;
    
    IF existing_member_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already a member', 'group_id', target_group_id);
    END IF;

    -- 3. Logic Branch: Claim Ghost vs Join New
    IF claim_ghost_member_id IS NOT NULL THEN
        -- Verify the ghost belongs to this group and is actually a ghost
        UPDATE public.group_members
        SET 
            user_id = v_user_id,
            ghost_name = NULL, -- Clear ghost name as it's now a real user
            joined_at = now()
        WHERE id = claim_ghost_member_id 
        AND group_id = target_group_id 
        AND user_id IS NULL;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Ghost member not found or already claimed';
        END IF;
    ELSE
        -- Insert new member
        INSERT INTO public.group_members (group_id, user_id)
        VALUES (target_group_id, v_user_id);
    END IF;

    RETURN jsonb_build_object('success', true, 'group_id', target_group_id);
END;
$$;
