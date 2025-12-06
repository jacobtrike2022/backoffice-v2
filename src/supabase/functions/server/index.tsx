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
const PUBLIC_ASSETS_BUCKET_NAME = 'public-assets';

// Track bucket initialization status to avoid repeated checks
let mediaBucketInitialized = false;
let attachmentsBucketInitialized = false;
let publicAssetsBucketInitialized = false;

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

// Initialize storage bucket for public assets
async function ensurePublicAssetsBucket() {
  if (publicAssetsBucketInitialized) return true;
  
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return false;
    }
    
    const bucketExists = buckets?.some(bucket => bucket.name === PUBLIC_ASSETS_BUCKET_NAME);
    
    if (!bucketExists) {
      console.log('Creating public assets bucket:', PUBLIC_ASSETS_BUCKET_NAME);
      const { error: createError } = await supabase.storage.createBucket(PUBLIC_ASSETS_BUCKET_NAME, {
        public: true,
        fileSizeLimit: 52428800, // 50MB max
      });
      
      if (createError && !createError.message?.includes('already exists')) {
        console.error('Error creating public assets bucket:', createError);
        return false;
      }
    }
    
    publicAssetsBucketInitialized = true;
    console.log('Public assets bucket ready');
    return true;
  } catch (error: any) {
    console.error('ensurePublicAssetsBucket error:', error);
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

ensurePublicAssetsBucket()
  .then(() => console.log('Public assets bucket initialization complete'))
  .catch((err) => console.error('Public assets bucket initialization failed:', err));

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
// ORGANIZATION: UPDATE KB SETTINGS
// =====================================================

app.put("/make-server-2858cc8b/organization/kb-settings", async (c) => {
  try {
    const body = await c.req.json();
    const { organizationId, kb_privacy_mode, kb_shared_password, kb_logo_url } = body;
    
    if (!organizationId) {
      return c.json({ error: 'Organization ID is required' }, 400);
    }
    
    console.log(`🔧 Updating KB settings for organization: ${organizationId}`);
    
    // Build update object (only include provided fields)
    const updateData: any = {};
    
    if (kb_privacy_mode !== undefined) updateData.kb_privacy_mode = kb_privacy_mode;
    if (kb_shared_password !== undefined) updateData.kb_shared_password = kb_shared_password;
    if (kb_logo_url !== undefined) updateData.kb_logo_url = kb_logo_url;
    
    const { data: updatedOrg, error: updateError } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('id', organizationId)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Error updating organization KB settings:', updateError);
      return c.json({ 
        error: `Failed to update settings: ${updateError.message}` 
      }, 500);
    }
    
    console.log(`✅ KB settings updated successfully`);
    
    return c.json({
      success: true,
      organization: updatedOrg
    });
    
  } catch (error: any) {
    console.error('❌ Update KB settings error:', error);
    return c.json({ 
      error: `Failed to update settings: ${error.message}` 
    }, 500);
  }
});

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
    
    console.log('🤖 Generating key facts for:', title || 'Untitled');
    console.log('   Content length:', content?.length || 0);
    console.log('   Transcript length:', transcript?.length || 0);
    
    const result = await generateKeyFacts({
      title,
      content,
      description,
      transcript,
    });
    
    console.log(`✅ Successfully generated ${result.enriched.length} key facts`);
    
    // Save facts to database if trackType/trackId provided
    const savedFactIds: string[] = [];
    if (trackType && trackId) {
      console.log(`💾 Saving ${result.enriched.length} facts to database for ${trackType}:${trackId}`)
      
      for (let i = 0; i < result.enriched.length; i++) {
        const fact = result.enriched[i];
        try {
          // Insert into facts table
          const { data: insertedFact, error: insertError } = await supabase
            .from('facts')
            .insert({
              title: fact.title,
              content: fact.fact,
              type: fact.type,
              steps: fact.steps || [],
              context: {
                specificity: 'universal',
                tags: {}
              },
              extracted_by: 'ai-pass-2',
              extraction_confidence: 0.85,
              company_id: companyId || null,
            })
            .select()
            .single();
          
          if (insertError) {
            console.error(`❌ Error inserting fact \"${fact.title}\":`, insertError.message);
            continue;
          }
          
          // Create fact_usage relationship with display_order to preserve extraction order
          const { error: usageError } = await supabase
            .from('fact_usage')
            .insert({
              fact_id: insertedFact.id,
              track_type: trackType,
              track_id: trackId,
              display_order: i, // Preserve order from AI extraction (0-indexed)
            });
          
          if (usageError) {
            console.error(`❌ Error creating fact_usage for \"${fact.title}\":`, usageError.message);
            // Continue - the fact is saved, just not linked
          }
          
          savedFactIds.push(insertedFact.id);
          console.log(`   ✓ Saved fact: \"${fact.title}\" (${insertedFact.id}) [order: ${i}]`);
        } catch (factError: any) {
          console.error(`❌ Exception saving fact \"${fact.title}\":`, factError.message);
          // Continue with other facts
        }
      }
      
      console.log(`✅ Saved ${savedFactIds.length}/${result.enriched.length} facts to database`);
    }
    
    return c.json({
      success: true,
      ...result,
      factIds: savedFactIds, // Return the database UUIDs
    });
    
  } catch (error: any) {
    console.error('❌ Generate key facts error:', error);
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
    
    // Get facts from database via fact_usage join
    const { data: factUsage, error: usageError } = await supabase
      .from('fact_usage')
      .select(`
        fact_id,
        track_type,
        track_id,
        added_at,
        facts (
          id,
          title,
          content,
          type,
          steps,
          context,
          extracted_by,
          extraction_confidence,
          company_id,
          created_at,
          updated_at
        )
      `)
      .eq('track_id', trackId);
    
    if (usageError) {
      console.error('❌ Error fetching facts:', usageError);
      return c.json({ 
        error: `Failed to get facts: ${usageError.message}` 
      }, 500);
    }
    
    // Transform to expected format
    const facts = (factUsage || []).map((usage: any) => ({
      id: usage.facts.id,
      title: usage.facts.title,
      content: usage.facts.content,
      type: usage.facts.type,
      steps: usage.facts.steps,
      context: usage.facts.context,
      extractedBy: usage.facts.extracted_by,
      extractionConfidence: usage.facts.extraction_confidence,
      companyId: usage.facts.company_id,
      createdAt: usage.facts.created_at,
      updatedAt: usage.facts.updated_at,
    }));
    
    console.log(`✅ Found ${facts.length} facts for track ${trackId}`);
    
    return c.json({
      success: true,
      facts: facts,
      count: facts.length
    });
    
  } catch (error: any) {
    console.error('❌ Get facts for track error:', error);
    return c.json({ 
      error: `Failed to get facts: ${error.message}` 
    }, 500);
  }
});

// =====================================================
// FACTS: DELETE A FACT FROM A TRACK
// =====================================================

app.delete("/make-server-2858cc8b/facts/:factId/track/:trackId", async (c) => {
  try {
    const factId = c.req.param('factId');
    const trackId = c.req.param('trackId');
    
    if (!factId || !trackId) {
      return c.json({ error: 'Fact ID and Track ID are required' }, 400);
    }
    
    console.log(`🗑️  Removing fact ${factId} from track ${trackId}`);
    
    // Delete from fact_usage (breaks the relationship)
    const { error: deleteError } = await supabase
      .from('fact_usage')
      .delete()
      .eq('fact_id', factId)
      .eq('track_id', trackId);
    
    if (deleteError) {
      console.error('❌ Error deleting fact_usage:', deleteError);
      return c.json({ 
        error: `Failed to delete fact: ${deleteError.message}` 
      }, 500);
    }
    
    // Check if this fact is used by any other tracks
    const { data: remainingUsage, error: checkError } = await supabase
      .from('fact_usage')
      .select('id')
      .eq('fact_id', factId);
    
    if (checkError) {
      console.warn('⚠️  Could not check for remaining usage:', checkError.message);
    }
    
    // If no other tracks use this fact, optionally delete the fact itself
    // (For now, we keep orphaned facts for potential reuse)
    const isOrphaned = !remainingUsage || remainingUsage.length === 0;
    
    console.log(`✅ Fact removed from track. Orphaned: ${isOrphaned}`);
    
    return c.json({
      success: true,
      message: 'Fact removed from track',
      orphaned: isOrphaned
    });
    
  } catch (error: any) {
    console.error('❌ Delete fact error:', error);
    return c.json({ 
      error: `Failed to delete fact: ${error.message}` 
    }, 500);
  }
});

// =====================================================
// FACTS: UPDATE A FACT
// =====================================================

app.put("/make-server-2858cc8b/facts/:factId", async (c) => {
  try {
    const factId = c.req.param('factId');
    const body = await c.req.json();
    const { title, content, type, steps } = body;
    
    if (!factId) {
      return c.json({ error: 'Fact ID is required' }, 400);
    }
    
    if (!title && !content && !type && !steps) {
      return c.json({ error: 'At least one field to update is required' }, 400);
    }
    
    console.log(`📝 Updating fact ${factId}`);
    
    // Build update object (only include provided fields)
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (type !== undefined) updateData.type = type;
    if (steps !== undefined) updateData.steps = steps;
    
    const { data: updatedFact, error: updateError } = await supabase
      .from('facts')
      .update(updateData)
      .eq('id', factId)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Error updating fact:', updateError);
      return c.json({ 
        error: `Failed to update fact: ${updateError.message}` 
      }, 500);
    }
    
    console.log(`✅ Fact updated successfully`);
    
    return c.json({
      success: true,
      fact: updatedFact
    });
    
  } catch (error: any) {
    console.error('❌ Update fact error:', error);
    return c.json({ 
      error: `Failed to update fact: ${error.message}` 
    }, 500);
  }
});

Deno.serve(app.fetch);