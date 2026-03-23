-- Add contract tracking fields to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS contract_id TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS contract_status TEXT DEFAULT 'none';
-- contract_status values: none, sent, viewed, signed, declined, withdrawn
ALTER TABLE deals ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS contract_signer_email TEXT;

-- Add payment method field to organizations
-- stripe_customer_id already exists from migration 00017
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'none';
-- billing_status values: none, payment_method_saved, active, past_due, cancelled

-- Index for contract lookups
CREATE INDEX IF NOT EXISTS idx_deals_contract_id ON deals(contract_id) WHERE contract_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_contract_status ON deals(contract_status) WHERE contract_status != 'none';
