import { supabase, getCurrentUserOrgId } from '../supabase';
import type { 
  Role, 
  RoleAlias, 
  DuplicateRoleSuggestion, 
  RoleMergeResult,
  CreateRoleInput,
  UpdateRoleInput,
  HrisSyncLog,
  RoleMergeHistory
} from '../../types/roles';

export const rolesApi = {
  // ========== CRUD Operations ==========
  
  async list(includeArchived = false): Promise<Role[]> {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) throw new Error('No organization found');
    
    let query = supabase
      .from('roles')
      .select('*')
      .eq('organization_id', orgId)
      .order('name');
    
    if (!includeArchived) {
      query = query.in('status', ['active', 'inactive', 'pending_review']);
    }
    
    const { data, error } = await query;
    if (error) throw error;

    // Single query for all role assignments in this org, then aggregate in JS.
    // Replaces an N+1 pattern that fired one count query per role.
    const { data: userRoleRows } = await supabase
      .from('users')
      .select('role_id')
      .eq('organization_id', orgId)
      .not('role_id', 'is', null);

    const countByRoleId = new Map<string, number>();
    (userRoleRows || []).forEach(row => {
      if (!row.role_id) return;
      countByRoleId.set(row.role_id, (countByRoleId.get(row.role_id) || 0) + 1);
    });

    return (data || []).map(role => ({
      ...role,
      user_count: countByRoleId.get(role.id) || 0,
    }));
  },

  async get(roleId: string): Promise<Role> {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) throw new Error('No organization found');
    
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('id', roleId)
      .eq('organization_id', orgId)
      .single();
    
    if (error) throw error;
    if (!data) throw new Error('Role not found');
    
    // Get user count for this role
    const { count } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role_id', roleId)
      .eq('organization_id', orgId);
    
    return {
      ...data,
      user_count: count || 0
    };
  },

  async create(input: CreateRoleInput): Promise<Role> {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) throw new Error('No organization found');
    
    const { data: { user } } = await supabase.auth.getUser();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user?.id)
      .single();
    
    const { data, error } = await supabase
      .from('roles')
      .insert({
        organization_id: orgId,
        name: input.name,
        job_code: input.job_code,
        description: input.description,
        department: input.department,
        job_family: input.job_family,
        flsa_status: input.flsa_status,
        is_manager: input.is_manager ?? false,
        is_frontline: input.is_frontline ?? true,
        permission_level: input.permission_level ?? 1,
        job_description: input.job_description,
        job_description_source: input.job_description_source,
        reports_to_role_id: input.reports_to_role_id ?? null,
        employment_type: input.employment_type ?? null,
        created_by: userData?.id,
        status: 'active',
        permissions: [],
        permissions_json: {},
        level: 0
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(input: UpdateRoleInput): Promise<Role> {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) throw new Error('No organization found');
    
    const { id, ...updates } = input;
    
    const { data, error } = await supabase
      .from('roles')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', orgId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(roleId: string): Promise<void> {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) throw new Error('No organization found');
    
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('role_id', roleId)
      .limit(1);
    
    if (users && users.length > 0) {
      throw new Error('Cannot delete role with assigned users. Please reassign users first.');
    }
    
    const { error } = await supabase
      .from('roles')
      .update({ status: 'archived' })
      .eq('id', roleId)
      .eq('organization_id', orgId);
    
    if (error) throw error;
  },

  // ========== Duplicate Detection ==========
  
  async findDuplicates(threshold = 0.6): Promise<DuplicateRoleSuggestion[]> {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) throw new Error('No organization found');
    
    const { data, error } = await supabase
      .rpc('find_duplicate_roles', {
        p_org_id: orgId,
        p_threshold: threshold
      });
    
    if (error) {
      // Handle type mismatch error - database returns real but expects numeric
      if (error.code === '42804' || error.message?.includes('does not match')) {
        const helpfulError = new Error(
          'Database function type mismatch: The find_duplicate_roles function returns real type for similarity_score, but PostgREST expects numeric. ' +
          'Please update the function to cast similarity_score to NUMERIC. ' +
          'Run this SQL in Supabase: ALTER FUNCTION find_duplicate_roles ... (see error details)'
        );
        helpfulError.name = 'TypeMismatchError';
        throw helpfulError;
      }
      throw error;
    }
    
    // Ensure similarity_score is a number (handle real to number conversion)
    return (data || []).map((item: any) => ({
      ...item,
      similarity_score: typeof item.similarity_score === 'number' 
        ? item.similarity_score 
        : parseFloat(item.similarity_score) || 0
    }));
  },

  async mergeRoles(
    sourceRoleId: string,
    targetRoleId: string,
    reason?: string
  ): Promise<RoleMergeResult> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user?.id)
      .single();
    
    const { data, error } = await supabase
      .rpc('merge_roles', {
        p_source_role_id: sourceRoleId,
        p_target_role_id: targetRoleId,
        p_merged_by: userData?.id,
        p_reason: reason
      });
    
    if (error) throw error;
    return data;
  },

  // ========== Aliases Management ==========
  
  async getAliases(roleId: string): Promise<RoleAlias[]> {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) throw new Error('No organization found');
    
    const { data, error } = await supabase
      .from('role_aliases')
      .select('*')
      .eq('role_id', roleId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async addAlias(
    roleId: string,
    aliasName: string,
    source: 'hris' | 'manual' | 'ai_suggested' = 'manual'
  ): Promise<RoleAlias> {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) throw new Error('No organization found');
    
    const { data, error } = await supabase
      .from('role_aliases')
      .insert({
        organization_id: orgId,
        role_id: roleId,
        alias_name: aliasName,
        alias_source: source
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async removeAlias(aliasId: string): Promise<void> {
    const { error } = await supabase
      .from('role_aliases')
      .delete()
      .eq('id', aliasId);
    
    if (error) throw error;
  },

  // ========== User Assignment ==========
  
  async getUsersForRole(roleId: string) {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) throw new Error('No organization found');
    
    const { data, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, status')
      .eq('role_id', roleId)
      .eq('organization_id', orgId)
      .order('last_name');
    
    if (error) throw error;
    return data || [];
  },

  async reassignUsers(fromRoleId: string, toRoleId: string): Promise<number> {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) throw new Error('No organization found');
    
    const { data, error } = await supabase
      .from('users')
      .update({ role_id: toRoleId })
      .eq('role_id', fromRoleId)
      .eq('organization_id', orgId)
      .select('id');
    
    if (error) throw error;
    return data?.length || 0;
  },

  // ========== Reporting Structure ==========

  async getDirectReports(roleId: string): Promise<{ id: string; name: string }[]> {
    const { data, error } = await supabase
      .from('roles')
      .select('id, name')
      .eq('reports_to_role_id', roleId)
      .eq('status', 'active')
      .order('name');
    
    if (error) throw error;
    return data || [];
  },

  async setReportsTo(roleId: string, reportsToRoleId: string | null): Promise<void> {
    const { error } = await supabase
      .from('roles')
      .update({ reports_to_role_id: reportsToRoleId })
      .eq('id', roleId);

    if (error) throw error;
  }
};

// ============================================================================
// BULK ROLE CREATION
// ============================================================================

export interface BulkCreateRolesInput {
  rows: Array<{
    name: string;
    description?: string;
    employment_type?: 'hourly' | 'salaried' | 'admin';
  }>;
  organization_id: string;
}

export interface BulkCreateRolesResult {
  created: number;
  failed: number;
  errors: Array<{ row: number; name: string; error: string }>;
  // input_index is the 0-based index in the input `rows` array. This lets callers
  // map created roles back to their source row reliably, even when some rows fail.
  createdRoles: Array<{ input_index: number; id: string; name: string }>;
}

/**
 * Bulk create roles. Validates rows up front, attempts a single batch insert,
 * and falls back to per-row inserts only on batch failure (so we can identify
 * the offending row). Each created role carries its original input_index.
 */
export async function bulkCreateRoles(
  input: BulkCreateRolesInput
): Promise<BulkCreateRolesResult> {
  const { rows, organization_id } = input;

  const result: BulkCreateRolesResult = {
    created: 0,
    failed: 0,
    errors: [],
    createdRoles: [],
  };

  type Plan = { input_index: number; name: string; record: Record<string, any> };
  const plans: Plan[] = [];
  rows.forEach((row, i) => {
    const trimmedName = (row?.name || '').trim();
    if (!trimmedName) {
      result.failed += 1;
      result.errors.push({ row: i, name: trimmedName, error: 'Role name is required' });
      return;
    }
    plans.push({
      input_index: i,
      name: trimmedName,
      record: {
        organization_id,
        name: trimmedName,
        description: row.description || null,
        employment_type: row.employment_type ?? null,
        status: 'active',
        permissions: [],
        permissions_json: {},
        level: 0,
        is_manager: false,
        is_frontline: true,
        permission_level: 1,
      },
    });
  });

  if (plans.length === 0) return result;

  try {
    const { data, error } = await supabase
      .from('roles')
      .insert(plans.map(p => p.record))
      .select('id, name');
    if (error) throw error;
    (data || []).forEach((created, idx) => {
      const plan = plans[idx];
      result.created += 1;
      result.createdRoles.push({ input_index: plan.input_index, id: created.id, name: created.name });
    });
  } catch {
    for (const plan of plans) {
      try {
        const { data, error } = await supabase
          .from('roles')
          .insert(plan.record)
          .select('id, name')
          .single();
        if (error) throw error;
        result.created += 1;
        result.createdRoles.push({ input_index: plan.input_index, id: data.id, name: data.name });
      } catch (err: any) {
        result.failed += 1;
        result.errors.push({
          row: plan.input_index,
          name: plan.name,
          error: err?.message || String(err),
        });
      }
    }
  }

  return result;
}

