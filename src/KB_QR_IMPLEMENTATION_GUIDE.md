# Knowledge Base QR Code Generation - Implementation Guide

## 🎯 Overview

This feature allows admins to generate QR codes for Knowledge Base articles. QR codes are **opt-in** and location-aware, enabling employees to scan physical codes and view reference materials on their phones without logging in.

---

## ✅ What's Been Implemented

### 1. **Database Migration**
- ✅ `/MIGRATION_KB_QR_CODES.sql` - Run this in Supabase SQL Editor
  - Adds `kb_slug`, `kb_qr_enabled`, `kb_qr_location`, `kb_qr_downloaded_count` to `tracks` table
  - Adds `kb_privacy_mode`, `kb_shared_password`, `kb_logo_url` to `organizations` table
  - Creates `kb_page_views` table for analytics
  - Creates indexes and helper functions

### 2. **Core Utilities**
- ✅ `/lib/qr-code-utils.ts` - QR code generation functions
  - `generateKBSlug()` - Creates unique slugs for KB articles
  - `createQRCode()` - Generates QR codes with logo overlays
  - `generateFramedQRCanvas()` - Creates print-ready framed QR codes
  - `downloadCanvasAsPNG()` - Downloads QR as PNG
  - `downloadQRCodeAsSVG()` - Downloads QR as SVG
  - Helper functions for validation and filename generation

### 3. **Components**
- ✅ `/components/public/KBPublicView.tsx` - Public KB article viewer
  - Accessible via `/kb/{slug}` route
  - No authentication required (configurable)
  - Mobile-optimized layout
  - Password protection support
  - Tracks page views

- ✅ `/components/kb/QRCodeToggle.tsx` - QR toggle popover
  - Enable/disable QR codes
  - Location metadata input
  - Live QR preview
  - Download PNG/SVG
  - Download count tracking

- ✅ `/components/kb/QRArchiveWarningModal.tsx` - Archive warning
  - Warns when archiving/deleting tracks with active QR codes
  - Shows location and download count
  - Prevents accidental breakage of printed QR codes

---

## 📦 Required Dependencies

Install these packages:

```bash
npm install qr-code-styling nanoid jspdf
```

**Libraries:**
- `qr-code-styling` - QR code generation with logo overlays
- `nanoid` - Unique ID generation for slugs
- `jspdf` - PDF generation for batch printing (Phase 2)

---

## 🚀 Integration Steps

### Step 1: Run Database Migration

```sql
-- In Supabase SQL Editor, run:
-- /MIGRATION_KB_QR_CODES.sql
```

Verify tables are updated:

```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'tracks' 
AND column_name IN ('kb_slug', 'kb_qr_enabled', 'kb_qr_location', 'kb_qr_downloaded_count');

SELECT column_name FROM information_schema.columns 
WHERE table_name = 'organizations' 
AND column_name IN ('kb_privacy_mode', 'kb_shared_password', 'kb_logo_url');
```

### Step 2: Add Public KB Route

In your main router file (e.g., `/App.tsx` or `/routes.tsx`):

```tsx
import { KBPublicView } from './components/public/KBPublicView';

// Add route:
<Route path="/kb/:slug" element={<KBPublicView />} />
```

This route should be **outside** any authentication guards.

### Step 3: Integrate QR Toggle in KB Article View

In your Knowledge Base article detail component (wherever you display a KB article to admins):

```tsx
import { QRCodeToggle } from './components/kb/QRCodeToggle';

// In the article header, add:
<div className="flex items-center justify-between mb-6">
  <h1>{track.title}</h1>
  
  <div className="flex items-center gap-2">
    {/* Existing actions (share, edit, etc.) */}
    
    {/* QR Code Toggle - Only for admins */}
    {userIsAdmin && (
      <QRCodeToggle 
        track={track} 
        onUpdate={() => {
          // Refresh track data
          refetchTrack();
        }}
      />
    )}
  </div>
</div>
```

### Step 4: Add Archive Warning

In your archive/delete handlers:

```tsx
import { QRArchiveWarningModal } from './components/kb/QRArchiveWarningModal';

const [showQRWarning, setShowQRWarning] = useState(false);

async function handleArchiveTrack() {
  // Check if track has active QR code
  if (track.kb_qr_enabled) {
    setShowQRWarning(true);
    return; // Don't proceed until user confirms
  }
  
  // Proceed with archive
  await archiveTrack();
}

// In render:
<QRArchiveWarningModal
  open={showQRWarning}
  onOpenChange={setShowQRWarning}
  onConfirm={async () => {
    setShowQRWarning(false);
    await archiveTrack(); // Confirmed - proceed
  }}
  track={track}
  actionType="archive" // or "delete"
/>
```

### Step 5: Add Organization KB Settings Tab

Create a new tab in the Organization settings page:

```tsx
// In Organization.tsx or OrganizationSettings.tsx

<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="roles">Roles</TabsTrigger>
    <TabsTrigger value="knowledge-base">Knowledge Base</TabsTrigger>
  </TabsList>
  
  <TabsContent value="knowledge-base">
    {/* Privacy Settings Card */}
    {/* QR Code Branding Card */}
    {/* Batch Print Card (Phase 2) */}
  </TabsContent>
</Tabs>
```

See the original spec for the full implementation of the KB settings tab.

---

## 🎨 Design Specifications

### QR Code Frame Design

```
┌─────────────────────────┐
│  SCAN FOR REFERENCE     │ ← Header (18px bold, black)
│                         │
│   ┌───────────────┐     │
│   │               │     │
│   │   QR CODE     │     │ ← QR with logo overlay (400x400px)
│   │   [LOGO]      │     │
│   │               │     │
│   └───────────────┘     │
│                         │
│  Article Title Here     │ ← Title (16px bold, wrapped)
│  Location: Break Room   │ ← Location (12px gray, optional)
└─────────────────────────┘
```

### Colors
- **Primary**: `#F64A05` (Trike orange) - QR dots
- **Border**: `#000000` (Black) - 8px border
- **Background**: `#FFFFFF` (White)
- **Text**: `#000000` (Black) for title/header
- **Location**: `#666666` (Gray) for location text

### Error Correction
- **Level H (High)** - 30% of QR can be obscured
- Logo covers 30% of center area
- QR remains scannable with logo overlay

---

## 🧪 Testing Checklist

### Basic Functionality
- [ ] Toggle QR ON for a KB article → slug is generated
- [ ] Toggle QR OFF → `kb_qr_enabled` set to false
- [ ] Toggle QR back ON → same slug is reused (doesn't regenerate)
- [ ] Enter location metadata → saves to `kb_qr_location`
- [ ] Location appears in QR preview

### QR Code Generation
- [ ] QR preview renders correctly in popover
- [ ] Organization logo appears in QR code (if configured)
- [ ] Fallback to Trike logo if org logo not set
- [ ] QR code is scannable with phone camera

### Downloads
- [ ] Download PNG → file downloads with correct filename
- [ ] Download SVG → file downloads correctly
- [ ] Download count increments after each download
- [ ] Downloaded count displays in popover

### Public KB View
- [ ] Scan QR code with phone → opens `/kb/{slug}` route
- [ ] Public KB view loads without login (privacy mode: public)
- [ ] Video player works on mobile
- [ ] Article content displays correctly
- [ ] "Powered by Trike" footer appears

### Privacy Modes
- [ ] Privacy mode "public" → no login required
- [ ] Privacy mode "password" → shows password prompt
- [ ] Correct password → shows article
- [ ] Incorrect password → shows error
- [ ] Privacy mode "employee_login" → redirects to login

### Content Updates
- [ ] Update article content → QR code still works
- [ ] QR link shows latest published version
- [ ] Slug doesn't change when title is updated

### Archive/Delete Protection
- [ ] Archive track with QR enabled → warning modal appears
- [ ] Warning modal shows location and download count
- [ ] Cancel → doesn't archive
- [ ] Confirm → archives and QR link shows "not available"
- [ ] Delete track with QR enabled → same warning behavior

### Edge Cases
- [ ] Archived track QR scan → shows "not available" message
- [ ] Unpublished track QR scan → shows "not available"
- [ ] Track removed from KB → shows "not available"
- [ ] Slug collision (rare) → generates new slug with longer ID
- [ ] Missing org logo → QR still generates without logo
- [ ] Very long title → truncates in QR frame
- [ ] Very long location → truncates properly

---

## 🔧 Server-Side Updates Needed

### Add Slug Generation Endpoint (Optional)

If you want slug generation to happen server-side:

```typescript
// In /supabase/functions/server/index.tsx

app.post("/make-server-2858cc8b/generate-kb-slug", async (c) => {
  const { title, trackId } = await c.req.json();
  
  const slug = generateUniqueSlug(title);
  
  // Update track
  const { error } = await supabase
    .from('tracks')
    .update({ kb_slug: slug })
    .eq('id', trackId);
  
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  
  return c.json({ slug });
});
```

### Add Privacy Check Middleware

For the public KB route, add middleware to check org privacy settings:

```typescript
app.get("/make-server-2858cc8b/kb/:slug/check-access", async (c) => {
  const { slug } = c.req.param();
  
  // Fetch track and org settings
  const { data: track } = await supabase
    .from('tracks')
    .select('*, organizations(kb_privacy_mode, kb_shared_password)')
    .eq('kb_slug', slug)
    .single();
  
  if (!track) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  return c.json({
    privacyMode: track.organizations.kb_privacy_mode,
    requiresPassword: track.organizations.kb_privacy_mode === 'password'
  });
});
```

---

## 📈 Phase 2 Features (Future)

These are documented but not yet implemented:

### 1. **Batch Print to PDF**
Generate multi-page PDFs with 4 QR codes per page (2x2 grid) for bulk printing.

**Library**: `jspdf`

**UI Location**: Organization > Knowledge Base tab > "Batch Print QR Codes" card

### 2. **Scan Analytics Dashboard**
- Total scans this week
- Breakdown by article, location, time of day
- Most scanned articles
- Peak scan times

**Data Source**: `kb_page_views` table (already created)

### 3. **QR Code Expiration**
- Optional expiry date field
- After expiry, show custom message
- Auto-disable QR codes on expiry

### 4. **Multi-Language Frames**
- Generate QR frames in Spanish, Vietnamese, etc.
- Organization setting: "Default QR language"

### 5. **Print Templates**
- Avery label formats
- Dymo/Zebra printer layouts
- Badge cards with lanyard holes

---

## 🐛 Troubleshooting

### QR Code Doesn't Scan
- **Issue**: QR code not scannable
- **Fix**: Ensure error correction level is set to 'H' (high)
- **Fix**: Logo should not exceed 30% of QR area
- **Fix**: Minimum QR size should be 200x200px

### Slug Collision
- **Issue**: Duplicate slug error
- **Fix**: `generateKBSlug()` includes retry logic with longer IDs
- **Check**: Ensure UNIQUE constraint on `kb_slug` column

### Logo Not Showing in QR
- **Issue**: Organization logo doesn't appear
- **Fix**: Check CORS settings for logo image
- **Fix**: Ensure `crossOrigin: 'anonymous'` in QR options
- **Fallback**: QR will render without logo if image fails

### Public KB Route 404
- **Issue**: `/kb/{slug}` returns 404
- **Fix**: Ensure route is added to router
- **Fix**: Route must be OUTSIDE authentication guards
- **Check**: Verify track has `show_in_knowledge_base = true`

### Password Protection Not Working
- **Issue**: Password prompt doesn't appear
- **Fix**: Check `kb_privacy_mode` in organizations table
- **Fix**: Ensure `kb_shared_password` is set

---

## 📝 Files Summary

### Created Files
1. `/MIGRATION_KB_QR_CODES.sql` - Database migration
2. `/lib/qr-code-utils.ts` - QR generation utilities
3. `/components/public/KBPublicView.tsx` - Public KB viewer
4. `/components/kb/QRCodeToggle.tsx` - QR toggle popover
5. `/components/kb/QRArchiveWarningModal.tsx` - Archive warning
6. `/KB_QR_IMPLEMENTATION_GUIDE.md` - This guide

### Files to Modify
1. Main router - Add `/kb/:slug` route
2. KB article detail view - Add `<QRCodeToggle />` component
3. Archive/delete handlers - Add `<QRArchiveWarningModal />` check
4. Organization settings - Add Knowledge Base tab (Phase 2)

---

## 🎯 Success Criteria

✅ Admins can toggle QR codes ON/OFF for KB articles  
✅ Admins can specify physical location for QR codes  
✅ QR codes download as PNG and SVG  
✅ QR codes are scannable and link to public KB view  
✅ Public KB view works on mobile without login  
✅ Archive warning prevents accidental QR code breakage  
✅ Slug generation is collision-resistant  
✅ Organization logos appear in QR codes  
✅ Privacy modes (public, password, employee_login) work correctly  

---

## 🚀 Deployment

1. **Run database migration** in Supabase SQL Editor
2. **Install dependencies**: `npm install qr-code-styling nanoid jspdf`
3. **Add public route** to router configuration
4. **Integrate components** into existing KB views
5. **Test thoroughly** using the checklist above
6. **Deploy** and verify QR codes are scannable

---

**Need help?** Check the original spec or refer to component source code for detailed implementation examples.
