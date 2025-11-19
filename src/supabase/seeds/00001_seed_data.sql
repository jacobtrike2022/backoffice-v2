-- =====================================================
-- TRIKE BACKOFFICE - SEED DATA
-- =====================================================
-- Sample data for development and testing
-- Corresponds to all CRUD functions and converted components
-- Last Updated: 2025-11-19
-- =====================================================

-- Clear existing data (in reverse dependency order)
TRUNCATE TABLE 
    activity_logs,
    notifications,
    kb_attachments,
    kb_articles,
    kb_categories,
    form_submissions,
    form_blocks,
    forms,
    user_certifications,
    certifications,
    user_progress,
    assignments,
    playlist_tracks,
    playlist_albums,
    playlists,
    album_tracks,
    albums,
    tracks,
    users,
    roles,
    stores,
    districts,
    organizations
CASCADE;

-- =====================================================
-- ORGANIZATIONS
-- =====================================================

INSERT INTO organizations (id, name, subdomain, settings) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Trike Convenience Stores', 'trike', 
     '{"theme": "orange", "timezone": "America/New_York", "features": ["lms", "forms", "kb"]}'::jsonb);

-- =====================================================
-- DISTRICTS
-- =====================================================

INSERT INTO districts (id, organization_id, name, code) VALUES
    ('22222222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Northeast District', 'NE'),
    ('22222222-2222-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Southeast District', 'SE'),
    ('22222222-3333-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Midwest District', 'MW'),
    ('22222222-4444-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Western District', 'WE');

-- =====================================================
-- STORES
-- =====================================================

INSERT INTO stores (id, organization_id, district_id, name, code, address, city, state, zip, is_active) VALUES
    -- Northeast District
    ('33333333-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-1111-1111-1111-111111111111', 'Manhattan Store #101', 'NYC-101', '123 Broadway', 'New York', 'NY', '10001', true),
    ('33333333-1112-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-1111-1111-1111-111111111111', 'Brooklyn Store #102', 'NYC-102', '456 Bedford Ave', 'Brooklyn', 'NY', '11211', true),
    ('33333333-1113-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-1111-1111-1111-111111111111', 'Boston Store #103', 'BOS-103', '789 Commonwealth Ave', 'Boston', 'MA', '02215', true),
    
    -- Southeast District
    ('33333333-2111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-2222-1111-1111-111111111111', 'Miami Store #201', 'MIA-201', '321 Ocean Drive', 'Miami', 'FL', '33139', true),
    ('33333333-2112-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-2222-1111-1111-111111111111', 'Atlanta Store #202', 'ATL-202', '654 Peachtree St', 'Atlanta', 'GA', '30308', true),
    
    -- Midwest District
    ('33333333-3111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-3333-1111-1111-111111111111', 'Chicago Store #301', 'CHI-301', '987 Michigan Ave', 'Chicago', 'IL', '60611', true),
    ('33333333-3112-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-3333-1111-1111-111111111111', 'Detroit Store #302', 'DET-302', '147 Woodward Ave', 'Detroit', 'MI', '48226', true),
    
    -- Western District
    ('33333333-4111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-4444-1111-1111-111111111111', 'Los Angeles Store #401', 'LAX-401', '258 Hollywood Blvd', 'Los Angeles', 'CA', '90028', true),
    ('33333333-4112-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-4444-1111-1111-111111111111', 'San Francisco Store #402', 'SFO-402', '369 Market St', 'San Francisco', 'CA', '94102', true);

-- =====================================================
-- ROLES
-- =====================================================

INSERT INTO roles (id, organization_id, name, description, level, permissions) VALUES
    ('44444444-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Admin', 'Full system access', 3, 
     '["all"]'::jsonb),
    ('44444444-2222-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'District Manager', 'Manage district stores and staff', 2, 
     '["view_all_stores", "manage_store_managers", "view_reports"]'::jsonb),
    ('44444444-3333-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Store Manager', 'Manage single store', 1, 
     '["view_store", "manage_employees", "assign_training"]'::jsonb),
    ('44444444-4444-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Customer Service Representative', 'Frontline employee', 0, 
     '["view_training", "complete_training", "view_schedule"]'::jsonb),
    ('44444444-5555-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Shift Lead', 'Team lead during shifts', 0, 
     '["view_training", "complete_training", "view_schedule", "manage_shift"]'::jsonb);

-- =====================================================
-- USERS
-- =====================================================

INSERT INTO users (id, organization_id, role_id, store_id, first_name, last_name, email, phone, employee_id, hire_date, status) VALUES
    -- Admin
    ('55555555-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '44444444-1111-1111-1111-111111111111', NULL, 
     'Sarah', 'Johnson', 'sarah.johnson@trike.com', '555-0101', 'EMP-001', '2020-01-15', 'active'),
    
    -- District Managers
    ('55555555-2111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '44444444-2222-1111-1111-111111111111', NULL, 
     'Michael', 'Chen', 'michael.chen@trike.com', '555-0201', 'EMP-101', '2020-03-20', 'active'),
    ('55555555-2211-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '44444444-2222-1111-1111-111111111111', NULL, 
     'Lisa', 'Rodriguez', 'lisa.rodriguez@trike.com', '555-0202', 'EMP-102', '2020-04-10', 'active'),
    
    -- Store Managers
    ('55555555-3111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '44444444-3333-1111-1111-111111111111', '33333333-1111-1111-1111-111111111111', 
     'David', 'Thompson', 'david.thompson@trike.com', '555-1001', 'EMP-1001', '2021-01-05', 'active'),
    ('55555555-3112-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '44444444-3333-1111-1111-111111111111', '33333333-1112-1111-1111-111111111111', 
     'Emily', 'Martinez', 'emily.martinez@trike.com', '555-1002', 'EMP-1002', '2021-02-15', 'active'),
    ('55555555-3211-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '44444444-3333-1111-1111-111111111111', '33333333-2111-1111-1111-111111111111', 
     'James', 'Wilson', 'james.wilson@trike.com', '555-2001', 'EMP-2001', '2021-03-01', 'active'),
    
    -- CSRs and Employees
    ('55555555-4111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '44444444-4444-1111-1111-111111111111', '33333333-1111-1111-1111-111111111111', 
     'Jessica', 'Davis', 'jessica.davis@trike.com', '555-1101', 'EMP-1101', '2024-01-15', 'active'),
    ('55555555-4112-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '44444444-4444-1111-1111-111111111111', '33333333-1111-1111-1111-111111111111', 
     'Robert', 'Brown', 'robert.brown@trike.com', '555-1102', 'EMP-1102', '2024-02-01', 'active'),
    ('55555555-4113-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '44444444-5555-1111-1111-111111111111', '33333333-1111-1111-1111-111111111111', 
     'Amanda', 'Garcia', 'amanda.garcia@trike.com', '555-1103', 'EMP-1103', '2023-06-10', 'active'),
    ('55555555-4211-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '44444444-4444-1111-1111-111111111111', '33333333-1112-1111-1111-111111111111', 
     'Daniel', 'Lee', 'daniel.lee@trike.com', '555-1201', 'EMP-1201', '2024-01-20', 'active'),
    ('55555555-4212-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '44444444-4444-1111-1111-111111111111', '33333333-1112-1111-1111-111111111111', 
     'Maria', 'Lopez', 'maria.lopez@trike.com', '555-1202', 'EMP-1202', '2024-02-15', 'active');

-- Update district/store managers
UPDATE districts SET manager_id = '55555555-2111-1111-1111-111111111111' WHERE id = '22222222-1111-1111-1111-111111111111';
UPDATE districts SET manager_id = '55555555-2211-1111-1111-111111111111' WHERE id = '22222222-2222-1111-1111-111111111111';

UPDATE stores SET manager_id = '55555555-3111-1111-1111-111111111111' WHERE id = '33333333-1111-1111-1111-111111111111';
UPDATE stores SET manager_id = '55555555-3112-1111-1111-111111111111' WHERE id = '33333333-1112-1111-1111-111111111111';
UPDATE stores SET manager_id = '55555555-3211-1111-1111-111111111111' WHERE id = '33333333-2111-1111-1111-111111111111';

-- =====================================================
-- TRACKS
-- =====================================================

INSERT INTO tracks (id, organization_id, title, description, type, content_url, thumbnail_url, duration_minutes, status, learning_objectives, tags, published_at, published_by, created_by, view_count) VALUES
    ('66666666-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'Food Safety Fundamentals', 
     'Comprehensive guide to food safety practices and procedures in restaurant operations', 
     'video', 
     'https://example.com/videos/food-safety.mp4',
     'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400',
     12, 
     'published',
     ARRAY['Understand proper handwashing techniques', 'Identify critical food safety temperatures', 'Recognize signs of contamination'],
     ARRAY['food-safety', 'compliance', 'required', 'certification'],
     NOW() - INTERVAL '30 days',
     '55555555-1111-1111-1111-111111111111',
     '55555555-1111-1111-1111-111111111111',
     1247),
    
    ('66666666-1112-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'Customer Service Excellence', 
     'Master the art of exceptional customer service and create memorable experiences', 
     'video', 
     'https://example.com/videos/customer-service.mp4',
     'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=400',
     9, 
     'published',
     ARRAY['Apply active listening techniques', 'Handle complaints professionally', 'Use positive language'],
     ARRAY['customer-service', 'soft-skills', 'communication'],
     NOW() - INTERVAL '25 days',
     '55555555-1111-1111-1111-111111111111',
     '55555555-1111-1111-1111-111111111111',
     892),
    
    ('66666666-1113-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'Opening Procedures Checklist', 
     'Interactive step-by-step guide for morning opening procedures', 
     'story', 
     'https://example.com/stories/opening-procedures',
     'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400',
     5, 
     'published',
     ARRAY['Complete safety checks', 'Prepare workstations', 'Verify equipment'],
     ARRAY['procedures', 'opening', 'checklist', 'daily-operations'],
     NOW() - INTERVAL '20 days',
     '55555555-1111-1111-1111-111111111111',
     '55555555-1111-1111-1111-111111111111',
     654),
    
    ('66666666-1114-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'Allergen Awareness Guide', 
     'Critical information about food allergens and safe handling practices', 
     'article', 
     'https://example.com/articles/allergen-awareness',
     'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400',
     10, 
     'published',
     ARRAY['Identify major food allergens', 'Implement cross-contact prevention', 'Communicate allergen info'],
     ARRAY['allergen', 'food-safety', 'compliance', 'required'],
     NOW() - INTERVAL '18 days',
     '55555555-1111-1111-1111-111111111111',
     '55555555-1111-1111-1111-111111111111',
     1105),
    
    ('66666666-1115-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'Cash Handling Best Practices', 
     'Secure procedures for managing cash transactions and register operations', 
     'video', 
     'https://example.com/videos/cash-handling.mp4',
     'https://images.unsplash.com/photo-1753797782254-4ef6719c7bcd?w=400',
     6, 
     'published',
     ARRAY['Perform accurate cash counts', 'Identify counterfeit currency', 'Follow security procedures'],
     ARRAY['cash-handling', 'security', 'procedures', 'compliance'],
     NOW() - INTERVAL '15 days',
     '55555555-1111-1111-1111-111111111111',
     '55555555-1111-1111-1111-111111111111',
     743),
    
    ('66666666-1116-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'Food Safety Quiz', 
     'Test your knowledge of food safety procedures', 
     'checkpoint', 
     NULL,
     'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400',
     15, 
     'published',
     ARRAY['Demonstrate food safety knowledge'],
     ARRAY['assessment', 'food-safety', 'certification'],
     NOW() - INTERVAL '30 days',
     '55555555-1111-1111-1111-111111111111',
     '55555555-1111-1111-1111-111111111111',
     487),
    
    ('66666666-1117-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'Age-Restricted Sales Training', 
     'Compliance training for selling alcohol and tobacco', 
     'video', 
     'https://example.com/videos/age-restricted.mp4',
     'https://images.unsplash.com/photo-1532634922-8fe0b757fb13?w=400',
     12, 
     'published',
     ARRAY['Understand legal requirements', 'Verify customer age', 'Handle refusals professionally'],
     ARRAY['compliance', 'age-verification', 'alcohol', 'tobacco', 'required'],
     NOW() - INTERVAL '10 days',
     '55555555-1111-1111-1111-111111111111',
     '55555555-1111-1111-1111-111111111111',
     1567);

-- =====================================================
-- ALBUMS
-- =====================================================

INSERT INTO albums (id, organization_id, title, description, status, created_by) VALUES
    ('77777777-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'Basic Store Safety', 
     'Essential safety training for all store employees', 
     'published', 
     '55555555-1111-1111-1111-111111111111'),
    
    ('77777777-1112-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'Workplace Standards', 
     'Professional standards and workplace behavior', 
     'published', 
     '55555555-1111-1111-1111-111111111111'),
    
    ('77777777-1113-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'Terminal Operations', 
     'Complete training for register and POS systems', 
     'published', 
     '55555555-1111-1111-1111-111111111111'),
    
    ('77777777-1114-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'Restricted Sales', 
     'Age-restricted product sales and compliance', 
     'published', 
     '55555555-1111-1111-1111-111111111111');

-- =====================================================
-- ALBUM TRACKS
-- =====================================================

INSERT INTO album_tracks (album_id, track_id, display_order, is_required, unlock_previous) VALUES
    -- Basic Store Safety
    ('77777777-1111-1111-1111-111111111111', '66666666-1111-1111-1111-111111111111', 1, true, false),
    ('77777777-1111-1111-1111-111111111111', '66666666-1114-1111-1111-111111111111', 2, true, true),
    ('77777777-1111-1111-1111-111111111111', '66666666-1116-1111-1111-111111111111', 3, true, true),
    
    -- Workplace Standards
    ('77777777-1112-1111-1111-111111111111', '66666666-1112-1111-1111-111111111111', 1, true, false),
    
    -- Terminal Operations
    ('77777777-1113-1111-1111-111111111111', '66666666-1115-1111-1111-111111111111', 1, true, false),
    ('77777777-1113-1111-1111-111111111111', '66666666-1113-1111-1111-111111111111', 2, true, true),
    
    -- Restricted Sales
    ('77777777-1114-1111-1111-1111-111111111111', '66666666-1117-1111-1111-111111111111', 1, true, false);

-- =====================================================
-- PLAYLISTS
-- =====================================================

INSERT INTO playlists (id, organization_id, title, description, type, trigger_rules, release_type, is_active, created_by) VALUES
    ('88888888-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'First Week Orientation', 
     'Complete onboarding program for all new hires', 
     'auto',
     '{"role_ids": ["44444444-4444-1111-1111-111111111111", "44444444-5555-1111-1111-111111111111"], "hire_days": 7}'::jsonb,
     'progressive',
     true,
     '55555555-1111-1111-1111-111111111111'),
    
    ('88888888-1112-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'Manager Leadership Academy', 
     'Leadership development for store managers', 
     'manual',
     NULL,
     'immediate',
     true,
     '55555555-1111-1111-1111-111111111111'),
    
    ('88888888-1113-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'Food Handler Certification', 
     'Required food safety certification program', 
     'auto',
     '{"role_ids": ["44444444-4444-1111-1111-111111111111"], "hire_days": 3}'::jsonb,
     'immediate',
     true,
     '55555555-1111-1111-1111-111111111111');

-- =====================================================
-- PLAYLIST ALBUMS
-- =====================================================

INSERT INTO playlist_albums (playlist_id, album_id, display_order, release_stage) VALUES
    -- First Week Orientation
    ('88888888-1111-1111-1111-111111111111', '77777777-1111-1111-1111-111111111111', 1, 1),
    ('88888888-1111-1111-1111-111111111111', '77777777-1112-1111-1111-111111111111', 2, 1),
    ('88888888-1111-1111-1111-111111111111', '77777777-1113-1111-1111-111111111111', 3, 2),
    
    -- Manager Leadership Academy
    ('88888888-1112-1111-1111-111111111111', '77777777-1112-1111-1111-111111111111', 1, 1),
    
    -- Food Handler Certification
    ('88888888-1113-1111-1111-111111111111', '77777777-1111-1111-1111-111111111111', 1, 1),
    ('88888888-1113-1111-1111-111111111111', '77777777-1114-1111-1111-1111-111111111111', 2, 1);

-- =====================================================
-- ASSIGNMENTS
-- =====================================================

INSERT INTO assignments (id, organization_id, user_id, playlist_id, assigned_by, due_date, status, progress_percent, started_at) VALUES
    ('99999999-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     '55555555-4111-1111-1111-111111111111', '88888888-1111-1111-1111-111111111111', 
     '55555555-3111-1111-1111-111111111111', NOW() + INTERVAL '7 days', 'in_progress', 45, NOW() - INTERVAL '2 days'),
    
    ('99999999-1112-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     '55555555-4112-1111-1111-111111111111', '88888888-1111-1111-1111-111111111111', 
     '55555555-3111-1111-1111-111111111111', NOW() + INTERVAL '5 days', 'assigned', 0, NULL),
    
    ('99999999-1113-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     '55555555-4113-1111-1111-111111111111', '88888888-1112-1111-1111-111111111111', 
     '55555555-1111-1111-1111-111111111111', NOW() + INTERVAL '30 days', 'in_progress', 25, NOW() - INTERVAL '5 days');

-- =====================================================
-- USER PROGRESS
-- =====================================================

INSERT INTO user_progress (id, organization_id, user_id, assignment_id, track_id, status, progress_percent, started_at, completed_at, attempts, score, passed) VALUES
    -- Jessica Davis progress
    ('aaaaaaaa-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     '55555555-4111-1111-1111-111111111111', '99999999-1111-1111-1111-111111111111', '66666666-1111-1111-1111-111111111111', 
     'completed', 100, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 0, NULL, NULL),
    
    ('aaaaaaaa-1112-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     '55555555-4111-1111-1111-111111111111', '99999999-1111-1111-1111-111111111111', '66666666-1114-1111-1111-111111111111', 
     'completed', 100, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 0, NULL, NULL),
    
    ('aaaaaaaa-1113-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     '55555555-4111-1111-1111-111111111111', '99999999-1111-1111-1111-111111111111', '66666666-1116-1111-1111-111111111111', 
     'in_progress', 50, NOW() - INTERVAL '1 hour', NULL, 1, 75, false),
    
    -- Amanda Garcia progress
    ('aaaaaaaa-1211-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     '55555555-4113-1111-1111-111111111111', '99999999-1113-1111-1111-111111111111', '66666666-1112-1111-1111-111111111111', 
     'completed', 100, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', 0, NULL, NULL);

-- =====================================================
-- CERTIFICATIONS
-- =====================================================

INSERT INTO certifications (id, organization_id, name, description, required_track_ids, expires_after_days, is_active, created_by) VALUES
    ('bbbbbbbb-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'Food Handler Certificate', 
     'Required certification for all employees handling food', 
     ARRAY['66666666-1111-1111-1111-111111111111', '66666666-1114-1111-1111-111111111111', '66666666-1116-1111-1111-111111111111']::UUID[],
     365,
     true,
     '55555555-1111-1111-1111-111111111111'),
    
    ('bbbbbbbb-1112-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'Responsible Alcohol Server', 
     'Certification for alcohol sales and service', 
     ARRAY['66666666-1117-1111-1111-111111111111']::UUID[],
     730,
     true,
     '55555555-1111-1111-1111-111111111111');

-- =====================================================
-- FORMS
-- =====================================================

INSERT INTO forms (id, organization_id, title, description, status, created_by) VALUES
    ('cccccccc-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'New Hire Information Form', 
     'Collect essential information from new employees', 
     'published', 
     '55555555-1111-1111-1111-111111111111'),
    
    ('cccccccc-1112-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'Training Feedback Survey', 
     'Gather feedback on training effectiveness', 
     'published', 
     '55555555-1111-1111-1111-111111111111');

-- =====================================================
-- FORM BLOCKS
-- =====================================================

INSERT INTO form_blocks (id, form_id, type, label, is_required, display_order) VALUES
    -- New Hire Information Form
    ('dddddddd-1111-1111-1111-111111111111', 'cccccccc-1111-1111-1111-111111111111', 
     'text', 'Emergency Contact Name', true, 1),
    ('dddddddd-1112-1111-1111-111111111111', 'cccccccc-1111-1111-1111-111111111111', 
     'text', 'Emergency Contact Phone', true, 2),
    ('dddddddd-1113-1111-1111-1111-111111111111', 'cccccccc-1111-1111-1111-111111111111', 
     'select', 'T-Shirt Size', false, 3),
    
    -- Training Feedback Survey
    ('dddddddd-2111-1111-1111-111111111111', 'cccccccc-1112-1111-1111-111111111111', 
     'rating', 'How would you rate the training content?', true, 1),
    ('dddddddd-2112-1111-1111-111111111111', 'cccccccc-1112-1111-1111-111111111111', 
     'textarea', 'What did you find most valuable?', false, 2);

-- =====================================================
-- KNOWLEDGE BASE
-- =====================================================

INSERT INTO kb_categories (id, organization_id, name, description, display_order) VALUES
    ('eeeeeeee-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'Store Operations', 'Daily store procedures and operations', 1),
    ('eeeeeeee-1112-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'Employee Resources', 'HR policies, benefits, and resources', 2),
    ('eeeeeeee-1113-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'Technical Support', 'POS and system troubleshooting', 3);

INSERT INTO kb_articles (id, organization_id, category_id, title, content, status, view_count, published_at, published_by, created_by) VALUES
    ('ffffffff-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'eeeeeeee-1111-1111-1111-111111111111',
     'How to Clock In/Out', 
     'Step-by-step instructions for using the time clock system...', 
     'published', 234, NOW() - INTERVAL '60 days', 
     '55555555-1111-1111-1111-111111111111',
     '55555555-1111-1111-1111-111111111111'),
    
    ('ffffffff-1112-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'eeeeeeee-1112-1111-1111-111111111111',
     'Requesting Time Off', 
     'How to submit time-off requests through the system...', 
     'published', 456, NOW() - INTERVAL '45 days', 
     '55555555-1111-1111-1111-111111111111',
     '55555555-1111-1111-1111-111111111111'),
    
    ('ffffffff-1113-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     'eeeeeeee-1113-1111-1111-111111111111',
     'POS System Troubleshooting', 
     'Common POS issues and how to resolve them...', 
     'published', 189, NOW() - INTERVAL '30 days', 
     '55555555-1111-1111-1111-111111111111',
     '55555555-1111-1111-1111-111111111111');

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

INSERT INTO notifications (id, organization_id, user_id, type, title, message, link_type, link_id, is_read) VALUES
    ('00000000-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     '55555555-4111-1111-1111-111111111111', 'assignment_new', 
     'New Training Assignment', 
     'You have been assigned the "First Week Orientation" playlist', 
     'assignment', '99999999-1111-1111-1111-111111111111', false),
    
    ('00000000-1112-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     '55555555-4111-1111-1111-111111111111', 'assignment_due_soon', 
     'Training Due Soon', 
     'Your "First Week Orientation" is due in 3 days', 
     'assignment', '99999999-1111-1111-1111-111111111111', false),
    
    ('00000000-1113-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     '55555555-4112-1111-1111-111111111111', 'assignment_new', 
     'New Training Assignment', 
     'You have been assigned the "First Week Orientation" playlist', 
     'assignment', '99999999-1112-1111-1111-111111111111', true);

-- =====================================================
-- ACTIVITY LOGS
-- =====================================================

INSERT INTO activity_logs (id, organization_id, user_id, action, entity_type, entity_id, details) VALUES
    ('11111111-0001-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     '55555555-4111-1111-1111-111111111111', 'track_completed', 'track', '66666666-1111-1111-1111-111111111111',
     '{"track_title": "Food Safety Fundamentals", "time_spent_minutes": 15}'::jsonb),
    
    ('11111111-0002-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     '55555555-3111-1111-1111-111111111111', 'assignment_created', 'assignment', '99999999-1111-1111-1111-111111111111',
     '{"assigned_to": "Jessica Davis", "playlist": "First Week Orientation"}'::jsonb),
    
    ('11111111-0003-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
     '55555555-1111-1111-1111-111111111111', 'user_created', 'user', '55555555-4112-1111-1111-111111111111',
     '{"user_name": "Robert Brown", "role": "CSR"}'::jsonb);

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Seed data loaded successfully!';
    RAISE NOTICE '📊 Summary:';
    RAISE NOTICE '   - 1 Organization';
    RAISE NOTICE '   - 4 Districts';
    RAISE NOTICE '   - 9 Stores';
    RAISE NOTICE '   - 5 Roles';
    RAISE NOTICE '   - 11 Users';
    RAISE NOTICE '   - 7 Tracks';
    RAISE NOTICE '   - 4 Albums';
    RAISE NOTICE '   - 3 Playlists';
    RAISE NOTICE '   - 3 Assignments';
    RAISE NOTICE '   - 4 User Progress Records';
    RAISE NOTICE '   - 2 Certifications';
    RAISE NOTICE '   - 2 Forms';
    RAISE NOTICE '   - 3 KB Categories';
    RAISE NOTICE '   - 3 KB Articles';
    RAISE NOTICE '   - 3 Notifications';
    RAISE NOTICE '   - 3 Activity Logs';
    RAISE NOTICE '';
    RAISE NOTICE '🔑 Test Credentials:';
    RAISE NOTICE '   Admin: sarah.johnson@trike.com';
    RAISE NOTICE '   District Manager: michael.chen@trike.com';
    RAISE NOTICE '   Store Manager: david.thompson@trike.com';
    RAISE NOTICE '   CSR: jessica.davis@trike.com';
END $$;
