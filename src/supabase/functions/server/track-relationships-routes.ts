// ============================================================================
// TRACK RELATIONSHIPS API ROUTES
// ============================================================================

import { Hono } from 'npm:hono';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as trackRel from './track-relationships.ts';

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

export default app;