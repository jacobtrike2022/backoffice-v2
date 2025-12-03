// ============================================================================
// CLEANUP AND RESEED - Remove rainbow vomit, add Trike brand colors
// Run this once to fix the existing tags
// ============================================================================

import { supabase, getCurrentUserOrgId } from '../supabase';
import { seedAllSystems } from './all-systems-seed';
import { seedSharedTags } from './shared-tags-seed';

export async function cleanupAndReseed() {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('Organization not found');

  console.log('🧹 Starting cleanup and reseed...');

  const systemsToClean = ['content', 'units', 'people', 'forms', 'knowledge-base', 'shared'];

  for (const systemCategory of systemsToClean) {
    console.log(`🗑️  Cleaning ${systemCategory} system...`);

    // Get all tags in this system (children and parents, but not system-category)
    const { data: tagsToDelete } = await supabase
      .from('tags')
      .select('id, name, type')
      .eq('system_category', systemCategory)
      .neq('type', 'system-category');

    if (tagsToDelete && tagsToDelete.length > 0) {
      console.log(`   Found ${tagsToDelete.length} tags to delete`);

      // Delete children first (they reference parents)
      const childIds = tagsToDelete.filter(t => t.type === 'child').map(t => t.id);
      if (childIds.length > 0) {
        const { error: childError } = await supabase
          .from('tags')
          .delete()
          .in('id', childIds);
        
        if (childError) {
          console.error(`Error deleting child tags:`, childError);
        } else {
          console.log(`   ✅ Deleted ${childIds.length} child tags`);
        }
      }

      // Then delete parents
      const parentIds = tagsToDelete.filter(t => t.type === 'parent').map(t => t.id);
      if (parentIds.length > 0) {
        const { error: parentError } = await supabase
          .from('tags')
          .delete()
          .in('id', parentIds);
        
        if (parentError) {
          console.error(`Error deleting parent tags:`, parentError);
        } else {
          console.log(`   ✅ Deleted ${parentIds.length} parent tags`);
        }
      }
    } else {
      console.log(`   ℹ️  No tags to delete`);
    }
  }

  console.log('🌱 Re-seeding with Trike brand colors...');
  await seedAllSystems();
  await seedSharedTags();
  
  console.log('🎉 Cleanup and reseed complete!');
}
