// ============================================================================
// PLAYBOOKS CRUD OPERATIONS
// Source-to-Album Automated Workflow
// ============================================================================

import { supabase, getCurrentUserOrgId, getCurrentUserProfile } from '../supabase';
import { getServerUrl } from '../../utils/supabase/info';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type PlaybookStatus =
  | 'suggestion'
  | 'confirmed'
  | 'generating'
  | 'review'
  | 'publishing'
  | 'completed'
  | 'cancelled';

export type PlaybookTrackStatus =
  | 'suggestion'
  | 'confirmed'
  | 'generating'
  | 'draft_ready'
  | 'approved'
  | 'published'
  | 'skipped';

export type ConflictResolution =
  | 'keep_new'
  | 'keep_existing'
  | 'create_version'
  | 'create_variant';

export type ConflictMatchType =
  | 'direct_overlap'
  | 'version_candidate'
  | 'variant_candidate';

export interface PlaybookConflict {
  existing_track_id: string;
  existing_track_title: string;
  similarity_score: number;
  match_type: ConflictMatchType;
  overlap_summary: string;
}

export interface Playbook {
  id: string;
  organization_id: string;
  source_file_id: string;
  title: string;
  description?: string;
  created_by?: string;
  status: PlaybookStatus;
  rag_analysis: Record<string, any>;
  album_id?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  // Computed/joined fields
  source_file?: {
    id: string;
    file_name: string;
    chunk_count: number;
  };
  tracks?: PlaybookTrack[];
  track_count?: number;
}

export interface PlaybookTrack {
  id: string;
  playbook_id: string;
  organization_id: string;
  title: string;
  description?: string;
  display_order: number;
  status: PlaybookTrackStatus;
  rag_reasoning?: string;
  rag_confidence?: number;
  has_conflicts: boolean;
  conflicts: PlaybookConflict[];
  conflict_resolution?: ConflictResolution;
  generated_content?: string;
  generated_at?: string;
  generation_error?: string;
  published_track_id?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
  // Computed/joined fields
  chunks?: PlaybookTrackChunk[];
  chunk_count?: number;
}

export interface PlaybookTrackChunk {
  id: string;
  playbook_track_id: string;
  source_chunk_id: string;
  sequence_order: number;
  created_at: string;
  // Joined chunk data
  chunk?: {
    id: string;
    chunk_index: number;
    content: string;
    title?: string;
    summary?: string;
    word_count: number;
    chunk_type: string;
    content_class: string;
    key_terms: string[];
  };
}

export interface SourceChunk {
  id: string;
  chunk_index: number;
  content: string;
  title?: string;
  summary?: string;
  word_count: number;
  chunk_type: string;
  content_class: string;
  key_terms: string[];
  hierarchy_level: number;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreatePlaybookInput {
  source_file_id: string;
  organization_id: string;
  title: string;
  description?: string;
  created_by?: string;
}

export interface UpdatePlaybookInput {
  id: string;
  title?: string;
  description?: string;
  status?: PlaybookStatus;
  album_id?: string;
  completed_at?: string;
}

export interface CreatePlaybookTrackInput {
  playbook_id: string;
  organization_id: string;
  title: string;
  description?: string;
  display_order: number;
  rag_reasoning?: string;
  rag_confidence?: number;
  has_conflicts?: boolean;
  conflicts?: PlaybookConflict[];
}

export interface UpdatePlaybookTrackInput {
  id: string;
  title?: string;
  description?: string;
  display_order?: number;
  status?: PlaybookTrackStatus;
  conflict_resolution?: ConflictResolution;
  generated_content?: string;
  generated_at?: string;
  generation_error?: string;
  published_track_id?: string;
  published_at?: string;
}

export interface UpdateGroupingsInput {
  playbook_id: string;
  tracks: {
    id: string;
    title: string;
    chunk_ids: string[];
    display_order: number;
  }[];
  new_tracks?: {
    title: string;
    chunk_ids: string[];
    display_order: number;
  }[];
  removed_track_ids?: string[];
}

// ============================================================================
// PLAYBOOK CRUD OPERATIONS
// ============================================================================

/**
 * Get all playbooks for organization with filtering options
 */
export async function getPlaybooks(options: {
  status?: PlaybookStatus;
  source_file_id?: string;
  organizationId?: string;
} = {}): Promise<Playbook[]> {
  const orgId = options.organizationId || await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  let query = supabase
    .from('playbooks')
    .select(`
      *,
      source_file:source_files (
        id,
        file_name,
        chunk_count
      ),
      playbook_tracks (
        id,
        title,
        status,
        display_order,
        has_conflicts
      )
    `)
    .eq('organization_id', orgId);

  if (options.status) {
    query = query.eq('status', options.status);
  }

  if (options.source_file_id) {
    query = query.eq('source_file_id', options.source_file_id);
  }

  const { data: playbooks, error } = await query.order('updated_at', { ascending: false });

  if (error) throw error;

  // Enrich with computed fields
  return (playbooks || []).map((playbook: any) => ({
    ...playbook,
    tracks: playbook.playbook_tracks || [],
    track_count: (playbook.playbook_tracks || []).length,
  }));
}

/**
 * Get a single playbook by ID with full details (tracks and chunks)
 */
export async function getPlaybookById(playbookId: string): Promise<Playbook | null> {
  const { data: playbook, error } = await supabase
    .from('playbooks')
    .select(`
      *,
      source_file:source_files (
        id,
        file_name,
        chunk_count
      ),
      playbook_tracks (
        *,
        playbook_track_chunks (
          id,
          source_chunk_id,
          sequence_order,
          chunk:source_chunks (
            id,
            chunk_index,
            content,
            title,
            summary,
            word_count,
            chunk_type,
            content_class,
            key_terms
          )
        )
      )
    `)
    .eq('id', playbookId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  if (!playbook) return null;

  // Transform and sort tracks and chunks
  const tracks = (playbook.playbook_tracks || [])
    .sort((a: any, b: any) => a.display_order - b.display_order)
    .map((track: any) => ({
      ...track,
      chunks: (track.playbook_track_chunks || [])
        .sort((a: any, b: any) => a.sequence_order - b.sequence_order)
        .map((ptc: any) => ({
          ...ptc,
          chunk: ptc.chunk,
        })),
      chunk_count: (track.playbook_track_chunks || []).length,
    }));

  return {
    ...playbook,
    tracks,
    track_count: tracks.length,
  } as Playbook;
}

/**
 * Create a new playbook
 */
export async function createPlaybook(input: CreatePlaybookInput): Promise<Playbook> {
  const { data: playbook, error } = await supabase
    .from('playbooks')
    .insert({
      source_file_id: input.source_file_id,
      organization_id: input.organization_id,
      title: input.title,
      description: input.description,
      created_by: input.created_by,
      status: 'suggestion',
    })
    .select()
    .single();

  if (error) throw error;
  return playbook;
}

/**
 * Update a playbook
 */
export async function updatePlaybook(input: UpdatePlaybookInput): Promise<Playbook> {
  const { id, ...updates } = input;

  const { data: playbook, error } = await supabase
    .from('playbooks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return playbook;
}

/**
 * Delete a playbook
 */
export async function deletePlaybook(playbookId: string): Promise<void> {
  const { error } = await supabase
    .from('playbooks')
    .delete()
    .eq('id', playbookId);

  if (error) throw error;
}

// ============================================================================
// PLAYBOOK TRACK CRUD OPERATIONS
// ============================================================================

/**
 * Create a new playbook track
 */
export async function createPlaybookTrack(input: CreatePlaybookTrackInput): Promise<PlaybookTrack> {
  const { data: track, error } = await supabase
    .from('playbook_tracks')
    .insert({
      playbook_id: input.playbook_id,
      organization_id: input.organization_id,
      title: input.title,
      description: input.description,
      display_order: input.display_order,
      rag_reasoning: input.rag_reasoning,
      rag_confidence: input.rag_confidence,
      has_conflicts: input.has_conflicts || false,
      conflicts: input.conflicts || [],
      status: 'suggestion',
    })
    .select()
    .single();

  if (error) throw error;
  return track;
}

/**
 * Update a playbook track
 */
export async function updatePlaybookTrack(input: UpdatePlaybookTrackInput): Promise<PlaybookTrack> {
  const { id, ...updates } = input;

  const { data: track, error } = await supabase
    .from('playbook_tracks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return track;
}

/**
 * Delete a playbook track
 */
export async function deletePlaybookTrack(trackId: string): Promise<void> {
  const { error } = await supabase
    .from('playbook_tracks')
    .delete()
    .eq('id', trackId);

  if (error) throw error;
}

// ============================================================================
// CHUNK ASSIGNMENT OPERATIONS
// ============================================================================

/**
 * Assign chunks to a playbook track
 */
export async function assignChunksToTrack(
  trackId: string,
  chunkIds: string[]
): Promise<void> {
  // First, clear existing assignments
  const { error: deleteError } = await supabase
    .from('playbook_track_chunks')
    .delete()
    .eq('playbook_track_id', trackId);

  if (deleteError) throw deleteError;

  // Then insert new assignments with sequence order
  if (chunkIds.length > 0) {
    const assignments = chunkIds.map((chunkId, index) => ({
      playbook_track_id: trackId,
      source_chunk_id: chunkId,
      sequence_order: index,
    }));

    const { error: insertError } = await supabase
      .from('playbook_track_chunks')
      .insert(assignments);

    if (insertError) throw insertError;
  }
}

/**
 * Move a chunk from one track to another
 */
export async function moveChunkToTrack(
  chunkId: string,
  fromTrackId: string,
  toTrackId: string
): Promise<void> {
  // Delete from source track
  const { error: deleteError } = await supabase
    .from('playbook_track_chunks')
    .delete()
    .eq('playbook_track_id', fromTrackId)
    .eq('source_chunk_id', chunkId);

  if (deleteError) throw deleteError;

  // Get current max sequence order in target track
  const { data: existingChunks, error: selectError } = await supabase
    .from('playbook_track_chunks')
    .select('sequence_order')
    .eq('playbook_track_id', toTrackId)
    .order('sequence_order', { ascending: false })
    .limit(1);

  if (selectError) throw selectError;

  const maxOrder = existingChunks?.[0]?.sequence_order ?? -1;

  // Insert into target track
  const { error: insertError } = await supabase
    .from('playbook_track_chunks')
    .insert({
      playbook_track_id: toTrackId,
      source_chunk_id: chunkId,
      sequence_order: maxOrder + 1,
    });

  if (insertError) throw insertError;
}

/**
 * Reorder chunks within a track
 */
export async function reorderChunksInTrack(
  trackId: string,
  orderedChunkIds: string[]
): Promise<void> {
  // Update each chunk's sequence order
  const updates = orderedChunkIds.map((chunkId, index) =>
    supabase
      .from('playbook_track_chunks')
      .update({ sequence_order: index })
      .eq('playbook_track_id', trackId)
      .eq('source_chunk_id', chunkId)
  );

  await Promise.all(updates);
}

/**
 * Get unassigned chunks for a playbook
 */
export async function getUnassignedChunks(
  playbookId: string,
  sourceFileId: string
): Promise<SourceChunk[]> {
  // Get all chunk IDs already assigned to tracks in this playbook
  const { data: assignedChunks, error: assignedError } = await supabase
    .from('playbook_track_chunks')
    .select('source_chunk_id, playbook_tracks!inner(playbook_id)')
    .eq('playbook_tracks.playbook_id', playbookId);

  if (assignedError) throw assignedError;

  const assignedChunkIds = new Set(
    (assignedChunks || []).map((ac: any) => ac.source_chunk_id)
  );

  // Get all chunks from source file
  const { data: allChunks, error: chunksError } = await supabase
    .from('source_chunks')
    .select('*')
    .eq('source_file_id', sourceFileId)
    .order('chunk_index', { ascending: true });

  if (chunksError) throw chunksError;

  // Filter to unassigned chunks
  return (allChunks || []).filter(
    (chunk: any) => !assignedChunkIds.has(chunk.id)
  );
}

// ============================================================================
// API OPERATIONS (Edge Function Calls)
// ============================================================================

/**
 * Trigger RAG analysis and create playbook with suggested track groupings
 */
export async function analyzeSource(
  sourceFileId: string,
  organizationId: string,
  options: { checkDuplicates?: boolean } = {}
): Promise<{
  playbook_id: string;
  suggested_tracks: Array<{
    id: string;
    title: string;
    chunk_ids: string[];
    reasoning: string;
    confidence: number;
    conflicts: PlaybookConflict[];
  }>;
  unassigned_chunks: string[];
}> {
  const serverUrl = getServerUrl();

  const response = await fetch(`${serverUrl}/playbook/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source_file_id: sourceFileId,
      organization_id: organizationId,
      options: {
        check_duplicates: options.checkDuplicates ?? true,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to analyze source');
  }

  return response.json();
}

/**
 * Update track groupings (after drag-drop operations)
 */
export async function updateGroupings(input: UpdateGroupingsInput): Promise<Playbook> {
  const serverUrl = getServerUrl();

  const response = await fetch(`${serverUrl}/playbook/update-groupings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update groupings');
  }

  return response.json();
}

/**
 * Confirm a track grouping and trigger draft generation
 */
export async function confirmTrack(
  playbookTrackId: string,
  conflictResolution?: ConflictResolution
): Promise<PlaybookTrack> {
  const serverUrl = getServerUrl();

  const response = await fetch(`${serverUrl}/playbook/confirm-track`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      playbook_track_id: playbookTrackId,
      conflict_resolution: conflictResolution,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to confirm track');
  }

  return response.json();
}

/**
 * Generate draft content for a confirmed track
 */
export async function generateDraft(playbookTrackId: string): Promise<PlaybookTrack> {
  const serverUrl = getServerUrl();

  const response = await fetch(`${serverUrl}/playbook/generate-draft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      playbook_track_id: playbookTrackId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to generate draft');
  }

  return response.json();
}

/**
 * Approve a draft track
 */
export async function approveTrack(
  playbookTrackId: string,
  editedContent?: string
): Promise<PlaybookTrack> {
  const serverUrl = getServerUrl();

  const response = await fetch(`${serverUrl}/playbook/approve-track`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      playbook_track_id: playbookTrackId,
      edited_content: editedContent,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to approve track');
  }

  return response.json();
}

/**
 * Publish all approved tracks and create album
 */
export async function publishPlaybook(
  playbookId: string,
  albumTitle: string,
  albumDescription?: string
): Promise<{
  album: {
    id: string;
    title: string;
    track_count: number;
  };
  published_tracks: Array<{
    playbook_track_id: string;
    published_track_id: string;
  }>;
  skipped_tracks: string[];
  errors: string[];
}> {
  const serverUrl = getServerUrl();

  const response = await fetch(`${serverUrl}/playbook/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      playbook_id: playbookId,
      album_title: albumTitle,
      album_description: albumDescription,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to publish playbook');
  }

  return response.json();
}
