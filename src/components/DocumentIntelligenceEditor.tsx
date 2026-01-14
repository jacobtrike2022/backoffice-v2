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
}

export function DocumentIntelligenceEditor({
  sourceFileId,
  onBack,
  onViewRole,
  onCreateRole,
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

  // Track/Content generation state
  const [showTrackGenerator, setShowTrackGenerator] = useState(false);
  const [chunksForTrackGeneration, setChunksForTrackGeneration] = useState<ChunkWithMeta[]>([]);

  // Entity/Role processing state
  const [showEntityProcessor, setShowEntityProcessor] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Merge operation state
  const [merging, setMerging] = useState(false);

  // Load source file and chunks
  useEffect(() => {
    if (sourceFileId) {
      loadSourceFile();
    }
  }, [sourceFileId]);

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

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Merge content
      const mergedContent = sortedChunks.map(c => c.content).join('\n\n');
      const mergedTitle = sortedChunks[0].title || `Merged Section`;
      const primaryChunk = sortedChunks[0];

      // Update primary chunk with merged content
      await supabase
        .from('source_chunks')
        .update({
          content: mergedContent,
          title: mergedTitle,
          word_count: mergedContent.split(/\s+/).length,
        })
        .eq('id', primaryChunk.id);

      // Delete other chunks
      const chunksToDelete = sortedChunks.slice(1).map(c => c.id);
      await supabase
        .from('source_chunks')
        .delete()
        .in('id', chunksToDelete);

      // Reload chunks
      await loadChunks();
      clearSelection();
      toast.success(`Merged ${sortedChunks.length} chunks`);

    } catch (error: any) {
      toast.error('Failed to merge chunks', { description: error.message });
    } finally {
      setMerging(false);
    }
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
        <div className="max-w-5xl mx-auto space-y-6">
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
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sources
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-lg font-semibold">{sourceFile.file_name}</h1>
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
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-6">
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
                onToggleSelect={() => toggleChunkSelection(chunk.id)}
                onToggleExpand={() => toggleChunkExpansion(chunk.id)}
                onHover={(hovered) => setHoveredChunk(hovered ? chunk.id : null)}
                onClassificationChange={(newClass) => updateChunkClassification(chunk.id, newClass)}
                onCreateRole={() => createRoleFromChunk(chunk)}
                onCreateContent={() => handleCreateContent(chunk)}
                onViewRole={(roleId) => viewLinkedRole(roleId)}
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
          onProcessComplete={() => {
            setShowEntityProcessor(false);
            setSelectedEntityId(null);
            loadChunks(); // Reload to show the linked role
            toast.success('Role created successfully');
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
    </div>
  );
}

// Chunk Block Component - Notion-style synced block
interface ChunkBlockProps {
  chunk: ChunkWithMeta;
  isSelected: boolean;
  isExpanded: boolean;
  isHovered: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onHover: (hovered: boolean) => void;
  onClassificationChange: (newClass: ContentType) => void;
  onCreateRole: () => void;
  onCreateContent: () => void;
  onViewRole: (roleId: string) => void;
}

function ChunkBlock({
  chunk,
  isSelected,
  isExpanded,
  isHovered,
  onToggleSelect,
  onToggleExpand,
  onHover,
  onClassificationChange,
  onCreateRole,
  onCreateContent,
  onViewRole,
}: ChunkBlockProps) {
  const config = CONTENT_TYPES[chunk.content_class] || CONTENT_TYPES.other;
  const Icon = config.icon;
  const linkedRole = chunk.linkedContent.find(c => c.type === 'role');
  const linkedTracks = chunk.linkedContent.filter(c => c.type === 'track');

  return (
    <div
      className="group relative flex gap-3"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {/* Checkbox - visible when selected OR on hover */}
      <div className={cn(
        "pt-4 transition-opacity",
        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
        />
      </div>

      {/* Main chunk card - clickable for selection */}
      <div
        className={cn(
          "flex-1 rounded-lg border-l-4 bg-card transition-all cursor-pointer",
          config.color,
          isSelected && "ring-2 ring-orange-500 bg-orange-50/50 dark:bg-orange-950/20",
          "hover:shadow-md"
        )}
        onClick={(e) => {
          // Don't toggle selection if clicking on interactive elements
          const target = e.target as HTMLElement;
          if (target.closest('button') || target.closest('[role="menuitem"]') || target.closest('a')) {
            return;
          }
          onToggleSelect();
        }}
      >
        {/* Header - click to expand/collapse */}
        <div
          className="flex items-center justify-between px-4 py-2 cursor-pointer"
          onClick={(e) => {
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

            {/* Title if available */}
            {chunk.title && (
              <span className="text-sm font-medium text-muted-foreground">
                {chunk.title}
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

        {/* Content */}
        {isExpanded && (
          <div className="px-4 pb-4">
            <div className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap">
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
          "w-36 pt-2 transition-opacity",
          isHovered || chunk.linkedContent.length > 0 ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="text-xs space-y-2">
          {/* Linked role (for Job Descriptions) */}
          {linkedRole ? (
            <button
              onClick={() => onViewRole(linkedRole.id)}
              className="flex items-center gap-1 text-green-600 hover:underline"
            >
              <Briefcase className="h-3 w-3" />
              <span className="truncate">{linkedRole.name}</span>
            </button>
          ) : chunk.content_class === 'job_description' ? (
            <button
              onClick={onCreateRole}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              <span>Role</span>
            </button>
          ) : null}

          {/* Linked tracks */}
          {linkedTracks.length > 0 ? (
            <div className="space-y-1">
              {linkedTracks.map(track => (
                <button
                  key={track.id}
                  onClick={() => window.open(`/?track=${track.id}&type=article`, '_blank')}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                >
                  <BookOpen className="h-3 w-3" />
                  <span className="truncate max-w-[100px]">{track.name}</span>
                </button>
              ))}
            </div>
          ) : chunk.content_class !== 'job_description' && chunk.content_class !== 'other' ? (
            <button
              onClick={onCreateContent}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              <span>Content</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default DocumentIntelligenceEditor;
