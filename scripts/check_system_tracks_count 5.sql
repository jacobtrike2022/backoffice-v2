-- Run this in Supabase SQL Editor to see how many tracks match
-- "Content Management" criteria (system + published).
-- If this returns 4, the UI is correct; the other 157 may be draft, non-system, or another org.

SELECT count(*) AS published_system_tracks
FROM tracks
WHERE is_system_content = true
  AND status = 'published';

-- Optional: breakdown by status and system flag
SELECT is_system_content, status, count(*)
FROM tracks
GROUP BY 1, 2
ORDER BY 1, 2;
