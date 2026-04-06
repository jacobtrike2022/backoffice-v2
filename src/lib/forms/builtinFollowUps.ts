import type { BlockTemplate } from '../crud/blockGroups';
import { PARENT_PLACEHOLDER } from './blockGroupSerializer';

/**
 * Build the follow-up pack templates for a given trigger answer.
 *
 * When attached to a yes_no block, these three blocks appear conditionally
 * when the user selects the trigger answer (default "No"):
 *   1. Comments / Details  (textarea, required)
 *   2. Photo Evidence      (photo, optional)
 *   3. Follow-Up Required  (text, optional)
 *
 * All conditional logic references use __PARENT__ which gets resolved to
 * the target yes_no block's ID at insertion time.
 */
export function buildFollowUpPack(triggerValue: 'Yes' | 'No' = 'No'): BlockTemplate[] {
  const condition = {
    source_block_id: PARENT_PLACEHOLDER,
    operator: 'equals',
    value: triggerValue,
  };

  return [
    {
      ref_id: 'followup-0',
      block_type: 'textarea',
      label: 'Comments / Details',
      description: 'Explain what was found or observed',
      placeholder: 'Describe the issue...',
      is_required: true,
      conditional_logic: {
        action: 'show' as const,
        operator: 'AND' as const,
        conditions: [{ ...condition }],
      },
    },
    {
      ref_id: 'followup-1',
      block_type: 'photo',
      label: 'Photo Evidence',
      description: 'Attach photo(s) of the issue',
      is_required: false,
      conditional_logic: {
        action: 'show' as const,
        operator: 'AND' as const,
        conditions: [{ ...condition }],
      },
    },
    {
      ref_id: 'followup-2',
      block_type: 'text',
      label: 'Follow-Up Required',
      description: 'Note any follow-up actions needed',
      placeholder: 'e.g. Maintenance ticket #, manager name...',
      is_required: false,
      conditional_logic: {
        action: 'show' as const,
        operator: 'AND' as const,
        conditions: [{ ...condition }],
      },
    },
  ];
}

/** Convenience alias — default "No" trigger pack. */
export const NO_FOLLOWUP_PACK = buildFollowUpPack('No');

/**
 * Marker stored in block.settings to identify blocks created by the
 * built-in follow-up pack (vs. user-created block groups).
 */
export const FOLLOWUP_PACK_MARKER = '_builtin_followup';

/**
 * Settings key that stores which answer triggers the follow-up pack.
 */
export const FOLLOWUP_TRIGGER_KEY = '_followup_trigger';

/**
 * Check whether a block was created by the built-in follow-up pack.
 */
export function isFollowUpPackBlock(settings?: Record<string, unknown>): boolean {
  return !!(settings && settings[FOLLOWUP_PACK_MARKER] === true);
}

/**
 * Get the trigger value from a follow-up parent block's settings.
 * Returns 'No' if not explicitly set.
 */
export function getFollowUpTrigger(settings?: Record<string, unknown>): 'Yes' | 'No' {
  const val = settings?.[FOLLOWUP_TRIGGER_KEY];
  return val === 'Yes' ? 'Yes' : 'No';
}
