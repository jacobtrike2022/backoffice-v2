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
    
    // Get user counts for each role
    const rolesWithCounts = await Promise.all(
      (data || []).map(async (role) => {
        const { count } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('role_id', role.id)
          .eq('organization_id', orgId);
        
        return {
          ...role,
          user_count: count || 0
        };
      })
    );
    
    return rolesWithCounts;
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

