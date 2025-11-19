# 📘 SUPABASE CONVERSION GUIDE

## Complete guide for converting all components from mock data to real Supabase operations

---

## 🎯 CONVERSION PATTERN

Every component should follow this standard pattern:

### 1. **Import Required Dependencies**

```typescript
// React
import { useState, useEffect } from 'react';

// Hooks
import { useCurrentUser, useTracks, useForms, useUsers, useAssignments } from '../lib/hooks/useSupabase';
import { useUserProgress, useKBArticles } from '../lib/hooks/useSupabaseData';

// CRUD Functions
import * as crud from '../lib/crud';

// UI Components
import { Skeleton } from './ui/skeleton';
import { toast } from 'sonner@2.0.3';
```

### 2. **Replace Mock Data with Hooks**

**BEFORE:**
```typescript
const mockEmployees = [
  { id: '1', name: 'John', ... },
  { id: '2', name: 'Jane', ... }
];
```

**AFTER:**
```typescript
const { users, loading, error } = useUsers({ status: 'active' });
```

### 3. **Add Loading States**

```typescript
if (loading) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
    </div>
  );
}
```

### 4. **Add Error Handling**

```typescript
if (error) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <p className="text-red-700">Error loading data: {error.message}</p>
      <Button onClick={() => refetch()} className="mt-2">Retry</Button>
    </div>
  );
}
```

### 5. **Wire Up Mutations**

```typescript
const handleCreateUser = async (userData: CreateUserInput) => {
  try {
    setCreating(true);
    await crud.createUser(userData);
    toast.success('User created successfully!');
    refetch(); // Refresh list
    setShowDialog(false);
  } catch (error) {
    console.error('Error creating user:', error);
    toast.error('Failed to create user');
  } finally {
    setCreating(false);
  }
};
```

### 6. **Add Optimistic UI (Optional)**

```typescript
const handleToggleStatus = async (userId: string, newStatus: string) => {
  // Optimistically update UI
  const optimisticUsers = users.map(u =>
    u.id === userId ? { ...u, status: newStatus } : u
  );
  setUsers(optimisticUsers);

  try {
    await crud.updateUser(userId, { status: newStatus });
    toast.success('Status updated');
  } catch (error) {
    // Revert on error
    refetch();
    toast.error('Failed to update status');
  }
};
```

---

## 📋 COMPONENT CONVERSION CHECKLIST

For each component, complete these steps:

### **Phase 1: Data Fetching**
- [ ] Import necessary hooks
- [ ] Replace mock data with hooks
- [ ] Add loading state UI
- [ ] Add error handling UI
- [ ] Test data loads correctly

### **Phase 2: Create Operations**
- [ ] Add create form/dialog
- [ ] Wire up `crud.create*()` function
- [ ] Add success/error toasts
- [ ] Refetch data after create
- [ ] Close dialog on success

### **Phase 3: Update Operations**
- [ ] Add edit button/dialog
- [ ] Pre-fill form with existing data
- [ ] Wire up `crud.update*()` function
- [ ] Add optimistic updates (optional)
- [ ] Refetch data after update

### **Phase 4: Delete Operations**
- [ ] Add delete button
- [ ] Add confirmation dialog
- [ ] Wire up `crud.delete*()` or `crud.expire*()` function
- [ ] Add success toast
- [ ] Refetch data after delete

### **Phase 5: Search & Filters**
- [ ] Convert search to Supabase query
- [ ] Convert filters to Supabase query
- [ ] Add debouncing for search
- [ ] Update URL params (optional)

### **Phase 6: Pagination**
- [ ] Add page state
- [ ] Use `offset` and `limit` in query
- [ ] Add pagination controls
- [ ] Show total count

---

## 🔧 COMPONENT-SPECIFIC CONVERSIONS

### **People.tsx**

**Key Changes:**
```typescript
// Replace mock employees
const { users, loading, error } = useUsers({
  role_id: selectedRole,
  store_id: selectedStore,
  status: 'active',
  search: searchQuery
});

// Add create user
const handleCreateUser = async (data) => {
  const { user, inviteUrl } = await crud.createUser(data);
  toast.success(`User created! Invite: ${inviteUrl}`);
  refetch();
};

// Add update user
const handleUpdateUser = async (userId, updates) => {
  await crud.updateUser(userId, updates);
  toast.success('User updated');
  refetch();
};
```

### **ContentLibrary.tsx**

**Key Changes:**
```typescript
// Replace mock tracks
const { tracks, loading, error } = useTracks({
  type: selectedType, // 'video', 'article', 'story', 'checkpoint'
  status: 'published',
  search: searchQuery
});

// View track
const handleViewTrack = async (trackId) => {
  const track = await crud.getTrackById(trackId);
  await crud.incrementTrackViews(trackId);
  setSelectedTrack(track);
};
```

### **ContentAuthoring.tsx**

**Key Changes:**
```typescript
const [track, setTrack] = useState(null);
const [saving, setSaving] = useState(false);

// Autosave on change
useEffect(() => {
  if (track?.id && hasChanges) {
    const timer = setTimeout(async () => {
      await crud.updateTrack({ id: track.id, ...changes });
      toast.success('Saved', { duration: 1000 });
    }, 1000);
    return () => clearTimeout(timer);
  }
}, [track, changes]);

// Create track
const handleCreateTrack = async (type) => {
  const newTrack = await crud.createTrack({
    title: 'Untitled',
    type,
    status: 'draft'
  });
  setTrack(newTrack);
};

// Publish track
const handlePublish = async () => {
  await crud.publishTrack(track.id);
  toast.success('Published!');
  navigate('/content-library');
};

// Upload media
const handleUploadMedia = async (file, type) => {
  const url = await crud.uploadTrackMedia(track.id, file, type);
  setTrack({ ...track, [type === 'content' ? 'content_url' : 'thumbnail_url']: url });
};
```

### **Playlists.tsx**

**Key Changes:**
```typescript
// Fetch playlists (need to add to CRUD)
const [playlists, setPlaylists] = useState([]);

useEffect(() => {
  async function fetchPlaylists() {
    const { data } = await supabase
      .from('playlists')
      .select('*, playlist_albums(album:albums(*))')
      .eq('organization_id', user.organization_id)
      .order('created_at', { ascending: false });
    setPlaylists(data);
  }
  fetchPlaylists();
}, []);

// Create playlist
const handleCreatePlaylist = async (data) => {
  const { data: playlist } = await supabase
    .from('playlists')
    .insert({
      organization_id: user.organization_id,
      title: data.title,
      description: data.description,
      type: data.type, // 'manual' or 'auto'
      trigger_rules: data.trigger_rules
    })
    .select()
    .single();
  
  toast.success('Playlist created!');
  refetch();
};

// Run auto-playlist trigger
const handleRunTrigger = async (playlistId) => {
  const assignments = await crud.runPlaylistTrigger(playlistId);
  toast.success(`Created ${assignments.length} assignments`);
};
```

### **Assignments.tsx**

**Key Changes:**
```typescript
const { assignments, loading, error } = useAssignments({
  status: selectedStatus,
  assignable_type: selectedType
});

// Create assignment via wizard
const handleCreateAssignment = async (data) => {
  await crud.createAssignment(data);
  toast.success('Assignment created!');
  refetch();
};

// Update due date
const handleUpdateDueDate = async (assignmentId, newDate) => {
  await crud.updateAssignment(assignmentId, { due_date: newDate });
  toast.success('Due date updated');
  refetch();
};

// Expire assignment
const handleExpireAssignment = async (assignmentId) => {
  await crud.expireAssignment(assignmentId);
  toast.success('Assignment expired');
  refetch();
};
```

### **Forms.tsx** (+ FormBuilder, FormLibrary, FormSubmissions)

**Key Changes:**
```typescript
// FormLibrary
const { forms, loading, error } = useForms({
  type: selectedType,
  status: 'published'
});

// FormBuilder
const handleAddBlock = async (block) => {
  const newBlock = await crud.addFormBlock(formId, {
    ...block,
    display_order: blocks.length
  });
  setBlocks([...blocks, newBlock]);
};

const handleReorderBlocks = async (newOrder) => {
  await crud.reorderFormBlocks(formId, newOrder);
  setBlocks(newOrder);
};

const handleDeleteBlock = async (blockId) => {
  await crud.deleteFormBlock(blockId);
  setBlocks(blocks.filter(b => b.id !== blockId));
};

// FormSubmissions
const { submissions, loading, error, refetch } = useFormSubmissions(formId);

const handleApprove = async (submissionId) => {
  await crud.approveFormSubmission(submissionId, user.id);
  toast.success('Submission approved');
  refetch();
};

const handleReject = async (submissionId) => {
  await crud.rejectFormSubmission(submissionId, user.id);
  toast.success('Submission rejected');
  refetch();
};
```

### **KnowledgeBase.tsx**

**Key Changes:**
```typescript
const { articles, loading, error } = useKBArticles({
  category_id: selectedCategory,
  status: 'published',
  search: searchQuery
});

const { categories } = useKBCategories();

// Create article (admin/manager only)
const handleCreateArticle = async (data) => {
  const article = await crud.createKBArticle(data);
  toast.success('Article created!');
  navigate(`/kb/${article.id}`);
};

// View article (auto-increment views)
const handleViewArticle = async (articleId) => {
  const article = await crud.getKBArticleById(articleId, true);
  setSelectedArticle(article);
};

// Upload attachment
const handleUploadAttachment = async (file) => {
  const url = await crud.uploadKBAttachment(selectedArticle.id, file);
  toast.success('Attachment uploaded!');
};
```

### **ComplianceDashboard.tsx**

**Key Changes:**
```typescript
const { certifications: expiring } = useExpiringCertifications(30);

// Run certification status update
useEffect(() => {
  async function updateStatuses() {
    await crud.updateCertificationStatuses();
  }
  updateStatuses();
  const interval = setInterval(updateStatuses, 24 * 60 * 60 * 1000); // Daily
  return () => clearInterval(interval);
}, []);
```

### **Settings.tsx**

**Key Changes:**
```typescript
// Org settings (need to add to schema/CRUD)
const [orgSettings, setOrgSettings] = useState(null);

useEffect(() => {
  async function fetchSettings() {
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', user.organization_id)
      .single();
    setOrgSettings(data);
  }
  fetchSettings();
}, []);

// Update settings
const handleUpdateSettings = async (updates) => {
  await supabase
    .from('organizations')
    .update(updates)
    .eq('id', user.organization_id);
  toast.success('Settings updated');
};

// Integrations (encrypt before saving)
const handleSaveIntegration = async (integration) => {
  // TODO: Add encryption for sensitive config
  const encryptedConfig = btoa(JSON.stringify(integration.config));
  
  await supabase
    .from('integrations')
    .upsert({
      organization_id: user.organization_id,
      name: integration.name,
      type: integration.type,
      config: encryptedConfig,
      is_active: true
    });
  
  toast.success('Integration saved');
};
```

---

## 🚨 COMMON PITFALLS TO AVOID

1. **Forgetting to refetch after mutations**
   ```typescript
   // BAD
   await crud.createUser(data);
   // Users list doesn't update!

   // GOOD
   await crud.createUser(data);
   refetch(); // or use optimistic update
   ```

2. **Not handling loading states**
   ```typescript
   // BAD
   return <div>{users.map(...)}</div>; // Crashes on undefined

   // GOOD
   if (loading) return <Skeleton />;
   return <div>{users.map(...)}</div>;
   ```

3. **Not catching errors**
   ```typescript
   // BAD
   await crud.createUser(data); // Uncaught promise rejection

   // GOOD
   try {
     await crud.createUser(data);
   } catch (error) {
     console.error(error);
     toast.error('Failed to create user');
   }
   ```

4. **Using wrong hook dependencies**
   ```typescript
   // BAD
   useEffect(() => {
     fetchData();
   }, [filters]); // Infinite loop if filters is an object

   // GOOD
   useEffect(() => {
     fetchData();
   }, [JSON.stringify(filters)]);
   ```

5. **Forgetting organization_id filtering**
   - All queries MUST filter by `organization_id`
   - Use `getCurrentUserOrgId()` helper
   - RLS policies will enforce this, but add explicitly for clarity

---

## ✅ TESTING CHECKLIST

After converting each component:

- [ ] Data loads correctly on mount
- [ ] Loading states display properly
- [ ] Errors are caught and displayed
- [ ] Create operation works
- [ ] Update operation works
- [ ] Delete operation works
- [ ] Search/filters work
- [ ] Pagination works (if applicable)
- [ ] Toasts display for success/error
- [ ] No console errors
- [ ] No infinite loops
- [ ] Data refetches after mutations
- [ ] Optimistic updates work (if implemented)

---

## 🎓 ADDITIONAL RESOURCES

- **CRUD Functions:** See `/lib/crud/*` for all available operations
- **Hooks:** See `/lib/hooks/useSupabase.ts` for custom hooks
- **Database Schema:** See migration script for table structure
- **Business Rules:** See `CRUD_IMPLEMENTATION_SUMMARY.md`
