// ============================================================================
// TAG MANAGEMENT CRUD OPERATIONS
// Hierarchical: System Category → Parent → Subcategory → Child
// ============================================================================

import { supabase, getCurrentUserOrgId, getCurrentUserProfile } from '../supabase';
import { projectId, publicAnonKey, getServerUrl } from '../../utils/supabase/info';

/**
 * PostgREST auth for junction writes. In demo mode there is often no Supabase Auth user; a stale
 * or invalid JWT in storage can still be attached to the JS client and yields 401 on writes.
 * When `getUser()` is null, use the anon key explicitly (same pattern as Edge Function calls).
 */
async function getPostgrestJunctionAuthHeaders(): Promise<Record<string, string>> {
  const [{ data: { user } }, { data: { session } }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  const token = user && session?.access_token ? session.access_token : publicAnonKey;
  return {
    Authorization: `Bearer ${token}`,
    apikey: publicAnonKey,
    'Content-Type': 'application/json',
  };
}

const REST_V1_BASE = `https://${projectId}.supabase.co/rest/v1`;

async function junctionTableDeleteAndInsert(
  junctionTable: string,
  foreignKey: string,
  entityId: string,
  tagIds: string[]
): Promise<void> {
  const headers = await getPostgrestJunctionAuthHeaders();
  const deleteHeaders = { ...headers, Prefer: 'return=minimal' };

  const delRes = await fetch(
    `${REST_V1_BASE}/${junctionTable}?${foreignKey}=eq.${encodeURIComponent(entityId)}`,
    { method: 'DELETE', headers: deleteHeaders }
  );
  if (!delRes.ok) {
    const text = await delRes.text().catch(() => '');
    throw new Error(`Failed to clear ${junctionTable}: ${delRes.status} ${text}`);
  }

  if (tagIds.length === 0) return;

  const uniqueTagIds = Array.from(new Set(tagIds.filter(Boolean)));
  const records = uniqueTagIds.map((tagId) => ({
    [foreignKey]: entityId,
    tag_id: tagId,
  }));

  const insRes = await fetch(`${REST_V1_BASE}/${junctionTable}?on_conflict=${encodeURIComponent(`${foreignKey},tag_id`)}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify(records),
  });
  if (!insRes.ok) {
    const text = await insRes.text().catch(() => '');
    throw new Error(`Failed to insert ${junctionTable}: ${insRes.status} ${text}`);
  }
}

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

const DEFAULT_KB_CATEGORY_CHILDREN: Array<{ name: string; color: string }> = [
  { name: 'Ops Manual', color: '#F74A05' },
  { name: 'Safety Procs', color: '#FF733C' },
  { name: 'HR Policy Docs', color: '#7F8C8D' },
  { name: 'IT Help', color: '#95A5A6' },
  { name: 'Equip Guides', color: '#FF733C' },
  { name: 'Cust Svc Policy', color: '#F74A05' },
  { name: 'Comp Docs', color: '#FF733C' },
  { name: 'Prod Info', color: '#F74A05' },
];

async function ensureKnowledgeBaseTagScaffold(orgId: string): Promise<void> {
  // Ensure we have a KB system-category row available in this org context.
  let { data: kbSystemCategory } = await supabase
    .from('tags')
    .select('id')
    .eq('system_category', 'knowledge-base')
    .eq('type', 'system-category')
    .or(`organization_id.eq.${orgId},organization_id.is.null`)
    .order('organization_id', { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();

  if (!kbSystemCategory?.id) {
    const { data: createdSystemCategory, error: createSystemError } = await supabase
      .from('tags')
      .insert({
        organization_id: orgId,
        name: 'Knowledge Base',
        parent_id: null,
        system_category: 'knowledge-base',
        is_system_locked: true,
        description: 'Knowledge base taxonomy',
        color: null,
        type: 'system-category',
        display_order: 0,
      })
      .select('id')
      .single();

    if (createSystemError) throw createSystemError;
    kbSystemCategory = createdSystemCategory;
  }

  // Ensure KB Category parent exists for this org.
  let { data: kbCategoryParent } = await supabase
    .from('tags')
    .select('id')
    .eq('organization_id', orgId)
    .eq('system_category', 'knowledge-base')
    .eq('type', 'parent')
    .ilike('name', 'KB Category')
    .limit(1)
    .maybeSingle();

  if (!kbCategoryParent?.id) {
    const { data: createdParent, error: createParentError } = await supabase
      .from('tags')
      .insert({
        organization_id: orgId,
        name: 'KB Category',
        parent_id: kbSystemCategory.id,
        system_category: 'knowledge-base',
        is_system_locked: false,
        description: 'Subject area',
        color: null,
        type: 'parent',
        display_order: 1,
      })
      .select('id')
      .single();

    if (createParentError) throw createParentError;
    kbCategoryParent = createdParent;
  }

  // Ensure default children exist under KB Category for this org.
  const { data: existingChildren, error: existingChildrenError } = await supabase
    .from('tags')
    .select('name')
    .eq('organization_id', orgId)
    .eq('system_category', 'knowledge-base')
    .eq('type', 'child')
    .eq('parent_id', kbCategoryParent.id);

  if (existingChildrenError) throw existingChildrenError;

  const existingNames = new Set((existingChildren || []).map((t: any) => String(t.name || '').toLowerCase().trim()));
  const missingChildren = DEFAULT_KB_CATEGORY_CHILDREN.filter(
    (child) => !existingNames.has(child.name.toLowerCase().trim())
  );

  if (missingChildren.length > 0) {
    const { error: insertChildrenError } = await supabase
      .from('tags')
      .insert(
        missingChildren.map((child, idx) => ({
          organization_id: orgId,
          name: child.name,
          parent_id: kbCategoryParent!.id,
          system_category: 'knowledge-base',
          is_system_locked: false,
          description: null,
          color: child.color,
          type: 'child',
          display_order: idx + 1,
        }))
      );

    if (insertChildrenError) throw insertChildrenError;
  }
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

  // Demo orgs can be missing KB taxonomy rows; self-heal once to keep KB/category UI consistent.
  if (category === 'knowledge-base' && orgId) {
    const hasKbParent = (data || []).some(
      (t: any) => t.type === 'parent' && String(t.name || '').toLowerCase().trim() === 'kb category'
    );
    if (!hasKbParent) {
      try {
        await ensureKnowledgeBaseTagScaffold(orgId);
        const { data: repairedData, error: repairedError } = await supabase
          .from('tags')
          .select('*')
          .eq('system_category', category)
          .or(`organization_id.eq.${orgId},organization_id.is.null`)
          .order('display_order', { ascending: true });
        if (repairedError) throw repairedError;

        const repairedTags = repairedData || [];
        const repairedMap = new Map(repairedTags.map(t => [t.id, { ...t, children: [] as Tag[] }]));
        const repairedRoots: Tag[] = [];
        repairedTags.forEach(tag => {
          const node = repairedMap.get(tag.id)!;
          if (tag.parent_id && repairedMap.has(tag.parent_id)) {
            repairedMap.get(tag.parent_id)!.children!.push(node);
          } else {
            repairedRoots.push(node);
          }
        });
        repairedMap.forEach(node => {
          if (node.children) {
            node.children.sort((a, b) => a.display_order - b.display_order);
          }
        });
        return repairedRoots;
      } catch (repairError) {
        console.warn('[getTagHierarchy] KB scaffold repair failed:', repairError);
      }
    }
  }
  
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
  // For track/user/store/playlist, read through server endpoint to avoid demo-mode RLS drift.
  // (playlist_tags table doesn't exist, so server/KV is required there)
  if (entityType === 'track' || entityType === 'user' || entityType === 'store' || entityType === 'playlist') {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || publicAnonKey;
      
      const response = await fetch(`${getServerUrl()}/tags/entity/${entityType}/${entityId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': publicAnonKey,
        }
      });
      
      if (!response.ok) {
        // If 404 or other non-critical error, just return empty
        if (response.status === 404) return [];
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        console.error(`Failed to fetch tags for ${entityType}:`, errorData);
        return [];
      }
      
      const payload = await response.json().catch(() => ({} as any));
      if (Array.isArray(payload?.tags)) {
        return payload.tags.filter(Boolean) as Tag[];
      }
      const tagIds = Array.isArray(payload?.tagIds) ? payload.tagIds : [];
      if (tagIds.length === 0) return [];

      // Backward compatibility if endpoint returns tag IDs
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
  // Route track/user/store/playlist writes through server endpoint.
  // Track writes especially must bypass client-side RLS in demo mode.
  if (entityType === 'track' || entityType === 'user' || entityType === 'store' || entityType === 'playlist') {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || publicAnonKey;
    
    const response = await fetch(`${getServerUrl()}/tags/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': publicAnonKey,
      },
      body: JSON.stringify({
        entityId,
        entityType,
        tagIds: Array.from(new Set((tagIds || []).filter(Boolean))),
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

  const uniqueTagIds = Array.from(new Set(tagIds.filter(Boolean)));
  await junctionTableDeleteAndInsert(junctionTable, foreignKey, entityId, uniqueTagIds);
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
  let targetOrgId = await getCurrentUserOrgId();
  try {
    const { data: trackRow } = await supabase
      .from('tracks')
      .select('organization_id')
      .eq('id', trackId)
      .maybeSingle();
    if (trackRow?.organization_id) {
      targetOrgId = trackRow.organization_id as string;
    }
  } catch {
    // Non-blocking: keep URL/auth-derived org fallback
  }

  // Sentinel helper tag used by UI toggle; not a row in tags table and should not be junction-synced.
  const normalizedTagNames = Array.from(new Set((tagNames || [])
    .map((name) => String(name || '').trim())
    .filter((name) => name.length > 0 && name !== 'system:show_in_knowledge_base')
    .map((name) => name.toLowerCase())));

  if (normalizedTagNames.length === 0) {
    await assignTags(trackId, 'track', []);
    return { assignedTags: [], unrecognizedNames: [] };
  }

  // Fetch candidate tags in org scope, then resolve names case-insensitively.
  let tagsQuery = supabase
    .from('tags')
    .select('*');
  if (targetOrgId) {
    tagsQuery = tagsQuery.or(`organization_id.eq.${targetOrgId},organization_id.is.null`);
  } else {
    tagsQuery = tagsQuery.is('organization_id', null);
  }
  const { data: candidateTags, error: tagError } = await tagsQuery;

  if (tagError) throw tagError;

  const nameToBestTag = new Map<string, Tag>();
  for (const tag of (candidateTags || [])) {
    const lowerName = String(tag.name || '').trim().toLowerCase();
    if (!normalizedTagNames.includes(lowerName)) continue;
    const existing = nameToBestTag.get(lowerName);
    if (!existing) {
      nameToBestTag.set(lowerName, tag);
      continue;
    }
    const existingIsGlobal = !existing.organization_id;
    const currentIsOrgSpecific = Boolean(tag.organization_id && targetOrgId && tag.organization_id === targetOrgId);
    if (existingIsGlobal && currentIsOrgSpecific) {
      nameToBestTag.set(lowerName, tag);
    }
  }

  const assignedTags = normalizedTagNames
    .map((name) => nameToBestTag.get(name))
    .filter(Boolean) as Tag[];
  const matchedNames = new Set(assignedTags.map((t) => String(t.name || '').trim().toLowerCase()));
  const unrecognizedNames = normalizedTagNames.filter((name) => !matchedNames.has(name));

  if (unrecognizedNames.length > 0) {
    console.warn('[assignTrackTagsByName] Unrecognized tag names (not in tags table):', unrecognizedNames);
  }

  // Guard rail: if caller supplied names but none resolve, don't wipe existing tags.
  if (assignedTags.length === 0 && normalizedTagNames.length > 0) {
    return { assignedTags: [], unrecognizedNames };
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