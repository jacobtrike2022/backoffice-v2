-- =====================================================
-- ADD PIN AUTHENTICATION FOR QUICK LOGIN
-- =====================================================
-- Adds 4-digit PIN field to users table for low-friction
-- QR code authentication (KB public viewer, learner app)
-- =====================================================

-- Add pin column to users table
ALTER TABLE users 
ADD COLUMN pin TEXT,
ADD COLUMN pin_set_at TIMESTAMPTZ;

-- Create index for fast PIN lookup
CREATE INDEX idx_users_pin ON users(pin) WHERE pin IS NOT NULL;

-- Create unique constraint on pin within organization
-- (Same PIN can exist across different orgs, but not within same org)
CREATE UNIQUE INDEX idx_users_pin_org_unique ON users(organization_id, pin) WHERE pin IS NOT NULL;

-- Function to generate random 4-digit PIN
CREATE OR REPLACE FUNCTION generate_pin()
RETURNS TEXT AS $$
DECLARE
    new_pin TEXT;
    pin_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate random 4-digit PIN
        new_pin := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
        
        -- Check if it already exists in this organization
        -- (We'll check organization_id in the application layer)
        EXIT WHEN new_pin NOT IN ('0000', '1234', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999');
    END LOOP;
    
    RETURN new_pin;
END;
$$ LANGUAGE plpgsql;

-- Helper function to lookup user by PIN + organization
CREATE OR REPLACE FUNCTION get_user_by_pin(pin_input TEXT, org_id UUID)
RETURNS TABLE (
    id UUID,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    organization_id UUID,
    role_id UUID,
    store_id UUID,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.organization_id,
        u.role_id,
        u.store_id,
        u.status
    FROM users u
    WHERE u.pin = pin_input
      AND u.organization_id = org_id
      AND u.status = 'active'
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN users.pin IS '4-digit PIN for quick authentication (QR codes, learner app)';
COMMENT ON COLUMN users.pin_set_at IS 'When PIN was last set/changed';
COMMENT ON FUNCTION generate_pin() IS 'Generates random 4-digit PIN avoiding common sequences';
COMMENT ON FUNCTION get_user_by_pin(TEXT, UUID) IS 'Lookup user by PIN within organization';
