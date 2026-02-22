-- Add invite_token and linked_user_id to contacts
ALTER TABLE public.contacts
ADD COLUMN invite_token UUID DEFAULT gen_random_uuid() UNIQUE,
ADD COLUMN linked_user_id UUID REFERENCES public.profiles(id);

-- Create RPC to accept contact invites
CREATE OR REPLACE FUNCTION accept_contact_invite(token UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    contact_record RECORD;
    owner_name TEXT;
    uid UUID;
    existing_friendship RECORD;
BEGIN
    uid := auth.uid();
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Find the contact by invite_token
    SELECT * INTO contact_record FROM public.contacts WHERE invite_token = token;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired invite token';
    END IF;

    -- Prevent self-invite
    IF contact_record.user_id = uid THEN
        RAISE EXCEPTION 'Cannot invite yourself';
    END IF;

    -- Get owner's name for return message
    SELECT full_name INTO owner_name FROM public.profiles WHERE id = contact_record.user_id;

    -- Check if friendship already exists
    SELECT * INTO existing_friendship FROM public.friendships 
    WHERE (user_id_1 = contact_record.user_id AND user_id_2 = uid)
       OR (user_id_1 = uid AND user_id_2 = contact_record.user_id);

    IF NOT FOUND THEN
        -- Insert friendship in deterministic order
        IF contact_record.user_id < uid THEN
            INSERT INTO public.friendships (user_id_1, user_id_2, status) 
            VALUES (contact_record.user_id, uid, 'ACCEPTED');
        ELSE
            INSERT INTO public.friendships (user_id_1, user_id_2, status) 
            VALUES (uid, contact_record.user_id, 'ACCEPTED');
        END IF;
    ELSE
        -- Update to ACCEPTED if it was PENDING
        IF existing_friendship.status = 'PENDING' THEN
            UPDATE public.friendships 
            SET status = 'ACCEPTED' 
            WHERE id = existing_friendship.id;
        END IF;
    END IF;

    -- Update the contact to link to the new user and consume the token
    UPDATE public.contacts 
    SET linked_user_id = uid,
        invite_token = NULL
    WHERE id = contact_record.id;

    RETURN json_build_object(
        'success', true,
        'owner_name', owner_name
    );
END;
$$ LANGUAGE plpgsql;
