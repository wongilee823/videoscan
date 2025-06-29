-- Update test user to pro status for development
UPDATE users 
SET 
  subscription_status = 'pro',
  updated_at = NOW()
WHERE email = 'wongilee823@gmail.com';

-- Also reset their usage for clean testing
UPDATE usage_tracking
SET 
  scan_count = 0,
  page_count = 0,
  updated_at = NOW()
WHERE user_id = (
  SELECT id FROM users WHERE email = 'wongilee823@gmail.com'
)
AND month = DATE_TRUNC('month', CURRENT_DATE);