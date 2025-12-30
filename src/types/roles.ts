export interface Role {
  id: string;
  organization_id: string;
  name: string;
  display_name?: string | null;
  description?: string | null;
  
  // O*NET Integration
  onet_code?: string | null;
  onet_match_confidence?: number | null;
  
  // Job Description
  job_description?: string | null;
  job_description_source?: 'manual' | 'hris' | 'uploaded' | null;
  job_description_updated_at?: string | null;
  
  // Classification
  is_manager: boolean;
  is_frontline: boolean;
  department?: string | null;
  job_family?: string | null;
  flsa_status?: 'exempt' | 'non_exempt' | null;
  
  // Permissions (dual system - keeping both for backward compatibility)
  permissions: string[]; // Legacy array format
  permissions_json: Record<string, any>; // New object format
  permission_level: number; // 1=Basic, 2=Lead, 3=Manager, 4=Admin, 5=Super
  level: number; // Legacy 0-based level
  
  // HRIS Integration
  hris_id?: string | null;
  hris_provider?: string | null;
  hris_last_sync?: string | null;
  
  // Status & Lifecycle
  status: 'active' | 'inactive' | 'archived' | 'pending_review';
  merged_into_role_id?: string | null;
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  
  // Computed fields (from joins)
  user_count?: number;
}

export interface RoleAlias {
  id: string;
  organization_id: string;
  role_id: string;
  alias_name: string;
  alias_source: 'hris' | 'manual' | 'ai_suggested' | 'merged';
  hris_id?: string | null;
  is_primary: boolean;
  confidence?: number | null;
  created_at: string;
}

export interface DuplicateRoleSuggestion {
  role_id: string;
  role_name: string;
  potential_match_id: string;
  potential_match_name: string;
  similarity_score: number;
}

export interface RoleMergeResult {
  success: boolean;
  users_migrated: number;
  source_archived: boolean;
  source_role_id: string;
  target_role_id: string;
}

export interface HrisSyncLog {
  id: string;
  organization_id: string;
  provider: string;
  sync_type: 'full' | 'incremental' | 'manual';
  status: 'started' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_skipped: number;
  errors?: any[];
  started_at: string;
  completed_at?: string | null;
  triggered_by?: string | null;
}

export interface RoleMergeHistory {
  id: string;
  organization_id: string;
  source_role_id: string;
  target_role_id: string;
  source_role_name: string;
  users_migrated: number;
  merged_by?: string | null;
  merged_at: string;
  reason?: string | null;
}

// Form data types
export interface CreateRoleInput {
  name: string;
  display_name?: string;
  description?: string;
  department?: string;
  job_family?: string;
  flsa_status?: 'exempt' | 'non_exempt' | null;
  is_manager?: boolean;
  is_frontline?: boolean;
  permission_level?: number;
  job_description?: string;
  job_description_source?: 'manual' | 'hris' | 'uploaded';
}

export interface UpdateRoleInput extends Partial<CreateRoleInput> {
  id: string;
  status?: 'active' | 'inactive' | 'archived' | 'pending_review';
}

