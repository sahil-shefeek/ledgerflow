-- 1. Add snapshot column
ALTER TABLE transaction_splits 
ADD COLUMN member_name_snapshot TEXT;

-- 2. Backfill existing data
DO $$
DECLARE
    r RECORD;
    extracted_name TEXT;
BEGIN
    FOR r IN SELECT * FROM transaction_splits LOOP
        extracted_name := 'Unknown';
        
        -- Priority 1: Real User (via user_id)
        IF r.user_id IS NOT NULL THEN
            SELECT full_name INTO extracted_name
            FROM profiles
            WHERE id = r.user_id;
            
        -- Priority 2: Ghost Member (via group_member_id)
        ELSIF r.group_member_id IS NOT NULL THEN
            SELECT COALESCE(ghost_name, 'Member') INTO extracted_name
            FROM group_members
            WHERE id = r.group_member_id;
        END IF;

        -- Fallback if name is still null (e.g. profile not found)
        IF extracted_name IS NULL THEN
            extracted_name := 'Unknown';
        END IF;

        UPDATE transaction_splits
        SET member_name_snapshot = extracted_name
        WHERE id = r.id;
    END LOOP;
END $$;

-- 3. Relax Foreign Key Constraint
ALTER TABLE transaction_splits
DROP CONSTRAINT IF EXISTS transaction_splits_group_member_id_fkey;

ALTER TABLE transaction_splits
ADD CONSTRAINT transaction_splits_group_member_id_fkey
FOREIGN KEY (group_member_id)
REFERENCES group_members(id)
ON DELETE SET NULL;
