# 🎯 Track Versioning & Duplication - Implementation Guide

## ✅ What's Been Built

### 1. **Database Schema** (`/supabase/migrations/00003_add_versioning_fields.sql.tsx`)
New columns added to `tracks` table:
- `parent_track_id` - Links to original track (V1)
- `version_number` - Sequential version (1, 2, 3...)
- `version_notes` - Admin changelog (e.g., "Updated Handbook 2026")
- `is_latest_version` - Boolean flag for current version
- `content_text` - Text content for articles/stories
- `is_system_content` - Flag for Trike Library tracks
- `summary` - Track summary

### 2. **Backend Functions** (`/lib/crud/tracks.ts`)

#### Duplication:
- `duplicateTrack(trackId)` - Creates copy with "(Copy)" suffix
- Automatically handles copy numbering (Copy 2, Copy 3, etc.)
- Always creates as draft, resets assignments

#### Versioning:
- `getTrackVersions(trackId)` - Gets all versions of a track
- `createTrackVersion(trackId, updates, versionNotes)` - Creates new version
- `getPlaylistsForTrack(trackId)` - Lists playlists using track
- `getTrackAssignmentStats(trackId)` - Returns pending/completed counts
- `replaceTrackInPlaylists(oldId, newId)` - Updates playlist assignments
- `reassignCompletedUsers(oldId, newId)` - Resets completions for reassignment

#### Query Filtering:
- `getTracks()` now defaults to showing only latest versions
- Use `includeAllVersions: true` to see old versions

### 3. **UI Components**

#### Version Decision Modal (`/components/content-authoring/VersionDecisionModal.tsx`)
Shows when saving edits to published track with assignments:
- Displays current assignment stats (playlists, pending, completed)
- 3 version strategies:
  1. **Replace** - Pending get V2, completed keep credit
  2. **Replace + Reassign** - Everyone must complete V2
  3. **Keep V1** - V2 only for new playlists
- Requires version notes input

#### Version History Sidebar (`/components/content-authoring/VersionHistory.tsx`)
Displays in track view/edit:
- Shows all versions in chronological order
- "Current" badge on latest version
- Version notes and creation dates
- "Replaced by VX on DATE" for old versions
- Click to view old versions (read-only)

---

## 🔨 Integration Steps

### Step 1: Add Duplicate Button to Content Library

In `/components/ContentLibrary.tsx`, add to each track card:

```tsx
import { Copy } from 'lucide-react';
import * as crud from '../lib/crud';

// In track card rendering (both grid and list views):
<Button
  variant="ghost"
  size="sm"
  onClick={async (e) => {
    e.stopPropagation();
    try {
      const newTrack = await crud.duplicateTrack(track.id);
      toast.success(`"${track.title}" duplicated successfully!`);
      refetch(); // Refresh track list
    } catch (error: any) {
      toast.error(`Failed to duplicate: ${error.message}`);
    }
  }}
>
  <Copy className="h-4 w-4" />
  Duplicate
</Button>
```

### Step 2: Add Version Badge to Track Cards

Show version number subtly in card header:

```tsx
{track.version_number > 1 && (
  <Badge variant="outline" className="text-xs">
    V{track.version_number}
  </Badge>
)}
```

### Step 3: Add Version History to Track Editors

For `/components/TrackDetailEdit.tsx`, `/components/ArticleDetailEdit.tsx`, `/components/content-authoring/CheckpointEditor.tsx`, `/components/content-authoring/StoryEditor.tsx`:

#### Import:
```tsx
import { VersionHistory } from './content-authoring/VersionHistory';
import { VersionDecisionModal } from './content-authoring/VersionDecisionModal';
```

#### State:
```tsx
const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
const [pendingChanges, setPendingChanges] = useState<any>(null);
```

#### Add Version History Sidebar (in view/edit right sidebar):
```tsx
<VersionHistory 
  trackId={track.id}
  currentVersion={track.version_number}
  onVersionClick={(versionTrackId) => {
    // Navigate to that version (implement based on your routing)
    // For now, could reload track or show in modal
  }}
/>
```

#### Modify Save Handler:
```tsx
const handleSave = async () => {
  // Existing validation...
  
  const trackUpdates = {
    title,
    description,
    // ... all other fields
  };
  
  // Check if track is published and has assignments
  if (existingTrack.status === 'published') {
    const stats = await crud.getTrackAssignmentStats(existingTrack.id);
    
    if (stats.totalAssignments > 0) {
      // Show version decision modal
      setPendingChanges(trackUpdates);
      setIsVersionModalOpen(true);
      return;
    }
  }
  
  // If no assignments, just update normally
  await crud.updateTrack({ id: existingTrack.id, ...trackUpdates });
  toast.success('Track updated!');
  // ... rest of save logic
};
```

#### Add Version Decision Modal:
```tsx
<VersionDecisionModal
  isOpen={isVersionModalOpen}
  onClose={() => {
    setIsVersionModalOpen(false);
    setPendingChanges(null);
  }}
  trackId={existingTrack.id}
  trackTitle={existingTrack.title}
  currentVersion={existingTrack.version_number || 1}
  pendingChanges={pendingChanges}
  onVersionCreated={(newTrackId, strategy) => {
    toast.success(`Version ${(existingTrack.version_number || 1) + 1} created with ${strategy} strategy!`);
    setIsVersionModalOpen(false);
    // Reload track or navigate to new version
    if (onUpdate) onUpdate();
  }}
/>
```

### Step 4: Add Duplicate to Content Authoring Page

In `/components/ContentAuthoring.tsx`, add duplicate button to published and draft track lists similar to Content Library.

### Step 5: Handle Old Version Viewing

When user clicks on an old version in Version History:

```tsx
// Add state for viewing old version
const [isViewingOldVersion, setIsViewingOldVersion] = useState(false);
const [oldVersionData, setOldVersionData] = useState<any>(null);

// In VersionHistory component callback:
onVersionClick={async (versionTrackId) => {
  if (versionTrackId !== existingTrack.id) {
    const oldVersion = await crud.getTrackById(versionTrackId);
    
    // Find which version replaced this one
    const versions = await crud.getTrackVersions(versionTrackId);
    const currentIndex = versions.findIndex(v => v.id === versionTrackId);
    const replacedBy = currentIndex < versions.length - 1 ? versions[currentIndex + 1] : null;
    
    setOldVersionData({ ...oldVersion, replacedBy });
    setIsViewingOldVersion(true);
  }
}

// Show banner at top of editor when viewing old version:
{isViewingOldVersion && oldVersionData && (
  <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
    <CardContent className="pt-4 flex items-center justify-between">
      <div>
        <p className="font-semibold text-yellow-900 dark:text-yellow-100">
          Viewing Version {oldVersionData.version_number} (Historical)
        </p>
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          This version was replaced by V{oldVersionData.replacedBy?.version_number} on{' '}
          {new Date(oldVersionData.replacedBy?.created_at).toLocaleDateString()}
        </p>
      </div>
      <Button 
        variant="outline"
        onClick={() => {
          setIsViewingOldVersion(false);
          setOldVersionData(null);
          // Load current version
        }}
      >
        View Current Version
      </Button>
    </CardContent>
  </Card>
)}
```

---

## 🎨 UX Best Practices

### Version Numbering Display
- **Learner-facing**: Never show version numbers (tracks always show original title)
- **Admin UI**: Show version badge subtly (V2, V3) in lists and headers
- **Version History**: Prominent display with full chronology

### Duplication vs Versioning
- **Duplicate**: For creating a new related track (e.g., "Safety Training Q1" → "Safety Training Q2")
- **Version**: For updating existing content while preserving history and assignments

### Assignment Strategies
- **Replace**: Minor updates (typo fixes, small improvements)
- **Replace + Reassign**: Major changes or compliance requirements
- **Keep V1**: Significant content changes where existing users shouldn't be affected

### Audit Trail
- Version notes are REQUIRED for compliance/audit purposes
- Show in Version History and any compliance reports
- Include in employee completion records (which version they completed)

---

## 🚀 Testing Checklist

- [ ] Create a new track (should be V1 with `is_latest_version=true`)
- [ ] Duplicate a track (should create "(Copy)" with V1)
- [ ] Edit published track without assignments (should update in-place)
- [ ] Edit published track with assignments (should show Version Decision Modal)
- [ ] Create V2 with "Replace" strategy (check playlist assignments update)
- [ ] Create V2 with "Replace + Reassign" (check completions reset)
- [ ] Create V2 with "Keep V1" (check assignments unchanged)
- [ ] View Version History (all versions visible chronologically)
- [ ] Click old version (should show read-only view with banner)
- [ ] Verify getTracks() only shows latest versions
- [ ] Verify duplicate copies all content (media, text, objectives, etc.)

---

## 📊 Database Queries for Debugging

```sql
-- See all versions of a track family
SELECT id, title, version_number, is_latest_version, created_at
FROM tracks
WHERE id = 'track-id' OR parent_track_id = 'original-track-id'
ORDER BY version_number;

-- Find tracks with multiple versions
SELECT parent_track_id, COUNT(*) as version_count
FROM tracks
WHERE parent_track_id IS NOT NULL
GROUP BY parent_track_id
HAVING COUNT(*) > 1;

-- Check for version inconsistencies (multiple "latest" versions)
SELECT parent_track_id, COUNT(*) as latest_count
FROM tracks
WHERE is_latest_version = true
GROUP BY parent_track_id
HAVING COUNT(*) > 1;
```

---

## 🔮 Future Enhancements (Not Implemented Yet)

1. **Minor vs Major Versions** (V1.1 vs V2.0)
2. **Version Comparison/Diff View**
3. **Rollback to Previous Version**
4. **Version Branching (Variants)**
5. **Bulk Version Updates** (update multiple tracks at once)
6. **Version Approval Workflow** (require review before publishing new version)
7. **Automated Version Notes** (AI-generated based on content diff)

---

## 🆘 Troubleshooting

### "Version number already exists"
- Check `is_latest_version` flags are correct
- Ensure `createTrackVersion()` increments properly

### "Assignments not updating"
- Verify `replaceTrackInPlaylists()` completed successfully
- Check `playlist_tracks` table for correct `track_id`

### "Old versions showing in library"
- Ensure `getTracks()` is called without `includeAllVersions: true`
- Check `is_latest_version` flag is set correctly

### "Duplicate not working"
- Check all content fields are being copied
- Verify media URLs are accessible
- Ensure `status` is set to 'draft'

---

**Ready to integrate!** The core versioning system is complete. Follow the integration steps above to add it to your existing track editors. Start with one editor (e.g., ArticleDetailEdit) to test the full flow before applying to all types.
