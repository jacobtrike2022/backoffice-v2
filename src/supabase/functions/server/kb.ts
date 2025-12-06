import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const kbApp = new Hono();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

// Get public track by KB slug (for QR code public viewer)
kbApp.get('/public/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    console.log('🔍 KB Public endpoint called with slug:', slug);

    if (!slug) {
      return c.json({ error: 'Slug is required' }, 400);
    }

    // Fetch all tracks from KV store
    const allTracksData = await kv.getByPrefix('track:');
    console.log('📦 Found total tracks in KV:', allTracksData.length);
    
    // Log all tracks with their kb_slug for debugging
    allTracksData.forEach((item: any, idx: number) => {
      const track = item.value;
      console.log(`Track ${idx}:`, {
        id: track?.id,
        title: track?.title,
        kb_slug: track?.kb_slug,
        show_in_kb: track?.show_in_knowledge_base,
        status: track?.status
      });
    });
    
    // Find track with matching kb_slug that is published and shown in KB
    const matchingTrack = allTracksData.find((item: any) => {
      const track = item.value;
      return track?.kb_slug === slug && 
             track?.show_in_knowledge_base === true && 
             track?.status === 'published';
    });

    console.log('🎯 Matching track found:', matchingTrack ? 'YES' : 'NO');

    if (!matchingTrack) {
      return c.json({ error: 'not_found' }, 404);
    }

    const track = matchingTrack.value;

    // Try to fetch organization data if organization_id exists
    let org = null;
    if (track.organization_id) {
      const orgKey = `organization:${track.organization_id}`;
      org = await kv.get(orgKey);
    }

    console.log('✅ Returning track:', track.id);
    return c.json({ track, org });
  } catch (error: any) {
    console.error('❌ Error in /kb/public/:slug:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Record page view for public KB
kbApp.post('/page-view', async (c) => {
  try {
    const { trackId, referrer, userAgent } = await c.req.json();

    if (!trackId) {
      return c.json({ error: 'Missing trackId' }, 400);
    }

    const pageViewKey = `kb_page_view:${trackId}:${Date.now()}`;
    const pageViewData = {
      trackId,
      referrer: referrer || 'direct_link',
      userAgent: userAgent || '',
      timestamp: new Date().toISOString()
    };

    await kv.set(pageViewKey, pageViewData);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error recording page view:', error);
    // Silent fail for page views
    return c.json({ success: false }, 200);
  }
});

// Record Feedback
kbApp.post('/feedback', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.split(' ')[1];
    
    let userId = 'anonymous';
    
    // Try to get authenticated user, but allow anonymous
    if (token) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
      }
    }

    const { trackId, helpful } = await c.req.json();

    if (!trackId) {
      return c.json({ error: 'Missing trackId' }, 400);
    }

    const feedbackKey = `kb_feedback:${trackId}:${userId}`;
    const feedbackData = {
      userId,
      trackId,
      helpful,
      timestamp: new Date().toISOString()
    };

    await kv.set(feedbackKey, feedbackData);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error recording KB feedback:', error);
    return c.json({ error: error.message || 'Failed to record feedback' }, 500);
  }
});

// Get Feedback for current user (to show active state)
kbApp.get('/feedback/:trackId', async (c) => {
  try {
    const trackId = c.req.param('trackId');
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.split(' ')[1];
    
    let userId = 'anonymous';
    
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
      }
    }

    const feedbackKey = `kb_feedback:${trackId}:${userId}`;
    const feedback = await kv.get(feedbackKey);

    return c.json({ helpful: feedback?.helpful ?? null });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Like a track (increment likes counter in KV store)
kbApp.post('/like', async (c) => {
  try {
    const { trackId } = await c.req.json();

    if (!trackId) {
      return c.json({ error: 'Missing trackId' }, 400);
    }

    const likesKey = `kb_likes:${trackId}`;
    
    // Get current likes count
    const currentData = await kv.get(likesKey);
    const currentLikes = currentData?.count || 0;
    const newLikes = currentLikes + 1;
    
    // Update likes count
    await kv.set(likesKey, { count: newLikes, lastUpdated: new Date().toISOString() });

    return c.json({ success: true, likes: newLikes });
  } catch (error: any) {
    console.error('Error liking track:', error);
    return c.json({ error: error.message || 'Failed to like track' }, 500);
  }
});

// Get likes count for a track
kbApp.get('/likes/:trackId', async (c) => {
  try {
    const trackId = c.req.param('trackId');
    const likesKey = `kb_likes:${trackId}`;
    
    const data = await kv.get(likesKey);
    const likes = data?.count || 0;

    return c.json({ likes });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default kbApp;