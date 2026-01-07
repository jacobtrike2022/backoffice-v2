// =============================================================================
// TRIKE SERVER - Supabase Edge Function
// Handles: Health checks, Attachments, Key Facts (AI), Transcription, and more
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// =============================================================================
// ROUTER
// =============================================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  // Supabase strips /functions/v1/{function-name} automatically, but sometimes the pathname
  // might still include the function name or full v1 prefix, so we normalize it
  let path = url.pathname;
  path = path.replace(/^\/functions\/v1\/trike-server/, "");
  path = path.replace(/^\/trike-server/, "");
  // Ensure path starts with / for consistency
  if (!path.startsWith("/")) {
    path = "/" + path;
  }
  const method = req.method;

  console.log(`[${method}] ${path} (original: ${url.pathname})`);

  try {
    // =========================================================================
    // HEALTH CHECK
    // =========================================================================
    if (method === "GET" && (path === "/health" || path === "")) {
      return jsonResponse({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        services: {
          openai: !!OPENAI_API_KEY,
          assemblyai: !!ASSEMBLYAI_API_KEY,
        }
      });
    }

    // =========================================================================
    // ATTACHMENTS
    // =========================================================================
    
    // Upload attachment
    if (method === "POST" && path === "/upload-attachment") {
      return await handleUploadAttachment(req);
    }

    // Get attachments for a track
    if (method === "GET" && path.startsWith("/attachments/")) {
      const trackId = path.replace("/attachments/", "");
      return await handleGetAttachments(trackId);
    }

    // Delete attachment
    if (method === "DELETE" && path.startsWith("/attachment/")) {
      const attachmentId = path.replace("/attachment/", "");
      return await handleDeleteAttachment(attachmentId);
    }

    // =========================================================================
    // TRANSCRIPTION
    // =========================================================================

    // Transcribe audio/video
    if (method === "POST" && path === "/transcribe") {
      return await handleTranscribe(req);
    }

    // Get cached transcript by URL
    if (method === "POST" && path === "/transcript/lookup") {
      return await handleTranscriptLookup(req);
    }

    // Get transcript by ID
    if (method === "GET" && path.startsWith("/transcript/")) {
      const transcriptId = path.replace("/transcript/", "");
      return await handleGetTranscript(transcriptId);
    }

    // =========================================================================
    // FACTS
    // =========================================================================

    // Get facts for a track
    if (method === "GET" && path.startsWith("/facts/track/")) {
      const trackId = path.replace("/facts/track/", "");
      return await handleGetFactsForTrack(trackId);
    }

    // Generate key facts (AI)
    if (method === "POST" && path === "/generate-key-facts") {
      return await handleGenerateKeyFacts(req);
    }

    // Recommend tags (AI)
    if (method === "POST" && path === "/recommend-tags") {
      return await handleRecommendTags(req);
    }

    // Process AI analysis queue
    if (method === "POST" && path === "/brain/process-analysis-queue") {
      return await handleProcessAnalysisQueue(req);
    }

    // Update a fact
    if (method === "PUT" && path.startsWith("/facts/")) {
      const factId = path.replace("/facts/", "");
      return await handleUpdateFact(factId, req);
    }

    // Delete fact from track
    if (method === "DELETE" && path.match(/^\/facts\/[^/]+\/track\/[^/]+$/)) {
      const parts = path.split("/");
      const factId = parts[2];
      const trackId = parts[4];
      return await handleDeleteFactFromTrack(factId, trackId);
    }

    // =========================================================================
    // TRACK RELATIONSHIPS
    // =========================================================================

    // Get source track (parent) for a derived track
    if (method === "GET" && path.startsWith("/track-relationships/source/")) {
      const trackId = path.replace("/track-relationships/source/", "").split("?")[0];
      const relationshipType = url.searchParams.get("type") as 'source' | 'prerequisite' | 'related' | null;
      return await handleGetSourceTrack(trackId, relationshipType, req);
    }

    // Get derived tracks (children) for a source track
    if (method === "GET" && path.startsWith("/track-relationships/derived/")) {
      const trackId = path.replace("/track-relationships/derived/", "").split("?")[0];
      const relationshipType = url.searchParams.get("type") as 'source' | 'prerequisite' | 'related' | null;
      return await handleGetDerivedTracks(trackId, relationshipType, req);
    }

    // Get relationship stats for a track
    if (method === "GET" && path.startsWith("/track-relationships/stats/")) {
      const trackId = path.replace("/track-relationships/stats/", "");
      return await handleGetRelationshipStats(trackId, req);
    }

    // Create a relationship between tracks
    if (method === "POST" && path === "/track-relationships/create") {
      return await handleCreateRelationship(req);
    }

    // AI-Assisted Variant Generation: Chat
    if (method === "POST" && path === "/track-relationships/variant/chat") {
      return await handleVariantChat(req);
    }

    // AI-Assisted Variant Generation: Generate
    if (method === "POST" && path === "/track-relationships/variant/generate") {
      return await handleVariantGenerate(req);
    }

    // =========================================================================
    // STATE VARIANT INTELLIGENCE V2 ENDPOINTS
    // =========================================================================

    // Build Scope Contract
    if (method === "POST" && path === "/track-relationships/variant/scope-contract") {
      return await handleBuildScopeContract(req);
    }

    // Freeze Scope Contract Roles
    if (method === "POST" && path.match(/^\/track-relationships\/variant\/scope-contract\/[^/]+\/freeze-roles$/)) {
      const contractId = path.split("/")[4];
      return await handleFreezeScopeContractRoles(contractId, req);
    }

    // Get Scope Contract
    if (method === "GET" && path.match(/^\/track-relationships\/variant\/scope-contract\/[^/]+$/)) {
      const contractId = path.split("/")[4];
      return await handleGetScopeContract(contractId, req);
    }

    // Build Research Plan
    if (method === "POST" && path === "/track-relationships/variant/research-plan") {
      return await handleBuildResearchPlan(req);
    }

    // Get Research Plan
    if (method === "GET" && path.match(/^\/track-relationships\/variant\/research-plan\/[^/]+$/)) {
      const planId = path.split("/")[4];
      return await handleGetResearchPlan(planId, req);
    }

    // Retrieve Evidence
    if (method === "POST" && path === "/track-relationships/variant/retrieve-evidence") {
      return await handleRetrieveEvidence(req);
    }

    // Extract Key Facts
    if (method === "POST" && path === "/track-relationships/variant/key-facts") {
      return await handleExtractKeyFacts(req);
    }

    // Get Key Facts Extraction
    if (method === "GET" && path.match(/^\/track-relationships\/variant\/key-facts\/[^/]+$/)) {
      const extractionId = path.split("/")[4];
      return await handleGetKeyFactsExtraction(extractionId, req);
    }

    // Generate Draft
    if (method === "POST" && path === "/track-relationships/variant/generate-draft") {
      return await handleGenerateDraft(req);
    }

    // Get Draft
    if (method === "GET" && path.match(/^\/track-relationships\/variant\/draft\/[^/]+$/)) {
      const draftId = path.split("/")[3];
      return await handleGetDraft(draftId, req);
    }

    // Apply Instructions to Draft
    if (method === "POST" && path.match(/^\/track-relationships\/variant\/draft\/[^/]+\/apply-instructions$/)) {
      const draftId = path.split("/")[3];
      return await handleApplyInstructions(draftId, req);
    }

    // Delete a relationship (must not be a sub-path)
    if (method === "DELETE" && path.startsWith("/track-relationships/")) {
      const remainingPath = path.replace("/track-relationships/", "");
      // Only match if it's not a sub-path (no slashes)
      if (remainingPath && !remainingPath.includes("/")) {
        return await handleDeleteRelationship(remainingPath, req);
      }
    }

    // =========================================================================
    // TRACK VERSIONS
    // =========================================================================

    // Get all versions of a track
    if (method === "GET" && path.startsWith("/track-versions/")) {
      const trackId = path.replace("/track-versions/", "");
      return await handleGetTrackVersions(trackId);
    }

    // =========================================================================
    // COMPANY BRAIN (RAG)
    // =========================================================================

    // Index content for RAG
    if (method === "POST" && path === "/brain/embed") {
      return await handleBrainEmbed(req);
    }

    // Remove content from index
    if (method === "POST" && path === "/brain/remove") {
      return await handleBrainRemove(req);
    }

    // Chat with brain (RAG query)
    if (method === "POST" && path === "/brain/chat") {
      return await handleBrainChat(req);
    }

    // Search indexed content
    if (method === "POST" && path === "/brain/search") {
      return await handleBrainSearch(req);
    }

    // Get brain statistics
    if (method === "GET" && path === "/brain/stats") {
      return await handleBrainStats(req);
    }

    // Backfill brain index (admin function)
    if (method === "POST" && path === "/brain/backfill") {
      return await handleBrainBackfill(req);
    }

    // =========================================================================
    // ONBOARDING & COMPANY ENRICHMENT
    // =========================================================================

    // Start new onboarding session
    if (method === "POST" && path === "/onboarding/start") {
      return await handleOnboardingStart(req);
    }

    // Scrape company info from website
    if (method === "POST" && path === "/onboarding/enrich-company") {
      return await handleEnrichCompany(req);
    }

    // Chat with onboarding agent
    if (method === "POST" && path === "/onboarding/chat") {
      return await handleOnboardingChat(req);
    }

    // Update onboarding session data
    if (method === "POST" && path === "/onboarding/update") {
      return await handleOnboardingUpdate(req);
    }

    // Complete onboarding and create demo org
    if (method === "POST" && path === "/onboarding/complete") {
      return await handleOnboardingComplete(req);
    }

    // Get industries and services for dropdowns
    if (method === "GET" && path === "/onboarding/options") {
      return await handleOnboardingOptions(req);
    }

    // =========================================================================
    // EMAIL SYSTEM
    // =========================================================================

    // Send an email using a template
    if (method === "POST" && path === "/email/send") {
      return await handleSendEmail(req);
    }

    // List email templates (system + org)
    if (method === "GET" && path === "/email/templates") {
      return await handleGetEmailTemplates(req);
    }

    // Get single email template
    if (method === "GET" && path.match(/^\/email\/templates\/[^/]+$/)) {
      const templateId = path.replace("/email/templates/", "");
      return await handleGetEmailTemplate(templateId, req);
    }

    // Create org email template
    if (method === "POST" && path === "/email/templates") {
      return await handleCreateEmailTemplate(req);
    }

    // Update email template
    if (method === "PUT" && path.match(/^\/email\/templates\/[^/]+$/)) {
      const templateId = path.replace("/email/templates/", "");
      return await handleUpdateEmailTemplate(templateId, req);
    }

    // Delete email template
    if (method === "DELETE" && path.match(/^\/email\/templates\/[^/]+$/)) {
      const templateId = path.replace("/email/templates/", "");
      return await handleDeleteEmailTemplate(templateId, req);
    }

    // Customize system template (create org copy)
    if (method === "POST" && path.match(/^\/email\/templates\/[^/]+\/customize$/)) {
      const templateId = path.replace("/email/templates/", "").replace("/customize", "");
      return await handleCustomizeEmailTemplate(templateId, req);
    }

    // Send test email for template
    if (method === "POST" && path.match(/^\/email\/templates\/[^/]+\/test$/)) {
      const templateId = path.replace("/email/templates/", "").replace("/test", "");
      return await handleTestEmailTemplate(templateId, req);
    }

    // Get email logs
    if (method === "GET" && path === "/email/logs") {
      return await handleGetEmailLogs(req);
    }

    // Preview a template with variables
    if (method === "POST" && path === "/email/preview") {
      return await handlePreviewEmailTemplate(req);
    }

    // =========================================================================
    // 404 - Route not found
    // =========================================================================
    console.error(`❌ Route not found: [${method}] ${path} (original: ${url.pathname})`);
    return jsonResponse({ 
      error: "Not found", 
      path,
      originalPath: url.pathname,
      method,
      availableRoutes: [
        "GET /health",
        "POST /upload-attachment",
        "GET /attachments/:trackId",
        "DELETE /attachment/:attachmentId",
        "POST /transcribe",
        "POST /transcript/lookup",
        "GET /transcript/:transcriptId",
        "GET /facts/track/:trackId",
        "POST /generate-key-facts",
        "POST /recommend-tags",
        "POST /brain/process-analysis-queue",
        "PUT /facts/:factId",
        "DELETE /facts/:factId/track/:trackId",
        "GET /track-relationships/source/:trackId",
        "GET /track-relationships/derived/:trackId",
        "GET /track-relationships/stats/:trackId",
        "POST /track-relationships/create",
        "POST /track-relationships/variant/chat",
        "POST /track-relationships/variant/generate",
        "POST /track-relationships/variant/scope-contract",
        "POST /track-relationships/variant/scope-contract/:id/freeze-roles",
        "GET /track-relationships/variant/scope-contract/:id",
        "POST /track-relationships/variant/research-plan",
        "GET /track-relationships/variant/research-plan/:id",
        "POST /track-relationships/variant/retrieve-evidence",
        "POST /track-relationships/variant/key-facts",
        "GET /track-relationships/variant/key-facts/:id",
        "POST /track-relationships/variant/generate-draft",
        "GET /track-relationships/variant/draft/:id",
        "POST /track-relationships/variant/draft/:id/apply-instructions",
        "DELETE /track-relationships/:relationshipId",
        "GET /track-versions/:trackId",
        "POST /brain/embed",
        "POST /brain/remove",
        "POST /brain/chat",
        "POST /brain/search",
        "GET /brain/stats",
        "POST /brain/backfill",
        "POST /email/send",
        "GET /email/templates",
        "GET /email/templates/:id",
        "POST /email/templates",
        "PUT /email/templates/:id",
        "DELETE /email/templates/:id",
        "GET /email/logs",
        "POST /email/preview"
      ]
    }, 404);

  } catch (error) {
    console.error("Server error:", error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// =============================================================================
// ATTACHMENT HANDLERS
// =============================================================================

async function handleUploadAttachment(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const trackId = formData.get("trackId") as string;

    if (!file || !trackId) {
      return jsonResponse({ error: "Missing file or trackId" }, 400);
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${trackId}/${crypto.randomUUID()}.${fileExt}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("track-attachments")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return jsonResponse({ error: uploadError.message }, 500);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("track-attachments")
      .getPublicUrl(fileName);

    // Store metadata in database
    const { data: attachment, error: dbError } = await supabase
      .from("track_attachments")
      .insert({
        track_id: trackId,
        file_name: file.name,
        storage_path: fileName,
        url: urlData.publicUrl,
        file_type: file.type,
        file_size: file.size,
      })
      .select()
      .single();

    if (dbError) {
      // If DB insert fails, try to clean up the uploaded file
      await supabase.storage.from("track-attachments").remove([fileName]);
      console.error("DB error:", dbError);
      return jsonResponse({ error: dbError.message }, 500);
    }

    return jsonResponse({
      attachment: {
        id: attachment.id,
        trackId: attachment.track_id,
        fileName: attachment.file_name,
        storagePath: attachment.storage_path,
        url: attachment.url,
        fileType: attachment.file_type,
        fileSize: attachment.file_size,
        uploadedAt: attachment.created_at,
      },
    });
  } catch (error) {
    console.error("Upload attachment error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleGetAttachments(trackId: string): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from("track_attachments")
      .select("*")
      .eq("track_id", trackId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Get attachments error:", error);
      return jsonResponse({ error: error.message }, 500);
    }

    const attachments = (data || []).map((a) => ({
      id: a.id,
      trackId: a.track_id,
      fileName: a.file_name,
      storagePath: a.storage_path,
      url: a.url,
      fileType: a.file_type,
      fileSize: a.file_size,
      uploadedAt: a.created_at,
    }));

    return jsonResponse({ attachments });
  } catch (error) {
    console.error("Get attachments error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleDeleteAttachment(attachmentId: string): Promise<Response> {
  try {
    // Get attachment to find storage path
    const { data: attachment, error: fetchError } = await supabase
      .from("track_attachments")
      .select("storage_path")
      .eq("id", attachmentId)
      .single();

    if (fetchError || !attachment) {
      return jsonResponse({ error: "Attachment not found" }, 404);
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("track-attachments")
      .remove([attachment.storage_path]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from("track_attachments")
      .delete()
      .eq("id", attachmentId);

    if (dbError) {
      return jsonResponse({ error: dbError.message }, 500);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Delete attachment error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// =============================================================================
// TRANSCRIPTION HANDLERS
// =============================================================================

async function handleTranscribe(req: Request): Promise<Response> {
  try {
    if (!ASSEMBLYAI_API_KEY) {
      return jsonResponse({ error: "AssemblyAI API key not configured" }, 500);
    }

    const body = await req.json();
    const { audioUrl, mediaType = "video", trackId, forceRefresh = false } = body;

    if (!audioUrl) {
      return jsonResponse({ error: "audioUrl is required" }, 400);
    }

    console.log(`🎙️ Transcription request for: ${audioUrl.substring(0, 60)}...`);

    // Check for YouTube URLs (not supported)
    if (audioUrl.includes("youtube.com") || audioUrl.includes("youtu.be")) {
      return jsonResponse({ 
        error: "YouTube URLs are not supported. Please upload the video file directly." 
      }, 400);
    }

    const urlHash = await hashString(audioUrl);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const { data: cached, error: cacheError } = await supabase
        .from("media_transcripts")
        .select("*")
        .eq("media_url_hash", urlHash)
        .single();

      if (cached && !cacheError) {
        console.log(`✅ Found cached transcript (ID: ${cached.id})`);
        
        // Update usage tracking
        const updatedTracks = Array.from(new Set([...(cached.used_in_tracks || []), trackId].filter(Boolean)));
        
        await supabase
          .from("media_transcripts")
          .update({
            usage_count: (cached.usage_count || 0) + 1,
            last_used_at: new Date().toISOString(),
            used_in_tracks: updatedTracks,
          })
          .eq("id", cached.id);

        // If trackId is provided, auto-update track and generate facts (fire-and-forget)
        if (trackId) {
          console.log(`🔄 Auto-updating track ${trackId} with cached transcript and generating facts...`);
          
          // Update track with transcript
          supabase
            .from("tracks")
            .update({ transcript: cached.transcript_text || "" })
            .eq("id", trackId)
            .then(({ error: updateError }) => {
              if (updateError) {
                console.error("Failed to update track with cached transcript:", updateError);
              } else {
                console.log("✅ Track updated with cached transcript");
              }
            })
            .catch(err => console.error("Error updating track:", err));

          // Generate key facts (only for video tracks, not stories)
          supabase
            .from("tracks")
            .select("title, description, organization_id, transcript, type")
            .eq("id", trackId)
            .single()
            .then(async ({ data: trackData, error: trackError }) => {
              if (trackError || !trackData) {
                console.error("Failed to fetch track for fact generation:", trackError);
                return;
              }

              // Skip auto-fact generation for story tracks (handled by automateStoryWorkflow)
              if (trackData.type === "story") {
                console.log("ℹ️ Story track - facts will be generated after all videos are transcribed");
                return;
              }

              // Only generate facts if track doesn't already have them
              const { count: factCount } = await supabase
                .from("fact_usage")
                .select("*", { count: "exact", head: true })
                .eq("track_id", trackId);

              if (factCount && factCount > 0) {
                console.log(`ℹ️ Track already has ${factCount} facts, skipping generation`);
                return;
              }

              try {
                const factsResponse = await fetch(`${SUPABASE_URL}/functions/v1/trike-server/generate-key-facts`, {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    title: trackData.title || "Untitled Video",
                    description: trackData.description || "",
                    transcript: cached.transcript_text || trackData.transcript || "",
                    trackType: trackData.type || "video",
                    trackId: trackId,
                    companyId: trackData.organization_id,
                  }),
                });

                if (factsResponse.ok) {
                  const factsData = await factsResponse.json();
                  console.log(`✅ Generated ${factsData.factIds?.length || 0} key facts from cached transcript`);
                } else {
                  const error = await factsResponse.json().catch(() => ({}));
                  console.error("Failed to generate key facts:", error);
                }
              } catch (err) {
                console.error("Error generating key facts:", err);
              }
            })
            .catch(err => console.error("Error fetching track:", err));
        }

        return jsonResponse({
          transcript: cached,
          cached: true,
          message: `Using cached transcript (previously used ${cached.usage_count} times)`,
        });
      }
    }

    // Not cached - need to transcribe with AssemblyAI
    console.log("📤 Submitting to AssemblyAI...");

    // Determine if we need to download and re-upload the file
    let uploadUrl = audioUrl;
    const urlObj = new URL(audioUrl);
    const hasToken = urlObj.searchParams.has("token");

    if (!hasToken && audioUrl.includes("supabase.co/storage")) {
      // Need to download from Supabase and upload to AssemblyAI
      console.log("📥 Downloading from Supabase storage...");
      
      const pathParts = urlObj.pathname.split("/");
      const bucketIndex = pathParts.findIndex(part => part === "sign" || part === "public") + 1;
      
      if (bucketIndex > 0) {
        const bucket = pathParts[bucketIndex];
        const filePath = pathParts.slice(bucketIndex + 1).join("/");
        
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(bucket)
          .download(filePath);
        
        if (downloadError || !fileData) {
          console.error("Download error:", downloadError);
          return jsonResponse({ error: `Failed to download file: ${downloadError?.message}` }, 500);
        }
        
        // Upload to AssemblyAI
        const arrayBuffer = await fileData.arrayBuffer();
        const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
          method: "POST",
          headers: { "Authorization": ASSEMBLYAI_API_KEY },
          body: new Uint8Array(arrayBuffer),
        });
        
        if (!uploadResponse.ok) {
          const error = await uploadResponse.text();
          return jsonResponse({ error: `AssemblyAI upload failed: ${error}` }, 500);
        }
        
        const uploadResult = await uploadResponse.json();
        uploadUrl = uploadResult.upload_url;
        console.log("✅ Uploaded to AssemblyAI");
      }
    }

    // Submit transcription request
    const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        "Authorization": ASSEMBLYAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url: uploadUrl,
        speaker_labels: true,
        format_text: true,
      }),
    });

    if (!transcriptResponse.ok) {
      const error = await transcriptResponse.text();
      return jsonResponse({ error: `AssemblyAI error: ${error}` }, 500);
    }

    const { id: jobId } = await transcriptResponse.json();
    console.log(`📋 Transcription job submitted: ${jobId}`);

    // Poll for completion
    let transcript;
    let attempts = 0;
    const maxAttempts = 60; // 3 minutes max (60 * 3 seconds)

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      attempts++;

      const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${jobId}`, {
        headers: { "Authorization": ASSEMBLYAI_API_KEY },
      });

      transcript = await pollResponse.json();
      console.log(`📊 Status: ${transcript.status} (attempt ${attempts})`);

      if (transcript.status === "completed") {
        break;
      } else if (transcript.status === "error") {
        return jsonResponse({ error: `Transcription failed: ${transcript.error}` }, 500);
      }
    }

    if (!transcript || transcript.status !== "completed") {
      return jsonResponse({ error: "Transcription timed out" }, 500);
    }

    console.log("✅ Transcription completed!");

    // Calculate metadata
    const wordCount = transcript.text?.split(/\s+/).length || 0;
    const durationSeconds = transcript.audio_duration ? Math.floor(transcript.audio_duration / 1000) : null;

    // Save to database
    const { data: newTranscript, error: insertError } = await supabase
      .from("media_transcripts")
      .insert({
        media_url: audioUrl,
        media_url_hash: urlHash,
        media_type: mediaType,
        transcript_text: transcript.text || "",
        transcript_json: transcript,
        transcript_utterances: transcript.utterances || [],
        duration_seconds: durationSeconds,
        word_count: wordCount,
        language: "en",
        confidence_score: transcript.confidence || null,
        transcription_service: "assemblyai",
        used_in_tracks: trackId ? [trackId] : [],
        usage_count: 1,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to save transcript:", insertError);
      // Return the transcript anyway, just not cached
      return jsonResponse({
        transcript: {
          transcript_text: transcript.text,
          transcript_json: transcript,
          word_count: wordCount,
          duration_seconds: durationSeconds,
        },
        cached: false,
        message: "Transcription complete (failed to cache)",
      });
    }

    // If trackId is provided, automatically update the track and generate key facts
    if (trackId) {
      console.log(`🔄 Auto-updating track ${trackId} with transcript and generating facts...`);
      
      // Update track with transcript (fire-and-forget)
      supabase
        .from("tracks")
        .update({ transcript: transcript.text || "" })
        .eq("id", trackId)
        .then(({ error: updateError }) => {
          if (updateError) {
            console.error("Failed to update track with transcript:", updateError);
          } else {
            console.log("✅ Track updated with transcript");
          }
        })
        .catch(err => console.error("Error updating track:", err));

      // Generate key facts (fire-and-forget, only for video tracks, not stories)
      // Get track info for fact generation
      supabase
        .from("tracks")
        .select("title, description, organization_id, type")
        .eq("id", trackId)
        .single()
        .then(async ({ data: trackData, error: trackError }) => {
          if (trackError || !trackData) {
            console.error("Failed to fetch track for fact generation:", trackError);
            return;
          }

          // Skip auto-fact generation for story tracks (handled by automateStoryWorkflow)
          if (trackData.type === "story") {
            console.log("ℹ️ Story track - facts will be generated after all videos are transcribed");
            return;
          }

          // Only generate facts if track doesn't already have them
          const { count: factCount } = await supabase
            .from("fact_usage")
            .select("*", { count: "exact", head: true })
            .eq("track_id", trackId);

          if (factCount && factCount > 0) {
            console.log(`ℹ️ Track already has ${factCount} facts, skipping generation`);
            return;
          }

          try {
            // Call generate-key-facts endpoint
            const factsResponse = await fetch(`${SUPABASE_URL}/functions/v1/trike-server/generate-key-facts`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                title: trackData.title || "Untitled Video",
                description: trackData.description || "",
                transcript: transcript.text || "",
                trackType: trackData.type || "video",
                trackId: trackId,
                companyId: trackData.organization_id,
              }),
            });

            if (factsResponse.ok) {
              const factsData = await factsResponse.json();
              console.log(`✅ Generated ${factsData.factIds?.length || 0} key facts`);
            } else {
              const error = await factsResponse.json().catch(() => ({}));
              console.error("Failed to generate key facts:", error);
            }
          } catch (err) {
            console.error("Error generating key facts:", err);
          }
        })
        .catch(err => console.error("Error fetching track:", err));
    }

    return jsonResponse({
      transcript: newTranscript,
      cached: false,
      message: "Newly transcribed and cached",
    });

  } catch (error) {
    console.error("Transcription error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleTranscriptLookup(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { audioUrl } = body;

    if (!audioUrl) {
      return jsonResponse({ error: "audioUrl is required" }, 400);
    }

    const urlHash = await hashString(audioUrl);

    const { data, error } = await supabase
      .from("media_transcripts")
      .select("*")
      .eq("media_url_hash", urlHash)
      .single();

    if (error || !data) {
      return jsonResponse({ transcript: null, found: false });
    }

    return jsonResponse({ transcript: data, found: true });
  } catch (error) {
    console.error("Transcript lookup error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleGetTranscript(transcriptId: string): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from("media_transcripts")
      .select("*")
      .eq("id", transcriptId)
      .single();

    if (error || !data) {
      return jsonResponse({ error: "Transcript not found" }, 404);
    }

    return jsonResponse({ transcript: data });
  } catch (error) {
    console.error("Get transcript error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// =============================================================================
// FACTS HANDLERS
// =============================================================================

async function handleGetFactsForTrack(trackId: string): Promise<Response> {
  try {
    // Get fact IDs linked to this track
    const { data: usageData, error: usageError } = await supabase
      .from("fact_usage")
      .select("fact_id")
      .eq("track_id", trackId);

    if (usageError) {
      console.error("Get fact usage error:", usageError);
      return jsonResponse({ error: usageError.message }, 500);
    }

    if (!usageData || usageData.length === 0) {
      return jsonResponse({ facts: [] });
    }

    const factIds = usageData.map((u) => u.fact_id);

    // Get the actual facts
    const { data: facts, error: factsError } = await supabase
      .from("facts")
      .select("*")
      .in("id", factIds);

    if (factsError) {
      console.error("Get facts error:", factsError);
      return jsonResponse({ error: factsError.message }, 500);
    }

    return jsonResponse({ facts: facts || [] });
  } catch (error) {
    console.error("Get facts for track error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleGenerateKeyFacts(req: Request): Promise<Response> {
  try {
    if (!OPENAI_API_KEY) {
      return jsonResponse({ error: "OpenAI API key not configured" }, 500);
    }

    const body = await req.json();
    const { title, content, description, transcript, trackType, trackId, companyId } = body;

    // Build the content to analyze
    let textToAnalyze = "";
    if (title) textToAnalyze += `Title: ${title}\n\n`;
    if (description) textToAnalyze += `Description: ${description}\n\n`;
    if (content) textToAnalyze += `Content: ${content}\n\n`;
    if (transcript) textToAnalyze += `Transcript: ${transcript}\n\n`;

    if (!textToAnalyze.trim()) {
      return jsonResponse({ error: "No content provided to analyze" }, 400);
    }

    // Call OpenAI to extract key facts
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert at extracting key facts from educational content for workplace training in the convenience store and foodservice industry.

Your job is to extract COLD, MEASURABLE, IMMUTABLE FACTS that would be suitable for quiz questions. Think of these as the facts someone would write on notecards when studying for a test.

RULES:
1. Extract only factual, testable information - no motivational "fluff"
2. Each fact should be atomic - one testable concept per fact
3. However, keep related concepts together when they test a SINGLE idea (smart atomicity)
4. Facts should be context-independent when possible
5. For procedures, include numbered steps
6. Use "Fact" type for declarative knowledge, "Procedure" type for step-by-step processes

Return a JSON array of facts with this structure:
{
  "facts": [
    {
      "title": "Short descriptive title",
      "content": "The actual fact or procedure description",
      "type": "Fact" | "Procedure",
      "steps": ["Step 1", "Step 2"] // Only for Procedure type
    }
  ]
}

ONLY return valid JSON. No explanations or markdown.`,
          },
          {
            role: "user",
            content: textToAnalyze,
          },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI error:", errorText);
      return jsonResponse({ error: "Failed to generate facts from AI" }, 500);
    }

    const openaiData = await openaiResponse.json();
    const aiContent = openaiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      return jsonResponse({ error: "No content returned from AI" }, 500);
    }

    // Parse the AI response
    let parsedFacts;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedFacts = JSON.parse(jsonMatch[0]);
      } else {
        parsedFacts = JSON.parse(aiContent);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiContent);
      return jsonResponse({ error: "Failed to parse AI response" }, 500);
    }

    const factsToInsert = parsedFacts.facts || [];
    const insertedFactIds: string[] = [];
    const enrichedFacts: any[] = [];

    // Insert each fact into the database
    for (const fact of factsToInsert) {
      const { data: insertedFact, error: insertError } = await supabase
        .from("facts")
        .insert({
          title: fact.title,
          content: fact.content,
          type: fact.type || "Fact",
          steps: fact.steps || [],
          extracted_by: "ai-pass-1",
          extraction_confidence: 0.85,
          company_id: companyId,
          context: { specificity: "universal", tags: {} },
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert fact error:", insertError);
        continue;
      }

      insertedFactIds.push(insertedFact.id);
      enrichedFacts.push(insertedFact);

      // Link to track if provided
      if (trackId) {
        const { error: usageError } = await supabase.from("fact_usage").insert({
          fact_id: insertedFact.id,
          track_id: trackId,
          track_type: trackType || "article",
        });

        if (usageError) {
          console.error("Insert fact usage error:", usageError);
        }
      }
    }

    return jsonResponse({
      enriched: enrichedFacts,
      factIds: insertedFactIds,
    });
  } catch (error) {
    console.error("Generate key facts error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// ============================================
// AI TAG RECOMMENDATION HANDLER
// ============================================

interface TagRecommendation {
  tag_id: string;
  tag_name: string;
  tag_color: string | null;
  parent_category: string;
  confidence: number;
  reasoning: string;
  auto_select: boolean;
}

interface NewTagSuggestion {
  suggested_name: string;
  suggested_parent: string;
  description?: string;  // Contextual description of what content belongs in this tag
  reasoning: string;     // Why this new tag is needed (justification)
}

interface RecommendTagsResponse {
  recommendations: TagRecommendation[];
  new_tag_suggestions: NewTagSuggestion[];
  analysis_summary: string;
}

async function handleRecommendTags(req: Request): Promise<Response> {
  try {
    const { 
      title, 
      description, 
      transcript, 
      keyFacts,
      trackId,
      organizationId,
      parentTagId = '2f13a667-a2f6-49ee-85b8-094e354b0ebb' // Training Topics default
    } = await req.json();

    const analysisResult = await performTagAnalysis({
      title,
      description,
      transcript,
      keyFacts,
      trackId,
      organizationId,
      parentTagId
    });

    return jsonResponse(analysisResult);

  } catch (error: any) {
    console.error('Error in handleRecommendTags:', error);
    return jsonResponse({ 
      error: error.message || 'Failed to generate tag recommendations',
      recommendations: [],
      new_tag_suggestions: [],
    }, 500);
  }
}

async function handleProcessAnalysisQueue(req: Request): Promise<Response> {
  try {
    // 1. Fetch pending analysis tasks
    const { data: pendingTasks, error: fetchError } = await supabase
      .from('ai_analysis_log')
      .select('*')
      .eq('status', 'pending')
      .limit(5); // Process in small batches

    if (fetchError) throw fetchError;
    if (!pendingTasks || pendingTasks.length === 0) {
      return jsonResponse({ message: 'No pending tasks' });
    }

    const results = [];
    for (const task of pendingTasks) {
      // 2. Mark as processing
      await supabase
        .from('ai_analysis_log')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('id', task.id);

      try {
        if (task.analysis_type === 'tags') {
          // 3. Fetch track data
          const { data: track, error: trackError } = await supabase
            .from('tracks')
            .select('*')
            .eq('id', task.track_id)
            .single();

          if (trackError) throw trackError;

          // 4. Fetch facts for context
          const { data: usageData } = await supabase
            .from('fact_usage')
            .select('fact_id')
            .eq('track_id', task.track_id);
          
          const factIds = usageData?.map(u => u.fact_id) || [];
          const { data: facts } = factIds.length > 0 
            ? await supabase.from('facts').select('*').in('id', factIds)
            : { data: [] };

          // 5. Run analysis
          const analysisResult = await performTagAnalysis({
            title: track.title,
            description: track.description,
            transcript: track.transcript,
            keyFacts: facts || [],
            trackId: track.id,
            organizationId: track.organization_id
          });

          // 6. Store existing suggestions for Phase 2 surfacing
          for (const rec of analysisResult.recommendations) {
            await supabase.from('ai_tag_suggestions').upsert({
              track_id: track.id,
              organization_id: track.organization_id,
              suggested_tag_name: rec.tag_name,
              suggested_parent_category: rec.parent_category,
              reasoning: rec.reasoning,
              confidence: rec.confidence,
              status: 'pending',
              prompt_hash: analysisResult.prompt_hash,
              response_hash: analysisResult.response_hash,
              processing_time_ms: analysisResult.processing_time_ms
            }, {
              onConflict: 'track_id,suggested_tag_name',
              ignoreDuplicates: true
            });
          }

          results.push({ track_id: task.track_id, status: 'completed' });
          
          // 7. Mark as completed
          await supabase
            .from('ai_analysis_log')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', task.id);
        }
      } catch (err: any) {
        console.error(`Error processing task ${task.id}:`, err);
        await supabase
          .from('ai_analysis_log')
          .update({ status: 'failed', error_message: err.message, completed_at: new Date().toISOString() })
          .eq('id', task.id);
        results.push({ track_id: task.track_id, status: 'failed', error: err.message });
      }
    }

    return jsonResponse({ results });
  } catch (error: any) {
    console.error('Error in handleProcessAnalysisQueue:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

async function performTagAnalysis(params: {
  title: string;
  description: string;
  transcript: string;
  keyFacts: any[];
  trackId: string;
  organizationId: string;
  parentTagId?: string;
}): Promise<RecommendTagsResponse & { prompt_hash?: string; response_hash?: string; processing_time_ms?: number }> {
  const startTime = Date.now();
  const { title, description, transcript, keyFacts, trackId, organizationId, parentTagId = '2f13a667-a2f6-49ee-85b8-094e354b0ebb' } = params;

  // 1. Fetch available child tags
  const { data: childTags, error: tagsError } = await supabase
    .from('tags')
    .select(`
      id, 
      name, 
      description, 
      color,
      parent:parent_id (
        id,
        name
      )
    `)
    .eq('type', 'child')
    .eq('system_category', 'content');

  if (tagsError) throw new Error('Failed to fetch available tags');

  const { data: subcategories, error: subError } = await supabase
    .from('tags')
    .select('id, name')
    .eq('parent_id', parentTagId)
    .eq('type', 'subcategory');

  if (subError) throw subError;

  const subcategoryIds = new Set(subcategories.map((s: any) => s.id));
  const trainingTopicTags = childTags.filter((tag: any) => 
    tag.parent && subcategoryIds.has(tag.parent.id)
  );

  if (trainingTopicTags.length === 0) {
    return {
      recommendations: [],
      new_tag_suggestions: [],
      analysis_summary: 'No training topic tags available for recommendation.'
    };
  }

  // 2. Build content context
  const contentContext = buildContentContextForTags(title, description, transcript, keyFacts);

  // 3. Build tag list for AI
  const tagListForAI = trainingTopicTags.map((tag: any) => {
    const parentName = tag.parent?.name || 'Unknown';
    return `- "${tag.name}" (Category: ${parentName})${tag.description ? `\n  Context: ${tag.description}` : ''}`;
  }).join('\n');

  // 4. Build the AI prompt
  const systemPrompt = `You are an expert training content classifier for convenience store and foodservice operations.

YOUR TASK: Analyze the provided training content and recommend relevant tags from the available list.

CRITICAL RULES:

1. MULTI-TOPIC DETECTION: Training content often covers multiple related topics. A video about "checking customer IDs" should be tagged with Alcohol Service, Tobacco Sales, Vape Sales, AND Age-Restricted Sales. Recommend ALL relevant tags, not just the "best" one. There's no penalty for recommending 5-8 tags if they're genuinely relevant.

2. DESCRIPTIONS ARE CONTEXT, NOT KEYWORDS: Tag descriptions are hints about what content belongs there, not exhaustive definitions. Use your judgment about whether content RELATES to a tag's domain, even if specific keywords don't match exactly. A video about "proper hand washing technique" relates to Food Safety even if it never says "temperature" or "contamination."

3. CONFIDENCE SCORING:
   - 90-100: Directly and explicitly about this topic
   - 75-89: Clearly relevant, strong connection
   - 60-74: Related, would be useful categorization
   - 50-59: Tangentially related, borderline
   - Below 50: Don't recommend

4. HIERARCHY AWARENESS: Tags are organized by category (Compliance, Foodservice, Customer Service, etc.). Content can span multiple categories. Don't artificially limit to one category.

5. NEW TAG SUGGESTIONS: If the content covers a topic that doesn't fit well into ANY existing tag (all would be below 60% confidence), suggest a new tag. Include:
   - Suggested name (concise, follows existing naming conventions)
   - Which parent category it should go under
   - A TAG DESCRIPTION: This is NOT reasoning for why the tag is needed. The description should define what types of content belong in this tag so the AI can use it for future classification. Write it as a contextual hint (e.g., "Training content related to identifying, preventing, and reporting suspicious financial transactions and money laundering activities in retail environments.")
   - Brief reasoning (separate from description) explaining why this new tag is warranted

OUTPUT FORMAT (JSON):
{
  "analysis_summary": "Brief 1-2 sentence summary of what this content is about",
  "recommendations": [
    {
      "tag_name": "Exact tag name from the list",
      "confidence": 85,
      "reasoning": "One sentence explaining why this tag applies"
    }
  ],
  "new_tag_suggestions": [
    {
      "suggested_name": "Suggested Tag Name",
      "suggested_parent": "Parent Category Name",
      "description": "Contextual description of what content belongs in this tag (for future AI classification)",
      "reasoning": "Why this new tag is needed (justification for creating it)"
    }
  ]
}

AVAILABLE TAGS BY CATEGORY:
${tagListForAI}`;

  const userPrompt = `CONTENT TO ANALYZE:

${contentContext}

Analyze this content and provide tag recommendations. Remember:
- Recommend ALL relevant tags (multi-topic detection)
- Use judgment, not just keyword matching
- Suggest new tags only if truly needed`;

  // 5. Call OpenAI
  if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');

  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!openaiResponse.ok) throw new Error(`OpenAI API error: ${openaiResponse.status}`);

  const aiResult = await openaiResponse.json();
  const aiOutput = JSON.parse(aiResult.choices[0].message.content);

  // 6. Enrich recommendations
  const enrichedRecommendations: TagRecommendation[] = (aiOutput.recommendations || [])
    .map((rec: any) => {
      const matchedTag = trainingTopicTags.find((t: any) => 
        t.name.toLowerCase() === rec.tag_name.toLowerCase()
      );
      if (!matchedTag) return null;
      return {
        tag_id: matchedTag.id,
        tag_name: matchedTag.name,
        tag_color: matchedTag.color,
        parent_category: matchedTag.parent?.name || 'Unknown',
        confidence: Math.min(100, Math.max(0, rec.confidence)),
        reasoning: rec.reasoning,
        auto_select: rec.confidence >= 85,
      };
    })
    .filter(Boolean)
    .filter((rec: any) => rec.confidence >= 50)
    .sort((a: any, b: any) => b.confidence - a.confidence);

  // 7. Process new tag suggestions
  const newTagSuggestions: NewTagSuggestion[] = (aiOutput.new_tag_suggestions || [])
    .filter((sug: any) => sug.suggested_name && sug.suggested_parent);

  // 8. Store new tag suggestions
  if (newTagSuggestions.length > 0 && trackId && organizationId) {
    storeNewTagSuggestions(trackId, organizationId, newTagSuggestions).catch(console.error);
  }

  // 9. Observability
  const promptHash = await hashString(systemPrompt + userPrompt);
  const responseHash = await hashString(aiResult.choices[0].message.content);
  const processingTime = Date.now() - startTime;

  return {
    recommendations: enrichedRecommendations,
    new_tag_suggestions: newTagSuggestions,
    analysis_summary: aiOutput.analysis_summary || 'Content analyzed successfully.',
    prompt_hash: promptHash,
    response_hash: responseHash,
    processing_time_ms: processingTime
  };
}

function buildContentContextForTags(
  title: string | null, 
  description: string | null, 
  transcript: string | null, 
  keyFacts: any[] | null
): string {
  const parts: string[] = [];
  
  if (title) parts.push(`Title: ${title}`);
  if (description) parts.push(`Description: ${description}`);
  if (keyFacts && keyFacts.length > 0) {
    const factsText = keyFacts
      .map((f: any) => typeof f === 'string' ? f : f.fact || f.content || '')
      .filter(Boolean)
      .join('; ');
    if (factsText) parts.push(`Key Facts: ${factsText}`);
  }
  if (transcript) {
    parts.push(`Transcript: ${transcript.substring(0, 3000)}`);
  }
  
  return parts.join('\n\n');
}

async function storeNewTagSuggestions(
  trackId: string,
  organizationId: string,
  suggestions: NewTagSuggestion[]
): Promise<void> {
  for (const suggestion of suggestions) {
    try {
      await supabase
        .from('ai_tag_suggestions')
        .upsert({
          track_id: trackId,
          organization_id: organizationId,
          suggested_tag_name: suggestion.suggested_name,
          suggested_parent_category: suggestion.suggested_parent,
          suggested_description: suggestion.description,  // Contextual description for future AI classification
          reasoning: suggestion.reasoning,  // Justification for why this tag is needed
          status: 'pending',
        }, {
          onConflict: 'track_id,suggested_tag_name',
          ignoreDuplicates: true,
        });
    } catch (err) {
      console.error('Error storing suggestion:', err);
    }
  }
}

async function handleUpdateFact(factId: string, req: Request): Promise<Response> {
  try {
    const updates = await req.json();

    const { data: fact, error } = await supabase
      .from("facts")
      .update({
        title: updates.title,
        content: updates.content,
        type: updates.type,
        steps: updates.steps,
        updated_at: new Date().toISOString(),
      })
      .eq("id", factId)
      .select()
      .single();

    if (error) {
      console.error("Update fact error:", error);
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ fact });
  } catch (error) {
    console.error("Update fact error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleDeleteFactFromTrack(factId: string, trackId: string): Promise<Response> {
  try {
    // Delete the fact_usage link
    const { error } = await supabase
      .from("fact_usage")
      .delete()
      .eq("fact_id", factId)
      .eq("track_id", trackId);

    if (error) {
      console.error("Delete fact usage error:", error);
      return jsonResponse({ error: error.message }, 500);
    }

    // Optionally: Check if fact is orphaned and delete it
    const { data: remainingUsage } = await supabase
      .from("fact_usage")
      .select("id")
      .eq("fact_id", factId)
      .limit(1);

    if (!remainingUsage || remainingUsage.length === 0) {
      // Fact is no longer used anywhere, delete it
      await supabase.from("facts").delete().eq("id", factId);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Delete fact from track error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// =============================================================================
// TRACK RELATIONSHIPS HANDLERS
// =============================================================================

async function getOrgIdFromToken(req: Request): Promise<string | null> {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("⚠️ [getOrgIdFromToken] No Authorization header");
      return null;
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      console.log("⚠️ [getOrgIdFromToken] No token in Authorization header");
      return null;
    }

    // Check if this is the public anon key (demo mode)
    const publicAnonKey = Deno.env.get("PUBLIC_ANON_KEY");
    if (token === publicAnonKey) {
      // Demo mode: return default org ID
      console.log("🔓 [getOrgIdFromToken] Demo mode detected, using default org ID");
      return "10000000-0000-0000-0000-000000000001";
    }

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError) {
      console.error("❌ [getOrgIdFromToken] Error getting user from token:", userError.message);
      return null;
    }
    if (!user) {
      console.log("⚠️ [getOrgIdFromToken] No user returned from token");
      return null;
    }

    console.log(`👤 [getOrgIdFromToken] User ID: ${user.id}`);

    // Get organization from user profile
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("❌ [getOrgIdFromToken] Error getting profile:", profileError.message);
      return null;
    }
    if (!profile) {
      console.log("⚠️ [getOrgIdFromToken] No profile found for user");
      return null;
    }

    const orgId = profile.organization_id || null;
    console.log(`🏢 [getOrgIdFromToken] Organization ID: ${orgId}`);
    return orgId;
  } catch (error) {
    console.error("❌ [getOrgIdFromToken] Exception:", error);
    return null;
  }
}

async function handleGetSourceTrack(trackId: string, relationshipType: string | null, req: Request): Promise<Response> {
  try {
    let orgId = await getOrgIdFromToken(req);
    console.log(`🔍 [GetSourceTrack] trackId: ${trackId}, relationshipType: ${relationshipType}, orgId: ${orgId}`);
    
    // Fallback: Get org_id from the track itself if token extraction failed
    if (!orgId) {
      console.log("⚠️ [GetSourceTrack] No orgId from token, trying to get from track...");
      const { data: track, error: trackError } = await supabase
        .from("tracks")
        .select("organization_id")
        .eq("id", trackId)
        .single();
      
      if (!trackError && track?.organization_id) {
        orgId = track.organization_id;
        console.log(`✅ [GetSourceTrack] Got orgId from track: ${orgId}`);
      } else {
        console.error("❌ [GetSourceTrack] Could not get orgId from track either");
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
    }

    let query = supabase
      .from("track_relationships")
      .select(`
        id,
        source_track_id,
        derived_track_id,
        relationship_type,
        created_at,
        source_track:tracks!source_track_id(
          id,
          title,
          type,
          thumbnail_url,
          status
        )
      `)
      .eq("organization_id", orgId)
      .eq("derived_track_id", trackId);

    if (relationshipType) {
      query = query.eq("relationship_type", relationshipType);
    }

    const { data, error } = await query.single();

    console.log(`📊 [GetSourceTrack] Query result:`, { 
      hasData: !!data, 
      hasError: !!error, 
      errorCode: error?.code,
      dataKeys: data ? Object.keys(data) : []
    });

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        console.log("📊 [GetSourceTrack] No relationship found (PGRST116)");
        return jsonResponse({ source: null });
      }
      console.error("❌ [GetSourceTrack] Error:", error);
      return jsonResponse({ error: error.message }, 500);
    }

    // If join didn't work, fetch track separately
    if (data && !data.source_track && data.source_track_id) {
      const { data: track, error: trackError } = await supabase
        .from("tracks")
        .select("id, title, type, thumbnail_url, status")
        .eq("id", data.source_track_id)
        .eq("organization_id", orgId)
        .single();

      if (!trackError && track) {
        data.source_track = track;
      }
    }

    console.log(`✅ [GetSourceTrack] Returning source relationship`);
    return jsonResponse({ source: data });
  } catch (error) {
    console.error("❌ [GetSourceTrack] Exception:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleGetDerivedTracks(trackId: string, relationshipType: string | null, req: Request): Promise<Response> {
  try {
    let orgId = await getOrgIdFromToken(req);
    console.log(`🔍 [GetDerivedTracks] trackId: ${trackId}, relationshipType: ${relationshipType}, orgId: ${orgId}`);
    
    // Fallback: Get org_id from the track itself if token extraction failed
    if (!orgId) {
      console.log("⚠️ [GetDerivedTracks] No orgId from token, trying to get from track...");
      const { data: track, error: trackError } = await supabase
        .from("tracks")
        .select("organization_id")
        .eq("id", trackId)
        .single();
      
      if (!trackError && track?.organization_id) {
        orgId = track.organization_id;
        console.log(`✅ [GetDerivedTracks] Got orgId from track: ${orgId}`);
      } else {
        console.error("❌ [GetDerivedTracks] Could not get orgId from track either");
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
    }

    let query = supabase
      .from("track_relationships")
      .select(`
        id,
        source_track_id,
        derived_track_id,
        relationship_type,
        created_at,
        derived_track:tracks!derived_track_id(
          id,
          title,
          type,
          thumbnail_url,
          status
        )
      `)
      .eq("organization_id", orgId)
      .eq("source_track_id", trackId);

    if (relationshipType) {
      query = query.eq("relationship_type", relationshipType);
    }

    const { data, error } = await query;

    console.log(`📊 [GetDerivedTracks] Query result:`, { 
      count: data?.length || 0,
      hasData: !!data, 
      hasError: !!error, 
      errorMessage: error?.message,
      sample: data?.[0]
    });

    if (error) {
      console.error("❌ [GetDerivedTracks] Error:", error);
      return jsonResponse({ error: error.message }, 500);
    }

    // If join didn't work, fetch tracks separately
    const relationships = data || [];
    const needsFallback = relationships.some((rel: any) => !rel.derived_track && rel.derived_track_id);
    
    console.log(`📊 [GetDerivedTracks] Relationships:`, {
      count: relationships.length,
      needsFallback,
      hasDerivedTracks: relationships.some((rel: any) => rel.derived_track)
    });

    if (needsFallback && relationships.length > 0) {
      const trackIds = relationships.map((rel: any) => rel.derived_track_id).filter(Boolean);

      if (trackIds.length > 0) {
        const { data: tracks, error: tracksError } = await supabase
          .from("tracks")
          .select("id, title, type, thumbnail_url, status")
          .in("id", trackIds)
          .eq("organization_id", orgId);

        if (!tracksError && tracks) {
          const trackMap = new Map(tracks.map((t: any) => [t.id, t]));
          relationships.forEach((rel: any) => {
            if (rel.derived_track_id && !rel.derived_track) {
              rel.derived_track = trackMap.get(rel.derived_track_id);
            }
          });
        }
      }
    }

    console.log(`✅ [GetDerivedTracks] Returning ${relationships.length} relationships`);
    return jsonResponse({ derived: relationships });
  } catch (error) {
    console.error("❌ [GetDerivedTracks] Exception:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleGetRelationshipStats(trackId: string, req: Request): Promise<Response> {
  try {
    let orgId = await getOrgIdFromToken(req);
    
    // Fallback: Get org_id from the track itself if token extraction failed
    if (!orgId) {
      console.log("⚠️ [GetRelationshipStats] No orgId from token, trying to get from track...");
      const { data: track, error: trackError } = await supabase
        .from("tracks")
        .select("organization_id")
        .eq("id", trackId)
        .single();
      
      if (!trackError && track?.organization_id) {
        orgId = track.organization_id;
        console.log(`✅ [GetRelationshipStats] Got orgId from track: ${orgId}`);
      } else {
        console.error("❌ [GetRelationshipStats] Could not get orgId from track either");
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
    }

    // Get derived tracks (where this is the source)
    const { data: derivedData, error: derivedError } = await supabase
      .from("track_relationships")
      .select(`
        id,
        source_track_id,
        derived_track_id,
        relationship_type,
        created_at,
        derived_track:tracks!derived_track_id(
          id,
          title,
          type,
          thumbnail_url,
          status
        )
      `)
      .eq("organization_id", orgId)
      .eq("source_track_id", trackId)
      .eq("relationship_type", "source");

    if (derivedError) {
      console.error("Get derived track stats error:", derivedError);
      return jsonResponse({ error: derivedError.message }, 500);
    }

    // If join didn't work, fetch tracks separately
    const relationships = derivedData || [];
    const needsFallback = relationships.some((rel: any) => !rel.derived_track && rel.derived_track_id);

    if (needsFallback && relationships.length > 0) {
      const trackIds = relationships.map((rel: any) => rel.derived_track_id).filter(Boolean);

      if (trackIds.length > 0) {
        const { data: tracks, error: tracksError } = await supabase
          .from("tracks")
          .select("id, title, type, thumbnail_url, status")
          .in("id", trackIds)
          .eq("organization_id", orgId);

        if (!tracksError && tracks) {
          const trackMap = new Map(tracks.map((t: any) => [t.id, t]));
          relationships.forEach((rel: any) => {
            if (rel.derived_track_id && !rel.derived_track) {
              rel.derived_track = trackMap.get(rel.derived_track_id);
            }
          });
        }
      }
    }

    // Get source tracks count (where this is derived)
    const { count: sourceCount, error: sourceError } = await supabase
      .from("track_relationships")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("derived_track_id", trackId);

    if (sourceError) {
      console.error("Get source track stats error:", sourceError);
      return jsonResponse({ error: sourceError.message }, 500);
    }

    const hasDerivedCheckpoints = relationships.some(
      (rel: any) => rel.derived_track?.type === "checkpoint"
    );

    return jsonResponse({
      stats: {
        derivedCount: relationships.length,
        sourceCount: sourceCount || 0,
        hasDerivedCheckpoints,
        derived: relationships,
      },
    });
  } catch (error) {
    console.error("Get relationship stats error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleCreateRelationship(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { sourceTrackId, derivedTrackId, relationshipType = "source" } = body;
    
    let orgId = await getOrgIdFromToken(req);
    
    // Fallback: Get org_id from one of the tracks if token extraction failed
    if (!orgId) {
      console.log("⚠️ [CreateRelationship] No orgId from token, trying to get from track...");
      const { data: track, error: trackError } = await supabase
        .from("tracks")
        .select("organization_id")
        .eq("id", sourceTrackId || derivedTrackId)
        .single();
      
      if (!trackError && track?.organization_id) {
        orgId = track.organization_id;
        console.log(`✅ [CreateRelationship] Got orgId from track: ${orgId}`);
      } else {
        console.error("❌ [CreateRelationship] Could not get orgId from track either");
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
    }
    
    if (!sourceTrackId || !derivedTrackId) {
      return jsonResponse({ error: "sourceTrackId and derivedTrackId are required" }, 400);
    }


    const { data, error } = await supabase
      .from("track_relationships")
      .insert({
        organization_id: orgId,
        source_track_id: sourceTrackId,
        derived_track_id: derivedTrackId,
        relationship_type: relationshipType,
      })
      .select()
      .single();

    if (error) {
      console.error("Create relationship error:", error);
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ relationship: data });
  } catch (error) {
    console.error("Create relationship error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleDeleteRelationship(relationshipId: string, req: Request): Promise<Response> {
  try {
    const orgId = await getOrgIdFromToken(req);
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { error } = await supabase
      .from("track_relationships")
      .delete()
      .eq("id", relationshipId)
      .eq("organization_id", orgId);

    if (error) {
      console.error("Delete relationship error:", error);
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Delete relationship error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// =============================================================================
// TRACK VERSIONS HANDLERS
// =============================================================================

async function handleGetTrackVersions(trackId: string): Promise<Response> {
  try {
    if (!trackId) {
      return jsonResponse({ error: "Track ID is required" }, 400);
    }

    // Get the track to find parent ID
    const { data: track, error: trackError } = await supabase
      .from("tracks")
      .select("id, parent_track_id")
      .eq("id", trackId)
      .single();

    if (trackError || !track) {
      // Track not found, return empty versions
      return jsonResponse({
        success: true,
        versions: [],
      });
    }

    // Find the parent track ID (could be this track or its parent)
    const parentId = track.parent_track_id || track.id;

    // Get all versions (parent + children)
    const { data: versions, error: versionsError } = await supabase
      .from("tracks")
      .select("*")
      .or(`id.eq.${parentId},parent_track_id.eq.${parentId}`)
      .order("version_number", { ascending: true });

    if (versionsError) {
      console.error("Error getting versions:", versionsError);
      return jsonResponse({
        success: true,
        versions: [],
      });
    }

    return jsonResponse({
      success: true,
      versions: versions || [],
    });
  } catch (error) {
    console.error("Get track versions error:", error);
    return jsonResponse({
      success: true,
      versions: [],
    });
  }
}

// =============================================================================
// COMPANY BRAIN (RAG) HANDLERS
// =============================================================================

/**
 * Chunk text into smaller pieces for embedding
 */
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);

    // Try to break at sentence boundaries
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);
      
      if (breakPoint > chunkSize * 0.5) {
        chunk = chunk.slice(0, breakPoint + 1);
        start += breakPoint + 1;
      } else {
        start += chunkSize - overlap;
      }
    } else {
      start = text.length;
    }

    chunks.push(chunk.trim());
  }

  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Generate embedding using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI embedding error: ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Index content for RAG
 */
async function handleBrainEmbed(req: Request): Promise<Response> {
  try {
    // Try token auth first
    let orgId = await getOrgIdFromToken(req);
    
    // Parse body to check for organizationId fallback
    const body = await req.json();
    const { contentType, contentId, text, metadata = {}, organizationId } = body;
    
    // Use body organizationId as fallback if token auth failed
    if (!orgId && organizationId) {
      console.log(`[Brain] Using organizationId from request body: ${organizationId}`);
      orgId = organizationId;
    }
    
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized - no valid token or organizationId provided" }, 401);
    }

    if (!contentType || !contentId || !text) {
      return jsonResponse({ error: "contentType, contentId, and text are required" }, 400);
    }

    // Phase 5: Enrich text with accepted tag reasonings for better RAG/citation context
    let enrichedText = text;
    if (contentType === 'track') {
      const { data: suggestions } = await supabase
        .from('ai_tag_suggestions')
        .select('suggested_tag_name, reasoning')
        .eq('track_id', contentId)
        .eq('status', 'accepted');
        
      if (suggestions && suggestions.length > 0) {
        const tagContext = suggestions.map(s => `Topic: ${s.suggested_tag_name}. Context: ${s.reasoning}`).join('\n');
        enrichedText += `\n\nAdditional Topic Context:\n${tagContext}`;
      }
    }

    // Extract is_system_template from metadata
    const isSystemTemplate = metadata.isSystemTemplate || false;

    // Ensure track title is in metadata for fallback citation display
    const enrichedMetadata = { ...metadata };
    if (contentType === 'track' && !enrichedMetadata.trackTitle) {
      // Try to get track title for metadata
      const { data: trackInfo } = await supabase
        .from('tracks')
        .select('title')
        .eq('id', contentId)
        .maybeSingle();
      if (trackInfo?.title) {
        enrichedMetadata.trackTitle = trackInfo.title;
      }
    }

    // Chunk the text
    const chunks = chunkText(enrichedText);
    console.log(`📚 Indexing ${chunks.length} chunks for ${contentType}:${contentId} (system: ${isSystemTemplate})`);

    // Generate embeddings and store
    const embeddings = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await generateEmbedding(chunk);

      const { data, error } = await supabase
        .from("brain_embeddings")
        .insert({
          organization_id: orgId,
          content_type: contentType,
          content_id: contentId,
          chunk_index: i,
          chunk_text: chunk,
          embedding: embedding,
          metadata: enrichedMetadata,
          is_system_template: isSystemTemplate,
        })
        .select()
        .single();

      if (error) {
        console.error(`Error inserting chunk ${i}:`, error);
        continue;
      }

      embeddings.push(data);
    }

    return jsonResponse({
      success: true,
      chunksIndexed: embeddings.length,
      totalChunks: chunks.length,
    });
  } catch (error) {
    console.error("Brain embed error:", error);
    return jsonResponse({ error: error.message || "Failed to index content" }, 500);
  }
}

/**
 * Remove content from index
 */
async function handleBrainRemove(req: Request): Promise<Response> {
  try {
    // Try token auth first
    let orgId = await getOrgIdFromToken(req);
    
    // Parse body to check for organizationId fallback
    const body = await req.json();
    const { contentType, contentId, organizationId } = body;
    
    // Use body organizationId as fallback if token auth failed
    if (!orgId && organizationId) {
      console.log(`[Brain] Using organizationId from request body: ${organizationId}`);
      orgId = organizationId;
    }
    
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized - no valid token or organizationId provided" }, 401);
    }

    if (!contentType || !contentId) {
      return jsonResponse({ error: "contentType and contentId are required" }, 400);
    }

    const { error } = await supabase
      .from("brain_embeddings")
      .delete()
      .eq("organization_id", orgId)
      .eq("content_type", contentType)
      .eq("content_id", contentId);

    if (error) {
      console.error("Brain remove error:", error);
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Brain remove error:", error);
    return jsonResponse({ error: error.message || "Failed to remove content" }, 500);
  }
}

/**
 * Build citations array from source chunks
 * Returns citations in same order as sources array
 */
async function buildCitations(sources: any[]): Promise<any[]> {
  if (!sources || sources.length === 0) return [];
  
  console.log(`[Citations] Building ${sources.length} citations`);
  
  const citationsPromises = sources.map(async (source, index) => {
    try {
      // Log what we're looking up
      console.log(`[Citations] Citation ${index + 1}: Looking up content_id="${source.content_id}"`);
      console.log(`[Citations] Citation ${index + 1}: Chunk preview="${source.chunk_text?.substring(0, 80) || 'no text'}..."`);
      
      // #region agent log
      const chunkPreview = source.chunk_text ? source.chunk_text.substring(0, 50) : 'no text';
      const hasMetadata = !!source.metadata;
      const logData = {
        location: 'trike-server/index.ts:1794',
        message: 'Citation lookup start',
        data: {
          index: index + 1,
          contentId: source.content_id,
          chunkPreview: chunkPreview,
          hasMetadata: hasMetadata
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'C'
      };
      fetch('http://127.0.0.1:7242/ingest/8dfcf613-f58b-4a75-8c2c-4e44814a9ad0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
      // #endregion
      
      // Get track metadata - use service role client which should have access
      const { data: track, error: trackError } = await supabase
        .from('tracks')
        .select('id, title, version_number, published_at')
        .eq('id', source.content_id)
        .maybeSingle();
      
      if (trackError) {
        console.error(`[Citations] ERROR looking up track for citation ${index + 1}:`, trackError);
        console.error(`[Citations] Error details: code=${trackError.code}, message=${trackError.message}`);
        // #region agent log
        const errorLogData = {
          location: 'trike-server/index.ts:1804',
          message: 'Track lookup error',
          data: {
            index: index + 1,
            contentId: source.content_id,
            error: trackError.message,
            code: trackError.code
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'C'
        };
        fetch('http://127.0.0.1:7242/ingest/8dfcf613-f58b-4a75-8c2c-4e44814a9ad0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(errorLogData)}).catch(()=>{});
        // #endregion
      }
      
      // Log what we found
      const trackTitle = track?.title || null;
      if (track) {
        console.log(`[Citations] Citation ${index + 1}: FOUND track "${trackTitle}" for content_id="${source.content_id}"`);
      } else {
        console.warn(`[Citations] Citation ${index + 1}: NO TRACK FOUND for content_id="${source.content_id}"`);
        console.warn(`[Citations] Citation ${index + 1}: Will use metadata title: ${source.metadata?.trackTitle || source.metadata?.title || 'Unknown Source'}`);
      }
      // #region agent log
      const metadataTitle = source.metadata && source.metadata.trackTitle ? source.metadata.trackTitle : null;
      const trackFound = !!track;
      const logData2 = {
        location: 'trike-server/index.ts:1816',
        message: 'Citation lookup result',
        data: {
          index: index + 1,
          contentId: source.content_id,
          trackTitle: trackTitle,
          found: trackFound,
          metadataTitle: metadataTitle
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'C'
      };
      fetch('http://127.0.0.1:7242/ingest/8dfcf613-f58b-4a75-8c2c-4e44814a9ad0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData2)}).catch(()=>{});
      // #endregion
      
      // If no track found, check if this is actually a valid content_id
      if (!track) {
        console.warn(`[Citations] No track found for content_id: ${source.content_id}`);
        // Try to extract title from metadata if available
        const metadataTitle = source.metadata?.trackTitle || source.metadata?.title || null;
        if (metadataTitle) {
          console.log(`[Citations] Using metadata title: ${metadataTitle}`);
        }
      }
      
      return {
        index: index + 1,
        quote: source.chunk_text?.substring(0, 200) + (source.chunk_text?.length > 200 ? '...' : '') || 'No preview available',
        trackId: source.content_id,
        trackTitle: track?.title || source.metadata?.trackTitle || source.metadata?.title || 'Unknown Source',
        version: track?.version_number || 1,
        publishedDate: track?.published_at || null,
        similarity: source.similarity || null,
        // Add chunk text preview for debugging
        chunkPreview: source.chunk_text?.substring(0, 50) || null,
      };
    } catch (error) {
      console.error(`[Citations] Exception building citation ${index + 1}:`, error);
      return {
        index: index + 1,
        quote: source.chunk_text?.substring(0, 200) + '...' || 'No preview available',
        trackId: source.content_id,
        trackTitle: source.metadata?.trackTitle || 'Unknown Source',
        version: 1,
        publishedDate: null,
        similarity: source.similarity || null,
        chunkPreview: null,
      };
    }
  });
  
  const citations = await Promise.all(citationsPromises);
  console.log(`[Citations] Built ${citations.length} citations:`, 
    citations.map(c => `[${c.index}] ${c.trackTitle}`).join(', ')
  );
  
  // #region agent log
  const finalCitations = citations.map((c: any) => {
    const quotePreview = c.quote ? c.quote.substring(0, 50) : 'no quote';
    return { index: c.index, contentId: c.trackId, title: c.trackTitle, quotePreview: quotePreview };
  });
  const finalCitationsLogData = {
    location: 'trike-server/index.ts:1863',
    message: 'Final citations array',
    data: {
      count: citations.length,
      citations: finalCitations
    },
    timestamp: Date.now(),
    sessionId: 'debug-session',
    runId: 'run1',
    hypothesisId: 'A'
  };
  fetch('http://127.0.0.1:7242/ingest/8dfcf613-f58b-4a75-8c2c-4e44814a9ad0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(finalCitationsLogData)}).catch(()=>{});
  // #endregion
  
  return citations;
}

/**
 * Chat with brain (RAG query)
 */
async function handleBrainChat(req: Request): Promise<Response> {
  try {
    // Try token auth first
    let orgId = await getOrgIdFromToken(req);
    
    if (!OPENAI_API_KEY) {
      return jsonResponse({ error: "OpenAI API key not configured" }, 500);
    }

    const body = await req.json();
    const { conversationId, message, organizationId, trackId } = body;
    
    // Use body organizationId as fallback if token auth failed
    if (!orgId && organizationId) {
      console.log(`[Brain] Using organizationId from request body: ${organizationId}`);
      orgId = organizationId;
    }
    
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized - no valid token or organizationId provided" }, 401);
    }

    if (!message) {
      return jsonResponse({ error: "message is required" }, 400);
    }

    // Fetch conversation history if we have a conversationId
    let conversationHistory: Array<{role: string, content: string}> = [];
    let finalConversationId = conversationId;
    
    if (conversationId) {
      const { data: historyMessages } = await supabase
        .from("brain_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(6); // Last 6 messages (3 exchanges)
      
      if (historyMessages && historyMessages.length > 0) {
        conversationHistory = historyMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }));
      }
    }

    // Fetch current track context if trackId provided
    let currentTrack: { title: string; type: string; description?: string } | null = null;
    if (trackId) {
      const { data: trackData } = await supabase
        .from('tracks')
        .select('title, type, description')
        .eq('id', trackId)
        .single();
      
      if (trackData) {
        currentTrack = trackData;
        console.log(`[Brain] Current track context: "${trackData.title}" (${trackData.type})`);
      }
    }

    const systemPrompt = `You are Company Brain, an AI that answers questions using ONLY the provided source material.

RULES:
1. Answer ONLY using the sources provided below - never use outside knowledge
2. Add [1], [2], [3] after EVERY sentence that states a fact (matching the source number)
3. If the answer isn't in the sources, say \"I couldn't find this in your training materials\"

EXAMPLE FORMAT:
"Employees must check ID for anyone appearing under 40. [1] The ID should be checked for date of birth and photo. [1]"

${currentTrack ? `Current article: \"${currentTrack.title}\"` : ''}`;

    // Generate embedding for the user's question
    const queryEmbedding = await generateEmbedding(message);

    // DEBUG: Check what tracks are actually indexed for this org
    const { data: indexedTracks } = await supabase
      .from('brain_embeddings')
      .select('content_id, metadata')
      .eq('organization_id', orgId)
      .limit(100);
    
    if (indexedTracks && indexedTracks.length > 0) {
      const uniqueTracks = [...new Set(indexedTracks.map((e: any) => e.content_id))];
      console.log(`[Brain DEBUG] Org has ${indexedTracks.length} embeddings across ${uniqueTracks.length} unique tracks`);
      
      // Get track titles for the unique content_ids
      const { data: trackTitles } = await supabase
        .from('tracks')
        .select('id, title')
        .in('id', uniqueTracks);
      
      console.log(`[Brain DEBUG] Indexed track titles:`);
      trackTitles?.forEach((t: any) => {
        const chunkCount = indexedTracks.filter((e: any) => e.content_id === t.id).length;
        console.log(`  - "${t.title}" (${chunkCount} chunks)`);
      });
    } else {
      console.warn(`[Brain DEBUG] NO EMBEDDINGS FOUND for org ${orgId}!`);
    }

    // Search for relevant content using vector similarity
    // Use a lower threshold (0.4) to capture more potential matches
    const { data: embeddingsRaw, error: rpcError } = await supabase.rpc("match_brain_embeddings", {
      query_embedding: queryEmbedding,
      match_threshold: 0.4,
      match_count: 8,
      org_id: orgId,
    });

    if (rpcError) {
      console.error("[Brain] RPC error:", rpcError);
    }

    // Log raw search results BEFORE filtering
    console.log(`[Brain] RPC search returned ${embeddingsRaw?.length || 0} results (threshold 0.4)`);
    if (embeddingsRaw && embeddingsRaw.length > 0) {
      console.log(`[Brain] Top 3 raw results from semantic search:`);
      for (let i = 0; i < Math.min(3, embeddingsRaw.length); i++) {
        const e = embeddingsRaw[i];
        // Fetch track title for logging
        const { data: track } = await supabase
          .from('tracks')
          .select('title')
          .eq('id', e.content_id)
          .maybeSingle();
        console.log(`  [${i+1}] similarity=${e.similarity?.toFixed(3)}, track="${track?.title || 'unknown'}", preview="${e.chunk_text?.substring(0, 60)}..."`);
      }
    }

    // FILTER OUT TEST DATA from search results
    const embeddings = (embeddingsRaw || []).filter((e: any) => {
      const isTestData = e.content_id === '00000000-0000-0000-0000-000000000001' || 
                        e.content_id === '00000000-0000-0000-0000-000000000002';
      if (isTestData) {
        console.log(`[Brain] Filtering out test data: content_id=${e.content_id}`);
      }
      return !isTestData;
    });

    console.log(`[Brain] Found ${embeddingsRaw?.length || 0} embeddings, ${embeddings.length} after filtering test data`);

    // Boost results that contain query keywords
    if (embeddings && embeddings.length > 1) {
      const queryWords = message.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((word: string) => word.length > 3 && !['what', 'does', 'stand', 'mean', 'explain', 'tell', 'about', 'how'].includes(word));

      console.log(`[Brain] Query keywords for boosting:`, queryWords);

      if (queryWords.length > 0) {
        const scoredEmbeddings = embeddings.map((e: any) => {
          const chunkLower = (e.chunk_text || '').toLowerCase();
          let keywordScore = 0;
          queryWords.forEach((word: string) => { if (chunkLower.includes(word)) { keywordScore += 10; } });
          const metaTitle = (e.metadata?.trackTitle || '').toLowerCase();
          queryWords.forEach((word: string) => { if (metaTitle.includes(word)) { keywordScore += 20; } });
          return { ...e, keywordScore, combinedScore: (e.similarity || 0) + (keywordScore * 0.1) };
        });
        scoredEmbeddings.sort((a: any, b: any) => b.combinedScore - a.combinedScore);
        console.log(`[Brain] After keyword boosting:`);
        scoredEmbeddings.slice(0, 5).forEach((e: any, i: number) => {
          console.log(`  [${i+1}] keywordScore=${e.keywordScore}, similarity=${e.similarity?.toFixed(3)}, preview="${e.chunk_text?.substring(0, 40)}..."`);
        });
        embeddings.length = 0;
        embeddings.push(...scoredEmbeddings);
      }
    }

    // Store embeddings for citation building (must match context order)
    let embeddingsForCitations = embeddings;

    // Build numbered context with track titles
    const contextParts = await Promise.all(embeddings.map(async (e: any, i: number) => {
      let sourceLabel = `Source ${i + 1}`;
      if (e.content_id) {
        const { data: track } = await supabase
          .from('tracks')
          .select('title')
          .eq('id', e.content_id)
          .maybeSingle();
        
        if (track?.title) {
          const isCurrentTrack = e.content_id === trackId;
          sourceLabel = `Source ${i + 1} - "${track.title}"${isCurrentTrack ? ' (current article)' : ''}`;
        }
      }
      return `[${sourceLabel}]:\n${e.chunk_text}`;
    }));

    const context = contextParts.join('\n\n---\n\n');
    
    console.log(`[Brain] Context built with ${contextParts.length} sources. Source order in context:`);
    contextParts.forEach((part: string, i: number) => {
      const titleMatch = part.match(/"([^"]+)"/);
      console.log(`  Source ${i + 1}: ${titleMatch ? titleMatch[1] : 'no title'}`);
    });
    console.log(`[Brain] Embeddings array order (for citations):`);
    embeddingsForCitations.forEach((e: any, i: number) => {
      console.log(`  [${i + 1}]: content_id=${e.content_id}, preview="${e.chunk_text?.substring(0, 40) || 'no text'}..."`);
    });

    // If no context found, check if ANY embeddings exist for this org/track
    if (!context || context.trim() === '') {
      console.log(`[Brain] Context is empty, checking for fallback embeddings...`);
      // Direct query to check if embeddings exist - search ALL content in org
      // The trackId is only used for context prioritization, not search filtering
      const checkQuery = supabase
        .from("brain_embeddings")
        .select("id, content_type, chunk_text, content_id, metadata")
        .eq("organization_id", orgId);
      
      const { data: embeddingsCheckRaw } = await checkQuery.limit(8);
      
      // FILTER OUT TEST DATA from fallback results too
      const embeddingsCheck = (embeddingsCheckRaw || []).filter((e: any) => {
        const isTestData = e.content_id === '00000000-0000-0000-0000-000000000001' || 
                          e.content_id === '00000000-0000-0000-0000-000000000002';
        if (isTestData) {
          console.log(`[Brain] Filtering out test data from fallback: content_id=${e.content_id}`);
        }
        return !isTestData;
      });
      
      console.log(`[Brain] Fallback query found ${embeddingsCheckRaw?.length || 0} embeddings, ${embeddingsCheck.length} after filtering test data`);
      
      if (embeddingsCheck && embeddingsCheck.length > 0) {
        // CRITICAL: Update embeddingsForCitations to match the fallback embeddings
        // This ensures citations match the context that will be sent to GPT
        const fallbackEmbeddingsForCitations = embeddingsCheck.map((e: any) => ({
          ...e,
          chunk_text: e.chunk_text,
          content_id: e.content_id,
          metadata: e.metadata ? { ...e.metadata } : null
        }));
        
        // Try using the direct query results as fallback (RPC may have failed to match)
        
        // Build numbered context with track titles
        const fallbackContextParts = await Promise.all(fallbackEmbeddingsForCitations.map(async (e: any, i: number) => {
          let sourceLabel = `Source ${i + 1}`;
          if (e.content_id) {
            const { data: track } = await supabase
              .from('tracks')
              .select('title')
              .eq('id', e.content_id)
              .maybeSingle();
            
            if (track?.title) {
              const isCurrentTrack = e.content_id === trackId;
              sourceLabel = `Source ${i + 1} - "${track.title}"${isCurrentTrack ? ' (current article)' : ''}`;
            }
          }
          return `[${sourceLabel}]:\n${e.chunk_text}`;
        }));

        const numberedContext = fallbackContextParts.join('\n\n---\n\n');
        
        console.log(`[Brain] Fallback context built with ${fallbackContextParts.length} sources`);
        console.log(`[Brain] Fallback context sources in order (what GPT will see):`);
        fallbackContextParts.forEach((part: string, i: number) => {
          const sourceMatch = part.match(/Source (\d+)/);
          const titleMatch = part.match(/"([^"]+)"/);
          console.log(`  Source ${i + 1}: ${titleMatch ? titleMatch[1] : 'no title'} (${part.substring(0, 60)}...)`);
        });
        console.log(`[Brain] Fallback embeddings for citations (must match above order):`);
        fallbackEmbeddingsForCitations.forEach((e: any, i: number) => {
          console.log(`  Citation [${i + 1}]: content_id=${e.content_id}, preview="${e.chunk_text?.substring(0, 40) || 'no text'}..."`);
        });
        
        if (numberedContext && numberedContext.trim() !== '') {
          // Continue with the response generation using direct context
          const gptMessages = [
            { role: "system", content: systemPrompt },
            ...conversationHistory,
            {
              role: "user",
              content: `Question: ${message}

Sources:
${numberedContext}

Answer using ONLY these sources. Add [1] [2] [3] after each fact.`
            },
          ];
          console.log(`[Brain GPT] Sending ${gptMessages.length} messages to GPT (direct fallback)`);
          const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: gptMessages,
              temperature: 0.7,
              max_tokens: 1000,
            }),
          });

          if (!openaiResponse.ok) {
            const error = await openaiResponse.text();
            throw new Error(`OpenAI error: ${error}`);
          }

          const aiData = await openaiResponse.json();
          const assistantMessage = aiData.choices[0]?.message?.content;
          console.log(`[Brain GPT] Raw response (direct fallback): "${assistantMessage?.substring(0,200)}..."`);
          console.log(`[Brain GPT] Has citations: ${/\[\d+\]/.test(assistantMessage || '')}`);

          let finalMessage = assistantMessage || '';
          const hasCitation = /\[\d+\]/.test(finalMessage);
          if (!hasCitation && fallbackEmbeddingsForCitations && fallbackEmbeddingsForCitations.length > 0) {
            console.warn(`[Brain GPT] GPT forgot citations (direct fallback)! Adding source reference.`);
            const firstSource = fallbackEmbeddingsForCitations[0];
            let sourceTitle = firstSource?.metadata?.trackTitle || 'training materials';
            if (!firstSource?.metadata?.trackTitle && firstSource?.content_id) {
              const { data: trackInfo } = await supabase
                .from('tracks')
                .select('title')
                .eq('id', firstSource.content_id)
                .maybeSingle();
              if (trackInfo?.title) sourceTitle = trackInfo.title;
            }
            finalMessage = finalMessage.trim() + ` [1]`;
            console.log(`[Brain GPT] Added citation [1] pointing to: ${sourceTitle}`);
          }

          // Save assistant message
          const { data: savedMessage, error: saveError } = await supabase
            .from("brain_messages")
            .insert({
              conversation_id: finalConversationId,
              role: "assistant",
              content: finalMessage,
            })
            .select()
            .single();

          if (saveError) {
            console.error("Error saving assistant message (direct fallback):", saveError);
          }

          // Build citations from the SAME embeddings used for context
          console.log(`[Brain] Building citations from fallback embeddings (${fallbackEmbeddingsForCitations.length} items)`);
          const citations = await buildCitations(fallbackEmbeddingsForCitations || []);

          return jsonResponse({
            message: savedMessage || { id: null, conversation_id: finalConversationId, role: "assistant", content: finalMessage, created_at: new Date().toISOString() },
            citations: citations,
            sources: fallbackEmbeddingsForCitations || [],
            conversationId: finalConversationId,
          });
        }
      }
      
      console.warn("[Brain] No relevant content found in knowledge base for this question");
      // Return a helpful error message instead of calling OpenAI with empty context
      return jsonResponse({
        error: "No relevant content found in the knowledge base for this question. The content may not be indexed yet, or the question doesn't match any available information. Please try rephrasing your question or contact support if you believe this content should be available."
      }, 404);
    }

    // CRITICAL: If we reach here, context should NOT be empty
    // If it is, something went wrong - log and return error
    if (!context || context.trim() === '') {
      console.error(`[Brain] ERROR: Reached main path with empty context! This should not happen.`);
      console.error(`[Brain] contextParts.length: ${contextParts.length}, embeddings.length: ${embeddings?.length || 0}`);
      return jsonResponse({
        error: "Internal error: Context is empty. Please try again."
      }, 500);
    }

    // Generate response with context
    const gptMessages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      {
        role: "user",
        content: `Question: ${message}

Sources:
${context}

Answer using ONLY these sources. Add [1] [2] [3] after each fact.`
      },
    ];
    console.log(`[Brain GPT] Sending ${gptMessages.length} messages to GPT (main path)`);
    console.log(`[Brain GPT] System prompt length: ${systemPrompt.length} chars`);
    console.log(`[Brain GPT] Context sources: ${(embeddingsForCitations || []).length}`);
    console.log(`[Brain GPT] User question: "${message}"`);

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: gptMessages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      throw new Error(`OpenAI error: ${error}`);
    }

    const aiData = await openaiResponse.json();
    const assistantMessage = aiData.choices[0]?.message?.content;
    console.log(`[Brain GPT] Raw response (main path): "${assistantMessage?.substring(0,200)}..."`);
    console.log(`[Brain GPT] Has citations: ${/\[\d+\]/.test(assistantMessage || '')}`);

    let finalMessage = assistantMessage || '';
    const hasCitation = /\[\d+\]/.test(finalMessage);
    if (!hasCitation && embeddingsForCitations && embeddingsForCitations.length > 0) {
      console.warn(`[Brain GPT] GPT forgot citations (main path)! Adding source reference.`);
      const firstSource = embeddingsForCitations[0];
      let sourceTitle = firstSource?.metadata?.trackTitle || 'training materials';
      if (!firstSource?.metadata?.trackTitle && firstSource?.content_id) {
        const { data: trackInfo } = await supabase
          .from('tracks')
          .select('title')
          .eq('id', firstSource.content_id)
          .maybeSingle();
        if (trackInfo?.title) sourceTitle = trackInfo.title;
      }
      finalMessage = finalMessage.trim() + ` [1]`;
      console.log(`[Brain GPT] Added citation [1] pointing to: ${sourceTitle}`);
    }

    // Validate we got a response from OpenAI
    if (!assistantMessage || assistantMessage.trim() === '') {
      console.error("OpenAI returned empty response:", aiData);
      return jsonResponse({ 
        error: "OpenAI returned an empty response. Please try again." 
      }, 500);
    }

    // Save assistant message
    const { data: savedMessage, error: saveError } = await supabase
      .from("brain_messages")
        .insert({
          conversation_id: finalConversationId,
          role: "assistant",
          content: finalMessage,
        })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving assistant message:", saveError);
      // Build citations
      const citations = await buildCitations(embeddings || []);
      // Still return the response even if save fails
      return jsonResponse({
        message: { 
          id: null,
          conversation_id: finalConversationId,
          role: "assistant", 
          content: finalMessage,
          created_at: new Date().toISOString()
        },
        citations: citations,
        sources: embeddings || [],
        conversationId: finalConversationId,
      });
    }

    // Validate savedMessage has content
    if (!savedMessage || !savedMessage.content) {
      console.error("Saved message is missing content:", savedMessage);
      // Build citations
      const citations = await buildCitations(embeddings || []);
      return jsonResponse({
        message: { 
          id: null,
          conversation_id: finalConversationId,
          role: "assistant", 
          content: finalMessage,
          created_at: new Date().toISOString()
        },
        citations: citations,
        sources: embeddings || [],
        conversationId: finalConversationId,
      });
    }

    // Update conversation timestamp
    await supabase
      .from("brain_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", finalConversationId);

    // Build citations from the SAME embeddings array used for context
    // CRITICAL: Verify contextParts matches embeddingsForCitations length
    if (contextParts.length !== embeddingsForCitations.length) {
      console.error(`[Brain] MISMATCH: contextParts.length (${contextParts.length}) != embeddingsForCitations.length (${embeddingsForCitations.length})`);
      console.error(`[Brain] This will cause citation mismatch!`);
    }
    
    console.log(`[Brain] Building citations from ${embeddingsForCitations.length} embeddings (contextParts: ${contextParts.length})`);
    console.log(`[Brain] Context sources in order (what GPT sees):`);
    contextParts.forEach((part: string, i: number) => {
      const sourceMatch = part.match(/Source (\d+)/);
      const titleMatch = part.match(/"([^"]+)"/);
      const contentIdMatch = part.match(/content_id[":\s]+([a-f0-9-]+)/i);
      console.log(`  Source ${i + 1}: ${titleMatch ? titleMatch[1] : 'no title'} (content_id: ${contentIdMatch ? contentIdMatch[1] : 'unknown'})`);
    });
    console.log(`[Brain] Citations will be built in this order (must match above):`);
    embeddingsForCitations.forEach((e: any, i: number) => {
      console.log(`  Citation [${i + 1}]: content_id=${e.content_id}, preview="${e.chunk_text?.substring(0, 40) || 'no text'}..."`);
    });
    
    // #region agent log
    const citationsCount = embeddingsForCitations ? embeddingsForCitations.length : 0;
    const citationsContentIds = embeddingsForCitations ? embeddingsForCitations.map((e: any, i: number) => {
      const preview = e.chunk_text ? e.chunk_text.substring(0, 50) : 'no text';
      return { index: i + 1, contentId: e.content_id, chunkPreview: preview };
    }) : [];
    const citationsLogData = {
      location: 'trike-server/index.ts:2675',
      message: 'Building citations from embeddings',
      data: {
        count: citationsCount,
        contentIds: citationsContentIds,
        matchesContext: citationsContentIds.length === contextParts.length,
        contextPartsCount: contextParts.length
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'A'
    };
    fetch('http://127.0.0.1:7242/ingest/8dfcf613-f58b-4a75-8c2c-4e44814a9ad0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(citationsLogData)}).catch(()=>{});
    // #endregion
    const citations = await buildCitations(embeddingsForCitations || []);
    
    console.log(`[Brain] Citations built. Final order:`);
    citations.forEach((c: any) => {
      console.log(`  [${c.index}] ${c.trackTitle} (content_id=${c.trackId})`);
    });

    return jsonResponse({
      message: savedMessage,
      citations: citations,
      sources: embeddings || [],
      conversationId: finalConversationId, // Return the conversation ID in case it was created
    });
  } catch (error) {
    console.error("Brain chat error:", error);
    return jsonResponse({ error: error.message || "Failed to process chat" }, 500);
  }
}

/**
 * Search indexed content
 */
async function handleBrainSearch(req: Request): Promise<Response> {
  try {
    // Try token auth first
    let orgId = await getOrgIdFromToken(req);
    
    // Parse body to check for organizationId fallback
    const body = await req.json();
    const { query, limit = 10, contentType, organizationId } = body;
    
    // Use body organizationId as fallback if token auth failed
    if (!orgId && organizationId) {
      console.log(`[Brain] Using organizationId from request body: ${organizationId}`);
      orgId = organizationId;
    }
    
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized - no valid token or organizationId provided" }, 401);
    }

    if (!query) {
      return jsonResponse({ error: "query is required" }, 400);
    }

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Build query
    // TODO: Update match_brain_embeddings RPC to also return is_system_template=true rows
    // For now, this only searches the user's org content
    let dbQuery = supabase.rpc("match_brain_embeddings", {
      query_embedding: queryEmbedding,
      match_threshold: 0.6, // Lowered from 0.7 for better recall
      match_count: limit,
      org_id: orgId,
    });

    // Execute search
    const { data: results, error: searchError } = await dbQuery;

    if (searchError) {
      console.error("Error searching embeddings:", searchError);
      // Fallback: simple text search
      let fallbackQuery = supabase
        .from("brain_embeddings")
        .select("chunk_text, content_type, content_id, metadata")
        .eq("organization_id", orgId)
        .limit(limit);

      if (contentType) {
        fallbackQuery = fallbackQuery.eq("content_type", contentType);
      }

      const { data: fallbackResults } = await fallbackQuery;

      return jsonResponse({
        results: fallbackResults || [],
        count: (fallbackResults || []).length,
      });
    }

    // Filter by content type if specified
    let filteredResults = results || [];
    if (contentType) {
      filteredResults = filteredResults.filter((r: any) => r.content_type === contentType);
    }

    return jsonResponse({
      results: filteredResults,
      count: filteredResults.length,
    });
  } catch (error) {
    console.error("Brain search error:", error);
    return jsonResponse({ error: error.message || "Failed to search content" }, 500);
  }
}

/**
 * Get brain statistics
 */
async function handleBrainStats(req: Request): Promise<Response> {
  try {
    // Try token auth first
    let orgId = await getOrgIdFromToken(req);
    
    // For GET requests, check query params for organizationId fallback
    const url = new URL(req.url);
    const organizationId = url.searchParams.get("organizationId");
    
    // Use query param organizationId as fallback if token auth failed
    if (!orgId && organizationId) {
      console.log(`[Brain] Using organizationId from query params: ${organizationId}`);
      orgId = organizationId;
    }
    
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized - no valid token or organizationId provided" }, 401);
    }

    // Get total embeddings
    const { count: totalEmbeddings, error: embeddingsError } = await supabase
      .from("brain_embeddings")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId);

    // Get total conversations
    const { count: totalConversations, error: conversationsError } = await supabase
      .from("brain_conversations")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId);

    // Get conversation IDs first
    const { data: conversations } = await supabase
      .from("brain_conversations")
      .select("id")
      .eq("organization_id", orgId);

    const conversationIds = (conversations || []).map((c: any) => c.id);

    // Get total messages
    let totalMessages = 0;
    if (conversationIds.length > 0) {
      const { count, error: messagesError } = await supabase
        .from("brain_messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", conversationIds);
      totalMessages = count || 0;
    }

    // Get embeddings by type
    const { data: embeddingsByType, error: typeError } = await supabase
      .from("brain_embeddings")
      .select("content_type")
      .eq("organization_id", orgId);

    const typeCounts: Record<string, number> = {};
    (embeddingsByType || []).forEach((e: any) => {
      typeCounts[e.content_type] = (typeCounts[e.content_type] || 0) + 1;
    });

    return jsonResponse({
      totalEmbeddings: totalEmbeddings || 0,
      totalConversations: totalConversations || 0,
      totalMessages: totalMessages,
      embeddingsByType: typeCounts,
    });
  } catch (error) {
    console.error("Brain stats error:", error);
    return jsonResponse({ error: error.message || "Failed to get stats" }, 500);
  }
}

/**
 * Backfill brain index - index all published tracks that aren't already indexed
 */
async function handleBrainBackfill(req: Request): Promise<Response> {
  try {
    // Try token auth first
    let orgId = await getOrgIdFromToken(req);
    
    // Parse body to check for organizationId fallback
    const body = await req.json();
    const { organizationId } = body;
    
    // Use body organizationId as fallback if token auth failed
    if (!orgId && organizationId) {
      console.log(`[Brain Backfill] Using organizationId from request body: ${organizationId}`);
      orgId = organizationId;
    }
    
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized - no valid token or organizationId provided" }, 401);
    }

    console.log(`[Brain Backfill] Starting backfill for organization ${orgId}...`);

    // Step 1: Get all published tracks for this organization
    const { data: tracks, error: tracksError } = await supabase
      .from("tracks")
      .select("id, title, description, content, content_text, transcript, type, status, organization_id, is_system_content")
      .eq("organization_id", orgId)
      .eq("status", "published")
      .not("type", "eq", "checkpoint");

    if (tracksError) {
      console.error("[Brain Backfill] Error fetching tracks:", tracksError);
      return jsonResponse({ error: `Failed to fetch tracks: ${tracksError.message}` }, 500);
    }

    if (!tracks || tracks.length === 0) {
      return jsonResponse({
        indexed: 0,
        skipped: 0,
        errors: [],
        details: [],
        message: "No published tracks found",
      });
    }

    console.log(`[Brain Backfill] Found ${tracks.length} published tracks`);

    // Step 2: Get list of already-indexed content_ids
    const { data: existingEmbeddings, error: embeddingsError } = await supabase
      .from("brain_embeddings")
      .select("content_id")
      .eq("organization_id", orgId)
      .eq("content_type", "track");

    if (embeddingsError) {
      console.warn("[Brain Backfill] Could not fetch existing embeddings:", embeddingsError);
    }

    const indexedContentIds = new Set(
      (existingEmbeddings || []).map((e: any) => e.content_id)
    );

    console.log(`[Brain Backfill] Found ${indexedContentIds.size} already-indexed tracks`);

    // Step 3: Filter to only unindexed tracks
    const unindexedTracks = tracks.filter((track: any) => !indexedContentIds.has(track.id));

    if (unindexedTracks.length === 0) {
      return jsonResponse({
        indexed: 0,
        skipped: 0,
        errors: [],
        details: [],
        message: "All tracks are already indexed",
      });
    }

    console.log(`[Brain Backfill] ${unindexedTracks.length} tracks need indexing`);

    // Step 4: Index each unindexed track
    const result = {
      indexed: 0,
      skipped: 0,
      errors: [] as string[],
      details: [] as Array<{ trackId: string; title: string; status: "indexed" | "skipped" | "error" }>,
    };

    for (const track of unindexedTracks) {
      try {
        const trackType = track.type || "article";
        const trackTitle = track.title || "Untitled";

        // Skip checkpoints (double-check)
        if (trackType === "checkpoint") {
          result.skipped++;
          result.details.push({
            trackId: track.id,
            title: trackTitle,
            status: "skipped",
          });
          continue;
        }

        // Get transcript for videos
        let transcriptText: string | undefined;
        if (trackType === "video") {
          // Check track transcript field first
          if (track.transcript) {
            transcriptText = track.transcript;
          } else {
            // Check media_transcripts table
            const { data: transcriptData } = await supabase
              .from("media_transcripts")
              .select("transcript_text")
              .contains("used_in_tracks", [track.id])
              .maybeSingle();
            transcriptText = transcriptData?.transcript_text;
          }
        }

        // Build text for indexing
        const parts: string[] = [];
        if (track.title) parts.push(`Title: ${track.title}`);
        if (track.description) parts.push(`Description: ${track.description}`);

        if (trackType === "video" && transcriptText) {
          parts.push(`Content: ${transcriptText}`);
        } else if (trackType === "article") {
          const content = track.transcript || track.content || track.content_text;
          if (content) {
            // Strip HTML tags
            const cleanContent = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
            parts.push(`Content: ${cleanContent}`);
          }
        } else if (trackType === "story" && track.transcript) {
          try {
            const storyData = typeof track.transcript === "string" ? JSON.parse(track.transcript) : track.transcript;
            if (storyData.slides && Array.isArray(storyData.slides)) {
              const slideContent = storyData.slides
                .map((slide: any, index: number) => {
                  const slideTitle = slide.title || slide.name || "";
                  const slideText = slide.transcript?.text || slide.content || "";
                  return slideText ? `Slide ${index + 1}: ${slideTitle ? slideTitle + ": " : ""}${slideText}` : "";
                })
                .filter(Boolean)
                .join("\n\n");
              if (slideContent) parts.push(slideContent);
            }
          } catch (e) {
            // Not valid JSON, skip
          }
        }

        const text = parts.join("\n\n");

        if (!text || text.trim().length < 20) {
          result.skipped++;
          result.details.push({
            trackId: track.id,
            title: trackTitle,
            status: "skipped",
          });
          continue;
        }

        // Index the track using the embed endpoint
        const chunks = chunkText(text);
        const isSystemTemplate = track.is_system_content || false;

        let chunksIndexed = 0;
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = await generateEmbedding(chunk);

          const { error: insertError } = await supabase
            .from("brain_embeddings")
            .insert({
              organization_id: orgId,
              content_type: "track",
              content_id: track.id,
              chunk_index: i,
              chunk_text: chunk,
              embedding: embedding,
              metadata: {
                trackType: trackType,
                isSystemTemplate: isSystemTemplate,
                trackTitle: trackTitle, // Store track title for citation fallback
              },
              is_system_template: isSystemTemplate,
            });

          if (insertError) {
            console.error(`[Brain Backfill] Error inserting chunk ${i} for ${track.id}:`, insertError);
            continue;
          }

          chunksIndexed++;
        }

        if (chunksIndexed > 0) {
          result.indexed++;
          result.details.push({
            trackId: track.id,
            title: trackTitle,
            status: "indexed",
          });
          console.log(`[Brain Backfill] ✓ Indexed: ${trackTitle} (${track.id}) - ${chunksIndexed} chunks`);
        } else {
          result.errors.push(`${track.id}: Failed to index any chunks`);
          result.details.push({
            trackId: track.id,
            title: trackTitle,
            status: "error",
          });
        }
      } catch (error: any) {
        const errorMsg = error.message || String(error);
        result.errors.push(`${track.id}: ${errorMsg}`);
        result.details.push({
          trackId: track.id,
          title: track.title || "Untitled",
          status: "error",
        });
        console.error(`[Brain Backfill] ✗ Error indexing ${track.id}:`, error);
      }
    }

    console.log(`[Brain Backfill] Complete: ${result.indexed} indexed, ${result.skipped} skipped, ${result.errors.length} errors`);

    return jsonResponse(result);
  } catch (error) {
    console.error("[Brain Backfill] Fatal error:", error);
    return jsonResponse({
      error: error.message || "Failed to backfill brain index",
      indexed: 0,
      skipped: 0,
      errors: [error.message || String(error)],
      details: [],
    }, 500);
  }
}

// =============================================================================
// ONBOARDING HANDLERS
// =============================================================================

/**
 * Start a new onboarding session
 */
async function handleOnboardingStart(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const { referrer, utm_params } = body;

    // Generate session token
    const sessionToken = crypto.randomUUID();

    // Create session
    const { data: session, error } = await supabase
      .from("onboarding_sessions")
      .insert({
        session_token: sessionToken,
        status: "started",
        current_step: "welcome",
        referrer,
        utm_params: utm_params || {},
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
        user_agent: req.headers.get("user-agent"),
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[Onboarding] Started new session: ${sessionToken}`);

    return jsonResponse({
      success: true,
      session_token: sessionToken,
      session_id: session.id,
      current_step: "welcome",
    });
  } catch (error: any) {
    console.error("[Onboarding] Error starting session:", error);
    return jsonResponse({ error: error.message || "Failed to start onboarding" }, 500);
  }
}

/**
 * Scrape company info from website URL
 */
async function handleEnrichCompany(req: Request): Promise<Response> {
  try {
    const { website, session_token } = await req.json();

    if (!website) {
      return jsonResponse({ error: "website URL is required" }, 400);
    }

    console.log(`[Onboarding] Enriching company from: ${website}`);

    // Normalize URL
    let url = website.trim().toLowerCase();
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }

    // Extract domain for company name fallback
    const domain = new URL(url).hostname.replace("www.", "");
    const domainName = domain.split(".")[0];

    // Fetch the website
    let html = "";
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; TrikeBot/1.0; +https://trike.io)",
          "Accept": "text/html,application/xhtml+xml",
        },
      });
      html = await response.text();
    } catch (fetchError: any) {
      console.error(`[Onboarding] Failed to fetch ${url}:`, fetchError);
      // Return partial data even if fetch fails
      return jsonResponse({
        success: true,
        data: {
          website: url,
          company_name: capitalizeWords(domainName),
          scraped: false,
          error: "Could not fetch website",
        },
      });
    }

    // Extract data from HTML
    const scrapedData = await extractCompanyDataFromHTML(html, url, domainName);

    // Try to find store locator page and scrape locations
    const storeLocatorUrls = [
      "/locations",
      "/location",  // singular (WordPress common)
      "/stores",
      "/store",
      "/find-us",
      "/store-locator",
      "/our-locations",
      "/find-a-store",
      "/all-locations",
    ];

    let stores: any[] = [];
    for (const locatorPath of storeLocatorUrls) {
      try {
        const locatorUrl = new URL(locatorPath, url).toString();
        const locatorResponse = await fetch(locatorUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml,application/json",
          },
        });

        if (locatorResponse.ok) {
          const locatorHtml = await locatorResponse.text();
          stores = extractStoresFromHTML(locatorHtml);

          // If no stores found directly, check for WPSL (WordPress Store Locator) AJAX endpoint
          if (stores.length === 0 && locatorHtml.includes('wpsl')) {
            console.log(`[Onboarding] Detected WPSL plugin, trying AJAX endpoint...`);
            const wpslStores = await tryWPSLAjax(url);
            if (wpslStores.length > 0) {
              stores = wpslStores;
            }
          }

          if (stores.length > 0) {
            console.log(`[Onboarding] Found ${stores.length} stores at ${locatorPath}`);
            break;
          }
        }
      } catch (e) {
        // Continue to next URL
      }
    }

    // Use AI to enhance the scraped data
    let enrichedData = await enrichWithAI(scrapedData, html, stores);

    // If we still don't have a good logo or company name, try Claude Vision
    const needsVisionFallback = !enrichedData.logo_url ||
      !enrichedData.company_name ||
      enrichedData.company_name.length > 40 ||
      enrichedData.company_name.toLowerCase().includes('home') ||
      enrichedData.company_name.includes('|');

    if (needsVisionFallback) {
      console.log(`[Onboarding] HTML scrape incomplete, trying Claude Vision fallback...`);
      const visionData = await enrichWithClaudeVision(url, enrichedData);
      if (visionData) {
        enrichedData = { ...enrichedData, ...visionData };
      }
    }

    // Update session if token provided
    if (session_token) {
      await supabase
        .from("onboarding_sessions")
        .update({
          collected_data: enrichedData,
          last_activity_at: new Date().toISOString(),
        })
        .eq("session_token", session_token);
    }

    console.log(`[Onboarding] Enriched company: ${enrichedData.company_name}`);

    return jsonResponse({
      success: true,
      data: enrichedData,
    });
  } catch (error: any) {
    console.error("[Onboarding] Error enriching company:", error);
    return jsonResponse({ error: error.message || "Failed to enrich company data" }, 500);
  }
}

/**
 * Extract company data from HTML
 */
function extractCompanyDataFromHTML(html: string, url: string, domainFallback: string): any {
  const data: any = {
    website: url,
    scraped: true,
  };

  // Try to extract company name from various sources (in order of preference)

  // 1. og:site_name meta tag (most reliable)
  const ogSiteNameMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i);
  if (ogSiteNameMatch && ogSiteNameMatch[1].trim().length > 1) {
    data.company_name = ogSiteNameMatch[1].trim();
  }

  // 2. Logo alt text (often contains clean company name)
  if (!data.company_name) {
    const logoAltMatch = html.match(/<img[^>]*(?:class|id)=["'][^"']*logo[^"']*["'][^>]*alt=["']([^"']+)["']/i)
      || html.match(/<img[^>]*alt=["']([^"']+)["'][^>]*(?:class|id)=["'][^"']*logo[^"']*["']/i)
      || html.match(/<a[^>]*class=["'][^"']*logo[^"']*["'][^>]*>[\s\S]*?<img[^>]*alt=["']([^"']+)["']/i);
    if (logoAltMatch && logoAltMatch[1].trim().length > 1 && logoAltMatch[1].trim().length < 50) {
      data.company_name = logoAltMatch[1].trim();
    }
  }

  // 3. application/ld+json Organization name
  if (!data.company_name) {
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const jsonData = JSON.parse(jsonLdMatch[1]);
        if (jsonData.name) {
          data.company_name = jsonData.name;
        } else if (jsonData["@graph"]) {
          const org = jsonData["@graph"].find((item: any) => item["@type"] === "Organization" || item["@type"] === "LocalBusiness");
          if (org?.name) data.company_name = org.name;
        }
      } catch (e) { /* ignore parse errors */ }
    }
  }

  // 4. Title tag with smart parsing
  if (!data.company_name) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      let title = titleMatch[1].trim();
      // Split by common separators and take the most likely company name part
      const parts = title.split(/\s*[-|–—•·]\s*/);

      // Filter out generic words
      const genericTerms = /^(home|homepage|welcome|official site|official website|main|index)$/i;
      const filteredParts = parts.filter(p => !genericTerms.test(p.trim()) && p.trim().length > 1);

      if (filteredParts.length > 0) {
        // Prefer shorter parts (usually the company name) unless very short
        const bestPart = filteredParts.reduce((best, current) => {
          const currentTrimmed = current.trim();
          const bestTrimmed = best.trim();
          // Skip if too short or if current is just the best repeated
          if (currentTrimmed.length < 2) return best;
          if (currentTrimmed === bestTrimmed) return best;
          // Prefer parts between 3-30 chars, shorter is often the company name
          if (currentTrimmed.length >= 3 && currentTrimmed.length <= 30) {
            if (bestTrimmed.length > 30 || bestTrimmed.length < 3) return current;
            // If both are good length, prefer the first one (usually company name comes first)
            return parts.indexOf(best) < parts.indexOf(current) ? best : current;
          }
          return best;
        }, filteredParts[0]);

        data.company_name = bestPart.trim();
      }
    }
  }

  // 5. Use domain name as last resort
  if (!data.company_name) {
    data.company_name = capitalizeWords(domainFallback);
  }

  // Extract logo - expanded patterns
  const logoPatterns = [
    // Header logo images (most common)
    /<header[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*>/i,
    /<(?:div|a)[^>]*class=["'][^"']*(?:logo|brand|site-logo|navbar-brand)[^"']*["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i,
    /<img[^>]*class=["'][^"']*(?:logo|brand|site-logo)[^"']*["'][^>]*src=["']([^"']+)["']/i,
    /<img[^>]*src=["']([^"']+)["'][^>]*class=["'][^"']*(?:logo|brand|site-logo)[^"']*["']/i,
    /<img[^>]*id=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)["']/i,
    /<img[^>]*src=["']([^"']+)["'][^>]*id=["'][^"']*logo[^"']*["']/i,
    // Logo in alt text
    /<img[^>]*alt=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)["']/i,
    /<img[^>]*src=["']([^"']+)["'][^>]*alt=["'][^"']*logo[^"']*["']/i,
    // SVG logos
    /<a[^>]*class=["'][^"']*logo[^"']*["'][^>]*href=["'][^"']*["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i,
    // Fallback to og:image
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    // Apple touch icon (usually a good square logo)
    /<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i,
    // Favicon as last resort
    /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i,
  ];

  for (const pattern of logoPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      let logoUrl = match[1];
      // Skip data URIs, tiny images, and tracking pixels
      if (logoUrl.startsWith("data:") || logoUrl.includes("1x1") || logoUrl.includes("pixel")) continue;
      // Make relative URLs absolute
      if (logoUrl.startsWith("//")) {
        logoUrl = "https:" + logoUrl;
      } else if (logoUrl.startsWith("/")) {
        logoUrl = new URL(logoUrl, url).toString();
      } else if (!logoUrl.startsWith("http")) {
        logoUrl = new URL(logoUrl, url).toString();
      }
      data.logo_url = logoUrl;
      break;
    }
  }

  // Extract brand colors from CSS variables and inline styles
  const colorPatterns = [
    /--(?:primary|brand|main|theme)[^:]*color[^:]*:\s*(#[a-fA-F0-9]{3,6})/gi,
    /--(?:primary|brand|main|theme)[^:]*:\s*(#[a-fA-F0-9]{3,6})/gi,
    /background(?:-color)?:\s*(#[a-fA-F0-9]{3,6})/gi,
  ];

  const colors: string[] = [];
  for (const pattern of colorPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const color = match[1].toLowerCase();
      // Skip common non-brand colors (white, black, gray)
      if (!/^#(?:fff|ffffff|000|000000|[89a-f]{3}|[89a-f]{6})$/i.test(color)) {
        if (!colors.includes(color)) {
          colors.push(color);
          if (colors.length >= 2) break;
        }
      }
    }
    if (colors.length >= 2) break;
  }

  if (colors.length > 0) {
    data.brand_colors = {
      primary: colors[0],
      secondary: colors[1] || null,
    };
  }

  // Extract address from structured data or footer
  const addressMatch = html.match(/"address":\s*{[^}]*"streetAddress":\s*"([^"]+)"[^}]*"addressLocality":\s*"([^"]+)"[^}]*"addressRegion":\s*"([^"]+)"/i);
  if (addressMatch) {
    data.headquarters = {
      street: addressMatch[1],
      city: addressMatch[2],
      state: addressMatch[3],
    };
  }

  return data;
}

/**
 * Try to fetch stores from WordPress Store Locator (WPSL) AJAX endpoint
 */
async function tryWPSLAjax(baseUrl: string): Promise<any[]> {
  const stores: any[] = [];

  try {
    // WPSL uses admin-ajax.php with action=wpsl_store_search
    // With autoload=1 it returns all stores without search
    const ajaxUrl = new URL("/wp-admin/admin-ajax.php", baseUrl);
    ajaxUrl.searchParams.set("action", "wpsl_store_search");
    ajaxUrl.searchParams.set("autoload", "1");

    const response = await fetch(ajaxUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json, text/plain, */*",
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (response.ok) {
      const text = await response.text();
      // WPSL returns JSON array or "0" if no results
      if (text && text !== "0" && text.startsWith("[")) {
        const wpslData = JSON.parse(text);
        for (const store of wpslData) {
          stores.push({
            name: store.store || store.name,
            address: store.address || store.street,
            city: store.city,
            state: store.state,
            zip: store.zip,
            phone: store.phone,
            lat: store.lat,
            lng: store.lng,
          });
        }
        console.log(`[Onboarding] WPSL AJAX returned ${stores.length} stores`);
      }
    }
  } catch (e) {
    console.log(`[Onboarding] WPSL AJAX failed:`, e);
  }

  return stores;
}

/**
 * Extract store locations from HTML (store locator page)
 */
function extractStoresFromHTML(html: string): any[] {
  const stores: any[] = [];

  // Try to find JSON-LD structured data
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      const jsonData = JSON.parse(match[1]);

      // Handle array of stores
      if (Array.isArray(jsonData)) {
        for (const item of jsonData) {
          if (item["@type"] === "Store" || item["@type"] === "LocalBusiness" || item["@type"] === "GasStation") {
            stores.push(parseStructuredStore(item));
          }
        }
      }

      // Handle single store or organization with locations
      if (jsonData["@type"] === "Store" || jsonData["@type"] === "LocalBusiness") {
        stores.push(parseStructuredStore(jsonData));
      }

      // Handle organization with multiple locations
      if (jsonData.location && Array.isArray(jsonData.location)) {
        for (const loc of jsonData.location) {
          stores.push(parseStructuredStore(loc));
        }
      }
    } catch (e) {
      // Invalid JSON, continue
    }
  }

  // Try to find embedded JSON data (many store locators use this)
  const jsonPatterns = [
    /(?:stores|locations|markers|storeData|locationData)\s*[:=]\s*(\[[\s\S]*?\]);/i,
    /JSON\.parse\s*\(\s*'(\[[\s\S]*?\])'\s*\)/i,
    /data-locations\s*=\s*'(\[[\s\S]*?\])'/i,
    /window\.__LOCATIONS__\s*=\s*(\[[\s\S]*?\]);/i,
  ];

  for (const pattern of jsonPatterns) {
    const jsonDataMatch = html.match(pattern);
    if (jsonDataMatch && stores.length === 0) {
      try {
        const jsonStores = JSON.parse(jsonDataMatch[1]);
        for (const store of jsonStores) {
          if (store.name || store.title || store.address || store.streetAddress) {
            stores.push({
              name: store.name || store.title || store.storeName || store.store_name,
              address: store.address || store.streetAddress || store.street_address || store.street,
              city: store.city || store.locality || store.addressLocality,
              state: store.state || store.region || store.administrativeArea || store.addressRegion,
              zip: store.zip || store.postalCode || store.postal_code || store.zipcode,
              phone: store.phone || store.telephone || store.phoneNumber || store.phone_number,
              lat: store.lat || store.latitude || store.geo?.latitude,
              lng: store.lng || store.longitude || store.lon || store.geo?.longitude,
            });
          }
        }
      } catch (e) {
        // Invalid JSON
      }
    }
    if (stores.length > 0) break;
  }

  // If no JSON data found, try HTML parsing for common store card patterns
  if (stores.length === 0) {
    // Pattern 1: Look for repeated store/location cards
    const cardPatterns = [
      // Store cards with address blocks
      /<(?:div|article|li)[^>]*class=["'][^"']*(?:store|location|branch|site)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|article|li)>/gi,
      // Search results style
      /<(?:div|article)[^>]*class=["'][^"']*(?:result|listing|card)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|article)>/gi,
    ];

    for (const pattern of cardPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        const cardHtml = match[1];
        const store = parseStoreFromHtmlCard(cardHtml);
        if (store && (store.address || store.city)) {
          stores.push(store);
        }
      }
      if (stores.length > 0) break;
    }
  }

  // Pattern 2: Look for address patterns with common separators
  if (stores.length === 0) {
    // Find sections that look like store listings (address + city, state zip patterns)
    const addressPattern = /(?:Store\s*#?\s*(\d+)|(\d+[^<\n]{5,50}))\s*(?:<[^>]+>|\n|\s)*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/g;
    const matches = html.matchAll(addressPattern);
    for (const match of matches) {
      stores.push({
        name: match[1] ? `Store #${match[1]}` : null,
        address: match[2]?.trim(),
        city: match[3],
        state: match[4],
        zip: match[5],
      });
    }
  }

  // Pattern 3: Count total locations if we can't parse individual stores
  // Look for text like "39 Locations" or "Over 100 stores"
  if (stores.length === 0) {
    const countMatch = html.match(/(\d+)\s*(?:locations|stores|branches|sites)/i);
    if (countMatch) {
      // Return a placeholder to indicate we found a count but couldn't parse details
      return [{ _count: parseInt(countMatch[1]), _note: "Count found but details not parsed" }];
    }
  }

  return stores.slice(0, 100); // Cap at 100 for performance
}

/**
 * Parse a store from an HTML card element
 */
function parseStoreFromHtmlCard(html: string): any | null {
  const store: any = {};

  // Extract store name/number
  const nameMatch = html.match(/(?:Store|Location)\s*#?\s*(\d+)/i)
    || html.match(/<(?:h[1-6]|strong|b)[^>]*>([^<]+)<\/(?:h[1-6]|strong|b)>/i);
  if (nameMatch) {
    store.name = nameMatch[1]?.trim();
  }

  // Extract street address
  const addressMatch = html.match(/(\d+[^<\n,]{5,60}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Hwy|Highway|Way|Lane|Ln|Pkwy|Parkway)[^<\n,]*)/i);
  if (addressMatch) {
    store.address = addressMatch[1].trim();
  }

  // Extract city, state, zip - common patterns
  const cityStateZipMatch = html.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/);
  if (cityStateZipMatch) {
    store.city = cityStateZipMatch[1];
    store.state = cityStateZipMatch[2];
    store.zip = cityStateZipMatch[3];
  }

  // Extract phone number
  const phoneMatch = html.match(/(?:Phone|Tel|Call)[^:]*:\s*([\d\-\.\(\)\s]{10,20})/i)
    || html.match(/(\(\d{3}\)\s*\d{3}[-.\s]?\d{4})/i)
    || html.match(/(\d{3}[-.\s]\d{3}[-.\s]\d{4})/);
  if (phoneMatch) {
    store.phone = phoneMatch[1].trim();
  }

  return Object.keys(store).length > 0 ? store : null;
}

/**
 * Parse a structured data store object
 */
function parseStructuredStore(item: any): any {
  const address = item.address || {};
  return {
    name: item.name,
    address: address.streetAddress || item.streetAddress,
    city: address.addressLocality || item.addressLocality,
    state: address.addressRegion || item.addressRegion,
    zip: address.postalCode || item.postalCode,
    phone: item.telephone,
    lat: item.geo?.latitude,
    lng: item.geo?.longitude,
  };
}

/**
 * Use AI to enhance and classify scraped data
 */
async function enrichWithAI(scrapedData: any, html: string, stores: any[]): Promise<any> {
  if (!OPENAI_API_KEY) {
    console.warn("[Onboarding] No OpenAI key, skipping AI enrichment");
    return { ...scrapedData, stores, services: [], industry: null };
  }

  // Truncate HTML to avoid token limits
  const truncatedHtml = html.substring(0, 15000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You analyze company websites to classify businesses. Return JSON only.

Industries: convenience_retail, qsr (quick service restaurant), grocery, fuel_retail, hospitality
Services: fuel, alcohol, tobacco, vape, lottery, food_service, car_wash, atm, pharmacy, money_orders

Analyze the website content and determine:
1. The company's industry
2. What services they likely offer based on the website content
3. A brief description of the company
4. Operating states if mentioned`
          },
          {
            role: "user",
            content: `Company: ${scrapedData.company_name}
Website: ${scrapedData.website}

Website content (truncated):
${truncatedHtml}

Return JSON with: { industry, services: [], description, operating_states: [] }`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResult = await response.json();
    const aiData = JSON.parse(aiResult.choices[0].message.content);

    return {
      ...scrapedData,
      industry: aiData.industry || null,
      services: aiData.services || [],
      description: aiData.description || null,
      operating_states: aiData.operating_states || [],
      stores: stores,
      store_count: stores.length,
    };
  } catch (error: any) {
    console.error("[Onboarding] AI enrichment failed:", error);
    return { ...scrapedData, stores, services: [], industry: null };
  }
}

/**
 * Use Claude Vision to extract company info from a screenshot of the website
 * This is used as a fallback when HTML parsing doesn't work well
 */
async function enrichWithClaudeVision(websiteUrl: string, existingData: any): Promise<any | null> {
  if (!ANTHROPIC_API_KEY) {
    console.warn("[Onboarding] No Anthropic API key, skipping Claude Vision fallback");
    return null;
  }

  try {
    // Use a screenshot service or fetch the page and use vision
    // For now, we'll use the URL directly with Claude's web capabilities
    // In production, you might use a service like screenshotapi.net or similar

    console.log(`[Onboarding] Calling Claude Vision for: ${websiteUrl}`);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `I need to extract company information from a website. The URL is: ${websiteUrl}

Based on the domain and what you know, please provide:
1. The clean company name (just the brand name, no taglines or "Home |" prefixes)
2. What industry they're likely in (one of: convenience_retail, qsr, grocery, fuel_retail, hospitality)
3. What services they probably offer (from: fuel, alcohol, tobacco, vape, lottery, food_service, car_wash, atm, pharmacy, money_orders)

I already scraped this data but it might be wrong:
- Company name: ${existingData.company_name || "unknown"}
- Industry: ${existingData.industry || "unknown"}
- Services: ${JSON.stringify(existingData.services || [])}

Please correct any issues and return JSON only:
{
  "company_name": "Clean Company Name",
  "industry": "industry_slug",
  "services": ["service1", "service2"],
  "logo_url": "if you can determine the likely logo URL pattern, otherwise null"
}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Onboarding] Claude Vision API error: ${response.status}`, errorText);
      return null;
    }

    const result = await response.json();
    const content = result.content[0]?.text || "";

    // Parse JSON from response (Claude might include markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const visionData = JSON.parse(jsonMatch[0]);
      console.log(`[Onboarding] Claude Vision extracted:`, visionData);

      // Only return fields that are improvements
      const improvements: any = {};

      if (visionData.company_name &&
          visionData.company_name.length < 40 &&
          !visionData.company_name.includes('|') &&
          !visionData.company_name.toLowerCase().includes('home')) {
        improvements.company_name = visionData.company_name;
      }

      if (visionData.industry) {
        improvements.industry = visionData.industry;
      }

      if (visionData.services && visionData.services.length > 0) {
        improvements.services = visionData.services;
      }

      if (visionData.logo_url && visionData.logo_url.startsWith('http')) {
        improvements.logo_url = visionData.logo_url;
      }

      return Object.keys(improvements).length > 0 ? improvements : null;
    }

    return null;
  } catch (error: any) {
    console.error("[Onboarding] Claude Vision fallback failed:", error);
    return null;
  }
}

/**
 * Chat with onboarding agent
 */
async function handleOnboardingChat(req: Request): Promise<Response> {
  try {
    const { session_token, message } = await req.json();

    if (!session_token || !message) {
      return jsonResponse({ error: "session_token and message are required" }, 400);
    }

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from("onboarding_sessions")
      .select("*")
      .eq("session_token", session_token)
      .single();

    if (sessionError || !session) {
      return jsonResponse({ error: "Invalid session token" }, 404);
    }

    const conversationHistory = session.conversation_history || [];
    const collectedData = session.collected_data || {};

    // Build system prompt
    const systemPrompt = `You are Trike's friendly onboarding assistant. You help companies set up their training platform.

Current collected data: ${JSON.stringify(collectedData)}
Current step: ${session.current_step}

Your goals:
1. Collect company website URL if not provided
2. Confirm scraped company info is correct
3. Identify their industry and services
4. Learn about their locations/store count
5. Get contact info for their account

Be conversational but efficient. Ask one thing at a time.
When you have enough info, tell them you're ready to create their demo account.

Available industries: convenience_retail, qsr, grocery, fuel_retail, hospitality
Available services: fuel, alcohol, tobacco, vape, lottery, food_service, car_wash, atm, pharmacy, money_orders

Respond with JSON: { "message": "your response", "action": null | "scrape_website" | "update_data" | "create_demo", "data": {} }`;

    // Add user message to history
    conversationHistory.push({ role: "user", content: message });

    // Call OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory.slice(-10), // Last 10 messages for context
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResult = await response.json();
    const aiResponse = JSON.parse(aiResult.choices[0].message.content);

    // Add assistant response to history
    conversationHistory.push({ role: "assistant", content: aiResponse.message });

    // Update session
    let updatedData = collectedData;
    if (aiResponse.data && Object.keys(aiResponse.data).length > 0) {
      updatedData = { ...collectedData, ...aiResponse.data };
    }

    await supabase
      .from("onboarding_sessions")
      .update({
        conversation_history: conversationHistory,
        collected_data: updatedData,
        last_activity_at: new Date().toISOString(),
      })
      .eq("session_token", session_token);

    return jsonResponse({
      success: true,
      message: aiResponse.message,
      action: aiResponse.action,
      data: aiResponse.data,
      collected_data: updatedData,
    });
  } catch (error: any) {
    console.error("[Onboarding] Chat error:", error);
    return jsonResponse({ error: error.message || "Chat failed" }, 500);
  }
}

/**
 * Update onboarding session data directly
 */
async function handleOnboardingUpdate(req: Request): Promise<Response> {
  try {
    const { session_token, data, current_step } = await req.json();

    if (!session_token) {
      return jsonResponse({ error: "session_token is required" }, 400);
    }

    // Get current session
    const { data: session, error: sessionError } = await supabase
      .from("onboarding_sessions")
      .select("collected_data")
      .eq("session_token", session_token)
      .single();

    if (sessionError || !session) {
      return jsonResponse({ error: "Invalid session token" }, 404);
    }

    // Merge new data
    const updatedData = { ...session.collected_data, ...data };

    const updatePayload: any = {
      collected_data: updatedData,
      last_activity_at: new Date().toISOString(),
    };

    if (current_step) {
      updatePayload.current_step = current_step;
      updatePayload.steps_completed = [...(session.steps_completed || []), current_step];
    }

    const { error: updateError } = await supabase
      .from("onboarding_sessions")
      .update(updatePayload)
      .eq("session_token", session_token);

    if (updateError) throw updateError;

    return jsonResponse({
      success: true,
      collected_data: updatedData,
    });
  } catch (error: any) {
    console.error("[Onboarding] Update error:", error);
    return jsonResponse({ error: error.message || "Update failed" }, 500);
  }
}

/**
 * Complete onboarding and create demo organization
 */
async function handleOnboardingComplete(req: Request): Promise<Response> {
  try {
    const { session_token, demo_days = 14 } = await req.json();

    if (!session_token) {
      return jsonResponse({ error: "session_token is required" }, 400);
    }

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from("onboarding_sessions")
      .select("*")
      .eq("session_token", session_token)
      .single();

    if (sessionError || !session) {
      return jsonResponse({ error: "Invalid session token" }, 404);
    }

    const data = session.collected_data || {};

    if (!data.company_name) {
      return jsonResponse({ error: "Company name is required" }, 400);
    }

    if (!data.contact_email) {
      return jsonResponse({ error: "Contact email is required" }, 400);
    }

    // Generate subdomain
    const subdomain = data.company_name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .substring(0, 30);

    // Check if subdomain exists
    const { data: existing } = await supabase
      .from("organizations")
      .select("id")
      .eq("subdomain", subdomain)
      .single();

    const finalSubdomain = existing ? `${subdomain}-${Date.now().toString(36)}` : subdomain;

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: data.company_name,
        subdomain: finalSubdomain,
        website: data.website,
        status: "demo",
        demo_expires_at: new Date(Date.now() + demo_days * 24 * 60 * 60 * 1000).toISOString(),
        industry: data.industry,
        services_offered: data.services || [],
        operating_states: data.operating_states || [],
        brand_primary_color: data.brand_colors?.primary,
        brand_secondary_color: data.brand_colors?.secondary,
        onboarding_source: "self_service",
        scraped_data: data,
      })
      .select()
      .single();

    if (orgError) throw orgError;

    console.log(`[Onboarding] Created org: ${org.name} (${org.id})`);

    // Create Admin role for this organization
    const { data: adminRole, error: roleError } = await supabase
      .from("roles")
      .insert({
        organization_id: org.id,
        name: "Admin",
        description: "Full administrative access",
        level: 3, // Admin level
        permissions: JSON.stringify([
          "manage_users",
          "manage_content",
          "manage_assignments",
          "manage_settings",
          "view_reports",
          "manage_compliance",
        ]),
      })
      .select()
      .single();

    if (roleError) {
      console.error("[Onboarding] Failed to create admin role:", roleError);
    }

    // Create Supabase Auth user
    // Generate a temporary password - user will reset via email
    const tempPassword = crypto.randomUUID().substring(0, 16) + "!Aa1";

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: data.contact_email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email for demo
      user_metadata: {
        organization_id: org.id,
        full_name: data.contact_name || "",
        role: data.contact_role || "admin",
      },
    });

    if (authError) {
      console.error("[Onboarding] Failed to create auth user:", authError);
      // Don't fail the whole process - org is created, user can be added later
    }

    // Create user record in users table
    let userRecord = null;
    if (authUser?.user) {
      // Parse contact name into first/last
      const nameParts = (data.contact_name || "Admin User").trim().split(/\s+/);
      const firstName = nameParts[0] || "Admin";
      const lastName = nameParts.slice(1).join(" ") || "User";

      const { data: newUser, error: userError } = await supabase
        .from("users")
        .insert({
          organization_id: org.id,
          role_id: adminRole?.id || null,
          auth_user_id: authUser.user.id,
          first_name: firstName,
          last_name: lastName,
          email: data.contact_email,
          status: "active",
          metadata: {
            contact_role: data.contact_role,
            onboarded_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (userError) {
        console.error("[Onboarding] Failed to create user record:", userError);
      } else {
        userRecord = newUser;
        console.log(`[Onboarding] Created user: ${newUser.email} (${newUser.id})`);

        // Send welcome email to admin
        const emailResult = await sendWelcomeEmail({
          template_slug: "welcome_admin",
          organization_id: org.id,
          recipient_email: data.contact_email,
          recipient_user_id: newUser.id,
          variables: {
            admin_name: data.contact_name || firstName,
            company_name: org.name,
            login_email: data.contact_email,
            temp_password: tempPassword,
            login_url: "https://app.trike.app",
          },
        });

        if (emailResult.success) {
          console.log(`[Onboarding] Welcome email sent to ${data.contact_email}`);
        } else {
          console.error(`[Onboarding] Failed to send welcome email:`, emailResult.error);
        }
      }
    }

    // Import stores if we have them
    let storesImported = 0;
    if (data.stores && data.stores.length > 0) {
      const storesToInsert = data.stores.slice(0, 50).map((store: any, index: number) => ({
        organization_id: org.id,
        name: store.name || `Store ${index + 1}`,
        code: store.code || `S${(index + 1).toString().padStart(3, "0")}`,
        address: store.address,
        city: store.city,
        state: store.state,
        zip: store.zip,
        phone: store.phone,
        latitude: store.lat,
        longitude: store.lng,
        is_active: true,
      }));

      const { error: storesError } = await supabase
        .from("stores")
        .insert(storesToInsert);

      if (storesError) {
        console.error("[Onboarding] Failed to import stores:", storesError);
      } else {
        storesImported = storesToInsert.length;
        console.log(`[Onboarding] Imported ${storesImported} stores`);
      }
    }

    // Generate a magic link for the user to sign in
    let magicLink = null;
    if (authUser?.user) {
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: data.contact_email,
        options: {
          redirectTo: `${SUPABASE_URL.replace('.supabase.co', '')}/dashboard`,
        },
      });

      if (linkError) {
        console.error("[Onboarding] Failed to generate magic link:", linkError);
      } else {
        magicLink = linkData?.properties?.action_link;
      }
    }

    // Update session
    await supabase
      .from("onboarding_sessions")
      .update({
        organization_id: org.id,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("session_token", session_token);

    console.log(`[Onboarding] Complete! Org: ${org.name}, User: ${data.contact_email}`);

    return jsonResponse({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        subdomain: org.subdomain,
        demo_expires_at: org.demo_expires_at,
      },
      user: userRecord ? {
        id: userRecord.id,
        email: userRecord.email,
        name: `${userRecord.first_name} ${userRecord.last_name}`,
      } : null,
      stores_imported: storesImported,
      magic_link: magicLink,
      // For development/testing, include temp password
      // Remove this in production!
      _dev_temp_password: tempPassword,
    });
  } catch (error: any) {
    console.error("[Onboarding] Complete error:", error);
    return jsonResponse({ error: error.message || "Failed to create organization" }, 500);
  }
}

/**
 * Get industries and services for form dropdowns
 */
async function handleOnboardingOptions(req: Request): Promise<Response> {
  try {
    // Get industries
    const { data: industries, error: industriesError } = await supabase
      .from("industries")
      .select("slug, name, description, default_services, icon, sort_order")
      .eq("is_active", true)
      .order("sort_order");

    if (industriesError) throw industriesError;

    // Get services
    const { data: services, error: servicesError } = await supabase
      .from("service_definitions")
      .select("slug, name, description, compliance_domains, requires_license, icon, sort_order")
      .eq("is_active", true)
      .order("sort_order");

    if (servicesError) throw servicesError;

    // Get US states
    const states = [
      { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
      { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
      { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "FL", name: "Florida" },
      { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
      { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
      { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
      { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
      { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
      { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
      { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
      { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
      { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
      { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
      { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
      { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
      { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
      { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" }, { code: "DC", name: "District of Columbia" },
    ];

    return jsonResponse({
      industries: industries || [],
      services: services || [],
      states,
    });
  } catch (error: any) {
    console.error("[Onboarding] Options error:", error);
    return jsonResponse({ error: error.message || "Failed to get options" }, 500);
  }
}

/**
 * Capitalize words in a string
 */
function capitalizeWords(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// =============================================================================
// EMAIL SYSTEM HANDLERS
// =============================================================================

/**
 * Helper: Send email via Resend API
 */
async function sendEmailViaResend(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("[Email] RESEND_API_KEY not configured");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: params.from || "Trike <noreply@notifications.trike.co>",
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        reply_to: params.replyTo,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Email] Resend API error:", errorText);
      return { success: false, error: errorText };
    }

    const data = await response.json();
    console.log(`[Email] Sent successfully: ${data.id}`);
    return { success: true, id: data.id };
  } catch (error: any) {
    console.error("[Email] Send error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Helper: Render template with variables
 */
function renderEmailTemplate(template: string, variables: Record<string, string>): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return rendered;
}

/**
 * Helper: Get organization ID from auth header
 */
async function getOrgIdFromAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  // Get org from user's metadata or users table
  const orgId = user.user_metadata?.organization_id;
  if (orgId) return orgId;

  // Fallback: look up in users table
  const { data: userRecord } = await supabase
    .from("users")
    .select("organization_id")
    .eq("auth_user_id", user.id)
    .single();

  return userRecord?.organization_id || null;
}

/**
 * POST /email/send - Send an email using a template
 */
async function handleSendEmail(req: Request): Promise<Response> {
  try {
    const {
      template_slug,
      recipient_email,
      recipient_user_id,
      variables = {},
      organization_id,
    } = await req.json();

    if (!template_slug) {
      return jsonResponse({ error: "template_slug is required" }, 400);
    }
    if (!recipient_email) {
      return jsonResponse({ error: "recipient_email is required" }, 400);
    }
    if (!organization_id) {
      return jsonResponse({ error: "organization_id is required" }, 400);
    }

    // Get template (org-specific first, then fallback to system)
    let template = null;

    // Try org-specific template first
    const { data: orgTemplate } = await supabase
      .from("email_templates")
      .select("*")
      .eq("slug", template_slug)
      .eq("organization_id", organization_id)
      .eq("is_active", true)
      .single();

    if (orgTemplate) {
      template = orgTemplate;
    } else {
      // Fallback to system template
      const { data: systemTemplate } = await supabase
        .from("email_templates")
        .select("*")
        .eq("slug", template_slug)
        .is("organization_id", null)
        .eq("is_active", true)
        .single();
      template = systemTemplate;
    }

    if (!template) {
      return jsonResponse({ error: `Template '${template_slug}' not found` }, 404);
    }

    // Render template with variables
    const subject = renderEmailTemplate(template.subject, variables);
    const bodyHtml = renderEmailTemplate(template.body_html, variables);
    const bodyText = template.body_text ? renderEmailTemplate(template.body_text, variables) : undefined;

    // Send via Resend
    const result = await sendEmailViaResend({
      to: recipient_email,
      subject,
      html: bodyHtml,
      text: bodyText,
    });

    // Log the email
    const { error: logError } = await supabase.from("email_logs").insert({
      organization_id,
      recipient_user_id,
      recipient_email,
      template_id: template.id,
      template_slug,
      subject,
      body_html: bodyHtml,
      trigger_type: template_slug,
      status: result.success ? "sent" : "failed",
      resend_id: result.id,
      error_message: result.error,
      sent_at: result.success ? new Date().toISOString() : null,
      metadata: { variables },
    });

    if (logError) {
      console.error("[Email] Failed to log email:", logError);
    }

    if (!result.success) {
      return jsonResponse({ error: result.error || "Failed to send email" }, 500);
    }

    return jsonResponse({
      success: true,
      message_id: result.id,
    });
  } catch (error: any) {
    console.error("[Email] Send handler error:", error);
    return jsonResponse({ error: error.message || "Failed to send email" }, 500);
  }
}

/**
 * GET /email/templates - List templates for org
 */
async function handleGetEmailTemplates(req: Request): Promise<Response> {
  try {
    const orgId = await getOrgIdFromAuth(req);
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Get system templates + org templates
    const { data: templates, error } = await supabase
      .from("email_templates")
      .select("*")
      .or(`organization_id.is.null,organization_id.eq.${orgId}`)
      .eq("is_active", true)
      .order("template_type", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;

    return jsonResponse({ templates: templates || [] });
  } catch (error: any) {
    console.error("[Email] Get templates error:", error);
    return jsonResponse({ error: error.message || "Failed to get templates" }, 500);
  }
}

/**
 * GET /email/templates/:id - Get single template
 */
async function handleGetEmailTemplate(templateId: string, req: Request): Promise<Response> {
  try {
    const orgId = await getOrgIdFromAuth(req);
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: template, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("id", templateId)
      .or(`organization_id.is.null,organization_id.eq.${orgId}`)
      .single();

    if (error || !template) {
      return jsonResponse({ error: "Template not found" }, 404);
    }

    return jsonResponse({ template });
  } catch (error: any) {
    console.error("[Email] Get template error:", error);
    return jsonResponse({ error: error.message || "Failed to get template" }, 500);
  }
}

/**
 * POST /email/templates - Create org template
 */
async function handleCreateEmailTemplate(req: Request): Promise<Response> {
  try {
    const orgId = await getOrgIdFromAuth(req);
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const { slug, name, description, subject, body_html, body_text, available_variables } = body;

    if (!slug || !name || !subject || !body_html) {
      return jsonResponse({ error: "slug, name, subject, and body_html are required" }, 400);
    }

    const { data: template, error } = await supabase
      .from("email_templates")
      .insert({
        organization_id: orgId,
        slug,
        name,
        description,
        subject,
        body_html,
        body_text,
        template_type: "organization",
        is_locked: false,
        available_variables: available_variables || [],
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return jsonResponse({ error: "A template with this slug already exists" }, 409);
      }
      throw error;
    }

    return jsonResponse({ template }, 201);
  } catch (error: any) {
    console.error("[Email] Create template error:", error);
    return jsonResponse({ error: error.message || "Failed to create template" }, 500);
  }
}

/**
 * PUT /email/templates/:id - Update template
 */
async function handleUpdateEmailTemplate(templateId: string, req: Request): Promise<Response> {
  try {
    const orgId = await getOrgIdFromAuth(req);
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Verify template exists and belongs to org (not locked)
    const { data: existing, error: getError } = await supabase
      .from("email_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (getError || !existing) {
      return jsonResponse({ error: "Template not found" }, 404);
    }

    if (existing.is_locked) {
      return jsonResponse({ error: "This template is locked and cannot be modified" }, 403);
    }

    if (existing.organization_id !== orgId) {
      return jsonResponse({ error: "You can only update your organization's templates" }, 403);
    }

    const body = await req.json();
    const { name, description, subject, body_html, body_text, available_variables, is_active } = body;

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (subject !== undefined) updates.subject = subject;
    if (body_html !== undefined) updates.body_html = body_html;
    if (body_text !== undefined) updates.body_text = body_text;
    if (available_variables !== undefined) updates.available_variables = available_variables;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data: template, error } = await supabase
      .from("email_templates")
      .update(updates)
      .eq("id", templateId)
      .select()
      .single();

    if (error) throw error;

    return jsonResponse({ template });
  } catch (error: any) {
    console.error("[Email] Update template error:", error);
    return jsonResponse({ error: error.message || "Failed to update template" }, 500);
  }
}

/**
 * DELETE /email/templates/:id - Delete template
 */
async function handleDeleteEmailTemplate(templateId: string, req: Request): Promise<Response> {
  try {
    const orgId = await getOrgIdFromAuth(req);
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Verify template belongs to org and is not locked/system
    const { data: existing, error: getError } = await supabase
      .from("email_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (getError || !existing) {
      return jsonResponse({ error: "Template not found" }, 404);
    }

    if (existing.template_type === "system") {
      return jsonResponse({ error: "System templates cannot be deleted" }, 403);
    }

    if (existing.organization_id !== orgId) {
      return jsonResponse({ error: "You can only delete your organization's templates" }, 403);
    }

    const { error } = await supabase
      .from("email_templates")
      .delete()
      .eq("id", templateId);

    if (error) throw error;

    return jsonResponse({ success: true });
  } catch (error: any) {
    console.error("[Email] Delete template error:", error);
    return jsonResponse({ error: error.message || "Failed to delete template" }, 500);
  }
}

/**
 * POST /email/templates/:id/customize - Create org copy of system template
 */
async function handleCustomizeEmailTemplate(templateId: string, req: Request): Promise<Response> {
  try {
    const orgId = await getOrgIdFromAuth(req);
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Get the system template
    const { data: systemTemplate, error: getError } = await supabase
      .from("email_templates")
      .select("*")
      .eq("id", templateId)
      .is("organization_id", null)
      .eq("template_type", "system")
      .single();

    if (getError || !systemTemplate) {
      return jsonResponse({ error: "System template not found" }, 404);
    }

    // Check if org already has a template with this slug
    const { data: existing } = await supabase
      .from("email_templates")
      .select("id")
      .eq("organization_id", orgId)
      .eq("slug", systemTemplate.slug)
      .single();

    if (existing) {
      return jsonResponse({ error: "You already have a customized version of this template" }, 409);
    }

    // Create org copy
    const { data: newTemplate, error: insertError } = await supabase
      .from("email_templates")
      .insert({
        organization_id: orgId,
        slug: systemTemplate.slug,
        name: systemTemplate.name,
        description: systemTemplate.description,
        subject: systemTemplate.subject,
        body_html: systemTemplate.body_html,
        body_text: systemTemplate.body_text,
        template_type: "organization",
        is_locked: false,
        is_active: true,
        available_variables: systemTemplate.available_variables,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return jsonResponse({ template: newTemplate }, 201);
  } catch (error: any) {
    console.error("[Email] Customize template error:", error);
    return jsonResponse({ error: error.message || "Failed to customize template" }, 500);
  }
}

/**
 * POST /email/templates/:id/test - Send test email to current user
 */
async function handleTestEmailTemplate(templateId: string, req: Request): Promise<Response> {
  try {
    const orgId = await getOrgIdFromAuth(req);
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Get current user's email
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ error: "Could not get user info" }, 401);
    }

    // Get the template
    const { data: template, error: templateError } = await supabase
      .from("email_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      return jsonResponse({ error: "Template not found" }, 404);
    }

    // Verify access (system template or own org template)
    if (template.organization_id && template.organization_id !== orgId) {
      return jsonResponse({ error: "Access denied" }, 403);
    }

    // Get org name for sample variables
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();

    // Get user's name
    const { data: userData } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("auth_id", user.id)
      .single();

    const userName = userData ? `${userData.first_name} ${userData.last_name}` : "Test User";
    const companyName = org?.name || "Your Company";

    // Build sample variables based on slug
    const sampleVariables: Record<string, string> = {
      admin_name: userName,
      employee_name: userName,
      user_name: userName,
      company_name: companyName,
      login_email: user.email || "test@example.com",
      temp_password: "TestPass123!",
      login_url: "https://app.trike.app",
      reset_link: "https://app.trike.app/reset?token=test123",
      expires_in: "1 hour",
    };

    // Render template
    const subject = renderEmailTemplate(template.subject, sampleVariables);
    const bodyHtml = renderEmailTemplate(template.body_html, sampleVariables);
    const bodyText = template.body_text ? renderEmailTemplate(template.body_text, sampleVariables) : undefined;

    // Send via Resend
    const sendResult = await sendEmailViaResend({
      to: user.email!,
      subject,
      html: bodyHtml,
      text: bodyText,
    });

    if (!sendResult.success) {
      throw new Error(sendResult.error || "Failed to send email");
    }

    // Log the test email
    await supabase.from("email_logs").insert({
      organization_id: orgId,
      recipient_email: user.email,
      template_id: template.id,
      template_slug: template.slug,
      subject,
      body_html: bodyHtml,
      trigger_type: "test",
      status: "sent",
      resend_id: sendResult.id,
      metadata: { variables: sampleVariables, test: true },
    });

    return jsonResponse({ success: true, message: `Test email sent to ${user.email}` });
  } catch (error: any) {
    console.error("[Email] Test email error:", error);
    return jsonResponse({ error: error.message || "Failed to send test email" }, 500);
  }
}

/**
 * GET /email/logs - Get email logs for org
 */
async function handleGetEmailLogs(req: Request): Promise<Response> {
  try {
    const orgId = await getOrgIdFromAuth(req);
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const status = url.searchParams.get("status");
    const trigger_type = url.searchParams.get("trigger_type");

    let query = supabase
      .from("email_logs")
      .select("*, recipient:users(first_name, last_name, email)", { count: "exact" })
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }
    if (trigger_type) {
      query = query.eq("trigger_type", trigger_type);
    }

    const { data: logs, count, error } = await query;

    if (error) throw error;

    return jsonResponse({
      logs: logs || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("[Email] Get logs error:", error);
    return jsonResponse({ error: error.message || "Failed to get email logs" }, 500);
  }
}

/**
 * POST /email/preview - Preview a template with variables
 */
async function handlePreviewEmailTemplate(req: Request): Promise<Response> {
  try {
    const orgId = await getOrgIdFromAuth(req);
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { template_id, template_slug, variables = {} } = await req.json();

    let template = null;

    if (template_id) {
      const { data } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", template_id)
        .or(`organization_id.is.null,organization_id.eq.${orgId}`)
        .single();
      template = data;
    } else if (template_slug) {
      // Try org-specific first
      const { data: orgTemplate } = await supabase
        .from("email_templates")
        .select("*")
        .eq("slug", template_slug)
        .eq("organization_id", orgId)
        .single();

      if (orgTemplate) {
        template = orgTemplate;
      } else {
        const { data: systemTemplate } = await supabase
          .from("email_templates")
          .select("*")
          .eq("slug", template_slug)
          .is("organization_id", null)
          .single();
        template = systemTemplate;
      }
    }

    if (!template) {
      return jsonResponse({ error: "Template not found" }, 404);
    }

    // Render with provided variables
    const subject = renderEmailTemplate(template.subject, variables);
    const body_html = renderEmailTemplate(template.body_html, variables);
    const body_text = template.body_text ? renderEmailTemplate(template.body_text, variables) : null;

    return jsonResponse({
      subject,
      body_html,
      body_text,
      available_variables: template.available_variables,
    });
  } catch (error: any) {
    console.error("[Email] Preview error:", error);
    return jsonResponse({ error: error.message || "Failed to preview template" }, 500);
  }
}

/**
 * Internal helper: Send welcome email (for use by other handlers)
 * Called from handleOnboardingComplete
 */
async function sendWelcomeEmail(params: {
  template_slug: "welcome_admin" | "welcome_employee";
  organization_id: string;
  recipient_email: string;
  recipient_user_id?: string;
  variables: Record<string, string>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Get org-specific or system template
    let template = null;

    const { data: orgTemplate } = await supabase
      .from("email_templates")
      .select("*")
      .eq("slug", params.template_slug)
      .eq("organization_id", params.organization_id)
      .eq("is_active", true)
      .single();

    if (orgTemplate) {
      template = orgTemplate;
    } else {
      const { data: systemTemplate } = await supabase
        .from("email_templates")
        .select("*")
        .eq("slug", params.template_slug)
        .is("organization_id", null)
        .eq("is_active", true)
        .single();
      template = systemTemplate;
    }

    if (!template) {
      console.error(`[Email] Template '${params.template_slug}' not found`);
      return { success: false, error: `Template '${params.template_slug}' not found` };
    }

    // Render template
    const subject = renderEmailTemplate(template.subject, params.variables);
    const bodyHtml = renderEmailTemplate(template.body_html, params.variables);
    const bodyText = template.body_text ? renderEmailTemplate(template.body_text, params.variables) : undefined;

    // Send via Resend
    const result = await sendEmailViaResend({
      to: params.recipient_email,
      subject,
      html: bodyHtml,
      text: bodyText,
    });

    // Log the email
    await supabase.from("email_logs").insert({
      organization_id: params.organization_id,
      recipient_user_id: params.recipient_user_id,
      recipient_email: params.recipient_email,
      template_id: template.id,
      template_slug: params.template_slug,
      subject,
      body_html: bodyHtml,
      trigger_type: params.template_slug,
      status: result.success ? "sent" : "failed",
      resend_id: result.id,
      error_message: result.error,
      sent_at: result.success ? new Date().toISOString() : null,
      metadata: { variables: params.variables },
    });

    return { success: result.success, error: result.error };
  } catch (error: any) {
    console.error("[Email] sendWelcomeEmail error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * AI-Assisted Variant Generation: Chat
 * Uses OpenAI Responses API with web search for research-first workflow
 */
async function handleVariantChat(req: Request): Promise<Response> {
  try {
    if (!OPENAI_API_KEY) return jsonResponse({ error: "OpenAI API key not configured" }, 500);

    const { sourceTrackId, variantType, variantContext, messages, phase } = await req.json();

    if (!sourceTrackId || !variantType || !variantContext) {
      return jsonResponse({ error: "sourceTrackId, variantType, and variantContext are required" }, 400);
    }

    // Try to get org from token, fallback to track's org
    let orgId = await getOrgIdFromToken(req);
    if (!orgId) {
      console.log("⚠️ [VariantChat] No orgId from token, trying to get from track...");
      const { data: trackOrg, error: trackOrgError } = await supabase
        .from("tracks")
        .select("organization_id")
        .eq("id", sourceTrackId)
        .single();

      if (!trackOrgError && trackOrg?.organization_id) {
        orgId = trackOrg.organization_id;
        console.log(`✅ [VariantChat] Got orgId from track: ${orgId}`);
      } else {
        console.error("❌ [VariantChat] Could not get orgId from track either");
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
    }

    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('title, type, content_text, transcript')
      .eq('id', sourceTrackId)
      .eq('organization_id', orgId)
      .single();

    if (trackError || !track) return jsonResponse({ error: "Source track not found" }, 404);

    const sourceContent = track.content_text || track.transcript || '';

    // Derive audience from source content for all phases
    const audience = deriveAudienceFromContent(sourceContent);

    // PHASE 1: Research - Use OpenAI Responses API with web search
    if (!messages || messages.length === 0 || phase === 'research') {
      return await handleVariantResearch(variantType, variantContext, track, sourceContent);
    }

    // PHASE 2: After research, handle follow-up conversation (optional company-specific questions)
    const systemPrompt = getVariantSystemPrompt(variantType, variantContext, track.type, audience);
    const apiMessages = [{ role: 'system', content: systemPrompt }, ...messages];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: apiMessages,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI error: ${error}`);
    }

    // Proxy the stream
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = response.body?.getReader();

    (async () => {
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      try {
        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;
              try {
                const json = JSON.parse(data);
                const content = json.choices[0]?.delta?.content;
                if (content) {
                  await writer.write(encoder.encode(content));
                }
              } catch (e) {
                // Ignore parse errors for partial chunks
              }
            }
          }
        }
      } catch (e) {
        console.error("Streaming error:", e);
      } finally {
        writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error: any) {
    console.error("Error in handleVariantChat:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * Research phase using OpenAI Responses API with web search
 */
async function handleVariantResearch(
  variantType: string,
  variantContext: any,
  track: { title: string; type: string },
  sourceContent: string
): Promise<Response> {
  const stateName = variantContext.state_name || variantContext.state_code || 'the specified state';

  // Build search queries based on content topics
  const topicAnalysis = analyzeContentTopics(sourceContent);
  const searchQueries = buildSearchQueries(topicAnalysis, stateName, variantType);

  console.log(`🔍 [VariantResearch] Researching ${variantType} variant for ${stateName}`);
  console.log(`📋 [VariantResearch] Topics detected: ${topicAnalysis.join(', ')}`);
  console.log(`🔎 [VariantResearch] Search queries: ${searchQueries.join(' | ')}`);

  // Use OpenAI Responses API with web search tool
  const researchPrompt = buildResearchPrompt(variantType, variantContext, track, sourceContent, topicAnalysis);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        tools: [{ type: "web_search_preview" }],
        input: researchPrompt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI Responses API error:", errorText);
      // Fallback to non-web-search if Responses API fails
      return await handleVariantResearchFallback(variantType, variantContext, track, sourceContent, topicAnalysis);
    }

    const result = await response.json();

    // Extract the response and citations
    const outputText = extractResponseText(result);
    const citations = extractCitations(result);

    // Quality gate: Check for required sources AND relevance
    // Now passes sourceContent and research output for relevance filtering
    const qualityCheck = validateResearchQuality(citations, topicAnalysis, sourceContent, outputText);

    // Use filtered content if relevance issues were found
    const displayText = qualityCheck.filteredContent || outputText;

    // Build the response message
    const researchResult = formatResearchResult(displayText, citations, qualityCheck, variantType, variantContext, sourceContent);

    // Stream the result back
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(researchResult));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error: any) {
    console.error("Research error:", error);
    return await handleVariantResearchFallback(variantType, variantContext, track, sourceContent, topicAnalysis);
  }
}

/**
 * Fallback research handler when Responses API is unavailable
 */
async function handleVariantResearchFallback(
  variantType: string,
  variantContext: any,
  track: { title: string; type: string },
  sourceContent: string,
  topicAnalysis: string[]
): Promise<Response> {
  const stateName = variantContext.state_name || variantContext.state_code || 'the specified state';

  const fallbackMessage = `⚠️ **Web research unavailable** - Using knowledge-based adaptation

I was unable to perform live web research for current ${stateName} regulations. I'll proceed using my training knowledge, but **this content should be flagged for human review** before publishing.

**Topics identified in source content:**
${topicAnalysis.map(t => `• ${t}`).join('\n')}

**What I need from you (company-specific only):**
1. Any internal procedures or terminology to use?
2. Specific contact names or escalation paths?
3. Any areas you want emphasized?

Or type "proceed" to generate the variant with a "Needs Review" flag.

[NEEDS_REVIEW]`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(fallbackMessage));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

/**
 * Analyze source content to identify regulatory topics
 */
function analyzeContentTopics(content: string): string[] {
  const topics: string[] = [];
  const contentLower = content.toLowerCase();

  // Tobacco/Vape
  if (contentLower.includes('tobacco') || contentLower.includes('cigarette') || contentLower.includes('cigar')) {
    topics.push('tobacco sales');
  }
  if (contentLower.includes('vape') || contentLower.includes('e-cigarette') || contentLower.includes('vaping')) {
    topics.push('vape/e-cigarette sales');
  }

  // Alcohol
  if (contentLower.includes('alcohol') || contentLower.includes('beer') || contentLower.includes('wine') || contentLower.includes('liquor')) {
    topics.push('alcohol sales');
  }

  // Age verification
  if (contentLower.includes('age') || contentLower.includes('id') || contentLower.includes('identification') || contentLower.includes('verify')) {
    topics.push('age verification requirements');
  }

  // Lottery
  if (contentLower.includes('lottery') || contentLower.includes('scratch') || contentLower.includes('lotto')) {
    topics.push('lottery sales');
  }

  // Food safety
  if (contentLower.includes('food') || contentLower.includes('handler') || contentLower.includes('health department')) {
    topics.push('food safety/handling');
  }

  // Fuel
  if (contentLower.includes('fuel') || contentLower.includes('gasoline') || contentLower.includes('diesel') || contentLower.includes('pump')) {
    topics.push('fuel handling/delivery');
  }

  // Safety
  if (contentLower.includes('safety') || contentLower.includes('emergency') || contentLower.includes('spill')) {
    topics.push('safety procedures');
  }

  // If no specific topics found, add generic
  if (topics.length === 0) {
    topics.push('retail compliance');
  }

  return topics;
}

/**
 * Build search queries for the identified topics
 */
function buildSearchQueries(topics: string[], stateName: string, variantType: string): string[] {
  const queries: string[] = [];

  for (const topic of topics) {
    if (variantType === 'geographic') {
      queries.push(`${stateName} ${topic} regulations requirements 2024 2025`);
      queries.push(`${stateName} state law ${topic} retail compliance`);
    }
  }

  return queries.slice(0, 4); // Limit to 4 queries
}

// ============================================================================
// AUDIENCE DERIVATION SYSTEM (Server-side)
// ============================================================================
// Derives learner role from source content instead of hardcoding.
// This enables dynamic forbidden topic filtering based on who the content
// is actually teaching. A transcript that says "ask your manager" and
// "ring up the customer" clearly targets cashiers, not owners.
// ============================================================================

type LearnerRole =
  | 'frontline_cashier'
  | 'manager_supervisor'
  | 'delivery_driver'
  | 'owner_executive'
  | 'back_office_admin'
  | 'other';

interface AudienceDerivation {
  primaryRole: LearnerRole;
  secondaryRoles: LearnerRole[];
  evidence: string[];
  roleConfidence: 'high' | 'medium' | 'low';
  learnerActions: string[];
  roleImplications: string[];
}

// Role indicators: phrases that suggest a specific learner audience
const ROLE_INDICATORS: Record<LearnerRole, string[]> = {
  frontline_cashier: [
    'ring up', 'checkout', 'register', 'customer service', 'ask for id',
    'refuse the sale', 'card the customer', 'scan', 'at the counter',
    'when a customer', 'your customer', 'tell the customer', 'apologize',
    'continue to ring', 'complete the transaction', 'behind the counter',
    // Additional indicators
    'point of sale', 'pos', 'at the register', 'during checkout', 'transaction',
    'customer approaches', 'customer asks', 'customer presents'
  ],
  manager_supervisor: [
    'supervise', 'train your team', 'coach', 'audit', 'review logs',
    'store policy', 'discipline', 'write up', 'shift lead', 'as a manager',
    'your employees', 'your staff', 'your team',
    // Additional indicators
    'ensure compliance', 'store manager', 'shift manager', 'policy enforcement',
    'employee training', 'compliance audit', 'supervising staff'
  ],
  delivery_driver: [
    'deliver', 'route', 'vehicle', 'load', 'unload', 'manifest',
    'customer delivery', 'drop off', 'signature on delivery',
    // Additional indicators
    'at the door', 'recipient', 'hand-off', 'return to store', 'undeliverable',
    'delivery address', 'driver', 'en route'
  ],
  owner_executive: [
    'license', 'renew', 'file', 'remit', 'tax return', 'business registration',
    'compliance officer', 'as an owner', 'your business', 'store owner',
    // Additional indicators
    'renewal', 'licensing', 'fee', 'filing', 'audit notice',
    'business license', 'annual report', 'regulatory filing'
  ],
  back_office_admin: [
    'inventory', 'records', 'spreadsheet', 'report', 'filing',
    'documentation', 'administrative', 'back office',
    // Additional indicators
    'data entry', 'record keeping', 'compliance records'
  ],
  other: []
};


// Action verbs that indicate what learners are being taught to DO
const ACTION_VERB_PATTERNS = [
  'check id', 'verify age', 'ask for', 'refuse', 'decline', 'accept',
  'scan', 'ring up', 'complete', 'call', 'notify', 'report', 'sign',
  'deliver', 'load', 'file', 'submit', 'review', 'approve', 'train',
  'supervise', 'audit', 'document', 'record', 'enter', 'process'
];

/**
 * Derive the learner audience from source content.
 *
 * WHY: Instead of assuming "cashier", we derive the role from the content.
 * This allows dynamic filtering - manager content can include supervision topics,
 * owner content can include licensing, etc.
 *
 * APPROACH:
 * 1. Scan for role indicator phrases
 * 2. Count matches per role
 * 3. Extract supporting evidence
 * 4. Determine confidence based on match strength
 * 5. Extract learner actions (verbs) for scope lock
 */
function deriveAudienceFromContent(sourceContent: string): AudienceDerivation {
  const contentLower = sourceContent.toLowerCase();
  const roleCounts: Record<LearnerRole, number> = {
    frontline_cashier: 0,
    manager_supervisor: 0,
    delivery_driver: 0,
    owner_executive: 0,
    back_office_admin: 0,
    other: 0
  };
  const roleEvidence: Record<LearnerRole, string[]> = {
    frontline_cashier: [],
    manager_supervisor: [],
    delivery_driver: [],
    owner_executive: [],
    back_office_admin: [],
    other: []
  };

  // Count role indicators and collect evidence
  for (const [role, indicators] of Object.entries(ROLE_INDICATORS) as [LearnerRole, string[]][]) {
    for (const indicator of indicators) {
      if (contentLower.includes(indicator)) {
        roleCounts[role]++;
        const idx = contentLower.indexOf(indicator);
        const start = Math.max(0, idx - 20);
        const end = Math.min(sourceContent.length, idx + indicator.length + 30);
        const snippet = sourceContent.substring(start, end).trim();
        if (roleEvidence[role].length < 6) {
          roleEvidence[role].push(`"...${snippet}..."`);
        }
      }
    }
  }

  // Determine primary role (highest count)
  let primaryRole: LearnerRole = 'other';
  let maxCount = 0;
  for (const [role, count] of Object.entries(roleCounts) as [LearnerRole, number][]) {
    if (count > maxCount) {
      maxCount = count;
      primaryRole = role;
    }
  }

  // Secondary roles (any with at least 2 matches)
  const secondaryRoles: LearnerRole[] = [];
  for (const [role, count] of Object.entries(roleCounts) as [LearnerRole, number][]) {
    if (role !== primaryRole && count >= 2) {
      secondaryRoles.push(role);
    }
  }

  // Confidence
  let roleConfidence: 'high' | 'medium' | 'low' = 'low';
  if (maxCount >= 5) roleConfidence = 'high';
  else if (maxCount >= 2) roleConfidence = 'medium';

  // Default to 'other' if low confidence
  if (roleConfidence === 'low') primaryRole = 'other';

  // Extract learner actions (verbs being taught)
  const learnerActions: string[] = [];
  for (const action of ACTION_VERB_PATTERNS) {
    if (contentLower.includes(action)) {
      learnerActions.push(action);
    }
  }

  // Role implications
  const roleImplications: string[] = [];
  switch (primaryRole) {
    case 'frontline_cashier':
      roleImplications.push('Can check customer IDs at point of sale');
      roleImplications.push('Can refuse sales when policy requires');
      roleImplications.push('Can escalate issues to management');
      break;
    case 'manager_supervisor':
      roleImplications.push('Can train and supervise frontline staff');
      roleImplications.push('Can enforce store-level policy');
      break;
    case 'owner_executive':
      roleImplications.push('Can manage business licensing and compliance');
      break;
    default:
      roleImplications.push('Role-specific actions to be determined');
  }

  return {
    primaryRole,
    secondaryRoles: secondaryRoles.slice(0, 2),
    evidence: roleEvidence[primaryRole].slice(0, 6),
    roleConfidence,
    learnerActions,
    roleImplications
  };
}


/**
 * Build the research prompt for OpenAI Responses API
 *
 * CORE PRINCIPLE: If a rule doesn't modify a learner action from the source,
 * it gets discarded. No hardcoded forbidden lists - just scope lock.
 */
function buildResearchPrompt(
  variantType: string,
  variantContext: any,
  track: { title: string; type: string },
  sourceContent: string,
  topicAnalysis: string[]
): string {
  const stateName = variantContext.state_name || variantContext.state_code || 'the specified state';

  // Derive audience from source content
  const audience = deriveAudienceFromContent(sourceContent);
  const roleLabel = audience.primaryRole.replace('_', ' ').toUpperCase();
  const confidenceNote = audience.roleConfidence === 'high'
    ? '(High confidence)'
    : audience.roleConfidence === 'medium'
      ? '(Medium confidence)'
      : '(Low confidence - minimal adaptation)';

  return `You are researching ${stateName} state regulations to adapt training content.

## AUDIENCE DERIVATION
**Derived Role:** ${roleLabel} ${confidenceNote}
**Evidence from Source:**
${audience.evidence.slice(0, 4).map(e => `- ${e}`).join('\n') || '- No strong role indicators found'}
**Learner Actions (what they're being taught to DO):**
${audience.learnerActions.map(a => `- ${a}`).join('\n') || '- General compliance actions'}

## SCOPE LOCK (HARD RULE)
You may ONLY add state-specific rules that directly modify one of the learner actions above.

For any proposed rule, you MUST identify:
- **SourceAction:** Which learner action it modifies
- **WhyItMatters:** 1 sentence on behavioral impact

If you cannot map a rule to a SourceAction, DISCARD it. No exceptions.

## SOURCE REQUIREMENTS

**TIER 1 (Required - need at least 2):**
- State legislature / compiled statutes (.gov domains)
- State administrative code / regulations

**DO NOT USE:**
- SEO blogs, law firm marketing, "compliance checklist" sites
- News articles, forums, or social media

## OUTPUT FORMAT (3-8 rules maximum)

For each RELEVANT regulation found:
\`\`\`
**Rule:** [Actionable instruction for the ${roleLabel} - what they DO]
**SourceAction:** [Which learner action: ${audience.learnerActions.slice(0, 4).join(' | ') || 'check id | refuse | verify age'}]
**WhyItMatters:** [1 sentence: behavioral impact]
**Source:** [Official source name]
**URL:** [Direct link to .gov]
**Confidence:** [High = Tier-1 | Needs Review = other]
\`\`\`

## AFTER RESEARCH

Summarize findings in 3-8 bullet points maximum.
For each finding, verify it maps to a SourceAction - if not, DISCARD it.

Then list 0-3 COMPANY-SPECIFIC questions only:
- POS system flow for age-restricted sales?
- Escalation path (who to call)?
- ID scanning technology in use?
- "Card everyone" policy beyond legal minimum?

DO NOT ask about state laws, age requirements, or penalties - YOU research those.`;
}

/**
 * Extract text from OpenAI Responses API result
 */
function extractResponseText(result: any): string {
  if (result.output && Array.isArray(result.output)) {
    for (const item of result.output) {
      if (item.type === 'message' && item.content) {
        for (const content of item.content) {
          if (content.type === 'output_text') {
            return content.text || '';
          }
        }
      }
    }
  }
  return result.output_text || result.text || JSON.stringify(result);
}

/**
 * Extract citations from OpenAI Responses API result
 */
function extractCitations(result: any): Array<{title: string; url: string; snippet?: string}> {
  const citations: Array<{title: string; url: string; snippet?: string}> = [];

  if (result.output && Array.isArray(result.output)) {
    for (const item of result.output) {
      if (item.type === 'message' && item.content) {
        for (const content of item.content) {
          if (content.type === 'output_text' && content.annotations) {
            for (const annotation of content.annotations) {
              if (annotation.type === 'url_citation') {
                citations.push({
                  title: annotation.title || annotation.url,
                  url: annotation.url,
                  snippet: annotation.snippet
                });
              }
            }
          }
        }
      }
    }
  }

  return citations;
}

// Tier-1 domain allowlist: authoritative government sources
const TIER1_DOMAIN_PATTERNS = [
  // State and federal .gov domains
  /\.gov$/i,
  /\.gov\//i,
  // State legislature patterns
  /legislature\./i,
  /leg\.state\./i,
  /legis\./i,
  /capitol\./i,
  // Administrative code patterns
  /admin\.code/i,
  /admincode/i,
  /regulations\./i,
  /rules\.state\./i,
  // State-specific patterns
  /sos\.state\./i,  // Secretary of State
  /dor\.state\./i,  // Dept of Revenue
  /atg\.state\./i,  // Attorney General
];

/**
 * Check if a URL is from a Tier-1 (authoritative government) source.
 */
function isTier1Source(url: string): boolean {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  return TIER1_DOMAIN_PATTERNS.some(pattern => pattern.test(urlLower));
}

/**
 * Validate research quality - simplified to just check Tier-1 sources.
 * Scope lock is handled by the prompt itself via learner action mapping.
 */
function validateResearchQuality(
  citations: Array<{title: string; url: string; snippet?: string}>,
  topics: string[],
  sourceContent?: string,
  researchOutput?: string
): {
  passed: boolean;
  tier1Count: number;
  issues: string[];
  relevanceIssues: string[];
  filteredContent?: string;
} {
  const issues: string[] = [];
  const relevanceIssues: string[] = [];
  let tier1Count = 0;

  // Check for Tier-1 sources using allowlist
  for (const citation of citations) {
    if (isTier1Source(citation.url)) {
      tier1Count++;
    }
  }

  if (tier1Count < 2) {
    issues.push(`Only ${tier1Count} government sources found (need at least 2)`);
  }

  if (citations.length === 0) {
    issues.push('No sources found - content needs manual review');
  }

  // Check for strong claims without Tier-1 backing
  if (researchOutput) {
    const strongClaimPatterns = /\b(must|required|illegal|penalty|fine|violation|prohibited)\b/gi;
    const hasStrongClaims = strongClaimPatterns.test(researchOutput);

    if (hasStrongClaims && tier1Count < 1) {
      relevanceIssues.push('Contains strong legal claims but lacks Tier-1 government source backing');
    }
  }

  // Quality passes if: 2+ Tier-1 sources AND no critical issues AND relevance mostly OK
  const passed = tier1Count >= 2 &&
                 citations.length > 0 &&
                 relevanceIssues.filter(i => i.includes('strong legal claims')).length === 0;

  return {
    passed,
    tier1Count,
    issues,
    relevanceIssues,
    filteredContent
  };
}

/**
 * Format the research result for display
 */
function formatResearchResult(
  outputText: string,
  citations: Array<{title: string; url: string; snippet?: string}>,
  qualityCheck: { passed: boolean; tier1Count: number; issues: string[]; relevanceIssues?: string[]; filteredContent?: string },
  variantType: string,
  variantContext: any,
  sourceContent?: string
): string {
  const stateName = variantContext.state_name || variantContext.state_code || 'the specified state';

  // Derive audience for display
  const audience = sourceContent ? deriveAudienceFromContent(sourceContent) : null;

  let result = `## Research Findings: ${stateName}\n\n`;

  // Show derived audience
  if (audience) {
    result += `**Derived Role:** ${audience.primaryRole.replace('_', ' ')} (${audience.roleConfidence})\n`;
    result += `**Learner Actions:** ${audience.learnerActions.join(', ') || 'none detected'}\n\n`;
  }

  // Quality indicator
  if (qualityCheck.passed) {
    result += `✅ **Quality Gate Passed** (${qualityCheck.tier1Count} Tier-1 sources)\n\n`;
  } else {
    result += `⚠️ **Needs Review**\n`;
    for (const issue of qualityCheck.issues) {
      result += `- ${issue}\n`;
    }
    result += '\n';
  }

  // Main research findings
  result += `### ${stateName}-Specific Rules\n\n`;
  result += outputText + '\n\n';

  // Sources
  if (citations.length > 0) {
    result += `---\n### Sources\n`;
    for (const citation of citations) {
      const tier1 = isTier1Source(citation.url);
      result += `- ${tier1 ? '✅' : '📄'} ${citation.title}\n  ${citation.url}\n`;
    }
    result += '\n';
  }

  // Open Questions
  result += `---\n### Open Questions (Company-Specific Only)\n\n`;
  result += `1. **POS Flow** — How does your register handle age-restricted items?\n`;
  result += `2. **Escalation Path** — Who should the cashier call if there's a dispute?\n`;
  result += `3. **Card-All Policy** — Do you require ID for all purchases?\n`;
  result += `\n*These are optional. Type "proceed" to generate with standard ${stateName} regulations.*\n\n`;

  // Status indicator for UI
  if (!qualityCheck.passed) {
    result += `[NEEDS_REVIEW]`;
  } else {
    result += `[READY_TO_GENERATE]`;
  }

  return result;
}

/**
 * AI-Assisted Variant Generation: Generate
 */
async function handleVariantGenerate(req: Request): Promise<Response> {
  try {
    if (!OPENAI_API_KEY) return jsonResponse({ error: "OpenAI API key not configured" }, 500);

    const { sourceTrackId, variantType, variantContext, clarificationAnswers } = await req.json();

    if (!sourceTrackId || !variantType || !variantContext) {
      return jsonResponse({ error: "sourceTrackId, variantType, and variantContext are required" }, 400);
    }

    // Try to get org from token, fallback to track's org
    let orgId = await getOrgIdFromToken(req);
    if (!orgId) {
      console.log("⚠️ [VariantGenerate] No orgId from token, trying to get from track...");
      const { data: trackOrg, error: trackOrgError } = await supabase
        .from("tracks")
        .select("organization_id")
        .eq("id", sourceTrackId)
        .single();

      if (!trackOrgError && trackOrg?.organization_id) {
        orgId = trackOrg.organization_id;
        console.log(`✅ [VariantGenerate] Got orgId from track: ${orgId}`);
      } else {
        console.error("❌ [VariantGenerate] Could not get orgId from track either");
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
    }

    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('*')
      .eq('id', sourceTrackId)
      .eq('organization_id', orgId)
      .single();

    if (trackError || !track) return jsonResponse({ error: "Source track not found" }, 404);

    const sourceContent = track.content_text || track.transcript || '';
    const qaContent = clarificationAnswers
      ? clarificationAnswers.map((qa: any) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')
      : 'No specific clarifications provided.';

    // Derive audience from source content
    const audience = deriveAudienceFromContent(sourceContent);
    const roleLabel = audience.primaryRole.replace('_', ' ').toUpperCase();
    const roleLabelLower = audience.primaryRole.replace('_', ' ');
    const learnerActionsStr = audience.learnerActions.length
      ? audience.learnerActions.join(', ')
      : 'check id, verify age, refuse sale';
    const stateName = variantContext.state_name || variantContext.state_code || 'the specified state';

    // Enhanced generation prompt with structured output format
    const generationPrompt = `
## SOURCE CONTENT (to adapt)
${sourceContent}

## VARIANT CONTEXT
- Type: ${variantType}
- Target: ${stateName}
- Derived Learner Role: ${roleLabel} (${audience.roleConfidence} confidence)
- Learner Actions: ${learnerActionsStr}

## COMPANY-SPECIFIC CONTEXT (from user)
${qaContent}

## TASK: Generate ${stateName} State Variant

Apply the MINIMAL-DELTA principle: change ONLY what ${stateName} law requires you to change.
Do NOT add new topics, warnings, or "nice to know" information not in the source.

### SCOPE LOCK (HARD RULE)

You may ONLY include state-specific rules that modify one of these learner actions:
${audience.learnerActions.map(a => `- ${a}`).join('\n') || '- check id\n- verify age\n- refuse sale'}

For each rule, identify:
- **SourceAction:** Which learner action it modifies
- **WhyItMatters:** 1 sentence on behavioral impact

If a rule doesn't modify a SourceAction above, DISCARD it.

### CITATION REQUIREMENT
Any "must", "required", "illegal", or "penalty" needs [Source: URL]

### ROLE AWARENESS
Write for a ${roleLabel} ("you must..."). Use second person.

### RETURN THIS JSON STRUCTURE:
{
  "generatedTitle": "${track.title} - ${stateName}",
  "researchFindings": [
    {
      "rule": "Actionable rule for ${roleLabelLower}",
      "sourceAction": "Which learner action this modifies",
      "whyItMatters": "1 sentence on behavioral impact",
      "citation": "Source name and URL",
      "effectiveDate": "Date or 'Current'",
      "confidence": "high|medium|needs_review"
    }
  ],
  "generatedContent": "The adapted HTML/text content - MINIMAL changes from source",
  "adaptations": [
    {
      "section": "Section name",
      "originalText": "Original text from source",
      "adaptedText": "New text for ${stateName}",
      "reason": "Why this change was needed (cite specific law/regulation)",
      "sourceAction": "Which learner action this adapts"
    }
  ],
  "openQuestions": [
    "Optional company-specific question (0-3 max, only if truly needed)"
  ],
  "qualityFlags": {
    "needsReview": false,
    "unresolvedCitations": [],
    "outOfScopeDiscarded": []
  }
}

IMPORTANT:
- researchFindings should have 3-8 rules MAX, each mapped to a learner action
- generatedContent should be nearly identical to source, with only ${stateName}-specific swaps
- adaptations should list EVERY change made, with reason and source action
- openQuestions should ONLY be about company-specific items (POS, escalation, card-all)
- Set needsReview: true if any claim lacks Tier-1 citation
- outOfScopeDiscarded should list any topics you found but discarded as out of scope
`;

    const systemPrompt = getVariantSystemPrompt(variantType, variantContext, track.type, audience);
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: generationPrompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI error: ${error}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    try {
      return jsonResponse(JSON.parse(content));
    } catch (e) {
      return jsonResponse({ 
        generatedTitle: `${track.title} (${variantType} variant)`,
        generatedContent: content,
        adaptations: []
      });
    }
  } catch (error: any) {
    console.error("Error in handleVariantGenerate:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// ============================================================================
// PROMPT HELPERS - Enhanced with Instructional Scope Lock and Role Awareness
// ============================================================================
// These prompts enforce:
// 1. INSTRUCTIONAL SCOPE LOCK - Only adapt topics that exist in source content
// 2. ROLE AWARENESS - Focus on cashier/associate actions, not owner concerns
// 3. FORBIDDEN TOPICS - Never drift into license fees, tax filing, etc.
// 4. MINIMAL-DELTA - Output should be as close to source as possible
// 5. CITATION REQUIREMENT - Strong claims need Tier-1 sources
// ============================================================================

function getVariantSystemPrompt(
  variantType: string,
  variantContext: any,
  sourceTrackType: string,
  audience?: AudienceDerivation
): string {
  let contextDetails = '';
  let scopeInstructions = '';

  // Use derived role or fall back to generic
  const roleLabel = audience?.primaryRole
    ? audience.primaryRole.replace('_', ' ').toUpperCase()
    : 'LEARNER';
  const roleLabelLower = audience?.primaryRole
    ? audience.primaryRole.replace('_', ' ')
    : 'learner';
  const learnerActionsStr = audience?.learnerActions?.length
    ? audience.learnerActions.join(', ')
    : 'check id, verify age, refuse sale';

  switch (variantType) {
    case 'geographic':
      const stateName = variantContext.state_name || variantContext.state_code || 'the specified state';
      contextDetails = `Target State: ${stateName}
Derived Learner Role: ${roleLabel} (${audience?.roleConfidence || 'unknown'} confidence)
Learner Actions: ${learnerActionsStr}`;

      scopeInstructions = `
## SCOPE LOCK (HARD RULE)
You may ONLY add state-specific rules that directly modify one of these learner actions:
${audience?.learnerActions?.map(a => `- ${a}`).join('\n') || '- check id\n- verify age\n- refuse sale'}

For any proposed rule, you MUST identify:
- **SourceAction:** Which learner action it modifies
- **WhyItMatters:** 1 sentence on behavioral impact

If you cannot map a rule to a SourceAction, DISCARD it. No exceptions.

## ROLE AWARENESS
Write for a ${roleLabel} (derived from source content). Use second person.
Focus on what the learner DOES, not business operations.
${audience?.roleImplications?.length ? '\nRole capabilities:\n' + audience.roleImplications.map(r => `- ${r}`).join('\n') : ''}

## SOURCE-TO-SENTENCE MAPPING
Every state-specific fact you add MUST map to a learner action from the source.
If source teaches "check ID" → you can add "${stateName}'s accepted ID types"
If source doesn't cover a topic → do NOT add requirements for it

## DO NOT ASK ABOUT LAWS
You research state regulations - do NOT ask the user about:
- Age requirements, penalties, or fines
- What IDs are acceptable
- State law specifics
ONLY ask about company-specific preferences (POS flow, escalation, card-all policy).`;
      break;

    case 'company':
      contextDetails = `Target Organization: ${variantContext.org_name || 'Not specified'}
Derived Learner Role: ${roleLabel}`;
      scopeInstructions = `
ASK ABOUT COMPANY-SPECIFIC DETAILS:
- Company policies, brand standards, internal terminology
- Escalation paths, contact roles, company-specific tools
- Maintain the same instructional scope as the source - do not add new compliance topics.`;
      break;

    case 'unit':
      contextDetails = `Target Unit/Store: ${variantContext.store_name || variantContext.store_id || 'Not specified'}
Derived Learner Role: ${roleLabel}`;
      scopeInstructions = `
ASK ABOUT LOCATION-SPECIFIC DETAILS:
- Local manager names, store layout, specific equipment
- Local emergency contacts, neighborhood considerations
- Maintain the same instructional scope as the source - do not add new compliance topics.`;
      break;
  }

  return `You are an expert training content adaptation assistant for a multi-tenant LMS.

YOUR GOAL: Adapt an existing training track (type: ${sourceTrackType}) into a ${variantType} variant with MINIMAL changes.

CONTEXT:
${contextDetails}
${scopeInstructions}

## MINIMAL-DELTA PRINCIPLE
Your output should be as close to the source as possible. Only change what MUST change.
- Same structure, same flow, same tone
- Swap specific regulations/requirements only where they differ
- Do not add sections, warnings, or "nice to know" information
- If unsure whether something should change, leave it as-is

## CITATION REQUIREMENT
Any claim using "must", "required", "illegal", or "penalty" needs a citation.
If you cannot cite it to a Tier-1 source (state .gov), mark it [NEEDS REVIEW].

## OUTPUT FORMAT
Structure your variant generation response as:

1. **Research Findings (Relevant Only)** — 3-8 bullet rules max
   Each rule: maps to learner action, has citation, includes effective date if known

2. **${variantContext.state_name || 'State'}-Specific Draft Script** — Rewritten transcript
   Minimal changes from source. Track what was adapted and why.

3. **Open Questions (Company-Specific Only)** — 0-3 questions max
   ONLY: POS flow, escalation path, signage template, card-all policy, ID scanning
   NEVER: state laws, regulations, age requirements (you already have those)

BE PROFESSIONAL: Use clear, operational language suitable for ${roleLabelLower}s.`;
}

/**
 * getClarificationPrompt - Uses audience derivation for research-first approach
 *
 * KEY CHANGES:
 * 1. Derives learner audience from source content
 * 2. Shows which learner actions will drive the research scope
 * 3. Only asks company-specific questions, never about laws/regulations
 * 4. Shows the user exactly what scope the variant will cover
 */
function getClarificationPrompt(variantType: string, variantContext: any, sourceContent: string): string {
  let targetDesc = '';
  let questionGuidance = '';

  // Derive audience from source content
  const audience = deriveAudienceFromContent(sourceContent);
  const roleLabel = audience.primaryRole.replace('_', ' ').toUpperCase();
  const learnerActionsStr = audience.learnerActions.length
    ? audience.learnerActions.join(', ')
    : 'check id, verify age, refuse sale';

  switch (variantType) {
    case 'geographic':
      targetDesc = `${variantContext.state_name || 'the specified state'}`;
      questionGuidance = `
## Audience Derivation
**Derived Role:** ${roleLabel} (${audience.roleConfidence} confidence)
**Evidence:** ${audience.evidence.slice(0, 3).join('; ') || 'None'}
**Learner Actions:** ${learnerActionsStr}

## My Approach for ${targetDesc}

I will research ${targetDesc}'s specific regulations that modify the learner actions above, using authoritative (.gov) sources.

**SCOPE LOCK:** Rules that don't modify a learner action get discarded.

**After research, I may ask (0-3 questions max):**
- Your POS system flow for age-restricted items
- Escalation path (who to call if issues arise)
- Any "card everyone" policy beyond legal minimum
- ID scanning technology in use

**I will NOT ask you about:**
- State laws, age requirements, or penalties (I research those)
- What IDs are acceptable (state law determines this)`;
      break;
    case 'company':
      targetDesc = `${variantContext.org_name || 'your organization'}`;
      questionGuidance = `
**Derived Role:** ${roleLabel}
**Learner Actions:** ${learnerActionsStr}

To customize this for ${targetDesc}, I'll need your company-specific policies, terminology, and procedures. I'll maintain the same instructional scope as the source.`;
      break;
    case 'unit':
      targetDesc = `${variantContext.store_name || 'this location'}`;
      questionGuidance = `
**Derived Role:** ${roleLabel}
**Learner Actions:** ${learnerActionsStr}

To customize this for ${targetDesc}, I'll need location-specific details like manager names, local contacts, and any store-specific procedures.`;
      break;
  }

  // Shortened source content summary
  const contentSummary = sourceContent.substring(0, 400) + (sourceContent.length > 400 ? '...' : '');

  if (variantType === 'geographic') {
    return `## Source Content Analysis

${questionGuidance}

**Content Summary:**
"${contentSummary}"

---
**Ready to proceed?** I'll start researching ${targetDesc} regulations now and present findings.

Or provide any company-specific context first (POS flow, escalation path, card-all policy).`;
  }

  return `I've analyzed the source content for ${targetDesc}.

**Source Content Summary:**
"${contentSummary}"

${questionGuidance}

Do you have any specific requirements, or should I proceed with generating the ${variantType} variant?`;
}

// ============================================================================
// STATE VARIANT INTELLIGENCE V2 HANDLERS
// ============================================================================

/**
 * Handler: Build Scope Contract
 */
async function handleBuildScopeContract(req: Request): Promise<Response> {
  try {
    const { sourceTrackId, variantType, variantContext, includeOrgRoles } = await req.json();

    if (!sourceTrackId || !variantType || !variantContext) {
      return jsonResponse({ error: "sourceTrackId, variantType, and variantContext are required" }, 400);
    }

    // Try to get org from token, fallback to track's org
    let orgId = await getOrgIdFromToken(req);
    if (!orgId) {
      console.log("⚠️ [BuildScopeContract] No orgId from token, trying to get from track...");
      const { data: trackOrg, error: trackOrgError } = await supabase
        .from("tracks")
        .select("organization_id")
        .eq("id", sourceTrackId)
        .single();

      if (!trackOrgError && trackOrg?.organization_id) {
        orgId = trackOrg.organization_id;
        console.log(`✅ [BuildScopeContract] Got orgId from track: ${orgId}`);
      } else {
        console.error("❌ [BuildScopeContract] Could not get orgId from track either");
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
    }

    // Fetch the source track
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('title, type, content_text, transcript, description')
      .eq('id', sourceTrackId)
      .eq('organization_id', orgId)
      .single();

    if (trackError || !track) {
      return jsonResponse({ error: "Source track not found" }, 404);
    }

    // Get source content
    const sourceContent = track.content_text || track.transcript || track.description || '';

    // Derive audience from content (using existing logic)
    const audience = deriveAudienceFromContent(sourceContent);

    // Build the scope contract
    const scopeContract = {
      primaryRole: audience.primaryRole,
      secondaryRoles: audience.secondaryRoles,
      roleConfidence: audience.roleConfidence,
      roleEvidenceQuotes: audience.evidence.slice(0, 5),
      allowedLearnerActions: audience.learnerActions,
      disallowedActionClasses: [], // Computed from what's NOT in learnerActions
      domainAnchors: [], // Extract key terms from content
      instructionalGoal: `Adapt content for ${variantType} variant while maintaining core instructional objectives`,
    };

    // Insert into database
    const { data: contract, error: insertError } = await supabase
      .from('variant_scope_contracts')
      .insert({
        organization_id: orgId,
        source_track_id: sourceTrackId,
        variant_type: variantType,
        variant_context: variantContext,
        scope_contract: scopeContract,
        role_selection_needed: audience.roleConfidence === 'low',
        top_role_matches: audience.roleConfidence === 'low' ? [
          { roleId: '1', roleName: audience.primaryRole, score: 0.7, why: 'Primary match' },
          ...(audience.secondaryRoles.slice(0, 2).map((role, i) => ({
            roleId: String(i + 2),
            roleName: role,
            score: 0.5 - (i * 0.1),
            why: 'Secondary match'
          })))
        ] : null,
        extraction_method: 'llm',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting scope contract:', insertError);
      return jsonResponse({ error: "Failed to create scope contract" }, 500);
    }

    return jsonResponse({
      contractId: contract.id,
      scopeContract: scopeContract,
      roleSelectionNeeded: contract.role_selection_needed,
      topRoleMatches: contract.top_role_matches,
      extractionMethod: 'llm',
      sourceTrackId,
      sourceTitle: track.title,
      createdAt: contract.created_at,
    });

  } catch (error: any) {
    console.error('handleBuildScopeContract error:', error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
}

/**
 * Handler: Freeze Scope Contract Roles
 */
async function handleFreezeScopeContractRoles(contractId: string, req: Request): Promise<Response> {
  try {
    const { primaryRole, secondaryRoles } = await req.json();

    if (!primaryRole) {
      return jsonResponse({ error: "primaryRole is required" }, 400);
    }

    // Try to get org from token, fallback to contract's org
    let orgId = await getOrgIdFromToken(req);
    if (!orgId) {
      const { data: contract } = await supabase
        .from("variant_scope_contracts")
        .select("organization_id")
        .eq("id", contractId)
        .single();
      if (contract?.organization_id) {
        orgId = contract.organization_id;
      } else {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
    }

    // Fetch existing contract
    const { data: contract, error: fetchError } = await supabase
      .from('variant_scope_contracts')
      .select('*')
      .eq('id', contractId)
      .eq('organization_id', orgId)
      .single();

    if (fetchError || !contract) {
      return jsonResponse({ error: "Scope contract not found" }, 404);
    }

    // Update the scope contract with frozen roles
    const updatedScopeContract = {
      ...contract.scope_contract,
      primaryRole,
      secondaryRoles: secondaryRoles || [],
    };

    const { error: updateError } = await supabase
      .from('variant_scope_contracts')
      .update({
        scope_contract: updatedScopeContract,
        role_selection_needed: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractId)
      .eq('organization_id', orgId);

    if (updateError) {
      console.error('Error updating scope contract:', updateError);
      return jsonResponse({ error: "Failed to freeze roles" }, 500);
    }

    return jsonResponse({
      contractId,
      scopeContract: updatedScopeContract,
      roleSelectionNeeded: false,
    });

  } catch (error: any) {
    console.error('handleFreezeScopeContractRoles error:', error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
}

/**
 * Handler: Get Scope Contract
 */
async function handleGetScopeContract(contractId: string, req: Request): Promise<Response> {
  try {
    const orgId = await getOrgIdFromToken(req);
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: contract, error } = await supabase
      .from('variant_scope_contracts')
      .select('*')
      .eq('id', contractId)
      .eq('organization_id', orgId)
      .single();

    if (error || !contract) {
      return jsonResponse({ error: "Scope contract not found" }, 404);
    }

    return jsonResponse({
      contractId: contract.id,
      scopeContract: contract.scope_contract,
      roleSelectionNeeded: contract.role_selection_needed,
      topRoleMatches: contract.top_role_matches,
      extractionMethod: contract.extraction_method,
      createdAt: contract.created_at,
    });

  } catch (error: any) {
    console.error('handleGetScopeContract error:', error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
}

/**
 * Handler: Build Research Plan
 */
async function handleBuildResearchPlan(req: Request): Promise<Response> {
  try {
    const { contractId, stateCode, stateName, useLLM } = await req.json();

    if (!contractId || !stateCode) {
      return jsonResponse({ error: "contractId and stateCode are required" }, 400);
    }

    const orgId = await getOrgIdFromToken(req);
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Fetch the scope contract
    const { data: contract, error: contractError } = await supabase
      .from('variant_scope_contracts')
      .select('*')
      .eq('id', contractId)
      .eq('organization_id', orgId)
      .single();

    if (contractError || !contract) {
      return jsonResponse({ error: "Scope contract not found" }, 404);
    }

    // Build research queries from scope contract
    const scopeContract = contract.scope_contract;
    const queries = (scopeContract.allowedLearnerActions || []).map((action: string, index: number) => ({
      id: `q${index + 1}`,
      query: `${stateCode} ${action} regulations requirements`,
      mappedAction: action,
      anchorTerms: [stateCode, stateName || '', action],
      negativeTerms: [],
      targetType: 'statute',
      why: `Find state-specific requirements for: ${action}`,
    }));

    const researchPlan = {
      id: crypto.randomUUID(),
      stateCode,
      stateName: stateName || stateCode,
      generatedAtISO: new Date().toISOString(),
      contractId,
      primaryRole: scopeContract.primaryRole,
      queries,
      globalNegativeTerms: [],
      sourcePolicy: {
        preferTier1: true,
        allowTier2Justia: true,
        forbidTier3ForStrongClaims: true,
      },
    };

    // Insert into database
    const { data: plan, error: insertError } = await supabase
      .from('variant_research_plans')
      .insert({
        organization_id: orgId,
        contract_id: contractId,
        state_code: stateCode,
        state_name: stateName || stateCode,
        research_plan: researchPlan,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting research plan:', insertError);
      return jsonResponse({ error: "Failed to create research plan" }, 500);
    }

    return jsonResponse({
      planId: plan.id,
      researchPlan,
      queryCount: queries.length,
      globalNegativeCount: 0,
    });

  } catch (error: any) {
    console.error('handleBuildResearchPlan error:', error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
}

/**
 * Handler: Get Research Plan
 */
async function handleGetResearchPlan(planId: string, req: Request): Promise<Response> {
  try {
    const orgId = await getOrgIdFromToken(req);
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: plan, error } = await supabase
      .from('variant_research_plans')
      .select('*')
      .eq('id', planId)
      .eq('organization_id', orgId)
      .single();

    if (error || !plan) {
      return jsonResponse({ error: "Research plan not found" }, 404);
    }

    return jsonResponse({
      planId: plan.id,
      researchPlan: plan.research_plan,
      createdAt: plan.created_at,
    });

  } catch (error: any) {
    console.error('handleGetResearchPlan error:', error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
}

/**
 * Handler: Retrieve Evidence (Stub - returns empty evidence)
 */
async function handleRetrieveEvidence(req: Request): Promise<Response> {
  try {
    const { planId, contractId } = await req.json();

    if (!planId || !contractId) {
      return jsonResponse({ error: "planId and contractId are required" }, 400);
    }

    // For now, return empty evidence (stub implementation)
    // In production, this would perform web searches using the research plan queries
    return jsonResponse({
      planId,
      evidenceCount: 0,
      rejectedCount: 0,
      evidence: [],
      rejected: [],
      note: "Evidence retrieval not yet implemented - returning empty results",
    });

  } catch (error: any) {
    console.error('handleRetrieveEvidence error:', error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
}

/**
 * Handler: Extract Key Facts (Stub - returns PASS status with no facts)
 */
async function handleExtractKeyFacts(req: Request): Promise<Response> {
  try {
    const { contractId, planId, evidenceBlocks, stateCode, stateName } = await req.json();

    if (!contractId || !planId || !stateCode) {
      return jsonResponse({ error: "contractId, planId, and stateCode are required" }, 400);
    }

    const orgId = await getOrgIdFromToken(req);
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Stub: Create empty extraction that passes QA
    const extraction = {
      extraction_id: crypto.randomUUID(),
      overall_status: 'PASS',
      key_facts_count: 0,
      rejected_facts_count: 0,
      key_facts: [],
      rejected_facts: [],
      gate_results: [
        {
          gate: 'G1',
          gateName: 'Evidence Quality',
          status: 'PASS',
          reason: 'No evidence to validate (stub implementation)',
        }
      ],
      extraction_method: 'fallback',
    };

    // Insert into database
    const { data: record, error: insertError } = await supabase
      .from('variant_key_facts')
      .insert({
        organization_id: orgId,
        contract_id: contractId,
        plan_id: planId,
        state_code: stateCode,
        state_name: stateName || stateCode,
        overall_status: 'PASS',
        key_facts_count: 0,
        rejected_facts_count: 0,
        key_facts: [],
        rejected_facts: [],
        gate_results: extraction.gate_results,
        extraction_method: 'fallback',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting key facts:', insertError);
      return jsonResponse({ error: "Failed to create key facts extraction" }, 500);
    }

    return jsonResponse({
      extractionId: record.id,
      ...extraction,
    });

  } catch (error: any) {
    console.error('handleExtractKeyFacts error:', error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
}

/**
 * Handler: Get Key Facts Extraction
 */
async function handleGetKeyFactsExtraction(extractionId: string, req: Request): Promise<Response> {
  try {
    const orgId = await getOrgIdFromToken(req);
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: extraction, error } = await supabase
      .from('variant_key_facts')
      .select('*')
      .eq('id', extractionId)
      .eq('organization_id', orgId)
      .single();

    if (error || !extraction) {
      return jsonResponse({ error: "Key facts extraction not found" }, 404);
    }

    return jsonResponse({
      extractionId: extraction.id,
      overallStatus: extraction.overall_status,
      keyFactsCount: extraction.key_facts_count,
      rejectedFactsCount: extraction.rejected_facts_count,
      keyFacts: extraction.key_facts || [],
      rejectedFacts: extraction.rejected_facts || [],
      gateResults: extraction.gate_results || [],
      extractionMethod: extraction.extraction_method,
      extractedAt: extraction.created_at,
    });

  } catch (error: any) {
    console.error('handleGetKeyFactsExtraction error:', error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
}

/**
 * Handler: Generate Draft
 */
async function handleGenerateDraft(req: Request): Promise<Response> {
  try {
    const {
      contractId,
      extractionId,
      sourceTrackId,
      stateCode,
      stateName,
      sourceContent,
      sourceTitle,
      trackType
    } = await req.json();

    if (!contractId || !extractionId || !sourceTrackId || !stateCode) {
      return jsonResponse({
        error: "contractId, extractionId, sourceTrackId, and stateCode are required"
      }, 400);
    }

    const orgId = await getOrgIdFromToken(req);
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // For now, create a draft that's identical to source (stub implementation)
    // In production, this would use AI to generate state-specific adaptations
    const draft = {
      draft_id: crypto.randomUUID(),
      contract_id: contractId,
      extraction_id: extractionId,
      source_track_id: sourceTrackId,
      state_code: stateCode,
      state_name: stateName || stateCode,
      track_type: trackType,
      status: 'generated',
      draft_title: `${sourceTitle} - ${stateName || stateCode}`,
      draft_content: sourceContent,
      source_content: sourceContent,
      diff_ops: [],
      change_notes: [],
      applied_key_fact_ids: [],
      needs_review_key_fact_ids: [],
    };

    // Insert into database
    const { data: record, error: insertError } = await supabase
      .from('variant_drafts')
      .insert({
        organization_id: orgId,
        contract_id: contractId,
        extraction_id: extractionId,
        source_track_id: sourceTrackId,
        state_code: stateCode,
        state_name: stateName || stateCode,
        track_type: trackType,
        status: 'generated',
        draft_title: draft.draft_title,
        draft_content: draft.draft_content,
        source_content: draft.source_content,
        diff_ops: [],
        change_notes: [],
        applied_key_fact_ids: [],
        needs_review_key_fact_ids: [],
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting draft:', insertError);
      return jsonResponse({ error: "Failed to create draft" }, 500);
    }

    return jsonResponse({
      draft: {
        draftId: record.id,
        contractId: record.contract_id,
        extractionId: record.extraction_id,
        sourceTrackId: record.source_track_id,
        stateCode: record.state_code,
        stateName: record.state_name,
        trackType: record.track_type,
        status: record.status,
        draftTitle: record.draft_title,
        draftContent: record.draft_content,
        sourceContent: record.source_content,
        diffOps: record.diff_ops || [],
        changeNotes: record.change_notes || [],
        appliedKeyFactIds: record.applied_key_fact_ids || [],
        needsReviewKeyFactIds: record.needs_review_key_fact_ids || [],
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      },
      success: true,
      message: "Draft generated successfully (stub implementation - no state-specific changes yet)",
    });

  } catch (error: any) {
    console.error('handleGenerateDraft error:', error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
}

/**
 * Handler: Get Draft
 */
async function handleGetDraft(draftId: string, req: Request): Promise<Response> {
  try {
    const orgId = await getOrgIdFromToken(req);
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: draft, error } = await supabase
      .from('variant_drafts')
      .select('*')
      .eq('id', draftId)
      .eq('organization_id', orgId)
      .single();

    if (error || !draft) {
      return jsonResponse({ error: "Draft not found" }, 404);
    }

    return jsonResponse({
      draftId: draft.id,
      contractId: draft.contract_id,
      extractionId: draft.extraction_id,
      sourceTrackId: draft.source_track_id,
      stateCode: draft.state_code,
      stateName: draft.state_name,
      trackType: draft.track_type,
      status: draft.status,
      draftTitle: draft.draft_title,
      draftContent: draft.draft_content,
      sourceContent: draft.source_content,
      diffOps: draft.diff_ops || [],
      changeNotes: draft.change_notes || [],
      appliedKeyFactIds: draft.applied_key_fact_ids || [],
      needsReviewKeyFactIds: draft.needs_review_key_fact_ids || [],
      createdAt: draft.created_at,
      updatedAt: draft.updated_at,
    });

  } catch (error: any) {
    console.error('handleGetDraft error:', error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
}

/**
 * Handler: Apply Instructions (Stub - returns draft unchanged)
 */
async function handleApplyInstructions(draftId: string, req: Request): Promise<Response> {
  try {
    const { instruction } = await req.json();

    if (!instruction) {
      return jsonResponse({ error: "instruction is required" }, 400);
    }

    const orgId = await getOrgIdFromToken(req);
    if (!orgId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Fetch existing draft
    const { data: draft, error } = await supabase
      .from('variant_drafts')
      .select('*')
      .eq('id', draftId)
      .eq('organization_id', orgId)
      .single();

    if (error || !draft) {
      return jsonResponse({ error: "Draft not found" }, 404);
    }

    // Stub: Return draft unchanged
    return jsonResponse({
      draft: {
        draftId: draft.id,
        contractId: draft.contract_id,
        extractionId: draft.extraction_id,
        sourceTrackId: draft.source_track_id,
        stateCode: draft.state_code,
        stateName: draft.state_name,
        trackType: draft.track_type,
        status: draft.status,
        draftTitle: draft.draft_title,
        draftContent: draft.draft_content,
        sourceContent: draft.source_content,
        diffOps: draft.diff_ops || [],
        changeNotes: draft.change_notes || [],
        appliedKeyFactIds: draft.applied_key_fact_ids || [],
        needsReviewKeyFactIds: draft.needs_review_key_fact_ids || [],
        createdAt: draft.created_at,
        updatedAt: draft.updated_at,
      },
      success: true,
      changesApplied: 0,
      message: "Apply instructions not yet implemented (stub)",
    });

  } catch (error: any) {
    console.error('handleApplyInstructions error:', error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
}
