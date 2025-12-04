/**
 * LLM Service - Provider-Agnostic AI Integration
 * 
 * Supports multiple LLM providers with easy switching via environment variables.
 * Current providers: OpenAI (default), Anthropic, Google Gemini
 * 
 * Future: Allow enterprise users to use their own API keys
 */

// =====================================================
// TYPES
// =====================================================

export interface KeyFact {
  title: string;
  fact: string;
  type: 'Fact' | 'Procedure';
  steps?: string[];
  contexts: string[];
}

export interface GenerateKeyFactsRequest {
  title: string;
  content: string;
  description?: string;
  transcript?: string;
}

export interface GenerateKeyFactsResponse {
  keyFacts: KeyFact[];
  enriched: KeyFact[];
  simple: string[];
}

// =====================================================
// LLM PROVIDER INTERFACE
// =====================================================

interface LLMProvider {
  generateKeyFacts(request: GenerateKeyFactsRequest): Promise<KeyFact[]>;
}

// =====================================================
// OPENAI PROVIDER
// =====================================================

class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  
  constructor() {
    const key = Deno.env.get('OPENAI_API_KEY');
    if (!key) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    this.apiKey = key;
  }
  
  async generateKeyFacts(request: GenerateKeyFactsRequest): Promise<KeyFact[]> {
    const { title, content, description, transcript } = request;
    
    // Combine all available text for analysis
    const fullText = [
      title && `Title: ${title}`,
      description && `Description: ${description}`,
      transcript && `Transcript: ${transcript}`,
      content && `Content: ${content}`,
    ].filter(Boolean).join('\n\n');
    
    // TWO-PASS EXTRACTION:
    // Pass 1: Force model to identify all procedural sections
    // Pass 2: Extract facts based on identified procedures
    
    const pass1Prompt = this.buildProcedureDetectionPrompt();
    const pass2Prompt = this.buildExtractionPrompt();
    
    console.log('=== LLM TWO-PASS EXTRACTION ===');
    console.log('Pass 1: Detecting procedures...');
    
    try {
      // PASS 1: Identify all procedural sections
      const pass1Response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: pass1Prompt },
            { role: 'user', content: fullText }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
      });
      
      if (!pass1Response.ok) {
        const error = await pass1Response.json();
        console.error('OpenAI API error (Pass 1):', error);
        throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
      }
      
      const pass1Data = await pass1Response.json();
      const pass1Content = pass1Data.choices[0]?.message?.content;
      
      if (!pass1Content) {
        throw new Error('No content returned from OpenAI (Pass 1)');
      }
      
      const procedureAnalysis = JSON.parse(pass1Content);
      console.log('Pass 1 complete. Found', procedureAnalysis.procedures?.length || 0, 'procedural sections');
      
      // PASS 2: Extract facts with procedure awareness
      const pass2Input = `SOURCE CONTENT:\n${fullText}\n\nPROCEDURE ANALYSIS:\n${JSON.stringify(procedureAnalysis, null, 2)}`;
      
      console.log('Pass 2: Extracting key facts...');
      
      const pass2Response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: pass2Prompt },
            { role: 'user', content: pass2Input }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
      });
      
      if (!pass2Response.ok) {
        const error = await pass2Response.json();
        console.error('OpenAI API error (Pass 2):', error);
        throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
      }
      
      const pass2Data = await pass2Response.json();
      const pass2Content = pass2Data.choices[0]?.message?.content;
      
      if (!pass2Content) {
        throw new Error('No content returned from OpenAI (Pass 2)');
      }
      
      const parsed = JSON.parse(pass2Content);
      
      // Validate the response structure
      if (!parsed.keyFacts || !Array.isArray(parsed.keyFacts)) {
        throw new Error('Invalid response structure from OpenAI');
      }
      
      console.log('Pass 2 complete. Extracted', parsed.keyFacts.length, 'key facts');
      
      return parsed.keyFacts;
      
    } catch (error: any) {
      console.error('OpenAI generateKeyFacts error:', error);
      throw new Error(`Failed to generate key facts: ${error.message}`);
    }
  }
  
  private buildProcedureDetectionPrompt(): string {
    return `You MUST output ONLY valid JSON. Begin your response directly with "{".

Your task: Identify ALL sections in the provided content that contain multi-step procedures, instructions, or action sequences.

Look for:
- Bullet points or numbered lists
- Sequential actions ("First...", "Then...", "Next...")
- Multiple imperative statements ("Check X. Verify Y. Ensure Z.")
- Any section describing HOW to do something step-by-step

For EACH procedural section found, extract:
1. A short title (3-5 words)
2. ALL steps, exactly as written in the source (preserve wording and details)

Output Schema:
{
  "procedures": [
    {
      "title": "Short Title Here",
      "steps": [
        "Exact step 1 from source",
        "Exact step 2 from source",
        "Exact step 3 from source"
      ]
    }
  ]
}

If NO procedural sections exist, output:
{
  "procedures": []
}

CRITICAL: Extract steps VERBATIM. Do not summarize or shorten them.

Begin output with "{".`;
  }
  
  private buildExtractionPrompt(): string {
    return `You MUST output ONLY valid JSON. Begin your response directly with "{".

You are the Key Facts Engine for Trike. Extract ALL Key Facts from the provided content.

You will receive:
1. SOURCE CONTENT - The original training content
2. PROCEDURE ANALYSIS - Pre-identified procedural sections with steps

EXTRACTION RULES:

1. **For Procedural Sections (identified in PROCEDURE ANALYSIS):**
   - Output each as type: "Procedure"
   - Use the title and steps from PROCEDURE ANALYSIS verbatim
   - Add a one-sentence "fact" field describing the procedure

2. **For Non-Procedural Content:**
   - Extract as type: "Fact"
   - Preserve ALL specific details (numbers, times, thresholds, examples)
   - One fact per statement
   - NEVER summarize multiple specifics into one fact

3. **Forbidden Patterns:**
   - NO umbrella statements ("Employees must verify..." unless that's literally all the source says)
   - NO summaries ("Certain behaviors..." - extract each behavior separately)
   - NO meta-labels ("steps for", "tips for", "how to")

Output Schema:
{
  "keyFacts": [
    {
      "title": "Short Title",
      "fact": "One atomic statement with all details preserved",
      "type": "Fact",
      "contexts": ["universal"]
    },
    {
      "title": "Procedure Title",
      "fact": "One-sentence description of this procedure",
      "type": "Procedure",
      "steps": ["Step 1", "Step 2", "Step 3"],
      "contexts": ["universal"]
    }
  ]
}

CRITICAL: If PROCEDURE ANALYSIS contains procedures, you MUST output them as Procedures (not Facts).

Begin output with "{".`;
  }
}

// =====================================================
// ANTHROPIC PROVIDER (Future)
// =====================================================

class AnthropicProvider implements LLMProvider {
  async generateKeyFacts(request: GenerateKeyFactsRequest): Promise<KeyFact[]> {
    throw new Error('Anthropic provider not yet implemented');
    // TODO: Implement when Anthropic support is needed
  }
}

// =====================================================
// PROVIDER FACTORY
// =====================================================

const providers: Record<string, new () => LLMProvider> = {
  'openai': OpenAIProvider,
  'anthropic': AnthropicProvider,
};

export function getProvider(providerName?: string): LLMProvider {
  const name = providerName || Deno.env.get('LLM_PROVIDER') || 'openai';
  
  const ProviderClass = providers[name];
  if (!ProviderClass) {
    throw new Error(`Unknown LLM provider: ${name}. Available: ${Object.keys(providers).join(', ')}`);
  }
  
  return new ProviderClass();
}

// =====================================================
// MAIN API FUNCTION
// =====================================================

export async function generateKeyFacts(
  request: GenerateKeyFactsRequest
): Promise<GenerateKeyFactsResponse> {
  const provider = getProvider();
  
  console.log('Generating key facts with provider:', provider.constructor.name);
  console.log('Content length:', request.content?.length || 0);
  
  const enriched = await provider.generateKeyFacts(request);
  
  // Also create simple string array for backward compatibility
  const simple = enriched.map(fact => fact.fact);
  
  console.log(`Generated ${enriched.length} key facts`);
  
  return {
    keyFacts: enriched,
    enriched,
    simple,
  };
}