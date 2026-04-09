-- Migration: 20260226_shared_ledger_logic.sql
-- Description: Phase 1 of Shared Payments History
-- 1. Updates friendships table
-- 2. Updates RLS on transactions
-- 3. Creates RPCs for friend requests via phone and in-app
-- 4. Creates unified_contact_transactions VIEW
-- 5. Updates balance sync and delete notifications

-- ==========================================
-- 1. Alter Friendships Table
-- ==========================================
-- Add initiator_id to track who sent the request
ALTER TABLE public.friendships 
ADD COLUMN IF NOT EXISTS initiator_id UUID REFERENCES public.profiles(id);

-- ==========================================
-- 2. Update Transactions RLS
-- ==========================================
-- Drop existing policy
DROP POLICY IF EXISTS "Users can view own or involved transactions" ON public.transactions;

-- Create new policy
CREATE POLICY "Users can view own or involved transactions" ON public.transactions FOR SELECT
USING (
  auth.uid() = user_id 
  OR 
  auth.uid() IN (SELECT user_id FROM public.transaction_splits WHERE transaction_id = id)
  OR
  auth.uid() IN (SELECT linked_user_id FROM public.contacts WHERE id = contact_id)
);

-- ==========================================
-- 3. New RPCs
-- ==========================================

-- Detect user by phone
CREATE OR REPLACE FUNCTION detect_user_by_phone(p_phone text)
RETURNS TABLE (id uuid, full_name text, avatar_url text)
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY 
    SELECT p.id, p.full_name, p.avatar_url 
    FROM public.profiles p
    WHERE p.phone = p_phone 
      AND p.discoverable_by_phone = true;
END;
$$ LANGUAGE plpgsql;

-- Send friend request
CREATE OR REPLACE FUNCTION send_friend_request(p_target_user_id uuid, p_contact_id uuid)
RETURNS json
SECURITY DEFINER
AS $$
DECLARE
    uid uuid := auth.uid();
    existing_friendship RECORD;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Prevent self-request
    IF uid = p_target_user_id THEN
        RAISE EXCEPTION 'Cannot send a friend request to yourself';
    END IF;
    
    -- Check if friendship already exists
    SELECT * INTO existing_friendship FROM public.friendships 
    WHERE (user_id_1 = p_target_user_id AND user_id_2 = uid)
       OR (user_id_1 = uid AND user_id_2 = p_target_user_id);
       
    IF FOUND THEN
        IF existing_friendship.status = 'ACCEPTED' THEN
            RAISE EXCEPTION 'You are already friends with this user';
        ELSE
            RAISE EXCEPTION 'A friend request is already pending';
        END IF;
    END IF;

    -- Insert pending friendship in deterministic order
    IF p_target_user_id < uid THEN
        INSERT INTO public.friendships (user_id_1, user_id_2, status, initiator_id) 
        VALUES (p_target_user_id, uid, 'PENDING', uid);
    ELSE
        INSERT INTO public.friendships (user_id_1, user_id_2, status, initiator_id) 
        VALUES (uid, p_target_user_id, 'PENDING', uid);
    END IF;

    -- Link the local contact to the target user
    IF p_contact_id IS NOT NULL THEN
        UPDATE public.contacts
        SET linked_user_id = p_target_user_id
        WHERE id = p_contact_id AND user_id = uid;
    END IF;

    -- Create a notification for the target user
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
        p_target_user_id, 
        'FRIEND_REQ', 
        'New Friend Request', 
        'Someone wants to connect with you.', 
        jsonb_build_object('initiator_id', uid)
    );

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- Accept in-app request
CREATE OR REPLACE FUNCTION accept_in_app_request(p_friendship_id uuid)
RETURNS json
SECURITY DEFINER
AS $$
DECLARE
    uid uuid := auth.uid();
    f_record RECORD;
    sender_id uuid;
    sender_profile RECORD;
    current_user_profile RECORD;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT * INTO f_record FROM public.friendships WHERE id = p_friendship_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Friend request not found';
    END IF;

    IF f_record.status = 'ACCEPTED' THEN
        RAISE EXCEPTION 'Friend request already accepted';
    END IF;

    -- Determine who is the sender and receiver
    IF f_record.initiator_id = uid THEN
        RAISE EXCEPTION 'You cannot accept your own request';
    END IF;
    
    sender_id := f_record.initiator_id;
    
    -- Verify the current user is the other person in the relationship
    IF (f_record.user_id_1 != uid AND f_record.user_id_2 != uid) THEN
        RAISE EXCEPTION 'You are not involved in this friend request';
    END IF;

    -- Update status
    UPDATE public.friendships SET status = 'ACCEPTED' WHERE id = p_friendship_id;

    -- Get profiles
    SELECT * INTO sender_profile FROM public.profiles WHERE id = sender_id;
    SELECT * INTO current_user_profile FROM public.profiles WHERE id = uid;

    -- Check if User B (receiver/current user) has a ghost contact for User A (sender)
    IF NOT EXISTS (SELECT 1 FROM public.contacts WHERE user_id = uid AND linked_user_id = sender_id) THEN
        -- Maybe they have an unlinked contact with matching phone number?
        IF sender_profile.phone IS NOT NULL AND EXISTS (SELECT 1 FROM public.contacts WHERE user_id = uid AND phone = sender_profile.phone AND linked_user_id IS NULL) THEN
            UPDATE public.contacts 
            SET linked_user_id = sender_id 
            WHERE id = (SELECT id FROM public.contacts WHERE user_id = uid AND phone = sender_profile.phone AND linked_user_id IS NULL LIMIT 1);
        ELSE
            -- Create a new mutual contact in B's book
            INSERT INTO public.contacts (user_id, name, type, linked_user_id, image_url)
            VALUES (uid, sender_profile.full_name, 'OTHER', sender_id, sender_profile.avatar_url);
        END IF;
    END IF;
    
    -- Note: Sender (User A) already linked their contact in send_friend_request, but let's ensure they have one just in case
    IF NOT EXISTS (SELECT 1 FROM public.contacts WHERE user_id = sender_id AND linked_user_id = uid) THEN
         INSERT INTO public.contacts (user_id, name, type, linked_user_id, image_url)
         VALUES (sender_id, current_user_profile.full_name, 'OTHER', uid, current_user_profile.avatar_url);
    END IF;

    RETURN json_build_object('success', true, 'sender_name', sender_profile.full_name);
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 4. Unified Ledger VIEW
-- ==========================================

-- Drop if exists (in case recreating)
DROP VIEW IF EXISTS public.unified_contact_transactions;

CREATE OR REPLACE VIEW public.unified_contact_transactions AS
-- 1. My own transactions (No inversion needed)
SELECT 
    t.*, 
    t.contact_id AS local_contact_id, 
    t.flow AS local_flow
FROM public.transactions t
WHERE t.user_id = auth.uid() AND t.mode = 'PERSONAL'

UNION ALL

-- 2. Peer's transactions shared with me (Invert flow and map contact_id)
SELECT 
    t.*, 
    c_my.id AS local_contact_id, 
    (CASE WHEN t.flow = 'IN' THEN 'OUT' ELSE 'IN' END) AS local_flow
FROM public.transactions t
JOIN public.contacts c_peer ON t.contact_id = c_peer.id
JOIN public.contacts c_my ON c_my.linked_user_id = c_peer.user_id AND c_my.user_id = auth.uid()
WHERE t.user_id = c_peer.user_id 
  AND c_peer.linked_user_id = auth.uid() 
  AND t.mode = 'PERSONAL';


-- ==========================================
-- 5. Balances & Notifications Triggers
-- ==========================================

-- Update existing balance trigger to sync mutual balances
CREATE OR REPLACE FUNCTION update_contact_balance()
RETURNS trigger AS $$
DECLARE
    reciprocal_contact_id uuid;
BEGIN
    -- Logic for INSERT
    IF (tg_op = 'INSERT' AND NEW.contact_id IS NOT NULL) THEN
        -- Update local contact
        UPDATE contacts
        SET 
            net_balance = net_balance + (CASE WHEN NEW.flow = 'OUT' THEN NEW.amount ELSE -NEW.amount END),
            transaction_count = transaction_count + 1,
            last_transaction_at = NEW.date
        WHERE id = NEW.contact_id;
        
        -- Update reciprocal contact if linked
        IF EXISTS (SELECT 1 FROM contacts WHERE id = NEW.contact_id AND linked_user_id IS NOT NULL) THEN
            SELECT id INTO reciprocal_contact_id 
            FROM contacts 
            WHERE user_id = (SELECT linked_user_id FROM contacts WHERE id = NEW.contact_id)
              AND linked_user_id = NEW.user_id
            LIMIT 1;
              
            IF reciprocal_contact_id IS NOT NULL THEN
                 -- Apply INVERSE impact for the peer
                 UPDATE contacts
                 SET 
                    net_balance = net_balance + (CASE WHEN NEW.flow = 'OUT' THEN -NEW.amount ELSE NEW.amount END),
                    transaction_count = transaction_count + 1,
                    last_transaction_at = NEW.date
                 WHERE id = reciprocal_contact_id;
            END IF;
        END IF;
    END IF;

    -- Logic for UPDATE
    IF (tg_op = 'UPDATE') THEN
        -- Reverse OLD impact
        IF (OLD.contact_id IS NOT NULL) THEN
            -- Local
            UPDATE contacts
            SET 
                net_balance = net_balance - (CASE WHEN OLD.flow = 'OUT' THEN OLD.amount ELSE -OLD.amount END),
                transaction_count = GREATEST(0, transaction_count - 1)
            WHERE id = OLD.contact_id;
            
            -- Reciprocal
            IF EXISTS (SELECT 1 FROM contacts WHERE id = OLD.contact_id AND linked_user_id IS NOT NULL) THEN
                SELECT id INTO reciprocal_contact_id 
                FROM contacts 
                WHERE user_id = (SELECT linked_user_id FROM contacts WHERE id = OLD.contact_id)
                  AND linked_user_id = OLD.user_id
                LIMIT 1;
                
                IF reciprocal_contact_id IS NOT NULL THEN
                     UPDATE contacts
                     SET 
                        net_balance = net_balance - (CASE WHEN OLD.flow = 'OUT' THEN -OLD.amount ELSE OLD.amount END),
                        transaction_count = GREATEST(0, transaction_count - 1)
                     WHERE id = reciprocal_contact_id;
                END IF;
            END IF;
        END IF;

        -- Apply NEW impact
        IF (NEW.contact_id IS NOT NULL) THEN
            -- Local
            UPDATE contacts
            SET 
                net_balance = net_balance + (CASE WHEN NEW.flow = 'OUT' THEN NEW.amount ELSE -NEW.amount END),
                transaction_count = transaction_count + 1,
                last_transaction_at = NEW.date
            WHERE id = NEW.contact_id;
            
            -- Reciprocal
            IF EXISTS (SELECT 1 FROM contacts WHERE id = NEW.contact_id AND linked_user_id IS NOT NULL) THEN
                SELECT id INTO reciprocal_contact_id 
                FROM contacts 
                WHERE user_id = (SELECT linked_user_id FROM contacts WHERE id = NEW.contact_id)
                  AND linked_user_id = NEW.user_id
                LIMIT 1;
                
                IF reciprocal_contact_id IS NOT NULL THEN
                     UPDATE contacts
                     SET 
                        net_balance = net_balance + (CASE WHEN NEW.flow = 'OUT' THEN -NEW.amount ELSE NEW.amount END),
                        transaction_count = transaction_count + 1,
                        last_transaction_at = NEW.date
                     WHERE id = reciprocal_contact_id;
                END IF;
            END IF;
        END IF;
    END IF;

    -- Logic for DELETE
    IF (tg_op = 'DELETE' AND OLD.contact_id IS NOT NULL) THEN
        -- Local
        UPDATE contacts
        SET 
            net_balance = net_balance - (CASE WHEN OLD.flow = 'OUT' THEN OLD.amount ELSE -OLD.amount END),
            transaction_count = GREATEST(0, transaction_count - 1)
        WHERE id = OLD.contact_id;
        
        -- Reciprocal
        IF EXISTS (SELECT 1 FROM contacts WHERE id = OLD.contact_id AND linked_user_id IS NOT NULL) THEN
            SELECT id INTO reciprocal_contact_id 
            FROM contacts 
            WHERE user_id = (SELECT linked_user_id FROM contacts WHERE id = OLD.contact_id)
              AND linked_user_id = OLD.user_id
            LIMIT 1;
            
            IF reciprocal_contact_id IS NOT NULL THEN
                 UPDATE contacts
                 SET 
                    net_balance = net_balance - (CASE WHEN OLD.flow = 'OUT' THEN -OLD.amount ELSE OLD.amount END),
                    transaction_count = GREATEST(0, transaction_count - 1)
                 WHERE id = reciprocal_contact_id;
            END IF;
        END IF;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;


-- New trigger for delete notifications
CREATE OR REPLACE FUNCTION notify_on_shared_transaction_delete()
RETURNS trigger AS $$
DECLARE
    target_linked_user_id uuid;
    deleter_name text;
BEGIN
    IF (OLD.contact_id IS NOT NULL) THEN
        SELECT linked_user_id INTO target_linked_user_id 
        FROM contacts WHERE id = OLD.contact_id;
        
        IF (target_linked_user_id IS NOT NULL) THEN
            -- Get the name of the user who deleted it (the local user)
            SELECT full_name INTO deleter_name FROM profiles WHERE id = auth.uid();
            
            IF deleter_name IS NULL THEN
                 deleter_name := 'A user';
            END IF;
            
            INSERT INTO public.notifications (user_id, type, title, message, data)
            VALUES (
                target_linked_user_id, 
                'EXPENSE_ADDED', -- Reusing EXPENSE_ADDED or create a new type if preferred
                'Shared Transaction Deleted', 
                deleter_name || ' deleted a shared transaction: ' || OLD.name, 
                jsonb_build_object('transaction_id', OLD.id)
            );
        END IF;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_transaction_delete ON public.transactions;
CREATE TRIGGER on_transaction_delete
    AFTER DELETE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION notify_on_shared_transaction_delete();
