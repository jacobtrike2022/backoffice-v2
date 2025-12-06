-- =====================================================
-- FACTS DATABASE VERIFICATION SCRIPT
-- Run this in Supabase SQL Editor to verify your setup
-- =====================================================

-- 1. CHECK IF TABLES EXIST
-- =====================================================
SELECT 
  table_name,
  CASE 
    WHEN table_name = 'facts' THEN '✅ Main facts table'
    WHEN table_name = 'fact_usage' THEN '✅ Many-to-many relationships'
    WHEN table_name = 'fact_conflicts' THEN '✅ Conflict detection'
    WHEN table_name = 'sources' THEN '✅ Document tracking'
  END as description
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('facts', 'fact_usage', 'fact_conflicts', 'sources')
ORDER BY table_name;

-- Expected output: 4 rows (facts, fact_usage, fact_conflicts, sources)
-- If you see fewer than 4 rows, run /MIGRATION_FACTS_TABLES.sql

-- 2. COUNT FACTS BY TYPE
-- =====================================================
SELECT 
  type,
  COUNT(*) as count,
  ROUND(AVG(extraction_confidence)::numeric, 2) as avg_confidence
FROM facts
GROUP BY type
ORDER BY type;

-- Shows how many Facts vs Procedures you have

-- 3. COUNT FACT USAGE BY TRACK TYPE
-- =====================================================
SELECT 
  track_type,
  COUNT(DISTINCT track_id) as unique_tracks,
  COUNT(*) as total_facts,
  ROUND(COUNT(*)::numeric / COUNT(DISTINCT track_id), 1) as avg_facts_per_track
FROM fact_usage
GROUP BY track_type
ORDER BY track_type;

-- Shows facts distribution across Videos, Articles, Stories, Checkpoints

-- 4. FIND MOST REUSED FACTS
-- =====================================================
SELECT 
  f.id,
  f.title,
  f.type,
  COUNT(fu.id) as usage_count,
  STRING_AGG(DISTINCT fu.track_type, ', ') as used_in_track_types
FROM facts f
JOIN fact_usage fu ON f.id = fu.fact_id
GROUP BY f.id, f.title, f.type
HAVING COUNT(fu.id) > 1
ORDER BY usage_count DESC
LIMIT 10;

-- Shows facts that are reused across multiple tracks

-- 5. FIND ORPHANED FACTS
-- =====================================================
SELECT 
  f.id,
  f.title,
  f.content,
  f.extracted_by,
  f.created_at
FROM facts f
LEFT JOIN fact_usage fu ON f.id = fu.fact_id
WHERE fu.id IS NULL
ORDER BY f.created_at DESC;

-- Shows facts that aren't linked to any track
-- These can be safely deleted or kept for future reuse

-- 6. RECENT FACT ACTIVITY
-- =====================================================
SELECT 
  f.id,
  f.title,
  f.type,
  f.extracted_by,
  f.created_at,
  COUNT(fu.id) as usage_count
FROM facts f
LEFT JOIN fact_usage fu ON f.id = fu.fact_id
WHERE f.created_at >= NOW() - INTERVAL '7 days'
GROUP BY f.id, f.title, f.type, f.extracted_by, f.created_at
ORDER BY f.created_at DESC;

-- Shows facts created in the last 7 days

-- 7. CHECK FOR CONFLICTS
-- =====================================================
SELECT 
  fc.id,
  f1.title as fact_1_title,
  f2.title as fact_2_title,
  fc.reason,
  fc.resolution,
  fc.detected_at
FROM fact_conflicts fc
JOIN facts f1 ON fc.fact_id = f1.id
JOIN facts f2 ON fc.conflicting_fact_id = f2.id
ORDER BY fc.detected_at DESC;

-- Shows any detected conflicts between facts
-- Should be empty unless you've implemented conflict detection

-- 8. FACTS BY CONTEXT SPECIFICITY
-- =====================================================
SELECT 
  context->>'specificity' as specificity,
  COUNT(*) as count
FROM facts
GROUP BY context->>'specificity'
ORDER BY count DESC;

-- Shows distribution across universal, state, company, etc.

-- 9. SAMPLE FACTS WITH FULL METADATA
-- =====================================================
SELECT 
  f.id,
  f.title,
  f.content,
  f.type,
  f.steps,
  f.context,
  f.extracted_by,
  f.extraction_confidence,
  f.company_id,
  f.created_at,
  f.updated_at,
  COUNT(fu.id) as usage_count
FROM facts f
LEFT JOIN fact_usage fu ON f.id = fu.fact_id
GROUP BY f.id
ORDER BY f.created_at DESC
LIMIT 5;

-- Shows recent facts with all their metadata

-- 10. STORAGE SIZE CHECK
-- =====================================================
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('facts', 'fact_usage', 'fact_conflicts', 'sources')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Shows how much storage each table uses

-- =====================================================
-- CLEANUP QUERIES (USE WITH CAUTION)
-- =====================================================

-- Delete all orphaned facts (facts not used by any track)
-- UNCOMMENT TO RUN:
/*
DELETE FROM facts
WHERE id IN (
  SELECT f.id
  FROM facts f
  LEFT JOIN fact_usage fu ON f.id = fu.fact_id
  WHERE fu.id IS NULL
);
*/

-- Delete all facts for a specific track
-- UNCOMMENT AND REPLACE 'your-track-id' TO RUN:
/*
DELETE FROM fact_usage
WHERE track_id = 'your-track-id';
*/

-- Delete a specific fact (will cascade delete from fact_usage)
-- UNCOMMENT AND REPLACE 'fact-uuid' TO RUN:
/*
DELETE FROM facts
WHERE id = 'fact-uuid';
*/

-- =====================================================
-- SUMMARY DASHBOARD
-- =====================================================
SELECT 
  '📊 Total Facts' as metric,
  COUNT(*)::text as value
FROM facts
UNION ALL
SELECT 
  '🔗 Total Fact Usage Links' as metric,
  COUNT(*)::text as value
FROM fact_usage
UNION ALL
SELECT 
  '📝 Facts without Usage (Orphaned)' as metric,
  COUNT(*)::text as value
FROM facts f
LEFT JOIN fact_usage fu ON f.id = fu.fact_id
WHERE fu.id IS NULL
UNION ALL
SELECT 
  '🤖 AI-Generated Facts' as metric,
  COUNT(*)::text as value
FROM facts
WHERE extracted_by IN ('ai-pass-1', 'ai-pass-2')
UNION ALL
SELECT 
  '✍️ Manually Created Facts' as metric,
  COUNT(*)::text as value
FROM facts
WHERE extracted_by = 'manual'
UNION ALL
SELECT 
  '⚠️ Fact Conflicts' as metric,
  COUNT(*)::text as value
FROM fact_conflicts
UNION ALL
SELECT 
  '📚 Source Documents' as metric,
  COUNT(*)::text as value
FROM sources;

-- =====================================================
-- END OF VERIFICATION SCRIPT
-- =====================================================

-- 💡 TIP: Run this script periodically to monitor your facts system
-- 🚀 Your facts system is production-ready!
