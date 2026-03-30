import { supabase } from '../supabase';

export interface JourneyChecklistItem {
  id: string;
  organization_id: string;
  phase: 'prospect' | 'onboarding';
  title: string;
  description: string | null;
  item_type: 'task' | 'resource' | 'reviewer' | 'follow_up' | 'milestone' | 'custom';
  sort_order: number;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  metadata: Record<string, unknown>;
  resource_url: string | null;
  resource_label: string | null;
  due_date: string | null;
  reviewer_email: string | null;
  reviewer_name: string | null;
  created_at: string;
  created_by: string | null;
}

export type CreateChecklistItem = Pick<
  JourneyChecklistItem,
  'organization_id' | 'phase' | 'title'
> &
  Partial<
    Pick<
      JourneyChecklistItem,
      | 'description'
      | 'item_type'
      | 'sort_order'
      | 'metadata'
      | 'resource_url'
      | 'resource_label'
      | 'due_date'
      | 'reviewer_email'
      | 'reviewer_name'
      | 'created_by'
    >
  >;

export async function getChecklistItems(
  orgId: string,
  phase?: 'prospect' | 'onboarding'
): Promise<JourneyChecklistItem[]> {
  let query = supabase
    .from('journey_checklist_items')
    .select('*')
    .eq('organization_id', orgId)
    .order('sort_order', { ascending: true });

  if (phase) {
    query = query.eq('phase', phase);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as JourneyChecklistItem[];
}

export async function createChecklistItem(
  item: CreateChecklistItem
): Promise<JourneyChecklistItem> {
  const { data, error } = await supabase
    .from('journey_checklist_items')
    .insert(item)
    .select()
    .single();
  if (error) throw error;
  return data as JourneyChecklistItem;
}

export async function createChecklistItems(
  items: CreateChecklistItem[]
): Promise<JourneyChecklistItem[]> {
  const { data, error } = await supabase
    .from('journey_checklist_items')
    .insert(items)
    .select();
  if (error) throw error;
  return (data || []) as JourneyChecklistItem[];
}

export async function toggleChecklistItem(
  itemId: string,
  completed: boolean,
  userId?: string
): Promise<JourneyChecklistItem> {
  const updates: Record<string, unknown> = {
    is_completed: completed,
    completed_at: completed ? new Date().toISOString() : null,
    completed_by: completed ? (userId || null) : null,
  };

  const { data, error } = await supabase
    .from('journey_checklist_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single();
  if (error) throw error;
  return data as JourneyChecklistItem;
}

export async function updateChecklistItem(
  itemId: string,
  updates: Partial<Omit<JourneyChecklistItem, 'id' | 'organization_id' | 'created_at'>>
): Promise<JourneyChecklistItem> {
  const { data, error } = await supabase
    .from('journey_checklist_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single();
  if (error) throw error;
  return data as JourneyChecklistItem;
}

export async function deleteChecklistItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('journey_checklist_items')
    .delete()
    .eq('id', itemId);
  if (error) throw error;
}

export async function seedDefaultProspectChecklist(
  orgId: string,
  createdBy?: string
): Promise<JourneyChecklistItem[]> {
  const defaults: CreateChecklistItem[] = [
    {
      organization_id: orgId,
      phase: 'prospect',
      title: 'Welcome & Account Setup',
      description: 'Review your personalized demo environment and company profile.',
      item_type: 'milestone',
      sort_order: 0,
      created_by: createdBy,
    },
    {
      organization_id: orgId,
      phase: 'prospect',
      title: 'Explore the Content Library',
      description: 'Browse sample training tracks, playlists, and compliance content.',
      item_type: 'task',
      sort_order: 1,
      resource_label: 'Go to Content Library',
      created_by: createdBy,
    },
    {
      organization_id: orgId,
      phase: 'prospect',
      title: 'Review ROI Calculator',
      description: 'See estimated savings and efficiency gains for your organization.',
      item_type: 'resource',
      sort_order: 2,
      created_by: createdBy,
    },
    {
      organization_id: orgId,
      phase: 'prospect',
      title: 'Invite a Colleague to Review',
      description: 'Add a team member or stakeholder to explore the platform together.',
      item_type: 'reviewer',
      sort_order: 3,
      created_by: createdBy,
    },
    {
      organization_id: orgId,
      phase: 'prospect',
      title: 'Schedule a Follow-Up Call',
      description: 'Book time with your Trike rep to discuss next steps.',
      item_type: 'follow_up',
      sort_order: 4,
      created_by: createdBy,
    },
    {
      organization_id: orgId,
      phase: 'prospect',
      title: 'Review & Accept Proposal',
      description: 'Review your customized proposal and accept to move forward.',
      item_type: 'milestone',
      sort_order: 5,
      created_by: createdBy,
    },
  ];

  return createChecklistItems(defaults);
}

export async function seedDefaultOnboardingChecklist(
  orgId: string,
  createdBy?: string
): Promise<JourneyChecklistItem[]> {
  const defaults: CreateChecklistItem[] = [
    {
      organization_id: orgId,
      phase: 'onboarding',
      title: 'Billing & Subscription Active',
      description: 'Your subscription is set up and billing is configured.',
      item_type: 'milestone',
      sort_order: 0,
      created_by: createdBy,
    },
    {
      organization_id: orgId,
      phase: 'onboarding',
      title: 'Import Your Team',
      description: 'Add your district managers, store managers, and team members.',
      item_type: 'task',
      sort_order: 1,
      created_by: createdBy,
    },
    {
      organization_id: orgId,
      phase: 'onboarding',
      title: 'Set Up Stores & Districts',
      description: 'Configure your organizational structure with stores and districts.',
      item_type: 'task',
      sort_order: 2,
      created_by: createdBy,
    },
    {
      organization_id: orgId,
      phase: 'onboarding',
      title: 'Upload Your Custom Content',
      description: 'Add your organization-specific training materials and SOPs.',
      item_type: 'task',
      sort_order: 3,
      created_by: createdBy,
    },
    {
      organization_id: orgId,
      phase: 'onboarding',
      title: 'Create Your First Assignments',
      description: 'Assign training tracks to your team and set due dates.',
      item_type: 'task',
      sort_order: 4,
      created_by: createdBy,
    },
    {
      organization_id: orgId,
      phase: 'onboarding',
      title: 'Go Live!',
      description: 'Everything is set up — your team is ready to start learning.',
      item_type: 'milestone',
      sort_order: 5,
      created_by: createdBy,
    },
  ];

  return createChecklistItems(defaults);
}
