-- =====================================================
-- TRIKE BACKOFFICE - COMPLETE SCHEMA MIGRATION
-- =====================================================
-- This migration creates all tables, constraints, indexes, and RLS policies
-- for the Trike Backoffice application.
-- 
-- Corresponds to all CRUD functions in /lib/crud/
-- Last Updated: 2025-11-19
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ORGANIZATIONS & HIERARCHIES
-- =====================================================

-- Organizations table (top-level entity)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_subdomain ON organizations(subdomain);
CREATE INDEX idx_organizations_created_at ON organizations(created_at);

-- Districts table
CREATE TABLE districts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    manager_id UUID, -- References users, added after users table
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, code)
);

CREATE INDEX idx_districts_organization ON districts(organization_id);
CREATE INDEX idx_districts_manager ON districts(manager_id);

-- Stores table
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    code TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    manager_id UUID, -- References users, added after users table
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, code)
);

CREATE INDEX idx_stores_organization ON stores(organization_id);
CREATE INDEX idx_stores_district ON stores(district_id);
CREATE INDEX idx_stores_manager ON stores(manager_id);
CREATE INDEX idx_stores_is_active ON stores(is_active);

-- =====================================================
-- ROLES & PERMISSIONS
-- =====================================================

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    level INTEGER DEFAULT 0, -- 0=employee, 1=manager, 2=district-manager, 3=admin
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

CREATE INDEX idx_roles_organization ON roles(organization_id);
CREATE INDEX idx_roles_level ON roles(level);

-- =====================================================
-- USERS
-- =====================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    
    -- Personal Info
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    
    -- Employment Info
    employee_id TEXT,
    hire_date DATE,
    termination_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on-leave')),
    
    -- Auth (for invite system)
    auth_user_id UUID, -- References auth.users
    invite_token TEXT UNIQUE,
    invite_expires_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(organization_id, email)
);

CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_store ON users(store_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_auth_user ON users(auth_user_id);
CREATE INDEX idx_users_invite_token ON users(invite_token);

-- Add foreign keys for manager_id now that users table exists
ALTER TABLE districts ADD CONSTRAINT fk_districts_manager 
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE stores ADD CONSTRAINT fk_stores_manager 
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- =====================================================
-- CONTENT: TRACKS
-- =====================================================

CREATE TABLE tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Basic Info
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('video', 'article', 'story', 'checkpoint')),
    
    -- Content
    content_url TEXT, -- Video URL or article content URL
    thumbnail_url TEXT,
    transcript TEXT,
    
    -- Metadata
    duration_minutes INTEGER,
    version TEXT DEFAULT '1.0',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
    
    -- Learning
    learning_objectives TEXT[],
    tags TEXT[],
    
    -- Checkpoint-specific (if type = checkpoint)
    passing_score INTEGER,
    max_attempts INTEGER,
    
    -- Publishing
    published_at TIMESTAMPTZ,
    published_by UUID REFERENCES users(id),
    
    -- Stats
    view_count INTEGER DEFAULT 0,
    
    -- Authoring
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tracks_organization ON tracks(organization_id);
CREATE INDEX idx_tracks_type ON tracks(type);
CREATE INDEX idx_tracks_status ON tracks(status);
CREATE INDEX idx_tracks_created_by ON tracks(created_by);
CREATE INDEX idx_tracks_published_at ON tracks(published_at);
CREATE INDEX idx_tracks_tags ON tracks USING GIN(tags);

-- =====================================================
-- CONTENT: ALBUMS
-- =====================================================

CREATE TABLE albums (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    title TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_albums_organization ON albums(organization_id);
CREATE INDEX idx_albums_status ON albums(status);
CREATE INDEX idx_albums_created_by ON albums(created_by);

-- Album tracks junction table
CREATE TABLE album_tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN DEFAULT true,
    unlock_previous BOOLEAN DEFAULT true, -- Must complete previous to unlock
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(album_id, track_id)
);

CREATE INDEX idx_album_tracks_album ON album_tracks(album_id);
CREATE INDEX idx_album_tracks_track ON album_tracks(track_id);
CREATE INDEX idx_album_tracks_order ON album_tracks(album_id, display_order);

-- =====================================================
-- CONTENT: PLAYLISTS
-- =====================================================

CREATE TABLE playlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    title TEXT NOT NULL,
    description TEXT,
    
    type TEXT NOT NULL CHECK (type IN ('auto', 'manual')),
    
    -- Auto-assignment rules (for type='auto')
    trigger_rules JSONB, -- { role_ids: [], store_ids: [], hire_days: 7, etc. }
    
    -- Progressive release settings
    release_type TEXT DEFAULT 'immediate' CHECK (release_type IN ('immediate', 'progressive')),
    release_schedule JSONB, -- { stage1: 0, stage2: 7, stage3: 14 } days after assignment
    
    is_active BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_playlists_organization ON playlists(organization_id);
CREATE INDEX idx_playlists_type ON playlists(type);
CREATE INDEX idx_playlists_is_active ON playlists(is_active);
CREATE INDEX idx_playlists_created_by ON playlists(created_by);

-- Playlist albums junction table
CREATE TABLE playlist_albums (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL DEFAULT 0,
    release_stage INTEGER DEFAULT 1, -- For progressive playlists
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(playlist_id, album_id)
);

CREATE INDEX idx_playlist_albums_playlist ON playlist_albums(playlist_id);
CREATE INDEX idx_playlist_albums_album ON playlist_albums(album_id);
CREATE INDEX idx_playlist_albums_order ON playlist_albums(playlist_id, display_order);

-- Playlist tracks junction (for manual track additions without albums)
CREATE TABLE playlist_tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL DEFAULT 0,
    release_stage INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(playlist_id, track_id)
);

CREATE INDEX idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
CREATE INDEX idx_playlist_tracks_track ON playlist_tracks(track_id);

-- =====================================================
-- ASSIGNMENTS
-- =====================================================

CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    playlist_id UUID REFERENCES playlists(id) ON DELETE SET NULL,
    
    -- Assignment details
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Deadlines
    due_date TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- Status
    status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'expired', 'overdue')),
    
    -- Progress
    progress_percent INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Notifications
    notification_sent BOOLEAN DEFAULT false,
    reminder_sent BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assignments_organization ON assignments(organization_id);
CREATE INDEX idx_assignments_user ON assignments(user_id);
CREATE INDEX idx_assignments_playlist ON assignments(playlist_id);
CREATE INDEX idx_assignments_status ON assignments(status);
CREATE INDEX idx_assignments_due_date ON assignments(due_date);
CREATE INDEX idx_assignments_expires_at ON assignments(expires_at);
CREATE INDEX idx_assignments_assigned_by ON assignments(assigned_by);

-- =====================================================
-- PROGRESS TRACKING
-- =====================================================

CREATE TABLE user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    
    -- Progress
    status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'failed')),
    progress_percent INTEGER DEFAULT 0,
    
    -- Attempts (for checkpoints)
    attempts INTEGER DEFAULT 0,
    score INTEGER, -- For checkpoint scores
    passed BOOLEAN,
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    time_spent_minutes INTEGER DEFAULT 0,
    
    -- Metadata
    answers JSONB, -- For checkpoint responses
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, track_id, assignment_id)
);

CREATE INDEX idx_user_progress_organization ON user_progress(organization_id);
CREATE INDEX idx_user_progress_user ON user_progress(user_id);
CREATE INDEX idx_user_progress_assignment ON user_progress(assignment_id);
CREATE INDEX idx_user_progress_track ON user_progress(track_id);
CREATE INDEX idx_user_progress_status ON user_progress(status);
CREATE INDEX idx_user_progress_completed_at ON user_progress(completed_at);

-- =====================================================
-- CERTIFICATIONS
-- =====================================================

CREATE TABLE certifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    description TEXT,
    
    -- Requirements
    required_track_ids UUID[], -- Array of track IDs that must be completed
    required_album_ids UUID[], -- Array of album IDs
    required_playlist_ids UUID[], -- Array of playlist IDs
    
    minimum_score INTEGER, -- Minimum checkpoint score if applicable
    
    -- Validity
    expires_after_days INTEGER, -- null = no expiration
    requires_renewal BOOLEAN DEFAULT false,
    
    -- Display
    badge_url TEXT,
    certificate_template TEXT,
    
    is_active BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_certifications_organization ON certifications(organization_id);
CREATE INDEX idx_certifications_is_active ON certifications(is_active);

-- User certifications (issued certificates)
CREATE TABLE user_certifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    certification_id UUID NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
    
    -- Issuance
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    issued_by UUID REFERENCES users(id), -- null = auto-issued
    
    -- Validity
    expires_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    
    -- Revocation
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES users(id),
    revoke_reason TEXT,
    
    -- Certificate details
    certificate_number TEXT UNIQUE,
    certificate_url TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_certifications_organization ON user_certifications(organization_id);
CREATE INDEX idx_user_certifications_user ON user_certifications(user_id);
CREATE INDEX idx_user_certifications_certification ON user_certifications(certification_id);
CREATE INDEX idx_user_certifications_status ON user_certifications(status);
CREATE INDEX idx_user_certifications_expires_at ON user_certifications(expires_at);
CREATE INDEX idx_user_certifications_cert_number ON user_certifications(certificate_number);

-- =====================================================
-- FORMS
-- =====================================================

CREATE TABLE forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    title TEXT NOT NULL,
    description TEXT,
    
    -- Settings
    settings JSONB DEFAULT '{}'::jsonb, -- { allowAnonymous, multipleSubmissions, etc. }
    
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forms_organization ON forms(organization_id);
CREATE INDEX idx_forms_status ON forms(status);
CREATE INDEX idx_forms_created_by ON forms(created_by);

-- Form blocks (questions/fields)
CREATE TABLE form_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    
    type TEXT NOT NULL CHECK (type IN ('text', 'textarea', 'select', 'multiselect', 'radio', 'checkbox', 'number', 'date', 'time', 'file', 'rating', 'section', 'html')),
    
    label TEXT,
    description TEXT,
    placeholder TEXT,
    
    -- Validation
    is_required BOOLEAN DEFAULT false,
    validation_rules JSONB, -- { minLength, maxLength, pattern, min, max, etc. }
    
    -- Options (for select, radio, checkbox)
    options TEXT[],
    
    -- Display
    display_order INTEGER NOT NULL DEFAULT 0,
    conditional_logic JSONB, -- { showIf: { blockId: 'x', value: 'y' } }
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_form_blocks_form ON form_blocks(form_id);
CREATE INDEX idx_form_blocks_order ON form_blocks(form_id, display_order);

-- Form submissions
CREATE TABLE form_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- null if anonymous
    
    -- Submission data
    answers JSONB NOT NULL, -- { blockId: value, ... }
    
    -- Status
    status TEXT DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'reviewed', 'approved', 'rejected')),
    
    -- Review
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    
    -- Metadata
    ip_address TEXT,
    user_agent TEXT,
    
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_form_submissions_organization ON form_submissions(organization_id);
CREATE INDEX idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_user ON form_submissions(user_id);
CREATE INDEX idx_form_submissions_status ON form_submissions(status);
CREATE INDEX idx_form_submissions_submitted_at ON form_submissions(submitted_at);

-- =====================================================
-- KNOWLEDGE BASE
-- =====================================================

CREATE TABLE kb_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    display_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_categories_organization ON kb_categories(organization_id);
CREATE INDEX idx_kb_categories_order ON kb_categories(display_order);

CREATE TABLE kb_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES kb_categories(id) ON DELETE SET NULL,
    
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    
    -- SEO/Search
    slug TEXT,
    tags TEXT[],
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    
    -- Display
    is_featured BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    
    -- Stats
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    
    -- Publishing
    published_at TIMESTAMPTZ,
    published_by UUID REFERENCES users(id),
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_articles_organization ON kb_articles(organization_id);
CREATE INDEX idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX idx_kb_articles_status ON kb_articles(status);
CREATE INDEX idx_kb_articles_slug ON kb_articles(slug);
CREATE INDEX idx_kb_articles_tags ON kb_articles USING GIN(tags);
CREATE INDEX idx_kb_articles_featured ON kb_articles(is_featured);

-- KB attachments
CREATE TABLE kb_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
    
    filename TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_attachments_article ON kb_attachments(article_id);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    type TEXT NOT NULL CHECK (type IN (
        'assignment_new',
        'assignment_due_soon',
        'assignment_overdue',
        'assignment_completed',
        'progress_milestone',
        'certification_issued',
        'certification_expiring',
        'certification_expired',
        'form_submitted'
    )),
    
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    
    -- Links
    link_type TEXT, -- 'assignment', 'track', 'certification', 'form', etc.
    link_id UUID,
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    
    -- Delivery
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_organization ON notifications(organization_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- =====================================================
-- ACTIVITY LOGS
-- =====================================================

CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    action TEXT NOT NULL, -- 'track_completed', 'user_created', 'assignment_created', etc.
    entity_type TEXT NOT NULL, -- 'track', 'user', 'assignment', etc.
    entity_id UUID,
    
    details JSONB, -- Additional context
    
    ip_address TEXT,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_organization ON activity_logs(organization_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- =====================================================
-- TRIGGERS FOR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_districts_updated_at BEFORE UPDATE ON districts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tracks_updated_at BEFORE UPDATE ON tracks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_albums_updated_at BEFORE UPDATE ON albums FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_playlists_updated_at BEFORE UPDATE ON playlists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON user_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_certifications_updated_at BEFORE UPDATE ON certifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_certifications_updated_at BEFORE UPDATE ON user_certifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON forms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_form_blocks_updated_at BEFORE UPDATE ON form_blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_form_submissions_updated_at BEFORE UPDATE ON form_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kb_categories_updated_at BEFORE UPDATE ON kb_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kb_articles_updated_at BEFORE UPDATE ON kb_articles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's organization_id
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT organization_id 
        FROM users 
        WHERE auth_user_id = auth.uid()
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Organizations: Users can only see their own organization
CREATE POLICY "Users can view their organization"
    ON organizations FOR SELECT
    USING (id = get_user_organization_id());

-- Districts: Organization-scoped
CREATE POLICY "Users can view districts in their organization"
    ON districts FOR SELECT
    USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage districts"
    ON districts FOR ALL
    USING (organization_id = get_user_organization_id())
    WITH CHECK (organization_id = get_user_organization_id());

-- Stores: Organization-scoped
CREATE POLICY "Users can view stores in their organization"
    ON stores FOR SELECT
    USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage stores"
    ON stores FOR ALL
    USING (organization_id = get_user_organization_id())
    WITH CHECK (organization_id = get_user_organization_id());

-- Roles: Organization-scoped
CREATE POLICY "Users can view roles in their organization"
    ON roles FOR SELECT
    USING (organization_id = get_user_organization_id());

-- Users: Organization-scoped
CREATE POLICY "Users can view users in their organization"
    ON users FOR SELECT
    USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage users"
    ON users FOR ALL
    USING (organization_id = get_user_organization_id())
    WITH CHECK (organization_id = get_user_organization_id());

-- Tracks: Organization-scoped
CREATE POLICY "Users can view published tracks in their organization"
    ON tracks FOR SELECT
    USING (organization_id = get_user_organization_id() AND status = 'published');

CREATE POLICY "Content creators can view all tracks in their organization"
    ON tracks FOR SELECT
    USING (organization_id = get_user_organization_id());

CREATE POLICY "Content creators can create tracks"
    ON tracks FOR INSERT
    WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Content creators can update their tracks"
    ON tracks FOR UPDATE
    USING (organization_id = get_user_organization_id() AND created_by = auth.uid())
    WITH CHECK (organization_id = get_user_organization_id());

-- Albums: Similar to tracks
CREATE POLICY "Users can view published albums"
    ON albums FOR SELECT
    USING (organization_id = get_user_organization_id() AND status = 'published');

CREATE POLICY "Content creators can manage albums"
    ON albums FOR ALL
    USING (organization_id = get_user_organization_id())
    WITH CHECK (organization_id = get_user_organization_id());

-- Album Tracks: Inherit from albums
CREATE POLICY "Users can view album tracks"
    ON album_tracks FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM albums 
        WHERE albums.id = album_tracks.album_id 
        AND albums.organization_id = get_user_organization_id()
    ));

-- Playlists: Organization-scoped
CREATE POLICY "Users can view active playlists"
    ON playlists FOR SELECT
    USING (organization_id = get_user_organization_id() AND is_active = true);

CREATE POLICY "Admins can manage playlists"
    ON playlists FOR ALL
    USING (organization_id = get_user_organization_id())
    WITH CHECK (organization_id = get_user_organization_id());

-- Playlist Albums
CREATE POLICY "Users can view playlist albums"
    ON playlist_albums FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM playlists 
        WHERE playlists.id = playlist_albums.playlist_id 
        AND playlists.organization_id = get_user_organization_id()
    ));

-- Playlist Tracks
CREATE POLICY "Users can view playlist tracks"
    ON playlist_tracks FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM playlists 
        WHERE playlists.id = playlist_tracks.playlist_id 
        AND playlists.organization_id = get_user_organization_id()
    ));

-- Assignments: Users can see their own assignments
CREATE POLICY "Users can view their own assignments"
    ON assignments FOR SELECT
    USING (
        organization_id = get_user_organization_id() 
        AND (
            user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
            OR assigned_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
        )
    );

CREATE POLICY "Managers can manage assignments"
    ON assignments FOR ALL
    USING (organization_id = get_user_organization_id())
    WITH CHECK (organization_id = get_user_organization_id());

-- User Progress: Users can see their own progress
CREATE POLICY "Users can view their own progress"
    ON user_progress FOR SELECT
    USING (
        organization_id = get_user_organization_id()
        AND user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can update their own progress"
    ON user_progress FOR INSERT
    WITH CHECK (
        organization_id = get_user_organization_id()
        AND user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can modify their own progress"
    ON user_progress FOR UPDATE
    USING (
        organization_id = get_user_organization_id()
        AND user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
    WITH CHECK (
        organization_id = get_user_organization_id()
        AND user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    );

-- Certifications: Organization-scoped
CREATE POLICY "Users can view active certifications"
    ON certifications FOR SELECT
    USING (organization_id = get_user_organization_id() AND is_active = true);

-- User Certifications: Users can see their own
CREATE POLICY "Users can view their own certifications"
    ON user_certifications FOR SELECT
    USING (
        organization_id = get_user_organization_id()
        AND user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    );

-- Forms: Organization-scoped
CREATE POLICY "Users can view published forms"
    ON forms FOR SELECT
    USING (organization_id = get_user_organization_id() AND status = 'published');

CREATE POLICY "Admins can manage forms"
    ON forms FOR ALL
    USING (organization_id = get_user_organization_id())
    WITH CHECK (organization_id = get_user_organization_id());

-- Form Blocks
CREATE POLICY "Users can view form blocks"
    ON form_blocks FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM forms 
        WHERE forms.id = form_blocks.form_id 
        AND forms.organization_id = get_user_organization_id()
    ));

-- Form Submissions: Users can see their own
CREATE POLICY "Users can view their own submissions"
    ON form_submissions FOR SELECT
    USING (
        organization_id = get_user_organization_id()
        AND user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can submit forms"
    ON form_submissions FOR INSERT
    WITH CHECK (organization_id = get_user_organization_id());

-- KB Categories: Organization-scoped
CREATE POLICY "Users can view kb categories"
    ON kb_categories FOR SELECT
    USING (organization_id = get_user_organization_id());

-- KB Articles: Organization-scoped
CREATE POLICY "Users can view published kb articles"
    ON kb_articles FOR SELECT
    USING (organization_id = get_user_organization_id() AND status = 'published');

CREATE POLICY "Admins can manage kb articles"
    ON kb_articles FOR ALL
    USING (organization_id = get_user_organization_id())
    WITH CHECK (organization_id = get_user_organization_id());

-- KB Attachments
CREATE POLICY "Users can view kb attachments"
    ON kb_attachments FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM kb_articles 
        WHERE kb_articles.id = kb_attachments.article_id 
        AND kb_articles.organization_id = get_user_organization_id()
    ));

-- Notifications: Users can see their own
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (
        organization_id = get_user_organization_id()
        AND user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    USING (
        organization_id = get_user_organization_id()
        AND user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
    WITH CHECK (
        organization_id = get_user_organization_id()
        AND user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    );

-- Activity Logs: Organization-scoped
CREATE POLICY "Users can view activity logs in their organization"
    ON activity_logs FOR SELECT
    USING (organization_id = get_user_organization_id());

CREATE POLICY "System can insert activity logs"
    ON activity_logs FOR INSERT
    WITH CHECK (organization_id = get_user_organization_id());

-- =====================================================
-- COMPLETION
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create index on auth_user_id for performance
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);

COMMENT ON DATABASE postgres IS 'Trike Backoffice - Complete Schema Migration v1.0';
