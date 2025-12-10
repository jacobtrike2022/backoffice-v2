// ============================================================================
// UNIT TAGS CRUD OPERATIONS
// ============================================================================

import { supabase } from '../supabase';

/**
 * Get all tags assigned to a store/unit
 * 
 * @param storeId - The ID of the store
 * @returns Array of tag IDs and names
 */
export async function getUnitTags(storeId: string) {
  try {
    const { data, error } = await supabase
      .from('unit_tags')
      .select(`
        id,
        tag_id,
        tag:tags(id, name, parent_id, system_category, type)
      `)
      .eq('store_id', storeId);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error in getUnitTags:', err);
    throw err;
  }
}

/**
 * Add tags to a store/unit
 * 
 * @param storeId - The ID of the store
 * @param tagIds - Array of tag IDs to assign
 */
export async function addUnitTags(storeId: string, tagIds: string[]) {
  try {
    // Remove duplicates
    const uniqueTagIds = [...new Set(tagIds)];

    // Create the unit_tags records
    const records = uniqueTagIds.map(tagId => ({
      store_id: storeId,
      tag_id: tagId
    }));

    const { data, error } = await supabase
      .from('unit_tags')
      .insert(records)
      .select();

    if (error) {
      // If error is duplicate key, that's okay - tags already assigned
      if (error.code === '23505') {
        console.log('Some tags were already assigned to this unit');
        return;
      }
      throw error;
    }

    return data;
  } catch (err) {
    console.error('Error in addUnitTags:', err);
    throw err;
  }
}

/**
 * Remove a tag from a store/unit
 * 
 * @param storeId - The ID of the store
 * @param tagId - The tag ID to remove
 */
export async function removeUnitTag(storeId: string, tagId: string) {
  try {
    const { error } = await supabase
      .from('unit_tags')
      .delete()
      .eq('store_id', storeId)
      .eq('tag_id', tagId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error in removeUnitTag:', err);
    throw err;
  }
}

/**
 * Remove all tags from a store/unit
 * 
 * @param storeId - The ID of the store
 */
export async function removeAllUnitTags(storeId: string) {
  try {
    const { error } = await supabase
      .from('unit_tags')
      .delete()
      .eq('store_id', storeId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error in removeAllUnitTags:', err);
    throw err;
  }
}

/**
 * Replace all tags for a store/unit (removes existing, adds new)
 * 
 * @param storeId - The ID of the store
 * @param tagIds - Array of tag IDs to assign
 */
export async function replaceUnitTags(storeId: string, tagIds: string[]) {
  try {
    // First, remove all existing tags
    await removeAllUnitTags(storeId);

    // Then add the new tags
    if (tagIds.length > 0) {
      await addUnitTags(storeId, tagIds);
    }

    return true;
  } catch (err) {
    console.error('Error in replaceUnitTags:', err);
    throw err;
  }
}

/**
 * Get all stores that have a specific tag
 * 
 * @param tagId - The tag ID to search for
 * @returns Array of store IDs
 */
export async function getStoresByTag(tagId: string) {
  try {
    const { data, error } = await supabase
      .from('unit_tags')
      .select('store_id, store:stores(id, name, code)')
      .eq('tag_id', tagId);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error in getStoresByTag:', err);
    throw err;
  }
}
