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
  const path = url.pathname.replace(/^\/trike-server/, ""); // Remove function name prefix
  const method = req.method;

  console.log(`[${method}] ${path}`);

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
    // 404 - Route not found
    // =========================================================================
    return jsonResponse({ error: "Not found", path }, 404);

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
