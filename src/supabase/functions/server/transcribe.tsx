import { Context } from 'npm:hono';

// AssemblyAI transcription helper
export async function transcribeVideo(audioUrl: string) {
  const apiKey = Deno.env.get('ASSEMBLYAI_API_KEY');
  
  if (!apiKey) {
    throw new Error('ASSEMBLYAI_API_KEY environment variable is not set');
  }

  console.log('Starting transcription for:', audioUrl);

  // Step 1: Submit transcription request
  const response = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      speaker_labels: true, // Enable speaker diarization
      format_text: true, // Better formatting
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AssemblyAI API error: ${error}`);
  }

  const { id } = await response.json();
  console.log('Transcription job submitted:', id);

  // Step 2: Poll for completion
  let transcript;
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

    const pollingResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: {
        'Authorization': apiKey,
      },
    });

    transcript = await pollingResponse.json();
    console.log('Transcription status:', transcript.status);

    if (transcript.status === 'completed') {
      break;
    } else if (transcript.status === 'error') {
      throw new Error(`Transcription failed: ${transcript.error}`);
    }
  }

  console.log('Transcription completed successfully');

  // Step 3: Format the transcript data
  return {
    text: transcript.text,
    words: transcript.words || [],
    utterances: transcript.utterances || [],
    confidence: transcript.confidence,
    audio_duration: transcript.audio_duration,
  };
}

// Handle transcription endpoint
export async function handleTranscribeRequest(c: Context) {
  try {
    const body = await c.req.json();
    const { audioUrl } = body;

    if (!audioUrl) {
      return c.json({ error: 'audioUrl is required' }, 400);
    }

    console.log('Transcription request received for:', audioUrl);

    const transcriptData = await transcribeVideo(audioUrl);

    return c.json({
      success: true,
      transcript: transcriptData,
    });
  } catch (error: any) {
    console.error('Transcription error:', error);
    return c.json({ 
      error: `Transcription failed: ${error.message}` 
    }, 500);
  }
}
