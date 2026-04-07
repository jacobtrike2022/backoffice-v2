-- Add mobile_phone column to users table for SMS messaging
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_phone TEXT;

-- Comment for clarity
COMMENT ON COLUMN users.mobile_phone IS 'Mobile/cell phone number for SMS messaging. Stored in E.164 format (+1XXXXXXXXXX).';
