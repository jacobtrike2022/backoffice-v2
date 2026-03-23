-- =====================================================
-- COMPLIANCE REQUIREMENTS MIGRATION
-- Mirrors Notion "State-Specific Requirements Tracking" database
-- =====================================================

-- =====================================================
-- 1. COMPLIANCE TOPICS TABLE
-- (Maps to Notion "Topics State-Specific")
-- =====================================================

CREATE TABLE IF NOT EXISTS compliance_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,  -- "Alcohol", "Food Handler", "Tobacco", "CFPM", "Robbery/Safety"
  description TEXT,
  icon TEXT,  -- emoji or icon name
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed core topics from your Notion data
INSERT INTO compliance_topics (name, description, icon, sort_order) VALUES
  ('Alcohol', 'Alcohol seller/server training and certification', '🍺', 1),
  ('Food Handler', 'Food handler cards and food safety training', '🍔', 2),
  ('Food Manager', 'Certified Food Protection Manager (CFPM)', '👨‍🍳', 3),
  ('Tobacco', 'Tobacco sales training and certification', '🚬', 4),
  ('Robbery Safety', 'Convenience store security and robbery prevention', '🔒', 5),
  ('Harassment Prevention', 'Sexual harassment prevention training', '⚖️', 6),
  ('Lottery', 'Lottery sales training and certification', '🎰', 7)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 2. STATE REGULATORY AUTHORITIES TABLE
-- (Maps to Notion "State Authorities")
-- =====================================================

CREATE TABLE IF NOT EXISTS compliance_authorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code CHAR(2) NOT NULL,  -- TX, FL, CA, etc.
  name TEXT NOT NULL,  -- "Texas Alcoholic Beverage Commission"
  abbreviation TEXT,   -- "TABC"
  authority_type TEXT CHECK (authority_type IN (
    'alcohol_tobacco_commission',
    'business_professional_regulation', 
    'dept_of_agriculture',
    'dept_of_health',
    'dept_of_labor',
    'environmental',
    'other'
  )),
  website_url TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(state_code, abbreviation)
);

CREATE INDEX idx_compliance_authorities_state ON compliance_authorities(state_code);

-- =====================================================
-- 3. COMPLIANCE REQUIREMENTS TABLE (MAIN TABLE)
-- (Maps to Notion "State-Specific Requirements Tracking")
-- =====================================================

CREATE TABLE IF NOT EXISTS compliance_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  notion_id TEXT UNIQUE,  -- For sync tracking: "fcc58fdc-19c7-4646-89bb-fe7941950bf0"
  requirement_name TEXT NOT NULL,  -- "Texas TABC", "FL Robbery & Safety"
  course_name TEXT,  -- Display name for the course
  
  -- Geographic Scope
  state_code CHAR(2) NOT NULL,  -- TX, FL, CA, IL, etc.
  jurisdiction_level TEXT CHECK (jurisdiction_level IN ('state', 'county', 'city')) DEFAULT 'state',
  jurisdiction_name TEXT,  -- For county/city level: "Cook County", "Chicago"
  
  -- Classification
  topic_id UUID REFERENCES compliance_topics(id),
  authority_id UUID REFERENCES compliance_authorities(id),
  
  -- Requirement Details (from your Notion schema)
  ee_training_required TEXT CHECK (ee_training_required IN (
    'required_certified',      -- Individual must be certified by name
    'required_program',        -- Training required, provider ensures compliance
    'required_no_list',        -- Required but no approved provider list
    'voluntary_with_benefit',  -- Voluntary but provides liability protection (Safe Harbor)
    'suggested',               -- Best practice, not legally required
    'sometimes_required',      -- Varies by local jurisdiction
    'not_required'
  )) DEFAULT 'not_required',
  
  approval_required TEXT CHECK (approval_required IN (
    'required_easy',           -- Simple registration/application
    'required_medium',         -- Moderate approval process
    'required_hard',           -- Complex state approval
    'required_ansi',           -- Must use ANSI-accredited provider
    'state_guides_no_approval', -- State provides guidelines, no approval needed
    'state_guides_maybe_local', -- State guides, but local may require approval
    'not_possible',            -- Cannot become approved provider
    'unknown'
  )) DEFAULT 'unknown',
  
  -- Timing
  days_to_complete INTEGER,  -- Days new employee has to complete (30, 60, 90)
  recertification_years DECIMAL(3,1),  -- Years until recertification (2, 3, 5)
  training_hours DECIMAL(4,1),  -- Required training hours
  
  -- Population (who needs this training)
  applies_to_everyone BOOLEAN DEFAULT false,
  applies_to_foodservice BOOLEAN DEFAULT false,
  applies_to_frontline BOOLEAN DEFAULT false,
  applies_to_managers BOOLEAN DEFAULT false,
  applies_to_retail BOOLEAN DEFAULT false,
  
  -- Legal Reference
  law_name TEXT,  -- "Convenience Business Security Act"
  law_code_reference TEXT,  -- "§812.174 F.S."
  
  -- Links & Resources
  cert_details_url TEXT,
  authority_url TEXT,
  
  -- Partner/Provider Info (your business development tracking)
  partner_available BOOLEAN DEFAULT false,
  partner_name TEXT,  -- "Always Food Safe"
  
  -- Status & Priority (for your internal tracking)
  status TEXT CHECK (status IN (
    'recon_not_started',
    'recon_started', 
    'recon_done',
    'scope_done',
    'production',
    'pending_approval',
    'done_no_approval_needed',
    'approved'
  )) DEFAULT 'recon_not_started',
  
  roadmap_priority TEXT CHECK (roadmap_priority IN (
    'critical',
    'high',
    'needed',
    'moderate', 
    'low',
    'done',
    'someday_maybe',
    'not_possible'
  )),
  
  -- Metadata
  notes TEXT,
  last_verified_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_compliance_req_state ON compliance_requirements(state_code);
CREATE INDEX idx_compliance_req_topic ON compliance_requirements(topic_id);
CREATE INDEX idx_compliance_req_authority ON compliance_requirements(authority_id);
CREATE INDEX idx_compliance_req_status ON compliance_requirements(status);
CREATE INDEX idx_compliance_req_mandatory ON compliance_requirements(state_code, ee_training_required) 
  WHERE ee_training_required IN ('required_certified', 'required_program', 'required_no_list');

-- =====================================================
-- 4. STORE COMPLIANCE ASSIGNMENTS
-- Links stores to their applicable requirements
-- =====================================================

CREATE TABLE IF NOT EXISTS store_compliance_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
  
  -- Override fields (if store needs different settings than default)
  is_applicable BOOLEAN DEFAULT true,  -- Can mark as N/A for specific store
  override_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(store_id, requirement_id)
);

CREATE INDEX idx_store_compliance_store ON store_compliance_requirements(store_id);
CREATE INDEX idx_store_compliance_req ON store_compliance_requirements(requirement_id);

-- =====================================================
-- 5. ROLE COMPLIANCE REQUIREMENTS
-- Which roles need which compliance training
-- =====================================================

CREATE TABLE IF NOT EXISTS role_compliance_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
  
  is_required BOOLEAN DEFAULT true,  -- Required vs recommended
  priority INTEGER DEFAULT 1,  -- Order of importance
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(role_id, requirement_id)
);

CREATE INDEX idx_role_compliance_role ON role_compliance_requirements(role_id);
CREATE INDEX idx_role_compliance_req ON role_compliance_requirements(requirement_id);

-- =====================================================
-- 6. HELPER VIEW: Store Requirements by State
-- Auto-generates applicable requirements based on store state
-- =====================================================

CREATE OR REPLACE VIEW v_store_applicable_requirements AS
SELECT 
  s.id AS store_id,
  s.organization_id,
  s.name AS store_name,
  s.state AS store_state,
  cr.id AS requirement_id,
  cr.requirement_name,
  cr.course_name,
  ct.name AS topic_name,
  cr.ee_training_required,
  cr.days_to_complete,
  cr.recertification_years,
  cr.law_code_reference,
  COALESCE(scr.is_applicable, true) AS is_applicable,
  scr.override_notes
FROM stores s
JOIN compliance_requirements cr ON UPPER(s.state) = cr.state_code
LEFT JOIN store_compliance_requirements scr 
  ON s.id = scr.store_id AND cr.id = scr.requirement_id
LEFT JOIN compliance_topics ct ON cr.topic_id = ct.id
WHERE s.is_active = true
  AND cr.ee_training_required IN ('required_certified', 'required_program', 'required_no_list', 'voluntary_with_benefit');

-- =====================================================
-- 7. HELPER FUNCTION: Get Requirements for User
-- Based on their store location and role
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_compliance_requirements(p_user_id UUID)
RETURNS TABLE (
  requirement_id UUID,
  requirement_name TEXT,
  topic_name TEXT,
  state_code CHAR(2),
  ee_training_required TEXT,
  days_to_complete INTEGER,
  recertification_years DECIMAL,
  is_from_role BOOLEAN,
  is_from_store BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH user_info AS (
    SELECT 
      u.id,
      u.role_id,
      u.store_id,
      s.state
    FROM users u
    LEFT JOIN stores s ON u.store_id = s.id
    WHERE u.id = p_user_id
  )
  SELECT DISTINCT
    cr.id AS requirement_id,
    cr.requirement_name,
    ct.name AS topic_name,
    cr.state_code,
    cr.ee_training_required,
    cr.days_to_complete,
    cr.recertification_years,
    rcr.id IS NOT NULL AS is_from_role,
    (UPPER(ui.state) = cr.state_code) AS is_from_store
  FROM user_info ui
  JOIN compliance_requirements cr ON (
    -- Match by store state
    UPPER(ui.state) = cr.state_code
    OR 
    -- Or match by role assignment
    cr.id IN (
      SELECT requirement_id FROM role_compliance_requirements 
      WHERE role_id = ui.role_id
    )
  )
  LEFT JOIN role_compliance_requirements rcr 
    ON cr.id = rcr.requirement_id AND rcr.role_id = ui.role_id
  LEFT JOIN compliance_topics ct ON cr.topic_id = ct.id
  WHERE cr.ee_training_required IN ('required_certified', 'required_program', 'required_no_list', 'voluntary_with_benefit');
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 8. RLS POLICIES
-- =====================================================

ALTER TABLE compliance_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_compliance_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_compliance_requirements ENABLE ROW LEVEL SECURITY;

-- Topics and Authorities are public reference data
CREATE POLICY "Anyone can view compliance topics"
  ON compliance_topics FOR SELECT USING (true);

CREATE POLICY "Anyone can view compliance authorities"
  ON compliance_authorities FOR SELECT USING (true);

CREATE POLICY "Anyone can view compliance requirements"
  ON compliance_requirements FOR SELECT USING (true);

-- Only admins can modify reference data
CREATE POLICY "Trike admins can manage compliance topics"
  ON compliance_topics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.name = 'Trike Super Admin'
    )
  );

CREATE POLICY "Trike admins can manage compliance authorities"
  ON compliance_authorities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.name = 'Trike Super Admin'
    )
  );

CREATE POLICY "Trike admins can manage compliance requirements"
  ON compliance_requirements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.name = 'Trike Super Admin'
    )
  );

-- Store compliance assignments scoped to organization
CREATE POLICY "Users can view store compliance in their org"
  ON store_compliance_requirements FOR SELECT
  USING (
    store_id IN (
      SELECT s.id FROM stores s
      JOIN users u ON s.organization_id = u.organization_id
      WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage store compliance in their org"
  ON store_compliance_requirements FOR ALL
  USING (
    store_id IN (
      SELECT s.id FROM stores s
      JOIN users u ON s.organization_id = u.organization_id
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.name IN ('Admin', 'Trike Super Admin')
    )
  );

-- Role compliance assignments scoped to organization
CREATE POLICY "Users can view role compliance in their org"
  ON role_compliance_requirements FOR SELECT
  USING (
    role_id IN (
      SELECT r.id FROM roles r
      JOIN users u ON r.organization_id = u.organization_id
      WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage role compliance in their org"
  ON role_compliance_requirements FOR ALL
  USING (
    role_id IN (
      SELECT rl.id FROM roles rl
      JOIN users u ON rl.organization_id = u.organization_id
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.name IN ('Admin', 'Trike Super Admin')
    )
  );

-- =====================================================
-- 9. UPDATE TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS update_compliance_topics_updated_at ON compliance_topics;
CREATE TRIGGER update_compliance_topics_updated_at
    BEFORE UPDATE ON compliance_topics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_compliance_authorities_updated_at ON compliance_authorities;
CREATE TRIGGER update_compliance_authorities_updated_at
    BEFORE UPDATE ON compliance_authorities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_compliance_requirements_updated_at ON compliance_requirements;
CREATE TRIGGER update_compliance_requirements_updated_at
    BEFORE UPDATE ON compliance_requirements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_store_compliance_updated_at ON store_compliance_requirements;
CREATE TRIGGER update_store_compliance_updated_at
    BEFORE UPDATE ON store_compliance_requirements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- SELECT * FROM compliance_topics;
-- SELECT * FROM compliance_requirements WHERE state_code = 'TX';
-- SELECT * FROM v_store_applicable_requirements WHERE store_state = 'TX';
-- SELECT * FROM get_user_compliance_requirements('user-uuid-here');
-- =====================================================
