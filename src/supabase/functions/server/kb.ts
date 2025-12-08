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

    // Fetch track by kb_slug from Supabase
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('*')
      .eq('kb_slug', slug)
      .eq('show_in_knowledge_base', true)
      .eq('status', 'published')
      .single();

    console.log('🎯 Track query result:', { track, error: trackError });

    if (trackError || !track) {
      console.log('❌ Track not found for slug:', slug);
      return c.json({ error: 'not_found' }, 404);
    }

    console.log('🔍 Track tags column data:', {
      'track.tags': track.tags,
      'type': typeof track.tags,
      'isArray': Array.isArray(track.tags)
    });

    // Fetch organization settings
    // Try to get KB columns, but gracefully handle if they don't exist yet
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', track.organization_id)
      .single();

    console.log('🏢 Organization query:', { 
      organization_id: track.organization_id, 
      org, 
      orgError 
    });

    if (orgError) {
      console.error('❌ Error fetching organization:', orgError);
      // Don't fail hard - continue with defaults
    }

    if (!org) {
      console.error('❌ Organization not found for ID:', track.organization_id);
      return c.json({ 
        error: 'organization_not_found',
        message: 'Knowledge Base configuration not found'
      }, 404);
    }

    // Extract KB settings with defaults if columns don't exist
    const privacyMode = org.kb_privacy_mode || 'public';
    const sharedPassword = org.kb_shared_password || null;
    const logoUrl = org.kb_logo_url || null;
    const logoDark = org.kb_logo_dark || null;
    const logoLight = org.kb_logo_light || null;

    console.log('🔒 Privacy settings:', {
      privacyMode,
      hasPassword: !!sharedPassword,
      hasLogo: !!logoUrl || !!logoDark || !!logoLight
    });

    console.log('🔒🔒🔒 BACKEND Privacy Mode Debug:', {
      'org.kb_privacy_mode (raw)': org.kb_privacy_mode,
      'privacyMode (processed)': privacyMode,
      'org.kb_shared_password exists': !!org.kb_shared_password,
      'sharedPassword exists': !!sharedPassword,
      'password first 3 chars': sharedPassword?.substring(0, 3) || 'null',
      'Will return to frontend': {
        kb_privacy_mode: privacyMode,
        kb_shared_password: sharedPassword
      }
    });

    // ⚠️ PRIVACY MODE CHECK - Must happen BEFORE returning data
    // This determines if the user can access this content
    if (privacyMode === 'password') {
      // Password protection - frontend will show password prompt
      // Frontend must validate password before showing content
      console.log('🔒 Password-protected KB - frontend will handle validation');
    } else if (privacyMode === 'employee_login') {
      // Employee login required - return 401 to trigger login flow
      console.log('🔒 Employee login required');
      return c.json({ 
        error: 'login_required',
        message: 'Employee login required to access this content',
        org: {
          name: org.name,
          privacy_mode: privacyMode
        }
      }, 401);
    } else {
      // Public mode - no restrictions
      console.log('🌍 Public KB - no restrictions');
    }

    // Fetch Key Facts (via fact_usage junction table)
    const { data: factsData, error: factsError } = await supabase
      .from('fact_usage')
      .select(`
        fact_id,
        display_order,
        facts:fact_id (
          id,
          title,
          content
        )
      `)
      .eq('track_id', track.id)
      .eq('track_type', track.type)
      .order('display_order', { ascending: true });

    // Transform to flat array of facts
    const facts = factsData?.map(fu => ({
      id: fu.facts?.id || fu.fact_id,
      title: fu.facts?.title || '',
      content: fu.facts?.content || '',
      display_order: fu.display_order || 0
    })).filter(f => f.title) || [];

    if (factsError) {
      console.error('Error fetching facts:', factsError);
    }

    // Fetch Tags (via track_tags junction table)
    console.log('🔍 Fetching tags for track_id:', track.id);
    const { data: trackTags, error: tagsError } = await supabase
      .from('track_tags')
      .select(`
        tag_id,
        tags:tag_id (
          id,
          name,
          type,
          color
        )
      `)
      .eq('track_id', track.id);

    console.log('📋 Raw trackTags query result:', {
      trackTags,
      tagsError,
      trackTagsCount: trackTags?.length || 0
    });

    let tags = trackTags?.map(tt => {
      console.log('🏷️ Processing trackTag:', tt);
      return tt.tags;
    }).filter(Boolean) || [];

    // FALLBACK: If junction table is empty, use legacy track.tags column
    if (tags.length === 0 && track.tags && Array.isArray(track.tags)) {
      console.log('⚠️ Using fallback: Legacy track.tags column has data, junction table is empty');
      tags = track.tags.map((tagName: string) => ({
        id: tagName, // Use tag name as ID for legacy tags
        name: tagName,
        type: tagName.startsWith('system:') ? 'system' : 'custom',
        color: tagName.startsWith('system:') ? '#6B7280' : '#3B82F6'
      }));
    }

    console.log('✅ Final tags array:', {
      tags,
      tagsCount: tags.length,
      source: trackTags?.length > 0 ? 'junction_table' : 'legacy_column'
    });

    if (tagsError) {
      console.error('❌ Error fetching tags:', tagsError);
    }

    // Fetch Attachments
    const { data: attachments, error: attachmentsError } = await supabase
      .from('kb_attachments')
      .select('id, filename, file_url, file_type, file_size, created_at')
      .eq('article_id', track.id)
      .order('created_at', { ascending: true });

    if (attachmentsError) {
      console.error('Error fetching attachments:', attachmentsError);
    }

    // Fetch Related Tracks (same tags, exclude current track, limit 5)
    let related: any[] = [];
    if (tags.length > 0) {
      // Only query related tracks if tags came from junction table (have valid UUIDs)
      const hasValidTagIds = trackTags && trackTags.length > 0;
      
      if (hasValidTagIds) {
        const tagIds = tags.map((t: any) => t.id);
        
        console.log('🔍 Fetching related tracks with tag IDs:', tagIds);
        
        // Get tracks that share tags with current track
        const { data: relatedTracks, error: relatedError } = await supabase
          .from('track_tags')
          .select(`
            track_id,
            tracks:track_id (
              id,
              title,
              kb_slug,
              type,
              duration_minutes,
              show_in_knowledge_base
            )
          `)
          .in('tag_id', tagIds)
          .neq('track_id', track.id);

        if (!relatedError && relatedTracks) {
          // Deduplicate and take first 5
          const uniqueTracks = new Map();
          relatedTracks.forEach(rt => {
            if (rt.tracks && rt.tracks.kb_slug && rt.tracks.show_in_knowledge_base) {
              uniqueTracks.set(rt.tracks.id, rt.tracks);
            }
          });
          related = Array.from(uniqueTracks.values()).slice(0, 5);
        } else if (relatedError) {
          console.error('Error fetching related tracks:', relatedError);
        }
      } else {
        console.log('⚠️ Skipping related tracks query - using legacy tags without valid UUIDs');
      }
    }

    console.log('✅ Returning track with enhanced data:', {
      trackId: track.id,
      factsCount: facts?.length || 0,
      tagsCount: tags?.length || 0,
      relatedCount: related?.length || 0
    });

    return c.json({ 
      track, 
      org,
      facts: facts || [],
      tags: tags || [],
      attachments: attachments || [],
      related: related || []
    });
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