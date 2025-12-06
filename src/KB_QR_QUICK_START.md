# 🚀 KB QR Code - Quick Start Guide

## Installation (5 minutes)

### 1. Install Dependencies
```bash
npm install qr-code-styling nanoid jspdf
```

### 2. Run Database Migration
```sql
-- In Supabase SQL Editor, run:
-- /MIGRATION_KB_QR_CODES.sql
```

### 3. Add Public Route
```tsx
// In your router file (App.tsx or similar)
import { KBPublicView } from './components/public/KBPublicView';

// Add route OUTSIDE authentication guards:
<Route path="/kb/:slug" element={<KBPublicView />} />
```

---

## Integration (10 minutes)

### Add QR Toggle to KB Article View

```tsx
// In your Knowledge Base article detail component
import { QRCodeToggle } from './components/kb/QRCodeToggle';

// In the article header:
<div className="flex items-center justify-between">
  <h1>{track.title}</h1>
  
  <div className="flex gap-2">
    {/* Your existing actions */}
    
    {/* QR Code Toggle */}
    {userIsAdmin && (
      <QRCodeToggle 
        track={track} 
        onUpdate={() => refetchTrack()}
      />
    )}
  </div>
</div>
```

### Add Archive Warning

```tsx
// In your archive/delete handler
import { QRArchiveWarningModal } from './components/kb/QRArchiveWarningModal';
import { useState } from 'react';

const [showQRWarning, setShowQRWarning] = useState(false);

async function handleArchive() {
  // Check for active QR code
  if (track.kb_qr_enabled) {
    setShowQRWarning(true);
    return; // Don't proceed
  }
  
  await archiveTrack();
}

// In render:
<QRArchiveWarningModal
  open={showQRWarning}
  onOpenChange={setShowQRWarning}
  onConfirm={async () => {
    setShowQRWarning(false);
    await archiveTrack(); // User confirmed
  }}
  track={track}
  actionType="archive"
/>
```

---

## Usage

### For Admins

1. **Enable QR Code**
   - View a Knowledge Base article
   - Click "Enable QR" button in the header
   - QR code popover opens

2. **Add Location**
   - Enter where the QR will be posted (e.g., "Break Room")
   - Location auto-saves and appears on printed QR

3. **Download QR Code**
   - Click "Download PNG" for high-quality print
   - Or "Download SVG" for vector editing
   - Print and post in the specified location

### For Employees

1. **Scan QR Code**
   - Open phone camera
   - Point at QR code
   - Tap notification to open link

2. **View Content**
   - Article loads in mobile browser
   - No login required (if public)
   - Read/watch content

---

## Testing

### Quick Test (2 minutes)

1. **Enable QR**
   ```
   ✓ Click "Enable QR" on a KB article
   ✓ See popover with QR preview
   ✓ Enter location: "Test Location"
   ```

2. **Download**
   ```
   ✓ Click "Download PNG"
   ✓ File downloads: qr-{slug}-{date}.png
   ```

3. **Scan**
   ```
   ✓ Open phone camera
   ✓ Scan downloaded QR code
   ✓ Link opens: /kb/{slug}
   ✓ Article displays correctly
   ```

4. **Archive Warning**
   ```
   ✓ Try to archive the track
   ✓ Warning modal appears
   ✓ Shows location and download count
   ✓ Cancel → doesn't archive
   ```

---

## Troubleshooting

### "QR code not scannable"
- Ensure you're using PNG download (not screenshot)
- Check phone camera has QR scanning enabled
- Minimum QR size is 200x200px

### "Route /kb/:slug returns 404"
- Verify route is added to router
- Route must be OUTSIDE auth guards
- Check track has `show_in_knowledge_base = true`

### "Logo doesn't appear in QR"
- Check organization `kb_logo_url` is set
- Ensure logo image is accessible (CORS)
- QR will work without logo if image fails

### "Slug collision error"
- Very rare - retry automatic
- Check `kb_slug` column has UNIQUE constraint
- Function retries with longer ID (8 chars vs 6)

---

## File Reference

```
/MIGRATION_KB_QR_CODES.sql              Database migration
/lib/qr-code-utils.ts                   Core utilities
/components/public/KBPublicView.tsx     Public KB viewer
/components/kb/QRCodeToggle.tsx         QR toggle popover
/components/kb/QRArchiveWarningModal    Archive warning
/KB_QR_IMPLEMENTATION_GUIDE.md          Full documentation
```

---

## Support

- **Full Guide**: See `/KB_QR_IMPLEMENTATION_GUIDE.md`
- **Status**: See `/KB_QR_STATUS.md`
- **Migration**: See `/MIGRATION_KB_QR_CODES.sql`

---

**That's it!** Your QR code system is ready to use. 🎉

Enable QR codes on KB articles, download print-ready files, and let employees scan to access reference materials instantly.
