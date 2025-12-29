# Cursor Development Notes

## Footer Component

**IMPORTANT**: The `<Footer />` component must always be included on all new and edited page components.

### Implementation Pattern

1. **Import the Footer component** at the top of the file:
```typescript
import { Footer } from './Footer';
```

2. **Add Footer at the end** of the main content div, just before the closing `</div>` tag:
```typescript
return (
  <div className="space-y-6">
    {/* ... page content ... */}
    <Footer />
  </div>
);
```

### Pages That Include Footer

The following pages currently include the Footer component:
- Dashboard
- Forms
- ContentAuthoring
- ContentLibrary
- People
- Reports
- Units
- NewUnit
- Playlists
- AlbumDetailView
- KnowledgeBaseRevamp
- Settings
- Analytics
- Assignments
- Organization
- RolesManagement
- TagsManagement
- KBSettings
- StoreDetail

### When Creating New Pages

When creating or editing any page component, always:
1. Import `Footer` from `'./Footer'`
2. Add `<Footer />` as the last element before closing the main container div
3. This ensures consistent branding and beta notice across all pages

