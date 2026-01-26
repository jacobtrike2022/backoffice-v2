// Types for the Trike Admin module

export type DealStage =
  | 'lead'
  | 'prospect'
  | 'evaluating'
  | 'closing'
  | 'won'
  | 'lost'
  | 'frozen';

export type DealType = 'new' | 'upsell' | 'renewal' | 'expansion';

export type OrganizationStatus =
  | 'lead'
  | 'prospect'
  | 'evaluating'
  | 'closing'
  | 'onboarding'
  | 'live'
  | 'churned'
  | 'suspended'
  | 'frozen'
  | 'renewing';

export interface Deal {
  id: string;
  organization_id: string;
  name: string;
  deal_type: DealType;
  stage: DealStage;
  value: number | null;
  mrr: number | null;
  probability: number;
  owner_id: string | null;
  created_at: string;
  expected_close_date: string | null;
  actual_close_date: string | null;
  last_activity_at: string;
  next_action: string | null;
  next_action_date: string | null;
  lost_reason: string | null;
  lost_competitor: string | null;
  notes: string | null;
  tags: string[];
  metadata: Record<string, any>;
  updated_at: string;

  // Joined data
  organization?: Organization;
  owner?: User;
}

export interface Organization {
  id: string;
  name: string;
  subdomain: string | null;
  website: string | null;
  status: OrganizationStatus;
  industry: string | null;
  services_offered: string[];
  operating_states: string[];
  demo_expires_at: string | null;
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
  logo_dark_url: string | null;
  logo_light_url: string | null;
  onboarding_source: string | null;
  created_at: string;

  // Deal-related fields on org
  deal_value: number | null;
  deal_probability: number | null;
  deal_owner_id: string | null;
  deal_close_date: string | null;
  last_activity_at: string | null;
  next_action: string | null;
  next_action_date: string | null;
}

export interface User {
  id: string;
  auth_user_id: string;
  email: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface DealActivity {
  id: string;
  deal_id: string;
  activity_type:
    | 'note'
    | 'email'
    | 'call'
    | 'meeting'
    | 'proposal_sent'
    | 'demo'
    | 'stage_change'
    | 'value_change'
    | 'task'
    | 'system';
  title: string;
  description: string | null;
  from_stage: string | null;
  to_stage: string | null;
  from_value: number | null;
  to_value: number | null;
  user_id: string | null;
  created_at: string;
  metadata: Record<string, any>;

  // Joined
  user?: User;
}

export interface Proposal {
  id: string;
  deal_id: string;
  organization_id: string;
  name: string;
  version: number;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired' | 'superseded';
  content_json: Record<string, any>;
  pdf_url: string | null;
  pricing_tiers: any[];
  selected_tier: string | null;
  total_value: number | null;
  created_at: string;
  sent_at: string | null;
  viewed_at: string | null;
  expires_at: string | null;
  responded_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_by: string | null;
  notes: string | null;
  rejection_reason: string | null;
  updated_at: string;
}

export interface PipelineSummary {
  stage: DealStage;
  deal_count: number;
  total_value: number | null;
  total_mrr: number | null;
  avg_probability: number | null;
  weighted_value: number | null;
}

// Stage configuration for UI
export const STAGE_CONFIG: Record<
  DealStage,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  lead: {
    label: 'Lead',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-300',
  },
  prospect: {
    label: 'Prospect',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
  },
  evaluating: {
    label: 'Evaluating',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300',
  },
  closing: {
    label: 'Closing',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
  },
  won: {
    label: 'Won',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
  },
  lost: {
    label: 'Lost',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
  },
  frozen: {
    label: 'Frozen',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
  },
};

// Pipeline stages in order (active stages only)
export const PIPELINE_STAGES: DealStage[] = [
  'lead',
  'prospect',
  'evaluating',
  'closing',
];

// All stages including terminal states
export const ALL_STAGES: DealStage[] = [
  'lead',
  'prospect',
  'evaluating',
  'closing',
  'won',
  'lost',
  'frozen',
];
