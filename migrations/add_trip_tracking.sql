-- Migration: Add trip tracking to accounts
-- Date: 2025-11-30
-- Description: Enables tracking expenses by country/location at the account level
--              This is better architecture because travel expenses are typically
--              tracked per trip account (e.g., "Trip - France", "Vacation - Japan")

-- Add country_code and location_name fields to accounts
ALTER TABLE public.accounts
  ADD COLUMN country_code text,
  ADD COLUMN location_name text;

-- Add index for country-based queries
CREATE INDEX idx_accounts_country_code ON public.accounts(country_code);

-- Common ISO 3166-1 alpha-2 country codes for reference:
-- US = United States, GB = United Kingdom, FR = France, DE = Germany,
-- IT = Italy, ES = Spain, JP = Japan, CN = China, AU = Australia,
-- CA = Canada, BR = Brazil, MX = Mexico, AE = United Arab Emirates,
-- TH = Thailand, SG = Singapore, etc.

-- Example: Create a trip account with location
-- INSERT INTO accounts (user_id, name, type, country_code, location_name)
-- VALUES ('user-uuid', 'Trip - France', 'expense', 'FR', 'Paris');

-- Example: Update existing trip account with location
-- UPDATE accounts SET country_code = 'JP', location_name = 'Tokyo' WHERE name LIKE 'Trip - Japan%';

COMMENT ON COLUMN public.accounts.country_code IS 'ISO 3166-1 alpha-2 country code for trip tracking (e.g., US, FR, JP)';
COMMENT ON COLUMN public.accounts.location_name IS 'Human-readable location name (e.g., Paris, Tokyo, New York)';
