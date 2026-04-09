-- supabase/migrations/20260409_atomic_add_transaction_rpc.sql

CREATE OR REPLACE FUNCTION public.add_transaction_with_splits(
  p_user_id         UUID,
  p_business_id     UUID,
  p_amount          NUMERIC,
  p_flow            TEXT,
  p_mode            TEXT,
  p_name            TEXT,
  p_note            TEXT,
  p_date            TIMESTAMPTZ,
  p_due_date        TIMESTAMPTZ,
  p_contact_id      UUID,
  p_category_id     UUID,
  p_account_id      UUID,
  p_group_id        UUID,
  p_payer_id        UUID,
  p_payer_group_member_id UUID,
  p_split_type      TEXT,
  p_splits          JSONB  -- Array of split objects
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id  UUID;
  v_transaction     JSONB;
  v_split           JSONB;
BEGIN
  -- Validate caller owns this operation
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Insert the transaction
  INSERT INTO public.transactions (
    user_id, business_id, amount, flow, mode, name, note,
    date, due_date, contact_id, category_id, account_id,
    group_id, payer_id, payer_group_member_id, split_type
  )
  VALUES (
    p_user_id, p_business_id, p_amount, p_flow, p_mode, p_name, p_note,
    p_date, p_due_date, p_contact_id, p_category_id, p_account_id,
    p_group_id, p_payer_id, p_payer_group_member_id, p_split_type
  )
  RETURNING id INTO v_transaction_id;

  -- Insert splits if any were provided
  IF p_splits IS NOT NULL AND jsonb_array_length(p_splits) > 0 THEN
    FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
    LOOP
      INSERT INTO public.transaction_splits (
        transaction_id,
        user_id,
        group_member_id,
        amount,
        percentage,
        is_settled,
        member_name_snapshot
      )
      VALUES (
        v_transaction_id,
        (v_split->>'user_id')::UUID,
        (v_split->>'group_member_id')::UUID,
        (v_split->>'amount')::NUMERIC,
        (v_split->>'percentage')::NUMERIC,
        COALESCE((v_split->>'is_settled')::BOOLEAN, FALSE),
        v_split->>'member_name_snapshot'
      );
    END LOOP;
  END IF;

  -- Return the created transaction id
  RETURN jsonb_build_object('id', v_transaction_id);

EXCEPTION
  WHEN OTHERS THEN
    -- The entire block is automatically rolled back by Postgres on exception
    RAISE;
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.add_transaction_with_splits FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_transaction_with_splits TO authenticated;
