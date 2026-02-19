DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'payer_group_member_id') THEN
        ALTER TABLE public.transactions 
        ADD COLUMN payer_group_member_id UUID REFERENCES public.group_members(id) ON DELETE SET NULL;
    END IF;
END $$;
