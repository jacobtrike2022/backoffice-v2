-- =====================================================
-- CREATE O*NET COMPETENCY TAXONOMY TABLES
-- =====================================================
-- Purpose: Store O*NET competency taxonomy data for skills-based training recommendations
-- Data Source: O*NET API v2.0 (https://api-v2.onetcenter.org)
-- Update Frequency: Twice yearly (manual sync via Edge Functions)
-- Related Edge Functions: get-onet-occupation-details, search-onet-occupations, sync-onet-data
-- =====================================================

-- =====================================================
-- TIER 1: CORE COMPETENCY MAPPING TABLES
-- =====================================================

-- O*NET Occupations (Master list of all occupations)
CREATE TABLE IF NOT EXISTS onet_occupations (
    onet_code VARCHAR(10) PRIMARY KEY, -- Format: "41-2011.00"
    title TEXT NOT NULL,
    description TEXT,
    job_zone INTEGER, -- 1-5 scale indicating education/experience level
    also_called TEXT[], -- Array of alternative job titles
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE onet_occupations IS 'Master list of O*NET occupations with codes, titles, and descriptions';
COMMENT ON COLUMN onet_occupations.onet_code IS 'O*NET occupation code (e.g., "41-2011.00" for Cashiers)';
COMMENT ON COLUMN onet_occupations.job_zone IS 'Job zone 1-5 indicating education/experience level (1=little prep, 5=extensive prep)';

-- O*NET Tasks (Occupation-specific tasks)
CREATE TABLE IF NOT EXISTS onet_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onet_code VARCHAR(10) NOT NULL REFERENCES onet_occupations(onet_code) ON DELETE CASCADE,
    task_description TEXT NOT NULL,
    task_order INTEGER, -- Order within occupation (1, 2, 3...)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE onet_tasks IS 'Specific tasks performed by each occupation (e.g., Cashiers have 28 tasks)';
COMMENT ON COLUMN onet_tasks.task_order IS 'Order/rank of task importance within the occupation';

-- O*NET Skills (Master list of 35 skills)
CREATE TABLE IF NOT EXISTS onet_skills (
    skill_id VARCHAR(20) PRIMARY KEY, -- O*NET element ID (e.g., "2.A.1.a")
    name TEXT NOT NULL,
    category TEXT, -- Category like "Basic Skills", "Social Skills", etc.
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE onet_skills IS 'Master list of 35 O*NET skills (e.g., Active Listening, Critical Thinking)';
COMMENT ON COLUMN onet_skills.skill_id IS 'O*NET element identifier (e.g., "2.A.1.a" for Active Listening)';

-- O*NET Occupation-Skills Mapping (Many-to-many with importance scores)
CREATE TABLE IF NOT EXISTS onet_occupation_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onet_code VARCHAR(10) NOT NULL REFERENCES onet_occupations(onet_code) ON DELETE CASCADE,
    skill_id VARCHAR(20) NOT NULL REFERENCES onet_skills(skill_id) ON DELETE CASCADE,
    importance DECIMAL(5,2), -- Importance score 0-100
    level DECIMAL(5,2), -- Required level 0-7
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(onet_code, skill_id)
);

COMMENT ON TABLE onet_occupation_skills IS 'Many-to-many mapping of occupations to skills with importance/level scores';
COMMENT ON COLUMN onet_occupation_skills.importance IS 'Importance score 0-100 (how important this skill is for the occupation)';
COMMENT ON COLUMN onet_occupation_skills.level IS 'Required level 0-7 (what level of this skill is needed)';

-- O*NET Knowledge (Master list of 33 knowledge areas)
CREATE TABLE IF NOT EXISTS onet_knowledge (
    knowledge_id VARCHAR(20) PRIMARY KEY, -- O*NET element ID
    name TEXT NOT NULL,
    category TEXT, -- Category like "Business and Management", "Engineering and Technology"
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE onet_knowledge IS 'Master list of 33 O*NET knowledge areas (e.g., Customer Service, Food Production)';
COMMENT ON COLUMN onet_knowledge.knowledge_id IS 'O*NET element identifier for knowledge area';

-- O*NET Occupation-Knowledge Mapping (Many-to-many with importance scores)
CREATE TABLE IF NOT EXISTS onet_occupation_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onet_code VARCHAR(10) NOT NULL REFERENCES onet_occupations(onet_code) ON DELETE CASCADE,
    knowledge_id VARCHAR(20) NOT NULL REFERENCES onet_knowledge(knowledge_id) ON DELETE CASCADE,
    importance DECIMAL(5,2), -- Importance score 0-100
    level DECIMAL(5,2), -- Required level 0-7
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(onet_code, knowledge_id)
);

COMMENT ON TABLE onet_occupation_knowledge IS 'Many-to-many mapping of occupations to knowledge areas with importance/level scores';

-- O*NET Technology Skills (Tools, software, equipment used by occupation)
CREATE TABLE IF NOT EXISTS onet_technology_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onet_code VARCHAR(10) NOT NULL REFERENCES onet_occupations(onet_code) ON DELETE CASCADE,
    technology_name TEXT NOT NULL,
    technology_type TEXT, -- "Software", "Hardware", "Equipment", etc.
    hot_technology BOOLEAN DEFAULT FALSE, -- Is this a "hot" technology?
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE onet_technology_skills IS 'Technology tools, software, and equipment used by each occupation (e.g., POS systems for Cashiers)';
COMMENT ON COLUMN onet_technology_skills.hot_technology IS 'Indicates if this is a rapidly growing/important technology';

-- O*NET Detailed Activities (Granular work activities)
CREATE TABLE IF NOT EXISTS onet_detailed_activities (
    activity_id VARCHAR(20) PRIMARY KEY, -- O*NET element ID
    name TEXT NOT NULL,
    category TEXT, -- Category like "Getting Information", "Processing Information"
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE onet_detailed_activities IS 'Granular work activities (e.g., "Selling or Influencing Others", "Performing for or Working Directly with the Public")';

-- O*NET Occupation-Activities Mapping (Many-to-many with importance scores)
CREATE TABLE IF NOT EXISTS onet_occupation_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onet_code VARCHAR(10) NOT NULL REFERENCES onet_occupations(onet_code) ON DELETE CASCADE,
    activity_id VARCHAR(20) NOT NULL REFERENCES onet_detailed_activities(activity_id) ON DELETE CASCADE,
    importance DECIMAL(5,2), -- Importance score 0-100
    level DECIMAL(5,2), -- Required level 0-7
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(onet_code, activity_id)
);

COMMENT ON TABLE onet_occupation_activities IS 'Many-to-many mapping of occupations to detailed activities with importance/level scores';

-- =====================================================
-- TIER 2: ENHANCED FEATURES TABLES
-- =====================================================

-- O*NET Abilities (52 cognitive/physical/sensory abilities)
CREATE TABLE IF NOT EXISTS onet_abilities (
    ability_id VARCHAR(20) PRIMARY KEY, -- O*NET element ID
    name TEXT NOT NULL,
    category TEXT, -- "Cognitive Abilities", "Physical Abilities", "Psychomotor Abilities"
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE onet_abilities IS 'Master list of 52 O*NET abilities (e.g., Oral Comprehension, Manual Dexterity)';

-- O*NET Occupation-Abilities Mapping (Many-to-many with importance scores)
CREATE TABLE IF NOT EXISTS onet_occupation_abilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onet_code VARCHAR(10) NOT NULL REFERENCES onet_occupations(onet_code) ON DELETE CASCADE,
    ability_id VARCHAR(20) NOT NULL REFERENCES onet_abilities(ability_id) ON DELETE CASCADE,
    importance DECIMAL(5,2), -- Importance score 0-100
    level DECIMAL(5,2), -- Required level 0-7
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(onet_code, ability_id)
);

COMMENT ON TABLE onet_occupation_abilities IS 'Many-to-many mapping of occupations to abilities with importance/level scores';

-- O*NET Work Context (Physical work environment data)
CREATE TABLE IF NOT EXISTS onet_work_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onet_code VARCHAR(10) NOT NULL REFERENCES onet_occupations(onet_code) ON DELETE CASCADE,
    context_category TEXT NOT NULL, -- "Physical Demands", "Work Environment", etc.
    context_item TEXT NOT NULL, -- "Standing", "Exposed to Hazardous Conditions", etc.
    percentage DECIMAL(5,2), -- Percentage of time (0-100)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE onet_work_context IS 'Physical work environment data (% standing, exposure to hazards, etc.)';
COMMENT ON COLUMN onet_work_context.percentage IS 'Percentage of time this context applies (0-100)';

-- O*NET Education Requirements
CREATE TABLE IF NOT EXISTS onet_education (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onet_code VARCHAR(10) NOT NULL REFERENCES onet_occupations(onet_code) ON DELETE CASCADE,
    education_level TEXT, -- "High School Diploma", "Associate's Degree", "Bachelor's Degree", etc.
    required BOOLEAN DEFAULT FALSE, -- Is this level required or typical?
    percentage DECIMAL(5,2), -- Percentage of workers with this level
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE onet_education IS 'Education requirements and typical education levels for occupations';

-- O*NET Licensing (Required licenses/certifications)
CREATE TABLE IF NOT EXISTS onet_licensing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onet_code VARCHAR(10) NOT NULL REFERENCES onet_occupations(onet_code) ON DELETE CASCADE,
    license_name TEXT NOT NULL,
    license_type TEXT, -- "License", "Certification", "Registration"
    required BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE onet_licensing IS 'Required licenses, certifications, and registrations for occupations';

-- =====================================================
-- CONTENT TAGGING TABLES (Connect Trike content to O*NET)
-- =====================================================

-- Content-Occupations Mapping (Link tracks/articles to occupations)
CREATE TABLE IF NOT EXISTS content_occupations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL, -- References tracks.id or kb_articles.id
    content_type TEXT NOT NULL CHECK (content_type IN ('track', 'article')),
    onet_code VARCHAR(10) NOT NULL REFERENCES onet_occupations(onet_code) ON DELETE CASCADE,
    relevance_score DECIMAL(5,2) DEFAULT 50, -- Relevance score 0-100
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(content_id, content_type, onet_code)
);

COMMENT ON TABLE content_occupations IS 'Links Trike content (tracks/articles) to O*NET occupations for skills-based recommendations';
COMMENT ON COLUMN content_occupations.relevance_score IS 'Relevance score 0-100 indicating how relevant this content is to the occupation';

-- Content-Skills Mapping (Link tracks/articles to skills)
CREATE TABLE IF NOT EXISTS content_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('track', 'article')),
    skill_id VARCHAR(20) NOT NULL REFERENCES onet_skills(skill_id) ON DELETE CASCADE,
    relevance_score DECIMAL(5,2) DEFAULT 50,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(content_id, content_type, skill_id)
);

COMMENT ON TABLE content_skills IS 'Links Trike content to O*NET skills for skills-based content discovery';

-- Content-Knowledge Mapping (Link tracks/articles to knowledge areas)
CREATE TABLE IF NOT EXISTS content_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('track', 'article')),
    knowledge_id VARCHAR(20) NOT NULL REFERENCES onet_knowledge(knowledge_id) ON DELETE CASCADE,
    relevance_score DECIMAL(5,2) DEFAULT 50,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(content_id, content_type, knowledge_id)
);

COMMENT ON TABLE content_knowledge IS 'Links Trike content to O*NET knowledge areas for skills-based content discovery';

-- Content-Tasks Mapping (Link tracks/articles to specific tasks)
CREATE TABLE IF NOT EXISTS content_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('track', 'article')),
    task_id UUID NOT NULL REFERENCES onet_tasks(id) ON DELETE CASCADE,
    relevance_score DECIMAL(5,2) DEFAULT 50,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(content_id, content_type, task_id)
);

COMMENT ON TABLE content_tasks IS 'Links Trike content to specific O*NET tasks for granular skills-based recommendations';

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- O*NET Occupations indexes
CREATE INDEX IF NOT EXISTS idx_onet_occupations_title ON onet_occupations(title);
CREATE INDEX IF NOT EXISTS idx_onet_occupations_job_zone ON onet_occupations(job_zone);

-- O*NET Tasks indexes
CREATE INDEX IF NOT EXISTS idx_onet_tasks_onet_code ON onet_tasks(onet_code);
CREATE INDEX IF NOT EXISTS idx_onet_tasks_onet_code_order ON onet_tasks(onet_code, task_order);

-- O*NET Skills indexes
CREATE INDEX IF NOT EXISTS idx_onet_skills_category ON onet_skills(category);
CREATE INDEX IF NOT EXISTS idx_onet_skills_name ON onet_skills(name);

-- O*NET Occupation-Skills indexes
CREATE INDEX IF NOT EXISTS idx_onet_occupation_skills_onet_code ON onet_occupation_skills(onet_code);
CREATE INDEX IF NOT EXISTS idx_onet_occupation_skills_skill_id ON onet_occupation_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_onet_occupation_skills_importance ON onet_occupation_skills(onet_code, importance DESC);

-- O*NET Knowledge indexes
CREATE INDEX IF NOT EXISTS idx_onet_knowledge_category ON onet_knowledge(category);
CREATE INDEX IF NOT EXISTS idx_onet_knowledge_name ON onet_knowledge(name);

-- O*NET Occupation-Knowledge indexes
CREATE INDEX IF NOT EXISTS idx_onet_occupation_knowledge_onet_code ON onet_occupation_knowledge(onet_code);
CREATE INDEX IF NOT EXISTS idx_onet_occupation_knowledge_knowledge_id ON onet_occupation_knowledge(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_onet_occupation_knowledge_importance ON onet_occupation_knowledge(onet_code, importance DESC);

-- O*NET Technology Skills indexes
CREATE INDEX IF NOT EXISTS idx_onet_technology_skills_onet_code ON onet_technology_skills(onet_code);
CREATE INDEX IF NOT EXISTS idx_onet_technology_skills_type ON onet_technology_skills(technology_type);
CREATE INDEX IF NOT EXISTS idx_onet_technology_skills_hot ON onet_technology_skills(hot_technology) WHERE hot_technology = TRUE;

-- O*NET Activities indexes
CREATE INDEX IF NOT EXISTS idx_onet_activities_category ON onet_detailed_activities(category);
CREATE INDEX IF NOT EXISTS idx_onet_occupation_activities_onet_code ON onet_occupation_activities(onet_code);
CREATE INDEX IF NOT EXISTS idx_onet_occupation_activities_activity_id ON onet_occupation_activities(activity_id);

-- O*NET Abilities indexes
CREATE INDEX IF NOT EXISTS idx_onet_abilities_category ON onet_abilities(category);
CREATE INDEX IF NOT EXISTS idx_onet_occupation_abilities_onet_code ON onet_occupation_abilities(onet_code);
CREATE INDEX IF NOT EXISTS idx_onet_occupation_abilities_ability_id ON onet_occupation_abilities(ability_id);

-- O*NET Work Context indexes
CREATE INDEX IF NOT EXISTS idx_onet_work_context_onet_code ON onet_work_context(onet_code);
CREATE INDEX IF NOT EXISTS idx_onet_work_context_category ON onet_work_context(context_category);

-- O*NET Education indexes
CREATE INDEX IF NOT EXISTS idx_onet_education_onet_code ON onet_education(onet_code);
CREATE INDEX IF NOT EXISTS idx_onet_education_level ON onet_education(education_level);

-- O*NET Licensing indexes
CREATE INDEX IF NOT EXISTS idx_onet_licensing_onet_code ON onet_licensing(onet_code);
CREATE INDEX IF NOT EXISTS idx_onet_licensing_type ON onet_licensing(license_type);

-- Content tagging indexes
CREATE INDEX IF NOT EXISTS idx_content_occupations_content ON content_occupations(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_occupations_onet_code ON content_occupations(onet_code);
CREATE INDEX IF NOT EXISTS idx_content_skills_content ON content_skills(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_skills_skill_id ON content_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_content_knowledge_content ON content_knowledge(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_knowledge_knowledge_id ON content_knowledge(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_content_tasks_content ON content_tasks(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_tasks_task_id ON content_tasks(task_id);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_onet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_onet_occupations_updated_at BEFORE UPDATE ON onet_occupations FOR EACH ROW EXECUTE FUNCTION update_onet_updated_at();
CREATE TRIGGER update_onet_tasks_updated_at BEFORE UPDATE ON onet_tasks FOR EACH ROW EXECUTE FUNCTION update_onet_updated_at();
CREATE TRIGGER update_onet_skills_updated_at BEFORE UPDATE ON onet_skills FOR EACH ROW EXECUTE FUNCTION update_onet_updated_at();
CREATE TRIGGER update_onet_occupation_skills_updated_at BEFORE UPDATE ON onet_occupation_skills FOR EACH ROW EXECUTE FUNCTION update_onet_updated_at();
CREATE TRIGGER update_onet_knowledge_updated_at BEFORE UPDATE ON onet_knowledge FOR EACH ROW EXECUTE FUNCTION update_onet_updated_at();
CREATE TRIGGER update_onet_occupation_knowledge_updated_at BEFORE UPDATE ON onet_occupation_knowledge FOR EACH ROW EXECUTE FUNCTION update_onet_updated_at();
CREATE TRIGGER update_onet_technology_skills_updated_at BEFORE UPDATE ON onet_technology_skills FOR EACH ROW EXECUTE FUNCTION update_onet_updated_at();
CREATE TRIGGER update_onet_detailed_activities_updated_at BEFORE UPDATE ON onet_detailed_activities FOR EACH ROW EXECUTE FUNCTION update_onet_updated_at();
CREATE TRIGGER update_onet_occupation_activities_updated_at BEFORE UPDATE ON onet_occupation_activities FOR EACH ROW EXECUTE FUNCTION update_onet_updated_at();
CREATE TRIGGER update_onet_abilities_updated_at BEFORE UPDATE ON onet_abilities FOR EACH ROW EXECUTE FUNCTION update_onet_updated_at();
CREATE TRIGGER update_onet_occupation_abilities_updated_at BEFORE UPDATE ON onet_occupation_abilities FOR EACH ROW EXECUTE FUNCTION update_onet_updated_at();
CREATE TRIGGER update_onet_work_context_updated_at BEFORE UPDATE ON onet_work_context FOR EACH ROW EXECUTE FUNCTION update_onet_updated_at();
CREATE TRIGGER update_onet_education_updated_at BEFORE UPDATE ON onet_education FOR EACH ROW EXECUTE FUNCTION update_onet_updated_at();
CREATE TRIGGER update_onet_licensing_updated_at BEFORE UPDATE ON onet_licensing FOR EACH ROW EXECUTE FUNCTION update_onet_updated_at();
CREATE TRIGGER update_content_occupations_updated_at BEFORE UPDATE ON content_occupations FOR EACH ROW EXECUTE FUNCTION update_onet_updated_at();
CREATE TRIGGER update_content_skills_updated_at BEFORE UPDATE ON content_skills FOR EACH ROW EXECUTE FUNCTION update_onet_updated_at();
CREATE TRIGGER update_content_knowledge_updated_at BEFORE UPDATE ON content_knowledge FOR EACH ROW EXECUTE FUNCTION update_onet_updated_at();
CREATE TRIGGER update_content_tasks_updated_at BEFORE UPDATE ON content_tasks FOR EACH ROW EXECUTE FUNCTION update_onet_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all O*NET tables
ALTER TABLE onet_occupations ENABLE ROW LEVEL SECURITY;
ALTER TABLE onet_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE onet_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE onet_occupation_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE onet_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE onet_occupation_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE onet_technology_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE onet_detailed_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE onet_occupation_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE onet_abilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE onet_occupation_abilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE onet_work_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE onet_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE onet_licensing ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_occupations ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_tasks ENABLE ROW LEVEL SECURITY;

-- O*NET reference data: All authenticated users can read
-- Only authenticated users can modify (for sync functions)

-- O*NET Occupations
CREATE POLICY "Authenticated users can read onet_occupations"
    ON onet_occupations FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage onet_occupations"
    ON onet_occupations FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- O*NET Tasks
CREATE POLICY "Authenticated users can read onet_tasks"
    ON onet_tasks FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage onet_tasks"
    ON onet_tasks FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- O*NET Skills
CREATE POLICY "Authenticated users can read onet_skills"
    ON onet_skills FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage onet_skills"
    ON onet_skills FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- O*NET Occupation-Skills
CREATE POLICY "Authenticated users can read onet_occupation_skills"
    ON onet_occupation_skills FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage onet_occupation_skills"
    ON onet_occupation_skills FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- O*NET Knowledge
CREATE POLICY "Authenticated users can read onet_knowledge"
    ON onet_knowledge FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage onet_knowledge"
    ON onet_knowledge FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- O*NET Occupation-Knowledge
CREATE POLICY "Authenticated users can read onet_occupation_knowledge"
    ON onet_occupation_knowledge FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage onet_occupation_knowledge"
    ON onet_occupation_knowledge FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- O*NET Technology Skills
CREATE POLICY "Authenticated users can read onet_technology_skills"
    ON onet_technology_skills FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage onet_technology_skills"
    ON onet_technology_skills FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- O*NET Detailed Activities
CREATE POLICY "Authenticated users can read onet_detailed_activities"
    ON onet_detailed_activities FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage onet_detailed_activities"
    ON onet_detailed_activities FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- O*NET Occupation-Activities
CREATE POLICY "Authenticated users can read onet_occupation_activities"
    ON onet_occupation_activities FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage onet_occupation_activities"
    ON onet_occupation_activities FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- O*NET Abilities
CREATE POLICY "Authenticated users can read onet_abilities"
    ON onet_abilities FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage onet_abilities"
    ON onet_abilities FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- O*NET Occupation-Abilities
CREATE POLICY "Authenticated users can read onet_occupation_abilities"
    ON onet_occupation_abilities FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage onet_occupation_abilities"
    ON onet_occupation_abilities FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- O*NET Work Context
CREATE POLICY "Authenticated users can read onet_work_context"
    ON onet_work_context FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage onet_work_context"
    ON onet_work_context FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- O*NET Education
CREATE POLICY "Authenticated users can read onet_education"
    ON onet_education FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage onet_education"
    ON onet_education FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- O*NET Licensing
CREATE POLICY "Authenticated users can read onet_licensing"
    ON onet_licensing FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage onet_licensing"
    ON onet_licensing FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Content tagging tables: Allow authenticated users to manage
-- Note: Organization scoping should be enforced at the application level
-- since we can't safely reference tracks/kb_articles tables here (they may not exist yet)

-- Content-Occupations
CREATE POLICY "Authenticated users can read content_occupations"
    ON content_occupations FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage content_occupations"
    ON content_occupations FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Content-Skills
CREATE POLICY "Authenticated users can read content_skills"
    ON content_skills FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage content_skills"
    ON content_skills FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Content-Knowledge
CREATE POLICY "Authenticated users can read content_knowledge"
    ON content_knowledge FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage content_knowledge"
    ON content_knowledge FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Content-Tasks
CREATE POLICY "Authenticated users can read content_tasks"
    ON content_tasks FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage content_tasks"
    ON content_tasks FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- =====================================================
-- COMPLETION
-- =====================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

