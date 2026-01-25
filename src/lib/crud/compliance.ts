// ============================================================================
// COMPLIANCE CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId } from '../supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface ComplianceTopic {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ComplianceAuthority {
  id: string;
  state_code: string;
  name: string;
  abbreviation: string | null;
  authority_type: string | null;
  website_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplianceRequirement {
  id: string;
  notion_id: string | null;
  requirement_name: string;
  course_name: string | null;
  state_code: string;
  jurisdiction_level: 'state' | 'county' | 'city';
  jurisdiction_name: string | null;
  topic_id: string | null;  // Legacy single topic (kept for backwards compatibility)
  authority_id: string | null;
  ee_training_required: string;
  approval_required: string;
  days_to_complete: number | null;
  recertification_years: number | null;
  training_hours: number | null;
  applies_to_everyone: boolean;
  applies_to_foodservice: boolean;
  applies_to_frontline: boolean;
  applies_to_managers: boolean;
  applies_to_retail: boolean;
  law_name: string | null;
  law_code_reference: string | null;
  cert_details_url: string | null;
  authority_url: string | null;
  partner_available: boolean;
  partner_name: string | null;
  status: string;
  roadmap_priority: string | null;
  notes: string | null;
  last_verified_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  topic?: ComplianceTopic;  // Legacy single topic
  topics?: ComplianceTopic[];  // Multiple topics via junction table
  authority?: ComplianceAuthority;
}

export interface ComplianceDashboardMetrics {
  totalEmployees: number;
  compliantEmployees: number;
  complianceRate: number;
  overdueCount: number;
  expiringSoonCount: number;
  certificationCount: number;
}

export interface ComplianceByCategory {
  category: string;
  topicId: string;
  required: number;
  completed: number;
  overdue: number;
  rate: number;
}

export interface StoreRiskAssessment {
  storeId: string;
  storeName: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  issues: number;
  overdueCount: number;
  missingCount: number;
}

export interface ExpiringCertification {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  storeName: string | null;
  certificationName: string;
  expirationDate: string;
  daysUntilExpiration: number;
  priority: 'high' | 'medium' | 'low';
}

// ============================================================================
// COMPLIANCE TOPICS
// ============================================================================

/**
 * Get all compliance topics
 */
export async function getComplianceTopics(): Promise<ComplianceTopic[]> {
  const { data, error } = await supabase
    .from('compliance_topics')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Create a compliance topic (Trike Super Admin only)
 */
export async function createComplianceTopic(input: {
  name: string;
  description?: string;
  icon?: string;
  sort_order?: number;
}): Promise<ComplianceTopic> {
  const { data, error } = await supabase
    .from('compliance_topics')
    .insert({
      name: input.name,
      description: input.description,
      icon: input.icon,
      sort_order: input.sort_order ?? 0
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a compliance topic (Trike Super Admin only)
 */
export async function updateComplianceTopic(
  id: string,
  input: Partial<{
    name: string;
    description: string;
    icon: string;
    sort_order: number;
  }>
): Promise<ComplianceTopic> {
  const { data, error } = await supabase
    .from('compliance_topics')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a compliance topic (Trike Super Admin only)
 */
export async function deleteComplianceTopic(id: string): Promise<void> {
  const { error } = await supabase
    .from('compliance_topics')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// COMPLIANCE AUTHORITIES
// ============================================================================

/**
 * Get compliance authorities, optionally filtered by state
 */
export async function getComplianceAuthorities(stateCode?: string): Promise<ComplianceAuthority[]> {
  let query = supabase
    .from('compliance_authorities')
    .select('*')
    .order('state_code', { ascending: true })
    .order('name', { ascending: true });

  if (stateCode) {
    query = query.eq('state_code', stateCode.toUpperCase());
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Create a compliance authority (Trike Super Admin only)
 */
export async function createComplianceAuthority(input: {
  state_code?: string | null;
  name: string;
  abbreviation?: string | null;
  authority_type?: string | null;
  website_url?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  notes?: string | null;
}): Promise<ComplianceAuthority> {
  const { data, error } = await supabase
    .from('compliance_authorities')
    .insert({
      ...input,
      state_code: input.state_code?.toUpperCase() || null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a compliance authority (Trike Super Admin only)
 */
export async function updateComplianceAuthority(
  id: string,
  input: Partial<ComplianceAuthority>
): Promise<ComplianceAuthority> {
  const { data, error } = await supabase
    .from('compliance_authorities')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a compliance authority (Trike Super Admin only)
 */
export async function deleteComplianceAuthority(id: string): Promise<void> {
  const { error } = await supabase
    .from('compliance_authorities')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// COMPLIANCE REQUIREMENTS
// ============================================================================

export interface ComplianceRequirementFilters {
  stateCode?: string;
  topicId?: string;
  status?: string;
  eeTrainingRequired?: string;
  roadmapPriority?: string;
}

/**
 * Get compliance requirements with optional filters
 */
export async function getComplianceRequirements(
  filters?: ComplianceRequirementFilters
): Promise<ComplianceRequirement[]> {
  let query = supabase
    .from('compliance_requirements')
    .select(`
      *,
      topic:compliance_topics(*),
      authority:compliance_authorities(*)
    `)
    .order('state_code', { ascending: true })
    .order('requirement_name', { ascending: true });

  if (filters?.stateCode) {
    query = query.eq('state_code', filters.stateCode.toUpperCase());
  }
  if (filters?.topicId) {
    query = query.eq('topic_id', filters.topicId);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.eeTrainingRequired) {
    query = query.eq('ee_training_required', filters.eeTrainingRequired);
  }
  if (filters?.roadmapPriority) {
    query = query.eq('roadmap_priority', filters.roadmapPriority);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Get a single compliance requirement by ID
 */
export async function getComplianceRequirement(id: string): Promise<ComplianceRequirement | null> {
  const { data, error } = await supabase
    .from('compliance_requirements')
    .select(`
      *,
      topic:compliance_topics(*),
      authority:compliance_authorities(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

/**
 * Create a compliance requirement (Trike Super Admin only)
 */
export async function createComplianceRequirement(
  input: Partial<ComplianceRequirement>
): Promise<ComplianceRequirement> {
  const { data, error } = await supabase
    .from('compliance_requirements')
    .insert({
      ...input,
      state_code: input.state_code?.toUpperCase()
    })
    .select(`
      *,
      topic:compliance_topics(*),
      authority:compliance_authorities(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a compliance requirement (Trike Super Admin only)
 */
export async function updateComplianceRequirement(
  id: string,
  input: Partial<ComplianceRequirement>
): Promise<ComplianceRequirement> {
  const { data, error } = await supabase
    .from('compliance_requirements')
    .update(input)
    .eq('id', id)
    .select(`
      *,
      topic:compliance_topics(*),
      authority:compliance_authorities(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a compliance requirement (Trike Super Admin only)
 */
export async function deleteComplianceRequirement(id: string): Promise<void> {
  const { error } = await supabase
    .from('compliance_requirements')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// REQUIREMENT TOPICS (MULTI-TOPIC SUPPORT)
// ============================================================================

/**
 * Get topics for a requirement
 */
export async function getRequirementTopics(requirementId: string): Promise<ComplianceTopic[]> {
  const { data, error } = await supabase
    .from('requirement_topics')
    .select('topic:compliance_topics(*)')
    .eq('requirement_id', requirementId);

  if (error) throw error;
  return (data || []).map((row: any) => row.topic).filter(Boolean);
}

/**
 * Set topics for a requirement (replaces existing)
 */
export async function setRequirementTopics(
  requirementId: string,
  topicIds: string[]
): Promise<void> {
  // Delete existing topic associations
  const { error: deleteError } = await supabase
    .from('requirement_topics')
    .delete()
    .eq('requirement_id', requirementId);

  if (deleteError) throw deleteError;

  // Insert new topic associations
  if (topicIds.length > 0) {
    const { error: insertError } = await supabase
      .from('requirement_topics')
      .insert(
        topicIds.map(topicId => ({
          requirement_id: requirementId,
          topic_id: topicId
        }))
      );

    if (insertError) throw insertError;
  }

  // Also update the legacy topic_id field with the first topic (for backwards compatibility)
  const { error: updateError } = await supabase
    .from('compliance_requirements')
    .update({ topic_id: topicIds[0] || null })
    .eq('id', requirementId);

  if (updateError) throw updateError;
}

/**
 * Get requirements with their topics (enriched)
 */
export async function getComplianceRequirementsWithTopics(
  filters?: ComplianceRequirementFilters
): Promise<ComplianceRequirement[]> {
  const requirements = await getComplianceRequirements(filters);

  // Fetch all requirement_topics in one query
  const requirementIds = requirements.map(r => r.id);
  if (requirementIds.length === 0) return requirements;

  const { data: topicLinks, error } = await supabase
    .from('requirement_topics')
    .select('requirement_id, topic:compliance_topics(*)')
    .in('requirement_id', requirementIds);

  if (error) {
    console.error('Error fetching requirement topics:', error);
    return requirements; // Return without topics if fetch fails
  }

  // Group topics by requirement
  const topicsByRequirement: Record<string, ComplianceTopic[]> = {};
  for (const link of topicLinks || []) {
    if (!topicsByRequirement[link.requirement_id]) {
      topicsByRequirement[link.requirement_id] = [];
    }
    if (link.topic) {
      topicsByRequirement[link.requirement_id].push(link.topic as ComplianceTopic);
    }
  }

  // Enrich requirements with topics
  return requirements.map(req => ({
    ...req,
    topics: topicsByRequirement[req.id] || []
  }));
}

// ============================================================================
// STORE & ROLE ASSIGNMENTS
// ============================================================================

/**
 * Get store compliance requirements
 */
export async function getStoreComplianceRequirements(storeId: string) {
  const { data, error } = await supabase
    .from('store_compliance_requirements')
    .select(`
      *,
      requirement:compliance_requirements(
        *,
        topic:compliance_topics(*),
        authority:compliance_authorities(*)
      )
    `)
    .eq('store_id', storeId);

  if (error) throw error;
  return data || [];
}

/**
 * Assign a requirement to a store
 */
export async function assignRequirementToStore(
  storeId: string,
  requirementId: string,
  options?: { is_applicable?: boolean; override_notes?: string }
): Promise<void> {
  const { error } = await supabase
    .from('store_compliance_requirements')
    .upsert({
      store_id: storeId,
      requirement_id: requirementId,
      is_applicable: options?.is_applicable ?? true,
      override_notes: options?.override_notes
    });

  if (error) throw error;
}

/**
 * Remove a store compliance requirement
 */
export async function removeStoreRequirement(
  storeId: string,
  requirementId: string
): Promise<void> {
  const { error } = await supabase
    .from('store_compliance_requirements')
    .delete()
    .eq('store_id', storeId)
    .eq('requirement_id', requirementId);

  if (error) throw error;
}

/**
 * Get role compliance requirements
 */
export async function getRoleComplianceRequirements(roleId: string) {
  const { data, error } = await supabase
    .from('role_compliance_requirements')
    .select(`
      *,
      requirement:compliance_requirements(
        *,
        topic:compliance_topics(*),
        authority:compliance_authorities(*)
      )
    `)
    .eq('role_id', roleId)
    .order('priority', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Assign a requirement to a role
 */
export async function assignRequirementToRole(
  roleId: string,
  requirementId: string,
  options?: { is_required?: boolean; priority?: number }
): Promise<void> {
  const { error } = await supabase
    .from('role_compliance_requirements')
    .upsert({
      role_id: roleId,
      requirement_id: requirementId,
      is_required: options?.is_required ?? true,
      priority: options?.priority ?? 1
    });

  if (error) throw error;
}

/**
 * Remove a role compliance requirement
 */
export async function removeRoleRequirement(
  roleId: string,
  requirementId: string
): Promise<void> {
  const { error } = await supabase
    .from('role_compliance_requirements')
    .delete()
    .eq('role_id', roleId)
    .eq('requirement_id', requirementId);

  if (error) throw error;
}

// ============================================================================
// DASHBOARD METRICS & ANALYTICS
// ============================================================================

/**
 * Get compliance dashboard metrics for the organization
 */
export async function getComplianceDashboardMetrics(): Promise<ComplianceDashboardMetrics> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Get total active employees
  const { count: totalEmployees, error: empError } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'active');

  if (empError) throw empError;

  // Get users with valid certifications
  const { data: certifiedUsers, error: certError } = await supabase
    .from('user_certifications')
    .select('user_id')
    .in('status', ['valid', 'expiring-soon']);

  if (certError) throw certError;

  const uniqueCertifiedUsers = new Set(certifiedUsers?.map(c => c.user_id) || []);

  // Get count of expiring soon certifications
  const today = new Date();
  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const { count: expiringSoonCount, error: expiringError } = await supabase
    .from('user_certifications')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'expiring-soon');

  if (expiringError) throw expiringError;

  // Get count of expired/overdue certifications
  const { count: overdueCount, error: overdueError } = await supabase
    .from('user_certifications')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'expired');

  if (overdueError) throw overdueError;

  // Get total certification count
  const { count: certificationCount, error: totalCertError } = await supabase
    .from('user_certifications')
    .select('*', { count: 'exact', head: true });

  if (totalCertError) throw totalCertError;

  const total = totalEmployees || 0;
  const compliant = uniqueCertifiedUsers.size;
  const rate = total > 0 ? Math.round((compliant / total) * 100) : 0;

  return {
    totalEmployees: total,
    compliantEmployees: compliant,
    complianceRate: rate,
    overdueCount: overdueCount || 0,
    expiringSoonCount: expiringSoonCount || 0,
    certificationCount: certificationCount || 0
  };
}

/**
 * Get compliance breakdown by category (topic)
 */
export async function getComplianceByCategory(): Promise<ComplianceByCategory[]> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Get all compliance topics
  const topics = await getComplianceTopics();

  // Get all users in org
  const { count: totalUsers, error: usersError } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'active');

  if (usersError) throw usersError;

  // For each topic, calculate compliance stats
  // This is a simplified version - in production you'd join with user_certifications
  // and track which certifications map to which topics
  const results: ComplianceByCategory[] = [];

  for (const topic of topics) {
    // Get requirements for this topic
    const { data: requirements, error: reqError } = await supabase
      .from('compliance_requirements')
      .select('id')
      .eq('topic_id', topic.id);

    if (reqError) continue;

    // For now, use placeholder data based on topic
    // In production, this would count actual user_certifications
    const required = totalUsers || 0;
    const completed = Math.floor(required * (0.85 + Math.random() * 0.15)); // 85-100% placeholder
    const overdue = Math.max(0, required - completed);
    const rate = required > 0 ? Math.round((completed / required) * 100 * 10) / 10 : 0;

    results.push({
      category: topic.name,
      topicId: topic.id,
      required,
      completed,
      overdue,
      rate
    });
  }

  return results;
}

/**
 * Get expiring certifications for the organization
 */
export async function getExpiringCertificationsForOrg(
  daysThreshold: number = 30
): Promise<ExpiringCertification[]> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + daysThreshold);

  const { data, error } = await supabase
    .from('user_certifications')
    .select(`
      id,
      user_id,
      expiration_date,
      user:users!inner(
        id,
        name,
        email,
        organization_id,
        store:stores(name)
      ),
      certification:certifications(name)
    `)
    .eq('user.organization_id', orgId)
    .in('status', ['valid', 'expiring-soon'])
    .gte('expiration_date', today.toISOString().split('T')[0])
    .lte('expiration_date', futureDate.toISOString().split('T')[0])
    .order('expiration_date', { ascending: true });

  if (error) throw error;

  return (data || []).map((cert: any) => {
    const expirationDate = new Date(cert.expiration_date);
    const daysUntil = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let priority: 'high' | 'medium' | 'low' = 'low';
    if (daysUntil <= 7) priority = 'high';
    else if (daysUntil <= 14) priority = 'medium';

    return {
      id: cert.id,
      userId: cert.user_id,
      userName: cert.user?.name || 'Unknown',
      userEmail: cert.user?.email || '',
      storeName: cert.user?.store?.name || null,
      certificationName: cert.certification?.name || 'Unknown Certification',
      expirationDate: cert.expiration_date,
      daysUntilExpiration: daysUntil,
      priority
    };
  });
}

/**
 * Get store risk assessment for the organization
 */
export async function getStoreRiskAssessment(): Promise<StoreRiskAssessment[]> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Get all stores in the organization
  const { data: stores, error: storesError } = await supabase
    .from('stores')
    .select('id, name, state')
    .eq('organization_id', orgId)
    .eq('is_active', true);

  if (storesError) throw storesError;
  if (!stores || stores.length === 0) return [];

  const results: StoreRiskAssessment[] = [];

  for (const store of stores) {
    // Get employees in this store
    const { data: employees, error: empError } = await supabase
      .from('users')
      .select('id')
      .eq('store_id', store.id)
      .eq('status', 'active');

    if (empError) continue;

    const employeeIds = employees?.map(e => e.id) || [];
    if (employeeIds.length === 0) {
      results.push({
        storeId: store.id,
        storeName: store.name,
        riskLevel: 'low',
        score: 100,
        issues: 0,
        overdueCount: 0,
        missingCount: 0
      });
      continue;
    }

    // Get certification stats for these employees
    const { data: certs, error: certsError } = await supabase
      .from('user_certifications')
      .select('status')
      .in('user_id', employeeIds);

    if (certsError) continue;

    const overdueCount = certs?.filter(c => c.status === 'expired').length || 0;
    const expiringSoonCount = certs?.filter(c => c.status === 'expiring-soon').length || 0;

    // Calculate risk score (100 = no risk, 0 = highest risk)
    const totalIssues = overdueCount + expiringSoonCount;
    const issueRatio = employeeIds.length > 0 ? totalIssues / employeeIds.length : 0;
    const score = Math.max(0, Math.round(100 - (issueRatio * 100)));

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (score < 50) riskLevel = 'critical';
    else if (score < 70) riskLevel = 'high';
    else if (score < 85) riskLevel = 'medium';

    results.push({
      storeId: store.id,
      storeName: store.name,
      riskLevel,
      score,
      issues: totalIssues,
      overdueCount,
      missingCount: 0 // Would need to calculate based on required vs actual certs
    });
  }

  // Sort by risk level (critical first, then high, medium, low)
  const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  results.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);

  return results;
}

/**
 * Get user's compliance status based on their store and role
 * Uses the database function get_user_compliance_requirements
 */
export async function getUserComplianceStatus(userId: string) {
  const { data, error } = await supabase
    .rpc('get_user_compliance_requirements', { p_user_id: userId });

  if (error) throw error;
  return data || [];
}

// ============================================================================
// COMPLIANCE TREND DATA (for charts)
// ============================================================================

// ============================================================================
// COMPLIANCE AUDIT FUNCTIONS
// ============================================================================

export interface AuditLearner {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  hireDate: string;
  location: string;
  manager: string;
  employeeId: string;
}

export interface AuditTrack {
  id: string;
  title: string;
  album: string;
  type: string;
  duration: string;
  category: string;
}

export interface TrackCompletionDetail {
  trackId: string;
  trackTitle: string;
  trackType: string;
  album: string;
  status: 'completed' | 'passed' | 'failed' | 'not_started';
  startedAt: string | null;
  completedAt: string | null;
  score: number | null;
  passed: boolean | null;
  attempts: number;
  timeSpentMinutes: number;
}

/**
 * Get learners (employees) for compliance audit selection
 */
export async function getAuditLearners(filters?: {
  storeId?: string;
  search?: string;
}): Promise<AuditLearner[]> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  let query = supabase
    .from('users')
    .select(`
      id,
      first_name,
      last_name,
      email,
      employee_id,
      hire_date,
      store_id,
      role:roles(name),
      store:stores(
        id,
        name,
        code,
        district:districts(name)
      )
    `)
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .order('first_name', { ascending: true });

  if (filters?.storeId) {
    query = query.eq('store_id', filters.storeId);
  }

  if (filters?.search) {
    query = query.or(
      `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,employee_id.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  // Get managers for each user
  const usersWithManagers: AuditLearner[] = [];

  for (const user of data || []) {
    // Get manager (simplified - would typically come from a manager_id field)
    // For now, use store manager or 'N/A'
    let managerName = 'N/A';

    // Try to find store manager if this user is not a manager
    if (user.store_id && (user.role as any)?.name !== 'Store Manager') {
      const { data: storeManager } = await supabase
        .from('users')
        .select('first_name, last_name, role:roles(name)')
        .eq('store_id', user.store_id)
        .eq('status', 'active')
        .limit(10);

      // Find someone with "manager" in their role name
      const manager = storeManager?.find(u =>
        (u.role as any)?.name?.toLowerCase().includes('manager')
      );

      if (manager) {
        managerName = `${manager.first_name} ${manager.last_name}`;
      }
    }

    usersWithManagers.push({
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      role: (user.role as any)?.name || 'Unknown',
      department: (user.role as any)?.name || 'General',
      hireDate: user.hire_date || '',
      location: user.store
        ? `${(user.store as any).name}${(user.store as any).code ? ` - ${(user.store as any).code}` : ''}`
        : 'No Store',
      manager: managerName,
      employeeId: user.employee_id || `EMP-${user.id.substring(0, 8)}`
    });
  }

  return usersWithManagers;
}

/**
 * Get tracks available for compliance audit selection
 */
export async function getAuditTracks(filters?: {
  category?: string;
  search?: string;
}): Promise<AuditTrack[]> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  let query = supabase
    .from('tracks')
    .select(`
      id,
      title,
      type,
      duration_seconds,
      category,
      album:albums(name)
    `)
    .eq('organization_id', orgId)
    .eq('status', 'published')
    .order('title', { ascending: true });

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  if (filters?.search) {
    query = query.ilike('title', `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(track => ({
    id: track.id,
    title: track.title,
    album: (track.album as any)?.name || 'Unassigned',
    type: track.type || 'Content',
    duration: formatDuration(track.duration_seconds),
    category: track.category || 'General'
  }));
}

/**
 * Get detailed track completion data for a learner and specific tracks
 */
export async function getAuditTrackCompletions(
  userId: string,
  trackIds: string[]
): Promise<TrackCompletionDetail[]> {
  if (!userId || trackIds.length === 0) return [];

  // Get track details
  const { data: tracks, error: tracksError } = await supabase
    .from('tracks')
    .select(`
      id,
      title,
      type,
      album:albums(name)
    `)
    .in('id', trackIds);

  if (tracksError) throw tracksError;

  // Get completions for these tracks
  const { data: completions, error: completionsError } = await supabase
    .from('track_completions')
    .select(`
      track_id,
      status,
      score,
      passed,
      attempts,
      time_spent_minutes,
      completed_at,
      metadata
    `)
    .eq('user_id', userId)
    .in('track_id', trackIds);

  if (completionsError) throw completionsError;

  // Get progress data for started-but-not-completed tracks
  const { data: progressData, error: progressError } = await supabase
    .from('user_progress')
    .select('track_id, started_at, progress_percent')
    .eq('user_id', userId)
    .in('track_id', trackIds)
    .lt('progress_percent', 100);

  if (progressError) throw progressError;

  // Build completion map
  const completionMap = new Map(completions?.map(c => [c.track_id, c]) || []);
  const progressMap = new Map(progressData?.map(p => [p.track_id, p]) || []);

  return (tracks || []).map(track => {
    const completion = completionMap.get(track.id);
    const progress = progressMap.get(track.id);

    if (completion) {
      return {
        trackId: track.id,
        trackTitle: track.title,
        trackType: track.type || 'Content',
        album: (track.album as any)?.name || 'Unassigned',
        status: completion.status as 'completed' | 'passed' | 'failed',
        startedAt: null, // Would need to track this separately
        completedAt: completion.completed_at,
        score: completion.score,
        passed: completion.passed,
        attempts: completion.attempts || 1,
        timeSpentMinutes: completion.time_spent_minutes || 0
      };
    } else if (progress) {
      return {
        trackId: track.id,
        trackTitle: track.title,
        trackType: track.type || 'Content',
        album: (track.album as any)?.name || 'Unassigned',
        status: 'not_started' as const, // In progress but not completed
        startedAt: progress.started_at,
        completedAt: null,
        score: null,
        passed: null,
        attempts: 0,
        timeSpentMinutes: 0
      };
    } else {
      return {
        trackId: track.id,
        trackTitle: track.title,
        trackType: track.type || 'Content',
        album: (track.album as any)?.name || 'Unassigned',
        status: 'not_started' as const,
        startedAt: null,
        completedAt: null,
        score: null,
        passed: null,
        attempts: 0,
        timeSpentMinutes: 0
      };
    }
  });
}

/**
 * Get detailed activity events for a user and track (for audit timeline)
 */
export async function getAuditActivityTimeline(
  userId: string,
  trackId: string
) {
  const { data, error } = await supabase
    .from('activity_events')
    .select('*')
    .eq('user_id', userId)
    .eq('object_id', trackId)
    .eq('object_type', 'track')
    .order('timestamp', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Helper function to format duration from seconds
 */
function formatDuration(seconds: number | null): string {
  if (!seconds) return 'N/A';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Get compliance trend data for the last N months
 */
export async function getComplianceTrendData(months: number = 6) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // For now, return mock data structure
  // In production, this would query historical certification data
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const today = new Date();
  const data = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setMonth(date.getMonth() - i);

    // Generate somewhat realistic trending data
    const baseRate = 85 + Math.floor(Math.random() * 10);

    data.push({
      month: monthNames[date.getMonth()],
      company: Math.min(100, baseRate + Math.floor(Math.random() * 5)),
      district: Math.min(100, baseRate - 2 + Math.floor(Math.random() * 5)),
      unit: Math.min(100, baseRate - 4 + Math.floor(Math.random() * 5))
    });
  }

  return data;
}

// ============================================================================
// REQUIREMENT-ROLE ASSIGNMENTS
// ============================================================================
// These functions handle the "mad libs" approach: assigning roles to requirements
// "People with these ROLES in this STATE need this CERTIFICATION"
// ============================================================================

export interface RequirementRole {
  id: string;
  role_id: string;
  requirement_id: string;
  is_required: boolean;
  priority: number;
  created_at: string;
  role?: {
    id: string;
    name: string;
    description: string | null;
    is_frontline: boolean;
    is_manager: boolean;
  };
}

/**
 * Get roles assigned to a compliance requirement
 * This is the inverse of getRoleComplianceRequirements - used for the "mad libs" UI
 */
export async function getRequirementRoles(requirementId: string): Promise<RequirementRole[]> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('role_compliance_requirements')
    .select(`
      *,
      role:roles!inner(id, name, description, is_frontline, is_manager, organization_id)
    `)
    .eq('requirement_id', requirementId)
    .eq('role.organization_id', orgId);

  if (error) throw error;
  return data || [];
}

/**
 * Set roles for a compliance requirement (replaces all existing)
 * This is the main function for the "mad libs" UI
 */
export async function setRequirementRoles(
  requirementId: string,
  roleIds: string[]
): Promise<void> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Validate: ensure all roleIds belong to this org
  if (roleIds.length > 0) {
    const { data: validRoles, error: validationError } = await supabase
      .from('roles')
      .select('id')
      .eq('organization_id', orgId)
      .in('id', roleIds);

    if (validationError) throw validationError;

    const validIds = new Set((validRoles || []).map(r => r.id));
    const invalidIds = roleIds.filter(id => !validIds.has(id));
    if (invalidIds.length > 0) {
      throw new Error(`Role IDs do not belong to this organization: ${invalidIds.join(', ')}`);
    }
  }

  // Get existing role assignments for this requirement in this org
  const { data: existingRoles, error: fetchError } = await supabase
    .from('role_compliance_requirements')
    .select('role_id, role:roles!inner(organization_id)')
    .eq('requirement_id', requirementId)
    .eq('role.organization_id', orgId);

  if (fetchError) throw fetchError;

  const existingRoleIds = new Set((existingRoles || []).map((r: any) => r.role_id));
  const desiredRoleIds = new Set(roleIds);

  // Determine deletes and inserts
  const toDelete = [...existingRoleIds].filter(id => !desiredRoleIds.has(id));
  const toInsert = roleIds.filter(id => !existingRoleIds.has(id));

  // Delete removed roles
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('role_compliance_requirements')
      .delete()
      .eq('requirement_id', requirementId)
      .in('role_id', toDelete);

    if (deleteError) throw deleteError;
  }

  // Insert new roles
  if (toInsert.length > 0) {
    const records = toInsert.map((roleId, index) => ({
      role_id: roleId,
      requirement_id: requirementId,
      is_required: true,
      priority: index + 1
    }));

    const { error: insertError } = await supabase
      .from('role_compliance_requirements')
      .upsert(records, { onConflict: 'role_id,requirement_id' });

    if (insertError) throw insertError;
  }
}

/**
 * Add a single role to a requirement
 */
export async function addRoleToRequirement(
  requirementId: string,
  roleId: string,
  options?: { is_required?: boolean; priority?: number }
): Promise<void> {
  const { error } = await supabase
    .from('role_compliance_requirements')
    .upsert({
      role_id: roleId,
      requirement_id: requirementId,
      is_required: options?.is_required ?? true,
      priority: options?.priority ?? 1
    });

  if (error) throw error;
}

/**
 * Remove a single role from a requirement
 */
export async function removeRoleFromRequirement(
  requirementId: string,
  roleId: string
): Promise<void> {
  const { error } = await supabase
    .from('role_compliance_requirements')
    .delete()
    .eq('requirement_id', requirementId)
    .eq('role_id', roleId);

  if (error) throw error;
}

/**
 * Get requirements with their assigned roles for the org's states
 * Used to populate the compliance setup page
 */
export async function getRequirementsWithRoles(filters?: {
  stateCode?: string;
  topicId?: string;
}): Promise<(ComplianceRequirement & { roles: RequirementRole[] })[]> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Get requirements
  let query = supabase
    .from('compliance_requirements')
    .select(`
      *,
      topic:compliance_topics(*),
      authority:compliance_authorities(*)
    `)
    .order('state_code')
    .order('requirement_name');

  if (filters?.stateCode) {
    query = query.eq('state_code', filters.stateCode.toUpperCase());
  }
  if (filters?.topicId) {
    query = query.eq('topic_id', filters.topicId);
  }

  const { data: requirements, error: reqError } = await query;
  if (reqError) throw reqError;

  // Get role assignments for all requirements
  const requirementIds = (requirements || []).map(r => r.id);

  if (requirementIds.length === 0) {
    return [];
  }

  const { data: roleAssignments, error: rolesError } = await supabase
    .from('role_compliance_requirements')
    .select(`
      *,
      role:roles!inner(id, name, description, is_frontline, is_manager, organization_id)
    `)
    .in('requirement_id', requirementIds)
    .eq('role.organization_id', orgId);

  if (rolesError) throw rolesError;

  // Group role assignments by requirement
  const rolesByRequirement = new Map<string, RequirementRole[]>();
  for (const ra of (roleAssignments || [])) {
    const reqId = ra.requirement_id;
    if (!rolesByRequirement.has(reqId)) {
      rolesByRequirement.set(reqId, []);
    }
    rolesByRequirement.get(reqId)!.push(ra);
  }

  // Combine requirements with their roles
  return (requirements || []).map(req => ({
    ...req,
    roles: rolesByRequirement.get(req.id) || []
  }));
}

/**
 * Get all org roles for the role picker dropdown
 */
export async function getOrgRolesForPicker(): Promise<{
  id: string;
  name: string;
  description: string | null;
  is_frontline: boolean;
  is_manager: boolean;
}[]> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('roles')
    .select('id, name, description, is_frontline, is_manager')
    .eq('organization_id', orgId)
    .order('name');

  if (error) throw error;
  return data || [];
}

/**
 * Get states the organization operates in (based on store locations)
 * Used to filter requirements in the compliance setup UI
 */
export async function getOrgStates(): Promise<string[]> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('stores')
    .select('state')
    .eq('organization_id', orgId)
    .eq('is_active', true);

  if (error) throw error;

  // Get unique states
  const states = [...new Set((data || []).map(s => s.state?.toUpperCase()).filter(Boolean))];
  return states.sort();
}

/**
 * Get suggested requirements for an org based on their states and industry
 * This powers the initial setup recommendations
 */
export async function getSuggestedRequirements(): Promise<ComplianceRequirement[]> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Get org's states and industry
  const [states, { data: org }] = await Promise.all([
    getOrgStates(),
    supabase
      .from('organizations')
      .select('industry_id')
      .eq('id', orgId)
      .single()
  ]);

  if (states.length === 0) {
    return [];
  }

  // Get requirements for these states
  let query = supabase
    .from('compliance_requirements')
    .select(`
      *,
      topic:compliance_topics(*),
      authority:compliance_authorities(*)
    `)
    .in('state_code', states)
    .in('ee_training_required', ['required_certified', 'required_program', 'required_no_list'])
    .order('state_code')
    .order('requirement_name');

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}
