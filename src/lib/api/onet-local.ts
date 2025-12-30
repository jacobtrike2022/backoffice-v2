/**
 * Local O*NET Data API
 * 
 * Queries locally imported O*NET data from Supabase tables
 * instead of making live API calls.
 */

import { supabase } from '../supabase';

export interface SmartProfileMatch {
  onet_code: string;
  title: string;
  also_called: string[];
  description: string;
  match_percentage: number;
}

export interface ProfileTask {
  id: string;
  description: string;
  importance?: number;
  task_order?: number;
}

export interface ProfileSkill {
  id: string;
  name: string;
  importance: number;
  level: number;
  category?: string;
}

export interface ProfileKnowledge {
  id: string;
  name: string;
  importance: number;
  level: number;
  category?: string;
}

export interface ProfileDetails {
  onet_code: string;
  title: string;
  description: string;
  also_called: string[];
  job_zone?: number;
  tasks: ProfileTask[];
  skills: ProfileSkill[];
  knowledge: ProfileKnowledge[];
}

// Merged item types (returned from database functions)
export interface MergedTask {
  task_id: string;
  description: string;
  importance: number;
  relevance: number; // 0-100 percentage from O*NET
  source: 'standard' | 'modified' | 'custom' | 'excluded';
  is_active: boolean;
  customization_id: string | null;
  notes: string | null;
  dwas?: { dwa_id: string; dwa_title: string }[];
}

export interface MergedSkill {
  skill_id: string;
  skill_name: string;
  description: string;
  importance: number;
  source: 'standard' | 'modified' | 'custom' | 'excluded';
  is_active: boolean;
  customization_id: string | null;
}

export interface MergedKnowledge {
  knowledge_id: string;
  knowledge_name: string;
  description: string;
  importance: number;
  source: 'standard' | 'modified' | 'custom' | 'excluded';
  is_active: boolean;
  customization_id: string | null;
}

export interface MergedAbility {
  ability_id: string;
  name: string;
  importance: number;
  level: number;
  category: string | null;
  source: 'standard' | 'modified' | 'custom' | 'excluded';
  is_active: boolean;
  customization_id: string | null;
  notes: string | null;
}

export const onetLocal = {
  /**
   * Search for matching occupational profiles
   * Queries local onet_occupations table using pg_trgm similarity
   */
  async searchProfiles(searchTerm: string, limit: number = 4): Promise<SmartProfileMatch[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return [];
    }

    const { data, error } = await supabase.rpc('search_onet_occupations', {
      search_term: searchTerm.trim(),
      match_limit: limit,
    });

    if (error) {
      console.error('Error searching O*NET profiles:', error);
      throw error;
    }

    // Transform the data to match our interface
    return (data || []).map((item: any) => ({
      onet_code: item.onet_code,
      title: item.title,
      also_called: Array.isArray(item.also_called)
        ? item.also_called
        : item.also_called
        ? JSON.parse(JSON.stringify(item.also_called))
        : [],
      description: item.description || '',
      match_percentage: Number(item.match_percentage) || 0,
    }));
  },

  /**
   * Get full profile details by O*NET code
   */
  async getProfileDetails(onetCode: string): Promise<ProfileDetails | null> {
    if (!onetCode) return null;

    // Fetch occupation details
    const { data: occupation, error: occError } = await supabase
      .from('onet_occupations')
      .select('*')
      .eq('onet_code', onetCode)
      .single();

    if (occError || !occupation) {
      console.error('Error fetching occupation:', occError);
      return null;
    }

    // Fetch tasks
    const { data: tasks, error: tasksError } = await supabase
      .from('onet_tasks')
      .select('id, task_description, task_order')
      .eq('onet_code', onetCode)
      .order('task_order', { ascending: true })
      .limit(15);

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
    }

    // Fetch skills with importance/level
    const { data: skillsData, error: skillsError } = await supabase
      .from('onet_occupation_skills')
      .select(
        `
        importance,
        level,
        skill:onet_skills!inner(skill_id, name, category)
        `
      )
      .eq('onet_code', onetCode)
      .order('importance', { ascending: false })
      .limit(20);

    if (skillsError) {
      console.error('Error fetching skills:', skillsError);
    }

    // Fetch knowledge with importance/level
    const { data: knowledgeData, error: knowledgeError } = await supabase
      .from('onet_occupation_knowledge')
      .select(
        `
        importance,
        level,
        knowledge:onet_knowledge!inner(knowledge_id, name, category)
        `
      )
      .eq('onet_code', onetCode)
      .order('importance', { ascending: false })
      .limit(20);

    if (knowledgeError) {
      console.error('Error fetching knowledge:', knowledgeError);
    }

    // Transform skills data
    const skills: ProfileSkill[] =
      skillsData?.map((item: any) => ({
        id: item.skill?.skill_id || '',
        name: item.skill?.name || '',
        importance: Number(item.importance) || 0,
        level: Number(item.level) || 0,
        category: item.skill?.category || undefined,
      })) || [];

    // Transform knowledge data
    const knowledge: ProfileKnowledge[] =
      knowledgeData?.map((item: any) => ({
        id: item.knowledge?.knowledge_id || '',
        name: item.knowledge?.name || '',
        importance: Number(item.importance) || 0,
        level: Number(item.level) || 0,
        category: item.knowledge?.category || undefined,
      })) || [];

    // Transform tasks data
    const profileTasks: ProfileTask[] =
      tasks?.map((task: any) => ({
        id: task.id,
        description: task.task_description,
        task_order: task.task_order,
      })) || [];

    return {
      onet_code: occupation.onet_code,
      title: occupation.title,
      description: occupation.description || '',
      also_called: Array.isArray(occupation.also_called)
        ? occupation.also_called
        : occupation.also_called
        ? JSON.parse(JSON.stringify(occupation.also_called))
        : [],
      job_zone: occupation.job_zone,
      tasks: profileTasks,
      skills,
      knowledge,
    };
  },

  /**
   * Get merged tasks for a role (base O*NET + customizations)
   */
  async getRoleTasks(roleId: string): Promise<MergedTask[]> {
    const { data, error } = await supabase.rpc('get_role_tasks', {
      p_role_id: roleId,
    });
    if (error) {
      console.error('Error fetching role tasks:', error);
      throw error;
    }
    return data || [];
  },

  /**
   * Get merged skills for a role
   */
  async getRoleSkills(roleId: string): Promise<MergedSkill[]> {
    const { data, error } = await supabase.rpc('get_role_skills', {
      p_role_id: roleId,
    });
    if (error) {
      console.error('Error fetching role skills:', error);
      throw error;
    }
    return data || [];
  },

  /**
   * Get merged knowledge for a role
   */
  async getRoleKnowledge(roleId: string): Promise<MergedKnowledge[]> {
    const { data, error } = await supabase.rpc('get_role_knowledge', {
      p_role_id: roleId,
    });
    if (error) {
      console.error('Error fetching role knowledge:', error);
      throw error;
    }
    return data || [];
  },

  /**
   * Get merged abilities for a role
   */
  async getRoleAbilities(roleId: string): Promise<MergedAbility[]> {
    const { data, error } = await supabase.rpc('get_role_abilities', {
      p_role_id: roleId,
    });
    if (error) {
      console.error('Error fetching role abilities:', error);
      throw error;
    }
    return data || [];
  },

  /**
   * Apply an O*NET profile to a role
   */
  async applyProfileToRole(roleId: string, onetCode: string): Promise<void> {
    const { error } = await supabase
      .from('roles')
      .update({
        onet_code: onetCode,
        onet_applied_at: new Date().toISOString(),
      })
      .eq('id', roleId);
    if (error) {
      console.error('Error applying profile to role:', error);
      throw error;
    }
  },

  /**
   * Exclude a task from the role's profile
   */
  async excludeTask(
    roleId: string,
    organizationId: string,
    baseTaskId: string
  ): Promise<void> {
    const { error } = await supabase.from('role_task_customizations').upsert(
      {
        role_id: roleId,
        organization_id: organizationId,
        base_task_id: baseTaskId,
        action: 'exclude',
      },
      { onConflict: 'role_id,base_task_id' }
    );
    if (error) {
      console.error('Error excluding task:', error);
      throw error;
    }
  },

  /**
   * Include a previously excluded task (remove the exclusion)
   */
  async includeTask(roleId: string, baseTaskId: string): Promise<void> {
    const { error } = await supabase
      .from('role_task_customizations')
      .delete()
      .eq('role_id', roleId)
      .eq('base_task_id', baseTaskId)
      .eq('action', 'exclude');
    if (error) {
      console.error('Error including task:', error);
      throw error;
    }
  },

  /**
   * Modify a task's description
   */
  async modifyTask(
    roleId: string,
    organizationId: string,
    baseTaskId: string,
    customDescription: string,
    notes?: string
  ): Promise<void> {
    const { error } = await supabase.from('role_task_customizations').upsert(
      {
        role_id: roleId,
        organization_id: organizationId,
        base_task_id: baseTaskId,
        action: 'modify',
        custom_description: customDescription,
        notes,
      },
      { onConflict: 'role_id,base_task_id' }
    );
    if (error) {
      console.error('Error modifying task:', error);
      throw error;
    }
  },

  /**
   * Add a custom task
   */
  async addCustomTask(
    roleId: string,
    organizationId: string,
    description: string,
    importance?: number
  ): Promise<void> {
    const { error } = await supabase.from('role_task_customizations').insert({
      role_id: roleId,
      organization_id: organizationId,
      base_task_id: null,
      action: 'add',
      custom_description: description,
      custom_importance: importance || 50,
    });
    if (error) {
      console.error('Error adding custom task:', error);
      throw error;
    }
  },

  /**
   * Delete a custom task
   */
  async deleteCustomTask(customizationId: string): Promise<void> {
    const { error } = await supabase
      .from('role_task_customizations')
      .delete()
      .eq('id', customizationId);
    if (error) {
      console.error('Error deleting custom task:', error);
      throw error;
    }
  },

  /**
   * Revert a modification (remove the customization, go back to standard)
   */
  async revertTaskModification(customizationId: string): Promise<void> {
    const { error } = await supabase
      .from('role_task_customizations')
      .delete()
      .eq('id', customizationId);
    if (error) {
      console.error('Error reverting task modification:', error);
      throw error;
    }
  },

  // Skills operations
  async excludeSkill(
    roleId: string,
    organizationId: string,
    baseSkillId: string
  ): Promise<void> {
    const { error } = await supabase.from('role_skill_customizations').upsert(
      {
        role_id: roleId,
        organization_id: organizationId,
        base_skill_id: baseSkillId,
        action: 'exclude',
      },
      { onConflict: 'role_id,base_skill_id' }
    );
    if (error) {
      console.error('Error excluding skill:', error);
      throw error;
    }
  },

  async includeSkill(roleId: string, baseSkillId: string): Promise<void> {
    const { error } = await supabase
      .from('role_skill_customizations')
      .delete()
      .eq('role_id', roleId)
      .eq('base_skill_id', baseSkillId)
      .eq('action', 'exclude');
    if (error) {
      console.error('Error including skill:', error);
      throw error;
    }
  },

  async modifySkill(
    roleId: string,
    organizationId: string,
    baseSkillId: string,
    customName: string,
    customDescription?: string,
    notes?: string
  ): Promise<void> {
    const { error } = await supabase.from('role_skill_customizations').upsert(
      {
        role_id: roleId,
        organization_id: organizationId,
        base_skill_id: baseSkillId,
        action: 'modify',
        custom_name: customName,
        custom_description: customDescription,
        notes,
      },
      { onConflict: 'role_id,base_skill_id' }
    );
    if (error) {
      console.error('Error modifying skill:', error);
      throw error;
    }
  },

  async addCustomSkill(
    roleId: string,
    organizationId: string,
    name: string,
    description?: string,
    importance?: number
  ): Promise<void> {
    const { error } = await supabase.from('role_skill_customizations').insert({
      role_id: roleId,
      organization_id: organizationId,
      base_skill_id: null,
      action: 'add',
      custom_name: name,
      custom_description: description,
      custom_importance: importance || 50,
    });
    if (error) {
      console.error('Error adding custom skill:', error);
      throw error;
    }
  },

  async deleteCustomSkill(customizationId: string): Promise<void> {
    const { error } = await supabase
      .from('role_skill_customizations')
      .delete()
      .eq('id', customizationId);
    if (error) {
      console.error('Error deleting custom skill:', error);
      throw error;
    }
  },

  async revertSkillModification(customizationId: string): Promise<void> {
    const { error } = await supabase
      .from('role_skill_customizations')
      .delete()
      .eq('id', customizationId);
    if (error) {
      console.error('Error reverting skill modification:', error);
      throw error;
    }
  },

  // Knowledge operations
  async excludeKnowledge(
    roleId: string,
    organizationId: string,
    baseKnowledgeId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('role_knowledge_customizations')
      .upsert(
        {
          role_id: roleId,
          organization_id: organizationId,
          base_knowledge_id: baseKnowledgeId,
          action: 'exclude',
        },
        { onConflict: 'role_id,base_knowledge_id' }
      );
    if (error) {
      console.error('Error excluding knowledge:', error);
      throw error;
    }
  },

  async includeKnowledge(roleId: string, baseKnowledgeId: string): Promise<void> {
    const { error } = await supabase
      .from('role_knowledge_customizations')
      .delete()
      .eq('role_id', roleId)
      .eq('base_knowledge_id', baseKnowledgeId)
      .eq('action', 'exclude');
    if (error) {
      console.error('Error including knowledge:', error);
      throw error;
    }
  },

  async modifyKnowledge(
    roleId: string,
    organizationId: string,
    baseKnowledgeId: string,
    customName: string,
    customDescription?: string,
    notes?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('role_knowledge_customizations')
      .upsert(
        {
          role_id: roleId,
          organization_id: organizationId,
          base_knowledge_id: baseKnowledgeId,
          action: 'modify',
          custom_name: customName,
          custom_description: customDescription,
          notes,
        },
        { onConflict: 'role_id,base_knowledge_id' }
      );
    if (error) {
      console.error('Error modifying knowledge:', error);
      throw error;
    }
  },

  async addCustomKnowledge(
    roleId: string,
    organizationId: string,
    name: string,
    description?: string,
    importance?: number
  ): Promise<void> {
    const { error } = await supabase
      .from('role_knowledge_customizations')
      .insert({
        role_id: roleId,
        organization_id: organizationId,
        base_knowledge_id: null,
        action: 'add',
        custom_name: name,
        custom_description: description,
        custom_importance: importance || 50,
      });
    if (error) {
      console.error('Error adding custom knowledge:', error);
      throw error;
    }
  },

  async deleteCustomKnowledge(customizationId: string): Promise<void> {
    const { error } = await supabase
      .from('role_knowledge_customizations')
      .delete()
      .eq('id', customizationId);
    if (error) {
      console.error('Error deleting custom knowledge:', error);
      throw error;
    }
  },

  async revertKnowledgeModification(customizationId: string): Promise<void> {
    const { error } = await supabase
      .from('role_knowledge_customizations')
      .delete()
      .eq('id', customizationId);
    if (error) {
      console.error('Error reverting knowledge modification:', error);
      throw error;
    }
  },

  // Ability operations
  async excludeAbility(roleId: string, abilityId: string): Promise<void> {
    const { error } = await supabase.from('role_ability_customizations').upsert(
      {
        role_id: roleId,
        ability_id: abilityId,
        action: 'exclude',
      },
      { onConflict: 'role_id,ability_id' }
    );
    if (error) {
      console.error('Error excluding ability:', error);
      throw error;
    }
  },

  async includeAbility(roleId: string, abilityId: string): Promise<void> {
    const { error } = await supabase
      .from('role_ability_customizations')
      .delete()
      .eq('role_id', roleId)
      .eq('ability_id', abilityId)
      .eq('action', 'exclude');
    if (error) {
      console.error('Error including ability:', error);
      throw error;
    }
  },

  async modifyAbility(
    roleId: string,
    abilityId: string,
    customName: string,
    customImportance?: number,
    customLevel?: number,
    notes?: string
  ): Promise<void> {
    const { error } = await supabase.from('role_ability_customizations').upsert(
      {
        role_id: roleId,
        ability_id: abilityId,
        action: 'modify',
        custom_name: customName,
        custom_importance: customImportance,
        custom_level: customLevel,
        notes,
      },
      { onConflict: 'role_id,ability_id' }
    );
    if (error) {
      console.error('Error modifying ability:', error);
      throw error;
    }
  },

  async addCustomAbility(
    roleId: string,
    name: string,
    importance?: number,
    level?: number,
    notes?: string
  ): Promise<void> {
    const { error } = await supabase.from('role_ability_customizations').insert({
      role_id: roleId,
      ability_id: null,
      action: 'add',
      custom_name: name,
      custom_importance: importance ?? 50,
      custom_level: level,
      notes,
    });
    if (error) {
      console.error('Error adding custom ability:', error);
      throw error;
    }
  },

  async deleteCustomAbility(customizationId: string): Promise<void> {
    const { error } = await supabase
      .from('role_ability_customizations')
      .delete()
      .eq('id', customizationId);
    if (error) {
      console.error('Error deleting ability:', error);
      throw error;
    }
  },

  async revertAbilityModification(customizationId: string): Promise<void> {
    const { error } = await supabase
      .from('role_ability_customizations')
      .delete()
      .eq('id', customizationId);
    if (error) {
      console.error('Error reverting ability modification:', error);
      throw error;
    }
  },
};

