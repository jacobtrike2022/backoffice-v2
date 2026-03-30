# Document Processing UI Flows - Old vs New Architecture

**Date:** January 13, 2026
**Purpose:** Explain the two parallel document processing UI architectures that currently exist in the codebase

---

## Overview

There are **two separate UI flows** for document processing that coexist in the application:

| Flow | Style | Entry Point | Status |
|------|-------|-------------|--------|
| **OLD Flow** | Modal-based (3 nested modals) | SourceFilePreview → ChunkToTrackGenerator/ExtractedEntityProcessor | Still active, used from preview |
| **NEW Flow** | Full-page editor | DocumentIntelligenceEditor | New default from Sources tab |

Both flows ultimately use the same backend endpoints and database tables, but provide different user experiences.

---

## OLD FLOW: Modal-Based Architecture

### User Journey

```
SourcesManagement (file list)
    │
    ├─→ Click "Preview" button
    │       ↓
    │   ┌─────────────────────────────────────────┐
    │   │  SourceFilePreview (Modal #1)           │
    │   │  - View extracted text                  │
    │   │  - Trigger text extraction              │
    │   │  - Detect document type                 │
    │   │  - Generate chunks                      │
    │   │  - View chunk list with checkboxes      │
    │   │  - View detected entities (JDs)         │
    │   │                                         │
    │   │  [Generate Tracks]  [Process Entity]    │
    │   └─────────────────────────────────────────┘
    │           │                    │
    │           ↓                    ↓
    │   ┌───────────────┐    ┌────────────────────────┐
    │   │ ChunkToTrack  │    │ ExtractedEntityProcessor│
    │   │ Generator     │    │ (Modal #3)             │
    │   │ (Modal #2)    │    │                        │
    │   │               │    │ Step 1: Review JD data │
    │   │ - Individual  │    │ Step 2: Duplicate check│
    │   │   tracks      │    │ Step 3: O*NET matching │
    │   │ - Combined    │    │ Step 4: Create role    │
    │   │   track       │    │                        │
    │   └───────────────┘    └────────────────────────┘
```

### Component Files

| Component | Location | Purpose |
|-----------|----------|---------|
| SourceFilePreview | `src/components/SourceFilePreview.tsx` | Main hub modal for file operations |
| ChunkToTrackGenerator | `src/components/ChunkToTrackGenerator.tsx` | Convert chunks → training tracks |
| ExtractedEntityProcessor | `src/components/ExtractedEntityProcessor.tsx` | 4-step wizard: JD → Role |

### SourceFilePreview.tsx

**Entry:** Triggered by "Preview" button in SourcesManagement

**Key Features:**
- Document metadata display (name, type, size)
- Extracted text viewer (collapsible)
- "Extract Text" button (calls `/extract-source`)
- "Detect Type" button (calls `/detect-document-type` - now deprecated)
- "Generate Chunks" button (calls `/chunk-source`)
- Chunk list with:
  - Checkbox selection
  - Title, word count, content preview
  - Content type badge
- "Detected Content" section showing extracted entities
- "Process" button per entity → opens ExtractedEntityProcessor

**Props:**
```typescript
interface SourceFilePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  sourceFile: SourceFile | null;
  onSourceTypeChange?: (newType: string) => void;
}
```

### ChunkToTrackGenerator.tsx

**Entry:** Triggered by selecting chunks in SourceFilePreview and clicking "Generate Tracks"

**Key Features:**
- Two generation modes:
  1. **Individual Tracks** - One track per selected chunk
  2. **Combined Track** - Merge all chunks into one track
- Options:
  - `publishImmediately` - Publish or save as draft
  - `skipAI` - Skip AI enhancement for speed
- Live preview of generated content
- Links to view created tracks

**Props:**
```typescript
interface ChunkToTrackGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedChunks: SourceChunk[];
  sourceFileName: string;
  onTracksGenerated?: (tracks: any[]) => void;
}
```

**Endpoints Used:**
- `POST /generate-tracks-from-chunks` - Individual tracks
- `POST /generate-combined-track` - Combined track

### ExtractedEntityProcessor.tsx

**Entry:** Triggered by clicking "Process" on a detected entity in SourceFilePreview

**4-Step Wizard:**

1. **Review Extraction**
   - Edit role name, department, summary
   - Review extracted skills and qualifications
   - Modify before proceeding

2. **Duplicate Check**
   - Search existing roles for similar names
   - Option to merge with existing role
   - Or create new role

3. **O*NET Matching**
   - Search O*NET occupation database
   - Select standardized occupation profile
   - Links role to official classification

4. **Create Role**
   - Confirmation screen
   - Creates role in database
   - Updates entity status to "completed"
   - Establishes source lineage

**Props:**
```typescript
interface ExtractedEntityProcessorProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: string;
  onProcessComplete: () => void;
}
```

---

## NEW FLOW: Full-Page Editor Architecture

### User Journey

```
Organization Settings → "Sources" tab
    │
    ├─→ SourcesManagement (file list with content type pills)
    │       │
    │       ├─→ Click "Process" badge or menu item
    │       │       ↓
    │       │   ┌─────────────────────────────────────────────────────┐
    │       │   │  DocumentIntelligenceEditor (Full Page)             │
    │       │   │                                                     │
    │       │   │  ┌─────────────────────────────────────────────┐   │
    │       │   │  │ Header: File name, back button, stats       │   │
    │       │   │  └─────────────────────────────────────────────┘   │
    │       │   │                                                     │
    │       │   │  ┌───────────────────────┬─────────────────────┐   │
    │       │   │  │                       │  Margin Sidebar     │   │
    │       │   │  │  Chunk Cards          │  - Linked roles     │   │
    │       │   │  │  (color-coded by      │  - Create role btn  │   │
    │       │   │  │   content type)       │  - Linked tracks    │   │
    │       │   │  │                       │                     │   │
    │       │   │  │  ☐ Policy chunk       │  [No links]         │   │
    │       │   │  │  ☐ JD chunk           │  [Create Role]      │   │
    │       │   │  │  ☐ Procedure chunk    │  [2 tracks]         │   │
    │       │   │  │                       │                     │   │
    │       │   │  └───────────────────────┴─────────────────────┘   │
    │       │   │                                                     │
    │       │   │  [Merge Selected]  [Filter by Type ▼]              │
    │       │   └─────────────────────────────────────────────────────┘
    │       │
    │       └─→ Click "Preview" → OLD FLOW (SourceFilePreview modal)
```

### Component File

| Component | Location | Purpose |
|-----------|----------|---------|
| DocumentIntelligenceEditor | `src/components/DocumentIntelligenceEditor.tsx` | All-in-one document processing |

### DocumentIntelligenceEditor.tsx

**Entry:** Triggered from Organization.tsx Sources tab via `setEditingSourceFileId()`

**Key Features:**

1. **Auto-Processing**
   - Automatically chunks document on load if text exists but no chunks
   - Calls `/chunk-source` with `classify_content: true`
   - No manual "Generate Chunks" button needed

2. **Chunk Display**
   - Notion-style block cards
   - Color-coded left border by content type:
     - Blue = Policy
     - Purple = Procedure
     - Green = Job Description
     - Cyan = Training Materials
     - Gray = Other
   - Expandable/collapsible content
   - Classification confidence indicator

3. **Margin Sidebar (per chunk)**
   - Shows linked roles (green badges)
   - Shows linked tracks (blue badges)
   - "Create Role" button for JD chunks
   - Quick actions without opening modals

4. **Batch Operations**
   - Multi-select chunks via checkboxes
   - Merge contiguous chunks
   - Filter by content type
   - Bulk reclassification (planned)

5. **Content Type Pills**
   - Summary bar showing count per type
   - Click to filter view

**Props:**
```typescript
interface DocumentIntelligenceEditorProps {
  sourceFileId: string;
  onBack: () => void;
  onViewRole?: (roleId: string) => void;
  onCreateRole?: (prefillData: {
    sourceChunkId: string;
    sourceFileId: string;
    entityId: string;
    roleName: string;
    department: string;
    jobDescription: string;
  }) => void;
}
```

**Integration in Organization.tsx:**
```typescript
// State
const [editingSourceFileId, setEditingSourceFileId] = useState<string | null>(null);

// Render
{activeTab === 'sources' && (
  editingSourceFileId ? (
    <DocumentIntelligenceEditor
      sourceFileId={editingSourceFileId}
      onBack={() => setEditingSourceFileId(null)}
      onViewRole={(roleId) => {
        setActiveTab('roles');
        setSelectedRoleId(roleId);
      }}
      onCreateRole={(prefillData) => {
        setActiveTab('roles');
        setSelectedRoleId('new');
        // TODO: Pass prefillData to RoleModal
      }}
    />
  ) : (
    <SourcesManagement
      onOpenEditor={(id) => setEditingSourceFileId(id)}
    />
  )
)}
```

---

## Side-by-Side Comparison

| Aspect | OLD Flow | NEW Flow |
|--------|----------|----------|
| **UI Style** | Nested modals (up to 3 deep) | Single full-page editor |
| **Entry Point** | Preview button → modal | Process badge → full page |
| **Chunking Trigger** | Manual "Generate Chunks" button | Auto on page load |
| **Classification** | Separate "Detect Type" step | Built into chunking |
| **Content Type Display** | Badge per chunk | Color-coded border + filter bar |
| **JD → Role** | 4-step wizard modal | Margin "Create Role" button |
| **Track Generation** | Separate modal (ChunkToTrackGenerator) | Not yet implemented |
| **Linked Content** | Hidden in entity details | Visible in margin sidebar |
| **Chunk Selection** | Checkboxes for track generation | Checkboxes for merge/bulk ops |
| **User Context** | Lose context when modal opens | Stay on same page |

---

## Which Flow to Use When

### Use OLD Flow (SourceFilePreview) when:
- Generating training tracks from chunks (ChunkToTrackGenerator)
- Full 4-step JD processing wizard needed
- Quick file preview without full processing

### Use NEW Flow (DocumentIntelligenceEditor) when:
- Processing new documents
- Reviewing chunk classifications
- Creating roles from JD chunks (simpler flow)
- Bulk chunk operations (merge, filter)
- Understanding document structure at a glance

---

## Code Location Reference

```
src/components/
├── SourcesManagement.tsx        # File list (entry to both flows)
│
├── SourceFilePreview.tsx        # OLD: Main preview modal
├── ChunkToTrackGenerator.tsx    # OLD: Chunk → Track modal
├── ExtractedEntityProcessor.tsx # OLD: JD → Role wizard modal
│
├── DocumentIntelligenceEditor.tsx # NEW: Full-page editor
│
└── Organization.tsx             # Hosts Sources tab, routes to new flow
```

---

## Database Tables Used (Both Flows)

| Table | Purpose |
|-------|---------|
| `source_files` | Uploaded documents with extracted_text |
| `source_chunks` | Document chunks with content_class |
| `extracted_entities` | Detected JDs pending processing |
| `roles` | Created roles from JD extraction |
| `tracks` | Generated training tracks |
| `track_source_chunks` | Links tracks ↔ source chunks |

---

## Migration Path

The OLD flow is not deprecated but the NEW flow is preferred for:
- Better UX (no modal nesting)
- Auto-processing (less manual steps)
- Visible content classification
- Source lineage visibility

**Remaining work to fully migrate:**
1. Add track generation to DocumentIntelligenceEditor
2. Wire up `onCreateRole` to pass prefillData to RoleModal
3. Add bulk reclassification UI
4. Consider deprecating ChunkToTrackGenerator modal

---

## API Endpoints by Flow

### OLD Flow Endpoints
```
POST /extract-source          # Extract text from file
POST /chunk-source            # Basic chunking (no classification)
POST /detect-document-type    # DEPRECATED - returns 410
GET  /chunks/{fileId}         # Fetch chunks
POST /generate-tracks-from-chunks   # Individual tracks
POST /generate-combined-track       # Merged track
GET  /extracted-entities/{fileId}   # List entities
GET  /extracted-entity/{entityId}   # Entity details
POST /search-onet-profiles          # O*NET search
POST /process-extracted-entity      # Mark processed
```

### NEW Flow Endpoints
```
POST /chunk-source            # With classify_content=true
     { source_file_id, classify_content: true }
GET  /chunks/{fileId}         # Fetch classified chunks
POST /extract-source          # If text not yet extracted

# Direct Supabase queries for:
- source_chunks (read/update content_class)
- extracted_entities (read)
- roles (read for linked content)
- track_source_chunks (read for linked tracks)
```

---

## Visual Component Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SourcesManagement                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ File List                                                    │   │
│  │ ┌─────────────────────────────────────────────────────────┐ │   │
│  │ │ manual.pdf  │ Policy(5) JD(2) │ [Preview] [Process ▼]  │ │   │
│  │ └─────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                              │                          │
│           │ OLD FLOW                     │ NEW FLOW                 │
│           ↓                              ↓                          │
│  ┌─────────────────┐          ┌─────────────────────────────────┐  │
│  │SourceFilePreview│          │ DocumentIntelligenceEditor      │  │
│  │    (Modal)      │          │      (Full Page)                │  │
│  │  ┌───────────┐  │          │  ┌─────────────────────────┐   │  │
│  │  │ Chunks    │  │          │  │ Chunk Cards             │   │  │
│  │  │ ☐ chunk 1 │  │          │  │ ████ Policy chunk       │   │  │
│  │  │ ☐ chunk 2 │  │          │  │ ████ JD chunk [→Role]   │   │  │
│  │  └───────────┘  │          │  │ ████ Procedure chunk    │   │  │
│  │ [Generate Tracks]│          │  └─────────────────────────┘   │  │
│  └────────┬────────┘          └─────────────────────────────────┘  │
│           │                                                         │
│           ↓                                                         │
│  ┌─────────────────┐                                               │
│  │ChunkToTrack     │                                               │
│  │Generator (Modal)│                                               │
│  └─────────────────┘                                               │
└─────────────────────────────────────────────────────────────────────┘
```
