// ============================================================================
// FORMS CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId, getCurrentUserProfile } from '../supabase';
import { createNotification } from './notifications';
import { logActivity } from './activity';

export interface CreateFormInput {
  title: string;
  description?: string;
  type: 'ojt-checklist' | 'inspection' | 'audit' | 'survey';
  category?: string;
  requires_approval?: boolean;
  allow_anonymous?: boolean;
}

export interface FormBlockInput {
  block_type: string;
  label: string;
  description?: string;
  placeholder?: string;
  options?: any;
  validation_rules?: any;
  is_required?: boolean;
  display_order: number;
  settings?: any;
}

export interface FormSection {
  id: string;
  form_id: string;
  title: string;
  description?: string;
  display_order: number;
  is_repeatable: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormBlockUpsert {
  id?: string;           // undefined = new block (INSERT), present = existing (UPDATE)
  form_id: string;
  section_id?: string | null;
  block_type: string;
  label: string;
  description?: string;
  placeholder?: string;
  options?: any;
  validation_rules?: any;
  conditional_logic?: any;
  settings?: any;
  is_required?: boolean;
  display_order: number;
}

export interface FormWithSections {
  id: string;
  organization_id: string;
  title: string;
  description?: string;
  type: string;
  category?: string;
  status: string;
  requires_approval: boolean;
  allow_anonymous: boolean;
  is_template?: boolean;
  source_template_id?: string;
  slug?: string;
  tags?: string[];
  current_version?: number;
  created_by_id?: string;
  created_at: string;
  updated_at: string;
  form_sections: FormSection[];
  form_blocks: any[];
}

/**
 * Create a new form (defaults to draft)
 */
export async function createForm(input: CreateFormInput, orgId?: string) {
  const resolvedOrgId = orgId || await getCurrentUserOrgId();
  const userProfile = await getCurrentUserProfile();

  if (!resolvedOrgId) throw new Error('Organization ID required');
  if (!userProfile && !orgId) throw new Error('User not authenticated');

  const { data: form, error } = await supabase
    .from('forms')
    .insert({
      organization_id: resolvedOrgId,
      title: input.title,
      description: input.description,
      type: input.type,
      category: input.category,
      status: 'draft',
      requires_approval: input.requires_approval || false,
      allow_anonymous: input.allow_anonymous || false,
      created_by_id: userProfile?.id || null
    })
    .select()
    .single();

  if (error) throw error;
  return form;
}

/**
 * Update form metadata
 */
export async function updateForm(
  formId: string,
  updates: Partial<CreateFormInput> & { status?: 'draft' | 'published' | 'archived'; is_template?: boolean }
) {
  const { data, error } = await supabase
    .from('forms')
    .update(updates)
    .eq('id', formId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Publish form
 */
export async function publishForm(formId: string) {
  return updateForm(formId, { status: 'published' });
}

/**
 * Archive form
 */
export async function archiveForm(formId: string) {
  return updateForm(formId, { status: 'archived' });
}

/**
 * Add block to form (saved immediately)
 */
export async function addFormBlock(formId: string, block: FormBlockInput) {
  const { data, error } = await supabase
    .from('form_blocks')
    .insert({
      form_id: formId,
      ...block
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update form block
 */
export async function updateFormBlock(
  blockId: string,
  updates: Partial<FormBlockInput>
) {
  const { data, error } = await supabase
    .from('form_blocks')
    .update(updates)
    .eq('id', blockId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete form block
 */
export async function deleteFormBlock(blockId: string) {
  const { error } = await supabase
    .from('form_blocks')
    .delete()
    .eq('id', blockId);

  if (error) throw error;
}

/**
 * Reorder form blocks (drag-drop support)
 */
export async function reorderFormBlocks(
  formId: string,
  blockOrders: { id: string; display_order: number }[]
) {
  // Update each block's display_order
  const promises = blockOrders.map(({ id, display_order }) =>
    supabase
      .from('form_blocks')
      .update({ display_order })
      .eq('id', id)
  );

  await Promise.all(promises);
}

/**
 * Get form with all blocks
 */
export async function getFormById(formId: string) {
  const { data, error } = await supabase
    .from('forms')
    .select(`
      *,
      created_by:users(name, email),
      form_blocks(*)
    `)
    .eq('id', formId)
    .single();

  if (error) throw error;

  // Sort blocks by display_order
  if (data.form_blocks) {
    data.form_blocks.sort((a: any, b: any) => a.display_order - b.display_order);
  }

  return data;
}

/**
 * Get all forms with filters
 */
export async function getForms(
  filters: {
    type?: string;
    status?: string;
    search?: string;
    is_template?: boolean;
  } = {},
  orgId?: string
) {
  const resolvedOrgId = orgId || await getCurrentUserOrgId();
  if (!resolvedOrgId) throw new Error('Organization ID required');

  let query = supabase
    .from('forms')
    .select(`
      *,
      created_by:users(name)
    `)
    .eq('organization_id', resolvedOrgId);

  if (filters.type) {
    query = query.eq('type', filters.type);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.search) {
    query = query.ilike('title', `%${filters.search}%`);
  }

  if (filters.is_template !== undefined) {
    query = query.eq('is_template', filters.is_template);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Submit form response
 */
export async function submitFormResponse(
  formId: string,
  responseData: any,
  submittedById?: string
) {
  const userProfile = submittedById 
    ? await supabase.from('users').select('id').eq('id', submittedById).single()
    : await getCurrentUserProfile();

  const { data: submission, error } = await supabase
    .from('form_submissions')
    .insert({
      form_id: formId,
      submitted_by_id: userProfile?.data?.id || userProfile?.id,
      response_data: responseData,
      status: 'pending',
      submitted_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;

  // Get form details for notification
  const { data: form } = await supabase
    .from('forms')
    .select('title, created_by_id, requires_approval')
    .eq('id', formId)
    .single();

  // If requires approval, notify creator/admins (non-critical - wrap in try-catch)
  if (form?.requires_approval && form.created_by_id) {
    try {
      await createNotification({
        user_id: form.created_by_id,
        type: 'form-submitted',
        title: 'Form Submission Requires Approval',
        message: `A submission for "${form.title}" needs your review`,
        link_url: `/forms/${formId}/submissions/${submission.id}`
      });
    } catch (error) {
      // Log error but don't fail the form submission
      console.error('Failed to create form submission notification:', error);
    }
  }

  // Log activity (non-critical - wrap in try-catch)
  try {
    await logActivity({
      user_id: userProfile?.data?.id || userProfile?.id,
      action: 'form-submission',
      entity_type: 'form',
      entity_id: formId,
      description: `Submitted form "${form?.title}"`
    });
  } catch (error) {
    // Log error but don't fail the form submission
    console.error('Failed to log form submission activity:', error);
  }

  return submission;
}

/**
 * Approve form submission (admin only)
 */
export async function approveFormSubmission(
  submissionId: string,
  approverId: string
) {
  const { data, error } = await supabase
    .from('form_submissions')
    .update({
      status: 'approved',
      approved_by_id: approverId,
      approved_at: new Date().toISOString()
    })
    .eq('id', submissionId)
    .select(`
      *,
      submitted_by:users!form_submissions_submitted_by_id_fkey(id, name),
      form:forms(title)
    `)
    .single();

  if (error) throw error;

  // Notify submitter
  if (data.submitted_by_id) {
    await createNotification({
      user_id: data.submitted_by_id,
      type: 'approval-required',
      title: 'Form Submission Approved',
      message: `Your submission for "${(data.form as any)?.title}" was approved`,
      link_url: `/forms/${data.form_id}/submissions/${submissionId}`
    });
  }

  return data;
}

/**
 * Reject form submission (admin only)
 */
export async function rejectFormSubmission(
  submissionId: string,
  approverId: string
) {
  const { data, error } = await supabase
    .from('form_submissions')
    .update({
      status: 'rejected',
      approved_by_id: approverId,
      approved_at: new Date().toISOString()
    })
    .eq('id', submissionId)
    .select(`
      *,
      submitted_by:users!form_submissions_submitted_by_id_fkey(id, name),
      form:forms(title)
    `)
    .single();

  if (error) throw error;

  // Notify submitter
  if (data.submitted_by_id) {
    await createNotification({
      user_id: data.submitted_by_id,
      type: 'approval-required',
      title: 'Form Submission Rejected',
      message: `Your submission for "${(data.form as any)?.title}" was rejected`,
      link_url: `/forms/${data.form_id}/submissions/${submissionId}`
    });
  }

  return data;
}

/**
 * Get form submissions with filters
 */
export async function getFormSubmissions(
  formId: string,
  filters: { status?: string } = {}
) {
  let query = supabase
    .from('form_submissions')
    .select(`
      *,
      submitted_by:users!form_submissions_submitted_by_id_fkey(name, email),
      approved_by:users!form_submissions_approved_by_id_fkey(name, email)
    `)
    .eq('form_id', formId);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query.order('submitted_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Assign form to users/groups
 */
export async function assignForm(
  formId: string,
  assignmentType: 'user' | 'store' | 'district' | 'role' | 'group',
  targetId: string,
  dueDate?: string
) {
  const userProfile = await getCurrentUserProfile();
  if (!userProfile) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('form_assignments')
    .insert({
      form_id: formId,
      assignment_type: assignmentType,
      target_id: targetId,
      assigned_by_id: userProfile.id,
      due_date: dueDate,
      status: 'active'
    })
    .select()
    .single();

  if (error) throw error;

  // Get form title for notification
  const { data: form } = await supabase
    .from('forms')
    .select('title')
    .eq('id', formId)
    .single();

  // Create notifications for affected users
  const affectedUsers = await getAffectedUsersForFormAssignment(assignmentType, targetId);
  
  for (const userId of affectedUsers) {
    await createNotification({
      user_id: userId,
      type: 'assignment',
      title: 'New Form Assigned',
      message: `You have been assigned form: "${form?.title}"`,
      link_url: `/forms/${formId}`
    });
  }

  return data;
}

// ============================================================================
// FORM SECTIONS
// ============================================================================

/**
 * Get a form with its sections and blocks, sorted correctly
 */
export async function getFormWithSections(formId: string, orgId?: string): Promise<FormWithSections | null> {
  const resolvedOrgId = orgId || await getCurrentUserOrgId();
  if (!resolvedOrgId) throw new Error('Organization ID required');

  const { data, error } = await supabase
    .from('forms')
    .select(`
      *,
      form_sections(*),
      form_blocks(*)
    `)
    .eq('id', formId)
    .eq('organization_id', resolvedOrgId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // Sort sections by display_order ASC
  if (data.form_sections) {
    data.form_sections.sort((a: FormSection, b: FormSection) => a.display_order - b.display_order);
  }

  // Sort blocks: section_id NULLS FIRST, then display_order ASC
  if (data.form_blocks) {
    data.form_blocks.sort((a: any, b: any) => {
      if (a.section_id === null && b.section_id !== null) return -1;
      if (a.section_id !== null && b.section_id === null) return 1;
      return a.display_order - b.display_order;
    });
  }

  return data as FormWithSections;
}

/**
 * Create a new form section
 */
export async function createFormSection(
  formId: string,
  section: { title: string; description?: string; display_order: number },
  orgId?: string
): Promise<FormSection> {
  const resolvedOrgId = orgId || await getCurrentUserOrgId();
  if (!resolvedOrgId) throw new Error('Organization ID required');

  const { data, error } = await supabase
    .from('form_sections')
    .insert({
      form_id: formId,
      title: section.title,
      description: section.description,
      display_order: section.display_order,
      is_repeatable: false
    })
    .select()
    .single();

  if (error) throw error;
  return data as FormSection;
}

/**
 * Update a form section
 */
export async function updateFormSection(
  sectionId: string,
  updates: Partial<{ title: string; description: string; display_order: number; is_repeatable: boolean }>
): Promise<FormSection> {
  const { data, error } = await supabase
    .from('form_sections')
    .update(updates)
    .eq('id', sectionId)
    .select()
    .single();

  if (error) throw error;
  return data as FormSection;
}

/**
 * Delete a form section
 * Blocks in this section have section_id set to NULL by DB cascade (ON DELETE SET NULL).
 */
export async function deleteFormSection(sectionId: string): Promise<void> {
  const { error } = await supabase
    .from('form_sections')
    .delete()
    .eq('id', sectionId);

  if (error) throw error;
}

// ============================================================================
// BULK BLOCK UPSERT (AUTO-SAVE)
// ============================================================================

/**
 * Bulk upsert form blocks — the key function for the auto-save pattern.
 * Inserts new blocks (no id), updates existing blocks (has id), and
 * deletes any blocks for the form that are no longer in the provided list.
 */
export async function bulkUpsertFormBlocks(
  formId: string,
  blocks: FormBlockUpsert[]
): Promise<void> {
  const toInsert = blocks.filter(b => !b.id);
  const toUpdate = blocks.filter(b => !!b.id);

  // Helper: map block_type → type; merge settings into validation_rules (settings column doesn't exist in schema)
  const toDbRow = (b: FormBlockUpsert) => {
    const { block_type, settings, validation_rules, ...rest } = b;
    const mergedRules = (settings && Object.keys(settings).length > 0)
      ? { ...(validation_rules || {}), _settings: settings }
      : (validation_rules || undefined);
    return { ...rest, type: block_type, validation_rules: mergedRules, form_id: formId };
  };

  // Step 1: Delete blocks that are no longer in the provided list.
  // Must happen BEFORE insert so newly inserted IDs aren't accidentally deleted.
  const incomingIds = toUpdate.map(b => b.id as string).filter(Boolean);

  const { data: currentBlocks, error: fetchError } = await supabase
    .from('form_blocks')
    .select('id')
    .eq('form_id', formId);

  if (fetchError) throw fetchError;

  const idsToDelete = (currentBlocks || [])
    .map((b: any) => b.id as string)
    .filter(id => !incomingIds.includes(id));

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('form_blocks')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) throw deleteError;
  }

  // Step 2: Insert new blocks
  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('form_blocks')
      .insert(toInsert.map(toDbRow));

    if (insertError) throw insertError;
  }

  // Step 3: Update existing blocks in parallel
  if (toUpdate.length > 0) {
    const updateResults = await Promise.all(
      toUpdate.map(b => {
        const { id, ...rowWithId } = toDbRow(b) as any;
        return supabase
          .from('form_blocks')
          .update(rowWithId)
          .eq('id', b.id as string);
      })
    );

    for (const result of updateResults) {
      if (result.error) throw result.error;
    }
  }

}

// ============================================================================
// FORM DUPLICATION & TEMPLATE CLONING
// ============================================================================

/**
 * Duplicate a form within the same org
 */
export async function duplicateForm(formId: string, orgId: string): Promise<{ id: string }> {
  const original = await getFormWithSections(formId, orgId);
  if (!original) throw new Error(`Form ${formId} not found`);

  // Insert the new form
  const { data: newForm, error: formError } = await supabase
    .from('forms')
    .insert({
      organization_id: orgId,
      title: `${original.title} (Copy)`,
      description: original.description,
      type: original.type,
      category: original.category,
      status: 'draft',
      requires_approval: original.requires_approval,
      allow_anonymous: original.allow_anonymous,
      is_template: original.is_template || false,
      source_template_id: null,
      slug: null,
      tags: original.tags,
      created_by_id: original.created_by_id || null
    })
    .select('id')
    .single();

  if (formError) throw formError;
  const newFormId = newForm.id as string;

  // Map old section_id → new section_id
  const sectionIdMap: Record<string, string> = {};

  if (original.form_sections && original.form_sections.length > 0) {
    const sectionsToInsert = original.form_sections.map(s => ({
      form_id: newFormId,
      title: s.title,
      description: s.description,
      display_order: s.display_order,
      is_repeatable: s.is_repeatable
    }));

    const { data: newSections, error: sectionsError } = await supabase
      .from('form_sections')
      .insert(sectionsToInsert)
      .select('id, display_order');

    if (sectionsError) throw sectionsError;

    // Map original sections to new sections by display_order position
    original.form_sections.forEach((oldSection, index) => {
      if (newSections && newSections[index]) {
        sectionIdMap[oldSection.id] = newSections[index].id as string;
      }
    });
  }

  // Insert blocks with remapped section_ids
  if (original.form_blocks && original.form_blocks.length > 0) {
    const blocksToInsert = original.form_blocks.map((b: any) => ({
      form_id: newFormId,
      section_id: b.section_id ? (sectionIdMap[b.section_id] || null) : null,
      type: b.type,
      label: b.label,
      description: b.description,
      placeholder: b.placeholder,
      options: b.options,
      validation_rules: b.validation_rules,
      conditional_logic: b.conditional_logic,
      settings: b.settings,
      is_required: b.is_required,
      display_order: b.display_order
    }));

    const { error: blocksError } = await supabase
      .from('form_blocks')
      .insert(blocksToInsert);

    if (blocksError) throw blocksError;
  }

  return { id: newFormId };
}

/**
 * Clone a form to a different org (used for template cloning)
 */
export async function cloneFormToOrg(formId: string, targetOrgId: string): Promise<{ id: string }> {
  // Fetch the source form — no org filter since templates can be cross-org
  const { data: original, error: fetchError } = await supabase
    .from('forms')
    .select(`
      *,
      form_sections(*),
      form_blocks(*)
    `)
    .eq('id', formId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!original) throw new Error(`Form ${formId} not found`);

  // Sort sections and blocks for deterministic ordering
  const sections: FormSection[] = (original.form_sections || []).sort(
    (a: FormSection, b: FormSection) => a.display_order - b.display_order
  );
  const blocks: any[] = (original.form_blocks || []).sort(
    (a: any, b: any) => a.display_order - b.display_order
  );

  // Insert the new form into target org
  const { data: newForm, error: formError } = await supabase
    .from('forms')
    .insert({
      organization_id: targetOrgId,
      title: original.title,
      description: original.description,
      type: original.type,
      category: original.category,
      status: 'draft',
      requires_approval: original.requires_approval,
      allow_anonymous: original.allow_anonymous,
      is_template: false,
      source_template_id: formId,
      slug: null,
      tags: original.tags,
      created_by_id: null
    })
    .select('id')
    .single();

  if (formError) throw formError;
  const newFormId = newForm.id as string;

  // Map old section_id → new section_id
  const sectionIdMap: Record<string, string> = {};

  if (sections.length > 0) {
    const sectionsToInsert = sections.map(s => ({
      form_id: newFormId,
      title: s.title,
      description: s.description,
      display_order: s.display_order,
      is_repeatable: s.is_repeatable
    }));

    const { data: newSections, error: sectionsError } = await supabase
      .from('form_sections')
      .insert(sectionsToInsert)
      .select('id, display_order');

    if (sectionsError) throw sectionsError;

    sections.forEach((oldSection, index) => {
      if (newSections && newSections[index]) {
        sectionIdMap[oldSection.id] = newSections[index].id as string;
      }
    });
  }

  // Insert blocks with remapped section_ids
  if (blocks.length > 0) {
    const blocksToInsert = blocks.map((b: any) => ({
      form_id: newFormId,
      section_id: b.section_id ? (sectionIdMap[b.section_id] || null) : null,
      type: b.type,
      label: b.label,
      description: b.description,
      placeholder: b.placeholder,
      options: b.options,
      validation_rules: b.validation_rules,
      conditional_logic: b.conditional_logic,
      settings: b.settings,
      is_required: b.is_required,
      display_order: b.display_order
    }));

    const { error: blocksError } = await supabase
      .from('form_blocks')
      .insert(blocksToInsert);

    if (blocksError) throw blocksError;
  }

  return { id: newFormId };
}

// ============================================================================
// TEMPLATES & SOFT DELETE
// ============================================================================

/**
 * Get all forms marked as templates (Trike org — global, no org filter)
 */
export async function getTemplateForms(): Promise<any[]> {
  const { data, error } = await supabase
    .from('forms')
    .select(`
      *,
      created_by:users(name)
    `)
    .eq('is_template', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Soft delete a form by setting status to 'archived'
 */
export async function deleteForm(formId: string): Promise<void> {
  const { error } = await supabase
    .from('forms')
    .update({ status: 'archived' })
    .eq('id', formId);

  if (error) throw error;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getAffectedUsersForFormAssignment(
  assignmentType: string,
  targetId: string
): Promise<string[]> {
  if (assignmentType === 'user') {
    return [targetId];
  }

  if (assignmentType === 'store') {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('store_id', targetId)
      .eq('status', 'active');

    return users?.map(u => u.id) || [];
  }

  if (assignmentType === 'district') {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('district_id', targetId)
      .eq('status', 'active');

    return users?.map(u => u.id) || [];
  }

  if (assignmentType === 'role') {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('role_id', targetId)
      .eq('status', 'active');

    return users?.map(u => u.id) || [];
  }

  return [];
}