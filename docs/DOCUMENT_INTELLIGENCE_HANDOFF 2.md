# Document Intelligence Editor - Handoff Document

**Date:** January 13, 2026
**Status:** Core functionality complete, ready for testing
**Project:** JD Parser / Document Intelligence Editor integration into Trike Backoffice

---

## Executive Summary

The Document Intelligence Editor is a new feature that processes uploaded documents (PDFs, Word docs, etc.), automatically chunks them into logical sections, classifies each chunk by content type, and enables extraction of structured data (like Job Descriptions → Roles). This replaces the old 1:1 document-to-type classification with a 1:many chunk-based approach.

---

## What Was Built

### 1. Database Schema Extensions

**Migration:** `supabase/migrations/20260113100001_content_classification.sql`

- Added columns to `source_chunks` table:
  - `content_class` - Classification type (policy, procedure, job_description, training_materials, other)
  - `content_class_confidence` - AI confidence score (0.00-1.00)
  - `content_class_detected_at` - Timestamp of classification
  - `is_extractable` - Boolean for chunks containing standalone entities
  - `extraction_status` - Status: pending, extracted, skipped, failed

- Created `content_type_registry` table for extensible content types

- Created `extracted_entities` table for tracking extracted data from chunks

### 2. Content Classification System

**Location:** `supabase/functions/trike-server/index.ts`

**5 Content Types:**

| Type | Description | Example | Extractable |
|------|-------------|---------|-------------|
| `policy` | Rules, expectations, standards | Sexual Harassment Policy | No |
| `procedure` | Step-by-step instructions | How to Change Register Paper | No |
| `job_description` | Role definitions with duties/qualifications | Store Manager JD | **Yes** → Roles |
| `training_materials` | Checklists, guides, OJT (catchall) | Manager Training Checklist | No |
| `other` | Miscellaneous content | Forms, tables | No |

**Pattern Detection:**
- `JD_PATTERNS` - 20+ regex patterns for job description detection
- `POLICY_PATTERNS` - 14 patterns for policy content
- `PROCEDURE_PATTERNS` - 15 patterns for procedural content
- `TRAINING_PATTERNS` - 20 patterns for training materials

**AI Classifier:** Falls back to GPT-4 for low-confidence classifications (<75%)

### 3. Document Chunking Algorithm

**Location:** `supabase/functions/trike-server/index.ts` - `splitIntoSections()`

**Multi-level fallback strategy:**
1. Section patterns (numbered sections, ALL CAPS headers)
2. Double newlines (`\n\n`)
3. Single newlines with sentence boundaries
4. Sentence-based chunking
5. Character-based chunking (last resort)

**Key endpoints:**
- `POST /chunk-source` - Chunks document with built-in classification
- `GET /chunks/:source_file_id` - Retrieves chunks for a document
- `POST /detect-document-type` - **DEPRECATED** (returns 410 Gone)

### 4. Frontend Components

**DocumentIntelligenceEditor.tsx** (`src/components/DocumentIntelligenceEditor.tsx`)
- Full-page Notion-like editor for processing documents
- Color-coded chunk cards by content type
- Auto-processing when entering a document with extracted text
- Chunk selection for batch operations
- Entity extraction triggers for JD chunks

**SourcesManagement.tsx** (`src/components/SourcesManagement.tsx`)
- Displays detected content type pills (rollup of chunk classifications)
- Clickable badges to open Document Intelligence Editor
- Removed old source type dropdown

**Integration in Organization.tsx:**
```typescript
{activeTab === 'sources' && (
  editingSourceFileId ? (
    <DocumentIntelligenceEditor
      sourceFileId={editingSourceFileId}
      onBack={() => setEditingSourceFileId(null)}
      onViewRole={(roleId) => { /* navigate to role */ }}
      onCreateRole={(prefillData) => { /* create role with prefill */ }}
    />
  ) : (
    <SourcesManagement onOpenEditor={(id) => setEditingSourceFileId(id)} />
  )
)}
```

---

## Bug Fixes Applied

### 1. ActivityFeed Ambiguous Relationship
**File:** `src/lib/crud/activity.ts`
**Issue:** Supabase query failed with "Could not embed because more than one relationship was found"
**Fix:** Added explicit FK: `role:roles!users_role_id_fkey(name)`

### 2. Empty chunkIds Query Error
**File:** `src/components/DocumentIntelligenceEditor.tsx`
**Issue:** Query to `track_source_chunks` with empty array caused 400 error
**Fix:** Added guard: `if (chunkIds.length === 0) return {};`

### 3. Zero Chunks for Large Documents
**File:** `supabase/functions/trike-server/index.ts`
**Issue:** 27-page documents with single newlines returned 0 chunks
**Fix:** Enhanced `splitIntoSections()` with multi-level fallback strategy

---

## Architecture Decisions

### 1:Many Classification Model
A single document can now contain multiple content types. For example, an Employee Handbook might contain:
- 5 Policy chunks
- 3 Procedure chunks
- 2 Job Description chunks
- 10 Training Material chunks

This is a fundamental shift from the old 1:1 document-to-type model.

### Deprecated Endpoint
`POST /detect-document-type` returns 410 Gone with migration guide:
```json
{
  "error": "This endpoint is deprecated...",
  "migration_guide": {
    "old_flow": "POST /detect-document-type → returns single document type",
    "new_flow": "POST /chunk-source { source_file_id, classify_content: true }"
  }
}
```

---

## Files Modified (Complete List)

### Backend (trike-server)
- `supabase/functions/trike-server/index.ts`
  - Added 5 content type definitions and pattern arrays
  - Updated `classifyChunkContent()` with multi-type detection
  - Updated `classifyChunkContentWithAI()` with clear type guidance
  - Enhanced `splitIntoSections()` with robust fallbacks
  - Deprecated `handleDetectDocumentType()`

### Frontend
- `src/components/DocumentIntelligenceEditor.tsx`
  - Changed from React Router to props-based component
  - Added auto-processing on load
  - Updated CONTENT_TYPES to match backend
  - Added empty chunkIds guard

- `src/components/SourcesManagement.tsx`
  - Replaced dropdown with content type pills
  - Added `loadContentSummaries()` for chunk aggregation
  - Updated CONTENT_TYPE_CONFIG

- `src/components/Organization.tsx`
  - Integrated DocumentIntelligenceEditor
  - Added `editingSourceFileId` state

- `src/lib/crud/activity.ts`
  - Fixed ambiguous FK reference

- `src/lib/services/uploadService.ts`
  - Updated SourceType definition

### Database Migrations
- `supabase/migrations/20260113100001_content_classification.sql`
  - Updated content_type_registry with 5 types
  - Updated column comments

---

## What's Left To Do

### 1. Deploy Edge Function
The trike-server edge function needs to be redeployed for chunking fixes to take effect:
```bash
npx supabase functions deploy trike-server
```

### 2. Test Auto-Processing Flow
1. Upload a document
2. Verify text extraction runs
3. Navigate to document in Sources
4. Verify auto-chunking/classification happens
5. Verify content type pills appear

### 3. JD → Role Creation Flow
The `onCreateRole` callback is wired up but needs the RoleModal to accept prefill data:
```typescript
onCreateRole={(prefillData) => {
  // prefillData contains: sourceChunkId, sourceFileId, entityId, roleName, department, jobDescription
  setActiveTab('roles');
  setSelectedRoleId('new');
  // TODO: Pass prefillData to RoleDetailPage/RoleModal
}}
```

### 4. Future Content Type Flows
Build dedicated chunk-to-content flows for:
- **Procedure** → Training Tracks (step-by-step modules)
- **Policy** → Compliance Training Tracks
- **Training Materials** → Training Tracks (direct conversion)

### 5. Chunk Editing Features (Backlog)
- Merge chunks (combine related content)
- Split chunks (break apart mixed content)
- Reclassify chunks (manual override)
- Move text between chunks

---

## Testing Checklist

- [ ] Upload PDF with mixed content (policies + JDs + procedures)
- [ ] Verify chunks are created with correct classifications
- [ ] Verify content type pills show in Sources list
- [ ] Verify auto-processing when entering document
- [ ] Verify JD chunks show "Create Role" action
- [ ] Test with single-newline document (no `\n\n`)
- [ ] Test with large document (50+ pages)
- [ ] Verify ActivityFeed no longer shows relationship error
- [ ] Verify no API key errors in console

---

## Key Code Locations

| Feature | File | Line/Function |
|---------|------|---------------|
| Content type definitions | `trike-server/index.ts` | Line 1354-1457 |
| Pattern matching | `trike-server/index.ts` | `classifyChunkContent()` |
| AI classification | `trike-server/index.ts` | `classifyChunkContentWithAI()` |
| Document chunking | `trike-server/index.ts` | `splitIntoSections()` |
| Chunk endpoint | `trike-server/index.ts` | `handleChunkSource()` |
| Frontend editor | `DocumentIntelligenceEditor.tsx` | Full component |
| Auto-processing | `DocumentIntelligenceEditor.tsx` | `autoProcessDocument()` |
| Content pills | `SourcesManagement.tsx` | `CONTENT_TYPE_CONFIG` |

---

## Contact / Questions

This feature integrates with:
- **Source Files** - Upload and text extraction
- **Roles** - JD extraction target
- **Tracks** - Future extraction target for procedures/training

The system is designed to be extensible. Adding new content types requires:
1. Add to `ContentClass` type
2. Add pattern array
3. Add to `classifyChunkContent()` priority
4. Add to AI prompt
5. Add to frontend CONTENT_TYPE_CONFIG
6. Add to content_type_registry seed data
