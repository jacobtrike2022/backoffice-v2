# 🎯 Trike Activity Tracking System - Complete Guide

## System Architecture Overview

You now have a **three-table progress tracking system**:

```
┌─────────────────────────────────────────────────────────────┐
│                    PROGRESS TRACKING                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. track_completions (NEW - Source of Truth)               │
│     └─ "Did user complete this track?"                       │
│     └─ Permanent record, version-aware                       │
│     └─ Used for: certificates, transcripts, skip logic       │
│                                                               │
│  2. activity_events (NEW - Granular xAPI)                   │
│     └─ "HOW did they learn?"                                 │
│     └─ Every interaction captured                            │
│     └─ Used for: competency assessment, analytics            │
│                                                               │
│  3. user_progress (LEGACY - Backwards Compatibility)         │
│     └─ Keep for now, gradually deprecate                     │
│     └─ Dual-write until frontend migrates                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Current Data Summary

**7 track completions across 3 users:**
- Emily: 4 completions (3 passed, 1 in older assignment)
- James: 2 completions (1 video watched, 1 checkpoint failed)
- Tom: 1 completion (compliance article)

**Key insights from your data:**
- ✅ Version tracking works (Emily completed Age Restricted Products v3)
- ✅ Pass/fail tracking works (Emily 92%, James 40%)
- ✅ Assignment linking works (connected to playlists)
- ⚠️ Some assignments missing playlist (Emily's early completions)

---

## 🔍 Essential Dashboard Queries

### Query 1: User Learning Transcript
```sql
-- Get complete learning history for a user
SELECT 
  tc.completed_at,
  t.title,
  t.type,
  tc.track_version_number as version,
  tc.status,
  tc.score,
  tc.passed,
  tc.time_spent_minutes,
  p.title as learned_via_playlist
FROM track_completions tc
JOIN tracks t ON t.id = tc.track_id
LEFT JOIN assignments a ON a.id = tc.completed_via_assignment_id
LEFT JOIN playlists p ON p.id = a.playlist_id
WHERE tc.user_id = '50000000-0000-0000-0000-000000000007' -- Emily
ORDER BY tc.completed_at DESC;
```

**Use case:** Show on employee profile page

---

### Query 2: Assignment Progress Dashboard
```sql
-- Show all assignments with calculated progress
SELECT 
  a.id as assignment_id,
  u.first_name || ' ' || u.last_name as user_name,
  p.title as playlist,
  a.status as assignment_status,
  a.due_date,
  
  -- Calculate actual progress from track completions
  COUNT(DISTINCT tc.track_id) as tracks_completed,
  COUNT(DISTINCT pt.track_id) as tracks_total,
  ROUND(
    (COUNT(DISTINCT tc.track_id)::numeric / NULLIF(COUNT(DISTINCT pt.track_id), 0)) * 100
  ) as actual_progress_percent,
  
  a.progress_percent as stored_progress_percent -- Compare to stored value
  
FROM assignments a
JOIN users u ON u.id = a.user_id
LEFT JOIN playlists p ON p.id = a.playlist_id
LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
LEFT JOIN track_completions tc ON tc.track_id = pt.track_id 
  AND tc.user_id = a.user_id
  AND tc.completed_via_assignment_id = a.id
WHERE a.organization_id = '10000000-0000-0000-0000-000000000001'
GROUP BY a.id, u.first_name, u.last_name, p.title, a.status, a.due_date, a.progress_percent
ORDER BY a.due_date ASC NULLS LAST;
```

**Use case:** Manager dashboard showing team progress

---

### Query 3: Track Analytics (Who's struggling?)
```sql
-- Show track completion rates and average scores
SELECT 
  t.title,
  t.type,
  t.version_number,
  
  -- Completion stats
  COUNT(DISTINCT tc.user_id) as users_completed,
  COUNT(DISTINCT CASE WHEN tc.passed = true THEN tc.user_id END) as users_passed,
  COUNT(DISTINCT CASE WHEN tc.passed = false THEN tc.user_id END) as users_failed,
  
  -- Score stats (for checkpoints)
  ROUND(AVG(tc.score), 2) as avg_score,
  MIN(tc.score) as min_score,
  MAX(tc.score) as max_score,
  
  -- Time stats
  ROUND(AVG(tc.time_spent_minutes), 1) as avg_time_minutes,
  
  -- Attempt stats
  ROUND(AVG(tc.attempts), 1) as avg_attempts

FROM tracks t
LEFT JOIN track_completions tc ON tc.track_id = t.id
WHERE t.organization_id = '10000000-0000-0000-0000-000000000001'
  AND t.status = 'published'
GROUP BY t.id, t.title, t.type, t.version_number
HAVING COUNT(DISTINCT tc.user_id) > 0
ORDER BY users_failed DESC, avg_score ASC;
```

**Use case:** Content quality dashboard - identify problem tracks

---

### Query 4: Version Migration Report
```sql
-- Find users who completed old version but need to retake new version
SELECT 
  t.title,
  t.version_number as current_version,
  u.first_name || ' ' || u.last_name as user_name,
  tc.track_version_number as completed_version,
  tc.completed_at as completed_old_version_at,
  a.due_date as current_assignment_due
  
FROM tracks t
JOIN track_completions tc ON tc.track_id = t.parent_track_id -- Completed parent (old version)
JOIN users u ON u.id = tc.user_id
LEFT JOIN assignments a ON a.user_id = u.id 
  AND a.playlist_id IN (
    SELECT playlist_id FROM playlist_tracks WHERE track_id = t.id
  )
WHERE t.is_latest_version = true
  AND t.parent_track_id IS NOT NULL -- Has a previous version
  AND NOT EXISTS (
    -- Haven't completed new version yet
    SELECT 1 FROM track_completions tc2
    WHERE tc2.user_id = tc.user_id
      AND tc2.track_id = t.id
      AND tc2.track_version_number = t.version_number
  )
ORDER BY a.due_date ASC NULLS LAST;
```

**Use case:** When you update a track, identify who needs remediation

---

### Query 5: Certification Eligibility Check
```sql
-- Check if user is eligible for a certification
WITH required_tracks AS (
  SELECT 
    c.id as cert_id,
    c.name as cert_name,
    unnest(c.required_track_ids) as required_track_id,
    c.minimum_score
  FROM certifications c
  WHERE c.id = 'CERTIFICATION_UUID_HERE'
),
user_completions AS (
  SELECT 
    tc.track_id,
    tc.score,
    tc.passed,
    tc.completed_at
  FROM track_completions tc
  WHERE tc.user_id = 'USER_UUID_HERE'
)
SELECT 
  rt.cert_name,
  rt.minimum_score as required_score,
  COUNT(DISTINCT rt.required_track_id) as tracks_required,
  COUNT(DISTINCT uc.track_id) as tracks_completed,
  ROUND(AVG(uc.score), 2) as avg_score,
  MIN(uc.score) as lowest_score,
  
  -- Eligibility
  CASE 
    WHEN COUNT(DISTINCT rt.required_track_id) = COUNT(DISTINCT uc.track_id)
         AND MIN(uc.score) >= rt.minimum_score
    THEN 'ELIGIBLE'
    ELSE 'INCOMPLETE'
  END as status,
  
  -- Missing tracks
  array_agg(
    CASE WHEN uc.track_id IS NULL THEN t.title END
  ) FILTER (WHERE uc.track_id IS NULL) as missing_tracks

FROM required_tracks rt
LEFT JOIN user_completions uc ON uc.track_id = rt.required_track_id
LEFT JOIN tracks t ON t.id = rt.required_track_id
GROUP BY rt.cert_id, rt.cert_name, rt.minimum_score;
```

**Use case:** Determine if user can be issued a certificate

---

### Query 6: Skip Detection (Previously Completed)
```sql
-- When assigning a playlist, check which tracks user already completed
SELECT 
  pt.track_id,
  t.title,
  t.type,
  tc.completed_at as previously_completed_at,
  tc.score as previous_score,
  tc.passed as previously_passed,
  
  CASE 
    WHEN tc.id IS NOT NULL THEN 'PREVIOUSLY_COMPLETED'
    ELSE 'NOT_COMPLETED'
  END as completion_status,
  
  -- How long ago did they complete it?
  EXTRACT(DAYS FROM NOW() - tc.completed_at) as days_since_completion

FROM playlist_tracks pt
JOIN tracks t ON t.id = pt.track_id
LEFT JOIN track_completions tc ON tc.track_id = pt.track_id
  AND tc.user_id = 'USER_UUID_HERE'
WHERE pt.playlist_id = 'PLAYLIST_UUID_HERE'
ORDER BY pt.display_order;
```

**Use case:** When assigning new playlist, show which tracks they can skip

---

## 🔄 Dual-Write Pattern (Backend Code)

### TypeScript/JavaScript Example

```typescript
// Example: User completes a track
async function recordTrackCompletion({
  userId,
  trackId,
  assignmentId,
  score,
  passed,
  timeSpentMinutes,
  attempts = 1
}: {
  userId: string;
  trackId: string;
  assignmentId?: string;
  score?: number;
  passed?: boolean;
  timeSpentMinutes: number;
  attempts?: number;
}) {
  // 1. Get track version
  const { data: track } = await supabase
    .from('tracks')
    .select('version_number, type')
    .eq('id', trackId)
    .single();

  const completedAt = new Date().toISOString();

  // 2. Write to NEW system (track_completions) - SOURCE OF TRUTH
  const { data: completion, error: completionError } = await supabase
    .from('track_completions')
    .insert({
      user_id: userId,
      track_id: trackId,
      track_version_number: track.version_number,
      status: passed === false ? 'failed' : 'completed',
      score,
      passed,
      attempts,
      time_spent_minutes: timeSpentMinutes,
      completed_via_assignment_id: assignmentId,
      completed_at: completedAt
    })
    .select()
    .single();

  if (completionError) {
    console.error('Failed to record completion:', completionError);
    throw completionError;
  }

  // 3. Write to LEGACY system (user_progress) - BACKWARDS COMPATIBILITY
  await supabase
    .from('user_progress')
    .upsert({
      user_id: userId,
      track_id: trackId,
      assignment_id: assignmentId,
      status: passed === false ? 'failed' : 'completed',
      progress_percent: passed === false ? 0 : 100,
      attempts,
      score,
      passed: passed ? 'true' : passed === false ? 'false' : null,
      time_spent_minutes: timeSpentMinutes,
      completed_at: completedAt,
      updated_at: completedAt
    }, {
      onConflict: 'user_id,track_id,assignment_id'
    });

  // 4. ALSO write granular activity_event (if you want xAPI-style tracking)
  await supabase
    .from('activity_events')
    .insert({
      user_id: userId,
      verb: passed === false ? 'failed' : 'completed',
      object_type: 'track',
      object_id: trackId,
      object_name: track.title,
      result_success: passed !== false,
      result_score_raw: score,
      result_score_scaled: score ? score / 100 : null,
      result_completion: true,
      context_registration: assignmentId,
      context_platform: 'web',
      timestamp: completedAt,
      metadata: {
        track_type: track.type,
        track_version: track.version_number
      }
    });

  // 5. Update assignment progress (if applicable)
  if (assignmentId) {
    await updateAssignmentProgress(assignmentId);
  }

  return completion;
}

// Helper: Recalculate assignment progress
async function updateAssignmentProgress(assignmentId: string) {
  // Get all tracks in this assignment's playlist
  const { data: assignment } = await supabase
    .from('assignments')
    .select(`
      id,
      user_id,
      playlist_id,
      playlists!inner(
        id,
        playlist_tracks(track_id)
      )
    `)
    .eq('id', assignmentId)
    .single();

  const totalTracks = assignment.playlists.playlist_tracks.length;
  const trackIds = assignment.playlists.playlist_tracks.map(pt => pt.track_id);

  // Count how many they've completed
  const { count: completedCount } = await supabase
    .from('track_completions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', assignment.user_id)
    .in('track_id', trackIds);

  const progressPercent = Math.round((completedCount / totalTracks) * 100);

  // Update assignment
  await supabase
    .from('assignments')
    .update({
      progress_percent: progressPercent,
      status: progressPercent === 100 ? 'completed' : 'in_progress',
      completed_at: progressPercent === 100 ? new Date().toISOString() : null
    })
    .eq('id', assignmentId);
}
```

---

## 🎨 How activity_events Enhances track_completions

**track_completions** = "WHAT happened" (completed, passed, failed)
**activity_events** = "HOW it happened" (watched, paused, asked questions, demonstrated competency)

### Example: Rich Learning Journey

```sql
-- Show complete learning journey for a single track completion
WITH track_completion AS (
  SELECT * FROM track_completions
  WHERE user_id = '50000000-0000-0000-0000-000000000007'
    AND track_id = '9286e32e-e919-44a4-a69d-d7d3ff4d328d'
  LIMIT 1
)
SELECT 
  -- The outcome (from track_completions)
  tc.status,
  tc.score,
  tc.passed,
  tc.time_spent_minutes as total_time,
  
  -- The journey (from activity_events)
  json_agg(
    json_build_object(
      'timestamp', ae.timestamp,
      'verb', ae.verb,
      'object_name', ae.object_name,
      'duration', ae.result_duration,
      'metadata', ae.metadata
    ) ORDER BY ae.timestamp
  ) as learning_journey

FROM track_completion tc
LEFT JOIN activity_events ae ON ae.user_id = tc.user_id
  AND ae.object_id = tc.track_id::text
  AND ae.timestamp BETWEEN tc.completed_at - INTERVAL '1 day' AND tc.completed_at
GROUP BY tc.id, tc.status, tc.score, tc.passed, tc.time_spent_minutes;
```

**This gives you:**
- Outcome: "Emily scored 92% and passed"
- Journey: "She watched the video, paused 3 times, asked the AI tutor 2 questions, demonstrated good understanding, then passed the checkpoint"

---

## 🚀 Next Steps

### Immediate (Now):
1. ✅ Schema created (`track_completions`, `activity_events`)
2. ✅ Demo data loaded
3. ✅ Queries documented

### Backend (This Week):
1. Implement dual-write pattern in your track completion logic
2. Add `updateAssignmentProgress()` function
3. Test with real user completing a track

### Frontend (Soon):
1. Show "Previously Completed" badge when assigning playlists
2. Build learner transcript page (using Query 1)
3. Manager dashboard (using Query 2)
4. Content analytics page (using Query 3)

### Later (Phase 2):
1. Deprecate `user_progress` table
2. Migrate old frontend to use `track_completions`
3. Build AI competency assessment from `activity_events`
4. Certificate auto-issuance based on `track_completions`

---

## 📌 Key Principles to Remember

1. **track_completions is source of truth** - Always query this for "did they complete it?"
2. **Version numbers matter** - Track which version they completed
3. **Assignment context is optional** - Tracks can be completed standalone
4. **Albums are calculated** - Never store album completions directly
5. **activity_events adds richness** - Use for competency assessment, not just completion tracking

---

## 🆘 Common Issues & Solutions

### Issue: Assignment progress not updating
**Solution:** Run `updateAssignmentProgress(assignmentId)` after track completion

### Issue: User completed track but shows incomplete
**Check:** Did you write to `track_completions` or only `user_progress`?

### Issue: Certificate not issuing
**Check:** Are you checking `track_completions.passed = true` not just `status = 'completed'`?

### Issue: Track updated, old completions not counting
**Solution:** Use version-aware query (see Query 2) or mark old versions as acceptable

---

**Questions? Check the queries above or ask for specific examples.**
