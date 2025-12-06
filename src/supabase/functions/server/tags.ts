import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const tagsApp = new Hono();

// NOTE: Tag CRUD operations (GET, POST, PUT, DELETE) are handled directly by the frontend
// using Supabase client queries against the 'tags' table. See /lib/crud/tags.ts
// The endpoints below ONLY handle tag assignments for entities without junction tables
// (playlist, user, store) which currently use KV store.

// Assign tags to an entity (User, Store, or Playlist)
tagsApp.post('/assign', async (c) => {
  try {
    const { entityId, entityType, tagIds } = await c.req.json();

    if (!entityId || !entityType) {
      return c.json({ error: 'Entity ID and Type are required' }, 400);
    }

    // Validate entityType
    if (entityType !== 'user' && entityType !== 'store' && entityType !== 'playlist') {
       return c.json({ error: 'Invalid entity type for KV storage' }, 400);
    }

    const key = `${entityType}_tags:${entityId}`;
    
    await kv.set(key, tagIds);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error assigning tags:', error);
    return c.json({ error: error.message || 'Failed to assign tags' }, 500);
  }
});

// Get tags for an entity
tagsApp.get('/entity/:type/:id', async (c) => {
  try {
    const entityType = c.req.param('type');
    const entityId = c.req.param('id');

    if (entityType !== 'user' && entityType !== 'store' && entityType !== 'playlist') {
       return c.json({ error: 'Invalid entity type for KV storage' }, 400);
    }

    const key = `${entityType}_tags:${entityId}`;
    const tagIds = await kv.get(key);

    return c.json({ tagIds: tagIds || [] });
  } catch (error: any) {
    console.error('Error getting entity tags:', error);
    return c.json({ error: error.message || 'Failed to get entity tags' }, 500);
  }
});

export default tagsApp;