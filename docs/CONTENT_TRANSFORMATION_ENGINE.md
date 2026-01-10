# Content Transformation Engine (CTE)

## Project Overview

The Content Transformation Engine is Trike Backoffice 2.0's document intelligence system. It transforms legacy enterprise documents (PDFs, Word docs, PowerPoints, spreadsheets, SCORM packages) into structured, tagged, role-aware training content that lives and breathes within the platform.

### The Problem We're Solving

Enterprise multi-unit employers (convenience stores, QSRs, foodservice operations) have accumulated 10-20 years of operational knowledge trapped in artifacts that are fractured across departments, difficult to maintain, impossible to search, and completely disconnected from how employees actually learn and work. These include employee handbooks, operational policy manuals, procedure notebooks, SOPs, job aides, memos, checklists, and legacy SCORM packages.

### The Solution

CTE provides a drag-and-drop ingestion system that extracts, structures, chunks, tags, and connects document content to Trike's training ecosystem. Instead of manually recreating content, admins upload their existing artifacts and CTE does the heavy lifting: parsing, cleaning, suggesting article splits, auto-tagging, detecting duplicates, identifying compliance-sensitive content, and linking everything back to source files for version management.

### Why This Matters (The "Damn" Moments)

1. **Instant Parse**: Upload a 180-page handbook → 60 seconds later see it broken into 43 suggested articles, auto-tagged, with topic mapping.

2. **Intelligence Layer**: System flags compliance gaps ("Sections 4.2-4.7 contain alcohol policies. Georgia requires specific refusal verbiage we didn't find. Generate state-compliant variant?")

3. **Overlap Detection**: "Found 3 sections duplicating your Food Safety SOP. Consolidate to single source of truth?"

4. **Role Connection**: "This handbook references 14 job titles. Matched 11 to existing roles. Create the other 3?"

5. **Living Link**: Upload updated handbook 6 months later → system shows which derived articles need review with change diffs.

---

## Technical Foundation

### Existing Infrastructure (What We're Building On)

| Component | Location | Purpose |
|-----------|----------|---------|
| `source_files` table | `00021_source_files.sql` | Stores uploaded documents, extraction status, metadata |
| `SourcesManagement.tsx` | `src/components/` | Drag-drop upload UI, file listing, type selection |
| `tracks` table | `00001_initial_schema.sql` | Content library (articles, videos, checkpoints) |
| `facts` table | `MIGRATION_FACTS_TABLES.sql` | Atomic knowledge units, key facts |
| `trike-server` edge function | `supabase/functions/trike-server/` | Backend API router (OpenAI, AssemblyAI, etc.) |
| `extract-job-description` function | `supabase/functions/extract-job-description/` | PDF/DOCX parsing + structured extraction |
| Tag RAG system | `TagRecommendationPanel.tsx` + migrations | AI-powered tag suggestions |
| Variant pipeline | `00023-00026` migrations | State/company/unit variant generation |

### New Schema (Added for CTE)

```sql
-- Link tracks back to source files (provenance tracking)
ALTER TABLE tracks 
ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES source_files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tracks_source_file ON tracks(source_file_id);

-- Chunk suggestions table (AI-proposed article splits)
CREATE TABLE IF NOT EXISTS source_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file_id UUID NOT NULL REFERENCES source_files(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT NOT NULL,
  content_markdown TEXT, -- Preserved formatting
  
  display_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'suggested' CHECK (status IN ('suggested', 'approved', 'rejected', 'published', 'merged')),
  
  -- Source location markers
  source_start_marker TEXT, -- Where this chunk starts in source
  source_end_marker TEXT,   -- Where this chunk ends in source
  
  -- AI metadata
  chunk_reasoning TEXT,           -- Why AI split here
  suggested_tags TEXT[],          -- Pre-computed tag suggestions
  compliance_flags TEXT[],        -- Detected compliance topics
  duplicate_warning_track_id UUID REFERENCES tracks(id),
  duplicate_score DECIMAL(3,2),   -- Similarity to existing content
  
  -- Playbook detection
  detected_playbook TEXT CHECK (detected_playbook IN ('job_description', 'handbook', 'sop', 'checklist', 'policy', NULL)),
  playbook_confidence DECIMAL(3,2),
  
  -- When published
  published_track_id UUID REFERENCES tracks(id),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_chunks_source ON source_chunks(source_file_id);
CREATE INDEX IF NOT EXISTS idx_source_chunks_status ON source_chunks(status);
CREATE INDEX IF NOT EXISTS idx_source_chunks_org ON source_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_source_chunks_playbook ON source_chunks(detected_playbook) WHERE detected_playbook IS NOT NULL;

-- Link roles to source files (for JD playbook)
ALTER TABLE roles 
ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES source_files(id) ON DELETE SET NULL;

-- Source file versioning (for lifecycle management)
CREATE TABLE IF NOT EXISTS source_file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file_id UUID NOT NULL REFERENCES source_files(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  version_number INTEGER NOT NULL,
  previous_version_id UUID REFERENCES source_file_versions(id),
  
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  
  -- Change detection
  change_summary TEXT,           -- AI-generated summary of changes
  affected_chunk_ids UUID[],     -- Which chunks might need updates
  diff_data JSONB,               -- Structured diff information
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_source_versions_file ON source_file_versions(source_file_id);

-- RLS policies for source_chunks
ALTER TABLE source_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chunks for their organization"
  ON source_chunks FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can manage chunks for their organization"
  ON source_chunks FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Service role full access to chunks"
  ON source_chunks FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

### Edge Function Routes (trike-server additions)

| Route | Method | Purpose |
|-------|--------|---------|
| `/extract-source` | POST | Extract text/structure from uploaded source file |
| `/detect-document-type` | POST | AI analysis of document type with confidence scores |
| `/analyze-chunks` | POST | Generate chunking suggestions for a source file |
| `/check-duplicates` | POST | Vector similarity check against existing library |
| `/detect-playbook` | POST | Identify if document matches a playbook pattern |
| `/publish-chunks` | POST | Batch publish approved chunks as tracks |

### Key Files Reference

```
src/
├── components/
│   ├── SourcesManagement.tsx      # Main upload/list UI (exists)
│   ├── SourceFilePreview.tsx      # Content preview modal (Phase 2)
│   ├── ChunkSuggestionPanel.tsx   # Review/approve chunks (Phase 3)
│   ├── PlaybookDetectionBanner.tsx # Playbook workflow trigger (Phase 5)
│   └── SourceDerivedContent.tsx   # Show linked tracks (Phase 4)
├── lib/
│   ├── api/
│   │   └── sourceTransformation.ts # API client for CTE routes
│   └── utils/
│       └── documentCompression.ts  # Existing compression utility
└── supabase/
    └── migrations/
        └── 00032_content_transformation.sql # CTE schema

supabase/functions/trike-server/
├── index.ts                       # Main router (add CTE routes)
├── extractors/
│   ├── pdf-extractor.ts           # PDF → Markdown
│   ├── docx-extractor.ts          # DOCX → Markdown  
│   └── pptx-extractor.ts          # PPTX → Markdown (future)
├── analyzers/
│   ├── document-type-detector.ts  # AI type classification
│   ├── chunk-suggester.ts         # AI chunking logic
│   └── playbook-detector.ts       # Pattern matching for playbooks
└── publishers/
    └── chunk-publisher.ts         # Chunks → Tracks conversion
```

---

## Phase 1: Extraction Pipeline

**Duration**: Day 1  
**Goal**: Click a source file → get structured content extracted and stored

### Deliverables

1. **`/extract-source` route** in trike-server
   - Accept `source_file_id`
   - Fetch file from storage bucket
   - Parse based on MIME type (PDF via `pdf-parse`, DOCX via `mammoth`)
   - Clean and normalize to Markdown
   - Store in `source_files.extracted_text`
   - Update `is_processed = true`, `processed_at = now()`

2. **Auto-trigger on upload**
   - After successful upload in `SourcesManagement.tsx`
   - Call extraction endpoint
   - Show "Processing..." status

3. **Error handling**
   - Store errors in `processing_error` column
   - Retry logic for transient failures
   - User-friendly error messages

### Definition of Done

- [ ] Upload a PDF → `extracted_text` column populated within 30 seconds
- [ ] Upload a DOCX → `extracted_text` column populated
- [ ] Large files (10MB+) handle gracefully with timeout protection
- [ ] Failed extractions show meaningful error in UI
- [ ] `is_processed` and `processed_at` update correctly

### Technical Notes

Reuse parsing logic from `extract-job-description/pdf-parser.ts` and `docx-parser.ts`. The text cleaning function `cleanExtractedText()` is already solid.

For Markdown preservation, enhance the extraction to detect headings (# syntax), lists, and tables where possible. PDF structure detection is limited but DOCX preserves more.

### Phase 1 Changelog

| Date | Change | Notes |
|------|--------|-------|
| — | — | — |

---

## Phase 2: Preview & Document Type Detection

**Duration**: Day 2  
**Goal**: Click a source file → see rich preview → system detects document type

### Deliverables

1. **`SourceFilePreview.tsx` component**
   - Modal dialog triggered from SourcesManagement
   - Renders `extracted_text` as formatted Markdown
   - Shows file metadata (size, type, upload date)
   - Edit capability for extraction corrections

2. **"View Content" action** in file list
   - Button/link on each row
   - Opens preview modal

3. **`/detect-document-type` route**
   - Analyze first 2000-3000 characters
   - Return confidence scores for each `source_type`
   - Structured output schema for consistency

4. **Auto-suggest source type**
   - On extraction complete, call detection
   - If confidence > 80%, auto-set `source_type`
   - If confidence 60-80%, show suggestion badge
   - If < 60%, leave for manual selection

### Definition of Done

- [ ] Click source file → see clean formatted preview (not raw text)
- [ ] Preview shows headings, lists, paragraphs properly
- [ ] System suggests document type with confidence percentage
- [ ] High-confidence suggestions auto-apply
- [ ] User can override/correct suggestions
- [ ] Preview loads in < 2 seconds for typical documents

### Technical Notes

Use `react-markdown` or similar for rendering. Keep it simple—don't need full rich text editor yet.

Document type detection prompt should be explicit about the categories matching the `source_type` enum: `handbook`, `policy`, `procedures`, `communications`, `training_docs`, `other`.

### Phase 2 Changelog

| Date | Change | Notes |
|------|--------|-------|
| — | — | — |

---

## Phase 3: AI Chunking Engine

**Duration**: Day 3  
**Goal**: Generate suggested article splits from source content

### Deliverables

1. **`/analyze-chunks` route**
   - Accept `source_file_id`
   - Retrieve `extracted_text`
   - Call OpenAI with chunking prompt
   - Return array of suggested chunks

2. **Chunking prompt engineering**
   - Target 5-15 articles per document (configurable)
   - Each chunk: title, summary (2-3 sentences), content, reasoning
   - Preserve natural document boundaries (sections, topics)
   - Don't split mid-paragraph or mid-list

3. **`source_chunks` table population**
   - Store each suggestion with status `suggested`
   - Capture start/end markers for source reference
   - Store AI reasoning for transparency

4. **`ChunkSuggestionPanel.tsx` component**
   - List of suggested chunks
   - For each: title, summary, preview snippet
   - Actions: Approve, Reject, Edit, Merge with adjacent
   - Bulk actions: Approve All, Reject All

5. **"Analyze" button** in SourcesManagement
   - Only shows for processed files
   - Triggers chunking analysis
   - Shows progress indicator
   - Opens ChunkSuggestionPanel on complete

### Definition of Done

- [ ] Click "Analyze" → see chunking suggestions within 60 seconds
- [ ] Suggestions have meaningful titles (not "Section 1")
- [ ] Summaries accurately describe chunk content
- [ ] Can approve/reject individual chunks
- [ ] Can edit chunk title and content before publishing
- [ ] Rejected chunks don't appear in publish flow
- [ ] Chunk count shown on source file row

### Technical Notes

Chunking prompt structure:
```
You are analyzing a {document_type} document to split it into standalone training articles.

Guidelines:
- Create 5-15 articles depending on document length
- Each article should cover ONE cohesive topic
- Preserve natural section boundaries
- Don't split mid-paragraph or mid-list
- Title should be action-oriented or topic-clear
- Summary should be 2-3 sentences explaining what the reader will learn

For each chunk, provide:
1. title: Clear, specific title
2. summary: 2-3 sentence description
3. content: The full text for this article
4. reasoning: Why you split here (1 sentence)
5. suggested_tags: 2-5 relevant tags from this list: [...]

Document content:
{extracted_text}
```

### Phase 3 Changelog

| Date | Change | Notes |
|------|--------|-------|
| — | — | — |

---

## Phase 4: Publish to Library

**Duration**: Day 4  
**Goal**: Turn approved chunks into published tracks

### Deliverables

1. **`/publish-chunks` route**
   - Accept array of `chunk_ids`
   - For each: create track record, link to source
   - Trigger tag RAG for auto-tagging
   - Return created track IDs

2. **`source_file_id` on tracks**
   - Links content back to source (provenance)
   - Enables "derived content" queries

3. **"Publish Selected" action**
   - In ChunkSuggestionPanel
   - Publishes all approved chunks
   - Shows progress for batch operations
   - Updates chunk status to `published`

4. **Auto-tag on publish**
   - Call existing tag recommendation system
   - Apply high-confidence tags automatically
   - Store suggestions for medium-confidence

5. **`/check-duplicates` route**
   - Vector similarity against existing tracks
   - Flag > 80% matches with warning
   - Show which existing track is similar

6. **`SourceDerivedContent.tsx` component**
   - Show on source file detail/preview
   - List of tracks derived from this source
   - Link to each track

7. **Derived content badge**
   - In SourcesManagement table
   - "12 articles" badge on source files with published chunks

### Definition of Done

- [ ] Approve chunks → click Publish → tracks appear in library
- [ ] Published tracks have `source_file_id` set correctly
- [ ] Tags auto-applied to published content
- [ ] Duplicate warnings show before publish
- [ ] Can view all content derived from a source file
- [ ] Source file shows count of derived articles
- [ ] Published chunks update status correctly

### Technical Notes

For duplicate detection, if you don't have vector embeddings yet, use a simpler approach: title similarity + first 500 chars content similarity. Can enhance with proper embeddings later.

Track creation should use existing track creation patterns. Set `type: 'article'`, `status: 'published'`, `content_url: null` (content stored in track body or separate content table depending on your structure).

### Phase 4 Changelog

| Date | Change | Notes |
|------|--------|-------|
| — | — | — |

---

## Phase 5: Playbook System (JD Example)

**Duration**: Day 5  
**Goal**: When source_type = "job_description" → trigger role creation flow

### Deliverables

1. **`/detect-playbook` route**
   - Analyze extracted content for playbook patterns
   - Return matched playbook type + confidence
   - JD patterns: "reports to", "responsibilities", "qualifications", "FLSA status"

2. **`PlaybookDetectionBanner.tsx` component**
   - Appears in SourceFilePreview when playbook detected
   - "We detected this is a Job Description. Create a role from it?"
   - Action button triggers playbook flow

3. **JD Playbook flow**
   - Call existing `extract-job-description` function
   - Pre-populate RoleModal with extracted data
   - Link created role to source file via `source_file_id`

4. **Playbook registry (extensible)**
   - Define playbook patterns in config
   - Each playbook: name, detection patterns, action component
   - Future: Handbook, SOP, Checklist playbooks

5. **Role → Source link**
   - Show source file on RoleDetailPage
   - "Extracted from: Employee_Handbook_2024.pdf"

### Definition of Done

- [ ] Upload JD PDF → "Job Description detected" banner appears
- [ ] Click "Create Role" → RoleModal opens with fields pre-filled
- [ ] Created role has `source_file_id` set
- [ ] Role detail shows linked source file
- [ ] Playbook detection works for PDF and DOCX
- [ ] Non-JD documents don't trigger false positives

### Technical Notes

JD detection patterns (in addition to AI analysis):
- Contains "Job Title" or "Position Title"
- Contains "Reports To" or "Supervisor"
- Contains "Responsibilities" or "Duties"
- Contains "Qualifications" or "Requirements"
- Contains "FLSA" or "Exempt/Non-Exempt"

Confidence scoring: Each pattern match adds to confidence. 3+ patterns = high confidence.

### Phase 5 Changelog

| Date | Change | Notes |
|------|--------|-------|
| — | — | — |

---

## Phase 6: Polish & Demo-Ready

**Duration**: Days 6-7  
**Goal**: End-to-end flow works smoothly, ready for demo/testing

### Deliverables

1. **Error handling audit**
   - All routes have try/catch with meaningful errors
   - UI shows errors gracefully (no blank screens)
   - Retry logic for network failures

2. **Loading states**
   - Skeleton loaders for preview
   - Progress indicators for long operations
   - Disabled states during processing

3. **Toast notifications**
   - "Extracting content from document..."
   - "Analysis complete! 12 articles ready for review"
   - "Published 10 articles to your library"
   - Error toasts with actionable messages

4. **Quick demo script**
   - Step-by-step flow for showing CTE
   - Sample documents to use
   - Expected outcomes at each step

5. **Handbook playbook teaser**
   - When handbook detected, offer to create Collection
   - Suggest "New Hire Essentials" collection from first 5 articles
   - Link to onboarding assignment (manual for now)

6. **Metrics/logging**
   - Log extraction times
   - Log chunking results
   - Track publish success rates

### Definition of Done

- [ ] Complete flow: Upload → Preview → Analyze → Review → Publish works without errors
- [ ] All loading states feel responsive
- [ ] Errors are user-friendly and actionable
- [ ] Demo script successfully executed 3 times
- [ ] No console errors during normal flow
- [ ] Performance acceptable (< 2 min for full flow on typical doc)

### Phase 6 Changelog

| Date | Change | Notes |
|------|--------|-------|
| — | — | — |

---

## Future Phases (Post-MVP)

### Phase 7: Version Management
- Upload new version of source file
- Diff detection against previous version
- Flag affected derived content for review
- Change impact analysis

### Phase 8: Additional Playbooks
- **Handbook Playbook**: Auto-create Collection, suggest onboarding assignment
- **SOP Playbook**: Convert to procedure steps, suggest checklist creation
- **Checklist Playbook**: Convert to interactive digital checklist
- **SCORM Playbook**: Extract and liberate content from packages

### Phase 9: Advanced Intelligence
- Vector embeddings for semantic duplicate detection
- Cross-document topic clustering
- Compliance gap detection against state requirements
- Auto-variant generation for state-specific content

### Phase 10: Integrations
- HRIS document sync (auto-import job descriptions)
- SharePoint/Google Drive connectors
- Scheduled re-processing for updated source files

---

## Appendix: Prompt Templates

### Document Type Detection Prompt

```
Analyze this document excerpt and classify it into one of these categories:
- handbook: Employee handbook, company policies, general workplace guidelines
- policy: Specific policy document (single topic), compliance policies
- procedures: Step-by-step procedures, SOPs, how-to guides
- communications: Memos, announcements, newsletters
- training_docs: Training materials, guides, manuals
- other: Doesn't fit above categories

Return JSON with:
{
  "detected_type": "handbook",
  "confidence": 0.92,
  "reasoning": "Document contains table of contents, multiple policy sections, employee conduct guidelines typical of handbooks",
  "alternative_type": "policy",
  "alternative_confidence": 0.15
}

Document excerpt (first 3000 characters):
{content}
```

### Chunking Prompt

```
You are a training content architect. Analyze this {document_type} and split it into standalone training articles.

Rules:
1. Create between {min_chunks} and {max_chunks} articles
2. Each article should cover ONE cohesive topic
3. Respect natural section boundaries (don't split mid-section)
4. Never split mid-paragraph or mid-list
5. Articles should be 200-1500 words each
6. Title should be clear and specific (not "Section 1" or "Introduction")
7. Include ALL content - don't skip sections

For each article, provide:
- title: Clear, actionable or topic-focused title
- summary: 2-3 sentences describing what reader will learn
- content: Full text for this article (preserve formatting)
- start_marker: First 50 characters of this section in source
- end_marker: Last 50 characters of this section in source
- reasoning: One sentence explaining why you split here
- suggested_tags: 2-5 tags from: {available_tags}
- compliance_flags: Any compliance topics detected (food_safety, alcohol, harassment, safety, etc.)

Return as JSON array.

Document:
{extracted_text}
```

### Playbook Detection Prompt

```
Analyze this document and determine if it matches any of these playbook patterns:

1. job_description: Job posting, role description, position requirements
   Indicators: "reports to", "responsibilities", "qualifications", "FLSA", "job title"

2. handbook: Employee handbook, policy manual
   Indicators: Table of contents, multiple policy sections, "employee conduct", "company policies"

3. sop: Standard operating procedure, process document
   Indicators: Numbered steps, "procedure", "process", sequential instructions

4. checklist: Inspection checklist, task checklist
   Indicators: Checkbox items, "check", "verify", "inspect", short line items

5. policy: Single-topic policy document
   Indicators: Single subject focus, "policy", "effective date", "scope"

Return JSON:
{
  "detected_playbook": "job_description" | "handbook" | "sop" | "checklist" | "policy" | null,
  "confidence": 0.85,
  "indicators_found": ["reports to", "responsibilities", "qualifications"],
  "reasoning": "Document structure and terminology strongly indicate this is a job description"
}

Document excerpt:
{content}
```

---

## Appendix: Test Documents

For testing CTE, use these document types:

1. **Simple PDF** (< 5 pages): Single-topic policy
2. **Medium PDF** (10-20 pages): Department procedures manual
3. **Large PDF** (50+ pages): Full employee handbook
4. **DOCX with formatting**: Document with headings, lists, tables
5. **Job Description PDF**: Standard JD format
6. **Scanned PDF** (future): Test OCR limitations

Create or source these for consistent testing across phases.

---

*Last Updated: January 2025*  
*Document Version: 1.0*
