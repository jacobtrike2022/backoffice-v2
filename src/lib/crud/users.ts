// ============================================================================
// USERS CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId } from '../supabase';
import { recordImport } from './userImportHistory';

export interface CreateUserInput {
  email: string;
  first_name: string;
  last_name: string;
  role_id: string;
  store_id?: string;
  employee_id?: string;
  hire_date?: string;
  phone?: string;
  mobile_phone?: string;
  organization_id?: string;
}

/**
 * Create a new user and send invite email
 */
export async function createUser(input: CreateUserInput) {
  // Input validation
  if (!input.email || typeof input.email !== 'string' || !input.email.includes('@')) {
    throw new Error('Invalid email: must be a valid email address');
  }
  if (!input.first_name || typeof input.first_name !== 'string' || input.first_name.trim().length === 0) {
    throw new Error('Invalid first_name: must be a non-empty string');
  }
  if (!input.last_name || typeof input.last_name !== 'string' || input.last_name.trim().length === 0) {
    throw new Error('Invalid last_name: must be a non-empty string');
  }
  if (!input.role_id || typeof input.role_id !== 'string') {
    throw new Error('Invalid role_id: must be a non-empty string');
  }
  if (input.store_id && typeof input.store_id !== 'string') {
    throw new Error('Invalid store_id: must be a string if provided');
  }
  if (input.phone && typeof input.phone !== 'string') {
    throw new Error('Invalid phone: must be a string if provided');
  }
  if (input.hire_date && !/^\d{4}-\d{2}-\d{2}$/.test(input.hire_date)) {
    throw new Error('Invalid hire_date: must be in YYYY-MM-DD format');
  }

  const orgId = input.organization_id || await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated or no organization specified');

  const inviteUrl = await inviteUserViaEmail(input.email);

  // Create user record
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      organization_id: orgId,
      email: input.email,
      first_name: input.first_name,
      last_name: input.last_name,
      role_id: input.role_id,
      store_id: input.store_id,
      employee_id: input.employee_id,
      hire_date: input.hire_date,
      phone: input.phone,
      mobile_phone: input.mobile_phone,
      status: 'active'
    })
    .select()
    .single();

  if (error) throw error;

  return { user, inviteUrl };
}

/**
 * Update user profile
 */
export async function updateUser(
  userId: string,
  updates: Partial<CreateUserInput> & { status?: 'active' | 'inactive' | 'on-leave' }
) {
  // Input validation
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string');
  }
  if (updates.email && (!updates.email.includes('@') || typeof updates.email !== 'string')) {
    throw new Error('Invalid email: must be a valid email address');
  }
  if (updates.first_name && (typeof updates.first_name !== 'string' || updates.first_name.trim().length === 0)) {
    throw new Error('Invalid first_name: must be a non-empty string');
  }
  if (updates.last_name && (typeof updates.last_name !== 'string' || updates.last_name.trim().length === 0)) {
    throw new Error('Invalid last_name: must be a non-empty string');
  }
  if (updates.status && !['active', 'inactive', 'on-leave'].includes(updates.status)) {
    throw new Error('Invalid status: must be one of active, inactive, or on-leave');
  }
  if (updates.hire_date && !/^\d{4}-\d{2}-\d{2}$/.test(updates.hire_date)) {
    throw new Error('Invalid hire_date: must be in YYYY-MM-DD format');
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get user by ID with relations
 */
export async function getUserById(userId: string) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string');
  }

  const { data, error } = await supabase
    .from('users')
    .select(`
      *,
      role:roles(*),
      store:stores!store_id(*)
    `)
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all users with filters
 */
export async function getUsers(filters: {
  role_id?: string;
  store_id?: string;
  status?: string;
  search?: string;
} = {}) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  let query = supabase
    .from('users')
    .select(`
      *,
      role:roles!users_role_id_fkey(name, employment_type),
      store:stores!store_id(name, code, district:districts(name))
    `)
    .eq('organization_id', orgId);

  if (filters.role_id) {
    query = query.eq('role_id', filters.role_id);
  }

  if (filters.store_id) {
    query = query.eq('store_id', filters.store_id);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.search) {
    query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,employee_id.ilike.%${filters.search}%`);
  }

  const { data: users, error } = await query.order('first_name', { ascending: true });

  if (error) throw error;

  if (!users || users.length === 0) {
    return [];
  }

  const userIds = users.map(u => u.id);

  // Use database aggregations instead of fetching all records
  // Get progress stats from track_completions (source of truth)
  // Get all assignments to know which tracks are assigned
  const { data: assignments } = await supabase
    .from('assignments')
    .select('id, user_id, playlist_id')
    .in('user_id', userIds);

  // Get all track completions
  const { data: trackCompletions } = await supabase
    .from('track_completions')
    .select('track_id, user_id, score, passed')
    .in('user_id', userIds);

  // Build track assignment map: user_id -> set of track_ids from their assignments
  const tracksByUser: Record<string, Set<string>> = {};
  if (assignments) {
    const playlistIds = [...new Set(assignments.map(a => a.playlist_id).filter(Boolean))];
    if (playlistIds.length > 0) {
      const { data: playlistTracks } = await supabase
        .from('playlist_tracks')
        .select('track_id, playlist_id')
        .in('playlist_id', playlistIds);

      assignments.forEach(assignment => {
        if (!tracksByUser[assignment.user_id]) {
          tracksByUser[assignment.user_id] = new Set();
        }
        playlistTracks?.forEach(pt => {
          if (pt.playlist_id === assignment.playlist_id) {
            tracksByUser[assignment.user_id].add(pt.track_id);
          }
        });
      });
    }
  }

  // Calculate progress for each user: completed tracks / assigned tracks
  const progressByUser: Record<string, { completed: number; total: number; scores: number[] }> = {};
  
  userIds.forEach(userId => {
    const assignedTracks = tracksByUser[userId] || new Set();
    const userCompletions = trackCompletions?.filter(tc => tc.user_id === userId) || [];
    const completedTracks = userCompletions.filter(tc => assignedTracks.has(tc.track_id));
    
    // Calculate average score from completed tracks
    const scores = completedTracks
      .map(tc => tc.score)
      .filter((score): score is number => score !== null && score !== undefined);
    
    progressByUser[userId] = {
      completed: completedTracks.length,
      total: assignedTracks.size,
      scores
    };
  });

  // Get assignment counts aggregated by user
  const { data: assignmentStats } = await supabase
    .from('assignments')
    .select('user_id, status, progress_percent')
    .in('user_id', userIds);

  // Get certification counts aggregated by user
  const { data: certificationStats } = await supabase
    .from('user_certifications')
    .select('user_id')
    .in('user_id', userIds)
    .eq('status', 'active');

  const assignmentsByUser: Record<string, number> = {};
  assignmentStats?.forEach(a => {
    assignmentsByUser[a.user_id] = (assignmentsByUser[a.user_id] || 0) + 1;
  });

  const certsByUser: Record<string, number> = {};
  certificationStats?.forEach(c => {
    certsByUser[c.user_id] = (certsByUser[c.user_id] || 0) + 1;
  });

  // Enrich each user with calculated data
  return users.map(user => {
    const userProgress = progressByUser[user.id] || { completed: 0, total: 0, scores: [] };
    const userAssignments = assignmentsByUser[user.id] || 0;
    const userCerts = certsByUser[user.id] || 0;

    const trainingProgress = userProgress.total > 0 
      ? Math.round((userProgress.completed / userProgress.total) * 100) 
      : 0;

    const complianceScore = userProgress.scores.length > 0
      ? Math.round(userProgress.scores.reduce((sum, score) => sum + score, 0) / userProgress.scores.length)
      : 0;

    return {
      ...user,
      training_progress: trainingProgress,
      completed_tracks: userProgress.completed,
      total_tracks: userProgress.total,
      certifications_count: userCerts,
      compliance_score: complianceScore
    };
  });
}

/**
 * Deactivate user (soft delete)
 */
export async function deactivateUser(userId: string) {
  return updateUser(userId, { status: 'inactive' });
}

/**
 * Reactivate user
 */
export async function reactivateUser(userId: string) {
  return updateUser(userId, { status: 'active' });
}

/**
 * Update user's last active timestamp
 */
export async function updateUserLastActive(userId: string) {
  const { error } = await supabase
    .from('users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) console.error('Error updating last active:', error);
}

/**
 * Link auth user to internal user record (on first login)
 */
export async function linkAuthUserToInternalUser(
  authUserId: string,
  email: string
) {
  // Find user by email
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (!user) {
    throw new Error('User not found in organization');
  }

  // Link auth_user_id
  const { error } = await supabase
    .from('users')
    .update({ auth_user_id: authUserId })
    .eq('id', user.id);

  if (error) throw error;

  return user;
}

// ============================================================================
// BULK IMPORT / SYNC ENGINE
// ============================================================================

export type MatchStrategy = 'auto' | 'external_id' | 'email' | 'mobile_phone';
export type MatchLevel =
  | 'external_id'
  | 'email'
  | 'mobile_phone'
  | 'name_hire_date'
  | 'name_store'
  | 'none';

export interface UserSyncInput {
  // Match keys
  external_id?: string;
  email?: string;
  mobile_phone?: string; // E.164
  // Required identity
  first_name: string;
  last_name: string;
  // Mutable fields
  role_id?: string;
  store_id?: string;
  employee_id?: string;
  hire_date?: string;
  phone?: string;
  // Source row index from the original CSV (for error reporting)
  source_row?: number;
}

export interface UserSyncOptions {
  organization_id: string;
  match_strategy?: MatchStrategy;
  external_id_source?: string;
  missing_action?: 'leave' | 'deactivate';
  reactivate_on_match?: boolean;
  dry_run?: boolean;
  apply_filter?: Record<number, { create?: boolean; update?: boolean }>;
  filename?: string;
  imported_by_user_id?: string;
  source?: 'csv' | 'paylocity_api' | 'adp_api' | 'manual';
  onProgress?: (current: number, total: number) => void;
}

export interface FieldChange {
  field:
    | 'first_name'
    | 'last_name'
    | 'email'
    | 'mobile_phone'
    | 'phone'
    | 'role_id'
    | 'store_id'
    | 'employee_id'
    | 'hire_date'
    | 'external_id'
    | 'external_id_source';
  old: string | null;
  new: string | null;
}

export type SyncRowClassification =
  | { kind: 'new'; input: UserSyncInput }
  | {
      kind: 'unchanged';
      input: UserSyncInput;
      existing_user_id: string;
      matched_by: MatchLevel;
    }
  | {
      kind: 'update';
      input: UserSyncInput;
      existing_user_id: string;
      matched_by: MatchLevel;
      field_changes: FieldChange[];
    }
  | {
      kind: 'reactivate';
      input: UserSyncInput;
      existing_user_id: string;
      matched_by: MatchLevel;
      field_changes: FieldChange[];
    }
  | {
      kind: 'ambiguous';
      input: UserSyncInput;
      candidates: Array<{ user_id: string; matched_by: MatchLevel }>;
    }
  | { kind: 'duplicate_in_file'; input: UserSyncInput; conflicts_with_source_row: number };

export interface SyncClassificationResult {
  classifications: SyncRowClassification[];
  missing_users: Array<{
    user_id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    external_id: string | null;
    last_active_at: string | null;
  }>;
  stats: {
    total: number;
    new: number;
    unchanged: number;
    update: number;
    reactivate: number;
    ambiguous: number;
    duplicate_in_file: number;
    missing: number;
  };
}

export interface SyncCommitResult {
  created: number;
  updated: number;
  unchanged: number;
  reactivated: number;
  deactivated: number;
  skipped: number;
  failed: number;
  errors: Array<{ source_row: number; name: string; error: string }>;
  audit_log_id?: string;
}

// ----------------------------------------------------------------------------
// Validation helpers
// ----------------------------------------------------------------------------

interface ValidationResult {
  ok: boolean;
  error?: string;
}

function validateSyncInput(row: UserSyncInput): ValidationResult {
  if (!row.first_name || row.first_name.trim().length === 0) {
    return { ok: false, error: 'Missing first name' };
  }
  if (!row.last_name || row.last_name.trim().length === 0) {
    return { ok: false, error: 'Missing last name' };
  }
  if (row.email && !row.email.includes('@')) {
    return { ok: false, error: `Invalid email: ${row.email}` };
  }
  if (row.hire_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.hire_date)) {
    return { ok: false, error: `Invalid date format: ${row.hire_date}` };
  }
  if (row.mobile_phone && !/^\+\d{10,15}$/.test(row.mobile_phone)) {
    return {
      ok: false,
      error: `Invalid mobile phone format (expected E.164): ${row.mobile_phone}`,
    };
  }
  return { ok: true };
}

interface DbUserSnapshot {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_phone: string | null;
  phone: string | null;
  external_id: string | null;
  external_id_source: string | null;
  hire_date: string | null;
  store_id: string | null;
  role_id: string | null;
  employee_id: string | null;
  status: string | null;
  last_active_at: string | null;
}

function buildFieldChanges(
  existing: DbUserSnapshot,
  input: UserSyncInput,
  external_id_source?: string
): FieldChange[] {
  const changes: FieldChange[] = [];
  const compare = (
    field: FieldChange['field'],
    oldVal: string | null | undefined,
    newVal: string | null | undefined
  ) => {
    if (newVal === undefined) return; // input did not provide this field
    const oldNorm = oldVal ?? null;
    const newNorm = newVal ?? null;
    if (oldNorm === newNorm) return;
    changes.push({ field, old: oldNorm, new: newNorm });
  };

  compare('first_name', existing.first_name, input.first_name?.trim());
  compare('last_name', existing.last_name, input.last_name?.trim());
  if (input.email !== undefined) {
    compare('email', existing.email?.toLowerCase() ?? null, input.email.trim().toLowerCase());
  }
  compare('mobile_phone', existing.mobile_phone, input.mobile_phone);
  compare('phone', existing.phone, input.phone);
  compare('role_id', existing.role_id, input.role_id);
  compare('store_id', existing.store_id, input.store_id);
  compare('employee_id', existing.employee_id, input.employee_id);
  compare('hire_date', existing.hire_date, input.hire_date);
  if (input.external_id !== undefined) {
    compare('external_id', existing.external_id, input.external_id);
    if (external_id_source && existing.external_id_source !== external_id_source) {
      changes.push({
        field: 'external_id_source',
        old: existing.external_id_source,
        new: external_id_source,
      });
    }
  }
  return changes;
}

function applyChangesToUpdatePayload(changes: FieldChange[]): Record<string, any> {
  const payload: Record<string, any> = {};
  for (const c of changes) {
    payload[c.field] = c.new;
  }
  return payload;
}

// ----------------------------------------------------------------------------
// Step 3: classifyUserSync — pure-ish (reads DB, no writes)
// ----------------------------------------------------------------------------

export async function classifyUserSync(
  rows: UserSyncInput[],
  options: UserSyncOptions
): Promise<SyncClassificationResult> {
  const { organization_id, match_strategy = 'auto' } = options;

  // 1. Pre-fetch DB snapshot
  const { data: dbUsersRaw, error: fetchErr } = await supabase
    .from('users')
    .select(
      'id, first_name, last_name, email, mobile_phone, phone, external_id, external_id_source, hire_date, store_id, role_id, employee_id, status, last_active_at'
    )
    .eq('organization_id', organization_id);

  if (fetchErr) throw fetchErr;
  const dbUsers: DbUserSnapshot[] = (dbUsersRaw as any[]) || [];

  // 2. Effective strategy (informational only — ladder always tried)
  let effectiveStrategy: MatchStrategy = match_strategy;
  if (match_strategy === 'auto') {
    if (rows.some((r) => r.external_id)) effectiveStrategy = 'external_id';
    else if (rows.some((r) => r.email)) effectiveStrategy = 'email';
    else effectiveStrategy = 'mobile_phone';
  }
  void effectiveStrategy; // referenced for clarity / future use

  // 3. Build lookup indexes
  const byExternalId = new Map<string, DbUserSnapshot>();
  const byEmail = new Map<string, DbUserSnapshot>();
  const byMobile = new Map<string, DbUserSnapshot>();
  const byNameHireDate = new Map<string, DbUserSnapshot>();
  const byNameStore = new Map<string, DbUserSnapshot>();

  for (const u of dbUsers) {
    if (u.external_id) byExternalId.set(u.external_id, u);
    if (u.email) byEmail.set(u.email.toLowerCase(), u);
    if (u.mobile_phone) byMobile.set(u.mobile_phone, u);
    const fn = (u.first_name || '').toLowerCase().trim();
    const ln = (u.last_name || '').toLowerCase().trim();
    if (fn && ln && u.hire_date) byNameHireDate.set(`${fn}|${ln}|${u.hire_date}`, u);
    if (fn && ln && u.store_id) byNameStore.set(`${fn}|${ln}|${u.store_id}`, u);
  }

  // 4-7. Walk rows, ladder, dupes, ambiguous, field changes
  const classifications: SyncRowClassification[] = [];
  const matchedDbIds = new Set<string>();
  const seenInFile = {
    externalId: new Map<string, number>(), // value → first source_row
    email: new Map<string, number>(),
    mobile: new Map<string, number>(),
    dbUserId: new Map<string, number>(),
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sourceRow = row.source_row ?? i + 1;

    // Intra-file dupes by primary keys
    if (row.external_id && seenInFile.externalId.has(row.external_id)) {
      classifications.push({
        kind: 'duplicate_in_file',
        input: row,
        conflicts_with_source_row: seenInFile.externalId.get(row.external_id)!,
      });
      continue;
    }
    if (row.email) {
      const e = row.email.trim().toLowerCase();
      if (seenInFile.email.has(e)) {
        classifications.push({
          kind: 'duplicate_in_file',
          input: row,
          conflicts_with_source_row: seenInFile.email.get(e)!,
        });
        continue;
      }
    }
    if (row.mobile_phone && seenInFile.mobile.has(row.mobile_phone)) {
      classifications.push({
        kind: 'duplicate_in_file',
        input: row,
        conflicts_with_source_row: seenInFile.mobile.get(row.mobile_phone)!,
      });
      continue;
    }

    // Ladder — collect all candidate matches with their level
    const candidates: Array<{ user: DbUserSnapshot; level: MatchLevel }> = [];

    if (row.external_id) {
      const m = byExternalId.get(row.external_id);
      if (m) candidates.push({ user: m, level: 'external_id' });
    }
    if (row.email) {
      const m = byEmail.get(row.email.trim().toLowerCase());
      if (m && !candidates.find((c) => c.user.id === m.id)) {
        candidates.push({ user: m, level: 'email' });
      }
    }
    if (row.mobile_phone) {
      const m = byMobile.get(row.mobile_phone);
      if (m && !candidates.find((c) => c.user.id === m.id)) {
        candidates.push({ user: m, level: 'mobile_phone' });
      }
    }
    if (candidates.length === 0 && row.first_name && row.last_name && row.hire_date) {
      const key = `${row.first_name.toLowerCase().trim()}|${row.last_name.toLowerCase().trim()}|${row.hire_date}`;
      const m = byNameHireDate.get(key);
      if (m) candidates.push({ user: m, level: 'name_hire_date' });
    }
    if (candidates.length === 0 && row.first_name && row.last_name && row.store_id) {
      const key = `${row.first_name.toLowerCase().trim()}|${row.last_name.toLowerCase().trim()}|${row.store_id}`;
      const m = byNameStore.get(key);
      if (m) candidates.push({ user: m, level: 'name_store' });
    }

    // Ambiguous: multiple distinct DB users matched at different levels
    const distinctIds = Array.from(new Set(candidates.map((c) => c.user.id)));
    if (distinctIds.length > 1) {
      classifications.push({
        kind: 'ambiguous',
        input: row,
        candidates: candidates.map((c) => ({ user_id: c.user.id, matched_by: c.level })),
      });
      continue;
    }

    // Track intra-file primary keys (after we've decided this row is real)
    if (row.external_id) seenInFile.externalId.set(row.external_id, sourceRow);
    if (row.email) seenInFile.email.set(row.email.trim().toLowerCase(), sourceRow);
    if (row.mobile_phone) seenInFile.mobile.set(row.mobile_phone, sourceRow);

    if (candidates.length === 0) {
      classifications.push({ kind: 'new', input: row });
      continue;
    }

    const matched = candidates[0];

    // Intra-file: same DB user matched twice
    if (seenInFile.dbUserId.has(matched.user.id)) {
      classifications.push({
        kind: 'duplicate_in_file',
        input: row,
        conflicts_with_source_row: seenInFile.dbUserId.get(matched.user.id)!,
      });
      continue;
    }
    seenInFile.dbUserId.set(matched.user.id, sourceRow);
    matchedDbIds.add(matched.user.id);

    const fieldChanges = buildFieldChanges(matched.user, row, options.external_id_source);
    const isInactive = matched.user.status && matched.user.status !== 'active';

    if (isInactive && options.reactivate_on_match !== false) {
      classifications.push({
        kind: 'reactivate',
        input: row,
        existing_user_id: matched.user.id,
        matched_by: matched.level,
        field_changes: fieldChanges,
      });
    } else if (fieldChanges.length === 0) {
      classifications.push({
        kind: 'unchanged',
        input: row,
        existing_user_id: matched.user.id,
        matched_by: matched.level,
      });
    } else {
      classifications.push({
        kind: 'update',
        input: row,
        existing_user_id: matched.user.id,
        matched_by: matched.level,
        field_changes: fieldChanges,
      });
    }
  }

  // 8. Missing users (active in DB, not matched)
  const missing_users = dbUsers
    .filter((u) => u.status === 'active' && !matchedDbIds.has(u.id))
    .map((u) => ({
      user_id: u.id,
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      email: u.email,
      external_id: u.external_id,
      last_active_at: u.last_active_at,
    }));

  // 9. Stats
  const stats = {
    total: rows.length,
    new: classifications.filter((c) => c.kind === 'new').length,
    unchanged: classifications.filter((c) => c.kind === 'unchanged').length,
    update: classifications.filter((c) => c.kind === 'update').length,
    reactivate: classifications.filter((c) => c.kind === 'reactivate').length,
    ambiguous: classifications.filter((c) => c.kind === 'ambiguous').length,
    duplicate_in_file: classifications.filter((c) => c.kind === 'duplicate_in_file').length,
    missing: missing_users.length,
  };

  return { classifications, missing_users, stats };
}

// ----------------------------------------------------------------------------
// Step 4: commitUserSync — performs writes
// ----------------------------------------------------------------------------

export async function commitUserSync(
  classification: SyncClassificationResult,
  options: UserSyncOptions
): Promise<SyncCommitResult> {
  const result: SyncCommitResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
    reactivated: 0,
    deactivated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const { organization_id, dry_run = false, apply_filter, missing_action = 'leave' } = options;

  // Bucket classifications
  type InsertPlan = { sourceRow: number; name: string; record: Record<string, any> };
  type UpdatePlan = {
    sourceRow: number;
    name: string;
    existingId: string;
    updates: Record<string, any>;
    reactivate: boolean;
  };

  const inserts: InsertPlan[] = [];
  const updates: UpdatePlan[] = [];

  for (const c of classification.classifications) {
    const sourceRow = c.input.source_row ?? 0;
    const name = `${c.input.first_name} ${c.input.last_name}`;

    // Per-row validation
    const v = validateSyncInput(c.input);
    if (!v.ok) {
      result.failed++;
      result.errors.push({ source_row: sourceRow, name, error: v.error || 'Validation failed' });
      continue;
    }

    if (c.kind === 'unchanged') {
      result.unchanged++;
      continue;
    }
    if (c.kind === 'duplicate_in_file' || c.kind === 'ambiguous') {
      result.skipped++;
      const reason =
        c.kind === 'duplicate_in_file'
          ? `Duplicate of source row ${c.conflicts_with_source_row}`
          : `Ambiguous match (${c.candidates.length} candidates)`;
      result.errors.push({ source_row: sourceRow, name, error: reason });
      continue;
    }

    // Apply filter gate
    const filter = apply_filter?.[sourceRow];
    if (filter) {
      if (c.kind === 'new' && filter.create === false) {
        result.skipped++;
        continue;
      }
      if ((c.kind === 'update' || c.kind === 'reactivate') && filter.update === false) {
        result.skipped++;
        continue;
      }
    }

    if (c.kind === 'new') {
      const record: Record<string, any> = {
        organization_id,
        first_name: c.input.first_name.trim(),
        last_name: c.input.last_name.trim(),
        status: 'active',
      };
      if (c.input.email) record.email = c.input.email.trim().toLowerCase();
      if (c.input.role_id) record.role_id = c.input.role_id;
      if (c.input.store_id) record.store_id = c.input.store_id;
      if (c.input.employee_id) record.employee_id = c.input.employee_id;
      if (c.input.hire_date) record.hire_date = c.input.hire_date;
      if (c.input.phone) record.phone = c.input.phone;
      if (c.input.mobile_phone) record.mobile_phone = c.input.mobile_phone;
      if (c.input.external_id) {
        record.external_id = c.input.external_id;
        if (options.external_id_source) record.external_id_source = options.external_id_source;
      }
      inserts.push({ sourceRow, name, record });
    } else if (c.kind === 'update' || c.kind === 'reactivate') {
      const updatePayload = applyChangesToUpdatePayload(c.field_changes);
      if (c.kind === 'reactivate') {
        updatePayload.status = 'active';
        updatePayload.deactivated_at = null;
      }
      updates.push({
        sourceRow,
        name,
        existingId: c.existing_user_id,
        updates: updatePayload,
        reactivate: c.kind === 'reactivate',
      });
    }
  }

  // Determine missing → deactivate plan
  const deactivateIds: string[] =
    missing_action === 'deactivate' ? classification.missing_users.map((u) => u.user_id) : [];

  // Progress tracking
  const totalOps = inserts.length + updates.length + deactivateIds.length;
  let opsDone = 0;
  const reportProgress = () => options.onProgress?.(opsDone, totalOps || 1);

  if (dry_run) {
    // Skip writes — but still classify counts
    result.created = inserts.length;
    result.updated = updates.filter((u) => !u.reactivate).length;
    result.reactivated = updates.filter((u) => u.reactivate).length;
    result.deactivated = deactivateIds.length;
    return result;
  }

  // ---- Inserts: batches of 25 ----
  const BATCH_SIZE = 25;
  for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
    const batch = inserts.slice(i, i + BATCH_SIZE);
    try {
      const { error } = await supabase.from('users').insert(batch.map((b) => b.record));
      if (error) throw error;
      result.created += batch.length;
    } catch {
      // Per-row fallback
      for (const plan of batch) {
        try {
          const { error: rowErr } = await supabase.from('users').insert(plan.record);
          if (rowErr) throw rowErr;
          result.created++;
        } catch (rowErr: any) {
          result.failed++;
          result.errors.push({
            source_row: plan.sourceRow,
            name: plan.name,
            error: rowErr?.message || 'Insert failed',
          });
        }
      }
    }
    opsDone += batch.length;
    reportProgress();
  }

  // ---- Updates: parallel chunks of 10 ----
  const UPDATE_CHUNK = 10;
  for (let i = 0; i < updates.length; i += UPDATE_CHUNK) {
    const chunk = updates.slice(i, i + UPDATE_CHUNK);
    const settled = await Promise.allSettled(
      chunk.map((plan) =>
        supabase
          .from('users')
          .update(plan.updates)
          .eq('id', plan.existingId)
          .then(({ error }) => {
            if (error) throw error;
            return plan;
          })
      )
    );
    settled.forEach((res, idx) => {
      const plan = chunk[idx];
      if (res.status === 'fulfilled') {
        if (plan.reactivate) result.reactivated++;
        else result.updated++;
      } else {
        result.failed++;
        result.errors.push({
          source_row: plan.sourceRow,
          name: plan.name,
          error: (res.reason as any)?.message || 'Update failed',
        });
      }
    });
    opsDone += chunk.length;
    reportProgress();
  }

  // ---- Deactivate missing ----
  if (deactivateIds.length > 0) {
    for (let i = 0; i < deactivateIds.length; i += UPDATE_CHUNK) {
      const chunk = deactivateIds.slice(i, i + UPDATE_CHUNK);
      const settled = await Promise.allSettled(
        chunk.map((id) =>
          supabase
            .from('users')
            .update({ status: 'inactive', deactivated_at: new Date().toISOString() })
            .eq('id', id)
            .then(({ error }) => {
              if (error) throw error;
            })
        )
      );
      settled.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          result.deactivated++;
        } else {
          result.failed++;
          result.errors.push({
            source_row: 0,
            name: `(missing user ${chunk[idx]})`,
            error: (res.reason as any)?.message || 'Deactivate failed',
          });
        }
      });
      opsDone += chunk.length;
      reportProgress();
    }
  }

  // ---- Audit log ----
  try {
    const diffSummary = {
      stats: classification.stats,
      classifications: classification.classifications.map((c) => {
        const sourceRow = c.input.source_row ?? 0;
        const base = { source_row: sourceRow, kind: c.kind };
        if (c.kind === 'update' || c.kind === 'reactivate') {
          return {
            ...base,
            existing_user_id: c.existing_user_id,
            matched_by: c.matched_by,
            field_changes: c.field_changes,
          };
        }
        if (c.kind === 'unchanged') {
          return { ...base, existing_user_id: c.existing_user_id, matched_by: c.matched_by };
        }
        if (c.kind === 'ambiguous') {
          return { ...base, candidates: c.candidates };
        }
        if (c.kind === 'duplicate_in_file') {
          return { ...base, conflicts_with_source_row: c.conflicts_with_source_row };
        }
        return base;
      }),
      missing_users: classification.missing_users,
      errors: result.errors,
    };

    const audit = await recordImport({
      organization_id,
      imported_by: options.imported_by_user_id ?? null,
      filename: options.filename,
      source: options.source,
      match_strategy: options.match_strategy,
      total_rows: classification.stats.total,
      created_count: result.created,
      updated_count: result.updated,
      unchanged_count: result.unchanged,
      reactivated_count: result.reactivated,
      deactivated_count: result.deactivated,
      ignored_count: classification.stats.ambiguous + classification.stats.duplicate_in_file,
      skipped_count: result.skipped,
      failed_count: result.failed,
      diff_summary: diffSummary,
    });
    if (audit) result.audit_log_id = audit.id;
  } catch (err) {
    console.error('[bulkUpsertUsers] audit log write failed:', err);
  }

  return result;
}

// ----------------------------------------------------------------------------
// Step 5: bulkUpsertUsers — convenience wrapper
// ----------------------------------------------------------------------------

export async function bulkUpsertUsers(
  rows: UserSyncInput[],
  options: UserSyncOptions
): Promise<{ classification: SyncClassificationResult; result: SyncCommitResult }> {
  const classification = await classifyUserSync(rows, options);
  const result = await commitUserSync(classification, options);
  return { classification, result };
}

// ----------------------------------------------------------------------------
// Legacy shim: bulkCreateUsers
// ----------------------------------------------------------------------------

export interface BulkCreateUsersInput {
  rows: Array<{
    email?: string;
    first_name: string;
    last_name: string;
    role_id?: string;
    store_id?: string;
    employee_id?: string;
    hire_date?: string;
    phone?: string;
    mobile_phone?: string;
  }>;
  organization_id: string;
  defaultRoleId?: string;
  defaultStoreId?: string;
  duplicateStrategy: 'skip' | 'update';
  onProgress?: (current: number, total: number) => void;
}

export interface BulkCreateUsersResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; name: string; error: string }>;
}

/**
 * Legacy shim — translates the old BulkCreateUsersInput shape to the new
 * sync engine and returns the legacy result shape. New code should use
 * bulkUpsertUsers directly.
 */
export async function bulkCreateUsers(input: BulkCreateUsersInput): Promise<BulkCreateUsersResult> {
  const legacyResult: BulkCreateUsersResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  if (input.rows.length === 0) return legacyResult;

  const syncRows: UserSyncInput[] = input.rows.map((r, i) => ({
    email: r.email,
    first_name: r.first_name,
    last_name: r.last_name,
    role_id: r.role_id || input.defaultRoleId,
    store_id: r.store_id || input.defaultStoreId,
    employee_id: r.employee_id,
    hire_date: r.hire_date,
    phone: r.phone,
    mobile_phone: r.mobile_phone,
    source_row: i + 1,
  }));

  const { result } = await bulkUpsertUsers(syncRows, {
    organization_id: input.organization_id,
    match_strategy: 'email',
    missing_action: 'leave',
    reactivate_on_match: input.duplicateStrategy === 'update',
    onProgress: input.onProgress,
    source: 'csv',
  });

  legacyResult.created = result.created;
  legacyResult.updated = result.updated + result.reactivated;
  // In skip mode, treat the new sync's "unchanged" + classified-but-skipped as legacy "skipped"
  if (input.duplicateStrategy === 'skip') {
    legacyResult.skipped = result.unchanged + result.updated + result.reactivated + result.skipped;
    legacyResult.updated = 0;
  } else {
    legacyResult.skipped = result.unchanged + result.skipped;
  }
  legacyResult.failed = result.failed;
  legacyResult.errors = result.errors.map((e) => ({
    row: e.source_row,
    name: e.name,
    error: e.error,
  }));

  return legacyResult;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Invite user via email (generates magic link)
 * This should be called from a server-side function with admin privileges
 */
async function inviteUserViaEmail(email: string): Promise<string> {
  // This would typically use supabase.auth.admin.inviteUserByEmail()
  // but that requires server-side admin key
  // For now, return placeholder URL
  return `/auth/invite?email=${encodeURIComponent(email)}`;
}