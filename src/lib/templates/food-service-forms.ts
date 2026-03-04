/**
 * Pre-built Form Templates for Trike Kitchen Food Service
 *
 * These templates integrate with the existing Trike forms system and can be
 * deployed to organizations on activation of the food service module.
 */

// =====================================================
// WASTE LOG FORM TEMPLATE
// =====================================================

export const WASTE_LOG_FORM_TEMPLATE = {
  title: 'Daily Waste Log',
  description: 'Track food waste by type and reason to identify cost leakage',
  category: 'food_service',
  requires_approval: false,
  allow_anonymous: false,
  settings: {
    submit_button_text: 'Log Waste',
    success_message: 'Waste log submitted successfully',
    show_progress: true,
  },
  form_blocks: [
    {
      type: 'section',
      label: 'Waste Information',
      description: 'Record details about wasted food items',
      display_order: 1,
    },
    {
      type: 'date',
      label: 'Date',
      description: 'Date of waste occurrence',
      is_required: true,
      display_order: 2,
      validation_rules: {
        max: 'today', // Cannot log future waste
      },
    },
    {
      type: 'select',
      label: 'Waste Type',
      description: 'Select the reason for waste',
      options: [
        'Production Waste',
        'Spoilage',
        'Overproduction',
        'Customer Return',
        'Quality Discard',
        'Theft Suspected',
        'Sample/Employee Meal',
        'Other',
      ],
      is_required: true,
      display_order: 3,
    },
    {
      type: 'select',
      label: 'Item Type',
      description: 'Was this a prepared recipe or raw ingredient?',
      options: ['Recipe (Prepared Item)', 'Raw Ingredient'],
      is_required: true,
      display_order: 4,
    },
    {
      type: 'select',
      label: 'Recipe',
      description: 'Select the recipe that was wasted',
      options: [], // Populated dynamically from recipes table
      is_required: true,
      display_order: 5,
      conditional_logic: {
        show_if: {
          field: 'Item Type',
          value: 'Recipe (Prepared Item)',
        },
      },
    },
    {
      type: 'select',
      label: 'Ingredient',
      description: 'Select the ingredient that was wasted',
      options: [], // Populated dynamically from ingredients table
      is_required: true,
      display_order: 6,
      conditional_logic: {
        show_if: {
          field: 'Item Type',
          value: 'Raw Ingredient',
        },
      },
    },
    {
      type: 'number',
      label: 'Quantity',
      description: 'How much was wasted?',
      is_required: true,
      display_order: 7,
      validation_rules: {
        min: 0.1,
      },
    },
    {
      type: 'select',
      label: 'Unit of Measure',
      description: 'Unit for the quantity wasted',
      options: ['oz', 'lb', 'each', 'case', 'serving', 'gallon', 'quart'],
      is_required: true,
      display_order: 8,
    },
    {
      type: 'select',
      label: 'Daypart',
      description: 'When did this waste occur? (optional)',
      options: ['Breakfast', 'Lunch', 'Dinner', 'Overnight'],
      is_required: false,
      display_order: 9,
    },
    {
      type: 'textarea',
      label: 'Reason / Notes',
      description: 'Additional details about why this item was wasted',
      placeholder: 'Example: Made too many breakfast burritos, didnt sell during morning rush',
      is_required: false,
      display_order: 10,
    },
    {
      type: 'file',
      label: 'Photo (optional)',
      description: 'Upload a photo of the wasted item if helpful for review',
      is_required: false,
      display_order: 11,
      validation_rules: {
        accept: 'image/*',
        max_size: 5242880, // 5 MB
      },
    },
  ],
};

// =====================================================
// PRODUCTION LOG FORM TEMPLATE
// =====================================================

export const PRODUCTION_LOG_FORM_TEMPLATE = {
  title: 'Daily Production Log',
  description: 'Track what was produced, sold, and wasted to analyze efficiency',
  category: 'food_service',
  requires_approval: false,
  allow_anonymous: false,
  settings: {
    submit_button_text: 'Log Production',
    success_message: 'Production log submitted successfully',
    show_progress: true,
  },
  form_blocks: [
    {
      type: 'section',
      label: 'Production Information',
      description: 'Record production quantities for a recipe',
      display_order: 1,
    },
    {
      type: 'date',
      label: 'Production Date',
      description: 'Date this batch was produced',
      is_required: true,
      display_order: 2,
      validation_rules: {
        max: 'today',
      },
    },
    {
      type: 'select',
      label: 'Recipe',
      description: 'Select the recipe that was produced',
      options: [], // Populated dynamically from recipes table
      is_required: true,
      display_order: 3,
    },
    {
      type: 'select',
      label: 'Daypart',
      description: 'When was this batch produced?',
      options: ['Breakfast', 'Lunch', 'Dinner'],
      is_required: true,
      display_order: 4,
    },
    {
      type: 'section',
      label: 'Quantities',
      description: 'Track production, sales, and waste',
      display_order: 5,
    },
    {
      type: 'number',
      label: 'Quantity Produced',
      description: 'How many units were made?',
      is_required: true,
      display_order: 6,
      validation_rules: {
        min: 0,
      },
    },
    {
      type: 'number',
      label: 'Quantity Sold',
      description: 'How many units were sold? (if known)',
      is_required: false,
      display_order: 7,
      validation_rules: {
        min: 0,
      },
    },
    {
      type: 'number',
      label: 'Quantity Wasted',
      description: 'How many units were wasted/discarded?',
      is_required: false,
      display_order: 8,
      validation_rules: {
        min: 0,
      },
    },
    {
      type: 'number',
      label: 'Quantity Held Over',
      description: 'How many units carried to next day?',
      is_required: false,
      display_order: 9,
      validation_rules: {
        min: 0,
      },
    },
    {
      type: 'section',
      label: 'Notes',
      description: 'Optional additional information',
      display_order: 10,
    },
    {
      type: 'textarea',
      label: 'Production Notes',
      description: 'Any issues, substitutions, or observations?',
      placeholder: 'Example: Used turkey bacon instead of regular bacon (out of stock)',
      is_required: false,
      display_order: 11,
    },
  ],
};

// =====================================================
// RECEIVING CHECKLIST FORM TEMPLATE
// =====================================================

export const RECEIVING_CHECKLIST_FORM_TEMPLATE = {
  title: 'Delivery Receiving Checklist',
  description: 'Verify delivery quality and flag substitutions',
  category: 'food_service',
  requires_approval: false,
  allow_anonymous: false,
  settings: {
    submit_button_text: 'Complete Receiving',
    success_message: 'Delivery checked in successfully',
    show_progress: true,
  },
  form_blocks: [
    {
      type: 'section',
      label: 'Delivery Information',
      description: 'Basic delivery details',
      display_order: 1,
    },
    {
      type: 'date',
      label: 'Delivery Date',
      is_required: true,
      display_order: 2,
    },
    {
      type: 'time',
      label: 'Delivery Time',
      is_required: true,
      display_order: 3,
    },
    {
      type: 'select',
      label: 'Vendor',
      description: 'Who delivered this order?',
      options: [], // Populated from vendors table
      is_required: true,
      display_order: 4,
    },
    {
      type: 'text',
      label: 'Invoice Number',
      description: 'Invoice or delivery ticket number',
      is_required: false,
      display_order: 5,
    },
    {
      type: 'section',
      label: 'Quality Checks',
      description: 'Verify product quality',
      display_order: 6,
    },
    {
      type: 'radio',
      label: 'Temperature Check - Frozen Items',
      description: 'Were frozen items delivered at proper temperature?',
      options: ['Pass (0°F or below)', 'Fail (Above 0°F)', 'N/A - No frozen items'],
      is_required: true,
      display_order: 7,
    },
    {
      type: 'radio',
      label: 'Temperature Check - Refrigerated Items',
      description: 'Were refrigerated items delivered at proper temperature?',
      options: ['Pass (41°F or below)', 'Fail (Above 41°F)', 'N/A - No refrigerated items'],
      is_required: true,
      display_order: 8,
    },
    {
      type: 'radio',
      label: 'Packaging Integrity',
      description: 'Was all packaging intact and undamaged?',
      options: ['All intact', 'Minor damage', 'Significant damage', 'Refused items'],
      is_required: true,
      display_order: 9,
    },
    {
      type: 'radio',
      label: 'Product Quality',
      description: 'Overall quality of delivered products?',
      options: ['Acceptable', 'Some concerns', 'Unacceptable - items rejected'],
      is_required: true,
      display_order: 10,
    },
    {
      type: 'section',
      label: 'Substitutions & Issues',
      description: 'Flag any substitutions or problems',
      display_order: 11,
    },
    {
      type: 'checkbox',
      label: 'Issues Encountered',
      description: 'Check all that apply',
      options: [
        'Substitutions made',
        'Missing items',
        'Wrong items delivered',
        'Damaged products',
        'Temperature violations',
        'Quantity discrepancies',
      ],
      is_required: false,
      display_order: 12,
    },
    {
      type: 'textarea',
      label: 'Issue Details',
      description: 'Describe substitutions, missing items, or problems',
      placeholder: 'Example: American cheese substituted with Swiss. Missing 2 cases of ground beef.',
      is_required: false,
      display_order: 13,
      conditional_logic: {
        show_if: {
          field: 'Issues Encountered',
          has_any: true, // Show if any checkbox is checked
        },
      },
    },
    {
      type: 'file',
      label: 'Photo of Issues',
      description: 'Upload photos of damaged items or substitutions',
      is_required: false,
      display_order: 14,
      validation_rules: {
        accept: 'image/*',
        max_size: 5242880, // 5 MB
      },
      conditional_logic: {
        show_if: {
          field: 'Issues Encountered',
          has_any: true,
        },
      },
    },
  ],
};

// =====================================================
// TEMPERATURE LOG FORM TEMPLATE
// =====================================================

export const TEMPERATURE_LOG_FORM_TEMPLATE = {
  title: 'Temperature Log',
  description: 'Record equipment temperatures for food safety compliance',
  category: 'food_service',
  requires_approval: false,
  allow_anonymous: false,
  settings: {
    submit_button_text: 'Submit Temperature Log',
    success_message: 'Temperature log recorded',
    show_progress: false,
  },
  form_blocks: [
    {
      type: 'date',
      label: 'Date',
      is_required: true,
      display_order: 1,
    },
    {
      type: 'time',
      label: 'Time',
      is_required: true,
      display_order: 2,
    },
    {
      type: 'section',
      label: 'Walk-in Cooler',
      display_order: 3,
    },
    {
      type: 'number',
      label: 'Walk-in Cooler Temperature (°F)',
      description: 'Must be 41°F or below',
      is_required: true,
      display_order: 4,
      validation_rules: {
        min: -10,
        max: 60,
      },
    },
    {
      type: 'section',
      label: 'Walk-in Freezer',
      display_order: 5,
    },
    {
      type: 'number',
      label: 'Walk-in Freezer Temperature (°F)',
      description: 'Must be 0°F or below',
      is_required: true,
      display_order: 6,
      validation_rules: {
        min: -20,
        max: 20,
      },
    },
    {
      type: 'section',
      label: 'Prep Cooler',
      display_order: 7,
    },
    {
      type: 'number',
      label: 'Prep Cooler Temperature (°F)',
      description: 'Must be 41°F or below',
      is_required: false,
      display_order: 8,
      validation_rules: {
        min: -10,
        max: 60,
      },
    },
    {
      type: 'section',
      label: 'Hot Holding',
      display_order: 9,
    },
    {
      type: 'number',
      label: 'Hot Holding Unit Temperature (°F)',
      description: 'Must be 135°F or above',
      is_required: false,
      display_order: 10,
      validation_rules: {
        min: 100,
        max: 200,
      },
    },
    {
      type: 'section',
      label: 'Corrective Actions',
      display_order: 11,
    },
    {
      type: 'textarea',
      label: 'Notes / Corrective Actions',
      description: 'Document any out-of-range temperatures and actions taken',
      placeholder: 'Example: Walk-in cooler at 45°F. Adjusted thermostat to 38°F. Will recheck in 1 hour.',
      is_required: false,
      display_order: 12,
    },
  ],
};

// =====================================================
// TEMPLATE REGISTRY
// =====================================================

export const FOOD_SERVICE_FORM_TEMPLATES = {
  waste_log: WASTE_LOG_FORM_TEMPLATE,
  production_log: PRODUCTION_LOG_FORM_TEMPLATE,
  receiving_checklist: RECEIVING_CHECKLIST_FORM_TEMPLATE,
  temperature_log: TEMPERATURE_LOG_FORM_TEMPLATE,
};

// =====================================================
// TEMPLATE DEPLOYMENT FUNCTION
// =====================================================

/**
 * Deploy food service form templates to an organization
 * This should be called when an organization activates the food service module
 */
export async function deployFoodServiceForms(organizationId: string, userId: string) {
  // This function would use the existing createForm function from forms.ts
  // to create instances of these templates for the organization
  //
  // Example:
  // const wasteLogForm = await createForm(organizationId, userId, WASTE_LOG_FORM_TEMPLATE);
  // const productionLogForm = await createForm(organizationId, userId, PRODUCTION_LOG_FORM_TEMPLATE);
  // etc.
  //
  // Return the created form IDs for reference
}

// =====================================================
// DYNAMIC OPTION POPULATION
// =====================================================

/**
 * Helper function to populate form options from database
 * For use when rendering forms in the UI
 */
export async function populateFoodServiceFormOptions(
  formTemplate: any,
  organizationId: string
): Promise<any> {
  // This function would:
  // 1. Find all select fields with empty options arrays
  // 2. Determine what data source they need (recipes, ingredients, vendors)
  // 3. Query the database for those options
  // 4. Return the form template with options populated
  //
  // Example for Recipe field:
  // const recipes = await getRecipes(organizationId);
  // const recipeOptions = recipes.data.map(r => ({ label: r.name, value: r.id }));
  //
  // Would need to be implemented in the React component that renders forms
}
