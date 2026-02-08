-- 1. Redefine update_contact_balance trigger
CREATE OR REPLACE FUNCTION update_contact_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Logic for INSERT
  IF (TG_OP = 'INSERT' AND NEW.contact_id IS NOT NULL) THEN
    UPDATE contacts
    SET 
      net_balance = net_balance + (CASE WHEN NEW.flow = 'OUT' THEN NEW.amount ELSE -NEW.amount END),
      last_transaction_at = NEW.date
    WHERE id = NEW.contact_id;
  END IF;

  -- Logic for UPDATE
  IF (TG_OP = 'UPDATE') THEN
    -- Reverse OLD impact
    IF (OLD.contact_id IS NOT NULL) THEN
      UPDATE contacts
      SET net_balance = net_balance - (CASE WHEN OLD.flow = 'OUT' THEN OLD.amount ELSE -OLD.amount END)
      WHERE id = OLD.contact_id;
    END IF;

    -- Apply NEW impact
    IF (NEW.contact_id IS NOT NULL) THEN
      UPDATE contacts
      SET 
        net_balance = net_balance + (CASE WHEN NEW.flow = 'OUT' THEN NEW.amount ELSE -NEW.amount END),
        last_transaction_at = NEW.date
      WHERE id = NEW.contact_id;
    END IF;
  END IF;

  -- Logic for DELETE
  IF (TG_OP = 'DELETE' AND OLD.contact_id IS NOT NULL) THEN
    UPDATE contacts
    SET net_balance = net_balance - (CASE WHEN OLD.flow = 'OUT' THEN OLD.amount ELSE -OLD.amount END)
    WHERE id = OLD.contact_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop and Recreate Trigger to ensure it covers UPDATE
DROP TRIGGER IF EXISTS trigger_update_balance ON transactions;
CREATE TRIGGER trigger_update_balance
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_contact_balance();


-- 2. Redefine update_account_balance trigger
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Logic for INSERT
  IF (TG_OP = 'INSERT' AND NEW.mode = 'PERSONAL' AND NEW.account_id IS NOT NULL) THEN
    UPDATE accounts
    SET 
      balance = balance + (CASE WHEN NEW.flow = 'IN' THEN NEW.amount ELSE -NEW.amount END)
    WHERE id = NEW.account_id;
  END IF;

  -- Logic for UPDATE
  IF (TG_OP = 'UPDATE') THEN
    -- Reverse OLD
    IF (OLD.mode = 'PERSONAL' AND OLD.account_id IS NOT NULL) THEN
      UPDATE accounts
      SET balance = balance - (CASE WHEN OLD.flow = 'IN' THEN OLD.amount ELSE -OLD.amount END)
      WHERE id = OLD.account_id;
    END IF;

    -- Apply NEW
    IF (NEW.mode = 'PERSONAL' AND NEW.account_id IS NOT NULL) THEN
      UPDATE accounts
      SET balance = balance + (CASE WHEN NEW.flow = 'IN' THEN NEW.amount ELSE -NEW.amount END)
      WHERE id = NEW.account_id;
    END IF;
  END IF;

  -- Logic for DELETE
  IF (TG_OP = 'DELETE' AND OLD.mode = 'PERSONAL' AND OLD.account_id IS NOT NULL) THEN
    UPDATE accounts
    SET balance = balance - (CASE WHEN OLD.flow = 'IN' THEN OLD.amount ELSE -OLD.amount END)
    WHERE id = OLD.account_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop and Recreate Trigger to ensure it covers UPDATE
DROP TRIGGER IF EXISTS trigger_update_account_balance ON transactions;
CREATE TRIGGER trigger_update_account_balance
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_account_balance();


-- 3. Fix Corrupted Data
CREATE OR REPLACE FUNCTION recalculate_all_balances()
RETURNS void AS $$
BEGIN
  -- 1. Reset all balances to 0
  UPDATE contacts SET net_balance = 0;
  UPDATE accounts SET balance = 0;

  -- 2. Re-sum Contacts
  -- Flow OUT -> Positive Balance (You act like a creditor)
  -- Flow IN -> Negative Balance (You act like a debtor)
  UPDATE contacts c
  SET net_balance = s.total
  FROM (
    SELECT contact_id, SUM(CASE WHEN flow = 'OUT' THEN amount ELSE -amount END) as total
    FROM transactions
    WHERE contact_id IS NOT NULL
    GROUP BY contact_id
  ) s
  WHERE c.id = s.contact_id;

  -- 3. Re-sum Accounts (Only Personal Mode)
  -- Flow IN -> Positive Balance (Income)
  -- Flow OUT -> Negative Balance (Expense)
  UPDATE accounts a
  SET balance = s.total
  FROM (
    SELECT account_id, SUM(CASE WHEN flow = 'IN' THEN amount ELSE -amount END) as total
    FROM transactions
    WHERE account_id IS NOT NULL AND mode = 'PERSONAL'
    GROUP BY account_id
  ) s
  WHERE a.id = s.account_id;

END;
$$ LANGUAGE plpgsql;

-- 4. Execute the fix
SELECT recalculate_all_balances();
