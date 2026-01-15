/**
 * PLAYBOOK BUILD VIEW
 *
 * Full-page view for the Source-to-Album automated workflow.
 * Features:
 * - RAG-suggested track groupings from source chunks
 * - Drag-drop chunk manipulation between tracks
 * - Conflict detection with existing published content
 * - Draft generation and preview
 * - Batch publish to Album
 */

import React, { useState, useEffect, useCallback, useReducer } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';
import { Skeleton } from '../ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  ArrowLeft,
  Loader2,
  Check,
  ChevronDown,
  ChevronRight,
  Zap,
  GripVertical,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Sparkles,
  Play,
  Eye,
  X,
  Package,
  Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import {
  Playbook,
  PlaybookTrack,
  PlaybookTrackChunk,
  PlaybookConflict,
  analyzeSource,
  getPlaybookById,
  updateGroupings,
  confirmTrack,
  generateDraft,
  approveTrack,
  publishPlaybook,
} from '../../lib/crud/playbooks';
import { getCurrentUserOrgId } from '../../lib/supabase';
import { PlaybookProcessingStatus } from './PlaybookProcessingStatus';

// ============================================================================
// TYPES
// ============================================================================

interface PlaybookBuildViewProps {
  sourceFileId: string;
  organizationId?: string; // Optional - will be fetched if not provided
  onBack: () => void;
  onComplete: (albumId: string) => void;
}

interface SourceChunk {
  id: string;
  chunk_index: number;
  content: string;
  title?: string;
  summary?: string;
  word_count: number;
  chunk_type: string;
  content_class: string;
  key_terms: string[];
}

// State reducer for managing playbook state
type PlaybookAction =
  | { type: 'SET_PLAYBOOK'; playbook: Playbook }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_SYNCING'; syncing: boolean }
  | { type: 'SELECT_TRACK'; trackId: string | null }
  | { type: 'UPDATE_TRACK'; trackId: string; updates: Partial<PlaybookTrack> }
  | { type: 'ADD_TRACK'; track: PlaybookTrack }
  | { type: 'REMOVE_TRACK'; trackId: string }
  | { type: 'MOVE_CHUNK'; chunkId: string; fromTrackId: string | null; toTrackId: string }
  | { type: 'OPEN_DRAFT_PREVIEW'; trackId: string }
  | { type: 'CLOSE_DRAFT_PREVIEW' };

interface PlaybookState {
  playbook: Playbook | null;
  loading: boolean;
  syncing: boolean;
  selectedTrackId: string | null;
  draftPreview: {
    isOpen: boolean;
    trackId: string | null;
  };
}

const initialState: PlaybookState = {
  playbook: null,
  loading: true,
  syncing: false,
  selectedTrackId: null,
  draftPreview: {
    isOpen: false,
    trackId: null,
  },
};

function playbookReducer(state: PlaybookState, action: PlaybookAction): PlaybookState {
  switch (action.type) {
    case 'SET_PLAYBOOK':
      return {
        ...state,
        playbook: action.playbook,
        loading: false,
        selectedTrackId: state.selectedTrackId || action.playbook.tracks?.[0]?.id || null,
      };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_SYNCING':
      return { ...state, syncing: action.syncing };
    case 'SELECT_TRACK':
      return { ...state, selectedTrackId: action.trackId };
    case 'UPDATE_TRACK':
      if (!state.playbook) return state;
      return {
        ...state,
        playbook: {
          ...state.playbook,
          tracks: state.playbook.tracks?.map(t =>
            t.id === action.trackId ? { ...t, ...action.updates } : t
          ),
        },
      };
    case 'ADD_TRACK':
      if (!state.playbook) return state;
      return {
        ...state,
        playbook: {
          ...state.playbook,
          tracks: [...(state.playbook.tracks || []), action.track],
          track_count: (state.playbook.track_count || 0) + 1,
        },
      };
    case 'REMOVE_TRACK':
      if (!state.playbook) return state;
      return {
        ...state,
        playbook: {
          ...state.playbook,
          tracks: state.playbook.tracks?.filter(t => t.id !== action.trackId),
          track_count: Math.max(0, (state.playbook.track_count || 0) - 1),
        },
        selectedTrackId: state.selectedTrackId === action.trackId ? null : state.selectedTrackId,
      };
    case 'OPEN_DRAFT_PREVIEW':
      return {
        ...state,
        draftPreview: { isOpen: true, trackId: action.trackId },
      };
    case 'CLOSE_DRAFT_PREVIEW':
      return {
        ...state,
        draftPreview: { isOpen: false, trackId: null },
      };
    default:
      return state;
  }
}

// ============================================================================
// STATUS HELPERS
// ============================================================================

const STATUS_CONFIG = {
  suggestion: { label: 'Suggested', color: 'bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white border-transparent' },
  confirmed: { label: 'Confirmed', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
  generating: { label: 'Generating...', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' },
  draft_ready: { label: 'Draft Ready', color: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' },
  approved: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
  published: { label: 'Published', color: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800' },
  skipped: { label: 'Skipped', color: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PlaybookBuildView({
  sourceFileId,
  organizationId: propOrganizationId,
  onBack,
  onComplete,
}: PlaybookBuildViewProps) {
  const [state, dispatch] = useReducer(playbookReducer, initialState);
  const [analyzing, setAnalyzing] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [albumTitle, setAlbumTitle] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(propOrganizationId || null);

  // Drag state
  const [draggedChunkId, setDraggedChunkId] = useState<string | null>(null);
  const [dropTargetTrackId, setDropTargetTrackId] = useState<string | null>(null);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  // Fetch organization ID if not provided
  useEffect(() => {
    async function fetchOrgId() {
      if (!organizationId) {
        const orgId = await getCurrentUserOrgId();
        console.log('[PlaybookBuildView] Fetched orgId:', orgId);
        setOrganizationId(orgId);
      }
    }
    fetchOrgId();
  }, [organizationId]);

  // Check for existing playbook or trigger analysis
  useEffect(() => {
    if (!organizationId) return; // Wait for org ID

    async function initializePlaybook() {
      try {
        // For now, always trigger new analysis
        // TODO: Check for existing playbook for this source file
        setAnalyzing(true);
        dispatch({ type: 'SET_LOADING', loading: true });

        const result = await analyzeSource(sourceFileId, organizationId!, {
          checkDuplicates: true,
        });

        if (result.playbook_id) {
          const playbook = await getPlaybookById(result.playbook_id);
          if (playbook) {
            dispatch({ type: 'SET_PLAYBOOK', playbook });
            setAlbumTitle(playbook.title);
          }
        }
      } catch (error) {
        console.error('Failed to initialize playbook:', error);
        toast.error('Failed to analyze source file');
      } finally {
        setAnalyzing(false);
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    }

    initializePlaybook();
  }, [sourceFileId, organizationId]);

  // ============================================================================
  // TRACK OPERATIONS
  // ============================================================================

  const selectedTrack = state.playbook?.tracks?.find(t => t.id === state.selectedTrackId);

  const handleConfirmTrack = useCallback(async (trackId: string, resolution?: string) => {
    try {
      dispatch({ type: 'UPDATE_TRACK', trackId, updates: { status: 'confirmed' } });
      await confirmTrack(trackId, resolution as any);
      toast.success('Track confirmed');
    } catch (error) {
      console.error('Failed to confirm track:', error);
      toast.error('Failed to confirm track');
    }
  }, []);

  const handleGenerateDraft = useCallback(async (trackId: string) => {
    try {
      dispatch({ type: 'UPDATE_TRACK', trackId, updates: { status: 'generating' } });
      const result = await generateDraft(trackId);
      dispatch({
        type: 'UPDATE_TRACK',
        trackId,
        updates: {
          status: 'draft_ready',
          generated_content: result.generated_content,
          generated_at: result.generated_at,
        },
      });
      dispatch({ type: 'OPEN_DRAFT_PREVIEW', trackId });
      toast.success('Draft generated');
    } catch (error) {
      console.error('Failed to generate draft:', error);
      dispatch({ type: 'UPDATE_TRACK', trackId, updates: { status: 'confirmed' } });
      toast.error('Failed to generate draft');
    }
  }, []);

  const handleApproveTrack = useCallback(async (trackId: string, editedContent?: string) => {
    try {
      await approveTrack(trackId, editedContent);
      dispatch({ type: 'UPDATE_TRACK', trackId, updates: { status: 'approved' } });
      dispatch({ type: 'CLOSE_DRAFT_PREVIEW' });
      toast.success('Track approved');
    } catch (error) {
      console.error('Failed to approve track:', error);
      toast.error('Failed to approve track');
    }
  }, []);

  const handleSkipTrack = useCallback(async (trackId: string) => {
    try {
      dispatch({ type: 'UPDATE_TRACK', trackId, updates: { status: 'skipped' } });
      toast.success('Track skipped');
    } catch (error) {
      console.error('Failed to skip track:', error);
      toast.error('Failed to skip track');
    }
  }, []);

  const handlePublish = useCallback(async () => {
    if (!state.playbook) return;

    try {
      setPublishing(true);
      const result = await publishPlaybook(state.playbook.id, albumTitle);
      toast.success(`Album created with ${result.album.track_count} tracks`);
      setPublishDialogOpen(false);
      onComplete(result.album.id);
    } catch (error) {
      console.error('Failed to publish:', error);
      toast.error('Failed to publish album');
    } finally {
      setPublishing(false);
    }
  }, [state.playbook, albumTitle, onComplete]);

  // ============================================================================
  // DRAG AND DROP
  // ============================================================================

  const handleDragStart = useCallback((e: React.DragEvent, chunkId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedChunkId(chunkId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetTrackId(trackId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTargetTrackId(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, toTrackId: string) => {
    e.preventDefault();
    if (!draggedChunkId || !state.playbook) return;

    // Find source track
    const fromTrack = state.playbook.tracks?.find(t =>
      t.chunks?.some(c => c.source_chunk_id === draggedChunkId)
    );

    if (fromTrack && fromTrack.id !== toTrackId) {
      // Optimistic update
      dispatch({
        type: 'MOVE_CHUNK',
        chunkId: draggedChunkId,
        fromTrackId: fromTrack.id,
        toTrackId,
      });

      // Sync to server
      try {
        dispatch({ type: 'SET_SYNCING', syncing: true });
        const tracks = state.playbook.tracks?.map(t => ({
          id: t.id,
          title: t.title,
          chunk_ids: t.id === fromTrack.id
            ? t.chunks?.filter(c => c.source_chunk_id !== draggedChunkId).map(c => c.source_chunk_id) || []
            : t.id === toTrackId
              ? [...(t.chunks?.map(c => c.source_chunk_id) || []), draggedChunkId]
              : t.chunks?.map(c => c.source_chunk_id) || [],
          display_order: t.display_order,
        })) || [];

        await updateGroupings({
          playbook_id: state.playbook.id,
          tracks,
        });
      } catch (error) {
        console.error('Failed to sync chunk move:', error);
        toast.error('Failed to save changes');
        // Refresh from server
        const refreshed = await getPlaybookById(state.playbook.id);
        if (refreshed) dispatch({ type: 'SET_PLAYBOOK', playbook: refreshed });
      } finally {
        dispatch({ type: 'SET_SYNCING', syncing: false });
      }
    }

    setDraggedChunkId(null);
    setDropTargetTrackId(null);
  }, [draggedChunkId, state.playbook]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const approvedCount = state.playbook?.tracks?.filter(t => t.status === 'approved').length || 0;
  const totalTracks = state.playbook?.tracks?.length || 0;

  // ============================================================================
  // RENDER
  // ============================================================================

  if (state.loading || analyzing) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Header - matches main view */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Building Playbook
              </h1>
              <p className="text-sm text-muted-foreground">
                Analyzing source document
              </p>
            </div>
          </div>
        </div>

        {/* Loading content - centered */}
        <div className="flex-1 flex items-center justify-center">
          <PlaybookProcessingStatus />
        </div>
      </div>
    );
  }

  if (!state.playbook) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background p-8 space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">Failed to Load Playbook</h3>
          <p className="text-sm text-muted-foreground mt-1">
            There was an error loading the playbook data.
          </p>
          <Button variant="outline" className="mt-4" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {state.playbook.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {state.playbook.source_file?.file_name} &bull; {totalTracks} proposed tracks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {state.syncing && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </span>
          )}
          <Badge
            variant="outline"
            className="text-sm bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white border-transparent"
          >
            {approvedCount} / {totalTracks} approved
          </Badge>
          <Button
            onClick={() => setPublishDialogOpen(true)}
            disabled={approvedCount === 0}
            className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] hover:opacity-90 text-white"
          >
            <Package className="h-4 w-4 mr-2" />
            Publish Album
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Track List */}
        <div className="w-80 border-r border-border bg-card flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Proposed Tracks
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {state.playbook.tracks?.map(track => (
              <TrackListItem
                key={track.id}
                track={track}
                isSelected={track.id === state.selectedTrackId}
                onSelect={() => dispatch({ type: 'SELECT_TRACK', trackId: track.id })}
                onDragOver={(e) => handleDragOver(e, track.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, track.id)}
                isDropTarget={dropTargetTrackId === track.id}
              />
            ))}
          </div>
          <div className="p-3 border-t border-border">
            <Button variant="outline" size="sm" className="w-full" disabled>
              <Plus className="h-4 w-4 mr-2" />
              Add Track
            </Button>
          </div>
        </div>

        {/* Main Area - Track Editor */}
        <div className="flex-1 overflow-y-auto bg-background">
          {selectedTrack ? (
            <TrackEditor
              track={selectedTrack}
              onConfirm={handleConfirmTrack}
              onGenerateDraft={handleGenerateDraft}
              onSkip={handleSkipTrack}
              onPreviewDraft={() => dispatch({ type: 'OPEN_DRAFT_PREVIEW', trackId: selectedTrack.id })}
              onChunkDragStart={handleDragStart}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a track to view details
            </div>
          )}
        </div>
      </div>

      {/* Draft Preview Sheet */}
      <DraftPreviewSheet
        isOpen={state.draftPreview.isOpen}
        track={state.playbook.tracks?.find(t => t.id === state.draftPreview.trackId) || null}
        onClose={() => dispatch({ type: 'CLOSE_DRAFT_PREVIEW' })}
        onApprove={(content) => handleApproveTrack(state.draftPreview.trackId!, content)}
      />

      {/* Publish Dialog */}
      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent className="bg-[#1e1e2f] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Publish Album</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will create an album with {approvedCount} approved tracks and publish them to your content library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm text-gray-400">Album Title</label>
            <Input
              value={albumTitle}
              onChange={(e) => setAlbumTitle(e.target.value)}
              placeholder="Enter album title"
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-gray-700 text-gray-300">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePublish}
              disabled={publishing || !albumTitle.trim()}
              className="bg-gradient-to-r from-[#F64A05] to-[#FF733C]"
            >
              {publishing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 mr-2" />
                  Publish Album
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface TrackListItemProps {
  track: PlaybookTrack;
  isSelected: boolean;
  onSelect: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  isDropTarget: boolean;
}

function TrackListItem({
  track,
  isSelected,
  onSelect,
  onDragOver,
  onDragLeave,
  onDrop,
  isDropTarget,
}: TrackListItemProps) {
  const statusConfig = STATUS_CONFIG[track.status] || STATUS_CONFIG.suggestion;

  return (
    <div
      onClick={onSelect}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'p-3 rounded-lg cursor-pointer transition-all',
        isSelected
          ? 'bg-primary/10 border border-primary/30'
          : 'bg-muted/30 border border-transparent hover:bg-muted/50',
        isDropTarget && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground truncate">{track.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{track.chunk_count || 0} chunks</span>
            {track.rag_confidence && (
              <span className="text-xs text-muted-foreground">
                {Math.round(track.rag_confidence * 100)}% confidence
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className={cn('text-xs', statusConfig.color)}>{statusConfig.label}</Badge>
          {track.has_conflicts && (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
        </div>
      </div>
    </div>
  );
}

interface TrackEditorProps {
  track: PlaybookTrack;
  onConfirm: (trackId: string, resolution?: string) => void;
  onGenerateDraft: (trackId: string) => void;
  onSkip: (trackId: string) => void;
  onPreviewDraft: () => void;
  onChunkDragStart: (e: React.DragEvent, chunkId: string) => void;
}

function TrackEditor({
  track,
  onConfirm,
  onGenerateDraft,
  onSkip,
  onPreviewDraft,
  onChunkDragStart,
}: TrackEditorProps) {
  const [selectedResolution, setSelectedResolution] = useState<string | null>(null);

  const statusConfig = STATUS_CONFIG[track.status] || STATUS_CONFIG.suggestion;

  return (
    <div className="p-6 space-y-6">
      {/* Track Header */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">{track.title}</h2>
          <Badge className={cn('text-sm', statusConfig.color)}>{statusConfig.label}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {track.chunk_count || 0} chunks assigned
        </p>
      </div>

      {/* Conflict Banner */}
      {track.has_conflicts && track.conflicts && track.conflicts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-amber-700 dark:text-amber-400">Conflict Detected</h3>
              {track.conflicts.map((conflict, i) => (
                <div key={i} className="mt-2 text-sm text-foreground">
                  <p>
                    Similar to: <strong>"{conflict.existing_track_title}"</strong>
                  </p>
                  <p className="text-muted-foreground">
                    {Math.round(conflict.similarity_score * 100)}% match &bull; {conflict.match_type.replace('_', ' ')}
                  </p>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  size="sm"
                  variant={selectedResolution === 'keep_new' ? 'default' : 'outline'}
                  onClick={() => setSelectedResolution('keep_new')}
                  className="text-xs"
                >
                  Keep New
                </Button>
                <Button
                  size="sm"
                  variant={selectedResolution === 'keep_existing' ? 'default' : 'outline'}
                  onClick={() => setSelectedResolution('keep_existing')}
                  className="text-xs"
                >
                  Keep Existing
                </Button>
                <Button
                  size="sm"
                  variant={selectedResolution === 'create_version' ? 'default' : 'outline'}
                  onClick={() => setSelectedResolution('create_version')}
                  className="text-xs"
                >
                  Create Version
                </Button>
                <Button
                  size="sm"
                  variant={selectedResolution === 'create_variant' ? 'default' : 'outline'}
                  onClick={() => setSelectedResolution('create_variant')}
                  className="text-xs"
                >
                  Create Variant
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RAG Reasoning */}
      {track.rag_reasoning && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-700 dark:text-blue-400">AI Reasoning</h3>
              <p className="text-sm text-foreground mt-1">{track.rag_reasoning}</p>
            </div>
          </div>
        </div>
      )}

      {/* Chunks List */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Chunks in this Track
        </h3>
        <div className="space-y-2">
          {track.chunks?.map((ptc) => (
            <ChunkCard
              key={ptc.id}
              chunk={ptc.chunk}
              onDragStart={(e) => onChunkDragStart(e, ptc.source_chunk_id)}
            />
          ))}
          {(!track.chunks || track.chunks.length === 0) && (
            <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
              No chunks assigned. Drag chunks here from other tracks.
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button variant="ghost" size="sm" onClick={() => onSkip(track.id)}>
          Skip Track
        </Button>
        <div className="flex gap-2">
          {track.status === 'suggestion' && (
            <Button
              onClick={() => onConfirm(track.id, selectedResolution || undefined)}
              disabled={track.has_conflicts && !selectedResolution}
            >
              <Check className="h-4 w-4 mr-2" />
              Confirm Grouping
            </Button>
          )}
          {track.status === 'confirmed' && (
            <Button
              onClick={() => onGenerateDraft(track.id)}
              className="bg-gradient-to-r from-[#F64A05] to-[#FF733C]"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Draft
            </Button>
          )}
          {track.status === 'generating' && (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </Button>
          )}
          {(track.status === 'draft_ready' || track.status === 'approved') && (
            <Button variant="outline" onClick={onPreviewDraft}>
              <Eye className="h-4 w-4 mr-2" />
              View Draft
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ChunkCardProps {
  chunk?: SourceChunk;
  onDragStart: (e: React.DragEvent) => void;
}

function ChunkCard({ chunk, onDragStart }: ChunkCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (!chunk) return null;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-card rounded-lg border border-border hover:border-primary/30 transition-colors cursor-grab active:cursor-grabbing"
    >
      <div
        className="flex items-center gap-3 p-3"
        onClick={() => setExpanded(!expanded)}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-foreground truncate">
              {chunk.title || `Chunk ${chunk.chunk_index + 1}`}
            </h4>
            <Badge variant="outline" className="text-xs bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white border-transparent">
              {chunk.content_class}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {chunk.word_count} words
          </p>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-0">
          <div className="bg-muted/50 rounded p-3 text-sm text-foreground max-h-48 overflow-y-auto">
            {chunk.content}
          </div>
          {chunk.key_terms && chunk.key_terms.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {chunk.key_terms.map((term, i) => (
                <Badge key={i} variant="outline" className="text-xs bg-muted">
                  {term}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface DraftPreviewSheetProps {
  isOpen: boolean;
  track: PlaybookTrack | null;
  onClose: () => void;
  onApprove: (content?: string) => void;
}

function DraftPreviewSheet({ isOpen, track, onClose, onApprove }: DraftPreviewSheetProps) {
  const [approving, setApproving] = useState(false);

  if (!track) return null;

  const handleApprove = async () => {
    setApproving(true);
    try {
      await onApprove();
    } finally {
      setApproving(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[600px] sm:max-w-[600px] bg-card border-border">
        <SheetHeader>
          <SheetTitle className="text-foreground">Draft Preview: {track.title}</SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Review the generated content before approving.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 max-h-[60vh] overflow-y-auto">
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: track.generated_content || '' }}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {track.status === 'draft_ready' && (
              <Button
                onClick={handleApprove}
                disabled={approving}
                className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white"
              >
                {approving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve Track
                  </>
                )}
              </Button>
            )}
            {track.status === 'approved' && (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Approved
              </Badge>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default PlaybookBuildView;
