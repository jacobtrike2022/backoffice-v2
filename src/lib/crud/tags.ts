// ============================================================================
// TAG MANAGEMENT CRUD OPERATIONS
// Hierarchical: System Category → Tag Parent → Tag (Child)
// ============================================================================

import { supabase, getCurrentUserOrgId, getCurrentUserProfile } from '../supabase';
import { projectId, publicAnonKey, getServerUrl } from '../../utils/supabase/info';

export type SystemCategory = 'content' | 'playlists' | 'forms' | 'knowledge-base' | 'people' | 'units' | 'shared';
export type TagType = 'system-category' | 'parent' | 'child';

export interface Tag {
  id: string;
  organization_id?: string;
  name: string;
  parent_id?: string;
  system_category?: SystemCategory;
  is_system_locked: boolean;
  description?: string;
  color?: string;
  type: TagType;
  display_order: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  
  // Nested relationships
  parent?: Tag;
  children?: Tag[];
}

/**
 * Get all tags with hierarchy
 */
export async function getAllTags(includeSystemLocked: boolean = true): Promise<Tag[]> {
  const orgId = await getCurrentUserOrgId();
  
  let query = supabase
    .from('tags')
    .select('*')
    .or(`organization_id.eq.${orgId},organization_id.is.null`)
    .order('display_order', { ascending: true });
  
  if (!includeSystemLocked) {
    query = query.eq('is_system_locked', false);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data || [];
}

/**
 * Get system categories (top level)
 */
export async function getSystemCategories(): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('type', 'system-category')
    .order('display_order', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

/**
 * Get tags by system category
 */
export async function getTagsByCategory(category: SystemCategory, includeSystemLocked: boolean = true): Promise<Tag[]> {
  const orgId = await getCurrentUserOrgId();
  
  let query = supabase
    .from('tags')
    .select('*')
    .eq('system_category', category)
    .or(`organization_id.eq.${orgId},organization_id.is.null`)
    .order('display_order', { ascending: true });
  
  if (!includeSystemLocked) {
    query = query.eq('is_system_locked', false);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data || [];
}

/**
 * Get tag hierarchy for a category (organized tree structure)
 */
export async function getTagHierarchy(category?: SystemCategory): Promise<Tag[]> {
  const orgId = await getCurrentUserOrgId();
  
  let query = supabase
    .from('tags')
    .select('*')
    .or(`organization_id.eq.${orgId},organization_id.is.null`);
  
  if (category) {
    query = query.eq('system_category', category);
  }
  
  const { data, error } = await query.order('display_order', { ascending: true });
  
  if (error) throw error;
  
  // Build tree structure
  const tags = data || [];
  const tagMap = new Map(tags.map(t => [t.id, { ...t, children: [] }]));
  const roots: Tag[] = [];
  
  tags.forEach(tag => {
    const node = tagMap.get(tag.id)!;
    if (tag.parent_id && tagMap.has(tag.parent_id)) {
      tagMap.get(tag.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  
  return roots;
}

/**
 * Create a new tag
 */
export async function createTag(input: {
  name: string;
  parent_id?: string;
  system_category?: SystemCategory;
  description?: string;
  color?: string;
  type?: TagType;
  display_order?: number;
}): Promise<Tag> {
  const orgId = await getCurrentUserOrgId();
  const userProfile = await getCurrentUserProfile();
  
  if (!orgId || !userProfile) throw new Error('User not authenticated');
  
  // Determine type based on parent
  let tagType: TagType = input.type || 'child';
  if (input.parent_id) {
    const { data: parent } = await supabase
      .from('tags')
      .select('type')
      .eq('id', input.parent_id)
      .single();
    
    if (parent?.type === 'system-category') {
      tagType = 'parent';
    } else if (parent?.type === 'parent') {
      tagType = 'child';
    }
  }
  
  const { data, error } = await supabase
    .from('tags')
    .insert({
      organization_id: orgId,
      name: input.name,
      parent_id: input.parent_id,
      system_category: input.system_category,
      description: input.description,
      color: input.color,
      type: tagType,
      display_order: input.display_order || 0,
      is_system_locked: false
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update a tag
 */
export async function updateTag(
  tagId: string,
  updates: {
    name?: string;
    description?: string;
    color?: string;
    display_order?: number;
  }
): Promise<Tag> {
  // Check if tag is system-locked
  const { data: existingTag } = await supabase
    .from('tags')
    .select('is_system_locked')
    .eq('id', tagId)
    .single();
  
  if (existingTag?.is_system_locked) {
    throw new Error('Cannot update system-locked tags');
  }
  
  const { data, error } = await supabase
    .from('tags')
    .update(updates)
    .eq('id', tagId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Delete a tag
 */
export async function deleteTag(tagId: string): Promise<void> {
  // Check if tag is system-locked and get children
  const { data: existingTag } = await supabase
    .from('tags')
    .select('is_system_locked')
    .eq('id', tagId)
    .single();
  
  if (existingTag?.is_system_locked) {
    throw new Error('Cannot delete system-locked tags');
  }
  
  // Check for children separately
  const { data: children } = await supabase
    .from('tags')
    .select('id')
    .eq('parent_id', tagId);
  
  if (children && children.length > 0) {
    throw new Error('Cannot delete tag with children. Delete children first.');
  }
  
  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', tagId);
  
  if (error) throw error;
}

/**
 * Get tags for a specific entity (track, playlist, etc.)
 */
export async function getEntityTags(entityId: string, entityType: 'track' | 'album' | 'playlist' | 'user' | 'store'): Promise<Tag[]> {
  // For user, store, and playlist tags, use KV store via Server to avoid RLS
  // (playlist_tags table doesn't exist, so we use KV store for playlists)
  if (entityType === 'user' || entityType === 'store' || entityType === 'playlist') {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.session?.access_token || publicAnonKey;
      
      const response = await fetch(`${getServerUrl()}/tags/entity/${entityType}/${entityId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        // If 404 or other non-critical error, just return empty
        if (response.status === 404) return [];
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        console.error(`Failed to fetch tags for ${entityType}:`, errorData);
        return [];
      }
      
      const { tagIds } = await response.json();
      
      if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) return [];

      // Fetch actual tags from tags table
      const { data: tags, error: tagsError } = await supabase
        .from('tags')
        .select('*')
        .in('id', tagIds);

      if (tagsError) {
        console.error('Error fetching tag details:', tagsError);
        return [];
      }

      return tags || [];
    } catch (error) {
      console.error(`Error fetching ${entityType} tags from KV:`, error);
      return [];
    }
  }

  let junctionTable = '';
  let foreignKey = '';
  
  switch (entityType) {
    case 'track':
      junctionTable = 'track_tags';
      foreignKey = 'track_id';
      break;
    case 'album':
      junctionTable = 'album_tags';
      foreignKey = 'album_id';
      break;
    default:
      // This should not be reached as playlist is handled above
      return [];
  }
  
  const { data, error } = await supabase
    .from(junctionTable)
    .select(`
      tag:tags(*)
    `)
    .eq(foreignKey, entityId);
  
  if (error) throw error;
  return data?.map((item: any) => item.tag).filter(Boolean) || [];
}

/**
 * Bulk tag assignment
 */
export async function assignTags(
  entityId: string,
  entityType: 'track' | 'album' | 'playlist' | 'user' | 'store',
  tagIds: string[]
): Promise<void> {
  // For user, store, and playlist tags, use KV store via Server
  // (playlist_tags table doesn't exist, so we use KV store for playlists)
  if (entityType === 'user' || entityType === 'store' || entityType === 'playlist') {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.session?.access_token || publicAnonKey;
    
    const response = await fetch(`${getServerUrl()}/tags/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        entityId,
        entityType,
        tagIds
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to assign tags: ${response.statusText}`);
    }
    return;
  }

  let junctionTable = '';
  let foreignKey = '';
  
  switch (entityType) {
    case 'track':
      junctionTable = 'track_tags';
      foreignKey = 'track_id';
      break;
    case 'album':
      junctionTable = 'album_tags';
      foreignKey = 'album_id';
      break;
    default:
      // This should not be reached as playlist is handled above
      return;
  }
  
  // Remove existing tags
  await supabase
    .from(junctionTable)
    .delete()
    .eq(foreignKey, entityId);
  
  // Add new tags
  if (tagIds.length > 0) {
    const records = tagIds.map(tagId => ({
      [foreignKey]: entityId,
      tag_id: tagId
    }));
    
    const { error } = await supabase
      .from(junctionTable)
      .insert(records);
    
    if (error) throw error;
  }
}

/**
 * Search tags
 */
export async function searchTags(query: string, category?: SystemCategory): Promise<Tag[]> {
  const orgId = await getCurrentUserOrgId();
  
  let supabaseQuery = supabase
    .from('tags')
    .select('*')
    .or(`organization_id.eq.${orgId},organization_id.is.null`)
    .ilike('name', `%${query}%`);
  
  if (category) {
    supabaseQuery = supabaseQuery.eq('system_category', category);
  }
  
  const { data, error } = await supabaseQuery.order('name');
  
  if (error) throw error;
  return data || [];
}