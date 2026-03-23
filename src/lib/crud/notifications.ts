// ============================================================================
// NOTIFICATIONS CRUD OPERATIONS
// ============================================================================

import { supabase } from '../supabase';

export interface CreateNotificationInput {
  user_id: string;
  organization_id?: string;  // Will be looked up from user if not provided
  type: 'assignment' | 'due-date' | 'completion' | 'certification-expiry' |
        'certification-expired' | 'certification-issued' | 'approval-required' |
        'form-submitted' | 'content-updated' | 'overdue' | 'assignment_new';
  title: string;
  message: string;
  link_type?: string;  // e.g. 'assignment', 'certification', 'form'
  link_id?: string;    // the UUID of the linked entity
}

/**
 * Create a notification for a user
 */
export async function createNotification(input: CreateNotificationInput) {
  // Get organization_id from user if not provided
  let organizationId = input.organization_id;
  if (!organizationId) {
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', input.user_id)
      .single();
    organizationId = userData?.organization_id;
  }

  if (!organizationId) {
    throw new Error('Could not determine organization_id for notification');
  }

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      organization_id: organizationId,
      user_id: input.user_id,
      type: input.type,
      title: input.title,
      message: input.message,
      link_type: input.link_type,
      link_id: input.link_id,
      is_read: false
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating notification:', error);
    throw error;
  }

  return data;
}

/**
 * Get unread notifications for user
 */
export async function getUnreadNotifications(userId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data;
}

/**
 * Get all notifications for user (with pagination)
 */
export async function getNotifications(
  userId: string,
  limit: number = 20,
  offset: number = 0
) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data;
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString()
    })
    .eq('id', notificationId);

  if (error) throw error;
}

/**
 * Mark all notifications as read for user
 */
export async function markAllNotificationsAsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
}

/**
 * Delete notification
 */
export async function deleteNotification(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) throw error;
}

/**
 * Check for overdue assignments and create notifications
 */
export async function checkOverdueAssignments() {
  const today = new Date().toISOString().split('T')[0];

  // Get all overdue assignments
  const { data: overdueAssignments } = await supabase
    .from('assignments')
    .select(`
      *,
      organization_id
    `)
    .eq('status', 'active')
    .lt('due_date', today);

  if (!overdueAssignments) return;

  for (const assignment of overdueAssignments) {
    // Get affected users
    const affectedUsers = await getAffectedUsersForAssignment(
      assignment.assignment_type,
      assignment.target_id
    );

    for (const userId of affectedUsers) {
      // Check if we already sent an overdue notification
      const { data: existingNotif } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'overdue')
        .eq('link_type', 'assignment')
        .eq('link_id', assignment.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Within last 24 hours
        .single();

      if (!existingNotif) {
        try {
          await createNotification({
            user_id: userId,
            type: 'overdue',
            title: 'Assignment Overdue',
            message: `Your assignment "${assignment.title}" is overdue`,
            link_type: 'assignment',
            link_id: assignment.id
          });
        } catch (error) {
          // Log error but don't fail the entire process
          console.error(`Failed to create overdue notification for user ${userId}:`, error);
        }
      }
    }
  }
}

/**
 * Check for approaching due dates and create notifications
 */
export async function checkApproachingDueDates(daysThreshold: number = 3) {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + daysThreshold);

  const { data: approachingAssignments } = await supabase
    .from('assignments')
    .select('*')
    .eq('status', 'active')
    .gte('due_date', today.toISOString().split('T')[0])
    .lte('due_date', futureDate.toISOString().split('T')[0]);

  if (!approachingAssignments) return;

  for (const assignment of approachingAssignments) {
    const affectedUsers = await getAffectedUsersForAssignment(
      assignment.assignment_type,
      assignment.target_id
    );

    for (const userId of affectedUsers) {
      // Check if we already sent a due-date notification recently
      const { data: existingNotif } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'due-date')
        .eq('link_type', 'assignment')
        .eq('link_id', assignment.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .single();

      if (!existingNotif) {
        const daysUntilDue = Math.ceil(
          (new Date(assignment.due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        try {
          await createNotification({
            user_id: userId,
            type: 'due-date',
            title: 'Assignment Due Soon',
            message: `Your assignment "${assignment.title}" is due in ${daysUntilDue} day(s)`,
            link_type: 'assignment',
            link_id: assignment.id
          });
        } catch (error) {
          // Log error but don't fail the entire process
          console.error(`Failed to create due-date notification for user ${userId}:`, error);
        }
      }
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getAffectedUsersForAssignment(
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
