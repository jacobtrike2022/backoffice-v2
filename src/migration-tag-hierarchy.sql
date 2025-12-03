-- =====================================================
-- TAG HIERARCHY SYSTEM - CORRECTED MIGRATION
-- 3-Level: System Category → Tag Parent → Tag (Child)
-- =====================================================

-- Step 1: Make organization_id nullable for system tags
ALTER TABLE tags ALTER COLUMN organization_id DROP NOT NULL;

-- Step 2: Add new columns to tags table
ALTER TABLE tags 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES tags(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS system_category VARCHAR(50), 
ADD COLUMN IF NOT EXISTS is_system_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;

-- Step 3: Add type column if it doesn't exist
ALTER TABLE tags 
ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'child';

-- Step 4: Create indices for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_tags_parent_id ON tags(parent_id);
CREATE INDEX IF NOT EXISTS idx_tags_system_category ON tags(system_category);
CREATE INDEX IF NOT EXISTS idx_tags_system_locked ON tags(is_system_locked);
CREATE INDEX IF NOT EXISTS idx_tags_type ON tags(type);

-- Step 5: Insert System Categories (Top Level - no parent, no org)
INSERT INTO tags (id, organization_id, name, system_category, is_system_locked, description, display_order, type)
VALUES 
  (gen_random_uuid(), NULL, 'Content', 'content', true, 'Tags for tracks, albums, and learning content', 1, 'system-category'),
  (gen_random_uuid(), NULL, 'Playlists', 'playlists', true, 'Tags for playlist organization and assignment', 2, 'system-category'),
  (gen_random_uuid(), NULL, 'Forms', 'forms', true, 'Tags for forms and assessments', 3, 'system-category'),
  (gen_random_uuid(), NULL, 'Knowledge Base', 'knowledge-base', true, 'Tags for knowledge base articles and resources', 4, 'system-category'),
  (gen_random_uuid(), NULL, 'People', 'people', true, 'Tags for employees, roles, and teams', 5, 'system-category'),
  (gen_random_uuid(), NULL, 'Units', 'units', true, 'Tags for stores, districts, and locations', 6, 'system-category')
ON CONFLICT DO NOTHING;

-- Step 6: Insert System-Locked Tag Parents and Children (examples under Content category)
DO $$
DECLARE
  v_content_category_id UUID;
  v_trike_library_parent_id UUID;
  v_content_type_parent_id UUID;
BEGIN
  -- Get Content category ID
  SELECT id INTO v_content_category_id 
  FROM tags 
  WHERE system_category = 'content' AND type = 'system-category' 
  LIMIT 1;
  
  IF v_content_category_id IS NOT NULL THEN
    -- Create "Trike Library" parent tag
    INSERT INTO tags (id, organization_id, name, parent_id, system_category, is_system_locked, description, display_order, type)
    VALUES (
      gen_random_uuid(),
      NULL,
      'Trike Library',
      v_content_category_id,
      'content',
      true,
      'System-provided content from Trike',
      1,
      'parent'
    ) 
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_trike_library_parent_id;
    
    -- If insert was skipped due to conflict, get existing ID
    IF v_trike_library_parent_id IS NULL THEN
      SELECT id INTO v_trike_library_parent_id
      FROM tags
      WHERE name = 'Trike Library' AND parent_id = v_content_category_id
      LIMIT 1;
    END IF;
    
    -- Create child tags under Trike Library
    IF v_trike_library_parent_id IS NOT NULL THEN
      INSERT INTO tags (organization_id, name, parent_id, system_category, is_system_locked, type, display_order)
      VALUES 
        (NULL, 'Default Template', v_trike_library_parent_id, 'content', true, 'child', 1),
        (NULL, 'Featured Content', v_trike_library_parent_id, 'content', true, 'child', 2),
        (NULL, 'Premium Content', v_trike_library_parent_id, 'content', true, 'child', 3)
      ON CONFLICT DO NOTHING;
    END IF;
    
    -- Create "Content Type" parent tag
    INSERT INTO tags (id, organization_id, name, parent_id, system_category, is_system_locked, description, display_order, type)
    VALUES (
      gen_random_uuid(),
      NULL,
      'Content Type',
      v_content_category_id,
      'content',
      true,
      'Classification by content format',
      2,
      'parent'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_content_type_parent_id;
    
    -- If insert was skipped, get existing ID
    IF v_content_type_parent_id IS NULL THEN
      SELECT id INTO v_content_type_parent_id
      FROM tags
      WHERE name = 'Content Type' AND parent_id = v_content_category_id
      LIMIT 1;
    END IF;
    
    -- Create child tags under Content Type
    IF v_content_type_parent_id IS NOT NULL THEN
      INSERT INTO tags (organization_id, name, parent_id, system_category, is_system_locked, type, display_order)
      VALUES 
        (NULL, 'Video', v_content_type_parent_id, 'content', true, 'child', 1),
        (NULL, 'Article', v_content_type_parent_id, 'content', true, 'child', 2),
        (NULL, 'Story', v_content_type_parent_id, 'content', true, 'child', 3),
        (NULL, 'Interactive', v_content_type_parent_id, 'content', true, 'child', 4)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

-- Step 7: Insert example parent tags for other categories
DO $$
DECLARE
  v_playlist_category_id UUID;
  v_people_category_id UUID;
  v_kb_category_id UUID;
  v_assignment_type_parent_id UUID;
  v_role_type_parent_id UUID;
  v_topic_parent_id UUID;
BEGIN
  -- Get Playlists category ID
  SELECT id INTO v_playlist_category_id 
  FROM tags 
  WHERE system_category = 'playlists' AND type = 'system-category' 
  LIMIT 1;
  
  IF v_playlist_category_id IS NOT NULL THEN
    -- Create "Assignment Type" parent tag
    INSERT INTO tags (id, organization_id, name, parent_id, system_category, is_system_locked, description, display_order, type)
    VALUES (
      gen_random_uuid(),
      NULL,
      'Assignment Type',
      v_playlist_category_id,
      'playlists',
      true,
      'Classification by assignment purpose',
      1,
      'parent'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_assignment_type_parent_id;
    
    IF v_assignment_type_parent_id IS NULL THEN
      SELECT id INTO v_assignment_type_parent_id
      FROM tags
      WHERE name = 'Assignment Type' AND parent_id = v_playlist_category_id
      LIMIT 1;
    END IF;
    
    IF v_assignment_type_parent_id IS NOT NULL THEN
      INSERT INTO tags (organization_id, name, parent_id, system_category, is_system_locked, type, display_order)
      VALUES 
        (NULL, 'Onboarding', v_assignment_type_parent_id, 'playlists', true, 'child', 1),
        (NULL, 'Compliance', v_assignment_type_parent_id, 'playlists', true, 'child', 2),
        (NULL, 'Development', v_assignment_type_parent_id, 'playlists', true, 'child', 3),
        (NULL, 'Certification', v_assignment_type_parent_id, 'playlists', true, 'child', 4)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  -- Get People category ID
  SELECT id INTO v_people_category_id 
  FROM tags 
  WHERE system_category = 'people' AND type = 'system-category' 
  LIMIT 1;
  
  IF v_people_category_id IS NOT NULL THEN
    -- Create "Role Type" parent tag
    INSERT INTO tags (id, organization_id, name, parent_id, system_category, is_system_locked, description, display_order, type)
    VALUES (
      gen_random_uuid(),
      NULL,
      'Role Type',
      v_people_category_id,
      'people',
      true,
      'Employee role classifications',
      1,
      'parent'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_role_type_parent_id;
    
    IF v_role_type_parent_id IS NULL THEN
      SELECT id INTO v_role_type_parent_id
      FROM tags
      WHERE name = 'Role Type' AND parent_id = v_people_category_id
      LIMIT 1;
    END IF;
    
    IF v_role_type_parent_id IS NOT NULL THEN
      INSERT INTO tags (organization_id, name, parent_id, system_category, is_system_locked, type, display_order)
      VALUES 
        (NULL, 'Manager', v_role_type_parent_id, 'people', true, 'child', 1),
        (NULL, 'Team Lead', v_role_type_parent_id, 'people', true, 'child', 2),
        (NULL, 'Team Member', v_role_type_parent_id, 'people', true, 'child', 3),
        (NULL, 'Trainee', v_role_type_parent_id, 'people', true, 'child', 4)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  -- Get Knowledge Base category ID
  SELECT id INTO v_kb_category_id 
  FROM tags 
  WHERE system_category = 'knowledge-base' AND type = 'system-category' 
  LIMIT 1;
  
  IF v_kb_category_id IS NOT NULL THEN
    -- Create "Topic" parent tag
    INSERT INTO tags (id, organization_id, name, parent_id, system_category, is_system_locked, description, display_order, type)
    VALUES (
      gen_random_uuid(),
      NULL,
      'Topic',
      v_kb_category_id,
      'knowledge-base',
      true,
      'Knowledge base topic areas',
      1,
      'parent'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_topic_parent_id;
    
    IF v_topic_parent_id IS NULL THEN
      SELECT id INTO v_topic_parent_id
      FROM tags
      WHERE name = 'Topic' AND parent_id = v_kb_category_id
      LIMIT 1;
    END IF;
    
    IF v_topic_parent_id IS NOT NULL THEN
      INSERT INTO tags (organization_id, name, parent_id, system_category, is_system_locked, type, display_order)
      VALUES 
        (NULL, 'How-To Guides', v_topic_parent_id, 'knowledge-base', true, 'child', 1),
        (NULL, 'Troubleshooting', v_topic_parent_id, 'knowledge-base', true, 'child', 2),
        (NULL, 'Best Practices', v_topic_parent_id, 'knowledge-base', true, 'child', 3),
        (NULL, 'FAQs', v_topic_parent_id, 'knowledge-base', true, 'child', 4)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

-- Step 8: Verify the hierarchy was created
SELECT 
  t1.name as category,
  t1.type as category_type,
  t2.name as parent_tag,
  t2.type as parent_type,
  t3.name as child_tag,
  t3.type as child_type,
  t3.is_system_locked
FROM tags t1
LEFT JOIN tags t2 ON t2.parent_id = t1.id
LEFT JOIN tags t3 ON t3.parent_id = t2.id
WHERE t1.type = 'system-category'
ORDER BY t1.display_order, t2.display_order, t3.display_order;

-- Step 9: Show summary stats
SELECT 
  'Total Tags' as metric,
  COUNT(*) as count
FROM tags
UNION ALL
SELECT 
  'System Categories' as metric,
  COUNT(*) as count
FROM tags WHERE type = 'system-category'
UNION ALL
SELECT 
  'Parent Tags' as metric,
  COUNT(*) as count
FROM tags WHERE type = 'parent'
UNION ALL
SELECT 
  'Child Tags' as metric,
  COUNT(*) as count
FROM tags WHERE type = 'child'
UNION ALL
SELECT 
  'System Locked' as metric,
  COUNT(*) as count
FROM tags WHERE is_system_locked = true;
