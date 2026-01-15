/**
 * DOCUMENT INTELLIGENCE EDITOR
 *
 * A Notion-like full-page editor for processing uploaded documents.
 * Features:
 * - Synced block style chunks with color-coded borders
 * - Margin sidebar showing connected content
 * - AI-powered content classification
 * - Chunk merge/split operations
 * - Text selection and move between chunks
 * - Direct role creation from JD chunks
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';
import { Skeleton } from './ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  ArrowLeft,
  Loader2,
  Check,
  ChevronDown,
  Layers,
  FileText,
  Briefcase,
  BookOpen,
  MessageSquare,
  HelpCircle,
  Link2,
  Plus,
  Merge,
  Split,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  X,
  Zap,
  GripVertical,
  Scissors,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase, supabaseAnonKey } from '../lib/supabase';
import { getServerUrl } from '../utils/supabase/info';
import { cn } from './ui/utils';
import { ChunkToTrackGenerator } from './ChunkToTrackGenerator';
import { ExtractedEntityProcessor } from './ExtractedEntityProcessor';

// Content type configuration (matches backend ContentClass types)
// - policy: Rules, expectations, standards (e.g., Sexual Harassment Policy)
// - procedure: Step-by-step instructions (e.g., How to Change Register Paper)
// - job_description: Role definitions (e.g., Store Manager JD)
// - training_materials: Checklists, guides, OJT content - catchall for track conversion
// - other: Miscellaneous content
const CONTENT_TYPES = {
  policy: { label: 'Policy', color: 'border-blue-500', bgColor: 'bg-blue-500/10', icon: BookOpen },
  procedure: { label: 'Procedure', color: 'border-purple-500', bgColor: 'bg-purple-500/10', icon: FileText },
  job_description: { label: 'Job Description', color: 'border-green-500', bgColor: 'bg-green-500/10', icon: Briefcase },
  training_materials: { label: 'Training', color: 'border-orange-500', bgColor: 'bg-orange-500/10', icon: BookOpen },
  other: { label: 'Other', color: 'border-gray-400', bgColor: 'bg-gray-400/10', icon: HelpCircle },
} as const;

type ContentType = keyof typeof CONTENT_TYPES;

interface SourceFile {
  id: string;
  organization_id: string;
  file_name: string;
  extracted_text: string | null;
  source_type: string;
  is_chunked: boolean;
  chunk_count: number;
  created_at: string;
  file_size: number;
  processing_status?: 'pending' | 'extracting' | 'chunking' | 'classifying' | 'ready' | 'error';
}

interface SourceChunk {
  id: string;
  chunk_index: number;
  content: string;
  title: string | null;
  summary: string | null;
  word_count: number;
  chunk_type: string;
  content_class: ContentType;
  content_class_confidence: number | null;
  is_extractable: boolean;
  extraction_status: string;
  key_terms: string[];
  hierarchy_level: number;
  parent_chunk_id: string | null;
  // For JD chunks - detected role info
  detected_role_name?: string;
  jd_group_id?: string; // For grouping related JD chunks
}

interface ExtractedEntity {
  id: string;
  entity_type: string;
  entity_status: string;
  extracted_data: {
    role_name?: string;
    department?: string;
    job_summary?: string;
  };
  linked_entity_type?: string;
  linked_entity_id?: string;
  source_chunk_id: string;
}

interface LinkedContent {
  type: 'role' | 'track';
  id: string;
  name: string;
}

interface ChunkWithMeta extends SourceChunk {
  isSelected: boolean;
  linkedContent: LinkedContent[];
  entity?: ExtractedEntity;
  aiSuggestion?: {
    type: 'merge' | 'split' | 'reclassify';
    message: string;
    targetChunkIds?: string[];
  };
}

interface ContentTypeSummary {
  type: ContentType;
  count: number;
}

interface DocumentIntelligenceEditorProps {
  sourceFileId: string;
  onBack: () => void;
  onViewRole?: (roleId: string) => void;
  onCreateRole?: (prefillData: {
    sourceChunkId: string;
    sourceFileId: string;
    entityId: string;
    roleName: string;
    department: string;
    jobDescription: string;
  }) => void;
  /** Chunk ID to auto-expand and scroll to (for deep linking from role JD hotlinks) */
  highlightChunkId?: string | null;
  /** Callback to start the Playbook Build workflow */
  onStartPlaybook?: (sourceFileId: string) => void;
}

export function DocumentIntelligenceEditor({
  sourceFileId,
  onBack,
  onViewRole,
  onCreateRole,
  highlightChunkId,
  onStartPlaybook,
}: DocumentIntelligenceEditorProps) {

  // Core state
  const [sourceFile, setSourceFile] = useState<SourceFile | null>(null);
  const [chunks, setChunks] = useState<ChunkWithMeta[]>([]);
  const [entities, setEntities] = useState<ExtractedEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');

  // UI state
  const [selectedChunks, setSelectedChunks] = useState<Set<string>>(new Set());
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<ContentType | 'all'>('all');
  const [hoveredChunk, setHoveredChunk] = useState<string | null>(null);

  // Text selection state (for moving text between chunks)
  const [textSelection, setTextSelection] = useState<{
    chunkId: string;
    start: number;
    end: number;
    text: string;
  } | null>(null);

  // Blade mode split selection state
  const [splitSelection, setSplitSelection] = useState<{
    chunkId: string;
    splitIndex: number; // Character index where to split
  } | null>(null);

  // Track/Content generation state
  const [showTrackGenerator, setShowTrackGenerator] = useState(false);
  const [chunksForTrackGeneration, setChunksForTrackGeneration] = useState<ChunkWithMeta[]>([]);

  // Entity/Role processing state
  const [showEntityProcessor, setShowEntityProcessor] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Merge operation state
  const [merging, setMerging] = useState(false);

  // Blade mode state - for splitting chunks with click
  const [bladeMode, setBladeMode] = useState(false);
  const [splitting, setSplitting] = useState(false);

  // Drag-drop merge state
  const [draggedChunkId, setDraggedChunkId] = useState<string | null>(null);
  const [dropTargetChunkId, setDropTargetChunkId] = useState<string | null>(null);

  // File name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedFileName, setEditedFileName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const fileNameInputRef = useRef<HTMLInputElement>(null);

  // Load source file and chunks
  useEffect(() => {
    if (sourceFileId) {
      loadSourceFile();
    }
  }, [sourceFileId]);

  // Auto-expand and scroll to highlighted chunk (from JD hotlink deep linking)
  useEffect(() => {
    if (highlightChunkId && chunks.length > 0) {
      // Expand the highlighted chunk
      setExpandedChunks(prev => {
        const next = new Set(prev);
        next.add(highlightChunkId);
        return next;
      });

      // Scroll to the chunk after a short delay for DOM to update
      setTimeout(() => {
        const chunkElement = document.getElementById(`chunk-${highlightChunkId}`);
        if (chunkElement) {
          chunkElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add a brief highlight effect
          chunkElement.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
          setTimeout(() => {
            chunkElement.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
          }, 2000);
        }
      }, 100);
    }
  }, [highlightChunkId, chunks.length]);

  // Blade mode keyboard shortcut (B key to toggle)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // B key toggles blade mode
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setBladeMode(prev => {
          const newMode = !prev;
          if (newMode) {
            toast.info('Blade mode ON - Click between paragraphs to split', {
              duration: 2000,
              icon: '✂️',
            });
          } else {
            toast.info('Blade mode OFF', { duration: 1500 });
          }
          return newMode;
        });
      }

      // Escape exits blade mode
      if (e.key === 'Escape' && bladeMode) {
        setBladeMode(false);
        toast.info('Blade mode OFF', { duration: 1500 });
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bladeMode]);

  async function loadSourceFile() {
    if (!sourceFileId) return;

    setLoading(true);
    try {
      // Fetch source file
      const { data: file, error: fileError } = await supabase
        .from('source_files')
        .select('*')
        .eq('id', sourceFileId)
        .single();

      if (fileError) throw fileError;
      setSourceFile(file);

      // Fetch chunks if they exist
      if (file.is_chunked) {
        await loadChunks();
      } else if (file.extracted_text) {
        // Auto-process: document has text but no chunks yet
        // Start chunking automatically in the background
        autoProcessDocument(file);
      }
    } catch (error: any) {
      console.error('Error loading source file:', error);
      toast.error('Failed to load document', { description: error.message });
    } finally {
      setLoading(false);
    }
  }

  // Start editing the file name
  function startEditingName() {
    if (sourceFile) {
      setEditedFileName(sourceFile.file_name);
      setIsEditingName(true);
      // Focus the input after state update
      setTimeout(() => fileNameInputRef.current?.focus(), 0);
    }
  }

  // Cancel editing and reset
  function cancelEditingName() {
    setIsEditingName(false);
    setEditedFileName('');
  }

  // Save the updated file name to the database
  async function saveFileName() {
    if (!sourceFile || !editedFileName.trim()) return;

    const trimmedName = editedFileName.trim();
    if (trimmedName === sourceFile.file_name) {
      // No change, just exit edit mode
      setIsEditingName(false);
      return;
    }

    setSavingName(true);
    try {
      const { error } = await supabase
        .from('source_files')
        .update({ file_name: trimmedName })
        .eq('id', sourceFile.id);

      if (error) throw error;

      // Update local state
      setSourceFile({ ...sourceFile, file_name: trimmedName });
      setIsEditingName(false);
      toast.success('File name updated');
    } catch (error: any) {
      console.error('Error updating file name:', error);
      toast.error('Failed to update file name', { description: error.message });
    } finally {
      setSavingName(false);
    }
  }

  // Handle Enter key to save, Escape to cancel
  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveFileName();
    } else if (e.key === 'Escape') {
      cancelEditingName();
    }
  }

  // Auto-process document when it has extracted text but no chunks
  async function autoProcessDocument(file: SourceFile) {
    setProcessing(true);
    setProcessingStep('Auto-processing document...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const serverUrl = getServerUrl();

      // Chunk the document with built-in classification
      setProcessingStep('Chunking & classifying...');
      const chunkResponse = await fetch(`${serverUrl}/chunk-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          source_file_id: file.id,
          classify_content: true,
        }),
      });

      if (!chunkResponse.ok) {
        const errorData = await chunkResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Auto-processing failed');
      }

      // Reload to get chunks
      const { data: updatedFile } = await supabase
        .from('source_files')
        .select('*')
        .eq('id', file.id)
        .single();

      if (updatedFile) {
        setSourceFile(updatedFile);
        await loadChunks();
      }

      toast.success('Document processed automatically');
    } catch (error: any) {
      console.error('Auto-processing error:', error);
      toast.error('Auto-processing failed', { description: error.message });
    } finally {
      setProcessing(false);
      setProcessingStep('');
    }
  }

  async function loadChunks() {
    if (!sourceFileId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/chunks/${sourceFileId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch chunks');
      }

      const data = await response.json();
      const rawChunks: SourceChunk[] = data.chunks || [];

      // Fetch extracted entities for JD chunks
      const { data: entityData } = await supabase
        .from('extracted_entities')
        .select('*')
        .eq('source_file_id', sourceFileId);

      setEntities(entityData || []);

      // Fetch linked content (roles and tracks)
      const linkedContentMap = await loadLinkedContent(rawChunks.map(c => c.id), entityData || []);

      // Transform chunks with metadata
      const enrichedChunks: ChunkWithMeta[] = rawChunks.map(chunk => {
        const entity = entityData?.find(e => e.source_chunk_id === chunk.id);
        return {
          ...chunk,
          isSelected: false,
          linkedContent: linkedContentMap[chunk.id] || [],
          entity,
          detected_role_name: entity?.extracted_data?.role_name,
        };
      });

      setChunks(enrichedChunks);

      // Auto-expand all chunks initially
      setExpandedChunks(new Set(enrichedChunks.map(c => c.id)));

    } catch (error: any) {
      console.error('Error loading chunks:', error);
      toast.error('Failed to load chunks', { description: error.message });
    }
  }

  async function loadLinkedContent(
    chunkIds: string[],
    entities: ExtractedEntity[]
  ): Promise<Record<string, LinkedContent[]>> {
    // Guard: return empty map if no chunk IDs to avoid invalid Supabase query
    if (chunkIds.length === 0) {
      return {};
    }

    const linkedMap: Record<string, LinkedContent[]> = {};

    // Initialize empty arrays
    chunkIds.forEach(id => { linkedMap[id] = []; });

    // Get roles linked via extracted entities
    const linkedRoleIds = entities
      .filter(e => e.linked_entity_type === 'roles' && e.linked_entity_id)
      .map(e => ({ chunkId: e.source_chunk_id, roleId: e.linked_entity_id! }));

    if (linkedRoleIds.length > 0) {
      const { data: roles } = await supabase
        .from('roles')
        .select('id, name')
        .in('id', linkedRoleIds.map(r => r.roleId));

      linkedRoleIds.forEach(({ chunkId, roleId }) => {
        const role = roles?.find(r => r.id === roleId);
        if (role) {
          linkedMap[chunkId].push({ type: 'role', id: role.id, name: role.name });
        }
      });
    }

    // Get tracks linked via track_source_chunks
    const { data: trackLinks, error: trackError } = await supabase
      .from('track_source_chunks')
      .select('source_chunk_id, track_id, tracks(id, title)')
      .in('source_chunk_id', chunkIds);

    if (trackError) {
      console.log('track_source_chunks query error:', trackError.message);
    }

    trackLinks?.forEach((link: any) => {
      if (link.tracks) {
        linkedMap[link.source_chunk_id].push({
          type: 'track',
          id: link.tracks.id,
          name: link.tracks.title, // tracks table uses 'title' not 'name'
        });
      }
    });

    return linkedMap;
  }

  // Process document (extract + chunk with built-in classification)
  async function processDocument() {
    if (!sourceFile) return;

    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const serverUrl = getServerUrl();

      // Step 1: Extract text (if not already done)
      if (!sourceFile.extracted_text) {
        setProcessingStep('Extracting text...');
        const extractResponse = await fetch(`${serverUrl}/extract-source`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({ source_file_id: sourceFile.id }),
        });

        if (!extractResponse.ok) {
          const errorData = await extractResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Text extraction failed');
        }

        // Reload source file to get extracted text
        await loadSourceFile();
      }

      // Step 2: Chunk the document with built-in classification
      // The chunk-source endpoint handles classification when classify_content=true
      setProcessingStep('Chunking & classifying...');
      const chunkResponse = await fetch(`${serverUrl}/chunk-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          source_file_id: sourceFile.id,
          classify_content: true, // Enable AI classification during chunking
        }),
      });

      if (!chunkResponse.ok) {
        const errorData = await chunkResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Chunking failed');
      }

      // Reload everything
      await loadSourceFile();
      toast.success('Document processed successfully');

    } catch (error: any) {
      console.error('Processing error:', error);
      toast.error('Processing failed', { description: error.message });
    } finally {
      setProcessing(false);
      setProcessingStep('');
    }
  }

  // Toggle chunk selection
  function toggleChunkSelection(chunkId: string) {
    setSelectedChunks(prev => {
      const next = new Set(prev);
      if (next.has(chunkId)) {
        next.delete(chunkId);
      } else {
        next.add(chunkId);
      }
      return next;
    });
  }

  // Select all visible chunks
  function selectAllChunks() {
    const visibleChunkIds = filteredChunks.map(c => c.id);
    setSelectedChunks(new Set(visibleChunkIds));
  }

  // Clear selection
  function clearSelection() {
    setSelectedChunks(new Set());
  }

  // Toggle chunk expansion
  function toggleChunkExpansion(chunkId: string) {
    setExpandedChunks(prev => {
      const next = new Set(prev);
      if (next.has(chunkId)) {
        next.delete(chunkId);
      } else {
        next.add(chunkId);
      }
      return next;
    });
  }

  // Update chunk classification
  async function updateChunkClassification(chunkId: string, newClass: ContentType) {
    try {
      const { error } = await supabase
        .from('source_chunks')
        .update({
          content_class: newClass,
          is_extractable: newClass === 'job_description',
        })
        .eq('id', chunkId);

      if (error) throw error;

      setChunks(prev => prev.map(c =>
        c.id === chunkId
          ? { ...c, content_class: newClass, is_extractable: newClass === 'job_description' }
          : c
      ));

      toast.success('Classification updated');
    } catch (error: any) {
      toast.error('Failed to update classification', { description: error.message });
    }
  }

  // Rename chunk title
  async function renameChunkTitle(chunkId: string, newTitle: string) {
    try {
      // Optimistic UI update
      setChunks(prev => prev.map(c =>
        c.id === chunkId ? { ...c, title: newTitle } : c
      ));

      // Update database
      const { error } = await supabase
        .from('source_chunks')
        .update({ title: newTitle })
        .eq('id', chunkId);

      if (error) throw error;

      toast.success('Title updated');
    } catch (error: any) {
      // Revert on error - refetch to get correct state
      toast.error('Failed to update title', { description: error.message });
      fetchChunks();
    }
  }

  // Merge selected chunks
  async function mergeSelectedChunks() {
    if (selectedChunks.size < 2) {
      toast.error('Select at least 2 chunks to merge');
      return;
    }

    if (merging) return; // Prevent double-clicks

    setMerging(true);

    const selectedChunksList = chunks.filter(c => selectedChunks.has(c.id));
    // Sort by chunk_index to maintain document order
    const sortedChunks = selectedChunksList.sort((a, b) => a.chunk_index - b.chunk_index);

    // Merge content
    const mergedContent = sortedChunks.map(c => c.content).join('\n\n');
    const mergedTitle = sortedChunks[0].title || `Merged Section`;
    const primaryChunk = sortedChunks[0];
    const chunksToDelete = sortedChunks.slice(1).map(c => c.id);
    const numDeleted = chunksToDelete.length;

    // OPTIMISTIC UI UPDATE - Update local state immediately for instant feedback
    setChunks(prevChunks => {
      // Create merged chunk
      const updatedPrimary: ChunkWithMeta = {
        ...primaryChunk,
        content: mergedContent,
        title: mergedTitle,
        word_count: mergedContent.split(/\s+/).length,
      };

      // Filter out deleted chunks and renumber
      let nextIndex = 0;
      return prevChunks
        .filter(c => !chunksToDelete.includes(c.id))
        .map(c => {
          if (c.id === primaryChunk.id) return { ...updatedPrimary, chunk_index: nextIndex++ };
          return { ...c, chunk_index: nextIndex++ };
        })
        .sort((a, b) => a.chunk_index - b.chunk_index);
    });

    // Clear selection
    clearSelection();
    toast.success(`Merged ${sortedChunks.length} chunks`);

    // BACKGROUND DB SYNC - Don't block UI
    try {
      // Run primary operations in parallel
      await Promise.all([
        // Update primary chunk with merged content
        supabase
          .from('source_chunks')
          .update({
            content: mergedContent,
            title: mergedTitle,
            word_count: mergedContent.split(/\s+/).length,
          })
          .eq('id', primaryChunk.id),

        // Delete other chunks
        supabase
          .from('source_chunks')
          .delete()
          .in('id', chunksToDelete),

        // Update chunk_count on source file
        supabase
          .from('source_files')
          .update({ chunk_count: chunks.length - numDeleted })
          .eq('id', sourceFileId),
      ]);

      // Renumber remaining chunks in parallel
      const remainingChunksAfter = chunks
        .filter(c => c.chunk_index > primaryChunk.chunk_index && !chunksToDelete.includes(c.id))
        .sort((a, b) => a.chunk_index - b.chunk_index);

      if (remainingChunksAfter.length > 0) {
        let nextIndex = primaryChunk.chunk_index + 1;
        const renumberOps = remainingChunksAfter
          .filter(c => c.chunk_index !== nextIndex)
          .map((c, i) =>
            supabase
              .from('source_chunks')
              .update({ chunk_index: primaryChunk.chunk_index + 1 + i })
              .eq('id', c.id)
          );

        if (renumberOps.length > 0) {
          await Promise.all(renumberOps);
        }
      }

    } catch (error: any) {
      console.error('Merge DB sync error:', error);
      // On error, reload to get correct state
      toast.error('Sync error - refreshing', { description: error.message });
      await loadChunks();
    } finally {
      setMerging(false);
    }
  }

  // Merge two chunks via drag-drop
  async function mergeTwoChunks(draggedId: string, targetId: string) {
    if (merging) return;

    const draggedChunk = chunks.find(c => c.id === draggedId);
    const targetChunk = chunks.find(c => c.id === targetId);

    if (!draggedChunk || !targetChunk) {
      toast.error('Could not find chunks to merge');
      return;
    }

    setMerging(true);

    // Sort by chunk_index to maintain document order
    const sortedChunks = [draggedChunk, targetChunk].sort((a, b) => a.chunk_index - b.chunk_index);
    const primaryChunk = sortedChunks[0];
    const secondaryChunk = sortedChunks[1];

    // Merge content
    const mergedContent = sortedChunks.map(c => c.content).join('\n\n');
    const mergedTitle = primaryChunk.title || `Merged Section`;
    const deletedIndex = secondaryChunk.chunk_index;

    // OPTIMISTIC UI UPDATE - Update local state immediately for instant feedback
    setChunks(prevChunks => {
      // Create merged chunk
      const updatedPrimary: ChunkWithMeta = {
        ...primaryChunk,
        content: mergedContent,
        title: mergedTitle,
        word_count: mergedContent.split(/\s+/).length,
      };

      // Filter out secondary chunk and update indices
      return prevChunks
        .filter(c => c.id !== secondaryChunk.id)
        .map(c => {
          if (c.id === primaryChunk.id) return updatedPrimary;
          if (c.chunk_index > deletedIndex) {
            return { ...c, chunk_index: c.chunk_index - 1 };
          }
          return c;
        })
        .sort((a, b) => a.chunk_index - b.chunk_index);
    });

    // Clear selection state
    setSelectedChunks(prev => {
      const next = new Set(prev);
      next.delete(secondaryChunk.id);
      return next;
    });

    toast.success('Chunks merged');

    // BACKGROUND DB SYNC - Don't block UI
    try {
      // Run all DB operations in parallel
      const dbOperations = [
        // Update primary chunk with merged content
        supabase
          .from('source_chunks')
          .update({
            content: mergedContent,
            title: mergedTitle,
            word_count: mergedContent.split(/\s+/).length,
          })
          .eq('id', primaryChunk.id),

        // Delete the secondary chunk
        supabase
          .from('source_chunks')
          .delete()
          .eq('id', secondaryChunk.id),

        // Update chunk_count on source file
        supabase
          .from('source_files')
          .update({ chunk_count: chunks.length - 1 })
          .eq('id', sourceFileId),
      ];

      await Promise.all(dbOperations);

      // Renumber remaining chunks in parallel (after delete completes)
      const remainingChunksAfter = chunks
        .filter(c => c.chunk_index > deletedIndex && c.id !== secondaryChunk.id);

      if (remainingChunksAfter.length > 0) {
        await Promise.all(
          remainingChunksAfter.map(c =>
            supabase
              .from('source_chunks')
              .update({ chunk_index: c.chunk_index - 1 })
              .eq('id', c.id)
          )
        );
      }

    } catch (error: any) {
      console.error('Merge DB sync error:', error);
      // On error, reload to get correct state
      toast.error('Sync error - refreshing', { description: error.message });
      await loadChunks();
    } finally {
      setMerging(false);
    }
  }

  /**
   * BLADE MODE: Handle click on chunk content to split at that position.
   * Uses browser caret APIs to accurately find click position, then splits at the line ABOVE.
   */
  function handleBladeClick(chunkId: string, clickEvent: React.MouseEvent<HTMLDivElement>) {
    console.log('[Blade] Click detected, bladeMode:', bladeMode, 'splitting:', splitting);

    if (!bladeMode || splitting) {
      console.log('[Blade] Early return - mode or splitting check failed');
      return;
    }

    const chunk = chunks.find(c => c.id === chunkId);
    if (!chunk) {
      console.log('[Blade] Chunk not found:', chunkId);
      return;
    }

    const content = chunk.content;
    console.log('[Blade] Content length:', content.length);

    // Use caretRangeFromPoint to get accurate click position in text
    const x = clickEvent.clientX;
    const y = clickEvent.clientY;
    let charIndex = -1;

    // Try caretRangeFromPoint (works in Chrome, Safari, Edge)
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(x, y);
      if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
        // Get the text before the caret in the text node
        const textNode = range.startContainer as Text;
        const offsetInNode = range.startOffset;

        // Find where this text node's content appears in the full chunk content
        const textContent = textNode.textContent || '';
        const textBefore = textContent.slice(0, offsetInNode);

        // Search for this text in the content to find approximate position
        // We look for the text node content in the chunk
        const nodeStartInContent = content.indexOf(textContent);
        if (nodeStartInContent !== -1) {
          charIndex = nodeStartInContent + offsetInNode;
          console.log('[Blade] caretRangeFromPoint found charIndex:', charIndex);
        }
      }
    }

    // Fallback: Y-ratio estimation if caret method failed
    if (charIndex === -1) {
      const contentElement = clickEvent.currentTarget;
      const rect = contentElement.getBoundingClientRect();
      const clickY = clickEvent.clientY - rect.top;
      const totalHeight = rect.height;
      charIndex = Math.floor((clickY / totalHeight) * content.length);
      console.log('[Blade] Fallback Y-ratio, charIndex:', charIndex);
    }

    // Find the line break BEFORE the click position - split happens ABOVE clicked line
    let splitIndex = -1;
    for (let i = Math.min(charIndex, content.length - 1); i >= 0; i--) {
      if (content[i] === '\n') {
        splitIndex = i + 1; // Split after this newline (content after this goes to new chunk)
        break;
      }
    }

    console.log('[Blade] Found split index:', splitIndex, 'from charIndex:', charIndex);

    // Validate split position
    if (splitIndex === -1 || splitIndex < 20) {
      toast.error('Cannot split at the beginning of a chunk');
      return;
    }
    if (splitIndex > content.length - 20) {
      toast.error('Cannot split at the end of a chunk');
      return;
    }

    // Perform the split
    console.log('[Blade] Calling performBladeSplit at index:', splitIndex);
    performBladeSplit(chunkId, splitIndex);
  }

  /**
   * Execute the blade split at the given character index.
   */
  async function performBladeSplit(chunkId: string, splitIndex: number) {
    console.log('[Blade Split] Starting split for chunk:', chunkId, 'at index:', splitIndex);

    const chunk = chunks.find(c => c.id === chunkId);
    if (!chunk) {
      console.error('[Blade Split] Chunk not found');
      toast.error('Could not find chunk to split');
      return;
    }

    const fullText = chunk.content;
    const beforeText = fullText.slice(0, splitIndex).trim();
    const afterText = fullText.slice(splitIndex).trim();

    console.log('[Blade Split] Before text length:', beforeText.length, 'After text length:', afterText.length);

    // Validate we have content on both sides
    if (beforeText.length < 20 || afterText.length < 20) {
      toast.error('Split would create chunks that are too small');
      console.log('[Blade Split] Validation failed - chunks too small');
      return;
    }

    setSplitting(true);

    const baseTitle = chunk.title || 'Section';
    const originalIndex = chunk.chunk_index;
    const newChunkId = crypto.randomUUID(); // Generate ID for optimistic update

    // OPTIMISTIC UI UPDATE - Show split immediately
    setChunks(prevChunks => {
      const updatedChunk: ChunkWithMeta = {
        ...chunk,
        content: beforeText,
        title: `${baseTitle} (Part 1)`,
        word_count: beforeText.split(/\s+/).length,
      };

      const newChunk: ChunkWithMeta = {
        ...chunk,
        id: newChunkId,
        content: afterText,
        title: `${baseTitle} (Part 2)`,
        word_count: afterText.split(/\s+/).length,
        chunk_index: originalIndex + 1,
        isSelected: false,
        linkedContent: [],
        entity: undefined,
      };

      // Update indices for chunks after the split point
      const result = prevChunks.map(c => {
        if (c.id === chunk.id) return updatedChunk;
        if (c.chunk_index > originalIndex) {
          return { ...c, chunk_index: c.chunk_index + 1 };
        }
        return c;
      });

      // Insert the new chunk
      result.push(newChunk);
      return result.sort((a, b) => a.chunk_index - b.chunk_index);
    });

    // Auto-expand the new chunk so user can see it
    setExpandedChunks(prev => {
      const next = new Set(prev);
      next.add(newChunkId);
      return next;
    });

    toast.success('Chunk split!', { icon: '✂️' });
    console.log('[Blade Split] Optimistic UI updated');

    // BACKGROUND DB SYNC - fire and forget, don't block UI
    // Use an async IIFE to handle DB sync without blocking
    (async () => {
      try {
        // Two-phase index shift to avoid unique constraint conflicts:
        // Phase 1: Shift all affected chunks to temporary high indices (add 10000)
        // Phase 2: Set final indices
        const TEMP_OFFSET = 10000;
        const chunksToShift = chunks
          .filter(c => c.chunk_index > originalIndex)
          .sort((a, b) => a.chunk_index - b.chunk_index); // Lowest first for phase 1

        console.log('[Blade Split] Chunks to shift:', chunksToShift.length);

        // Phase 1: Move all to temporary indices (sequential, lowest first)
        for (const c of chunksToShift) {
          const { error } = await supabase
            .from('source_chunks')
            .update({ chunk_index: c.chunk_index + TEMP_OFFSET })
            .eq('id', c.id);
          if (error) {
            console.warn('[Blade Split] Phase 1 shift warning:', c.id, error.message);
          }
        }

        // Phase 2: Set final indices (sequential, highest first to avoid conflicts)
        for (const c of chunksToShift.slice().reverse()) {
          const { error } = await supabase
            .from('source_chunks')
            .update({ chunk_index: c.chunk_index + 1 }) // Final index is original + 1
            .eq('id', c.id);
          if (error) {
            console.warn('[Blade Split] Phase 2 shift warning:', c.id, error.message);
          }
        }

        // Update original chunk and create new chunk in parallel
        const [updateResult, insertResult] = await Promise.all([
          supabase
            .from('source_chunks')
            .update({
              content: beforeText,
              title: `${baseTitle} (Part 1)`,
              word_count: beforeText.split(/\s+/).length,
            })
            .eq('id', chunk.id),

          supabase
            .from('source_chunks')
            .insert({
              source_file_id: sourceFileId,
              organization_id: sourceFile?.organization_id,
              chunk_index: originalIndex + 1,
              content: afterText,
              title: `${baseTitle} (Part 2)`,
              word_count: afterText.split(/\s+/).length,
              chunk_type: chunk.chunk_type,
              content_class: chunk.content_class,
              content_class_confidence: chunk.content_class_confidence,
              is_extractable: chunk.is_extractable,
              extraction_status: 'pending',
              key_terms: [],
              hierarchy_level: chunk.hierarchy_level,
            })
            .select()
            .single(),
        ]);

        if (updateResult.error) {
          console.error('[Blade Split] Update error:', updateResult.error);
        }
        if (insertResult.error) {
          console.error('[Blade Split] Insert error:', insertResult.error);
        }

        // Update the optimistic chunk ID with the real one from DB
        if (insertResult.data) {
          const realId = insertResult.data.id;
          console.log('[Blade Split] New chunk created with ID:', realId);
          setChunks(prevChunks =>
            prevChunks.map(c =>
              c.id === newChunkId ? { ...c, id: realId } : c
            )
          );
          // Also update expanded chunks set with real ID
          setExpandedChunks(prev => {
            const next = new Set(prev);
            if (next.has(newChunkId)) {
              next.delete(newChunkId);
              next.add(realId);
            }
            return next;
          });
        }

        // Update chunk_count on source file
        await supabase
          .from('source_files')
          .update({ chunk_count: chunks.length + 1 })
          .eq('id', sourceFileId);

        console.log('[Blade Split] DB sync complete');

      } catch (error: any) {
        // Log error but don't refresh - UI state is still valid
        console.error('[Blade Split] DB sync error:', error);
        // Only show toast, don't reload - optimistic UI is fine
        toast.error('Background sync had issues', {
          description: 'Your changes are saved locally. Refresh if you see issues.',
          duration: 3000
        });
      }
    })();

    // Set splitting false immediately after optimistic update
    setSplitting(false);
  }

  // Create role from Job Description chunk
  async function createRoleFromChunk(chunk: ChunkWithMeta) {
    let entityId = chunk.entity?.id;

    // If no entity exists, extract JD data first
    if (!entityId) {
      setProcessing(true);
      setProcessingStep('Extracting job description data...');

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const serverUrl = getServerUrl();

        // Call extract-jd endpoint to create entity from chunk
        const response = await fetch(`${serverUrl}/extract-jd`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({
            source_chunk_id: chunk.id,
            source_file_id: sourceFileId,
            content: chunk.content,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to extract job description');
        }

        const data = await response.json();
        entityId = data.entity_id;

        // Reload chunks to get the new entity
        await loadChunks();

      } catch (error: any) {
        console.error('JD extraction error:', error);
        toast.error('Failed to extract job description', { description: error.message });
        setProcessing(false);
        setProcessingStep('');
        return;
      }

      setProcessing(false);
      setProcessingStep('');
    }

    // Open the entity processor modal
    if (entityId) {
      setSelectedEntityId(entityId);
      setShowEntityProcessor(true);
    }
  }

  // View linked role
  function viewLinkedRole(roleId: string) {
    if (onViewRole) {
      onViewRole(roleId);
    } else {
      toast.info('Role view not available in this context');
    }
  }

  // Create content (track) from chunk - opens ChunkToTrackGenerator
  function handleCreateContent(chunk: ChunkWithMeta) {
    setChunksForTrackGeneration([chunk]);
    setShowTrackGenerator(true);
  }

  // Handle track generation completion
  function handleTrackGenerationComplete(tracks?: any[]) {
    setShowTrackGenerator(false);
    setChunksForTrackGeneration([]);
    // Reload chunks to show the new linked tracks
    loadChunks();

    const trackName = tracks?.[0]?.title || 'Training content';
    toast.success('Track created', {
      description: trackName,
      action: tracks?.[0] ? {
        label: 'View',
        onClick: () => window.open(`/?track=${tracks[0].track_id || tracks[0].id}&type=article`, '_blank')
      } : undefined
    });
  }

  // Computed values
  const filteredChunks = filterType === 'all'
    ? chunks
    : chunks.filter(c => c.content_class === filterType);

  const contentTypeSummary: ContentTypeSummary[] = Object.keys(CONTENT_TYPES).map(type => ({
    type: type as ContentType,
    count: chunks.filter(c => c.content_class === type).length,
  })).filter(s => s.count > 0);

  const totalLinkedContent = chunks.reduce((acc, c) => acc + c.linkedContent.length, 0);

  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-20 w-full" />
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!sourceFile) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Document not found</h2>
          <Button variant="outline" className="mt-4" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sources
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sources
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={fileNameInputRef}
                    type="text"
                    value={editedFileName}
                    onChange={(e) => setEditedFileName(e.target.value)}
                    onKeyDown={handleNameKeyDown}
                    onBlur={() => {
                      // Small delay to allow click on save button
                      setTimeout(() => {
                        if (isEditingName && !savingName) cancelEditingName();
                      }, 150);
                    }}
                    className="text-lg font-semibold bg-transparent border-b-2 border-primary outline-none px-1 min-w-[200px]"
                    disabled={savingName}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={saveFileName}
                    disabled={savingName || !editedFileName.trim()}
                    className="h-7 w-7 p-0"
                  >
                    {savingName ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={cancelEditingName}
                    disabled={savingName}
                    className="h-7 w-7 p-0"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ) : (
                <h1
                  className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors"
                  onClick={startEditingName}
                  title="Click to rename"
                >
                  {sourceFile.file_name}
                </h1>
              )}
              <p className="text-sm text-muted-foreground">
                {sourceFile.is_chunked
                  ? `${chunks.length} chunks identified`
                  : 'Not processed yet'}
              </p>
            </div>
          </div>
          {!sourceFile.is_chunked && (
            <Button
              onClick={processDocument}
              disabled={processing}
              className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {processingStep || 'Processing...'}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Process Document
                </>
              )}
            </Button>
          )}
          {sourceFile.is_chunked && chunks.length > 0 && onStartPlaybook && (
            <Button
              onClick={() => onStartPlaybook(sourceFileId)}
              className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white hover:opacity-90"
            >
              <Zap className="h-4 w-4 mr-2" />
              Build Playbook
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Summary bar */}
        {chunks.length > 0 && (
          <div className="mb-6 space-y-4">
            {/* Content type pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('all')}
              >
                All ({chunks.length})
              </Button>
              {contentTypeSummary.map(({ type, count }) => {
                const config = CONTENT_TYPES[type];
                const Icon = config.icon;
                return (
                  <Button
                    key={type}
                    variant={filterType === type ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterType(type)}
                    className={cn(
                      filterType === type && config.bgColor
                    )}
                  >
                    <Icon className="h-3 w-3 mr-1" />
                    {config.label} ({count})
                  </Button>
                );
              })}
            </div>

          </div>
        )}

        {/* Chunks list - Notion-style */}
        {chunks.length === 0 && sourceFile.is_chunked === false ? (
          <div className="text-center py-16">
            <Layers className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Ready to process</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Click "Process Document" to extract text, identify sections, and classify content types.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredChunks.map((chunk, index) => (
              <ChunkBlock
                key={chunk.id}
                chunk={chunk}
                isSelected={selectedChunks.has(chunk.id)}
                isExpanded={expandedChunks.has(chunk.id)}
                isHovered={hoveredChunk === chunk.id}
                isDragging={draggedChunkId === chunk.id}
                isDropTarget={dropTargetChunkId === chunk.id && draggedChunkId !== chunk.id}
                onToggleSelect={() => toggleChunkSelection(chunk.id)}
                onToggleExpand={() => toggleChunkExpansion(chunk.id)}
                onHover={(hovered) => setHoveredChunk(hovered ? chunk.id : null)}
                onClassificationChange={(newClass) => updateChunkClassification(chunk.id, newClass)}
                onCreateRole={() => createRoleFromChunk(chunk)}
                onCreateContent={() => handleCreateContent(chunk)}
                onViewRole={(roleId) => viewLinkedRole(roleId)}
                onDragStart={() => setDraggedChunkId(chunk.id)}
                onDragEnd={() => {
                  setDraggedChunkId(null);
                  setDropTargetChunkId(null);
                }}
                onDragOver={() => {
                  if (draggedChunkId && draggedChunkId !== chunk.id) {
                    setDropTargetChunkId(chunk.id);
                  }
                }}
                onDragLeave={() => {
                  if (dropTargetChunkId === chunk.id) {
                    setDropTargetChunkId(null);
                  }
                }}
                onDrop={() => {
                  if (draggedChunkId && draggedChunkId !== chunk.id) {
                    mergeTwoChunks(draggedChunkId, chunk.id);
                  }
                  setDraggedChunkId(null);
                  setDropTargetChunkId(null);
                }}
                // Blade mode split functionality
                bladeMode={bladeMode}
                onBladeClick={handleBladeClick}
                splitting={splitting}
                // Title rename functionality
                onRenameTitle={renameChunkTitle}
              />
            ))}
          </div>
        )}
      </div>

      {/* Track Generator Modal */}
      {showTrackGenerator && chunksForTrackGeneration.length > 0 && sourceFile && (
        <ChunkToTrackGenerator
          isOpen={showTrackGenerator}
          onClose={() => {
            setShowTrackGenerator(false);
            setChunksForTrackGeneration([]);
          }}
          selectedChunks={chunksForTrackGeneration.map(c => ({
            id: c.id,
            chunk_index: c.chunk_index,
            title: c.title || `Chunk ${c.chunk_index + 1}`,
            summary: c.summary || undefined,
            word_count: c.word_count,
            chunk_type: c.content_class,
          }))}
          sourceFileName={sourceFile.file_name}
          onTracksGenerated={(tracks) => {
            handleTrackGenerationComplete(tracks);
          }}
        />
      )}

      {/* Entity Processor Modal (JD to Role flow) */}
      {showEntityProcessor && selectedEntityId && (
        <ExtractedEntityProcessor
          isOpen={showEntityProcessor}
          onClose={() => {
            setShowEntityProcessor(false);
            setSelectedEntityId(null);
          }}
          entityId={selectedEntityId}
          onProcessComplete={(createdRoleId?: string) => {
            setShowEntityProcessor(false);
            setSelectedEntityId(null);
            loadChunks(); // Reload to show the linked role

            // Navigate to the role edit page if a role was created/merged
            if (createdRoleId) {
              // Build the role edit URL
              const { origin, pathname } = window.location;
              const rolesUrl = `${origin}/roles/${createdRoleId}`;
              window.location.href = rolesUrl;
            }
          }}
        />
      )}

      {/* Floating Selection Toolbar */}
      {selectedChunks.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center gap-1 px-2 py-2 bg-zinc-900 dark:bg-zinc-800 rounded-full shadow-2xl border border-zinc-700/50 backdrop-blur-xl">
            {/* Selection count */}
            <div className="flex items-center gap-2 px-3 py-1">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold">
                {selectedChunks.size}
              </div>
              <span className="text-sm text-zinc-300 font-medium">selected</span>
            </div>

            <div className="w-px h-6 bg-zinc-700" />

            {/* Merge button */}
            <button
              onClick={mergeSelectedChunks}
              disabled={merging || selectedChunks.size < 2}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                selectedChunks.size >= 2
                  ? "bg-zinc-700 hover:bg-zinc-600 text-white"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              )}
            >
              {merging ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Merge className="h-4 w-4" />
              )}
              Merge
            </button>

            {/* Create Track button - only for training/procedure/policy */}
            {Array.from(selectedChunks).every(id => {
              const chunk = chunks.find(c => c.id === id);
              return chunk && ['training_materials', 'procedure', 'policy'].includes(chunk.content_class);
            }) && (
              <button
                onClick={() => {
                  const selected = chunks.filter(c => selectedChunks.has(c.id));
                  setChunksForTrackGeneration(selected);
                  setShowTrackGenerator(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white transition-all"
              >
                <Zap className="h-4 w-4" />
                Create Track
              </button>
            )}

            <div className="w-px h-6 bg-zinc-700" />

            {/* Clear button */}
            <button
              onClick={clearSelection}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Blade Mode Indicator */}
      {bladeMode && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-200">
          <div className="flex items-center gap-3 px-4 py-2.5 bg-orange-500 text-white rounded-full shadow-lg">
            <Scissors className="h-5 w-5" />
            <span className="font-medium">Blade Mode</span>
            <span className="text-orange-100 text-sm">Press B or Esc to exit</span>
            <button
              onClick={() => setBladeMode(false)}
              className="ml-2 p-1 rounded-full hover:bg-orange-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Processing Overlay - for JD extraction */}
      {processing && processingStep && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-card border shadow-2xl">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
              <div className="absolute -inset-2 rounded-full border-2 border-orange-500/30 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium">{processingStep}</p>
              <p className="text-sm text-muted-foreground mt-1">This may take a moment...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Chunk Block Component - Notion-style synced block
interface ChunkBlockProps {
  chunk: ChunkWithMeta;
  isSelected: boolean;
  isExpanded: boolean;
  isHovered: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onHover: (hovered: boolean) => void;
  onClassificationChange: (newClass: ContentType) => void;
  onCreateRole: () => void;
  onCreateContent: () => void;
  onViewRole: (roleId: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  // Blade mode split functionality
  bladeMode: boolean;
  onBladeClick: (chunkId: string, event: React.MouseEvent<HTMLDivElement>) => void;
  splitting: boolean;
  // Title rename
  onRenameTitle: (chunkId: string, newTitle: string) => void;
}

function ChunkBlock({
  chunk,
  isSelected,
  isExpanded,
  isHovered,
  isDragging,
  isDropTarget,
  onToggleSelect,
  onToggleExpand,
  onHover,
  onClassificationChange,
  onCreateRole,
  onCreateContent,
  onViewRole,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  bladeMode,
  onBladeClick,
  splitting,
  onRenameTitle,
}: ChunkBlockProps) {
  const config = CONTENT_TYPES[chunk.content_class] || CONTENT_TYPES.other;
  const Icon = config.icon;
  const linkedRole = chunk.linkedContent.find(c => c.type === 'role');
  const linkedTracks = chunk.linkedContent.filter(c => c.type === 'track');
  const contentRef = useRef<HTMLDivElement>(null);

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(chunk.title || '');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedTitle(chunk.title || '');
    setIsEditingTitle(true);
  };

  const handleTitleSave = () => {
    const trimmedTitle = editedTitle.trim();
    if (trimmedTitle && trimmedTitle !== chunk.title) {
      onRenameTitle(chunk.id, trimmedTitle);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setEditedTitle(chunk.title || '');
      setIsEditingTitle(false);
    }
  };

  return (
    <div
      className={cn(
        "group relative flex gap-3 transition-all",
        isDragging && "opacity-50 scale-[0.98]",
        isDropTarget && "ring-2 ring-orange-500 ring-offset-2 rounded-lg",
        bladeMode && "ring-1 ring-orange-400/50" // Subtle highlight in blade mode
      )}
      draggable={!bladeMode} // Disable drag in blade mode
      onDragStart={(e) => {
        if (bladeMode) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        if (bladeMode) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        if (bladeMode) return;
        e.preventDefault();
        onDrop();
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {/* Drag handle + Checkbox - hidden in blade mode */}
      <div className={cn("pt-4 flex items-start gap-1", bladeMode && "opacity-30 pointer-events-none")}>
        <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors">
          <GripVertical className="h-5 w-5" />
        </div>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
        />
      </div>

      {/* Main chunk card - clickable for selection */}
      <div
        id={`chunk-${chunk.id}`}
        className={cn(
          "flex-1 rounded-lg border-l-4 bg-card transition-all cursor-pointer",
          config.color,
          isSelected && "ring-2 ring-orange-500 bg-orange-50/50 dark:bg-orange-950/20",
          "hover:shadow-md"
        )}
        onClick={(e) => {
          // In blade mode, don't toggle selection - let content area handle clicks
          if (bladeMode) return;
          // Don't toggle selection if clicking on interactive elements
          const target = e.target as HTMLElement;
          if (target.closest('button') || target.closest('[role="menuitem"]') || target.closest('a')) {
            return;
          }
          onToggleSelect();
        }}
      >
        {/* Header - click to expand/collapse (disabled in blade mode since all content is shown) */}
        <div
          className={cn(
            "flex items-center justify-between px-4 py-2",
            !bladeMode && "cursor-pointer"
          )}
          onClick={(e) => {
            if (bladeMode) return; // In blade mode, content is always visible
            e.stopPropagation(); // Prevent card click handler from firing
            onToggleExpand();
          }}
        >
          <div className="flex items-center gap-2">
            {/* Type badge with dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
                    config.bgColor,
                    "hover:opacity-80"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Icon className="h-3 w-3" />
                  {config.label}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {Object.entries(CONTENT_TYPES).map(([type, typeConfig]) => {
                  const TypeIcon = typeConfig.icon;
                  return (
                    <DropdownMenuItem
                      key={type}
                      onClick={() => onClassificationChange(type as ContentType)}
                    >
                      <TypeIcon className="h-4 w-4 mr-2" />
                      {typeConfig.label}
                      {type === chunk.content_class && (
                        <Check className="h-4 w-4 ml-auto" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* JD: Show detected role name */}
            {chunk.content_class === 'job_description' && chunk.detected_role_name && (
              <Badge variant="outline" className="text-xs">
                {chunk.detected_role_name}
              </Badge>
            )}

            {/* Title - double-click to edit */}
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-medium bg-transparent border-b border-orange-400 outline-none px-1 py-0.5 min-w-[100px] text-foreground"
                placeholder="Enter title..."
              />
            ) : (
              <span
                className="text-sm font-medium text-muted-foreground hover:text-foreground cursor-text transition-colors"
                onDoubleClick={handleTitleDoubleClick}
                title="Double-click to rename"
              >
                {chunk.title || 'Untitled'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{chunk.word_count} words</span>
            {chunk.content_class_confidence && (
              <span className="opacity-50">
                {Math.round(chunk.content_class_confidence * 100)}% conf
              </span>
            )}
          </div>
        </div>

        {/* Content - always show in blade mode, otherwise respect isExpanded */}
        {(isExpanded || bladeMode) && (
          <div className="px-4 pb-4 relative">
            {/* Content area - blade mode enables click-to-split */}
            <div
              ref={contentRef}
              className={cn(
                "prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap relative",
                bladeMode && "cursor-text hover:bg-orange-50/50 dark:hover:bg-orange-900/20 transition-colors rounded p-2 -m-2 border-2 border-dashed border-transparent hover:border-orange-400/50",
                splitting && "opacity-50 pointer-events-none"
              )}
              onClick={(e) => {
                if (bladeMode && !splitting) {
                  e.stopPropagation();
                  onBladeClick(chunk.id, e);
                }
              }}
            >
              {chunk.content}
            </div>

            {/* Key terms */}
            {chunk.key_terms && chunk.key_terms.length > 0 && (
              <div className="mt-3 flex items-center gap-1 flex-wrap">
                {chunk.key_terms.slice(0, 5).map((term, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {term}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Margin sidebar - connected content */}
      <div
        className={cn(
          "w-48 pt-2 transition-opacity flex-shrink-0",
          isHovered || chunk.linkedContent.length > 0 ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="text-sm space-y-2">
          {/* Linked role (for Job Descriptions) */}
          {linkedRole ? (
            <button
              onClick={() => onViewRole(linkedRole.id)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors max-w-full"
            >
              <Briefcase className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{linkedRole.name}</span>
            </button>
          ) : chunk.content_class === 'job_description' ? (
            <button
              onClick={onCreateRole}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Role</span>
            </button>
          ) : null}

          {/* Linked tracks */}
          {linkedTracks.length > 0 ? (
            <div className="space-y-1.5">
              {linkedTracks.map(track => (
                <button
                  key={track.id}
                  onClick={() => window.open(`/?track=${track.id}&type=article`, '_blank')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors max-w-full"
                >
                  <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{track.name}</span>
                </button>
              ))}
            </div>
          ) : chunk.content_class !== 'job_description' && chunk.content_class !== 'other' ? (
            <button
              onClick={onCreateContent}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Content</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default DocumentIntelligenceEditor;
