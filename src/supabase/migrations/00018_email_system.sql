-- =====================================================
-- EMAIL COMMUNICATION SYSTEM
-- =====================================================
-- Provides:
-- - Email templates (system + org-customizable)
-- - Email logging and tracking
-- - RLS for org-scoped access
-- =====================================================

-- EMAIL TEMPLATES
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    -- NULL organization_id = system template (Trike-managed)

    slug TEXT NOT NULL,  -- 'welcome_admin', 'welcome_employee', 'password_reset'
    name TEXT NOT NULL,
    description TEXT,

    subject TEXT NOT NULL,  -- Supports {{variables}}
    body_html TEXT NOT NULL,
    body_text TEXT,

    template_type TEXT NOT NULL CHECK (template_type IN ('system', 'organization')),
    is_locked BOOLEAN DEFAULT false,  -- Only Trike Super Admin can edit if true
    is_active BOOLEAN DEFAULT true,

    available_variables JSONB DEFAULT '[]'::jsonb,
    -- Example: [{"key": "company_name", "description": "Organization name"}]

    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, slug)
);

-- EMAIL LOGS
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    recipient_email TEXT NOT NULL,

    template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
    template_slug TEXT,  -- Store slug in case template is deleted

    subject TEXT NOT NULL,
    body_html TEXT,

    trigger_type TEXT NOT NULL,  -- 'welcome_admin', 'password_reset', etc.
    triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULL = system triggered

    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'
    )),

    resend_id TEXT,  -- Resend message ID for tracking
    error_message TEXT,

    metadata JSONB DEFAULT '{}'::jsonb,  -- Variables used, etc.

    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_email_templates_org ON email_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_slug ON email_templates(slug);
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(template_type);

CREATE INDEX IF NOT EXISTS idx_email_logs_org ON email_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_trigger ON email_logs(trigger_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_resend_id ON email_logs(resend_id);

-- RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Templates: View system templates (org_id IS NULL) OR own org's templates
CREATE POLICY "View email templates" ON email_templates FOR SELECT
USING (organization_id IS NULL OR organization_id = get_user_organization_id());

-- Templates: Only org admins can create org templates
CREATE POLICY "Org admins can create templates" ON email_templates FOR INSERT
WITH CHECK (
    organization_id = get_user_organization_id()
    AND template_type = 'organization'
);

-- Templates: Only org admins can update their own non-locked templates
CREATE POLICY "Org admins can update their templates" ON email_templates FOR UPDATE
USING (
    organization_id = get_user_organization_id()
    AND is_locked = false
)
WITH CHECK (
    organization_id = get_user_organization_id()
    AND is_locked = false
);

-- Templates: Only org admins can delete their own templates
CREATE POLICY "Org admins can delete their templates" ON email_templates FOR DELETE
USING (
    organization_id = get_user_organization_id()
    AND template_type = 'organization'
);

-- Logs: View own org's logs
CREATE POLICY "View email logs" ON email_logs FOR SELECT
USING (organization_id = get_user_organization_id());

-- Logs: Service role can insert (from edge function)
CREATE POLICY "Service role can insert logs" ON email_logs FOR INSERT
WITH CHECK (true);

-- =====================================================
-- TRIGGER: Update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_email_templates_updated_at();
