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
  // might still include the function name, so we remove it if present
  let path = url.pathname;
  if (path.startsWith("/trike-server")) {
    path = path.replace(/^\/trike-server/, "");
  }
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
        "DELETE /track-relationships/:relationshipId",
        "GET /track-versions/:trackId",
        "POST /brain/embed",
        "POST /brain/remove",
        "POST /brain/chat",
        "POST /brain/search",
        "GET /brain/stats",
        "POST /brain/backfill"
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
  reasoning: string;
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
   - Brief reasoning

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
      "reasoning": "Why this new tag is needed"
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
          reasoning: suggestion.reasoning,
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
