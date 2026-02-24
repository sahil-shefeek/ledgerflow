-- Add token to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS friend_invite_token UUID DEFAULT gen_random_uuid() UNIQUE;

-- Create RPC to accept generic friend invites
CREATE OR REPLACE FUNCTION accept_friend_invite(invite_token UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    target_user RECORD;
    uid UUID;
    existing_friendship RECORD;
BEGIN
    uid := auth.uid();
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Find the user who owns the invite token
    SELECT * INTO target_user FROM public.profiles WHERE friend_invite_token = invite_token;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired invite link';
    END IF;

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

    RETURN json_build_object(
        'success', true,
        'target_name', target_user.full_name
    );
END;
$$ LANGUAGE plpgsql;
