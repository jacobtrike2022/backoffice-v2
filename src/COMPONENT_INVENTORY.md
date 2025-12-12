# Component Inventory - Trike Backoffice LMS

**PURPOSE:** This file lists all reusable components to prevent duplication.

**RULE:** Before creating any modal, selector, picker, or form component, CHECK THIS FILE FIRST to see if it already exists.

---

## 🏷️ Tag Management

### TagSelectorDialog
**File:** `/components/TagSelectorDialog.tsx`  
**Used In:** Content Authoring, Units, Knowledge Base, People, Playlists, Forms  
**Purpose:** Universal tag selector modal for ALL tag categories

**Features:**
- ✅ Dark mode compliant (uses design-system.json theme tokens)
- ✅ Automatically adapts to light/dark mode
- ✅ Category grouping with folder icons (CONTENT TYPE, TOPIC CATEGORY, DIFFICULTY LEVEL, DEPARTMENT, EQUIPMENT TYPE, etc.)
- ✅ Multi-select with tag pills (not checkboxes)
- ✅ Orange accent with gradient backgrounds for selected tags
- ✅ Check icon for selected tags
- ✅ "Create New Tag" button with inline creation
- ✅ Tag management (edit/delete) with permission controls
- ✅ "X tags selected" counter in footer
- ✅ Filter by system category (content, units, people, knowledge-base, forms, shared)
- ✅ Restrict to specific parent tag name

**Usage:**
```typescript
import { TagSelectorDialog } from './components/TagSelectorDialog';

<TagSelectorDialog
  isOpen={boolean}
  onClose={() => void}
  selectedTags={string[]}  // Array of tag names
  onTagsChange={(tags: string[], tagObjects?: Tag[]) => void}
  systemCategory="units" | "content" | "people" | "knowledge-base" | "forms" | "shared"
  allowManagement={boolean}  // Optional: Allow editing/deleting tags
  canManageSystemTags={boolean}  // Optional: Allow managing system-locked tags
  restrictToParentName={string}  // Optional: Only show tags under specific parent
/>
```

**Props Explained:**
- `isOpen` - Controls dialog visibility
- `onClose` - Called when user clicks Cancel or closes
- `selectedTags` - Array of currently selected tag names (e.g., ["High Traffic", "Flagship"])
- `onTagsChange` - Called when user clicks "Apply Tags" with new selection
- `systemCategory` - Filters tags to specific system (required)
- `allowManagement` - Shows edit/delete buttons on tags
- `canManageSystemTags` - Allows editing system-locked tags (super admin only)
- `restrictToParentName` - Only shows tags under specific parent category

**Visual Features:**
- Tag pills with colored backgrounds matching tag color or orange default
- Selected tags show gradient background and check icon
- Unselected tags show transparent background with colored text/border
- Folder icon + uppercase category headers
- Loading spinner and empty states
- Professional hover effects

**⚠️ DO NOT CREATE:**
- UnitTagSelector ❌
- ContentTagPicker ❌
- TagSelectionModal ❌
- TagSelector ❌ (old component, deleted)
- PeopleTagSelector ❌
- KnowledgeBaseTagPicker ❌
- Any other tag selector ❌

**✅ ALWAYS USE:** TagSelectorDialog (this one component for all tag selection)

**Migration Notes:**
- Old `TagSelector` component was deleted on December 12, 2024
- It used white backgrounds, checkboxes, and hardcoded colors
- All pages now use `TagSelectorDialog` with proper theming

---

## 📍 Location/District Selectors

### DistrictSelector
**File:** `/components/DistrictSelector.tsx`  
**Used In:** Units (New Unit modal)  
**Purpose:** Select or create districts for units

**Features:**
- ✅ Dark mode compliant
- ✅ Create new district inline
- ✅ Auto-refresh on creation
- ✅ Organization-filtered
- ✅ Shows district name and code
- ✅ Modal dialog with list selection

**Usage:**
```typescript
import { DistrictSelector } from './components/DistrictSelector';

<DistrictSelector
  districts={District[]}
  selectedId={string | null}
  onSelect={(id: string) => void}
  onClose={() => void}
  onDistrictCreated={() => void}
/>
```

**Props Explained:**
- `districts` - Array of available districts to choose from
- `selectedId` - Currently selected district ID (if any)
- `onSelect` - Called when user selects a district
- `onClose` - Called when user closes without selecting
- `onDistrictCreated` - Called after new district is created (for refresh)

**⚠️ DO NOT CREATE:**
- LocationPicker ❌
- DistrictPicker ❌
- RegionSelector ❌
- Any duplicate district selector ❌

**✅ ALWAYS USE:** DistrictSelector

---

## 🔐 Authentication

### Login
**File:** `/components/Login.tsx`  
**Used In:** App.tsx (unauthenticated users)  
**Purpose:** Email/password login and signup

**Features:**
- ✅ Toggle between sign in and sign up modes
- ✅ Branded design with design-system.json colors
- ✅ Form validation
- ✅ Error messaging with toast notifications
- ✅ Dark mode compliant
- ✅ Gradient brand button
- ✅ Supabase auth integration

**Usage:**
```typescript
import Login from './components/Login';

if (!user) {
  return <Login />;
}
```

**Auth Flow:**
1. User enters email/password
2. Component calls Supabase auth
3. On success, App.tsx receives authenticated user
4. App automatically shows dashboard

**⚠️ DO NOT CREATE:**
- SignInForm ❌
- AuthModal ❌
- LoginScreen ❌
- SignUpPage ❌

**✅ ALWAYS USE:** Login

**Important Notes:**
- Do NOT create LinkAuthUserModal (was removed December 12, 2024)
- Users must have `auth_user_id` set in database during signup
- No manual account linking system needed

---

## 📝 Rich Text Editing

### RichTextEditor
**File:** `/components/RichTextEditor.tsx`  
**Used In:** Content Authoring (Articles, Stories, Checkpoints)  
**Purpose:** WYSIWYG editor for long-form content

**Features:**
- ✅ Formatting toolbar (bold, italic, underline, lists, etc.)
- ✅ Dark mode support
- ✅ Placeholder text
- ✅ HTML output
- ✅ Read-only mode for previews

**Usage:**
```typescript
import { RichTextEditor } from './components/RichTextEditor';

<RichTextEditor
  value={string}  // HTML string
  onChange={(html: string) => void}
  placeholder="Start writing..."
  readOnly={boolean}
/>
```

**⚠️ DO NOT CREATE:**
- ContentEditor ❌
- TextEditor ❌
- MarkdownEditor ❌ (we use HTML, not Markdown)
- WYSIWYGEditor ❌

**✅ ALWAYS USE:** RichTextEditor

---

## 🗂️ File/Attachment Management

### AttachmentPreviewDialog
**File:** `/components/AttachmentPreviewDialog.tsx`  
**Used In:** Content Authoring, Knowledge Base  
**Purpose:** Preview and download attachments

**Features:**
- ✅ Shows file icon based on type (PDF, image, video, etc.)
- ✅ File size display
- ✅ Download button
- ✅ Modal dialog
- ✅ Dark mode compliant

**Usage:**
```typescript
import { AttachmentPreviewDialog } from './components/AttachmentPreviewDialog';

<AttachmentPreviewDialog
  isOpen={boolean}
  onClose={() => void}
  attachment={{
    file_name: string,
    file_size: number,
    file_type: string,
    public_url: string
  }}
/>
```

**⚠️ DO NOT CREATE:**
- FilePreview ❌
- DocumentViewer ❌
- MediaPreview ❌

**✅ ALWAYS USE:** AttachmentPreviewDialog

---

## 🎨 Design System Rules

### Color Tokens (from design-system.json)

**NEVER HARDCODE COLORS.** Always use these theme-aware classes:

**Backgrounds:**
- `bg-background` - Main app background (white in light, dark in dark mode)
- `bg-card` - Card/modal backgrounds (white in light, gray-800 in dark)
- `bg-accent` - Hover/active states (gray-100 in light, gray-700 in dark)
- `bg-primary` - Brand orange (#f97316)
- `bg-muted` - Subtle backgrounds (gray-100 in light, gray-800 in dark)

**Text:**
- `text-foreground` - Primary text (black in light, white in dark)
- `text-muted-foreground` - Secondary text (gray-600 in light, gray-400 in dark)
- `text-primary` - Brand orange text (#f97316)
- `text-primary-foreground` - Text on orange backgrounds (white)

**Borders:**
- `border-border` - Default borders (gray-200 in light, gray-700 in dark)
- `border-primary` - Accent borders (orange)
- `border-input` - Input borders (gray-300 in light, gray-600 in dark)

**Interactive States:**
- `hover:bg-accent` - Hover background
- `hover:border-primary` - Hover border
- `hover:text-primary` - Hover text

**Shadows:**
- `shadow-sm` - Subtle shadow
- `shadow-md` - Medium shadow
- `shadow-lg` - Large shadow
- `shadow-brand` - Branded orange shadow (use with `bg-brand-gradient`)

**Brand Gradients:**
- `bg-brand-gradient` - Orange to red gradient for primary buttons
- `hero-primary` - Button variant with brand gradient

### Why This Matters

Using theme tokens means:
✅ Components automatically work in light mode
✅ Components automatically work in dark mode
✅ No manual dark mode classes needed (no `dark:` prefix required)
✅ Consistent design across the app
✅ Easy to update design system centrally

**❌ NEVER DO THIS:**
```typescript
className="bg-white text-black"  // Hardcoded colors - breaks in dark mode
className="bg-gray-800 dark:bg-gray-900"  // Manual dark mode - unnecessary
style={{ background: '#ffffff' }}  // Inline styles - not theme-aware
className="border-gray-200"  // Hardcoded border - inconsistent
```

**✅ ALWAYS DO THIS:**
```typescript
className="bg-card text-foreground"  // Theme tokens - works everywhere
className="bg-primary text-primary-foreground"  // Brand colors
className="border-border"  // Theme-aware borders
className="hover:bg-accent"  // Theme-aware interactions
```

**Tailwind v4.0 Typography Tokens:**
```css
/* In /styles/globals.css - DO NOT override these in components */
h1, h2, h3 { /* Font sizes and weights are already defined */ }
```
- ⚠️ Do NOT use `text-2xl`, `font-bold`, `leading-none` unless specifically requested
- ✅ Use semantic HTML tags (h1, h2, h3) and let globals.css handle styling

---

## 📋 Component Creation Checklist

Before creating ANY new component, ask yourself:

1. **Does a similar component already exist in this file?**
   - If YES → Use the existing one
   - If NO → Continue

2. **Is this component reusable across multiple pages?**
   - If YES → Add it to this inventory after creating it
   - If NO → It can be a page-specific component

3. **Does it use theme tokens from design-system.json?**
   - If NO → Fix it before merging
   - Check: No `bg-white`, no `text-gray-900`, no hardcoded colors

4. **Does it work in both light and dark modes?**
   - If NO → Use theme tokens, not hardcoded colors
   - Test: Toggle dark mode and verify appearance

5. **Does it follow existing UX patterns?**
   - Check: Similar spacing, sizing, interactions as other components
   - Match: Button styles, modal layouts, form patterns

6. **Is it documented?**
   - Add to this file with usage examples
   - Include props explanation
   - List what NOT to create (duplicates)

---

## 🔄 Updating This File

**When creating a NEW reusable component:**

1. Create the component
2. Test it in both light and dark modes
3. Verify it uses theme tokens (no hardcoded colors)
4. Add it to this file with:
   - File location
   - Purpose
   - Features list
   - Usage example with TypeScript
   - Props explanation
   - What NOT to create (duplicates)
   - Visual description (if applicable)

**When REFACTORING a component:**

1. Update this file with new location/name
2. Update usage examples
3. Mark old component as deprecated
4. Add migration notes

**When DELETING a component:**

1. Add note to "Migration Notes" section
2. Explain why it was deleted
3. Document what replaced it
4. Include date of deletion

---

## 🏗️ UI Component Library

We use **shadcn/ui** components for base UI elements. These are already styled with theme tokens.

**Available shadcn Components:**
- `Button` - `/components/ui/button.tsx`
- `Input` - `/components/ui/input.tsx`
- `Label` - `/components/ui/label.tsx`
- `Dialog` - `/components/ui/dialog.tsx`
- `Select` - `/components/ui/select.tsx`
- `Badge` - `/components/ui/badge.tsx`
- `Card` - `/components/ui/card.tsx`
- `Checkbox` - `/components/ui/checkbox.tsx`
- `Switch` - `/components/ui/switch.tsx`
- `Textarea` - `/components/ui/textarea.tsx`
- `Tabs` - `/components/ui/tabs.tsx`

**⚠️ DO NOT CREATE:**
- Custom button components (use shadcn Button with variants)
- Custom input components (use shadcn Input)
- Custom modal components (use shadcn Dialog)

**✅ ALWAYS USE:** shadcn/ui components from `/components/ui/`

---

## ❌ Common Mistakes to Avoid

### 1. Creating duplicate components
**Problem:** Building a new tag selector instead of using TagSelectorDialog  
**Solution:** Check this file first, search codebase for similar functionality

**Example:**
```typescript
// ❌ DON'T DO THIS
export function UnitTagPicker() {
  // Custom implementation
}

// ✅ DO THIS
import { TagSelectorDialog } from './components/TagSelectorDialog';
<TagSelectorDialog systemCategory="units" ... />
```

### 2. Hardcoding colors
**Problem:** Using `bg-white`, `text-gray-900` breaks dark mode  
**Solution:** Use theme tokens from design-system.json

**Example:**
```typescript
// ❌ DON'T DO THIS
<div className="bg-white text-black border-gray-200">

// ✅ DO THIS  
<div className="bg-card text-foreground border-border">
```

### 3. Building light-mode-only components
**Problem:** Component looks broken in dark mode  
**Solution:** Use theme tokens, they automatically handle both modes

**Example:**
```typescript
// ❌ DON'T DO THIS (manual dark mode)
<div className="bg-white dark:bg-gray-800 text-black dark:text-white">

// ✅ DO THIS (automatic)
<div className="bg-card text-foreground">
```

### 4. Ignoring existing patterns
**Problem:** New component doesn't match existing UX  
**Solution:** Follow examples in this file, match spacing and interactions

### 5. Not checking this file before building
**Problem:** Wasting time building something that exists  
**Solution:** Read this file first, every time

### 6. Using deprecated components
**Problem:** Using old `TagSelector` instead of `TagSelectorDialog`  
**Solution:** Check migration notes, use current versions

---

## 📚 Additional Resources

- **Design System:** `/design-system.json` - Complete token reference
- **Global Styles:** `/styles/globals.css` - Typography and base styles
- **UI Components:** `/components/ui/` - shadcn/ui base components
- **Production Readiness:** `/PEOPLE_PAGE_PRODUCTION_READINESS.md` - Example analysis

---

## 🚀 Quick Reference

**Need a tag selector?** → Use `TagSelectorDialog`  
**Need a district selector?** → Use `DistrictSelector`  
**Need a login form?** → Use `Login`  
**Need a rich text editor?** → Use `RichTextEditor`  
**Need a file preview?** → Use `AttachmentPreviewDialog`  
**Need a button?** → Use shadcn `Button`  
**Need a modal?** → Use shadcn `Dialog`  
**Need an input?** → Use shadcn `Input`  

**Before creating anything:** Check this file first! 🔍

---

**Last Updated:** December 12, 2024  
**Maintained By:** Figma Make AI  
**Reviewed By:** Product Manager

**Recent Changes:**
- December 12, 2024: Initial creation
- December 12, 2024: Documented TagSelectorDialog (replaced old TagSelector)
- December 12, 2024: Added design system rules and common mistakes section
