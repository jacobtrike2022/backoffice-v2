# 🚀 Track Versioning & Duplication - Quick Start

## ⚡ **Immediate Action Required**

### **Step 1: Run Database Migration (5 minutes)**

1. Open **`MIGRATION_INSTRUCTIONS.md`** file
2. Copy the SQL script
3. Open your **Supabase Dashboard** → **SQL Editor**
4. Paste and **Run** the SQL
5. ✅ Done!

---

## 📦 **What You Get:**

### **✨ Track Duplication**
```typescript
import * as crud from './lib/crud';

// Duplicate any track
const newTrack = await crud.duplicateTrack(trackId);
// Creates: "Safety Training (Copy)" as draft
```

**Features:**
- Auto-naming with "(Copy)" suffix
- Smart numbering (Copy 2, Copy 3...)
- Copies all content: media, text, objectives, tags
- Resets assignments (fresh start)
- Always creates as draft

---

### **🔄 Track Versioning**

When editing a **published track** that's already assigned to users:

1. **Make your edits** → Click Save
2. **Version Decision Modal appears** showing:
   - Current playlists using this track
   - Users pending (not completed)
   - Users completed
3. **Choose strategy:**
   - **Replace**: Pending get V2, completed keep credit *(minor updates)*
   - **Replace + Reassign**: Everyone must complete V2 *(major changes/compliance)*
   - **Keep V1**: V2 only for new assignments *(significant rewrites)*
4. **Add version notes** (required for audit trail)
5. ✅ V2 created!

**What gets versioned:**
- All content changes (text, media, objectives)
- Timestamp + admin who made the change
- Audit notes for compliance

**What stays the same:**
- Track title (users always see "Safety Training", never "V2")
- Track ID family (versions are linked)

---

## 📚 **Components Built:**

### **1. Version Decision Modal**
`/components/content-authoring/VersionDecisionModal.tsx`

Shows when saving published tracks with assignments.

**Usage:**
```tsx
<VersionDecisionModal
  isOpen={isVersionModalOpen}
  onClose={() => setIsVersionModalOpen(false)}
  trackId={track.id}
  trackTitle={track.title}
  currentVersion={track.version_number || 1}
  pendingChanges={trackUpdates}
  onVersionCreated={(newId, strategy) => {
    // Handle success
  }}
/>
```

### **2. Version History Sidebar**
`/components/content-authoring/VersionHistory.tsx`

Displays version timeline in track editors.

**Usage:**
```tsx
<VersionHistory 
  trackId={track.id}
  currentVersion={track.version_number}
  onVersionClick={(versionId) => {
    // Load that version (read-only)
  }}
/>
```

---

## 🔧 **Backend Functions:**

All in `/lib/crud/tracks.ts`:

| Function | Purpose |
|----------|---------|
| `duplicateTrack(id)` | Create copy with "(Copy)" suffix |
| `getTrackVersions(id)` | Get all versions of a track |
| `createTrackVersion(id, updates, notes)` | Create new version |
| `getPlaylistsForTrack(id)` | List playlists using track |
| `getTrackAssignmentStats(id)` | Get pending/completed counts |
| `replaceTrackInPlaylists(oldId, newId)` | Update assignments |
| `reassignCompletedUsers(oldId, newId)` | Reset completions |

---

## 🎯 **Integration Checklist:**

See **`VERSIONING_IMPLEMENTATION_GUIDE.md`** for detailed steps.

**Quick checklist:**
- [ ] Run database migration (SQL in Supabase)
- [ ] Add duplicate button to Content Library
- [ ] Add duplicate button to Content Authoring
- [ ] Add Version History sidebar to track editors
- [ ] Update save handlers to check for assignments
- [ ] Add Version Decision Modal to save flow
- [ ] Add version badges to track cards
- [ ] Test duplication (all 4 track types)
- [ ] Test versioning with assignments

---

## 🔍 **Finding Things:**

- **Migration SQL**: `MIGRATION_INSTRUCTIONS.md`
- **Detailed Guide**: `VERSIONING_IMPLEMENTATION_GUIDE.md`
- **Backend Code**: `/lib/crud/tracks.ts`
- **UI Components**: `/components/content-authoring/`
- **Type Definitions**: `CreateTrackInput` interface in tracks.ts

---

## 💡 **Pro Tips:**

1. **Duplication** = New track (use for "Safety Q1" → "Safety Q2")
2. **Versioning** = Update existing (use for "Safety 2025" → "Safety 2026")
3. Version notes are **required** and visible in audit reports
4. Learners never see version numbers, only track titles
5. `getTracks()` automatically filters to latest versions only
6. Old versions are read-only (view historical compliance)

---

## 🆘 **Quick Troubleshooting:**

**"Column does not exist" error**
→ Run the migration SQL from `MIGRATION_INSTRUCTIONS.md`

**Duplicate button not showing**
→ Import `duplicateTrack` from `/lib/crud` and add to your UI

**Version modal not appearing**
→ Check if track is published and has assignments (stats > 0)

**Old versions showing in library**
→ Make sure `is_latest_version = true` on current versions

---

## 📞 **Next Steps:**

1. ✅ Run migration (5 min)
2. ✅ Test duplicate feature
3. ✅ Test versioning flow
4. ✅ Integrate into your track editors (see guide)
5. ✅ Add to Content Library UI
6. 🎉 Ship versioning to production!

---

**Questions?** Check the full implementation guide or the inline code comments!
