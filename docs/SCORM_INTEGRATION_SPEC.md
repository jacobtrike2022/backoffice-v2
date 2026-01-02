# SCORM Unwrapper Integration Specification

## Overview

This document provides the technical specifications for integrating a SCORM file unwrapper/extractor with the Trike Backoffice LMS platform. The goal is to enable automatic creation of learning content (articles, videos, stories, and checkpoints) from SCORM packages.

**Target Integration**: The SCORM unwrapper will eventually be deployed as a Supabase Edge Function within this project, enabling seamless content import workflows.

---

## Strategic Decision: RAG Agent Review vs Raw Acceptance

### The Question

Should the SCORM unwrapper use the RAG agent (Brain system) to intelligently review extracted content and make decisions about:
- **Deduplication**: Detecting content that already exists in the library
- **Consolidation**: Determining if multiple SCORM items should be merged into single tracks
- **Optimization**: Suggesting better content organization than raw SCORM structure

Or should it simply accept raw outputs from the extractor and create tracks directly?

### Analysis: Three Approaches

#### Approach 1: Raw Acceptance (Direct Import)

**Workflow:**
```
SCORM File → Extract → Parse → Create Tracks → Done
```

**Pros:**
- ✅ **Fast**: No AI processing overhead, immediate import
- ✅ **Predictable**: Exact 1:1 mapping from SCORM to tracks
- ✅ **Simple**: Minimal complexity, easier to debug
- ✅ **Preserves Structure**: Maintains original SCORM organization
- ✅ **No False Positives**: Won't incorrectly merge or skip content

**Cons:**
- ❌ **Duplicates**: May create duplicate content if SCORM overlaps with existing library
- ❌ **Fragmentation**: May split content that should be together (e.g., 5-page article becomes 5 separate tracks)
- ❌ **Poor Organization**: Doesn't leverage existing content structure
- ❌ **Manual Cleanup**: Requires post-import review and manual deduplication

**Use Case:** Best for:
- First-time imports (no existing content)
- Well-structured SCORM packages
- When speed is critical
- When you want exact SCORM structure preserved

---

#### Approach 2: RAG Agent Review (Intelligent Processing)

**Workflow:**
```
SCORM File → Extract → Parse → RAG Analysis → Decisions → Create/Update Tracks → Done
```

**RAG Agent Capabilities:**
- **Semantic Search**: Uses vector embeddings to find similar existing content (similarity threshold: 0.6-0.7)
- **Duplicate Detection**: Identifies content that already exists in the library
- **Content Analysis**: Understands content meaning to suggest consolidation
- **Organization-Aware**: Only searches within the organization's content

**Pros:**
- ✅ **Deduplication**: Automatically detects and flags duplicate content
- ✅ **Smart Consolidation**: Can merge related SCORM items into cohesive tracks
- ✅ **Leverages Existing Content**: Can link to or update existing tracks
- ✅ **Quality Control**: Reduces content bloat and improves organization
- ✅ **Intelligent Suggestions**: Can recommend better content structure

**Cons:**
- ❌ **Slower**: Adds AI processing time (embedding generation + similarity search + LLM analysis)
- ❌ **Complexity**: Requires prompt engineering and decision logic
- ❌ **False Positives**: May incorrectly merge or skip content
- ❌ **Cost**: Additional OpenAI API calls for embeddings and analysis
- ❌ **Uncertainty**: AI decisions may not match human judgment

**Use Case:** Best for:
- Organizations with large existing content libraries
- Re-importing updated SCORM packages
- When content quality > speed
- When you want intelligent organization

---

#### Approach 3: Hybrid Approach (Recommended)

**Workflow:**
```
SCORM File → Extract → Parse → RAG Analysis → User Review → Create/Update Tracks → Done
```

**Process:**
1. **Extract & Parse**: SCORM unwrapper extracts raw content
2. **RAG Analysis**: Brain system analyzes each extracted item:
   - Searches for similar existing content (duplicate detection)
   - Suggests consolidation opportunities
   - Flags potential issues
3. **User Review Interface**: Present analysis results with:
   - ✅ **Duplicate Matches**: "This content is 85% similar to 'Food Safety Basics' (existing track)"
   - ✅ **Consolidation Suggestions**: "These 3 SCORM items could be merged into a single 'Store Opening' story"
   - ✅ **New Content**: "This appears to be new content, create as new track"
   - ✅ **Action Buttons**: "Skip Duplicate", "Merge", "Create New", "Update Existing"
4. **User Decisions**: User reviews and approves/modifies suggestions
5. **Track Creation**: Execute based on user decisions

**Pros:**
- ✅ **Best of Both Worlds**: AI intelligence + human judgment
- ✅ **Transparency**: User sees all decisions before execution
- ✅ **Flexibility**: Can override AI suggestions
- ✅ **Quality**: Reduces duplicates while preserving user control
- ✅ **Learning**: AI suggestions improve over time

**Cons:**
- ❌ **Requires UI**: Needs review interface (adds development time)
- ❌ **Two-Step Process**: Not fully automated (but more reliable)

**Use Case:** Best for:
- **Production deployments** (recommended approach)
- When accuracy is critical
- When you want user control over content organization
- When you want to learn from AI suggestions

---

### Recommended Implementation Strategy

#### Phase 1: MVP (Raw Acceptance)
**Goal**: Get SCORM import working quickly

- Start with **Raw Acceptance** approach
- Create tracks directly from SCORM extractor output
- Add basic validation (required fields, file uploads)
- **Timeline**: Fastest to market

**Why Start Here:**
- Validates core integration works
- Gets users importing content immediately
- Provides baseline for comparison

#### Phase 2: Enhanced (RAG Analysis)
**Goal**: Add intelligence without blocking workflow

- Add **RAG duplicate detection** as a **warning system**
- Before creating tracks, search for similar content
- Show warnings: "⚠️ Similar content found: 'Food Safety Basics' (85% match)"
- User can still proceed or skip
- **Timeline**: Add after MVP is stable

**Implementation:**
```typescript
// Pseudocode for Phase 2
async function analyzeSCORMContent(extractedItems: SCORMItem[]) {
  const analysis = [];
  
  for (const item of extractedItems) {
    // Generate embedding for extracted content
    const embedding = await generateEmbedding(item.title + item.content);
    
    // Search for similar existing content
    const similarTracks = await brainSearch({
      query: item.title,
      threshold: 0.7, // 70% similarity
      organizationId: orgId
    });
    
    if (similarTracks.length > 0) {
      analysis.push({
        item,
        action: 'duplicate_warning',
        similarTracks,
        similarity: similarTracks[0].similarity
      });
    } else {
      analysis.push({
        item,
        action: 'create_new'
      });
    }
  }
  
  return analysis;
}
```

#### Phase 3: Full Hybrid (User Review Interface)
**Goal**: Complete intelligent processing with user control

- Build **review interface** showing RAG analysis
- User can:
  - Skip duplicates
  - Merge related items
  - Override AI suggestions
  - Batch approve
- Execute track creation based on user decisions
- **Timeline**: After Phase 2 proves valuable

**UI Flow:**
```
1. Upload SCORM → Processing...
2. Review Screen:
   ┌─────────────────────────────────────┐
   │ SCORM Import Review (5 items)       │
   ├─────────────────────────────────────┤
   │ ✅ New: "Food Safety Basics"        │
   │    [Create New Track]                │
   │                                     │
   │ ⚠️ Duplicate: "Handwashing"         │
   │    Similar to: "Handwashing Guide"  │
   │    (87% match)                      │
   │    [Skip] [Update Existing] [Create]│
   │                                     │
   │ 💡 Merge: 3 items → "Store Opening"│
   │    Items: Opening Checklist,        │
   │           Security Check, Setup    │
   │    [Merge into Story] [Keep Separate]│
   └─────────────────────────────────────┘
3. [Approve All] [Review Individually]
```

---

### Technical Implementation: RAG Analysis Endpoint

Add a new Edge Function endpoint for SCORM content analysis:

```typescript
// POST /functions/v1/scorm-unwrapper/analyze
interface AnalyzeSCORMRequest {
  extractedItems: Array<{
    title: string;
    type: 'article' | 'video' | 'story' | 'checkpoint';
    content: string; // Text content or description
    metadata?: any;
  }>;
  organizationId: string;
}

interface AnalyzeSCORMResponse {
  analysis: Array<{
    item: SCORMItem;
    recommendation: 'create_new' | 'duplicate' | 'merge' | 'update';
    confidence: number; // 0-1
    similarTracks?: Array<{
      id: string;
      title: string;
      similarity: number;
      type: string;
    }>;
    mergeSuggestions?: Array<{
      items: string[]; // Item IDs to merge
      suggestedTitle: string;
      suggestedType: 'story' | 'article';
    }>;
  }>;
}
```

**Analysis Logic:**
1. For each extracted item, generate embedding
2. Search existing content using `match_brain_embeddings` RPC
3. If similarity > 0.85: Mark as duplicate
4. If similarity 0.6-0.85: Flag for review
5. Analyze related items for merge opportunities (group by topic)
6. Return recommendations with confidence scores

---

### Decision Matrix

| Scenario | Recommended Approach | Reason |
|----------|---------------------|--------|
| **First-time import, no existing content** | Raw Acceptance | No duplicates possible, fastest |
| **Re-importing updated SCORM** | RAG Analysis | Need to detect and update existing |
| **Large existing library** | Hybrid (RAG + Review) | High duplicate risk, need user control |
| **Well-structured SCORM** | Raw Acceptance | Structure is good, no need to reorganize |
| **Poorly structured SCORM** | Hybrid (RAG + Review) | Need intelligence to fix organization |
| **Production deployment** | Hybrid (RAG + Review) | Best quality, user control |
| **MVP/Prototype** | Raw Acceptance | Fastest to implement |

---

### Cost-Benefit Analysis

#### Raw Acceptance
- **Cost**: $0 (no AI calls)
- **Time**: ~5-10 seconds per SCORM package
- **Quality**: Depends on SCORM structure
- **User Effort**: High (manual cleanup)

#### RAG Analysis
- **Cost**: ~$0.01-0.05 per SCORM item (embeddings + search)
- **Time**: ~30-60 seconds per SCORM package
- **Quality**: Higher (reduces duplicates)
- **User Effort**: Low (automated decisions)

#### Hybrid
- **Cost**: ~$0.01-0.05 per SCORM item
- **Time**: ~30-60 seconds + user review time
- **Quality**: Highest (AI + human judgment)
- **User Effort**: Medium (review but faster than manual cleanup)

---

### Final Recommendation

**Start with Raw Acceptance (Phase 1)**, then **evolve to Hybrid (Phase 3)**:

1. **Immediate**: Build raw acceptance to validate integration
2. **Short-term**: Add RAG duplicate detection as warnings
3. **Long-term**: Build full hybrid review interface

**Why this path:**
- Gets value to users fastest
- Validates the integration works
- Adds intelligence incrementally
- Maintains user control and trust
- Allows learning from real usage patterns

The hybrid approach gives you the best of both worlds: AI intelligence for duplicate detection and smart suggestions, combined with human judgment for final decisions. This is especially valuable when importing into an existing content library where duplicates are likely.

---

## Database Schema: Tracks Table

All content types (articles, videos, stories, checkpoints) are stored in a single `tracks` table with a `type` field to differentiate them.

### Core Table Structure

```sql
CREATE TABLE tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Basic Info (REQUIRED)
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('video', 'article', 'story', 'checkpoint')),
    
    -- Content
    content_url TEXT, -- Video URL or article content URL
    thumbnail_url TEXT,
    transcript TEXT, -- Used differently per type (see below)
    content_text TEXT, -- Alternative content field for articles
    
    -- Metadata
    duration_minutes INTEGER,
    version TEXT DEFAULT '1.0',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
    
    -- Learning
    learning_objectives TEXT[], -- Array of strings
    tags TEXT[], -- Array of strings
    
    -- Checkpoint-specific (if type = checkpoint)
    passing_score INTEGER,
    max_attempts INTEGER,
    
    -- Publishing
    published_at TIMESTAMPTZ,
    published_by UUID REFERENCES users(id),
    
    -- Stats
    view_count INTEGER DEFAULT 0,
    
    -- Authoring
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Required Fields for All Tracks

- `title` (TEXT, NOT NULL) - Content title
- `type` (TEXT, NOT NULL) - One of: `'video'`, `'article'`, `'story'`, `'checkpoint'`
- `organization_id` (UUID, NOT NULL) - Will be provided by the system when creating tracks

### Optional but Recommended Fields

- `description` (TEXT) - Brief description/summary
- `thumbnail_url` (TEXT) - URL to thumbnail image (signed URL from Supabase Storage)
- `duration_minutes` (INTEGER) - Estimated duration in minutes
- `tags` (TEXT[]) - Array of tag names (e.g., `['safety', 'compliance', 'onboarding']`)
- `learning_objectives` (TEXT[]) - Array of learning objective strings
- `status` (TEXT) - Default: `'draft'` (options: `'draft'`, `'review'`, `'published'`, `'archived'`)

---

## Content Type Specifications

### 1. Articles (Type: `'article'`)

Articles are text-based learning content, typically HTML or markdown.

#### Required Fields
- `title`
- `type: 'article'`
- `content_text` OR `transcript` (one must be provided)

#### Content Storage
- **Primary**: Store HTML/markdown content in `content_text` field
- **Alternative**: Store in `transcript` field if `content_text` is not available
- Content should be clean HTML (will be rendered in a rich text editor)

#### Example Article Payload

```json
{
  "title": "Food Safety Guidelines",
  "type": "article",
  "description": "Essential food safety practices for convenience store employees",
  "content_text": "<h1>Food Safety Guidelines</h1><p>Proper food handling is critical...</p>",
  "duration_minutes": 10,
  "tags": ["food-safety", "compliance", "training"],
  "learning_objectives": [
    "Understand proper food handling procedures",
    "Identify food safety hazards",
    "Apply temperature control guidelines"
  ],
  "status": "draft",
  "thumbnail_url": "https://[signed-url-from-storage]"
}
```

#### Notes
- HTML content is supported and will be rendered as-is
- Markdown can be provided but will need to be converted to HTML before storage
- Images referenced in content should be uploaded to storage and URLs updated

---

### 2. Videos (Type: `'video'`)

Videos are single video files with optional transcripts.

#### Required Fields
- `title`
- `type: 'video'`
- `content_url` - URL to video file (must be a signed URL from Supabase Storage)

#### Content Storage
- **Video File**: Upload to Supabase Storage bucket `make-2858cc8b-track-media` in `content/` folder
- **Transcript**: Store transcript text in `transcript` field (plain text, not JSON)
- **Thumbnail**: Upload thumbnail image to `thumbnails/` folder in same bucket

#### File Upload Requirements
- **Storage Bucket**: `make-2858cc8b-track-media`
- **Content Path**: `content/{trackId}-{timestamp}.mp4`
- **Thumbnail Path**: `thumbnails/{trackId}-{timestamp}.jpg`
- **Signed URLs**: Create signed URLs with 10-year expiration (315360000 seconds)
- **Max File Size**: 50MB for videos (client-side compression recommended before upload)

#### Example Video Payload

```json
{
  "title": "Customer Service Best Practices",
  "type": "video",
  "description": "Learn effective customer service techniques",
  "content_url": "https://[signed-url-to-video-file]",
  "thumbnail_url": "https://[signed-url-to-thumbnail]",
  "transcript": "Welcome to customer service training. Today we'll cover...",
  "duration_minutes": 15,
  "tags": ["customer-service", "training"],
  "learning_objectives": [
    "Demonstrate professional greeting techniques",
    "Handle customer complaints effectively"
  ],
  "status": "draft"
}
```

#### Notes
- Videos are automatically transcribed after upload (if transcript not provided)
- Transcripts are stored in `media_transcripts` table and linked to the track
- Duration should be calculated from video metadata if available

---

### 3. Stories (Type: `'story'`)

Stories are multi-slide presentations containing images and/or videos.

#### Required Fields
- `title`
- `type: 'story'`
- `transcript` - JSON string containing slides array

#### Content Storage
- **Story Data**: Store as JSON in `transcript` field (not `content_text`)
- **Slides**: Array of slide objects with images/videos

#### Story JSON Structure

```json
{
  "slides": [
    {
      "id": "slide-1",
      "name": "Introduction",
      "type": "image",
      "url": "https://[signed-url-to-image]",
      "order": 0,
      "duration": 5
    },
    {
      "id": "slide-2",
      "name": "Video Demonstration",
      "type": "video",
      "url": "https://[signed-url-to-video]",
      "order": 1,
      "duration": 30
    },
    {
      "id": "slide-3",
      "name": "Summary",
      "type": "image",
      "url": "https://[signed-url-to-image]",
      "order": 2,
      "duration": 5
    }
  ]
}
```

#### Slide Object Schema

```typescript
interface Slide {
  id: string;              // Unique identifier for the slide
  name: string;            // Slide title/name
  type: 'image' | 'video'; // Slide type
  url: string;             // Signed URL to image or video file
  order: number;           // Display order (0-indexed)
  duration?: number;       // Duration in seconds (for videos) or display time (for images)
  transcript?: {           // Optional: Video transcript (added automatically after transcription)
    text: string;
    words?: any[];
    utterances?: any[];
    confidence?: number;
    audio_duration?: number;
  };
}
```

#### Example Story Payload

```json
{
  "title": "Store Opening Procedures",
  "type": "story",
  "description": "Step-by-step guide to opening the store",
  "transcript": "{\"slides\":[{\"id\":\"slide-1\",\"name\":\"Step 1: Arrival\",\"type\":\"image\",\"url\":\"https://[signed-url]\",\"order\":0,\"duration\":5},{\"id\":\"slide-2\",\"name\":\"Step 2: Security Check\",\"type\":\"video\",\"url\":\"https://[signed-url]\",\"order\":1,\"duration\":45}]}",
  "duration_minutes": 8,
  "tags": ["procedures", "opening", "safety"],
  "learning_objectives": [
    "Complete store opening checklist",
    "Perform security checks correctly"
  ],
  "status": "draft",
  "thumbnail_url": "https://[signed-url-to-thumbnail]"
}
```

#### Notes
- The `transcript` field must be a **JSON string** (stringified JSON object)
- Video slides are automatically transcribed after upload
- Duration is calculated from slide durations if not provided
- Thumbnail should be the first slide's image or a generated thumbnail

---

### 4. Checkpoints (Type: `'checkpoint'`)

Checkpoints are quizzes/assessments with questions and answers.

#### Required Fields
- `title`
- `type: 'checkpoint'`
- `transcript` - JSON string containing questions array

#### Content Storage
- **Checkpoint Data**: Store as JSON in `transcript` field (not `content_text`)

#### Checkpoint JSON Structure

```json
{
  "questions": [
    {
      "id": "q1",
      "question": "What is the minimum cooking temperature for chicken?",
      "answers": [
        {
          "id": "a1",
          "text": "145°F",
          "isCorrect": false
        },
        {
          "id": "a2",
          "text": "165°F",
          "isCorrect": true
        },
        {
          "id": "a3",
          "text": "155°F",
          "isCorrect": false
        },
        {
          "id": "a4",
          "text": "175°F",
          "isCorrect": false
        }
      ]
    },
    {
      "id": "q2",
      "question": "Which of the following are food safety hazards?",
      "answers": [
        {
          "id": "a5",
          "text": "Biological",
          "isCorrect": true
        },
        {
          "id": "a6",
          "text": "Chemical",
          "isCorrect": true
        },
        {
          "id": "a7",
          "text": "Physical",
          "isCorrect": true
        },
        {
          "id": "a8",
          "text": "None of the above",
          "isCorrect": false
        }
      ]
    }
  ],
  "passingScore": 70,
  "timeLimit": 10
}
```

#### Checkpoint Object Schema

```typescript
interface CheckpointData {
  questions: Array<{
    id: string;                    // Unique identifier for the question
    question: string;              // Question text
    answers: Array<{
      id: string;                  // Unique identifier for the answer
      text: string;                // Answer text
      isCorrect: boolean;          // Whether this answer is correct
    }>;
  }>;
  passingScore?: number;           // Passing score percentage (default: 70)
  timeLimit?: number | null;       // Time limit in minutes (null = no limit)
}
```

#### Example Checkpoint Payload

```json
{
  "title": "Food Safety Assessment",
  "type": "checkpoint",
  "description": "Test your knowledge of food safety procedures",
  "transcript": "{\"questions\":[{\"id\":\"q1\",\"question\":\"What is the minimum cooking temperature?\",\"answers\":[{\"id\":\"a1\",\"text\":\"165°F\",\"isCorrect\":true}]}],\"passingScore\":70,\"timeLimit\":10}",
  "duration_minutes": 10,
  "tags": ["food-safety", "assessment"],
  "status": "draft",
  "thumbnail_url": "https://[signed-url-to-thumbnail]"
}
```

#### Notes
- The `transcript` field must be a **JSON string** (stringified JSON object)
- Duration is calculated as: `timeLimit` if provided, otherwise `questions.length` (1 minute per question)
- At least one answer per question must have `isCorrect: true`
- Multiple correct answers are supported (for "select all that apply" questions)

---

## File Storage Requirements

### Supabase Storage Bucket

**Bucket Name**: `make-2858cc8b-track-media`

### File Paths

- **Videos**: `content/{trackId}-{timestamp}.mp4`
- **Story Images**: `content/{trackId}-{timestamp}.jpg` (or appropriate extension)
- **Story Videos**: `content/{trackId}-{timestamp}.mp4`
- **Thumbnails**: `thumbnails/{trackId}-{timestamp}.jpg`

### Upload Process

1. Upload file to Supabase Storage bucket
2. Create signed URL with 10-year expiration (315360000 seconds)
3. Store the signed URL in the track's `content_url` or `thumbnail_url` field

### File Size Limits

- **Videos**: 50MB maximum (compress before upload if needed)
- **Images**: 2MB maximum after compression
- **Thumbnails**: 2MB maximum after compression

### Example Upload Flow

```typescript
// Pseudocode for file upload
const file = /* extracted file from SCORM */
const trackId = /* generated UUID */
const timestamp = Date.now()
const fileExt = file.name.split('.').pop()
const fileName = `content/${trackId}-${timestamp}.${fileExt}`

// Upload to Supabase Storage
const { data: uploadData, error } = await supabase.storage
  .from('make-2858cc8b-track-media')
  .upload(fileName, file, {
    contentType: file.type,
    upsert: false
  })

// Create signed URL (10 year expiration)
const { data: signedUrlData } = await supabase.storage
  .from('make-2858cc8b-track-media')
  .createSignedUrl(fileName, 315360000)

// Use signedUrlData.signedUrl in track creation
```

---

## Edge Function Integration Pattern

### Target Deployment

The SCORM unwrapper will be deployed as a Supabase Edge Function at:
- **Function Name**: `scorm-unwrapper` (or similar)
- **Endpoint**: `https://[project-ref].supabase.co/functions/v1/scorm-unwrapper`

### Expected Function Signature

```typescript
// POST /functions/v1/scorm-unwrapper/process
interface ProcessSCORMRequest {
  scormFile: File;              // SCORM zip file
  organizationId: string;        // Organization ID (from auth context)
  userId: string;               // User ID creating the content (from auth context)
  options?: {
    status?: 'draft' | 'published';  // Default: 'draft'
    tags?: string[];                 // Additional tags to apply
    learningObjectives?: string[];   // Additional learning objectives
  };
}

interface ProcessSCORMResponse {
  success: boolean;
  tracks: Array<{
    id: string;
    title: string;
    type: 'article' | 'video' | 'story' | 'checkpoint';
    status: string;
  }>;
  errors?: Array<{
    type: string;
    message: string;
  }>;
}
```

### Function Workflow

1. **Receive SCORM file** (multipart/form-data or base64)
2. **Extract and parse** SCORM package
3. **Identify content types** (articles, videos, quizzes)
4. **Upload media files** to Supabase Storage
5. **Create track records** in database
6. **Return track IDs** and status

### Authentication

The Edge Function will receive:
- `Authorization: Bearer [JWT token]` header
- Extract `organization_id` and `user_id` from JWT claims
- Use service role key for database operations (bypasses RLS)

---

## Data Mapping from SCORM to Tracks

### SCORM → Article Mapping

| SCORM Element | Track Field | Notes |
|--------------|-------------|-------|
| SCO title | `title` | Required |
| SCO description | `description` | Optional |
| SCO content (HTML/text) | `content_text` | Required - clean HTML |
| SCO metadata duration | `duration_minutes` | Convert to minutes |
| SCO metadata keywords | `tags` | Array of strings |
| SCO metadata objectives | `learning_objectives` | Array of strings |

### SCORM → Video Mapping

| SCORM Element | Track Field | Notes |
|--------------|-------------|-------|
| SCO title | `title` | Required |
| SCO description | `description` | Optional |
| Video file (MP4) | `content_url` | Upload to storage, use signed URL |
| Video thumbnail | `thumbnail_url` | Upload to storage, use signed URL |
| Video transcript | `transcript` | Plain text (if available) |
| Video duration | `duration_minutes` | Convert to minutes |
| SCO metadata keywords | `tags` | Array of strings |
| SCO metadata objectives | `learning_objectives` | Array of strings |

### SCORM → Story Mapping

| SCORM Element | Track Field | Notes |
|--------------|-------------|-------|
| SCO title | `title` | Required |
| SCO description | `description` | Optional |
| SCO slides/pages | `transcript` (JSON) | Array of slide objects |
| Slide images/videos | Upload to storage | Include signed URLs in slide objects |
| SCO metadata keywords | `tags` | Array of strings |
| SCO metadata objectives | `learning_objectives` | Array of strings |

### SCORM → Checkpoint Mapping

| SCORM Element | Track Field | Notes |
|--------------|-------------|-------|
| SCO title | `title` | Required |
| SCO description | `description` | Optional |
| Quiz questions | `transcript` (JSON) | Array of question objects |
| Passing score | `passingScore` in JSON | Percentage (0-100) |
| Time limit | `timeLimit` in JSON | Minutes (or null) |
| SCO metadata keywords | `tags` | Array of strings |

---

## Complete Example: Full SCORM Extraction Output

### Scenario: SCORM package contains 1 article, 2 videos, 1 story, 1 checkpoint

```json
{
  "extractionMetadata": {
    "scormVersion": "1.2",
    "packageTitle": "Food Safety Training",
    "extractedAt": "2024-01-15T10:30:00Z",
    "totalItems": 5
  },
  "tracks": [
    {
      "title": "Food Safety Basics",
      "type": "article",
      "description": "Introduction to food safety principles",
      "content_text": "<h1>Food Safety Basics</h1><p>Food safety is critical...</p>",
      "duration_minutes": 10,
      "tags": ["food-safety", "basics"],
      "learning_objectives": [
        "Understand food safety principles",
        "Identify common hazards"
      ],
      "status": "draft"
    },
    {
      "title": "Handwashing Procedure",
      "type": "video",
      "description": "Proper handwashing technique demonstration",
      "content_url": "https://[signed-url-to-video]",
      "thumbnail_url": "https://[signed-url-to-thumbnail]",
      "transcript": "Welcome to handwashing training. First, wet your hands...",
      "duration_minutes": 5,
      "tags": ["handwashing", "hygiene"],
      "learning_objectives": [
        "Demonstrate proper handwashing technique"
      ],
      "status": "draft"
    },
    {
      "title": "Temperature Control",
      "type": "video",
      "description": "Understanding temperature requirements",
      "content_url": "https://[signed-url-to-video]",
      "thumbnail_url": "https://[signed-url-to-thumbnail]",
      "duration_minutes": 8,
      "tags": ["temperature", "food-safety"],
      "status": "draft"
    },
    {
      "title": "Store Opening Checklist",
      "type": "story",
      "description": "Step-by-step opening procedures",
      "transcript": "{\"slides\":[{\"id\":\"slide-1\",\"name\":\"Arrival\",\"type\":\"image\",\"url\":\"https://[signed-url]\",\"order\":0,\"duration\":5},{\"id\":\"slide-2\",\"name\":\"Security Check\",\"type\":\"video\",\"url\":\"https://[signed-url]\",\"order\":1,\"duration\":30}]}",
      "duration_minutes": 6,
      "tags": ["procedures", "opening"],
      "status": "draft"
    },
    {
      "title": "Food Safety Assessment",
      "type": "checkpoint",
      "description": "Test your knowledge",
      "transcript": "{\"questions\":[{\"id\":\"q1\",\"question\":\"What is the minimum cooking temperature?\",\"answers\":[{\"id\":\"a1\",\"text\":\"165°F\",\"isCorrect\":true},{\"id\":\"a2\",\"text\":\"145°F\",\"isCorrect\":false}]}],\"passingScore\":70,\"timeLimit\":15}",
      "duration_minutes": 15,
      "tags": ["assessment", "food-safety"],
      "status": "draft"
    }
  ],
  "files": {
    "uploaded": [
      {
        "originalName": "handwashing.mp4",
        "storagePath": "content/[trackId]-[timestamp].mp4",
        "signedUrl": "https://[signed-url]",
        "type": "video"
      },
      {
        "originalName": "temperature.mp4",
        "storagePath": "content/[trackId]-[timestamp].mp4",
        "signedUrl": "https://[signed-url]",
        "type": "video"
      },
      {
        "originalName": "opening-slide1.jpg",
        "storagePath": "content/[trackId]-[timestamp].jpg",
        "signedUrl": "https://[signed-url]",
        "type": "image"
      },
      {
        "originalName": "opening-video.mp4",
        "storagePath": "content/[trackId]-[timestamp].mp4",
        "signedUrl": "https://[signed-url]",
        "type": "video"
      }
    ]
  }
}
```

---

## Integration Checklist

### Phase 1: SCORM Parsing
- [ ] Extract SCORM manifest (imsmanifest.xml)
- [ ] Parse SCOs (Shareable Content Objects)
- [ ] Identify content types (article, video, story, checkpoint)
- [ ] Extract metadata (title, description, keywords, objectives)
- [ ] Extract media files (videos, images)
- [ ] Extract quiz/assessment data

### Phase 2: Content Processing
- [ ] Convert article content to clean HTML
- [ ] Extract video files and metadata
- [ ] Organize story slides (images + videos)
- [ ] Parse quiz questions and answers
- [ ] Generate thumbnails (if not provided)

### Phase 3: File Upload
- [ ] Upload videos to Supabase Storage
- [ ] Upload images to Supabase Storage
- [ ] Upload thumbnails to Supabase Storage
- [ ] Generate signed URLs (10-year expiration)
- [ ] Verify file uploads succeeded

### Phase 4: Database Creation
- [ ] Create article tracks with `content_text`
- [ ] Create video tracks with `content_url` and `transcript`
- [ ] Create story tracks with JSON `transcript` (stringified)
- [ ] Create checkpoint tracks with JSON `transcript` (stringified)
- [ ] Set `organization_id` from auth context
- [ ] Set `created_by` from auth context
- [ ] Apply tags and learning objectives

### Phase 5: Edge Function Deployment
- [ ] Create Edge Function in `supabase/functions/scorm-unwrapper/`
- [ ] Implement file upload handler
- [ ] Implement SCORM parsing logic
- [ ] Implement track creation logic
- [ ] Add error handling and validation
- [ ] Add logging and monitoring
- [ ] Test with sample SCORM packages

---

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Missing title | SCORM manifest missing title | Use SCO identifier or filename as fallback |
| Invalid content type | Cannot determine if article/video/story/checkpoint | Default to 'article', allow manual correction |
| File upload failed | Storage quota exceeded or network error | Retry with exponential backoff, report error |
| Invalid JSON | Story/checkpoint data malformed | Validate JSON structure before storing |
| Missing organization_id | Auth context not available | Extract from JWT token claims |
| Duplicate content | Same SCORM package processed twice | Check for existing tracks by title + organization |

### Error Response Format

```json
{
  "success": false,
  "error": "SCORM parsing failed",
  "details": {
    "code": "PARSE_ERROR",
    "message": "Invalid manifest structure",
    "scormVersion": "1.2",
    "failedAt": "manifest-parsing"
  },
  "partialResults": [
    {
      "type": "article",
      "title": "Successfully created article",
      "trackId": "[uuid]"
    }
  ]
}
```

---

## Testing Recommendations

### Test Cases

1. **Simple SCORM Package**
   - 1 article, 1 video, 1 checkpoint
   - Verify all content types created correctly

2. **Complex SCORM Package**
   - Multiple articles, videos, stories, checkpoints
   - Nested content structures
   - Verify relationships preserved

3. **Edge Cases**
   - SCORM package with missing metadata
   - SCORM package with invalid file references
   - SCORM package with very large files
   - SCORM package with special characters in titles

4. **Error Scenarios**
   - Corrupted SCORM zip file
   - Missing manifest file
   - Invalid quiz structure
   - Storage upload failures

### Sample SCORM Packages

Provide sample SCORM packages for testing:
- Simple package (minimal content)
- Standard package (typical structure)
- Complex package (nested, multiple types)
- Edge case package (missing data, special chars)

---

## Future Enhancements

### Phase 2 Features (Post-MVP)

1. **Content Relationships**
   - Preserve SCORM sequencing rules
   - Create playlists from SCORM structure
   - Link related content

2. **Metadata Enhancement**
   - Extract SCORM completion criteria
   - Map SCORM objectives to learning objectives
   - Preserve SCORM metadata in track metadata field

3. **Advanced Processing**
   - Automatic video transcription (if not in SCORM)
   - Automatic thumbnail generation
   - Content quality scoring
   - Duplicate detection

4. **User Experience**
   - Progress tracking during extraction
   - Preview extracted content before creation
   - Batch editing of extracted tracks
   - Rollback/undo functionality

---

## Support and Questions

For questions or clarifications about this specification, contact the Trike Backoffice development team.

**Key Contacts**:
- Technical Lead: [Contact Info]
- Project Manager: [Contact Info]

**Document Version**: 1.0  
**Last Updated**: 2024-01-15  
**Status**: Active Development

---

## Appendix: TypeScript Interfaces

For reference, here are the TypeScript interfaces used in the Trike Backoffice system:

```typescript
// Track Creation Input
interface CreateTrackInput {
  title: string;
  description?: string;
  type: 'video' | 'story' | 'article' | 'checkpoint';
  content_url?: string;
  thumbnail_url?: string;
  duration_minutes?: number;
  transcript?: string;
  summary?: string;
  status?: 'draft' | 'published' | 'archived';
  learning_objectives?: string[];
  tags?: string[];
  is_system_content?: boolean;
  content_text?: string;
}

// Story Slide Structure
interface StorySlide {
  id: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  order: number;
  duration?: number;
  transcript?: {
    text: string;
    words?: any[];
    utterances?: any[];
    confidence?: number;
    audio_duration?: number;
  };
}

// Checkpoint Question Structure
interface CheckpointQuestion {
  id: string;
  question: string;
  answers: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
  }>;
}

interface CheckpointData {
  questions: CheckpointQuestion[];
  passingScore?: number;
  timeLimit?: number | null;
}
```

