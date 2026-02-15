-- 20260215_shared_expenses_schema.sql

-- 1. Create tables

-- groups
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES public.profiles(id),
    avatar_url TEXT,
    type TEXT DEFAULT 'GENERAL',
    invite_code UUID DEFAULT gen_random_uuid() UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'groups' AND policyname = 'Group members can view/edit groups'
    ) THEN
        CREATE POLICY "Group members can view/edit groups" ON public.groups
            FOR ALL
            USING (auth.uid() IN (SELECT user_id FROM public.group_members WHERE group_id = id));
    END IF;
END $$;


-- group_members
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    ghost_name TEXT,
    avatar_url TEXT,
    joined_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT check_user_or_ghost CHECK ((user_id IS NOT NULL) OR (ghost_name IS NOT NULL)),
    UNIQUE (group_id, user_id)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'group_members' AND policyname = 'Members can view other members'
    ) THEN
        CREATE POLICY "Members can view other members" ON public.group_members
            FOR SELECT
            USING (group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid()));
    END IF;
END $$;


-- friendships
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id_1 UUID REFERENCES public.profiles(id),
    user_id_2 UUID REFERENCES public.profiles(id),
    status TEXT CHECK (status IN ('PENDING', 'ACCEPTED')),
    CONSTRAINT check_user_order CHECK (user_id_1 < user_id_2) -- Prevent duplicates
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'friendships' AND policyname = 'Users can view their friendships'
    ) THEN
        CREATE POLICY "Users can view their friendships" ON public.friendships
            FOR SELECT
            USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);
    END IF;
END $$;


-- transaction_splits
CREATE TABLE IF NOT EXISTS public.transaction_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    group_member_id UUID REFERENCES public.group_members(id),
    amount NUMERIC NOT NULL,
    percentage NUMERIC,
    is_settled BOOLEAN DEFAULT false
);

ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'transaction_splits' AND policyname = 'View splits if creator or involved'
    ) THEN
        CREATE POLICY "View splits if creator or involved" ON public.transaction_splits
            FOR SELECT
            USING (
                auth.uid() = user_id
                OR
                EXISTS (
                    SELECT 1 FROM public.transactions t
                    WHERE t.id = transaction_id AND t.user_id = auth.uid()
                )
            );
    END IF;
END $$;


-- notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id),
    type TEXT CHECK (type IN ('FRIEND_REQ', 'GROUP_INVITE', 'EXPENSE_ADDED')),
    title TEXT,
    message TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notifications' AND policyname = 'Users can view own notifications'
    ) THEN
        CREATE POLICY "Users can view own notifications" ON public.notifications
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notifications' AND policyname = 'Users can update own notifications'
    ) THEN
        CREATE POLICY "Users can update own notifications" ON public.notifications
            FOR UPDATE
            USING (auth.uid() = user_id);
    END IF;
END $$;


-- 2. Update Existing Tables

-- transactions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'group_id') THEN
        ALTER TABLE public.transactions ADD COLUMN group_id UUID REFERENCES public.groups(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'payer_id') THEN
        ALTER TABLE public.transactions ADD COLUMN payer_id UUID REFERENCES public.profiles(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'split_type') THEN
        ALTER TABLE public.transactions ADD COLUMN split_type TEXT DEFAULT 'EQUALLY' CHECK (split_type IN ('EQUALLY', 'BY_AMOUNT', 'BY_PERCENTAGE'));
    END IF;
END $$;


-- Update RLS for transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;

CREATE POLICY "Users can view own or involved transactions" ON public.transactions
    FOR SELECT
    USING (
        auth.uid() = user_id 
        OR 
        auth.uid() IN (SELECT user_id FROM public.transaction_splits WHERE transaction_id = id)
    );
