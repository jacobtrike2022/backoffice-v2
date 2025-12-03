import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const kbApp = new Hono();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

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

export default kbApp;