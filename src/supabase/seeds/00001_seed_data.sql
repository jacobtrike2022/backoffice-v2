-- =====================================================
-- TRIKE BACKOFFICE - FRESH SEED DATA
-- =====================================================
-- Built from scratch to match 00001_initial_schema.sql
-- No errors, clean dependencies, ready to run
-- =====================================================

-- =====================================================
-- 1. ORGANIZATIONS
-- =====================================================
INSERT INTO organizations (id, name, subdomain, settings, created_at, updated_at) VALUES
('10000000-0000-0000-0000-000000000001', 'Demo Company', 'demo', '{"theme": "light"}', NOW(), NOW());

-- =====================================================
-- 2. DISTRICTS (manager_id will be set later)
-- =====================================================
INSERT INTO districts (id, organization_id, name, code, created_at, updated_at) VALUES
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'North Region', 'NORTH', NOW(), NOW()),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'South Region', 'SOUTH', NOW(), NOW());

-- =====================================================
-- 3. STORES (manager_id will be set later)
-- =====================================================
INSERT INTO stores (id, organization_id, district_id, name, code, address, city, state, zip, is_active, created_at, updated_at) VALUES
('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Store 101', '101', '123 Main St', 'Atlanta', 'GA', '30301', true, NOW(), NOW()),
('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Store 102', '102', '456 Oak Ave', 'Athens', 'GA', '30601', true, NOW(), NOW()),
('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'Store 201', '201', '789 Pine Rd', 'Savannah', 'GA', '31401', true, NOW(), NOW());

-- =====================================================
-- 4. ROLES
-- =====================================================
INSERT INTO roles (id, organization_id, name, description, permissions, level, created_at, updated_at) VALUES
('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Admin', 'Full access', '["all"]', 3, NOW(), NOW()),
('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'District Manager', 'Manage district', '["manage_stores"]', 2, NOW(), NOW()),
('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Store Manager', 'Manage store', '["manage_employees"]', 1, NOW(), NOW()),
('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Employee', 'Basic access', '["view_content"]', 0, NOW(), NOW());

-- =====================================================
-- 5. USERS
-- =====================================================
INSERT INTO users (id, organization_id, role_id, store_id, first_name, last_name, email, phone, employee_id, hire_date, status, created_at, updated_at) VALUES
-- Admin
('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', NULL, 'Sarah', 'Admin', 'sarah@demo.com', '555-0001', 'E001', '2024-01-01', 'active', NOW(), NOW()),
-- District Managers
('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', NULL, 'Mike', 'North', 'mike@demo.com', '555-0002', 'E002', '2024-01-15', 'active', NOW(), NOW()),
('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', NULL, 'Lisa', 'South', 'lisa@demo.com', '555-0003', 'E003', '2024-02-01', 'active', NOW(), NOW()),
-- Store Managers
('50000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'Tom', 'Manager', 'tom@demo.com', '555-0004', 'E004', '2024-03-01', 'active', NOW(), NOW()),
('50000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'Jane', 'Manager', 'jane@demo.com', '555-0005', 'E005', '2024-03-15', 'active', NOW(), NOW()),
('50000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'Bob', 'Manager', 'bob@demo.com', '555-0006', 'E006', '2024-04-01', 'active', NOW(), NOW()),
-- Employees
('50000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'Emily', 'Smith', 'emily@demo.com', '555-0007', 'E007', '2024-05-01', 'active', NOW(), NOW()),
('50000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'James', 'Brown', 'james@demo.com', '555-0008', 'E008', '2024-05-15', 'active', NOW(), NOW());

-- =====================================================
-- 6. UPDATE MANAGERS
-- =====================================================
UPDATE districts SET manager_id = '50000000-0000-0000-0000-000000000002' WHERE id = '20000000-0000-0000-0000-000000000001';
UPDATE districts SET manager_id = '50000000-0000-0000-0000-000000000003' WHERE id = '20000000-0000-0000-0000-000000000002';

UPDATE stores SET manager_id = '50000000-0000-0000-0000-000000000004' WHERE id = '30000000-0000-0000-0000-000000000001';
UPDATE stores SET manager_id = '50000000-0000-0000-0000-000000000005' WHERE id = '30000000-0000-0000-0000-000000000002';
UPDATE stores SET manager_id = '50000000-0000-0000-0000-000000000006' WHERE id = '30000000-0000-0000-0000-000000000003';

-- =====================================================
-- 7. TRACKS
-- =====================================================
INSERT INTO tracks (id, organization_id, title, description, type, content_url, duration_minutes, status, learning_objectives, tags, published_at, published_by, created_by, view_count, created_at, updated_at) VALUES
('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Customer Service 101', 'Learn customer service basics', 'video', 'https://example.com/video1.mp4', 15, 'published', ARRAY['Be friendly', 'Handle complaints'], ARRAY['customer-service'], NOW() - INTERVAL '30 days', '50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 0, NOW() - INTERVAL '35 days', NOW() - INTERVAL '30 days'),
('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Cash Handling', 'Cash register procedures', 'video', 'https://example.com/video2.mp4', 10, 'published', ARRAY['Count cash', 'Security'], ARRAY['cash'], NOW() - INTERVAL '25 days', '50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 0, NOW() - INTERVAL '30 days', NOW() - INTERVAL '25 days'),
('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Service Quiz', 'Test your knowledge', 'checkpoint', NULL, 5, 'published', ARRAY['Pass the test'], ARRAY['assessment'], NOW() - INTERVAL '20 days', '50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 0, NOW() - INTERVAL '25 days', NOW() - INTERVAL '20 days'),
('60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Safety Guide', 'Workplace safety', 'article', 'https://example.com/article1.html', 8, 'published', ARRAY['Stay safe'], ARRAY['safety'], NOW() - INTERVAL '15 days', '50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 0, NOW() - INTERVAL '20 days', NOW() - INTERVAL '15 days');

UPDATE tracks SET passing_score = 80, max_attempts = 3 WHERE id = '60000000-0000-0000-0000-000000000003';

-- =====================================================
-- 8. ALBUMS
-- =====================================================
INSERT INTO albums (id, organization_id, title, description, status, created_by, created_at, updated_at) VALUES
('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Onboarding', 'New hire training', 'published', '50000000-0000-0000-0000-000000000001', NOW() - INTERVAL '30 days', NOW() - INTERVAL '15 days'),
('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Compliance', 'Required training', 'published', '50000000-0000-0000-0000-000000000001', NOW() - INTERVAL '25 days', NOW() - INTERVAL '10 days');

-- =====================================================
-- 9. ALBUM_TRACKS
-- =====================================================
INSERT INTO album_tracks (id, album_id, track_id, display_order, is_required, unlock_previous, created_at) VALUES
('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 1, true, false, NOW()),
('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 2, true, true, NOW()),
('71000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 3, true, true, NOW()),
('71000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000004', 1, true, false, NOW());

-- =====================================================
-- 10. PLAYLISTS
-- =====================================================
INSERT INTO playlists (id, organization_id, title, description, type, trigger_rules, release_type, release_schedule, is_active, created_by, created_at, updated_at) VALUES
('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Week 1 Training', 'Auto-assigned to new employees', 'auto', '{"role_ids": ["40000000-0000-0000-0000-000000000004"], "hire_days": 7}', 'progressive', '{"stage1": 0, "stage2": 7, "stage3": 14}', true, '50000000-0000-0000-0000-000000000001', NOW() - INTERVAL '30 days', NOW() - INTERVAL '25 days'),
('80000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Compliance Review', 'Manual assignment', 'manual', NULL, 'immediate', NULL, true, '50000000-0000-0000-0000-000000000001', NOW() - INTERVAL '20 days', NOW() - INTERVAL '15 days');

-- =====================================================
-- 11. PLAYLIST_ALBUMS
-- =====================================================
INSERT INTO playlist_albums (id, playlist_id, album_id, display_order, release_stage, created_at) VALUES
('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 1, 1, NOW()),
('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', 1, 1, NOW());

-- =====================================================
-- 12. PLAYLIST_TRACKS
-- =====================================================
INSERT INTO playlist_tracks (id, playlist_id, track_id, display_order, release_stage, created_at) VALUES
('82000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000004', 2, 2, NOW());

-- =====================================================
-- 13. ASSIGNMENTS
-- =====================================================
INSERT INTO assignments (id, organization_id, user_id, playlist_id, assigned_by, assigned_at, due_date, expires_at, status, progress_percent, started_at, completed_at, notification_sent, reminder_sent, created_at, updated_at) VALUES
('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000004', NOW() - INTERVAL '2 days', NOW() + INTERVAL '28 days', NOW() + INTERVAL '35 days', 'in_progress', 65, NOW() - INTERVAL '1 day', NULL, true, false, NOW() - INTERVAL '2 days', NOW()),
('90000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000004', NOW() - INTERVAL '1 day', NOW() + INTERVAL '14 days', NOW() + INTERVAL '21 days', 'assigned', 0, NULL, NULL, true, false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- =====================================================
-- 14. USER_PROGRESS
-- =====================================================
INSERT INTO user_progress (id, organization_id, user_id, assignment_id, track_id, status, progress_percent, time_spent_minutes, attempts, score, passed, started_at, completed_at, created_at, updated_at) VALUES
('A0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000007', '90000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'completed', 100, 15, 1, NULL, NULL, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),
('A0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000007', '90000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 'in_progress', 60, 6, 1, NULL, NULL, NOW() - INTERVAL '1 day', NULL, NOW() - INTERVAL '1 day', NOW()),
('A0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000007', '90000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 'completed', 100, 5, 2, 85, true, NOW() - INTERVAL '1 day', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '1 day', NOW() - INTERVAL '12 hours');

-- =====================================================
-- 15. CERTIFICATIONS
-- =====================================================
INSERT INTO certifications (id, organization_id, name, description, required_album_ids, minimum_score, expires_after_days, is_active, created_by, created_at, updated_at) VALUES
('B0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Customer Service Certified', 'Basic certification', ARRAY['70000000-0000-0000-0000-000000000001']::UUID[], 80, 365, true, '50000000-0000-0000-0000-000000000001', NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days');

-- =====================================================
-- 16. USER_CERTIFICATIONS
-- =====================================================
INSERT INTO user_certifications (id, organization_id, user_id, certification_id, issued_at, issued_by, expires_at, status, certificate_number, created_at, updated_at) VALUES
('C0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000007', 'B0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '1 day', '50000000-0000-0000-0000-000000000004', NOW() + INTERVAL '11 months', 'active', 'CERT-2024-001', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- =====================================================
-- 17. FORMS
-- =====================================================
INSERT INTO forms (id, organization_id, title, description, settings, status, created_by, created_at, updated_at) VALUES
('D0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Incident Report', 'Report incidents', '{"allow_anonymous": false}', 'published', '50000000-0000-0000-0000-000000000001', NOW() - INTERVAL '30 days', NOW() - INTERVAL '20 days');

-- =====================================================
-- 18. FORM_BLOCKS
-- =====================================================
INSERT INTO form_blocks (id, form_id, type, label, placeholder, options, is_required, display_order, created_at, updated_at) VALUES
('D1000000-0000-0000-0000-000000000001', 'D0000000-0000-0000-0000-000000000001', 'text', 'Your Name', 'Enter name', NULL, true, 1, NOW(), NOW()),
('D1000000-0000-0000-0000-000000000002', 'D0000000-0000-0000-0000-000000000001', 'date', 'Incident Date', NULL, NULL, true, 2, NOW(), NOW()),
('D1000000-0000-0000-0000-000000000003', 'D0000000-0000-0000-0000-000000000001', 'select', 'Type', NULL, ARRAY['Injury', 'Property', 'Near Miss', 'Other'], true, 3, NOW(), NOW()),
('D1000000-0000-0000-0000-000000000004', 'D0000000-0000-0000-0000-000000000001', 'textarea', 'Description', 'What happened', NULL, true, 4, NOW(), NOW());

-- =====================================================
-- 19. FORM_SUBMISSIONS
-- =====================================================
INSERT INTO form_submissions (id, organization_id, user_id, form_id, answers, status, submitted_at, created_at, updated_at) VALUES
('D2000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000007', 'D0000000-0000-0000-0000-000000000001', '{"D1000000-0000-0000-0000-000000000001": "Emily Smith", "D1000000-0000-0000-0000-000000000002": "2024-11-15", "D1000000-0000-0000-0000-000000000003": "Near Miss", "D1000000-0000-0000-0000-000000000004": "Slippery floor"}', 'submitted', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days');

-- =====================================================
-- 20. KB_CATEGORIES
-- =====================================================
INSERT INTO kb_categories (id, organization_id, name, description, display_order, created_at, updated_at) VALUES
('E0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Getting Started', 'New employee resources', 1, NOW(), NOW()),
('E0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Policies', 'Company policies', 2, NOW(), NOW());

-- =====================================================
-- 21. KB_ARTICLES
-- =====================================================
INSERT INTO kb_articles (id, organization_id, category_id, title, content, status, view_count, published_at, published_by, created_by, created_at, updated_at) VALUES
('E1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'E0000000-0000-0000-0000-000000000001', 'Welcome', 'Welcome to the team!', 'published', 25, NOW() - INTERVAL '45 days', '50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', NOW() - INTERVAL '45 days', NOW() - INTERVAL '40 days'),
('E1000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'E0000000-0000-0000-0000-000000000002', 'Dress Code', 'Our dress code policy', 'published', 18, NOW() - INTERVAL '40 days', '50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', NOW() - INTERVAL '40 days', NOW() - INTERVAL '35 days');

-- =====================================================
-- 22. KB_ATTACHMENTS
-- =====================================================
INSERT INTO kb_attachments (id, article_id, filename, file_url, file_type, file_size, created_at) VALUES
('E2000000-0000-0000-0000-000000000001', 'E1000000-0000-0000-0000-000000000001', 'handbook.pdf', 'https://example.com/handbook.pdf', 'application/pdf', 2048000, NOW());

-- =====================================================
-- 23. NOTIFICATIONS
-- =====================================================
INSERT INTO notifications (id, organization_id, user_id, type, title, message, link_type, link_id, is_read, created_at) VALUES
('F0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000007', 'assignment_new', 'New Assignment', 'You have been assigned: Week 1 Training', 'assignment', '90000000-0000-0000-0000-000000000001', true, NOW() - INTERVAL '2 days'),
('F0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000007', 'certification_issued', 'Certification Earned', 'You earned: Customer Service Certified', 'certification', 'C0000000-0000-0000-0000-000000000001', false, NOW() - INTERVAL '1 day');

-- =====================================================
-- 24. ACTIVITY_LOGS
-- =====================================================
INSERT INTO activity_logs (id, organization_id, user_id, action, entity_type, entity_id, details, created_at) VALUES
('A1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000007', 'track_completed', 'track', '60000000-0000-0000-0000-000000000001', '{"track_title": "Customer Service 101"}', NOW() - INTERVAL '1 day'),
('A1000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000007', 'form_submitted', 'form', 'D0000000-0000-0000-0000-000000000001', '{"form_title": "Incident Report"}', NOW() - INTERVAL '3 days'),
('A1000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'user_created', 'user', '50000000-0000-0000-0000-000000000007', '{"user_name": "Emily Smith"}', NOW() - INTERVAL '5 days');

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 
    'Organizations' as table_name, COUNT(*) as count FROM organizations
UNION ALL SELECT 'Roles', COUNT(*) FROM roles
UNION ALL SELECT 'Districts', COUNT(*) FROM districts
UNION ALL SELECT 'Stores', COUNT(*) FROM stores
UNION ALL SELECT 'Users', COUNT(*) FROM users
UNION ALL SELECT 'Tracks', COUNT(*) FROM tracks
UNION ALL SELECT 'Albums', COUNT(*) FROM albums
UNION ALL SELECT 'Album Tracks', COUNT(*) FROM album_tracks
UNION ALL SELECT 'Playlists', COUNT(*) FROM playlists
UNION ALL SELECT 'Playlist Albums', COUNT(*) FROM playlist_albums
UNION ALL SELECT 'Playlist Tracks', COUNT(*) FROM playlist_tracks
UNION ALL SELECT 'Assignments', COUNT(*) FROM assignments
UNION ALL SELECT 'User Progress', COUNT(*) FROM user_progress
UNION ALL SELECT 'Certifications', COUNT(*) FROM certifications
UNION ALL SELECT 'User Certifications', COUNT(*) FROM user_certifications
UNION ALL SELECT 'Forms', COUNT(*) FROM forms
UNION ALL SELECT 'Form Blocks', COUNT(*) FROM form_blocks
UNION ALL SELECT 'Form Submissions', COUNT(*) FROM form_submissions
UNION ALL SELECT 'KB Categories', COUNT(*) FROM kb_categories
UNION ALL SELECT 'KB Articles', COUNT(*) FROM kb_articles
UNION ALL SELECT 'KB Attachments', COUNT(*) FROM kb_attachments
UNION ALL SELECT 'Notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'Activity Logs', COUNT(*) FROM activity_logs;
