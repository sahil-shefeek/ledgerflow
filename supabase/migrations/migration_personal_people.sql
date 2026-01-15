-- Add transaction_count to contacts
ALTER TABLE public.contacts 
ADD COLUMN transaction_count integer DEFAULT 0;

-- Update update_contact_balance function
CREATE OR REPLACE FUNCTION update_contact_balance()
RETURNS trigger AS $$
BEGIN
  -- Logic for INSERT
  -- Removed strict mode='BUSINESS' check. Now runs if contact_id is present.
  IF (TG_OP = 'INSERT' AND NEW.contact_id IS NOT NULL) THEN
    UPDATE contacts
    SET 
      net_balance = net_balance + (CASE WHEN NEW.flow = 'OUT' THEN NEW.amount ELSE -NEW.amount END),
      last_transaction_at = NEW.date,
      transaction_count = transaction_count + 1
    WHERE id = NEW.contact_id;
  END IF;

  -- Logic for DELETE (Reverse the math)
  IF (TG_OP = 'DELETE' AND OLD.contact_id IS NOT NULL) THEN
    UPDATE contacts
    SET 
      net_balance = net_balance - (CASE WHEN OLD.flow = 'OUT' THEN OLD.amount ELSE -OLD.amount END),
      transaction_count = GREATEST(0, transaction_count - 1)
    WHERE id = OLD.contact_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
