// ============================================================================
// FORMS CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId, getCurrentUserProfile } from '../supabase';
import { createNotification } from './notifications';
import { logActivity } from './activity';

export interface CreateFormInput {
  title: string;
  description?: string;
  type: 'ojt-checklist' | 'inspection' | 'audit' | 'survey' | 'other';
  category?: string;
  requires_approval?: boolean;
  allow_anonymous?: boolean;
}

export interface FormBlockInput {
  type: string; // Schema uses 'type', not 'block_type'
  label: string;
  description?: string;
  placeholder?: string;
  options?: any;
  validation_rules?: any;
  is_required?: boolean;
  display_order: number;
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
      created_by:users!forms_created_by_id_fkey(first_name, last_name, email),
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
 * Get all forms with filters and pagination
 */
export async function getForms(filters: {
  type?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  let query = supabase
    .from('forms')
    .select(`
      *,
      created_by:users!forms_created_by_id_fkey(first_name, last_name)
    `, { count: 'exact' })
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

  // Add pagination
  const limit = filters.limit || 20;
  const offset = filters.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return { forms: data, total: count || 0 };
}

/**
 * Submit form response
 */
export async function submitFormResponse(
  formId: string,
  responseData: any,
  submittedById?: string
) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const userProfile = submittedById
    ? await supabase.from('users').select('id').eq('id', submittedById).single()
    : await getCurrentUserProfile();

  const userId = userProfile?.data?.id || userProfile?.id;

  // Fixed column names to match schema:
  // - user_id (not submitted_by_id)
  // - answers (not response_data)
  // - status: 'submitted' (not 'pending' - CHECK constraint doesn't allow 'pending')
  const { data: submission, error } = await supabase
    .from('form_submissions')
    .insert({
      organization_id: orgId,
      form_id: formId,
      user_id: userId,
      answers: responseData,
      status: 'submitted',
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
      user_id: userId,
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
  // Schema uses reviewed_by_id and reviewed_at (not approved_by_id/approved_at)
  const { data, error } = await supabase
    .from('form_submissions')
    .update({
      status: 'approved',
      reviewed_by_id: approverId,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', submissionId)
    .select(`
      *,
      submitted_by:users!form_submissions_user_id_fkey(id, name),
      form:forms(title)
    `)
    .single();

  if (error) throw error;

  // Notify submitter (use user_id, not submitted_by_id)
  if (data.user_id) {
    await createNotification({
      user_id: data.user_id,
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
  approverId: string,
  rejectionReason?: string
) {
  // Schema uses reviewed_by_id and reviewed_at (not approved_by_id/approved_at)
  const { data, error } = await supabase
    .from('form_submissions')
    .update({
      status: 'rejected',
      reviewed_by_id: approverId,
      reviewed_at: new Date().toISOString(),
      review_notes: rejectionReason
    })
    .eq('id', submissionId)
    .select(`
      *,
      submitted_by:users!form_submissions_user_id_fkey(id, name),
      form:forms(title)
    `)
    .single();

  if (error) throw error;

  // Notify submitter (use user_id, not submitted_by_id)
  if (data.user_id) {
    await createNotification({
      user_id: data.user_id,
      type: 'approval-required',
      title: 'Form Submission Rejected',
      message: `Your submission for "${(data.form as any)?.title}" was rejected${rejectionReason ? ': ' + rejectionReason : ''}`,
      link_url: `/forms/${data.form_id}/submissions/${submissionId}`
    });
  }

  return data;
}

/**
 * Get all form submissions across forms (for Submissions tab)
 */
export async function getAllFormSubmissions(filters: {
  formId?: string;
  status?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  let query = supabase
    .from('form_submissions')
    .select(`
      *,
      form:forms(id, title, status),
      submitted_by:users!form_submissions_user_id_fkey(id, first_name, last_name, email)
    `, { count: 'exact' })
    .eq('organization_id', orgId);

  if (filters.formId) {
    query = query.eq('form_id', filters.formId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query.order('submitted_at', { ascending: false });

  if (error) throw error;
  return { submissions: data, total: count || 0 };
}

/**
 * Get form submissions with filters
 */
export async function getFormSubmissions(
  formId: string,
  filters: { status?: string } = {}
) {
  // Fixed foreign key references to match actual schema
  let query = supabase
    .from('form_submissions')
    .select(`
      *,
      submitted_by:users!form_submissions_user_id_fkey(first_name, last_name, email),
      reviewed_by:users!form_submissions_reviewed_by_id_fkey(first_name, last_name, email)
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
  const orgId = await getCurrentUserOrgId();
  const userProfile = await getCurrentUserProfile();
  if (!orgId || !userProfile) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('form_assignments')
    .insert({
      organization_id: orgId,
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

  // Create notifications for affected users (use Promise.all to avoid N+1 query)
  const affectedUsers = await getAffectedUsersForFormAssignment(assignmentType, targetId);

  // Execute all notifications in parallel instead of sequentially
  await Promise.all(
    affectedUsers.map(userId =>
      createNotification({
        user_id: userId,
        type: 'assignment',
        title: 'New Form Assigned',
        message: `You have been assigned form: "${form?.title}"`,
        link_url: `/forms/${formId}`
      }).catch(error => {
        // Log error but don't fail the assignment
        console.error(`Failed to create notification for user ${userId}:`, error);
      })
    )
  );

  return data;
}

/**
 * Get form assignments with optional filters
 */
export async function getFormAssignments(filters: {
  formId?: string;
  status?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  let query = supabase
    .from('form_assignments')
    .select(`
      *,
      form:forms(id, title, status),
      assigned_by:users!form_assignments_assigned_by_id_fkey(id, first_name, last_name)
    `, { count: 'exact' })
    .eq('organization_id', orgId);

  if (filters.formId) {
    query = query.eq('form_id', filters.formId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return { assignments: data, total: count || 0 };
}

/**
 * Cancel a form assignment
 */
export async function cancelFormAssignment(assignmentId: string) {
  const { data, error } = await supabase
    .from('form_assignments')
    .update({ status: 'cancelled' })
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Assign form to multiple targets at once
 */
export async function bulkAssignForm(
  formId: string,
  targets: Array<{ type: 'user' | 'store' | 'district' | 'role'; id: string }>,
  dueDate?: string,
  recurrence?: string
) {
  const orgId = await getCurrentUserOrgId();
  const userProfile = await getCurrentUserProfile();
  if (!orgId || !userProfile) throw new Error('User not authenticated');

  const assignments = targets.map(target => ({
    organization_id: orgId,
    form_id: formId,
    assignment_type: target.type,
    target_id: target.id,
    assigned_by_id: userProfile.id,
    due_date: dueDate,
    recurrence: recurrence || 'none',
    status: 'active'
  }));

  const { data, error } = await supabase
    .from('form_assignments')
    .insert(assignments)
    .select('id');

  if (error) throw error;

  const { data: form } = await supabase
    .from('forms')
    .select('title')
    .eq('id', formId)
    .single();

  const allAffectedUsers: string[] = [];
  for (const target of targets) {
    const users = await getAffectedUsersForFormAssignment(target.type, target.id);
    allAffectedUsers.push(...users);
  }
  const uniqueUsers = [...new Set(allAffectedUsers)];

  await Promise.all(
    uniqueUsers.map(userId =>
      createNotification({
        user_id: userId,
        type: 'assignment',
        title: 'New Form Assigned',
        message: `You have been assigned form: "${form?.title}"`,
        link_url: `/forms/${formId}`
      }).catch(err => {
        console.error(`Failed to create notification for user ${userId}:`, err);
      })
    )
  );

  return { success: true, assignmentIds: data?.map((a: { id: string }) => a.id) || [] };
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
    // Users have store_id, not district_id. Get users whose store is in this district.
    const { data: stores } = await supabase
      .from('stores')
      .select('id')
      .eq('district_id', targetId);

    const storeIds = stores?.map(s => s.id) || [];
    if (storeIds.length === 0) return [];

    const { data: users } = await supabase
      .from('users')
      .select('id')
      .in('store_id', storeIds)
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

/**
 * Get form analytics for dashboard charts
 */
export async function getFormAnalytics(filters: {
  timeRange?: string; // '7', '30', '90', '365'
  formType?: string; // 'all', 'ojt-checklist', 'inspection', etc.
} = {}) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const days = parseInt(filters.timeRange || '30', 10);
  const since = new Date();
  since.setDate(since.getDate() - days);

  let submissionsQuery = supabase
    .from('form_submissions')
    .select(`
      id,
      form_id,
      status,
      submitted_at,
      form:forms(id, title, type),
      submitted_by:users!form_submissions_user_id_fkey(id, store_id, store:stores!users_store_id_fkey(id, name))
    `)
    .eq('organization_id', orgId)
    .gte('submitted_at', since.toISOString());

  const { data: submissions, error: subError } = await submissionsQuery;

  if (subError) throw subError;

  const { data: forms } = await supabase
    .from('forms')
    .select('id, title, type')
    .eq('organization_id', orgId)
    .eq('status', 'published');

  const { data: assignmentsData } = await supabase
    .from('form_assignments')
    .select('id')
    .eq('organization_id', orgId)
    .eq('status', 'active');

  const subs = (submissions || []).filter(
    s => !filters.formType || filters.formType === 'all' || (s.form as any)?.type === filters.formType
  );

  const byDate: Record<string, number> = {};
  const byForm: Record<string, { total: number; approved: number }> = {};
  const byStore: Record<string, { total: number; approved: number }> = {};

  subs.forEach((s: any) => {
    const d = new Date(s.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    byDate[d] = (byDate[d] || 0) + 1;

    const formId = s.form_id;
    if (!byForm[formId]) byForm[formId] = { total: 0, approved: 0 };
    byForm[formId].total += 1;
    if (s.status === 'approved') byForm[formId].approved += 1;

    const storeName = s.submitted_by?.store?.name || 'No Store';
    if (!byStore[storeName]) byStore[storeName] = { total: 0, approved: 0 };
    byStore[storeName].total += 1;
    if (s.status === 'approved') byStore[storeName].approved += 1;
  });

  const submissionVolumeData = Object.entries(byDate)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([date, submissions]) => ({ date, submissions }));

  const formTitles = new Map((forms || []).map((f: any) => [f.id, f.title]));
  const completionRateData = Object.entries(byForm).map(([formId, counts]) => ({
    form: formTitles.get(formId) || formId,
    rate: counts.total > 0 ? Math.round((counts.approved / counts.total) * 100) : 0,
  })).sort((a, b) => b.rate - a.rate).slice(0, 10);

  const submissionsByUnitData = Object.entries(byStore)
    .map(([unit, counts]) => ({ unit, submissions: counts.total }))
    .sort((a, b) => b.submissions - a.submissions)
    .slice(0, 10);

  const topPerformingUnits = Object.entries(byStore)
    .map(([unit, counts]) => ({
      unit,
      submissions: counts.total,
      completionRate: counts.total > 0 ? Math.round((counts.approved / counts.total) * 100) : 0,
    }))
    .sort((a, b) => b.submissions - a.submissions)
    .slice(0, 10);

  const totalSubmissions = subs.length;
  const approvedCount = subs.filter((s: any) => s.status === 'approved').length;
  const completionRate = totalSubmissions > 0 ? Math.round((approvedCount / totalSubmissions) * 100) : 0;

  return {
    stats: {
      totalSubmissions,
      activeForms: (assignmentsData || []).length,
      completionRate,
      approvedCount,
    },
    submissionVolumeData,
    completionRateData,
    submissionsByUnitData,
    topPerformingUnits,
    scoresTrendData: [], // No score stored in form_submissions
  };
}