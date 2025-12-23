// Deno/Supabase Edge Function - npm: imports are valid at runtime
// @ts-expect-error - Deno npm: specifier (valid in Deno runtime)
import { Hono } from 'npm:hono';
// @ts-expect-error - Deno npm: specifier (valid in Deno runtime)
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import * as kv from './kv_store.tsx';

// @ts-expect-error - Deno global is available at runtime
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

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

    // Fetch track by kb_slug from Supabase - ALWAYS get latest version
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('*')
      .eq('kb_slug', slug)
      .eq('show_in_knowledge_base', true)
      .eq('status', 'published')
      .or('is_latest_version.eq.true,is_latest_version.is.null') // Only latest versions
      .order('version_number', { ascending: false }) // Get highest version number if multiple
      .limit(1)
      .maybeSingle();

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
    const { trackId, userId, referrer, userAgent } = await c.req.json();

    if (!trackId) {
      return c.json({ error: 'Missing trackId' }, 400);
    }

    // Always get latest version if trackId points to an old version
    let finalTrackId = trackId;
    const { data: trackById } = await supabase
      .from('tracks')
      .select('id, parent_track_id, is_latest_version')
      .eq('id', trackId)
      .single();
    
    if (trackById && trackById.is_latest_version === false) {
      const parentId = trackById.parent_track_id || trackId;
      const { data: latestTrack } = await supabase
        .from('tracks')
        .select('id')
        .or(`id.eq.${parentId},parent_track_id.eq.${parentId}`)
        .eq('is_latest_version', true)
        .single();
      
      if (latestTrack) {
        finalTrackId = latestTrack.id;
        console.log(`🔄 KB Page View: Redirected from old version ${trackId} to latest version ${finalTrackId}`);
      }
    }

    // Store in KV for analytics
    const pageViewKey = `kb_page_view:${finalTrackId}:${Date.now()}`;
    const pageViewData = {
      trackId: finalTrackId,
      referrer: referrer || 'direct_link',
      userAgent: userAgent || '',
      timestamp: new Date().toISOString()
    };

    await kv.set(pageViewKey, pageViewData);

    // Record activity event if userId is provided (using service role key - bypasses RLS)
    // Deduplicate: Only record if no view event exists in the last 60 seconds for this user+track
    if (userId) {
      try {
        // Check for recent view event (within last 60 seconds) to prevent duplicates
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
        const { data: recentView } = await supabase
          .from('activity_events')
          .select('id')
          .eq('user_id', userId)
          .eq('object_id', finalTrackId)
          .eq('verb', 'Viewed')
          .gte('timestamp', oneMinuteAgo)
          .limit(1)
          .maybeSingle();
        
        if (recentView) {
          console.log('⏭️ KB Page View: Recent view event exists (within 60s), skipping duplicate:', {
            userId,
            trackId: finalTrackId,
            existingEventId: recentView.id
          });
        } else {
          const { data: trackInfo } = await supabase
            .from('tracks')
            .select('title, type, version_number')
            .eq('id', finalTrackId)
            .single();
          
          if (trackInfo) {
            const { data: insertedEvent, error: activityInsertError } = await supabase
              .from('activity_events')
              .insert({
                user_id: userId,
                verb: 'Viewed', // xAPI/Tin Can API standard verb (capitalized per https://registry.tincanapi.com/#home/verbs)
                object_type: 'track',
                object_id: finalTrackId,
                object_name: trackInfo.title,
                result_completion: false,
                context_platform: 'web',
                timestamp: new Date().toISOString(),
                metadata: {
                  track_type: trackInfo.type,
                  track_version: trackInfo.version_number || 1,
                  action_type: 'view',
                  verb_uri: 'http://activitystrea.ms/schema/1.0/view', // xAPI verb URI for LRS interoperability
                  referrer: referrer || 'direct_link'
                }
              })
              .select()
              .single();
            
            if (activityInsertError) {
              console.error('❌ KB Page View: Failed to insert activity event:', {
                userId,
                trackId: finalTrackId,
                error: activityInsertError.message,
                code: activityInsertError.code,
                details: activityInsertError.details,
                hint: activityInsertError.hint
              });
            } else {
              console.log('✅ KB Page View: Activity event recorded for userId:', {
                userId,
                trackId: finalTrackId,
                eventId: insertedEvent?.id
              });
            }
          }
        }
      } catch (activityError: any) {
        console.warn('⚠️ KB Page View: Failed to record activity event (non-critical):', activityError.message);
      }
    }

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

// Like a track (increment likes counter in database and KV store)
kbApp.post('/like', async (c) => {
  try {
    const { trackId, userId } = await c.req.json();

    if (!trackId) {
      console.error('❌ KB Like: Missing trackId');
      return c.json({ error: 'Missing trackId' }, 400);
    }

    // Always like the latest version, even if trackId points to an old version
    let finalTrackId = trackId;
    const { data: trackById } = await supabase
      .from('tracks')
      .select('id, parent_track_id, is_latest_version')
      .eq('id', trackId)
      .single();
    
    if (trackById && trackById.is_latest_version === false) {
      const parentId = trackById.parent_track_id || trackId;
      const { data: latestTrack } = await supabase
        .from('tracks')
        .select('id')
        .or(`id.eq.${parentId},parent_track_id.eq.${parentId}`)
        .eq('is_latest_version', true)
        .single();
      
      if (latestTrack) {
        finalTrackId = latestTrack.id;
        console.log(`🔄 KB Like: Redirected from old version ${trackId} to latest version ${finalTrackId}`);
      }
    }

    console.log('📊 KB Like: Attempting to increment likes for track:', finalTrackId);

    // Check if user already liked this track (prevent duplicate likes and activity events)
    if (userId) {
      const { data: existingLike } = await supabase
        .from('activity_events')
        .select('id')
        .eq('user_id', userId)
        .eq('object_id', finalTrackId)
        .eq('verb', 'Liked')
        .limit(1)
        .maybeSingle();
      
      if (existingLike) {
        console.log('⏭️ KB Like: User already liked this track, returning current count:', {
          userId,
          trackId: finalTrackId,
          existingEventId: existingLike.id
        });
        
        // Return current likes count without incrementing
        const { data: track } = await supabase
          .from('tracks')
          .select('likes_count')
          .eq('id', finalTrackId)
          .single();
        
        return c.json({ 
          success: true, 
          likes: track?.likes_count || 0,
          alreadyLiked: true
        });
      }
    }

    // Try to increment in database using RPC function (most reliable)
    let newLikes = 0;
    try {
      const { error: rpcError } = await supabase.rpc('increment_track_likes', {
        track_id: finalTrackId
      });

      if (!rpcError) {
        // RPC succeeded, get updated count
        const { data: track, error: fetchError } = await supabase
          .from('tracks')
          .select('likes_count')
          .eq('id', finalTrackId)
          .single();

        if (!fetchError && track) {
          newLikes = track.likes_count || 0;
          console.log('✅ KB Like: Successfully incremented via RPC, new count:', newLikes);
        
        // Record activity event if userId is provided
        if (userId) {
          try {
            const { data: trackInfo } = await supabase
              .from('tracks')
              .select('title, type, version_number')
              .eq('id', finalTrackId)
              .single();
            
            if (trackInfo) {
              const { data: insertedEvent, error: activityInsertError } = await supabase
                .from('activity_events')
                .insert({
                  user_id: userId,
                  verb: 'Liked', // xAPI/Tin Can API standard verb (capitalized per https://registry.tincanapi.com/#home/verbs)
                  object_type: 'track',
                  object_id: finalTrackId,
                  object_name: trackInfo.title,
                  result_completion: false,
                  context_platform: 'web',
                  timestamp: new Date().toISOString(),
                  metadata: {
                    track_type: trackInfo.type,
                    track_version: trackInfo.version_number || 1,
                    action_type: 'like',
                    verb_uri: 'http://activitystrea.ms/schema/1.0/like' // xAPI verb URI for LRS interoperability
                  }
                })
                .select()
                .single();
              
              if (activityInsertError) {
                console.error('❌ KB Like: Failed to insert activity event:', {
                  userId,
                  trackId: finalTrackId,
                  error: activityInsertError.message,
                  code: activityInsertError.code,
                  details: activityInsertError.details,
                  hint: activityInsertError.hint
                });
              } else {
                console.log('✅ KB Like: Activity event recorded successfully:', {
                  userId,
                  trackId: finalTrackId,
                  eventId: insertedEvent?.id
                });
              }
            }
          } catch (activityError: any) {
            console.warn('⚠️ KB Like: Failed to record activity event (non-critical):', activityError.message);
          }
        }
        }
      } else {
        // RPC function doesn't exist, fall back to manual increment
        const isFunctionNotFound = rpcError.code === '42883' || 
                                   rpcError.message?.includes('function') || 
                                   rpcError.message?.includes('does not exist');
        
        if (isFunctionNotFound) {
          console.warn('⚠️ KB Like: RPC function not found, falling back to manual increment. Consider running migration 00004_add_likes_count.sql');
        } else {
          console.error('❌ KB Like: RPC call failed:', {
            code: rpcError.code,
            message: rpcError.message,
            details: rpcError.details
          });
        }

        // Fall back to manual increment
        const { data: track, error: fetchError } = await supabase
          .from('tracks')
          .select('likes_count')
          .eq('id', finalTrackId)
          .single();

        if (fetchError || !track) {
          throw new Error(`Track not found: ${finalTrackId}`);
        }

        const currentLikes = track.likes_count || 0;
        newLikes = currentLikes + 1;

        const { error: updateError } = await supabase
          .from('tracks')
          .update({ likes_count: newLikes })
          .eq('id', finalTrackId);

        if (updateError) {
          throw updateError;
        }

        console.log('✅ KB Like: Successfully incremented manually, new count:', newLikes);
        
        // Record activity event if userId is provided
        if (userId) {
          try {
            const { data: trackInfo } = await supabase
              .from('tracks')
              .select('title, type, version_number')
              .eq('id', finalTrackId)
              .single();
            
            if (trackInfo) {
              const { data: insertedEvent, error: activityInsertError } = await supabase
                .from('activity_events')
                .insert({
                  user_id: userId,
                  verb: 'Liked', // xAPI/Tin Can API standard verb (capitalized per https://registry.tincanapi.com/#home/verbs)
                  object_type: 'track',
                  object_id: finalTrackId,
                  object_name: trackInfo.title,
                  result_completion: false,
                  context_platform: 'web',
                  timestamp: new Date().toISOString(),
                  metadata: {
                    track_type: trackInfo.type,
                    track_version: trackInfo.version_number || 1,
                    action_type: 'like',
                    verb_uri: 'http://activitystrea.ms/schema/1.0/like' // xAPI verb URI for LRS interoperability
                  }
                })
                .select()
                .single();
              
              if (activityInsertError) {
                console.error('❌ KB Like: Failed to insert activity event:', {
                  userId,
                  trackId: finalTrackId,
                  error: activityInsertError.message,
                  code: activityInsertError.code,
                  details: activityInsertError.details,
                  hint: activityInsertError.hint
                });
              } else {
                console.log('✅ KB Like: Activity event recorded successfully:', {
                  userId,
                  trackId: finalTrackId,
                  eventId: insertedEvent?.id
                });
              }
            }
          } catch (activityError: any) {
            console.warn('⚠️ KB Like: Failed to record activity event (non-critical):', activityError.message);
          }
        }
      }
    } catch (dbError: any) {
      console.error('❌ KB Like: Database update failed:', {
        trackId,
        finalTrackId,
        error: dbError.message || dbError
      });
      // Continue to KV store fallback
    }

    // Also update KV store for backward compatibility and caching
    // Store for both the original trackId (for backward compatibility) and finalTrackId
    try {
      const likesKey = `kb_likes:${finalTrackId}`;
      await kv.set(likesKey, { 
        count: newLikes, 
        lastUpdated: new Date().toISOString() 
      });
    } catch (kvError) {
      console.warn('⚠️ KB Like: KV store update failed (non-critical):', kvError);
    }

    return c.json({ success: true, likes: newLikes });
  } catch (error: any) {
    console.error('❌ KB Like: Unexpected error:', {
      error: error.message || error,
      stack: error.stack
    });
    return c.json({ error: error.message || 'Failed to like track' }, 500);
  }
});

// Get likes count for a track (from database, with KV fallback)
// Also checks if a specific user has liked the track
kbApp.get('/likes/:trackId', async (c) => {
  try {
    const trackId = c.req.param('trackId');
    const userId = c.req.query('userId') || null; // Optional userId to check if they liked
    
    if (!trackId) {
      console.error('❌ KB Get Likes: Missing trackId');
      return c.json({ error: 'Missing trackId' }, 400);
    }

    console.log('📊 KB Get Likes: Fetching likes for track:', trackId, userId ? `(checking if user ${userId} liked)` : '');

    // Always get latest version if trackId points to an old version
    let finalTrackId = trackId;
    
    // Try to get from database first (source of truth)
    try {
      // First, get the track to check if it's the latest version
      const { data: trackById, error: trackError } = await supabase
        .from('tracks')
        .select('id, parent_track_id, is_latest_version')
        .eq('id', trackId)
        .single();
      
      // If this is not the latest version, find the latest version
      if (trackById && trackById.is_latest_version === false) {
        const parentId = trackById.parent_track_id || trackId;
        const { data: latestTrack } = await supabase
          .from('tracks')
          .select('id')
          .or(`id.eq.${parentId},parent_track_id.eq.${parentId}`)
          .eq('is_latest_version', true)
          .single();
        
        if (latestTrack) {
          finalTrackId = latestTrack.id;
          console.log(`🔄 KB Get Likes: Redirected from old version ${trackId} to latest version ${finalTrackId}`);
        }
      }
      
      // Get likes count for the latest version
      const { data: track, error: dbError } = await supabase
        .from('tracks')
        .select('likes_count')
        .eq('id', finalTrackId)
        .single();

      if (!dbError && track) {
        const likes = track.likes_count || 0;
        
        // Check if user has liked this track
        let userLiked = false;
        if (userId) {
          const { data: userLikeEvent } = await supabase
            .from('activity_events')
            .select('id')
            .eq('user_id', userId)
            .eq('object_id', finalTrackId)
            .eq('verb', 'Liked')
            .limit(1)
            .maybeSingle();
          
          userLiked = !!userLikeEvent;
        }
        
        console.log('✅ KB Get Likes: Retrieved from database:', { likes, userLiked });
        return c.json({ likes, userLiked });
      }
    } catch (dbError: any) {
      console.warn('⚠️ KB Get Likes: Database query failed, falling back to KV store:', dbError.message);
    }

    // Fall back to KV store if database query fails
    try {
      const likesKey = `kb_likes:${finalTrackId}`;
      const data = await kv.get(likesKey);
      const likes = data?.count || 0;
      
      console.log('✅ KB Get Likes: Retrieved from KV store (fallback):', likes);
      return c.json({ likes, userLiked: false }); // Can't check user like state from KV
    } catch (kvError: any) {
      console.error('❌ KB Get Likes: KV store query also failed:', kvError.message);
      // Return 0 as default
      return c.json({ likes: 0, userLiked: false });
    }
  } catch (error: any) {
    console.error('❌ KB Get Likes: Unexpected error:', {
      error: error.message || error,
      stack: error.stack
    });
    return c.json({ error: error.message || 'Failed to get likes' }, 500);
  }
});

export default kbApp;