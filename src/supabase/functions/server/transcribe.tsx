import { Context } from 'npm:hono';
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Upload file to AssemblyAI
async function uploadToAssemblyAI(fileBuffer: Uint8Array): Promise<string> {
  const apiKey = Deno.env.get('ASSEMBLYAI_API_KEY');
  
  if (!apiKey) {
    throw new Error('ASSEMBLYAI_API_KEY environment variable is not set');
  }

  console.log('Uploading file to AssemblyAI...');

  const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
    },
    body: fileBuffer,
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`AssemblyAI upload error: ${error}`);
  }

  const { upload_url } = await uploadResponse.json();
  console.log('File uploaded to AssemblyAI successfully');
  return upload_url;
}

// AssemblyAI transcription helper
export async function transcribeVideo(audioUrl: string) {
  const apiKey = Deno.env.get('ASSEMBLYAI_API_KEY');
  
  if (!apiKey) {
    throw new Error('ASSEMBLYAI_API_KEY environment variable is not set');
  }

  console.log('Starting transcription for:', audioUrl);

  // Check if this is a signed URL (has token parameter) - AssemblyAI can access these directly
  const urlObj = new URL(audioUrl);
  const hasToken = urlObj.searchParams.has('token');
  
  let uploadUrl: string;
  
  if (hasToken) {
    // Signed URL - AssemblyAI can access it directly
    console.log('Using signed URL directly (has token)');
    uploadUrl = audioUrl;
  } else {
    // Not a signed URL - need to download and re-upload to AssemblyAI
    console.log('Downloading file to re-upload (no token)');
    
    try {
      // Extract bucket and path from the URL
      // URL format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
      const pathParts = urlObj.pathname.split('/');
      const bucketIndex = pathParts.findIndex(part => part === 'sign' || part === 'public') + 1;
      
      if (bucketIndex === 0) {
        throw new Error(`Invalid storage URL format: ${audioUrl}`);
      }
      
      const bucket = pathParts[bucketIndex];
      const filePath = pathParts.slice(bucketIndex + 1).join('/');
      
      console.log('Downloading from Supabase Storage:', { bucket, filePath });
      
      // Download the file using service role
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(bucket)
        .download(filePath);
      
      if (downloadError || !fileData) {
        console.error('Storage download error details:', { 
          error: downloadError, 
          errorMessage: downloadError?.message,
          errorStringified: JSON.stringify(downloadError),
          bucket, 
          filePath,
          hasData: !!fileData 
        });
        throw new Error(`Failed to download file from storage. Bucket: ${bucket}, Path: ${filePath}, Error: ${JSON.stringify(downloadError) || 'No data returned'}`);
      }
      
      console.log('File downloaded, size:', fileData.size);
      
      // Convert blob to buffer
      const arrayBuffer = await fileData.arrayBuffer();
      const fileBuffer = new Uint8Array(arrayBuffer);
      
      // Upload to AssemblyAI
      uploadUrl = await uploadToAssemblyAI(fileBuffer);
      
    } catch (error: any) {
      console.error('Error downloading file:', error);
      throw new Error(`Failed to process file: ${error.message}`);
    }
  }

  // Step 1: Submit transcription request with the uploaded file
  const response = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: uploadUrl,
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