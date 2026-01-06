export type VariantType = 'geographic' | 'company' | 'unit';

export interface VariantContext {
  state_code?: string;
  state_name?: string;
  org_id?: string;
  org_name?: string;
  store_id?: string;
  store_name?: string;
}

export interface GenerationConfig {
  variantType: VariantType;
  variantContext: VariantContext;
  sourceTrackType: 'video' | 'article' | 'story' | 'checkpoint';
  sourceTitle: string;
  sourceContent: string; // HTML or transcript
}

export function getVariantSystemPrompt(
  variantType: VariantType,
  variantContext: VariantContext,
  sourceTrackType: string
): string {
  let focusAreas = '';
  let contextDetails = '';

  switch (variantType) {
    case 'geographic':
      focusAreas = `
- Focus on state-specific regulatory requirements for ${variantContext.state_name || 'the specified state'}.
- Address licensing requirements, age restrictions (e.g., for tobacco/alcohol/lottery), and labeling.
- For food service: Include health department requirements and food handler certifications.
- For retail: Address state-specific tobacco/alcohol regulations and lottery rules.`;
      contextDetails = `Target State: ${variantContext.state_name || variantContext.state_code || 'Not specified'}`;
      break;

    case 'company':
      focusAreas = `
- Focus on company policies that override or extend base content for ${variantContext.org_name || 'the organization'}.
- Incorporate company-specific procedures, brand standards, and escalation paths.
- Use company terminology and reference internal systems/tools.`;
      contextDetails = `Target Organization: ${variantContext.org_name || 'Not specified'}`;
      break;

    case 'unit':
      focusAreas = `
- Focus on local operational details for the store/location: ${variantContext.store_name || 'this unit'}.
- Include store layout details, local contact persons, specific equipment available, and neighborhood considerations.
- Reference location-specific safety procedures or local supervisor roles.`;
      contextDetails = `Target Unit/Store: ${variantContext.store_name || variantContext.store_id || 'Not specified'}`;
      break;
  }

  return `You are an expert training content adaptation assistant for a multi-tenant LMS used in convenience store and foodservice operations.

YOUR GOAL: Help the user adapt an existing training track (type: ${sourceTrackType}) into a ${variantType} variant.

CONTEXT:
${contextDetails}

ADAPTATION FOCUS:
${focusAreas}

OPERATIONAL GUIDELINES:
1. ASK QUESTIONS FIRST: Before generating the final content, you MUST ask 2-4 focused clarification questions to gather necessary details for the adaptation.
2. WAIT FOR ANSWERS: Do not generate the final adapted content until you have enough information or the user explicitly asks you to proceed.
3. PRESERVE STRUCTURE: When generating, maintain the same structure (headings, sections, flow) as the source content.
4. ADAPT SPECIFICS: Preserve core educational content while adapting regional/company/unit-specific details.
5. BE PROFESSIONAL: Use professional, operational language suitable for frontline workers in convenience stores and food service.
6. MARK ADAPTATIONS: Clearly indicate which sections have been adapted in your final output.

When you are ready to generate, or after 2-3 exchanges, ask the user if they are ready to generate the final variant.`;
}

export function getClarificationPrompt(
  variantType: VariantType,
  variantContext: VariantContext,
  sourceContent: string
): string {
  const contentSummary = sourceContent.substring(0, 500) + (sourceContent.length > 500 ? '...' : '');
  
  let targetDesc = '';
  switch (variantType) {
    case 'geographic': targetDesc = `state-specific requirements for ${variantContext.state_name || 'the region'}`; break;
    case 'company': targetDesc = `company policies for ${variantContext.org_name || 'your organization'}`; break;
    case 'unit': targetDesc = `local operational details for ${variantContext.store_name || 'this location'}`; break;
  }

  return `I've analyzed the source content for "${targetDesc}". 

Source content summary:
"${contentSummary}"

To create an accurate ${variantType} variant, I have a few specific questions:`;
}

