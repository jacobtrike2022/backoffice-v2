// ============================================================================
// TRACK RELATIONSHIPS API ROUTES
// ============================================================================

import { Hono } from 'npm:hono';
import { streamText } from 'npm:hono/streaming';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as trackRel from './track-relationships.ts';
import { getVariantSystemPrompt, getClarificationPrompt } from '../../../lib/prompts/variantGeneration.ts';
import { streamChatCompletion, chatCompletion, type ChatMessage } from './utils/openai.ts';

const app = new Hono();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Helper to get org ID from access token
async function getOrgIdFromToken(accessToken: string | null): Promise<string | null> {
  if (!accessToken) return null;
  
  // Check if this is the public anon key (demo mode)
  const publicAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (accessToken === publicAnonKey) {
    // Demo mode: return default org ID
    console.log('🔓 Demo mode detected, using default org ID');
    return '10000000-0000-0000-0000-000000000001';
  }
  
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) return null;
  
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  
  return profile?.organization_id || null;
}

// ============================================================================
// CREATE RELATIONSHIP
// ============================================================================
app.post('/create', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);
    
    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { sourceTrackId, derivedTrackId, relationshipType } = await c.req.json();
    
    if (!sourceTrackId || !derivedTrackId) {
      return c.json({ error: 'sourceTrackId and derivedTrackId are required' }, 400);
    }

    const relationship = await trackRel.createTrackRelationship(
      orgId,
      sourceTrackId,
      derivedTrackId,
      relationshipType || 'source'
    );

    return c.json({ relationship });
  } catch (error: any) {
    console.error('Error creating track relationship:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// GET DERIVED TRACKS (children)
// ============================================================================
app.get('/derived/:trackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);
    
    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const trackId = c.req.param('trackId');
    const relationshipType = c.req.query('type') as 'source' | 'prerequisite' | 'related' | undefined;

    const derived = await trackRel.getDerivedTracks(orgId, trackId, relationshipType);

    return c.json({ derived });
  } catch (error: any) {
    console.error('Error fetching derived tracks:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// GET SOURCE TRACK (parent)
// ============================================================================
app.get('/source/:trackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);
    
    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const trackId = c.req.param('trackId');
    const relationshipType = c.req.query('type') as 'source' | 'prerequisite' | 'related' | undefined;

    const source = await trackRel.getSourceTrack(orgId, trackId, relationshipType);

    return c.json({ source });
  } catch (error: any) {
    console.error('Error fetching source track:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// GET RELATIONSHIP STATS
// ============================================================================
app.get('/stats/:trackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);
    
    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const trackId = c.req.param('trackId');

    const stats = await trackRel.getTrackRelationshipStats(orgId, trackId);

    return c.json({ stats });
  } catch (error: any) {
    console.error('Error fetching relationship stats:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// GET BATCH RELATIONSHIPS (for multiple tracks)
// ============================================================================
app.post('/batch', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);
    
    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { trackIds } = await c.req.json();
    
    if (!trackIds || !Array.isArray(trackIds)) {
      return c.json({ error: 'trackIds array is required' }, 400);
    }

    const relationships = await trackRel.getBatchTrackRelationships(orgId, trackIds);

    return c.json({ relationships });
  } catch (error: any) {
    console.error('Error fetching batch relationships:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// DELETE RELATIONSHIP
// ============================================================================
app.delete('/:relationshipId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const relationshipId = c.req.param('relationshipId');

    await trackRel.deleteTrackRelationship(orgId, relationshipId);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting track relationship:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// VARIANT RELATIONSHIP ROUTES
// ============================================================================

// CREATE VARIANT RELATIONSHIP
app.post('/variant/create', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { sourceTrackId, derivedTrackId, variantType, variantContext } = await c.req.json();

    if (!sourceTrackId || !derivedTrackId || !variantType) {
      return c.json({ error: 'sourceTrackId, derivedTrackId, and variantType are required' }, 400);
    }

    const relationship = await trackRel.createVariantRelationship(
      orgId,
      sourceTrackId,
      derivedTrackId,
      variantType,
      variantContext || {}
    );

    return c.json({ relationship });
  } catch (error: any) {
    console.error('Error creating variant relationship:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET TRACK VARIANTS
app.get('/variants/:trackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const trackId = c.req.param('trackId');
    const variantType = c.req.query('type') as 'geographic' | 'company' | 'unit' | undefined;

    const variants = await trackRel.getTrackVariants(orgId, trackId, variantType);

    return c.json({ variants });
  } catch (error: any) {
    console.error('Error fetching track variants:', error);
    return c.json({ error: error.message }, 500);
  }
});

// FIND VARIANT BY CONTEXT
app.get('/variant/find', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const sourceTrackId = c.req.query('sourceTrackId');
    const variantType = c.req.query('variantType') as 'geographic' | 'company' | 'unit';
    const contextKey = c.req.query('contextKey');
    const contextValue = c.req.query('contextValue');

    if (!sourceTrackId || !variantType || !contextKey || !contextValue) {
      return c.json({ error: 'sourceTrackId, variantType, contextKey, and contextValue are required' }, 400);
    }

    const variant = await trackRel.findVariantByContext(
      orgId,
      sourceTrackId,
      variantType,
      contextKey,
      contextValue
    );

    return c.json({ variant });
  } catch (error: any) {
    console.error('Error finding variant by context:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET BASE TRACK FOR VARIANT
app.get('/variant/base/:trackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const trackId = c.req.param('trackId');

    const baseTrack = await trackRel.getBaseTrackForVariant(orgId, trackId);

    return c.json({ baseTrack });
  } catch (error: any) {
    console.error('Error getting base track for variant:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET STATS WITH VARIANTS
app.get('/stats-with-variants/:trackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const trackId = c.req.param('trackId');

    const stats = await trackRel.getTrackRelationshipStatsWithVariants(orgId, trackId);

    return c.json({ stats });
  } catch (error: any) {
    console.error('Error fetching relationship stats with variants:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET FULL VARIANT TREE (all descendants)
app.get('/variant-tree/:trackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const trackId = c.req.param('trackId');

    const tree = await trackRel.getVariantTree(orgId, trackId);

    return c.json({ tree });
  } catch (error: any) {
    console.error('Error fetching variant tree:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET PARENT VARIANT (immediate parent)
app.get('/variant/parent/:trackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const trackId = c.req.param('trackId');

    const parentVariant = await trackRel.getParentVariant(orgId, trackId);

    return c.json({ parentVariant });
  } catch (error: any) {
    console.error('Error getting parent variant:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET VARIANTS NEEDING REVIEW
app.get('/variants/needs-review/:baseTrackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const baseTrackId = c.req.param('baseTrackId');

    const variantsNeedingReview = await trackRel.getVariantsNeedingReview(orgId, baseTrackId);

    return c.json({ variantsNeedingReview });
  } catch (error: any) {
    console.error('Error getting variants needing review:', error);
    return c.json({ error: error.message }, 500);
  }
});

// MARK VARIANT AS SYNCED
app.post('/variant/mark-synced/:relationshipId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const relationshipId = c.req.param('relationshipId');

    await trackRel.markVariantSynced(orgId, relationshipId);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error marking variant as synced:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET ULTIMATE BASE TRACK
app.get('/variant/ultimate-base/:trackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const trackId = c.req.param('trackId');

    const result = await trackRel.getUltimateBaseTrack(orgId, trackId);

    return c.json(result);
  } catch (error: any) {
    console.error('Error getting ultimate base track:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// AI-ASSISTED VARIANT GENERATION ROUTES
// ============================================================================

// POST /variant/chat
app.post('/variant/chat', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { sourceTrackId, variantType, variantContext, messages } = await c.req.json();

    if (!sourceTrackId || !variantType || !variantContext) {
      return c.json({ error: 'sourceTrackId, variantType, and variantContext are required' }, 400);
    }

    // Fetch source track content
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('title, type, content_text, transcript')
      .eq('id', sourceTrackId)
      .eq('organization_id', orgId)
      .single();

    if (trackError || !track) {
      return c.json({ error: 'Source track not found' }, 404);
    }

    const sourceContent = track.content_text || track.transcript || '';
    const systemPrompt = getVariantSystemPrompt(variantType, variantContext, track.type);

    let apiMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt }
    ];

    if (!messages || messages.length === 0) {
      // First message - use clarification prompt
      const firstMessage = getClarificationPrompt(variantType, variantContext, sourceContent);
      apiMessages.push({ role: 'user', content: firstMessage });
    } else {
      apiMessages = [...apiMessages, ...messages];
    }

    // Check if we should signal "ready to generate"
    const isReadyToGenerate = messages && messages.length >= 4; // After ~2 user responses

    return streamText(c, async (stream) => {
      const completion = streamChatCompletion(apiMessages, { temperature: 0.7 });
      
      for await (const chunk of completion) {
        await stream.write(chunk);
      }

      if (isReadyToGenerate) {
        await stream.write('\n\n[READY_TO_GENERATE]');
      }
    });
  } catch (error: any) {
    console.error('Error in /variant/chat:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /variant/generate
app.post('/variant/generate', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { sourceTrackId, variantType, variantContext, clarificationAnswers } = await c.req.json();

    if (!sourceTrackId || !variantType || !variantContext) {
      return c.json({ error: 'sourceTrackId, variantType, and variantContext are required' }, 400);
    }

    // Fetch source track content
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('*')
      .eq('id', sourceTrackId)
      .eq('organization_id', orgId)
      .single();

    if (trackError || !track) {
      return c.json({ error: 'Source track not found' }, 404);
    }

    const sourceContent = track.content_text || track.transcript || '';
    
    const qaContent = clarificationAnswers 
      ? clarificationAnswers.map((qa: any) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')
      : 'No specific clarifications provided.';

    const generationPrompt = `
Source Content:
${sourceContent}

Variant Context:
- Type: ${variantType}
- Details: ${JSON.stringify(variantContext)}

Clarification Answers:
${qaContent}

TASK: Generate the adapted content for this variant.
Maintain the exact same structure as the source.
Return the output in the following JSON format:
{
  "generatedTitle": "Suggested variant title",
  "generatedContent": "The adapted HTML/text content",
  "adaptations": [
    {
      "section": "Name of section",
      "originalText": "...",
      "adaptedText": "...",
      "reason": "..."
    }
  ]
}
`;

    const systemPrompt = getVariantSystemPrompt(variantType, variantContext, track.type);
    
    const response = await chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: generationPrompt }
    ], {
      temperature: 0.3, // More deterministic for generation
      response_format: { type: 'json_object' }
    });

    try {
      const parsed = JSON.parse(response);
      return c.json(parsed);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', response);
      return c.json({ 
        generatedTitle: `${track.title} (${variantType} variant)`,
        generatedContent: response,
        adaptations: []
      });
    }
  } catch (error: any) {
    console.error('Error in /variant/generate:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
