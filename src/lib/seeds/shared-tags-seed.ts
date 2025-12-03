// ============================================================================
// SHARED TAGS SEED SCRIPT
// Seeds the SHARED system with Geography, Industry Sectors, and Compliance Frameworks
// Excluding Regions and Languages as requested
// All tags use Trike brand orange (#F74A05) or secondary orange (#FF733C)
// ============================================================================

import { supabase } from '../supabase';
import { createTag } from '../crud/tags';

export async function seedSharedTags() {
  console.log('🌐 Seeding SHARED system tags...');

  try {
    // 1. Create or Get SHARED System Category
    let sharedSystemId: string;
    
    const { data: existingShared } = await supabase
      .from('tags')
      .select('id')
      .eq('system_category', 'shared')
      .eq('type', 'system-category')
      .single();

    if (existingShared) {
      sharedSystemId = existingShared.id;
      console.log('ℹ️  Shared system category already exists');
    } else {
      const sharedSystem = await createTag({
        name: 'Shared',
        type: 'system-category',
        system_category: 'shared',
        description: 'Cross-cutting tags used across multiple systems',
        display_order: 100,
      });
      sharedSystemId = sharedSystem.id;
      console.log('✅ Created SHARED system');
    }

    // 2. Geography Category (States) - KEPT but Orange
    let geographyCategoryId: string;
    const { data: existingGeography } = await supabase
      .from('tags')
      .select('id')
      .eq('name', 'Geography')
      .eq('parent_id', sharedSystemId)
      .single();

    if (existingGeography) {
      geographyCategoryId = existingGeography.id;
      console.log('ℹ️  Geography category already exists');
    } else {
      const geographyCategory = await createTag({
        name: 'Geography',
        parent_id: sharedSystemId,
        system_category: 'shared',
        description: 'States and territories',
        display_order: 1,
      });
      geographyCategoryId = geographyCategory.id;
      console.log('✅ Created Geography category');
    }

    // All 50 US States - Colored Orange
    const states = [
      'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
      'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
      'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
      'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
      'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
      'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
      'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
      'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
      'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
      'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
    ];

    for (let i = 0; i < states.length; i++) {
      const { data: existing } = await supabase
        .from('tags')
        .select('id')
        .eq('name', states[i])
        .eq('parent_id', geographyCategoryId)
        .single();

      // Alternate colors for visual interest but strictly within palette
      const color = i % 2 === 0 ? '#F74A05' : '#FF733C';

      if (!existing) {
        await createTag({
          name: states[i],
          parent_id: geographyCategoryId,
          system_category: 'shared',
          description: `${states[i]} state`,
          display_order: i + 1,
          color: color // Explicitly set orange color
        });
      }
    }
    console.log(`✅ Geography tags synced`);

    // 3. Industry Sectors Category
    let sectorsCategoryId: string;
    const { data: existingSectors } = await supabase
      .from('tags')
      .select('id')
      .eq('name', 'Industry Sectors')
      .eq('parent_id', sharedSystemId)
      .single();

    if (existingSectors) {
      sectorsCategoryId = existingSectors.id;
      console.log('ℹ️  Industry Sectors category already exists');
    } else {
      const sectorsCategory = await createTag({
        name: 'Industry Sectors',
        parent_id: sharedSystemId,
        system_category: 'shared',
        description: 'Business verticals and sectors',
        display_order: 2,
      });
      sectorsCategoryId = sectorsCategory.id;
      console.log('✅ Created Industry Sectors category');
    }

    const sectors = [
      { name: 'Convenience Store', order: 1 },
      { name: 'Truck Stop', order: 2 },
      { name: 'Travel Center', order: 3 },
      { name: 'Grocery Sector', order: 4 }, // Renamed to avoid conflict
      { name: 'QSR', order: 5, description: 'Quick Service Restaurant' }
    ];

    for (const sector of sectors) {
      const { data: existing } = await supabase
        .from('tags')
        .select('id')
        .eq('name', sector.name)
        .eq('parent_id', sectorsCategoryId)
        .single();

      const color = sector.order % 2 === 0 ? '#FF733C' : '#F74A05';

      if (!existing) {
        await createTag({
          name: sector.name,
          parent_id: sectorsCategoryId,
          system_category: 'shared',
          description: sector.description || `${sector.name} operations`,
          display_order: sector.order,
          color: color
        });
      }
    }
    console.log(`✅ Industry sector tags synced`);

    // 4. Compliance Frameworks Category
    let complianceCategoryId: string;
    const { data: existingCompliance } = await supabase
      .from('tags')
      .select('id')
      .eq('name', 'Compliance Frameworks')
      .eq('parent_id', sharedSystemId)
      .single();

    if (existingCompliance) {
      complianceCategoryId = existingCompliance.id;
      console.log('ℹ️  Compliance Frameworks category already exists');
    } else {
      const complianceCategory = await createTag({
        name: 'Compliance Frameworks',
        parent_id: sharedSystemId,
        system_category: 'shared',
        description: 'Regulatory and compliance standards',
        display_order: 3,
      });
      complianceCategoryId = complianceCategory.id;
      console.log('✅ Created Compliance Frameworks category');
    }

    const compliance = [
      { name: 'OSHA Framework', order: 1, description: 'Federal workplace safety' }, // Renamed
      { name: 'FDA', order: 2, description: 'Food and Drug Administration' },
      { name: 'State ABC', order: 3, description: 'State Alcohol Beverage Control' },
      { name: 'State Health Dept', order: 4, description: 'State health regulations' },
      { name: 'State Lottery', order: 5, description: 'State lottery commission' },
      { name: 'State Labor Board', order: 6, description: 'State employment regulations' }
    ];

    for (const item of compliance) {
      const { data: existing } = await supabase
        .from('tags')
        .select('id')
        .eq('name', item.name)
        .eq('parent_id', complianceCategoryId)
        .single();

      const color = item.order % 2 === 0 ? '#F74A05' : '#FF733C';

      if (!existing) {
        await createTag({
          name: item.name,
          parent_id: complianceCategoryId,
          system_category: 'shared',
          description: item.description,
          display_order: item.order,
          color: color
        });
      }
    }
    console.log(`✅ Compliance framework tags synced`);

    console.log('🎉 SHARED system seeded successfully!');
    console.log(`📊 Total: 1 system, 3 categories, ${states.length + sectors.length + compliance.length} tags`);

  } catch (error) {
    console.error('❌ Error seeding SHARED tags:', error);
    throw error;
  }
}
