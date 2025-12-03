import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const tagsApp = new Hono();

// Get all tags
tagsApp.get('/', async (c) => {
  try {
    // Note: getByPrefix returns an array of objects with { key, value } structure
    // But the actual implementation only returns values, not keys
    // So we need to query the KV store directly
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );
    
    const { data, error } = await supabase
      .from('kv_store_2858cc8b')
      .select('key, value')
      .like('key', 'tag:%');
    
    if (error) {
      throw new Error(error.message);
    }
    
    // Transform the KV store data into tag objects
    const tagList = (data || [])
      .filter((item: any) => item && item.key) // Filter out invalid items
      .map((item: any) => ({
        id: item.key.replace('tag:', ''),
        ...item.value,
      }));

    // Sort by name
    tagList.sort((a: any, b: any) => a.name.localeCompare(b.name));

    return c.json({ tags: tagList });
  } catch (error: any) {
    console.error('Error fetching tags:', error);
    return c.json({ error: error.message || 'Failed to fetch tags' }, 500);
  }
});

// Create a new tag
tagsApp.post('/', async (c) => {
  try {
    const { name, color } = await c.req.json();

    if (!name || !name.trim()) {
      return c.json({ error: 'Tag name is required' }, 400);
    }

    // Generate a unique ID for the tag
    const tagId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const tag = {
      name: name.trim(),
      color: color || '#64748b', // Default gray color
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await kv.set(`tag:${tagId}`, tag);

    return c.json({ tag: { id: tagId, ...tag } }, 201);
  } catch (error: any) {
    console.error('Error creating tag:', error);
    return c.json({ error: error.message || 'Failed to create tag' }, 500);
  }
});

// Update a tag
tagsApp.put('/:id', async (c) => {
  try {
    const tagId = c.req.param('id');
    const { name, color } = await c.req.json();

    if (!name || !name.trim()) {
      return c.json({ error: 'Tag name is required' }, 400);
    }

    const existingTag = await kv.get(`tag:${tagId}`);
    if (!existingTag) {
      return c.json({ error: 'Tag not found' }, 404);
    }

    const updatedTag = {
      ...existingTag,
      name: name.trim(),
      color: color || existingTag.color || '#64748b',
      updated_at: new Date().toISOString(),
    };

    await kv.set(`tag:${tagId}`, updatedTag);

    return c.json({ tag: { id: tagId, ...updatedTag } });
  } catch (error: any) {
    console.error('Error updating tag:', error);
    return c.json({ error: error.message || 'Failed to update tag' }, 500);
  }
});

// Delete a tag
tagsApp.delete('/:id', async (c) => {
  try {
    const tagId = c.req.param('id');

    const existingTag = await kv.get(`tag:${tagId}`);
    if (!existingTag) {
      return c.json({ error: 'Tag not found' }, 404);
    }

    await kv.del(`tag:${tagId}`);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting tag:', error);
    return c.json({ error: error.message || 'Failed to delete tag' }, 500);
  }
});

// Assign tags to an entity (User or Store)
tagsApp.post('/assign', async (c) => {
  try {
    const { entityId, entityType, tagIds } = await c.req.json();

    if (!entityId || !entityType) {
      return c.json({ error: 'Entity ID and Type are required' }, 400);
    }

    // Validate entityType
    if (entityType !== 'user' && entityType !== 'store') {
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

    if (entityType !== 'user' && entityType !== 'store') {
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