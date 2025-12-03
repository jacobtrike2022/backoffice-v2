// ============================================================================
// ALL SYSTEMS SEED - Production Starter Kit
// Seeds Content, Units, People, Forms, and Knowledge Base with ~150 tags
// Uses Trike brand colors: #F74A05, #FF733C, neutrals
// UNIQUE NAMES ENFORCED to prevent "duplicate key" errors
// ============================================================================

import { supabase, getCurrentUserOrgId } from '../supabase';

interface TagSeed {
  name: string;
  description?: string;
  color?: string;
  children?: TagSeed[];
}

const CONTENT_TAGS: TagSeed[] = [
  {
    name: 'Content Type',
    description: 'Format and delivery method',
    children: [
      { name: 'Video Content', description: 'Video content', color: '#F74A05' },
      { name: 'Document File', description: 'PDF, text documents', color: '#FF733C' },
      { name: 'Quiz Module', description: 'Knowledge checks', color: '#F74A05' },
      { name: 'Interactive Module', description: 'Scenario-based learning', color: '#FF733C' },
      { name: 'Assessment Test', description: 'Formal testing', color: '#F74A05' },
      { name: 'Microlearning', description: '<5 min content', color: '#FF733C' },
      { name: 'Live Session', description: 'Instructor-led', color: '#F74A05' }
    ]
  },
  {
    name: 'Topic Category',
    description: 'Subject matter area',
    children: [
      { name: 'Safety Training', color: '#F74A05' },
      { name: 'Store Ops Topics', color: '#FF733C' },
      { name: 'Regulatory Compliance', color: '#F74A05' },
      { name: 'Product Knowledge', color: '#FF733C' },
      { name: 'Customer Svc Skills', color: '#F74A05' },
      { name: 'Leadership Skills', color: '#FF733C' },
      { name: 'Sales Techniques', color: '#F74A05' },
      { name: 'Tech Systems', color: '#7F8C8D' },
      { name: 'Inventory Mgmt', color: '#95A5A6' },
      { name: 'Open/Close Procedures', color: '#FF733C' }
    ]
  },
  {
    name: 'Target Audience',
    description: 'Intended viewer role',
    children: [
      { name: 'All Staff Audience', color: '#F74A05' },
      { name: 'New Hires', color: '#FF733C' },
      { name: 'Managers Audience', color: '#F74A05' },
      { name: 'Cashiers Audience', color: '#FF733C' },
      { name: 'Stock Team', color: '#F74A05' },
      { name: 'Dept Leads', color: '#FF733C' },
      { name: 'District Mgrs', color: '#7F8C8D' },
      { name: 'Pharmacy Staff', color: '#F74A05' }
    ]
  },
  {
    name: 'Difficulty Level',
    description: 'Content complexity',
    children: [
      { name: 'Beginner Level', description: 'No prior knowledge needed', color: '#95A5A6' },
      { name: 'Intermediate Level', description: 'Some experience required', color: '#FF733C' },
      { name: 'Advanced Level', description: 'Expert level content', color: '#F74A05' },
      { name: 'Refresher', description: 'Review/update', color: '#7F8C8D' }
    ]
  }
];

const UNITS_TAGS: TagSeed[] = [
  {
    name: 'Department',
    description: 'Store departments/sections',
    children: [
      { name: 'Front End Dept', description: 'Cashiers, customer service', color: '#F74A05' },
      { name: 'Grocery Dept', description: 'Dry goods, canned foods', color: '#FF733C' },
      { name: 'Produce Dept', description: 'Fresh fruits & vegetables', color: '#F74A05' },
      { name: 'Meat & Deli Dept', description: 'Butcher, deli counter', color: '#FF733C' },
      { name: 'Bakery Dept', description: 'Baked goods', color: '#F74A05' },
      { name: 'Pharmacy Dept', description: 'Prescriptions', color: '#FF733C' },
      { name: 'Receiving Dept', description: 'Stock, deliveries', color: '#95A5A6' },
      { name: 'Admin Office', description: 'Office, admin', color: '#7F8C8D' },
      { name: 'Prepared Foods Dept', description: 'Hot bar, ready-to-eat', color: '#F74A05' },
      { name: 'Floral Dept', description: 'Flowers, plants', color: '#FF733C' }
    ]
  },
  {
    name: 'Store Size',
    description: 'Square footage category',
    children: [
      { name: 'Small Size (<10k)', description: 'Corner store format', color: '#95A5A6' },
      { name: 'Medium Size (10-25k)', description: 'Standard grocery', color: '#FF733C' },
      { name: 'Large Size (25-50k)', description: 'Full-service supermarket', color: '#F74A05' },
      { name: 'Flagship Size (50k+)', description: 'Destination store', color: '#F74A05' }
    ]
  },
  {
    name: 'Equipment Type',
    description: 'Major equipment/systems',
    children: [
      { name: 'POS Systems', color: '#F74A05' },
      { name: 'Refrigeration Units', color: '#FF733C' },
      { name: 'Ovens & Cooking', color: '#F74A05' },
      { name: 'Scales & Measures', color: '#FF733C' },
      { name: 'Security Equipment', color: '#7F8C8D' },
      { name: 'Cleaning Equip', color: '#95A5A6' },
      { name: 'Forklift/Jacks', color: '#F74A05' },
      { name: 'Slicers/Grinders', color: '#FF733C' }
    ]
  },
  {
    name: 'Store Format',
    description: 'Location and layout type',
    children: [
      { name: 'Traditional Grocery', color: '#F74A05' },
      { name: 'Corner Store', color: '#FF733C' },
      { name: 'Mall Location', color: '#F74A05' },
      { name: 'Strip Mall', color: '#FF733C' },
      { name: 'Standalone Bldg', color: '#F74A05' },
      { name: 'Urban Format', color: '#7F8C8D' }
    ]
  }
];

const PEOPLE_TAGS: TagSeed[] = [
  {
    name: 'Job Role',
    description: 'Position in organization',
    children: [
      { name: 'Cashier Role', color: '#F74A05' },
      { name: 'Stocker Role', color: '#FF733C' },
      { name: 'Dept Manager', color: '#F74A05' },
      { name: 'Asst Store Mgr', color: '#FF733C' },
      { name: 'Store Manager', color: '#F74A05' },
      { name: 'District Mgr', color: '#7F8C8D' },
      { name: 'Corp Trainer', color: '#F74A05' },
      { name: 'Pharmacy Tech', color: '#FF733C' },
      { name: 'Baker', color: '#F74A05' },
      { name: 'Butcher', color: '#FF733C' },
      { name: 'Maintenance Staff', color: '#95A5A6' },
      { name: 'HR Rep', color: '#7F8C8D' }
    ]
  },
  {
    name: 'Certifications',
    description: 'Required licenses and certifications',
    children: [
      { name: 'Food Safety Handler', description: 'ServSafe or equivalent', color: '#F74A05' },
      { name: 'OSHA Safety Cert', description: 'Workplace safety', color: '#FF733C' },
      { name: 'First Aid/CPR', description: 'Emergency response', color: '#F74A05' },
      { name: 'Forklift License', description: 'Powered equipment', color: '#FF733C' },
      { name: 'Alcohol Sales Permit', description: 'TIPS or state requirement', color: '#F74A05' },
      { name: 'Pharma Tech License', description: 'State pharmacy license', color: '#FF733C' },
      { name: 'Manager Cert', description: 'Leadership program', color: '#7F8C8D' },
      { name: 'Allergen Awareness', description: 'Food allergen training', color: '#F74A05' }
    ]
  },
  {
    name: 'Experience Level',
    description: 'Time in role or skill level',
    children: [
      { name: 'Entry Level (0-6mo)', color: '#95A5A6' },
      { name: 'Intermediate (6-24mo)', color: '#FF733C' },
      { name: 'Experienced (2-5yr)', color: '#F74A05' },
      { name: 'Expert (5yr+)', color: '#F74A05' },
      { name: 'Certified Trainer', color: '#FF733C' }
    ]
  },
  {
    name: 'Employment Type',
    description: 'Work arrangement',
    children: [
      { name: 'Full-Time', color: '#F74A05' },
      { name: 'Part-Time', color: '#FF733C' },
      { name: 'Seasonal', color: '#F74A05' },
      { name: 'Temp', color: '#95A5A6' },
      { name: 'Contractor', color: '#7F8C8D' }
    ]
  }
];

const FORMS_TAGS: TagSeed[] = [
  {
    name: 'Form Type',
    description: 'Category of form',
    children: [
      { name: 'Checklist Form', description: 'Task verification', color: '#F74A05' },
      { name: 'Incident Report', description: 'Safety/security events', color: '#FF733C' },
      { name: 'Inspection Form', description: 'Quality audits', color: '#F74A05' },
      { name: 'Survey Form', description: 'Feedback collection', color: '#FF733C' },
      { name: 'Request Form', description: 'Supply/maintenance requests', color: '#F74A05' },
      { name: 'Audit Form', description: 'Compliance verification', color: '#FF733C' },
      { name: 'Feedback Input', description: 'Employee/customer input', color: '#F74A05' },
      { name: 'Timesheet', description: 'Hours tracking', color: '#7F8C8D' }
    ]
  },
  {
    name: 'Workflow Status',
    description: 'Current state in process',
    children: [
      { name: 'Draft Status', color: '#95A5A6' },
      { name: 'Pending Review', color: '#FF733C' },
      { name: 'Approved Status', color: '#F74A05' },
      { name: 'Action Required', color: '#FF733C' },
      { name: 'Completed Status', color: '#F74A05' },
      { name: 'Rejected Status', color: '#7F8C8D' },
      { name: 'Archived Status', color: '#95A5A6' }
    ]
  },
  {
    name: 'Frequency',
    description: 'How often form is required',
    children: [
      { name: 'Daily Freq', color: '#F74A05' },
      { name: 'Weekly Freq', color: '#FF733C' },
      { name: 'Monthly Freq', color: '#F74A05' },
      { name: 'Quarterly Freq', color: '#FF733C' },
      { name: 'Annual Freq', color: '#F74A05' },
      { name: 'As Needed', color: '#95A5A6' },
      { name: 'One-Time', color: '#7F8C8D' }
    ]
  },
  {
    name: 'Department Owner',
    description: 'Responsible department',
    children: [
      { name: 'Safety Dept', color: '#F74A05' },
      { name: 'HR Dept', color: '#7F8C8D' },
      { name: 'Operations Team', color: '#FF733C' },
      { name: 'Maint Team', color: '#95A5A6' },
      { name: 'QA Dept', color: '#F74A05' },
      { name: 'Compliance Dept', color: '#FF733C' },
      { name: 'Store Mgmt Team', color: '#F74A05' }
    ]
  }
];

const KNOWLEDGE_BASE_TAGS: TagSeed[] = [
  {
    name: 'Article Type',
    description: 'Knowledge base content format',
    children: [
      { name: 'How-To Guide', description: 'Step-by-step instructions', color: '#F74A05' },
      { name: 'Policy Doc', description: 'Official policies', color: '#7F8C8D' },
      { name: 'SOP', description: 'Standard Operating Procedure', color: '#FF733C' },
      { name: 'FAQ', description: 'Common questions', color: '#F74A05' },
      { name: 'Troubleshoot', description: 'Problem solving', color: '#FF733C' },
      { name: 'Best Practice', description: 'Recommended approaches', color: '#F74A05' },
      { name: 'Ref Material', description: 'Quick reference', color: '#95A5A6' }
    ]
  },
  {
    name: 'KB Category',
    description: 'Subject area',
    children: [
      { name: 'Ops Manual', color: '#F74A05' },
      { name: 'Safety Procs', color: '#FF733C' },
      { name: 'HR Policy Docs', color: '#7F8C8D' },
      { name: 'IT Help', color: '#95A5A6' },
      { name: 'Equip Guides', color: '#FF733C' },
      { name: 'Cust Svc Policy', color: '#F74A05' },
      { name: 'Comp Docs', color: '#FF733C' },
      { name: 'Prod Info', color: '#F74A05' }
    ]
  },
  {
    name: 'Document Status',
    description: 'Publication state',
    children: [
      { name: 'Draft Doc', color: '#95A5A6' },
      { name: 'In Review Doc', color: '#FF733C' },
      { name: 'Published Doc', color: '#F74A05' },
      { name: 'Update Needed', color: '#FF733C' },
      { name: 'Archived Doc', color: '#7F8C8D' }
    ]
  },
  {
    name: 'Access Level',
    description: 'Who can view this article',
    children: [
      { name: 'All Employees Access', color: '#F74A05' },
      { name: 'Managers Access', color: '#FF733C' },
      { name: 'Dept Only Access', color: '#F74A05' },
      { name: 'Admin Only Access', color: '#7F8C8D' }
    ]
  }
];

export async function seedAllSystems(): Promise<void> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('Organization not found');

  console.log('🌱 Starting full system seed...');

  const systemsToSeed = [
    { category: 'content', name: 'Content', tags: CONTENT_TAGS },
    { category: 'units', name: 'Units', tags: UNITS_TAGS },
    { category: 'people', name: 'People', tags: PEOPLE_TAGS },
    { category: 'forms', name: 'Forms', tags: FORMS_TAGS },
    { category: 'knowledge-base', name: 'Knowledge Base', tags: KNOWLEDGE_BASE_TAGS }
  ];

  for (const system of systemsToSeed) {
    console.log(`📦 Seeding ${system.name} system...`);

    // Check if system category exists
    const { data: existingCategory } = await supabase
      .from('tags')
      .select('id')
      .eq('system_category', system.category)
      .eq('type', 'system-category')
      .single();

    let categoryId = existingCategory?.id;

    // Create system category if it doesn't exist
    if (!categoryId) {
      const { data: newCategory, error: categoryError } = await supabase
        .from('tags')
        .insert({
          organization_id: null, // System categories are global
          name: system.name,
          type: 'system-category',
          system_category: system.category,
          is_system_locked: true,
          display_order: 0
        })
        .select()
        .single();

      if (categoryError) {
        console.error(`Error creating ${system.name} category:`, categoryError);
        throw categoryError;
      }
      categoryId = newCategory.id;
      console.log(`✅ Created ${system.name} system category`);
    } else {
      console.log(`ℹ️  ${system.name} system category already exists`);
    }

    // Seed parent tags and children
    for (const parentTag of system.tags) {
      // Check if parent exists
      const { data: existingParent } = await supabase
        .from('tags')
        .select('id')
        .eq('name', parentTag.name)
        .eq('parent_id', categoryId)
        .single();

      let parentId = existingParent?.id;

      if (!parentId) {
        const { data: newParent, error: parentError } = await supabase
          .from('tags')
          .insert({
            organization_id: orgId,
            name: parentTag.name,
            description: parentTag.description,
            parent_id: categoryId,
            system_category: system.category,
            type: 'parent',
            is_system_locked: false,
            display_order: 0
          })
          .select()
          .single();

        if (parentError) {
          console.error(`Error creating parent tag ${parentTag.name}:`, parentError);
          continue;
        }
        parentId = newParent.id;
      }

      // Seed children
      if (parentTag.children && parentTag.children.length > 0) {
        const childrenToInsert = [];

        for (const child of parentTag.children) {
          // Check if child exists
          const { data: existingChild } = await supabase
            .from('tags')
            .select('id')
            .eq('name', child.name)
            .eq('type', 'child') // Ensure strict type checking
            .single();

          if (!existingChild) {
            childrenToInsert.push({
              organization_id: orgId,
              name: child.name,
              description: child.description,
              color: child.color,
              parent_id: parentId,
              system_category: system.category,
              type: 'child',
              is_system_locked: false,
              display_order: 0
            });
          }
        }

        if (childrenToInsert.length > 0) {
          const { error: childError } = await supabase
            .from('tags')
            .insert(childrenToInsert);

          if (childError) {
            console.error(`Error creating children for ${parentTag.name}:`, childError);
          }
        }
      }
    }

    console.log(`✅ ${system.name} system seeded`);
  }

  console.log('🎉 All systems seeded successfully!');
}
