-- supabase/migrations/20260409_fix_balance_trigger_update.sql

-- Step 1: Drop the old trigger and function
DROP TRIGGER IF EXISTS trigger_update_balance ON public.transactions;
DROP FUNCTION IF EXISTS public.update_contact_balance();

-- Step 2: Re-create the function with full INSERT / UPDATE / DELETE handling
CREATE OR REPLACE FUNCTION public.update_contact_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_old_delta NUMERIC;
  v_new_delta NUMERIC;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    -- Only act on BUSINESS mode transactions linked to a contact
    IF NEW.mode = 'BUSINESS' AND NEW.contact_id IS NOT NULL THEN
      UPDATE public.contacts
      SET
        net_balance = net_balance + (CASE WHEN NEW.flow = 'OUT' THEN NEW.amount ELSE -NEW.amount END),
        last_transaction_at = NEW.date
      WHERE id = NEW.contact_id AND user_id = NEW.user_id;
    END IF;
    RETURN NEW;
  END IF;

  IF (TG_OP = 'DELETE') THEN
    IF OLD.mode = 'BUSINESS' AND OLD.contact_id IS NOT NULL THEN
      UPDATE public.contacts
      SET net_balance = net_balance - (CASE WHEN OLD.flow = 'OUT' THEN OLD.amount ELSE -OLD.amount END)
      WHERE id = OLD.contact_id AND user_id = OLD.user_id;
    END IF;
    RETURN OLD;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    -- Reverse the OLD transaction's effect, then apply the NEW transaction's effect.
    -- This is correct even if amount, flow, or contact_id changed.

    -- Reverse OLD effect
    IF OLD.mode = 'BUSINESS' AND OLD.contact_id IS NOT NULL THEN
      v_old_delta := CASE WHEN OLD.flow = 'OUT' THEN OLD.amount ELSE -OLD.amount END;
      UPDATE public.contacts
      SET net_balance = net_balance - v_old_delta
      WHERE id = OLD.contact_id AND user_id = OLD.user_id;
    END IF;

    -- Apply NEW effect
    IF NEW.mode = 'BUSINESS' AND NEW.contact_id IS NOT NULL THEN
      v_new_delta := CASE WHEN NEW.flow = 'OUT' THEN NEW.amount ELSE -NEW.amount END;
      UPDATE public.contacts
      SET
        net_balance = net_balance + v_new_delta,
        last_transaction_at = NEW.date
      WHERE id = NEW.contact_id AND user_id = NEW.user_id;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Re-attach the trigger (fires on ALL three operations)
CREATE TRIGGER trigger_update_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_contact_balance();
