CREATE OR REPLACE FUNCTION public.remove_friend(friend_id UUID)
RETURNS void
SECURITY DEFINER
AS $$
DECLARE
    uid UUID := auth.uid();
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Delete the mutual friendship record
    DELETE FROM public.friendships
    WHERE (user_id_1 = uid AND user_id_2 = friend_id)
       OR (user_id_1 = friend_id AND user_id_2 = uid);

    -- 2. Unlink contacts on both sides (Turns them back into ghost contacts to preserve ledger history)
    UPDATE public.contacts
    SET linked_user_id = NULL
    WHERE (user_id = uid AND linked_user_id = friend_id)
       OR (user_id = friend_id AND linked_user_id = uid);
END;
$$ LANGUAGE plpgsql;
