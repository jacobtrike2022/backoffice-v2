import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const ttsApp = new Hono();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

const BUCKET_NAME = 'make-2858cc8b-tts-audio';

// Track bucket initialization status
let ttsBucketInitialized = false;

// Initialize TTS audio storage bucket
async function ensureTTSBucket() {
  if (ttsBucketInitialized) return true;
  
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return false;
    }
    
    const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
    
    if (!bucketExists) {
      console.log('Creating TTS audio bucket:', BUCKET_NAME);
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true, // Public bucket for audio playback
        fileSizeLimit: 10485760, // 10MB max
      });
      
      if (createError && !createError.message?.includes('already exists')) {
        console.error('Error creating TTS bucket:', createError);
        return false;
      }
    }
    
    ttsBucketInitialized = true;
    return true;
  } catch (error) {
    console.error('Error ensuring TTS bucket:', error);
    return false;
  }
}

// Strip markdown/HTML from text for TTS
function stripMarkdown(markdown: string): string {
  if (!markdown) return '';
  
  return markdown
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove headers
    .replace(/#{1,6}\s+/g, '')
    // Remove bold/italic
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Remove links, keep text
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    // Remove images
    .replace(/!\[.*?\]\(.+?\)/g, '')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`(.+?)`/g, '$1')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove list markers
    .replace(/^[\*\-\+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Normalize whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Calculate SHA-256 hash of content
async function calculateHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// POST /tts/generate - Generate TTS audio for an article
ttsApp.post('/generate', async (c) => {
  try {
    const { trackId, voice = 'alloy', forceRegenerate = false } = await c.req.json();
    
    if (!trackId) {
      return c.json({ error: 'trackId is required' }, 400);
    }

    console.log('🎙️ TTS generation requested:', { trackId, voice, forceRegenerate });

    // Ensure bucket exists
    const bucketReady = await ensureTTSBucket();
    if (!bucketReady) {
      return c.json({ error: 'Failed to initialize TTS storage' }, 500);
    }

    // Fetch track
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('*')
      .eq('id', trackId)
      .single();

    if (trackError || !track) {
      console.error('Track not found:', trackError);
      return c.json({ error: 'Track not found' }, 404);
    }

    if (track.type !== 'article') {
      return c.json({ error: 'TTS only available for articles' }, 400);
    }

    // Extract text content from article
    const articleContent = track.transcript || track.description || '';
    const textContent = stripMarkdown(articleContent);

    if (!textContent || textContent.length < 10) {
      return c.json({ error: 'Article content too short for TTS' }, 400);
    }

    console.log('📝 Text content extracted:', {
      originalLength: articleContent.length,
      strippedLength: textContent.length,
      preview: textContent.substring(0, 100) + '...'
    });

    // Calculate content hash
    const contentHash = await calculateHash(textContent);

    // Get existing TTS metadata from KV store
    const ttsMetadataKey = `tts:${trackId}`;
    const existingMetadata = await kv.get(ttsMetadataKey);

    // Check if regeneration needed
    if (!forceRegenerate && 
        existingMetadata &&
        existingMetadata.contentHash === contentHash && 
        existingMetadata.voice === voice && 
        existingMetadata.audioUrl) {
      console.log('✅ Using existing TTS audio (content unchanged)');
      return c.json({ 
        audioUrl: existingMetadata.audioUrl,
        voice: existingMetadata.voice,
        generatedAt: existingMetadata.generatedAt,
        cached: true
      });
    }

    // Call OpenAI TTS API
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return c.json({ error: 'TTS service not configured' }, 500);
    }

    console.log('🤖 Calling OpenAI TTS API...');
    const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1', // Use tts-1-hd for higher quality if needed
        input: textContent,
        voice: voice,
        response_format: 'mp3'
      })
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('OpenAI TTS API error:', errorText);
      return c.json({ error: 'Failed to generate audio' }, 500);
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    console.log('✅ Audio generated:', {
      size: audioBuffer.byteLength,
      voice: voice
    });

    // Upload to Supabase Storage
    const fileName = `${trackId}_${Date.now()}.mp3`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading audio:', uploadError);
      return c.json({ error: 'Failed to upload audio' }, 500);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    console.log('✅ Audio uploaded to storage:', publicUrl);

    // Store TTS metadata in KV store
    const newMetadata = {
      contentHash: contentHash,
      voice: voice,
      audioUrl: publicUrl,
      generatedAt: new Date().toISOString()
    };
    await kv.set(ttsMetadataKey, newMetadata);

    return c.json({
      audioUrl: publicUrl,
      voice: voice,
      generatedAt: new Date().toISOString(),
      cached: false
    });

  } catch (error: any) {
    console.error('❌ Error generating TTS:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// GET /tts/status/:trackId - Check TTS status for a track
ttsApp.get('/status/:trackId', async (c) => {
  try {
    const trackId = c.req.param('trackId');

    // Check track type
    const { data: track, error } = await supabase
      .from('tracks')
      .select('type')
      .eq('id', trackId)
      .single();

    if (error || !track) {
      return c.json({ error: 'Track not found' }, 404);
    }

    if (track.type !== 'article') {
      return c.json({ available: false, reason: 'Not an article' });
    }

    // Get TTS metadata from KV store
    const ttsMetadataKey = `tts:${trackId}`;
    const metadata = await kv.get(ttsMetadataKey);

    return c.json({
      available: !!metadata?.audioUrl,
      audioUrl: metadata?.audioUrl,
      voice: metadata?.voice,
      generatedAt: metadata?.generatedAt
    });

  } catch (error: any) {
    console.error('Error checking TTS status:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default ttsApp;