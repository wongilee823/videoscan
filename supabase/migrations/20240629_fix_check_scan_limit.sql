-- Fix check_scan_limit function to handle NULL values properly
CREATE OR REPLACE FUNCTION public.check_scan_limit(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription_status subscription_status;
  v_current_month_scans INTEGER;
BEGIN
  -- Get user's subscription status
  SELECT subscription_status INTO v_subscription_status
  FROM public.users
  WHERE id = p_user_id;

  -- If user doesn't exist, deny access
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- If subscription_status is NULL, treat as free user
  IF v_subscription_status IS NULL THEN
    v_subscription_status := 'free';
  END IF;

  -- Pro users have no limits
  IF v_subscription_status = 'pro' THEN
    RETURN true;
  END IF;

  -- Check current month's scan count for free users
  SELECT COALESCE(scan_count, 0) INTO v_current_month_scans
  FROM public.usage_tracking
  WHERE user_id = p_user_id
    AND month = DATE_TRUNC('month', CURRENT_DATE);

  -- If no usage tracking record exists, user has 0 scans
  IF NOT FOUND THEN
    v_current_month_scans := 0;
  END IF;

  -- Free users limited to 5 scans per month
  RETURN v_current_month_scans < 5;
END;
$$;