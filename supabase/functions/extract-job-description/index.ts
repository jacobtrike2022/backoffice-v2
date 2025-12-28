import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { extractTextFromPDF, cleanExtractedText } from "./pdf-parser.ts";
import { extractTextFromDOCX } from "./docx-parser.ts";
import { JOB_DESCRIPTION_SCHEMA, type ExtractedJobDescription } from "./schema.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ErrorResponse {
  error: string;
  details?: string;
}

/**
 * Extract text from uploaded file based on file type
 */
async function extractTextFromFile(
  fileData: Uint8Array,
  contentType: string
): Promise<string> {
  console.log('Extracting text from file, content type:', contentType);
  
  if (contentType.includes('pdf') || contentType.includes('application/pdf')) {
    return await extractTextFromPDF(fileData);
  } else if (
    contentType.includes('wordprocessingml') || 
    contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
    contentType.includes('application/msword')
  ) {
    return await extractTextFromDOCX(fileData);
  } else {
    throw new Error(`Unsupported file type: ${contentType}. Only PDF and DOCX are supported.`);
  }
}

/**
 * Call OpenAI GPT-4 with structured output to extract job description data
 */
async function extractJobDescriptionWithAI(
  jobDescriptionText: string
): Promise<ExtractedJobDescription> {
  console.log('Calling OpenAI for structured extraction...');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-2024-08-06', // GPT-4 with structured outputs
      messages: [
        {
          role: 'system',
          content: `You are an expert HR analyst specializing in job descriptions for convenience stores and foodservice operations. Extract structured data from job descriptions accurately.

Key guidelines:
- For convenience store roles: cashier, sales associate, store clerk are typically frontline (is_frontline=true, permission_level=1)
- Kitchen/food prep roles: frontline food service (is_frontline=true, permission_level=1-2)
- Assistant managers: may supervise but not full managers (is_manager=true, permission_level=2-3)
- Store managers: full management (is_manager=true, is_frontline=false, permission_level=3)
- District/regional managers: higher management (permission_level=4)
- Use standard occupation terms for O*NET keywords (e.g. "retail sales" not "selling stuff")`
        },
        {
          role: 'user',
          content: `Extract structured data from this job description:\n\n${jobDescriptionText}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "job_description_extraction",
          strict: true,
          schema: JOB_DESCRIPTION_SCHEMA
        }
      },
      temperature: 0.1, // Low temperature for consistency
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const extractedData = JSON.parse(data.choices[0].message.content);
  
  console.log('Extraction successful:', extractedData.role_name);
  return extractedData;
}

/**
 * Main request handler
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create Supabase client with user's auth token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('No file uploaded');
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    console.log('Processing file:', file.name, 'Type:', file.type, 'Size:', file.size);

    // Read file data
    const fileData = new Uint8Array(await file.arrayBuffer());

    // Extract text from file
    const rawText = await extractTextFromFile(fileData, file.type);
    const cleanedText = cleanExtractedText(rawText);

    console.log('Extracted text length:', cleanedText.length, 'characters');

    // Validate extracted text
    if (cleanedText.length < 100) {
      throw new Error('Extracted text too short. File may be empty or unreadable.');
    }

    // Extract structured data using OpenAI
    const extractedData = await extractJobDescriptionWithAI(cleanedText);

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );

  } catch (error) {
    console.error('Error in extract-job-description function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.stack
      } as ErrorResponse),
      {
        status: error.message.includes('Unauthorized') ? 401 : 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );
  }
});

