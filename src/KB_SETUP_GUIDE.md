# 🎯 Knowledge Base QR Code Setup Guide

## Current Issue
The QR code viewer is showing: **"organization_not_found"**

This is because the `organizations` table is missing the KB columns needed for privacy settings and branding.

---

## ✅ Quick Fix (2 Minutes)

### Step 1: Add KB Columns to Database

1. **Open your Supabase Dashboard**: https://supabase.com/dashboard
2. **Navigate to**: SQL Editor (left sidebar)
3. **Copy and paste** the entire contents of `/ADD_KB_COLUMNS.sql`
4. **Click "Run"**
5. **Verify** you see: ✅ KB columns added successfully!

### Step 2: Refresh the QR Link

Visit your QR code URL again:
```
https://sticky-web-65379292.figma.site/?slug=selling-alcohol-in-c-stores-K8qBZm
```

**It should now work!** 🎉

---

## 🔒 Privacy Mode Options

After adding the columns, you can control who can access your Knowledge Base:

### Option 1: Public (Default - Current Setting)
**Anyone with the QR code can access**
```sql
UPDATE organizations 
SET kb_privacy_mode = 'public'
WHERE id = '10000000-0000-0000-0000-000000000001';
```

### Option 2: Password Protected
**Users must enter a shared password**
```sql
UPDATE organizations 
SET 
  kb_privacy_mode = 'password',
  kb_shared_password = 'your-password-here'
WHERE id = '10000000-0000-0000-0000-000000000001';
```

### Option 3: Employee Login Required
**Users must sign in with their employee account**
```sql
UPDATE organizations 
SET kb_privacy_mode = 'employee_login'
WHERE id = '10000000-0000-0000-0000-000000000001';
```

---

## 🎨 Add Your Organization Logo

### Add a single logo (works for both light/dark mode):
```sql
UPDATE organizations 
SET kb_logo_url = 'https://your-cdn.com/logo.png'
WHERE id = '10000000-0000-0000-0000-000000000001';
```

### Add separate logos for light and dark mode:
```sql
UPDATE organizations 
SET 
  kb_logo_light = 'https://your-cdn.com/logo-light.png',
  kb_logo_dark = 'https://your-cdn.com/logo-dark.png'
WHERE id = '10000000-0000-0000-0000-000000000001';
```

**Upload your logo to Supabase Storage first:**
1. Go to Storage in Supabase Dashboard
2. Create a bucket called `organization-logos` (make it public)
3. Upload your logo
4. Copy the public URL
5. Use that URL in the SQL above

---

## 🧪 Testing Different Privacy Modes

1. **Test Public Mode**: Just visit the QR URL - should work immediately
2. **Test Password Mode**: Set password in SQL, refresh QR URL, enter password
3. **Test Employee Login**: Set to employee_login, refresh QR URL, redirects to login

---

## 📊 How the Privacy Flow Works

```
User scans QR code
  ↓
Frontend requests /kb/public/{slug}
  ↓
Backend checks organization privacy_mode
  ↓
┌─────────────┬──────────────────┬──────────────────────┐
│   PUBLIC    │    PASSWORD      │   EMPLOYEE LOGIN     │
├─────────────┼──────────────────┼──────────────────────┤
│ Show content│ Show password    │ Redirect to login    │
│ immediately │ prompt           │ page                 │
└─────────────┴──────────────────┴──────────────────────┘
```

---

## 🐛 Troubleshooting

### Still seeing "organization_not_found"?
1. Verify the SQL ran successfully in Supabase
2. Check the organization exists: `SELECT * FROM organizations WHERE id = '10000000-0000-0000-0000-000000000001';`
3. Check browser console for errors

### Article content not showing?
- The backend now uses the `transcript` field as fallback if `article_body` is null
- Should work automatically

### Tags not showing?
- This is a separate issue with the `track_tags` junction table
- Non-critical - doesn't block QR functionality

---

## 📝 Database Schema Reference

### Organizations Table KB Columns:
```sql
kb_privacy_mode   TEXT     -- 'public' | 'password' | 'employee_login'
kb_shared_password TEXT    -- Password for 'password' mode
kb_logo_url        TEXT    -- Single logo URL (fallback)
kb_logo_dark       TEXT    -- Logo for dark mode
kb_logo_light      TEXT    -- Logo for light mode
```

---

## 🎯 Next Steps After Setup

Once the KB columns are added and working:

1. **Add your company logo** (see section above)
2. **Choose your privacy mode** (public/password/employee login)
3. **Test the QR code** with different devices
4. **Share QR codes** with your team

---

## 💡 Pro Tips

- **Password Mode**: Great for internal-only content that's not highly sensitive
- **Employee Login**: Best for compliance training or sensitive material
- **Public Mode**: Perfect for customer-facing FAQs or public resources
- **Logos**: Use PNG or SVG, recommend 200x50px max size
- **Multiple Orgs**: Each organization can have its own privacy settings

---

**Need help?** Check the console logs in your browser (F12) for detailed error messages.
