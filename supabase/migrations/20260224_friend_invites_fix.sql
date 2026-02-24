CREATE OR REPLACE FUNCTION public.accept_friend_invite(invite_token UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    target_user RECORD;
    current_user_profile RECORD;
    uid UUID;
    existing_friendship RECORD;
BEGIN
    uid := auth.uid();
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Find the user who owns the invite token (User A)
    SELECT * INTO target_user FROM public.profiles WHERE friend_invite_token = invite_token;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired invite link';
    END IF;

    -- Get current user profile (User B)
    SELECT * INTO current_user_profile FROM public.profiles WHERE id = uid;

    -- Prevent self-invite
    IF target_user.id = uid THEN
        RAISE EXCEPTION 'You cannot become friends with yourself';
    END IF;

    -- Check if friendship already exists
    SELECT * INTO existing_friendship FROM public.friendships 
    WHERE (user_id_1 = target_user.id AND user_id_2 = uid)
       OR (user_id_1 = uid AND user_id_2 = target_user.id);

    IF NOT FOUND THEN
        -- Insert friendship in deterministic order
        IF target_user.id < uid THEN
            INSERT INTO public.friendships (user_id_1, user_id_2, status) 
            VALUES (target_user.id, uid, 'ACCEPTED');
        ELSE
            INSERT INTO public.friendships (user_id_1, user_id_2, status) 
            VALUES (uid, target_user.id, 'ACCEPTED');
        END IF;
    ELSE
        -- Update to ACCEPTED if it was PENDING
        IF existing_friendship.status = 'PENDING' THEN
            UPDATE public.friendships 
            SET status = 'ACCEPTED' 
            WHERE id = existing_friendship.id;
        END IF;
    END IF;

    -- AUTO-CREATE MUTUAL CONTACTS
    -- 1. Create contact for Current User (User B) pointing to Target User (User A)
    IF NOT EXISTS (SELECT 1 FROM public.contacts WHERE user_id = uid AND linked_user_id = target_user.id) THEN
        INSERT INTO public.contacts (user_id, name, type, linked_user_id, image_url)
        VALUES (uid, target_user.full_name, 'OTHER', target_user.id, target_user.avatar_url);
    END IF;

    -- 2. Create contact for Target User (User A) pointing to Current User (User B)
    IF NOT EXISTS (SELECT 1 FROM public.contacts WHERE user_id = target_user.id AND linked_user_id = uid) THEN
        INSERT INTO public.contacts (user_id, name, type, linked_user_id, image_url)
        VALUES (target_user.id, current_user_profile.full_name, 'OTHER', uid, current_user_profile.avatar_url);
    END IF;

    RETURN json_build_object(
        'success', true,
        'target_name', target_user.full_name
    );
END;
$$ LANGUAGE plpgsql;
