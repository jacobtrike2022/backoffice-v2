// ============================================================================
// COMPLIANCE ASSIGNMENT QUEUE CRUD OPERATIONS
// ============================================================================
// This handles the compliance-specific assignment queue (compliance_assignment_queue)
// which is separate from regular content assignments (assignments table).
// ============================================================================

import { supabase, getCurrentUserOrgId } from '../supabase';

// ============================================================================
// TYPES
// ============================================================================

export type AssignmentTrigger = 'onboarding' | 'transfer' | 'promotion' | 'expiration' | 'manual';
export type AssignmentStatus = 'pending' | 'assigned' | 'suppressed' | 'completed' | 'expired' | 'cancelled';

export interface ComplianceAssignment {
  id: string;
  organization_id: string;
  employee_id: string;
  requirement_id: string;
  playlist_id: string | null;
  triggered_by: AssignmentTrigger;
  trigger_details: Record<string, any> | null;
  status: AssignmentStatus;
  due_date: string | null;
  assigned_at: string | null;
  completed_at: string | null;
  suppression_reason: string | null;
  suppressed_by: string | null;
  suppressed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    name: string;
    email: string;
    store?: { id: string; name: string; state: string };
  };
  requirement?: {
    id: string;
    requirement_name: string;
    course_name: string | null;
    state_code: string;
    days_to_complete: number | null;
    topic?: { name: string; icon: string | null };
  };
  playlist?: {
    id: string;
    name: string;
  };
}

export interface ComplianceAssignmentStats {
  pending: number;
  assigned: number;
  completed: number;
  suppressed: number;
  overdue: number;
  total: number;
}

export interface ComplianceAssignmentFilters {
  status?: AssignmentStatus;
  employeeId?: string;
  requirementId?: string;
  storeId?: string;
  triggeredBy?: AssignmentTrigger;
  dueBefore?: string;
  dueAfter?: string;
}

// ============================================================================
// COMPLIANCE ASSIGNMENT QUEUE CRUD
// ============================================================================

/**
 * Get assignments from the compliance queue with optional filters
 */
export async function getComplianceAssignmentQueue(
  filters?: ComplianceAssignmentFilters
): Promise<ComplianceAssignment[]> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  let query = supabase
    .from('compliance_assignment_queue')
    .select(`
      *,
      employee:users!compliance_assignment_queue_employee_id_fkey(
        id, first_name, last_name, name, email,
        store:stores(id, name, state)
      ),
      requirement:compliance_requirements(
        id, requirement_name, course_name, state_code, days_to_complete,
        topic:compliance_topics(name, icon)
      ),
      playlist:albums(id, name)
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.employeeId) {
    query = query.eq('employee_id', filters.employeeId);
  }
  if (filters?.requirementId) {
    query = query.eq('requirement_id', filters.requirementId);
  }
  if (filters?.triggeredBy) {
    query = query.eq('triggered_by', filters.triggeredBy);
  }
  if (filters?.dueBefore) {
    query = query.lte('due_date', filters.dueBefore);
  }
  if (filters?.dueAfter) {
    query = query.gte('due_date', filters.dueAfter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Get pending compliance assignments only
 */
export async function getPendingComplianceAssignments(): Promise<ComplianceAssignment[]> {
  return getComplianceAssignmentQueue({ status: 'pending' });
}

/**
 * Get overdue compliance assignments (past due date and not completed/suppressed)
 */
export async function getOverdueComplianceAssignments(): Promise<ComplianceAssignment[]> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('compliance_assignment_queue')
    .select(`
      *,
      employee:users!compliance_assignment_queue_employee_id_fkey(
        id, first_name, last_name, name, email,
        store:stores(id, name, state)
      ),
      requirement:compliance_requirements(
        id, requirement_name, course_name, state_code, days_to_complete,
        topic:compliance_topics(name, icon)
      )
    `)
    .eq('organization_id', orgId)
    .in('status', ['pending', 'assigned'])
    .lt('due_date', today)
    .order('due_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get a single compliance assignment by ID
 */
export async function getComplianceAssignment(id: string): Promise<ComplianceAssignment | null> {
  const { data, error } = await supabase
    .from('compliance_assignment_queue')
    .select(`
      *,
      employee:users!compliance_assignment_queue_employee_id_fkey(
        id, first_name, last_name, name, email,
        store:stores(id, name, state)
      ),
      requirement:compliance_requirements(
        id, requirement_name, course_name, state_code, days_to_complete,
        topic:compliance_topics(name, icon)
      ),
      playlist:albums(id, name)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

/**
 * Assign a playlist to fulfill a compliance requirement
 */
export async function assignCompliancePlaylist(
  assignmentId: string,
  playlistId?: string
): Promise<void> {
  const updateData: Record<string, any> = {
    status: 'assigned',
    assigned_at: new Date().toISOString()
  };

  if (playlistId) {
    updateData.playlist_id = playlistId;
  }

  const { error } = await supabase
    .from('compliance_assignment_queue')
    .update(updateData)
    .eq('id', assignmentId);

  if (error) throw error;
}

/**
 * Mark a compliance assignment as completed
 */
export async function completeComplianceAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from('compliance_assignment_queue')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', assignmentId);

  if (error) throw error;
}

/**
 * Suppress a compliance assignment (e.g., employee has external cert)
 */
export async function suppressComplianceAssignment(
  assignmentId: string,
  reason: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('compliance_assignment_queue')
    .update({
      status: 'suppressed',
      suppression_reason: reason,
      suppressed_by: user?.id,
      suppressed_at: new Date().toISOString()
    })
    .eq('id', assignmentId);

  if (error) throw error;
}

/**
 * Cancel a compliance assignment
 */
export async function cancelComplianceAssignment(
  assignmentId: string,
  reason?: string
): Promise<void> {
  const { error } = await supabase
    .from('compliance_assignment_queue')
    .update({
      status: 'cancelled',
      suppression_reason: reason || 'cancelled'
    })
    .eq('id', assignmentId);

  if (error) throw error;
}

/**
 * Create a manual compliance assignment
 */
export async function createManualComplianceAssignment(input: {
  employee_id: string;
  requirement_id: string;
  playlist_id?: string;
  due_date?: string;
}): Promise<ComplianceAssignment> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Default due date: 30 days from now
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 30);

  const { data, error } = await supabase
    .from('compliance_assignment_queue')
    .insert({
      organization_id: orgId,
      employee_id: input.employee_id,
      requirement_id: input.requirement_id,
      playlist_id: input.playlist_id,
      triggered_by: 'manual',
      status: input.playlist_id ? 'assigned' : 'pending',
      assigned_at: input.playlist_id ? new Date().toISOString() : null,
      due_date: input.due_date || defaultDueDate.toISOString().split('T')[0]
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Bulk create compliance assignments for multiple employees
 */
export async function createBulkComplianceAssignments(input: {
  employee_ids: string[];
  requirement_id: string;
  playlist_id?: string;
  due_date?: string;
}): Promise<number> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 30);

  const assignments = input.employee_ids.map(employee_id => ({
    organization_id: orgId,
    employee_id,
    requirement_id: input.requirement_id,
    playlist_id: input.playlist_id,
    triggered_by: 'manual' as AssignmentTrigger,
    status: (input.playlist_id ? 'assigned' : 'pending') as AssignmentStatus,
    assigned_at: input.playlist_id ? new Date().toISOString() : null,
    due_date: input.due_date || defaultDueDate.toISOString().split('T')[0]
  }));

  const { data, error } = await supabase
    .from('compliance_assignment_queue')
    .insert(assignments)
    .select();

  if (error) throw error;
  return data?.length || 0;
}

// ============================================================================
// ASSIGNMENT TRIGGERS (RPC Wrappers)
// ============================================================================

/**
 * Trigger onboarding assignments for a new user
 * Calls the database function create_onboarding_assignments
 */
export async function triggerOnboardingAssignments(userId: string): Promise<number> {
  const { data, error } = await supabase
    .rpc('create_onboarding_assignments', { p_user_id: userId });

  if (error) throw error;
  return data || 0;
}

/**
 * Handle location transfer for a user
 * Calls the database function handle_location_transfer
 */
export async function triggerLocationTransfer(
  userId: string,
  oldStoreId: string,
  newStoreId: string
): Promise<void> {
  const { error } = await supabase
    .rpc('handle_location_transfer', {
      p_user_id: userId,
      p_old_store_id: oldStoreId,
      p_new_store_id: newStoreId
    });

  if (error) throw error;
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get compliance assignment statistics for the organization
 */
export async function getComplianceAssignmentStats(): Promise<ComplianceAssignmentStats> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('compliance_assignment_queue')
    .select('status, due_date')
    .eq('organization_id', orgId);

  if (error) throw error;

  const assignments = data || [];

  // Count overdue: past due date AND status is pending/assigned
  const overdue = assignments.filter(a =>
    a.due_date &&
    a.due_date < today &&
    ['pending', 'assigned'].includes(a.status)
  ).length;

  return {
    pending: assignments.filter(a => a.status === 'pending').length,
    assigned: assignments.filter(a => a.status === 'assigned').length,
    completed: assignments.filter(a => a.status === 'completed').length,
    suppressed: assignments.filter(a => a.status === 'suppressed').length,
    overdue,
    total: assignments.length
  };
}

/**
 * Get compliance assignment stats grouped by requirement
 */
export async function getComplianceAssignmentStatsByRequirement(): Promise<{
  requirement_id: string;
  requirement_name: string;
  state_code: string;
  pending: number;
  assigned: number;
  completed: number;
}[]> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('compliance_assignment_queue')
    .select(`
      status,
      requirement:compliance_requirements(id, requirement_name, state_code)
    `)
    .eq('organization_id', orgId);

  if (error) throw error;

  // Group by requirement
  const grouped = new Map<string, {
    requirement_id: string;
    requirement_name: string;
    state_code: string;
    pending: number;
    assigned: number;
    completed: number;
  }>();

  for (const assignment of data || []) {
    const req = assignment.requirement as any;
    if (!req) continue;

    const key = req.id;
    if (!grouped.has(key)) {
      grouped.set(key, {
        requirement_id: req.id,
        requirement_name: req.requirement_name,
        state_code: req.state_code,
        pending: 0,
        assigned: 0,
        completed: 0
      });
    }

    const stats = grouped.get(key)!;
    if (assignment.status === 'pending') stats.pending++;
    else if (assignment.status === 'assigned') stats.assigned++;
    else if (assignment.status === 'completed') stats.completed++;
  }

  return Array.from(grouped.values());
}

/**
 * Get compliance assignments for a specific employee
 */
export async function getEmployeeComplianceAssignments(employeeId: string): Promise<ComplianceAssignment[]> {
  return getComplianceAssignmentQueue({ employeeId });
}

/**
 * Check if employee has any pending compliance assignments for a requirement
 */
export async function hasPendingComplianceAssignment(
  employeeId: string,
  requirementId: string
): Promise<boolean> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('compliance_assignment_queue')
    .select('id')
    .eq('organization_id', orgId)
    .eq('employee_id', employeeId)
    .eq('requirement_id', requirementId)
    .eq('status', 'pending')
    .limit(1);

  if (error) throw error;
  return (data?.length || 0) > 0;
}

/**
 * Suppress compliance assignments when an external certification is approved
 */
export async function suppressAssignmentsForCertification(
  employeeId: string,
  requirementId: string
): Promise<number> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('compliance_assignment_queue')
    .update({
      status: 'suppressed',
      suppression_reason: 'valid_external_cert',
      suppressed_by: user?.id,
      suppressed_at: new Date().toISOString()
    })
    .eq('organization_id', orgId)
    .eq('employee_id', employeeId)
    .eq('requirement_id', requirementId)
    .in('status', ['pending', 'assigned'])
    .select();

  if (error) throw error;
  return data?.length || 0;
}
