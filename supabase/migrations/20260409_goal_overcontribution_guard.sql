-- supabase/migrations/20260409_goal_overcontribution_guard.sql
-- Replaces contribute_to_goal to add an over-contribution guard.
-- Does NOT alter any table structure — function replacement only.

CREATE OR REPLACE FUNCTION public.contribute_to_goal(
  p_goal_id UUID,
  p_amount  NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target  NUMERIC;
  v_current NUMERIC;
  v_updated JSONB;
BEGIN
  -- Validate the goal belongs to the calling user
  IF NOT EXISTS (
    SELECT 1 FROM public.goals WHERE id = p_goal_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Goal not found or unauthorized';
  END IF;

  -- Read current and target amounts atomically (SELECT ... FOR UPDATE locks the row)
  SELECT target_amount, current_amount
    INTO v_target, v_current
    FROM public.goals
   WHERE id = p_goal_id AND user_id = auth.uid()
     FOR UPDATE;

  -- Guard: prevent over-contribution
  IF v_current + p_amount > v_target THEN
    RAISE EXCEPTION 'Contribution would exceed goal target';
  END IF;

  -- Atomic increment
  UPDATE public.goals
  SET current_amount = current_amount + p_amount
  WHERE id = p_goal_id AND user_id = auth.uid()
  RETURNING jsonb_build_object('id', id, 'current_amount', current_amount) INTO v_updated;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.contribute_to_goal FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contribute_to_goal TO authenticated;
