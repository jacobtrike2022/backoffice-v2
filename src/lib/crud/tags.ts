// ============================================================================
// TAG MANAGEMENT CRUD OPERATIONS
// Hierarchical: System Category → Parent → Subcategory → Child
// ============================================================================

import { supabase, getCurrentUserOrgId, getCurrentUserProfile } from '../supabase';
import { projectId, publicAnonKey, getServerUrl } from '../../utils/supabase/info';

export type SystemCategory = 'content' | 'playlists' | 'forms' | 'knowledge-base' | 'people' | 'units' | 'shared';
export type TagType = 'system-category' | 'parent' | 'subcategory' | 'child';

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

export interface TagHierarchy {
  systemCategory: Tag;
  parents: {
    tag: Tag;
    subcategories: {
      tag: Tag;
      children: Tag[];
    }[];
    directChildren: Tag[];
  }[];
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
  
  // Build tree structure (supports arbitrary depth)
  const tags = data || [];
  const tagMap = new Map(tags.map(t => [t.id, { ...t, children: [] as Tag[] }]));
  const roots: Tag[] = [];

  tags.forEach(tag => {
    const node = tagMap.get(tag.id)!;
    if (tag.parent_id && tagMap.has(tag.parent_id)) {
      tagMap.get(tag.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  // Preserve display order for nested children as well
  tagMap.forEach(node => {
    if (node.children) {
      node.children.sort((a, b) => a.display_order - b.display_order);
    }
  });

  return roots;
}

/**
 * Convert a flat or tree list of tags into a structured 4-level hierarchy.
 */
export function buildTagHierarchyStructure(tags: Tag[]): TagHierarchy[] {
  const byId = new Map(tags.map(t => [t.id, t]));
  const systemCategories = tags.filter(t => t.type === 'system-category');

  const makeParents = (systemCat: Tag) => {
    const parents = tags.filter(t => t.parent_id === systemCat.id && t.type === 'parent');

    return parents.map(parent => {
      const subcategories = tags
        .filter(t => t.parent_id === parent.id && t.type === 'subcategory')
        .map(sub => ({
          tag: sub,
          children: tags.filter(t => t.parent_id === sub.id && t.type === 'child')
        }));

      const directChildren = tags.filter(t => t.parent_id === parent.id && t.type === 'child');

      return { tag: parent, subcategories, directChildren };
    });
  };

  // If we don't have explicit system category rows, infer them from parents
  const inferredSystems: Tag[] = [];
  tags
    .filter(t => t.type === 'parent')
    .forEach(parent => {
      if (!parent.parent_id) return;
      const maybeSystem = byId.get(parent.parent_id);
      if (maybeSystem && maybeSystem.type === 'system-category') return;
      // Parent references a missing/unknown system category – infer a placeholder
      if (!inferredSystems.find(s => s.id === parent.parent_id)) {
        inferredSystems.push({
          id: parent.parent_id,
          name: maybeSystem?.name || 'Uncategorized',
          parent_id: null as any,
          system_category: maybeSystem?.system_category,
          is_system_locked: false,
          type: 'system-category',
          display_order: 0,
          created_at: '',
          updated_at: '',
        });
      }
    });

  const systems = [...systemCategories, ...inferredSystems];

  return systems.map(systemCategory => ({
    systemCategory,
    parents: makeParents(systemCategory),
  }));
}

/**
 * Convenience helper to fetch tags and return the structured hierarchy.
 */
export async function getTagHierarchyStructured(category?: SystemCategory): Promise<TagHierarchy[]> {
  const roots = await getTagHierarchy(category);

  // Flatten roots for the struct builder since it works on flat arrays
  const flatten = (nodes: Tag[]): Tag[] => {
    const result: Tag[] = [];
    nodes.forEach(n => {
      result.push({ ...n, children: undefined });
      if (n.children && n.children.length > 0) {
        result.push(...flatten(n.children));
      }
    });
    return result;
  };

  return buildTagHierarchyStructure(flatten(roots));
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
  
  // Determine type based on parent while enforcing hierarchy rules
  let tagType: TagType = input.type || 'child';
  let systemCategory = input.system_category;

  if (input.parent_id) {
    const { data: parent, error: parentError } = await supabase
      .from('tags')
      .select('type, system_category')
      .eq('id', input.parent_id)
      .single();

    if (parentError || !parent) {
      throw new Error('Parent tag not found');
    }

    const parentType = parent.type as TagType;
    systemCategory = parent.system_category as SystemCategory | undefined;

    switch (parentType) {
      case 'system-category':
        if (tagType !== 'parent') {
          // Parents are the only allowed children of a system category
          tagType = 'parent';
        }
        break;
      case 'parent':
        if (tagType === 'system-category') {
          throw new Error('Cannot create a system category under a parent tag');
        }
        if (tagType !== 'subcategory' && tagType !== 'child') {
          tagType = 'child';
        }
        break;
      case 'subcategory':
        if (tagType !== 'child') {
          throw new Error('Only child tags can be created under a subcategory');
        }
        break;
      case 'child':
        throw new Error('Child tags cannot have children');
    }
  } else {
    // No parent provided - only allow system categories
    if (!tagType || tagType !== 'system-category') {
      throw new Error('Parent tags must belong to a system category');
    }
  }
  
  const { data, error } = await supabase
    .from('tags')
    .insert({
      organization_id: orgId,
      name: input.name,
      parent_id: input.parent_id,
      system_category: systemCategory,
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
 * @param bypassSystemLock - Set to true for Trike Super Admin to bypass system lock
 */
export async function updateTag(
  tagId: string,
  updates: {
    name?: string;
    description?: string;
    color?: string;
    display_order?: number;
  },
  bypassSystemLock: boolean = false
): Promise<Tag> {
  // Check if tag is system-locked (unless bypassed by Super Admin)
  if (!bypassSystemLock) {
    const { data: existingTag } = await supabase
      .from('tags')
      .select('is_system_locked')
      .eq('id', tagId)
      .single();

    if (existingTag?.is_system_locked) {
      throw new Error('Cannot update system-locked tags');
    }
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
 * @param bypassSystemLock - Set to true for Trike Super Admin to bypass system lock
 */
export async function deleteTag(tagId: string, bypassSystemLock: boolean = false): Promise<void> {
  // Check if tag is system-locked and get children
  const { data: existingTag } = await supabase
    .from('tags')
    .select('is_system_locked, type')
    .eq('id', tagId)
    .single();

  // Check system lock (unless bypassed by Super Admin)
  if (!bypassSystemLock && existingTag?.is_system_locked) {
    throw new Error('Cannot delete system-locked tags');
  }
  
  if (!existingTag) {
    throw new Error('Tag not found');
  }

  // Allow cascading deletes for subcategories (and their descendants)
  if (existingTag.type === 'subcategory') {
    const subtree = await getTagWithDescendants(tagId);
    const idsToDelete: string[] = [];
    const collectIds = (node?: Tag) => {
      if (!node) return;
      node.children?.forEach(child => collectIds(child));
      idsToDelete.push(node.id);
    };
    collectIds(subtree || undefined);

    const { error } = await supabase
      .from('tags')
      .delete()
      .in('id', idsToDelete);

    if (error) throw error;
    return;
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
 * Assign tags to a track by tag names (resolves names to IDs, writes to junction table)
 * This is the preferred method for frontend components.
 *
 * NOTE: The tracks.tags column is deprecated. The track_tags junction table is the source of truth.
 *
 * @param trackId - The track ID to assign tags to
 * @param tagNames - Array of tag names to assign
 * @param syncLegacyColumn - DEPRECATED: Legacy column sync is disabled. This parameter is ignored.
 */
export async function assignTrackTagsByName(
  trackId: string,
  tagNames: string[],
  _syncLegacyColumn: boolean = false // Parameter kept for API compatibility but ignored
): Promise<{ assignedTags: Tag[], unrecognizedNames: string[] }> {
  if (!tagNames || tagNames.length === 0) {
    // Clear all tags from junction table
    await supabase
      .from('track_tags')
      .delete()
      .eq('track_id', trackId);

    return { assignedTags: [], unrecognizedNames: [] };
  }

  // Fetch tags by name to get their IDs
  const { data: matchedTags, error: tagError } = await supabase
    .from('tags')
    .select('*')
    .in('name', tagNames);

  if (tagError) throw tagError;

  const assignedTags = matchedTags || [];
  const matchedNames = new Set(assignedTags.map(t => t.name));
  const unrecognizedNames = tagNames.filter(name => !matchedNames.has(name));

  if (unrecognizedNames.length > 0) {
    console.warn('[assignTrackTagsByName] Unrecognized tag names (not in tags table):', unrecognizedNames);
  }

  // Use assignTags to update junction table (source of truth)
  const tagIds = assignedTags.map(t => t.id);
  await assignTags(trackId, 'track', tagIds);

  return { assignedTags, unrecognizedNames };
}

/**
 * Get track tags from the junction table (source of truth)
 * Returns Tag objects with full metadata (id, name, color, etc.)
 */
export async function getTrackTags(trackId: string): Promise<Tag[]> {
  return getEntityTags(trackId, 'track');
}

/**
 * Get track tag names from the junction table
 * Convenience function that returns just the names as strings
 */
export async function getTrackTagNames(trackId: string): Promise<string[]> {
  const tags = await getTrackTags(trackId);
  return tags.map(t => t.name);
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

/**
 * Get the depth of a tag within the hierarchy.
 * 0 = system-category, 1 = parent, 2 = subcategory, 3 = child
 */
export async function getTagDepth(tagId: string): Promise<number> {
  const tags = await getAllTags(true);
  const tagMap = new Map(tags.map(t => [t.id, t.parent_id]));

  if (!tagMap.has(tagId)) {
    throw new Error('Tag not found');
  }

  const visited = new Set<string>();
  let depth = 0;
  let current: string | undefined = tagId;

  while (current) {
    if (visited.has(current)) {
      throw new Error('Circular tag hierarchy detected');
    }
    visited.add(current);
    const parentId = tagMap.get(current);
    if (!parentId) break;
    depth += 1;
    current = parentId;
  }

  return depth;
}

/**
 * Return a tag with all of its descendants nested in the children array.
 */
export async function getTagWithDescendants(tagId: string, includeSystemLocked: boolean = true): Promise<Tag | null> {
  const tags = await getAllTags(includeSystemLocked);
  const tagMap = new Map(tags.map(t => [t.id, { ...t, children: [] as Tag[] }]));

  tags.forEach(tag => {
    if (tag.parent_id && tagMap.has(tag.parent_id)) {
      tagMap.get(tag.parent_id)!.children!.push(tagMap.get(tag.id)!);
    }
  });

  return tagMap.get(tagId) || null;
}