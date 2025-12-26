-- Migration: Add LBP change feature for Lebanon dual-currency transactions
-- This allows tracking the actual value of items when paying in USD and receiving LBP change

-- Add lbp_change_received column to transactions
-- This stores the LBP amount received back as change (in thousands for convenience)
-- Example: 600 means 600,000 LBP
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS lbp_change_received numeric DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN transactions.lbp_change_received IS 'LBP change received in thousands (e.g., 600 = 600,000 LBP). Used for Lebanon dual-currency tracking.';

-- Add lbp_exchange_rate to user_preferences
-- This stores the current LBP to USD rate (how many LBP per 1 USD)
-- Example: 90 means 90,000 LBP = 1 USD
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS lbp_exchange_rate numeric DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN user_preferences.lbp_exchange_rate IS 'LBP per USD rate in thousands (e.g., 90 = 90,000 LBP per 1 USD). Used for Lebanon dual-currency tracking.';
