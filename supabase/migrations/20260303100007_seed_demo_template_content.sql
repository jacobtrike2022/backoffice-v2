-- =====================================================
-- SEED DEMO TEMPLATE CONTENT
-- =====================================================
-- Creates the infrastructure and data needed for demo
-- provisioning to actually clone content into new orgs:
--
-- 1. organization_compliance_topics junction table
-- 2. is_demo_content flag on tracks
-- 3. Template organization to own template tracks
-- 4. Published template tracks for provisioning to clone
-- =====================================================

-- =====================================================
-- 1. JUNCTION TABLE: org ↔ compliance topic link
-- =====================================================
-- The provisioning endpoint inserts into this table to
-- link global compliance_topics to a provisioned org.

CREATE TABLE IF NOT EXISTS organization_compliance_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES compliance_topics(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    added_during TEXT,  -- 'sales_demo', 'onboarding', 'manual'
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_oct_org ON organization_compliance_topics(organization_id);
CREATE INDEX IF NOT EXISTS idx_oct_topic ON organization_compliance_topics(topic_id);

-- RLS
ALTER TABLE organization_compliance_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Demo mode: anon access to org compliance topics"
    ON organization_compliance_topics FOR ALL
    USING (
        auth.role() = 'anon'
        AND current_setting('app.demo_mode', true) = 'true'
    )
    WITH CHECK (
        auth.role() = 'anon'
        AND current_setting('app.demo_mode', true) = 'true'
    );

CREATE POLICY "Org members can view their compliance topics"
    ON organization_compliance_topics FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users
            WHERE auth_user_id = auth.uid()
        )
    );

-- =====================================================
-- 2. ADD is_demo_content FLAG TO TRACKS
-- =====================================================
-- Used by provisioning to mark cloned tracks so they
-- can be identified and cleaned up when demo expires.

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS is_demo_content BOOLEAN DEFAULT FALSE;

-- =====================================================
-- 3. TEMPLATE ORGANIZATION
-- =====================================================
-- A special org that owns template content for cloning.
-- Uses a well-known UUID so the provisioning endpoint
-- (or future admin tooling) can reference it.

INSERT INTO organizations (id, name, subdomain, settings, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Trike Templates',
    'trike-templates',
    '{"is_template_org": true}'::jsonb,
    NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 4. TEMPLATE TRACKS (published, ready to clone)
-- =====================================================
-- The provisioning endpoint queries:
--   SELECT ... FROM tracks WHERE status = 'published' LIMIT 10
-- These template tracks will be found and cloned into
-- the target org with is_demo_content = true.

-- Omit tags column: production uses track_tags junction table; tags column may not exist
INSERT INTO tracks (
    id, organization_id, title, description, type,
    content_url, thumbnail_url, duration_minutes,
    status, published_at, created_at, updated_at
) VALUES
(
    'f0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Food Safety Fundamentals',
    'Core food safety practices every convenience store employee needs to know. Covers temperature danger zones, personal hygiene, cross-contamination prevention, and proper food storage.',
    'video',
    NULL,
    NULL,
    15,
    'published',
    NOW(), NOW(), NOW()
),
(
    'f0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Customer Service Excellence',
    'Build exceptional customer experiences at the register and on the floor. Covers greeting techniques, handling complaints, upselling, and creating regulars.',
    'video',
    NULL,
    NULL,
    12,
    'published',
    NOW(), NOW(), NOW()
),
(
    'f0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Age-Restricted Product Sales',
    'Legal requirements and best practices for selling alcohol, tobacco, and lottery products. Covers ID verification, refusal techniques, and compliance documentation.',
    'video',
    NULL,
    NULL,
    18,
    'published',
    NOW(), NOW(), NOW()
),
(
    'f0000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'Workplace Safety & OSHA Basics',
    'Essential workplace safety training covering slip/trip/fall prevention, proper lifting techniques, hazard communication, and emergency procedures.',
    'video',
    NULL,
    NULL,
    20,
    'published',
    NOW(), NOW(), NOW()
),
(
    'f0000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'Cash Handling & Loss Prevention',
    'Protect your store''s bottom line with proper cash handling procedures, counterfeit detection, shortage prevention, and register reconciliation.',
    'article',
    NULL,
    NULL,
    10,
    'published',
    NOW(), NOW(), NOW()
),
(
    'f0000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    'Foodservice Prep & Holding Standards',
    'Proper procedures for preparing, holding, and serving ready-to-eat foods in a convenience store setting. Covers time/temperature controls, labeling, and display requirements.',
    'video',
    NULL,
    NULL,
    14,
    'published',
    NOW(), NOW(), NOW()
),
(
    'f0000000-0000-0000-0000-000000000007',
    '00000000-0000-0000-0000-000000000001',
    'Store Opening & Closing Procedures',
    'Step-by-step guide for opening and closing a convenience store. Covers security checks, register setup, daily logs, and end-of-day reconciliation.',
    'article',
    NULL,
    NULL,
    8,
    'published',
    NOW(), NOW(), NOW()
),
(
    'f0000000-0000-0000-0000-000000000008',
    '00000000-0000-0000-0000-000000000001',
    'Robbery Prevention & Response',
    'How to deter robberies and respond safely if one occurs. Covers situational awareness, de-escalation, compliance techniques, and post-incident procedures.',
    'video',
    NULL,
    NULL,
    16,
    'published',
    NOW(), NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;
