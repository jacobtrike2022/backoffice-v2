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

export default app;