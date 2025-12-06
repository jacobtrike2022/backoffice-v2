# Orphaned Figma Make Images Bug - Resolution

## 🐛 The Mystery Bug

**Symptoms:**
- 5 screenshot images appearing at the bottom of published site
- NOT visible in Figma Make preview
- Persist across all browsers (Chrome, Safari, Arc)
- Persist even after clearing cache and rolling back code
- Visible to all users on different networks
- Screenshot tools can't capture them properly

## 🔍 Root Cause Discovered

The images are **NOT in your React codebase** - they're being injected by **Figma Make's build/publish system**.

### Evidence:

1. **Figma-specific CSS classes**: `css-99qiqe`, `css-wc1msa`, `css-xgszvb`, `css-yttfzn`, `css-3izh4e`, `css-2csp8n`
2. **Figma Make asset URLs**: `/_assets/v11/[hash].png`
3. **DOM position**: Rendered OUTSIDE the React `#container` as sibling divs
4. **Code verification**: No references to these asset hashes anywhere in the codebase

### The Orphaned Images:

```
https://sticky-web-65379292.figma.site/_assets/v11/3d388efd6cbf07d022b611216df9c8abb0a3a552.png
https://sticky-web-65379292.figma.site/_assets/v11/f333337cda20847de8c3c04ec4e5bc7cff11c9b5.png
https://sticky-web-65379292.figma.site/_assets/v11/97f6ac3b513161f34ad8e42dabb8dc6caf65b6e6.png
https://sticky-web-65379292.figma.site/_assets/v11/e535dcd3f44013019c2fb6cb2a080e4ba2c07626.png
https://sticky-web-65379292.figma.site/_assets/v11/f260e176c643e801f5669442cea225db2a4abec6.png
```

## ✅ Temporary Fix Applied

Added CSS rules to `/styles/globals.css` to hide these images:

```css
/* Hide specific orphaned image containers */
div.css-99qiqe,
div.css-xgszvb,
div.css-yttfzn,
div.css-3izh4e,
div.css-2csp8n {
  display: none !important;
}

/* Generic fallback for any Figma asset images */
div[class^="css-"]:has(> img[src*="/_assets/v11/"]) {
  display: none !important;
}
```

**Result**: Images are now hidden on the live site! 🎉

## 🔧 Permanent Fix (To Do)

The images exist in **Figma Make's asset system**, not your code. To permanently remove them:

### Option 1: Delete from Figma Make Canvas

1. Open Figma Make in edit mode
2. **Zoom out really far** (Cmd/Ctrl + scroll down)
3. Look for orphaned image elements outside your main app frame
4. Select and delete them
5. Republish

### Option 2: Check Figma Layers Panel

1. Open the Layers panel in Figma Make
2. Search for images with timestamps matching when you uploaded them
3. Look for **hidden layers** or layers **outside artboards**
4. Delete them
5. Republish

### Option 3: Clear from Asset Library

1. Look for an "Assets" or "Resources" panel in Figma Make
2. Find these 5 PNG files (search by hash or date)
3. Delete them from the asset library
4. Republish

### Option 4: Contact Figma Make Support

If the above don't work, this is a Figma Make platform bug:

**Message Template:**

```
I have orphaned images being injected into my published site that don't 
exist in my code. They appear at the bottom of every page as sibling divs 
to my #container element, with Figma-specific classes like css-99qiqe.

Asset hashes:
- 3d388efd6cbf07d022b611216df9c8abb0a3a552
- f333337cda20847de8c3c04ec4e5bc7cff11c9b5
- 97f6ac3b513161f34ad8e42dabb8dc6caf65b6e6
- e535dcd3f44013019c2fb6cb2a080e4ba2c07626
- f260e176c643e801f5669442cea225db2a4abec6

These were accidentally uploaded during a conversation but persist even 
after rolling back my code. They only appear on the published site, not 
in preview. How do I remove them from the build output?
```

## 📋 Why This Happened

When you pasted 6 screenshots to Figma Make during your conversation:
1. Figma Make saved them to its asset storage (`/_assets/v11/`)
2. They got registered as "page components" or "canvas elements"
3. Figma Make's build system now injects them on every page render
4. They're server-side rendered, so code rollbacks don't help

## 🎓 Lessons Learned

- **Figma Make has its own asset system** separate from your React code
- **Build artifacts** can persist even when code is rolled back
- **CSS can hide symptoms** while you fix the root cause
- **DOM inspection** is crucial for debugging mysterious rendering issues

## ✅ Status

- [x] Temporary fix applied (CSS hiding)
- [ ] Permanent fix pending (delete from Figma Make assets)
- [ ] Remove CSS workaround once assets are deleted

## 🗑️ Cleanup Steps (After Permanent Fix)

Once you've deleted the images from Figma Make:

1. Remove the CSS rules from `/styles/globals.css` (lines 668-685)
2. Republish
3. Verify images no longer appear
4. Delete this documentation file

---

**Last Updated**: December 5, 2024  
**Bug Discovered**: Via DOM inspection  
**Impact**: Visual only - no functional impact  
**Severity**: Low (cosmetic issue)  
**Workaround**: Active and effective
