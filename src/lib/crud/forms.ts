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

/**
 * Create a new form (defaults to draft)
 */
export async function createForm(input: CreateFormInput) {
  const orgId = await getCurrentUserOrgId();
  const userProfile = await getCurrentUserProfile();
  
  if (!orgId || !userProfile) throw new Error('User not authenticated');

  const { data: form, error } = await supabase
    .from('forms')
    .insert({
      organization_id: orgId,
      title: input.title,
      description: input.description,
      type: input.type,
      category: input.category,
      status: 'draft',
      requires_approval: input.requires_approval || false,
      allow_anonymous: input.allow_anonymous || false,
      created_by_id: userProfile.id
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
  updates: Partial<CreateFormInput> & { status?: 'draft' | 'published' | 'archived' }
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
export async function getForms(filters: {
  type?: string;
  status?: string;
  search?: string;
} = {}) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  let query = supabase
    .from('forms')
    .select(`
      *,
      created_by:users(name)
    `)
    .eq('organization_id', orgId);

  if (filters.type) {
    query = query.eq('type', filters.type);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.search) {
    query = query.ilike('title', `%${filters.search}%`);
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

  // If requires approval, notify creator/admins
  if (form?.requires_approval && form.created_by_id) {
    await createNotification({
      user_id: form.created_by_id,
      type: 'form-submitted',
      title: 'Form Submission Requires Approval',
      message: `A submission for "${form.title}" needs your review`,
      link_url: `/forms/${formId}/submissions/${submission.id}`
    });
  }

  await logActivity({
    user_id: userProfile?.data?.id || userProfile?.id,
    activity_type: 'form-submission',
    entity_type: 'form',
    entity_id: formId,
    description: `Submitted form "${form?.title}"`
  });

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
