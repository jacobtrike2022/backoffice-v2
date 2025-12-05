import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import * as kv from "./kv_store.tsx";
import { handleTranscribeRequest } from "./transcribe.tsx";
import tagsApp from "./tags.ts";
import kbApp from "./kb.ts";

const app = new Hono();

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const BUCKET_NAME = 'make-2858cc8b-track-media';
const ATTACHMENTS_BUCKET_NAME = 'make-2858cc8b-attachments';

// Track bucket initialization status to avoid repeated checks
let mediaBucketInitialized = false;
let attachmentsBucketInitialized = false;

// Initialize storage bucket for track media
async function ensureMediaBucket() {
  if (mediaBucketInitialized) return true;
  
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return false;
    }
    
    const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
    
    if (!bucketExists) {
      console.log('Creating track media bucket:', BUCKET_NAME);
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 52428800, // 50MB max
      });
      
      if (createError && !createError.message?.includes('already exists')) {
        console.error('Error creating bucket:', createError);
        return false;
      }
    }
    
    mediaBucketInitialized = true;
    console.log('Media bucket ready');
    return true;
  } catch (error: any) {
    console.error('ensureMediaBucket error:', error);
    return false;
  }
}

// Initialize storage bucket for attachments
async function ensureAttachmentsBucket() {
  if (attachmentsBucketInitialized) return true;
  
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return false;
    }
    
    const bucketExists = buckets?.some(bucket => bucket.name === ATTACHMENTS_BUCKET_NAME);
    
    if (!bucketExists) {
      console.log('Creating attachments bucket:', ATTACHMENTS_BUCKET_NAME);
      const { error: createError } = await supabase.storage.createBucket(ATTACHMENTS_BUCKET_NAME, {
        public: false,
        fileSizeLimit: 52428800, // 50MB max
      });
      
      if (createError && !createError.message?.includes('already exists')) {
        console.error('Error creating attachments bucket:', createError);
        return false;
      }
    }
    
    attachmentsBucketInitialized = true;
    console.log('Attachments bucket ready');
    return true;
  } catch (error: any) {
    console.error('ensureAttachmentsBucket error:', error);
    return false;
  }
}

// Initialize bucket on startup
ensureMediaBucket()
  .then(() => console.log('Bucket initialization complete'))
  .catch((err) => console.error('Bucket initialization failed:', err));

ensureAttachmentsBucket()
  .then(() => console.log('Attachments bucket initialization complete'))
  .catch((err) => console.error('Attachments bucket initialization failed:', err));

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-2858cc8b/health", (c) => {
  return c.json({ status: "ok" });
});

// Upload media file endpoint
app.post("/make-server-2858cc8b/upload-media", async (c) => {
  try {
    // Ensure bucket exists before upload (safety check)
    await ensureMediaBucket();
    
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Limit: 50MB (videos should be compressed client-side before upload)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: 'File too large. Maximum size is 50MB.' }, 400);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `track-${timestamp}.${fileExt}`;
    
    console.log('Uploading file:', fileName, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    
    // Upload to Supabase Storage using stream to avoid memory issues
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file.stream(), {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return c.json({ error: `Upload failed: ${uploadError.message}` }, 500);
    }

    console.log('Upload successful, creating signed URL...');

    // Create a signed URL that expires in 10 years (for long-term storage)
    const { data: urlData, error: urlError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(fileName, 315360000); // 10 years in seconds

    if (urlError) {
      console.error('Signed URL error:', urlError);
      return c.json({ error: `Failed to create URL: ${urlError.message}` }, 500);
    }

    console.log('File uploaded successfully:', fileName);
    return c.json({ 
      success: true,
      url: urlData.signedUrl,
      fileName: fileName 
    });

  } catch (error: any) {
    console.error('Media upload error:', error);
    return c.json({ error: `Upload failed: ${error.message}` }, 500);
  }
});

// Transcribe audio file endpoint
app.post("/make-server-2858cc8b/transcribe", handleTranscribeRequest);

// Upload attachment endpoint
app.post("/make-server-2858cc8b/upload-attachment", async (c) => {
  try {
    await ensureAttachmentsBucket();
    
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const trackId = formData.get('trackId') as string;
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }
    
    if (!trackId) {
      return c.json({ error: 'Track ID is required' }, 400);
    }
    
    // Check file size (max 10MB to avoid memory issues)
    if (file.size > 10485760) {
      return c.json({ error: 'File too large. Maximum size is 10MB.' }, 400);
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${trackId}/${timestamp}-${sanitizedName}`;
    
    console.log('Uploading attachment:', storagePath, 'size:', file.size);
    
    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET_NAME)
      .upload(storagePath, uint8Array, {
        contentType: file.type,
        upsert: false,
      });
    
    if (uploadError) {
      console.error('Upload error:', uploadError);
      return c.json({ error: `Upload failed: ${uploadError.message}` }, 500);
    }
    
    // Save attachment record to KV store (without generating signed URL)
    const attachmentId = `attachment_${timestamp}_${Math.random().toString(36).substring(7)}`;
    const attachmentRecord = {
      id: attachmentId,
      trackId: trackId,
      fileName: file.name,
      storagePath: storagePath,
      fileType: file.type,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
    };
    
    await kv.set(`attachment:${attachmentId}`, attachmentRecord);
    await kv.set(`track_attachment:${trackId}:${attachmentId}`, attachmentRecord);
    
    console.log('Attachment uploaded successfully:', attachmentId);
    
    // Return attachment without URL - will be generated on retrieval
    return c.json({ 
      success: true,
      attachment: attachmentRecord
    });
    
  } catch (error: any) {
    console.error('Attachment upload error:', error);
    return c.json({ error: `Upload failed: ${error.message}` }, 500);
  }
});

// Get attachments for a track
app.get("/make-server-2858cc8b/attachments/:trackId", async (c) => {
  try {
    const trackId = c.req.param('trackId');
    
    if (!trackId) {
      return c.json({ error: 'Track ID is required' }, 400);
    }
    
    console.log(`Getting attachments for track ${trackId}...`);
    
    // Get all attachments for this track
    const attachmentRecords = await kv.getByPrefix(`track_attachment:${trackId}:`);
    
    console.log(`Found ${attachmentRecords.length} attachment records`);
    
    // Regenerate signed URLs on-the-fly to avoid memory issues with stored URLs
    const attachments = [];
    
    for (const record of attachmentRecords) {
      try {
        // Create fresh signed URL (expires in 1 hour for security)
        const { data: urlData, error: urlError } = await supabase.storage
          .from(ATTACHMENTS_BUCKET_NAME)
          .createSignedUrl(record.storagePath, 3600); // 1 hour
        
        if (urlError) {
          console.error(`Failed to create signed URL for ${record.storagePath}:`, urlError);
          continue; // Skip this attachment if URL generation fails
        }
        
        attachments.push({
          id: record.id,
          trackId: record.trackId,
          fileName: record.fileName,
          fileType: record.fileType,
          fileSize: record.fileSize,
          uploadedAt: record.uploadedAt,
          url: urlData.signedUrl,
        });
      } catch (error: any) {
        console.error(`Error processing attachment ${record.id}:`, error);
        continue;
      }
    }
    
    console.log(`Successfully processed ${attachments.length} attachments`);
    return c.json({ 
      success: true,
      attachments: attachments
    });
    
  } catch (error: any) {
    console.error('Get attachments error:', error);
    return c.json({ error: `Failed to get attachments: ${error.message}` }, 500);
  }
});

// Delete attachment
app.delete("/make-server-2858cc8b/attachment/:attachmentId", async (c) => {
  try {
    const attachmentId = c.req.param('attachmentId');
    
    if (!attachmentId) {
      return c.json({ error: 'Attachment ID is required' }, 400);
    }
    
    // Get attachment details
    const attachment = await kv.get(`attachment:${attachmentId}`);
    
    if (!attachment) {
      return c.json({ error: 'Attachment not found' }, 404);
    }
    
    // Delete from storage
    const { error: deleteError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET_NAME)
      .remove([attachment.storagePath]);
    
    if (deleteError) {
      console.error('Storage delete error:', deleteError);
      // Continue with KV deletion even if storage delete fails
    }
    
    // Delete from KV store
    await kv.del(`attachment:${attachmentId}`);
    await kv.del(`track_attachment:${attachment.trackId}:${attachmentId}`);
    
    console.log('Attachment deleted successfully:', attachmentId);
    return c.json({ 
      success: true,
      message: 'Attachment deleted successfully'
    });
    
  } catch (error: any) {
    console.error('Delete attachment error:', error);
    return c.json({ error: `Failed to delete attachment: ${error.message}` }, 500);
  }
});

// Get track versions
app.get("/make-server-2858cc8b/track-versions/:trackId", async (c) => {
  try {
    const trackId = c.req.param('trackId');
    
    if (!trackId) {
      return c.json({ error: 'Track ID is required' }, 400);
    }
    
    console.log(`Getting versions for track ${trackId}...`);
    
    // Get the track to find parent ID
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('id, parent_track_id')
      .eq('id', trackId)
      .single();
    
    if (trackError) {
      // Track not found in database - this is normal if tracks aren't being saved
      console.log('Track not found in database (tracks may be stored in-memory only)');
      return c.json({ 
        success: true,
        versions: [],
        message: 'Track versioning not yet implemented - tracks are not saved to database'
      });
    }
    
    if (!track) {
      // No track found, return empty versions
      console.log('Track not found');
      return c.json({ 
        success: true,
        versions: []
      });
    }
    
    // Find the parent track ID (could be this track or its parent)
    const parentId = track.parent_track_id || track.id;
    
    // Get all versions (parent + children)
    const { data: versions, error: versionsError } = await supabase
      .from('tracks')
      .select('*')
      .or(`id.eq.${parentId},parent_track_id.eq.${parentId}`)
      .order('version_number', { ascending: true });
    
    if (versionsError) {
      console.error('Error getting versions:', versionsError);
      return c.json({ 
        success: true,
        versions: [],
        message: 'Error querying versions'
      });
    }
    
    console.log(`Found ${versions?.length || 0} versions`);
    return c.json({ 
      success: true,
      versions: versions || []
    });
    
  } catch (error: any) {
    console.error('Get track versions error:', error);
    // Return empty array instead of error to allow app to continue working
    return c.json({ 
      success: true,
      versions: [],
      message: 'Track versioning not available'
    });
  }
});

// Mount tagsApp
app.route("/make-server-2858cc8b/tags", tagsApp);

// Mount kbApp
app.route("/make-server-2858cc8b/kb", kbApp);

// =====================================================
// AI: GENERATE KEY FACTS
// =====================================================

app.post("/make-server-2858cc8b/generate-key-facts", async (c) => {
  try {
    // Dynamic import to avoid breaking the server if LLM module has issues
    const { generateKeyFacts } = await import("./llm.ts");
    
    const body = await c.req.json();
    const { title, content, description, transcript, trackType, trackId, companyId } = body;
    
    if (!title && !content && !transcript) {
      return c.json({ 
        error: 'At least one of title, content, or transcript is required' 
      }, 400);
    }
    
    console.log('Generating key facts for:', title || 'Untitled');
    console.log('Content length:', content?.length || 0);
    console.log('Transcript length:', transcript?.length || 0);
    
    const result = await generateKeyFacts({
      title,
      content,
      description,
      transcript,
    });
    
    console.log(`Successfully generated ${result.enriched.length} key facts`);
    
    // Save facts to KV store if trackType/trackId provided
    const savedFactIds: string[] = [];
    if (trackType && trackId) {
      console.log(`Saving ${result.enriched.length} facts to KV store for ${trackType}:${trackId}`);
      
      for (const fact of result.enriched) {
        try {
          const factId = `fact_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          const factRecord = {
            id: factId,
            title: fact.title,
            content: fact.fact,
            type: fact.type,
            steps: fact.steps,
            extractedBy: 'ai-pass-2',
            extractionConfidence: 0.85,
            companyId: companyId,
            createdAt: new Date().toISOString(),
          };
          
          // Save to KV store
          await kv.set(`fact:${factId}`, factRecord);
          await kv.set(`track_fact:${trackId}:${factId}`, factRecord);
          
          savedFactIds.push(factId);
        } catch (factError: any) {
          console.error(`Error saving fact "${fact.title}":`, factError.message);
          // Continue with other facts
        }
      }
      
      console.log(`Saved ${savedFactIds.length} facts to KV store`);
    }
    
    return c.json({
      success: true,
      ...result,
      factIds: savedFactIds, // Return the KV store IDs
    });
    
  } catch (error: any) {
    console.error('Generate key facts error:', error);
    return c.json({ 
      error: `Failed to generate key facts: ${error.message}` 
    }, 500);
  }
});

// =====================================================
// FACTS: GET FACTS FOR A TRACK
// =====================================================

app.get("/make-server-2858cc8b/facts/track/:trackId", async (c) => {
  try {
    const trackId = c.req.param('trackId');
    
    if (!trackId) {
      return c.json({ error: 'Track ID is required' }, 400);
    }
    
    console.log(`📊 Fetching facts for track: ${trackId}`);
    
    // Get facts from KV store
    const facts = await kv.getByPrefix(`track_fact:${trackId}:`);
    
    console.log(`✅ Found ${facts.length} facts for track ${trackId}`);
    
    return c.json({
      success: true,
      facts: facts,
      count: facts.length
    });
    
  } catch (error: any) {
    console.error('Get facts for track error:', error);
    return c.json({ 
      error: `Failed to get facts: ${error.message}` 
    }, 500);
  }
});

// =====================================================
// CACHED TRANSCRIPTION: Single media with caching
// =====================================================

app.post("/make-server-2858cc8b/transcribe-cached", async (c) => {
  try {
    const TranscriptService = await import("./TranscriptService.ts");
    const body = await c.req.json();
    const { mediaUrl, mediaType, trackId, forceRefresh } = body;
    
    if (!mediaUrl || !trackId) {
      return c.json({ 
        error: 'mediaUrl and trackId are required' 
      }, 400);
    }
    
    console.log(`🎬 Transcribing media (cached): ${mediaUrl.substring(0, 50)}...`);
    console.log(`   Track ID: ${trackId}, Force refresh: ${forceRefresh || false}`);
    
    const result = await TranscriptService.getOrCreateTranscript(
      mediaUrl,
      mediaType || 'video',
      trackId,
      forceRefresh || false
    );
    
    return c.json({
      success: true,
      transcript: result.transcript,
      cached: result.cached,
      message: result.message
    });
    
  } catch (error: any) {
    console.error('Cached transcription error:', error);
    return c.json({ 
      error: `Failed to transcribe: ${error.message}` 
    }, 500);
  }
});

// =====================================================
// CACHED STORY TRANSCRIPTION: Batch with caching
// =====================================================

app.post("/make-server-2858cc8b/transcribe-story-cached", async (c) => {
  try {
    const TranscriptService = await import("./TranscriptService.ts");
    const body = await c.req.json();
    const { trackId, slides, forceRefresh } = body;
    
    if (!trackId || !slides) {
      return c.json({ 
        error: 'trackId and slides are required' 
      }, 400);
    }
    
    console.log(`📦 Batch transcribing story with ${slides.length} slides...`);
    
    // Filter for video slides only
    const videoSlides = slides.filter((slide: any) => 
      slide.type === 'video' && slide.url
    );
    
    if (videoSlides.length === 0) {
      return c.json({
        success: true,
        transcripts: [],
        stats: { total: 0, cached: 0, newlyTranscribed: 0, failed: 0 },
        message: 'No video slides found'
      });
    }
    
    // Batch transcribe with caching
    const result = await TranscriptService.batchTranscribe(
      videoSlides.map((slide: any) => ({
        url: slide.url,
        type: 'video',
        id: slide.id,
        name: slide.name
      })),
      trackId,
      forceRefresh || false
    );
    
    console.log(`✅ Batch transcription complete: ${result.stats.cached} cached, ${result.stats.newlyTranscribed} new`);
    
    return c.json({
      success: true,
      transcripts: result.transcripts,
      stats: result.stats
    });
    
  } catch (error: any) {
    console.error('Cached story transcription error:', error);
    return c.json({ 
      error: `Failed to transcribe story: ${error.message}` 
    }, 500);
  }
});

// =====================================================
// TRANSCRIPT RETRIEVAL: Get by ID or URL
// =====================================================

app.get("/make-server-2858cc8b/transcript/:id", async (c) => {
  try {
    const TranscriptService = await import("./TranscriptService.ts");
    const transcriptId = c.req.param('id');
    
    const transcript = await TranscriptService.getTranscriptById(transcriptId);
    
    if (!transcript) {
      return c.json({ error: 'Transcript not found' }, 404);
    }
    
    return c.json({
      success: true,
      transcript
    });
    
  } catch (error: any) {
    console.error('Get transcript error:', error);
    return c.json({ 
      error: `Failed to get transcript: ${error.message}` 
    }, 500);
  }
});

app.get("/make-server-2858cc8b/transcript/by-url", async (c) => {
  try {
    const TranscriptService = await import("./TranscriptService.ts");
    const mediaUrl = c.req.query('url');
    
    if (!mediaUrl) {
      return c.json({ error: 'url query parameter is required' }, 400);
    }
    
    const transcript = await TranscriptService.getTranscriptByUrl(mediaUrl);
    
    return c.json({
      success: true,
      transcript: transcript || null
    });
    
  } catch (error: any) {
    console.error('Get transcript by URL error:', error);
    return c.json({ 
      error: `Failed to get transcript: ${error.message}` 
    }, 500);
  }
});

// =====================================================
// TRANSCRIPT STATS: Usage analytics
// =====================================================

app.get("/make-server-2858cc8b/transcript-stats", async (c) => {
  try {
    const TranscriptService = await import("./TranscriptService.ts");
    const stats = await TranscriptService.getTranscriptStats();
    
    return c.json({
      success: true,
      stats
    });
    
  } catch (error: any) {
    console.error('Get transcript stats error:', error);
    return c.json({ 
      error: `Failed to get stats: ${error.message}` 
    }, 500);
  }
});

// =====================================================
// STORY TRANSCRIPTION: Process multiple videos in a story (LEGACY - no caching)
// =====================================================

app.post("/make-server-2858cc8b/transcribe-story", async (c) => {
  try {
    const { transcribeVideo } = await import("./transcribe.tsx");
    const body = await c.req.json();
    const { storyData } = body;
    
    if (!storyData) {
      return c.json({ error: 'storyData is required' }, 400);
    }
    
    console.log('📽️ Processing story transcription (legacy endpoint)...');
    
    // Parse story_data to extract slides
    let slides = [];
    try {
      slides = typeof storyData === 'string' ? JSON.parse(storyData) : storyData;
    } catch (parseError: any) {
      return c.json({ error: `Failed to parse story data: ${parseError.message}` }, 400);
    }
    
    // Filter for video slides only
    const videoSlides = slides.filter((slide: any) => slide.type === 'video' && slide.url);
    
    console.log(`Found ${videoSlides.length} video slides out of ${slides.length} total slides`);
    
    if (videoSlides.length === 0) {
      return c.json({
        success: true,
        transcripts: [],
        message: 'No video slides found in story'
      });
    }
    
    // Process each video slide
    const transcripts = [];
    
    for (const slide of videoSlides) {
      try {
        console.log(`Transcribing video: ${slide.name || 'Unnamed'}`);
        const transcriptData = await transcribeVideo(slide.url);
        
        transcripts.push({
          slideName: slide.name || 'Unnamed Video',
          slideId: slide.id,
          slideOrder: slide.order,
          transcript: transcriptData
        });
        
        console.log(`✅ Transcribed: ${slide.name || 'Unnamed'}`);
      } catch (error: any) {
        console.error(`❌ Failed to transcribe ${slide.name || 'Unnamed'}:`, error.message);
        // Continue with other videos even if one fails
        transcripts.push({
          slideName: slide.name || 'Unnamed Video',
          slideId: slide.id,
          slideOrder: slide.order,
          error: error.message
        });
      }
    }
    
    console.log(`✅ Story transcription complete. Processed ${transcripts.length} videos`);
    
    return c.json({
      success: true,
      transcripts: transcripts,
      totalVideos: videoSlides.length,
      successCount: transcripts.filter(t => !t.error).length,
      errorCount: transcripts.filter(t => t.error).length
    });
    
  } catch (error: any) {
    console.error('Story transcription error:', error);
    return c.json({ 
      error: `Failed to transcribe story: ${error.message}` 
    }, 500);
  }
});

// =====================================================
// STORY FACTS: Generate facts from story with media source tracking
// =====================================================

app.post("/make-server-2858cc8b/generate-story-facts", async (c) => {
  try {
    const { generateKeyFacts } = await import("./llm.ts");
    
    const body = await c.req.json();
    const { 
      title, 
      description, 
      transcripts,  // Array of { slideId, slideName, slideOrder, slideUrl, slideType, transcript }
      trackId, 
      companyId 
    } = body;
    
    if (!title && !transcripts?.length) {
      return c.json({ 
        error: 'Title and transcripts are required' 
      }, 400);
    }
    
    console.log(`🎯 Generating story facts for: ${title}`);
    console.log(`   Transcripts provided: ${transcripts?.length || 0}`);
    
    // Combine all transcripts into one text
    const combinedTranscript = transcripts
      .map((t: any) => `[${t.slideName}]\n${t.transcript?.text || t.transcript || ''}`)
      .join('\n\n');
    
    console.log(`   Combined transcript length: ${combinedTranscript.length} characters`);
    
    // Generate facts from combined content
    const result = await generateKeyFacts({
      title,
      description,
      transcript: combinedTranscript,
    });
    
    console.log(`✅ Generated ${result.enriched.length} key facts`);
    
    // Save facts with media source tracking to KV store
    const savedFactIds: string[] = [];
    const factsWithMetadata: any[] = [];
    
    if (trackId) {
      console.log(`💾 Saving facts with media source tracking to KV store...`);
      
      // For each fact, try to determine which slide it came from
      for (let i = 0; i < result.enriched.length; i++) {
        const fact = result.enriched[i];
        
        // Round-robin assignment of facts to slides (simple distribution)
        const sourceSlide = transcripts[i % transcripts.length];
        
        try {
          const factId = `fact_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          const factRecord = {
            id: factId,
            title: fact.title,
            content: fact.fact,
            type: fact.type,
            steps: fact.steps,
            extractedBy: 'ai-pass-2',
            extractionConfidence: 0.85,
            companyId: companyId,
            createdAt: new Date().toISOString(),
            // Media source metadata
            sourceMediaId: sourceSlide.slideId,
            sourceMediaUrl: sourceSlide.slideUrl,
            sourceMediaType: sourceSlide.slideType || 'video',
            displayOrder: sourceSlide.slideOrder,
          };
          
          // Save to KV store
          await kv.set(`fact:${factId}`, factRecord);
          await kv.set(`track_fact:${trackId}:${factId}`, factRecord);
          
          savedFactIds.push(factId);
          
          // Add metadata to fact for client
          factsWithMetadata.push({
            ...fact,
            slideId: sourceSlide.slideId,
            slideName: sourceSlide.slideName,
            slideIndex: sourceSlide.slideOrder
          });
          
        } catch (factError: any) {
          console.error(`Error saving fact "${fact.title}":`, factError.message);
          // Still add to client response even if save failed
          factsWithMetadata.push({
            ...fact,
            slideId: sourceSlide.slideId,
            slideName: sourceSlide.slideName,
            slideIndex: sourceSlide.slideOrder
          });
        }
      }
      
      console.log(`✅ Saved ${savedFactIds.length} facts with media source tracking to KV store`);
    }
    
    return c.json({
      success: true,
      enriched: factsWithMetadata.length > 0 ? factsWithMetadata : result.enriched,
      simple: result.simple,
      factIds: savedFactIds,
    });
    
  } catch (error: any) {
    console.error('Generate story facts error:', error);
    return c.json({ 
      error: `Failed to generate story facts: ${error.message}` 
    }, 500);
  }
});

Deno.serve(app.fetch);