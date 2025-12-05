/**
 * TranscriptService: Manages transcript caching and deduplication
 * 
 * Purpose:
 * - Cache transcripts by media URL to avoid re-transcription
 * - Track usage across multiple tracks
 * - Provide consistent transcripts for same media
 * - Reduce API costs by 70-90%
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createHash } from 'node:crypto';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

export interface MediaTranscript {
  id: string;
  media_url: string;
  media_url_hash: string;
  media_type: 'video' | 'audio';
  transcript_text: string;
  transcript_json: any;
  transcript_utterances?: any;
  duration_seconds?: number;
  word_count?: number;
  language?: string;
  confidence_score?: number;
  transcribed_at: string;
  transcription_service: string;
  transcription_model?: string;
  used_in_tracks: string[];
  usage_count: number;
  last_used_at: string;
  needs_review: boolean;
  created_at: string;
  updated_at: string;
  cached?: boolean; // Client-side flag
}

export interface TranscriptResult {
  transcript: MediaTranscript;
  cached: boolean;
  message?: string;
}

/**
 * Get or create a transcript for a media URL
 * Checks cache first, transcribes if needed
 */
export async function getOrCreateTranscript(
  mediaUrl: string,
  mediaType: 'video' | 'audio',
  trackId: string,
  forceRefresh: boolean = false
): Promise<TranscriptResult> {
  const urlHash = hashMediaUrl(mediaUrl);
  
  console.log(`🔍 Looking up transcript for: ${mediaUrl.substring(0, 50)}...`);
  console.log(`   Hash: ${urlHash}, Force refresh: ${forceRefresh}`);
  
  // Check cache unless force refresh
  if (!forceRefresh) {
    const { data: existing, error } = await supabase
      .from('media_transcripts')
      .select('*')
      .eq('media_url_hash', urlHash)
      .single();
    
    if (existing && !error) {
      console.log(`✅ Found cached transcript (ID: ${existing.id})`);
      console.log(`   Previously used ${existing.usage_count} times`);
      
      // Update usage tracking
      const updatedTracks = Array.from(new Set([...(existing.used_in_tracks || []), trackId]));
      
      await supabase
        .from('media_transcripts')
        .update({
          usage_count: existing.usage_count + 1,
          last_used_at: new Date().toISOString(),
          used_in_tracks: updatedTracks,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      
      return {
        transcript: { ...existing, cached: true },
        cached: true,
        message: `Using cached transcript (previously used ${existing.usage_count} times)`
      };
    }
  }
  
  // Not cached or force refresh - need to transcribe
  console.log(`🎙️ Transcribing media (not in cache)...`);
  
  // Import transcription service
  const { transcribeVideo } = await import('./transcribe.tsx');
  const transcriptData = await transcribeVideo(mediaUrl);
  
  console.log(`✅ Transcription complete`);
  console.log(`   Duration: ${transcriptData.duration}ms`);
  console.log(`   Text length: ${transcriptData.text?.length || 0} characters`);
  
  // Calculate metadata
  const wordCount = transcriptData.text?.split(/\s+/).length || 0;
  const durationSeconds = transcriptData.duration ? Math.floor(transcriptData.duration / 1000) : null;
  
  // Save to database
  const { data: newTranscript, error: insertError } = await supabase
    .from('media_transcripts')
    .insert({
      media_url: mediaUrl,
      media_url_hash: urlHash,
      media_type: mediaType,
      transcript_text: transcriptData.text || '',
      transcript_json: transcriptData,
      duration_seconds: durationSeconds,
      word_count: wordCount,
      language: 'en', // TODO: Detect language from transcript
      confidence_score: transcriptData.confidence || null,
      transcription_service: 'assemblyai',
      used_in_tracks: [trackId],
      usage_count: 1
    })
    .select()
    .single();
  
  if (insertError) {
    console.error('❌ Error saving transcript to database:', insertError);
    throw new Error(`Failed to save transcript: ${insertError.message}`);
  }
  
  console.log(`💾 Saved new transcript to database (ID: ${newTranscript.id})`);
  
  return {
    transcript: { ...newTranscript, cached: false },
    cached: false,
    message: 'Newly transcribed and cached'
  };
}

/**
 * Get transcript by ID
 */
export async function getTranscriptById(transcriptId: string): Promise<MediaTranscript | null> {
  const { data, error } = await supabase
    .from('media_transcripts')
    .select('*')
    .eq('id', transcriptId)
    .single();
  
  if (error) {
    console.error('Error fetching transcript:', error);
    return null;
  }
  
  return data;
}

/**
 * Get transcript by media URL
 */
export async function getTranscriptByUrl(mediaUrl: string): Promise<MediaTranscript | null> {
  const urlHash = hashMediaUrl(mediaUrl);
  
  const { data, error } = await supabase
    .from('media_transcripts')
    .select('*')
    .eq('media_url_hash', urlHash)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      // Not found - this is expected
      return null;
    }
    console.error('Error fetching transcript by URL:', error);
    return null;
  }
  
  return data;
}

/**
 * Update transcript (manual corrections)
 */
export async function updateTranscript(
  transcriptId: string,
  updates: {
    transcript_text?: string;
    manual_corrections?: string;
    needs_review?: boolean;
    reviewed_by?: string;
  }
): Promise<MediaTranscript | null> {
  const { data, error } = await supabase
    .from('media_transcripts')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
      reviewed_at: updates.reviewed_by ? new Date().toISOString() : undefined
    })
    .eq('id', transcriptId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating transcript:', error);
    return null;
  }
  
  return data;
}

/**
 * Get all transcripts used by a track
 */
export async function getTranscriptsForTrack(trackId: string): Promise<MediaTranscript[]> {
  const { data, error } = await supabase
    .from('media_transcripts')
    .select('*')
    .contains('used_in_tracks', [trackId]);
  
  if (error) {
    console.error('Error fetching transcripts for track:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Get usage statistics
 */
export async function getTranscriptStats() {
  const { data: transcripts } = await supabase
    .from('media_transcripts')
    .select('usage_count, created_at, word_count');
  
  if (!transcripts) return null;
  
  const totalTranscripts = transcripts.length;
  const totalUsages = transcripts.reduce((sum, t) => sum + (t.usage_count || 0), 0);
  const totalWords = transcripts.reduce((sum, t) => sum + (t.word_count || 0), 0);
  const avgReuse = totalUsages / totalTranscripts;
  const cacheHitRate = ((totalUsages - totalTranscripts) / totalUsages * 100).toFixed(1);
  
  return {
    totalTranscripts,
    totalUsages,
    totalWords,
    avgReusePerTranscript: avgReuse.toFixed(2),
    cacheHitRate: `${cacheHitRate}%`,
    estimatedCostSavings: `${((avgReuse - 1) / avgReuse * 100).toFixed(1)}%`
  };
}

/**
 * Hash media URL for consistent lookups
 * Uses SHA-256 to handle long URLs and normalize
 */
function hashMediaUrl(url: string): string {
  return createHash('sha256').update(url.trim()).digest('hex');
}

/**
 * Batch transcribe multiple media URLs (for stories)
 */
export async function batchTranscribe(
  mediaItems: Array<{
    url: string;
    type: 'video' | 'audio';
    id: string;
    name?: string;
  }>,
  trackId: string,
  forceRefresh: boolean = false
): Promise<{
  transcripts: Array<{
    mediaId: string;
    mediaName?: string;
    mediaUrl: string;
    transcriptId: string;
    transcript: MediaTranscript;
    cached: boolean;
  }>;
  stats: {
    total: number;
    cached: number;
    newlyTranscribed: number;
    failed: number;
  };
}> {
  console.log(`📦 Batch transcribing ${mediaItems.length} media items...`);
  
  const results = [];
  const stats = {
    total: mediaItems.length,
    cached: 0,
    newlyTranscribed: 0,
    failed: 0
  };
  
  for (const item of mediaItems) {
    try {
      const result = await getOrCreateTranscript(
        item.url,
        item.type,
        trackId,
        forceRefresh
      );
      
      if (result.cached) {
        stats.cached++;
      } else {
        stats.newlyTranscribed++;
      }
      
      results.push({
        mediaId: item.id,
        mediaName: item.name,
        mediaUrl: item.url,
        transcriptId: result.transcript.id,
        transcript: result.transcript,
        cached: result.cached
      });
      
    } catch (error: any) {
      console.error(`❌ Failed to transcribe ${item.url}:`, error);
      stats.failed++;
      
      // Continue with other items instead of failing entire batch
      results.push({
        mediaId: item.id,
        mediaName: item.name,
        mediaUrl: item.url,
        transcriptId: '',
        transcript: null as any,
        cached: false,
        error: error.message
      });
    }
  }
  
  console.log(`✅ Batch transcription complete:`);
  console.log(`   Total: ${stats.total}`);
  console.log(`   Cached: ${stats.cached}`);
  console.log(`   Newly transcribed: ${stats.newlyTranscribed}`);
  console.log(`   Failed: ${stats.failed}`);
  
  return { transcripts: results, stats };
}
