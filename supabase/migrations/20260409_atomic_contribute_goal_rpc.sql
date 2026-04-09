-- supabase/migrations/20260409_atomic_contribute_goal_rpc.sql

CREATE OR REPLACE FUNCTION public.contribute_to_goal(
  p_goal_id UUID,
  p_amount  NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated JSONB;
BEGIN
  -- Validate the goal belongs to the calling user
  IF NOT EXISTS (
    SELECT 1 FROM public.goals WHERE id = p_goal_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Goal not found or unauthorized';
  END IF;

  -- Atomic increment — no read required, no race condition possible
  UPDATE public.goals
  SET current_amount = current_amount + p_amount
  WHERE id = p_goal_id AND user_id = auth.uid()
  RETURNING jsonb_build_object('id', id, 'current_amount', current_amount) INTO v_updated;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.contribute_to_goal FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contribute_to_goal TO authenticated;
