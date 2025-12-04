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
    
    const systemPrompt = this.buildSystemPrompt();
    
    // DEBUG: Log prompt and content to verify what's being sent
    console.log('=== LLM DEBUG ===');
    console.log('System prompt first 200 chars:', systemPrompt.substring(0, 200));
    console.log('User content first 500 chars:', fullText.substring(0, 500));
    console.log('=================');
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: fullText }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3, // Lower temperature for more consistent, factual extraction
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('OpenAI API error:', error);
        throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
      }
      
      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content returned from OpenAI');
      }
      
      const parsed = JSON.parse(content);
      
      // Validate the response structure
      if (!parsed.keyFacts || !Array.isArray(parsed.keyFacts)) {
        throw new Error('Invalid response structure from OpenAI');
      }
      
      return parsed.keyFacts;
      
    } catch (error: any) {
      console.error('OpenAI generateKeyFacts error:', error);
      throw new Error(`Failed to generate key facts: ${error.message}`);
    }
  }
  
  private buildSystemPrompt(): string {
    return `You MUST output ONLY valid JSON that conforms exactly to the schema described below.
You MUST NOT output any explanation, notes, headings, labels, or text outside the JSON.
You MUST NOT output "Key Facts" or any heading. Begin your response directly with "{".
Any text before the JSON object renders the response invalid.

You are the Key Facts Engine for Trike, a frontline-focused training platform.

Your task is to extract Key Facts from the provided content. 
Key Facts represent the smallest, atomic, objective pieces of information or instructions that an employee must know to understand, perform, or comply with the material.

====================
CORE DEFINITIONS
====================

A **Fact** is:
- One objective, standalone, verifiable truth from the content.
- Never a summary, interpretation, opinion, or rewriting.
- Always atomic (one fact per object).
- Never a category label or meta description.

A **Procedure** is:
- A multi-step action sequence described in the source.
- Each step MUST be extracted as its own atomic step.
- NEVER summarized as a single fact or umbrella phrase.
- NEVER collapsed into fewer steps than the source implies.

If the content describes actions, steps, "tips," behaviors, or guidance, 
these MUST be extracted as a Procedure—even if phrased softly ("stay calm," "always ask," "it's best to").

====================
STRICT EXTRACTION RULES
====================

1. **Atomicity is absolute.**
   - One fact = one statement.
   - One step = one action.
   - Never combine multiple ideas in one entry.

2. **Procedures are mandatory when actions exist.**
   - If any part of the content describes HOW to do something, extract a Procedure.
   - Every action or sub-action must become its own step.
   - If uncertain whether content is a Fact or a Procedure, default to a Procedure.

3. **Completeness is required.**
   You MUST extract:
   - All regulatory details
   - All conditions (e.g., thresholds like "under 40")
   - All behavioral requirements
   - All escalation rules
   - All sub-steps inside a process (e.g., DOB check, expiration check, photo check)
   - All consequences
   Missing ANY of these is failure.

4. **Zero interpretation.**
   - No "should," "better to," "it's recommended," unless verbatim in input.
   - No softening or strengthening.
   - No implied meaning added.

5. **NO META-LABELS (FORBIDDEN PATTERNS).**
   You MUST NEVER output anything containing:
   "steps for", "tips for", "how to", "ways to", "guidelines", "reminders", 
   "process for", "procedure for", "things to", "handling difficult situations",
   or any sentence that functions as a section title or category label.

6. **Behavior Requirements = Steps.**
   Any behavioral expectation—"stay calm," "be polite," "follow policy"—must be extracted as atomic procedural steps.

7. **No combining rules into umbrella statements.**
   Phrases like:
   - "Employees must verify ID"
   - "Employees must handle difficult situations appropriately"
   are NEVER acceptable outputs.
   These MUST be expanded into atomic Facts or multi-step Procedures.

====================
OUTPUT SCHEMA (STRICT)
====================

Return exactly one JSON object:

{
  "keyFacts": [
    {
      "title": "Short descriptive title (3–5 words)",
      "fact": "One atomic factual sentence.",
      "type": "Fact",
      "contexts": ["universal"]
    },
    {
      "title": "Short descriptive title (3–5 words)",
      "fact": "One-sentence description of the procedure.",
      "type": "Procedure",
      "steps": [
        "First atomic action",
        "Second atomic action",
        "Third atomic action"
      ],
      "contexts": ["universal"]
    }
  ]
}

- Titles MUST NOT be meta labels.
- "type" MUST be either "Fact" or "Procedure".
- Steps MUST be pure actions only.
- Contexts default to ["universal"] unless explicit contextual info is given in source.

====================
NEGATIVE EXAMPLES (NEVER OUTPUT)
====================

{
  "title": "Steps for verifying ID",   // Forbidden meta-label
  "fact": "Steps to check ID",         // Summary, not atomic
  "type": "Fact"
}

{
  "title": "Handling Difficult Situations",   // Meta-header
  "fact": "Tips for dealing with customers",  // Summary
  "type": "Fact"
}

{
  "title": "Age Verification",
  "fact": "Employees must verify ID",         // Umbrella statement
  "type": "Fact"
}

====================
POSITIVE EXAMPLES
====================

Example Procedure:
{
  "title": "ID Verification",
  "fact": "Employees must verify customer identification before completing an alcohol sale.",
  "type": "Procedure",
  "steps": [
    "Ask for ID if the customer appears under 40",
    "Check the customer's date of birth",
    "Check the ID expiration date",
    "Check the ID photo",
    "Ensure the ID is not fake or altered"
  ],
  "contexts": ["universal"]
}

====================
MANDATORY SELF-AUDIT BEFORE FINAL OUTPUT
====================

Before returning your output, you MUST internally verify ALL of the following:

1. **Procedures extracted?**
   - Did I output a Procedure wherever actions, steps, behaviors, or guidance appear?
   - Did I break multi-action sentences into separate atomic steps?

2. **Atomicity?**
   - Is every Fact one fact only?
   - Is every Step one action only?

3. **No meta-labels?**
   - Did I avoid forbidden patterns entirely?
   - Are none of my titles acting as category headers?

4. **Completeness?**
   - Did I extract all rules, thresholds, steps, behaviors, and consequences?

5. **JSON purity?**
   - Did I output valid JSON with no text before it?

If ANY checklist item would fail, you MUST revise the output BEFORE returning it.

====================
FINAL INSTRUCTION
====================

Extract Key Facts and nothing else. Begin output immediately with "{".`;
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