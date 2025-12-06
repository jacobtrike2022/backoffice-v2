# 📍 Where to Find the QR Code Feature

## ✅ QR Code Button Location

The QR Code toggle button is now available in the **Knowledge Base** article view.

### How to Access:

1. **Navigate to Knowledge Base**
   - Click "Knowledge Base" in the left sidebar
   - Or navigate directly to the Knowledge Base view

2. **Open an Article**
   - Click on any article card to open the detailed view
   - The article will open in a full-screen modal/view

3. **Find the QR Button**
   - Look at the **top-right action buttons area**
   - The QR button appears next to:
     - 📑 Bookmark button
     - ⬇️ Download PDF button
   - Button label:
     - **"Enable QR"** (gray outline) - when QR is disabled
     - **"QR Active"** (orange) - when QR is enabled

4. **Who Can See It?**
   - **Only Super Admins** can see and use the QR code feature
   - Regular users won't see this button

---

## 🎯 How to Use

### Enable QR Code

1. Click the **"Enable QR"** button
2. A popover opens with:
   - Toggle switch to enable/disable
   - Location input field
   - QR code preview
   - Download buttons

3. **Add Location** (recommended)
   - Enter where the QR will be posted: e.g., "Break Room", "Near Coffee Machine"
   - This helps you manage physical QR codes
   - Location appears on the printed QR code

4. **Download QR Code**
   - Click **"Download PNG"** for high-quality print (recommended)
   - Or **"Download SVG"** for vector editing
   - File downloads as: `qr-{article-slug}-{date}.png`

5. **Print & Post**
   - Print the downloaded QR code
   - Post it in the location you specified
   - Employees can scan it with their phone cameras

---

## 📱 Public KB View (For Scanned QR Codes)

### Option 1: Using the Standalone HTML Page

For the QR codes to work, you need to set up the public viewer:

1. **Open `/kb-public.html`**
   - Update the Supabase credentials at the top:
     ```javascript
     const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
     const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
     ```

2. **Deploy the HTML file**
   - Host it at: `https://yourdomain.com/kb/:slug`
   - Or configure your server to route `/kb/*` to this HTML file

3. **Test the QR Code**
   - After enabling QR on an article, download the code
   - Scan it with your phone
   - It should open the article in mobile view

### Option 2: Integrate with Your Router

If you want to integrate the React component instead:

1. **Install React Router** (if not already):
   ```bash
   npm install react-router-dom
   ```

2. **Update App.tsx** to use routing:
   ```tsx
   import { BrowserRouter, Routes, Route } from 'react-router-dom';
   import { KBPublicView } from './components/public/KBPublicView';

   // Wrap your app:
   <BrowserRouter>
     <Routes>
       <Route path="/kb/:slug" element={<KBPublicView />} />
       <Route path="*" element={<YourMainApp />} />
     </Routes>
   </BrowserRouter>
   ```

---

## 🧪 Testing

### Quick Test (5 minutes)

1. **Enable QR Code**
   - Go to Knowledge Base
   - Open any article
   - Click "Enable QR" (top-right)
   - Enter location: "Test Location"

2. **Download QR Code**
   - Click "Download PNG"
   - File should download

3. **Scan with Phone**
   - Open phone camera
   - Point at downloaded QR code image on your screen
   - Tap the notification
   - Should open the public KB view

4. **Verify Public View**
   - Article title and content display
   - Mobile-optimized layout
   - No login required (if privacy mode is "public")

---

## 🎨 Visual Guide

```
Knowledge Base Article View
┌─────────────────────────────────────────────────┐
│  ← Back                           🔖  ⬇️  📱 QR  │ ← Action buttons
├─────────────────────────────────────────────────┤
│                                                  │
│  How to Clean the Coffee Machine                │
│  ────────────────────────────                    │
│                                                  │
│  [Article content here...]                       │
│                                                  │
└─────────────────────────────────────────────────┘
                                             ↑
                               QR button appears here
```

### QR Code Popover

When you click the QR button:

```
┌────────────────────────────────┐
│  QR Code                    ⚫ │ ← Toggle switch
│  Generate a scannable QR code  │
│                                 │
│  Where will this be posted?     │
│  [Break Room____________]       │
│                                 │
│  Preview:                       │
│  ┌───────────────────┐          │
│  │ SCAN FOR REFERENCE │          │
│  │                    │          │
│  │   [QR CODE IMAGE]  │          │
│  │                    │          │
│  │  Article Title     │          │
│  │  Break Room        │          │
│  └───────────────────┘          │
│                                 │
│  [Download PNG] [Download SVG]  │
│                                 │
│  Downloaded 3 times             │
└────────────────────────────────┘
```

---

## 🔧 Troubleshooting

### "I don't see the QR button"

**Check:**
- Are you viewing an article in Knowledge Base (not just the list)?
- Are you logged in as **Super Admin**?
- Is the article detail view open (full screen)?

**Fix:**
- Make sure you're in the Knowledge Base section
- Open an article by clicking on it
- Verify you have super admin privileges

### "QR code doesn't scan"

**Check:**
- Did you download the PNG file (not screenshot)?
- Is the printed QR code large enough (minimum 2x2 inches)?
- Is there good lighting on the QR code?

**Fix:**
- Re-download as PNG
- Print at larger size
- Ensure good contrast (black QR on white background)

### "QR link shows 'not found'"

**Check:**
- Is the public KB viewer deployed?
- Are Supabase credentials updated in `/kb-public.html`?
- Is the article still published and in Knowledge Base?

**Fix:**
- Deploy the public viewer HTML page
- Update Supabase credentials
- Verify article is published with "Show in Knowledge Base" enabled

---

## 📋 Quick Reference

| Action | Location |
|--------|----------|
| Enable QR | Knowledge Base → Open Article → Top-right "Enable QR" button |
| Add Location | QR Popover → "Where will this be posted?" field |
| Download | QR Popover → "Download PNG" or "Download SVG" |
| Disable QR | QR Popover → Toggle switch OFF |
| Public View | `/kb/{slug}` (requires setup) |

---

## 🎯 Next Steps

1. ✅ **You've found the button** - it's in Knowledge Base article view
2. 🔧 **Set up public viewer** - Deploy `/kb-public.html` with your Supabase credentials
3. 🧪 **Test end-to-end** - Enable QR → Download → Scan → View article
4. 📱 **Deploy to production** - Once tested, print and post QR codes

---

**Need more help?** 
- Full documentation: `/KB_QR_IMPLEMENTATION_GUIDE.md`
- Quick start: `/KB_QR_QUICK_START.md`
- Status: `/KB_QR_STATUS.md`
