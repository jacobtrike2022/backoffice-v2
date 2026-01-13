import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  File,
  Loader2,
  Zap,
  Clock,
  FileType,
  Calendar,
  HardDrive,
  Check,
  AlertCircle,
  Scissors,
  ChevronDown,
  ChevronRight,
  Layers,
  Briefcase,
  SkipForward,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase, supabaseAnonKey } from '../lib/supabase';
import { getServerUrl } from '../utils/supabase/info';
import { ChunkToTrackGenerator } from './ChunkToTrackGenerator';
import { ExtractedEntityProcessor } from './ExtractedEntityProcessor';

interface SourceFilePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  sourceFile: {
    id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    source_type: string | null;
    extracted_text: string | null;
    is_processed: boolean;
    processed_at: string | null;
    is_chunked?: boolean;
    chunked_at?: string | null;
    chunk_count?: number;
    metadata: any;
    created_at: string;
  } | null;
  onSourceTypeChange?: (newType: string) => void;
}

type SourceType = 'handbook' | 'policy' | 'procedures' | 'job_description' | 'communications' | 'training_docs' | 'other';

const SOURCE_TYPE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: 'handbook', label: 'Handbook' },
  { value: 'policy', label: 'Policy' },
  { value: 'procedures', label: 'Procedures' },
  { value: 'job_description', label: 'Job Description' },
  { value: 'communications', label: 'Communications' },
  { value: 'training_docs', label: 'Training Docs' },
  { value: 'other', label: 'Other' },
];

interface ExtractedEntity {
  id: string;
  entity_type: string;
  entity_status: 'pending' | 'processing' | 'completed' | 'skipped' | 'failed';
  extracted_data: {
    role_name?: string;
    department?: string;
    [key: string]: any;
  };
  extraction_confidence: number | null;
  source_chunk_id: string | null;
  onet_suggestions: any[];
  created_at: string;
}

export function SourceFilePreview({
  isOpen,
  onClose,
  sourceFile,
  onSourceTypeChange,
}: SourceFilePreviewProps) {
  const [detecting, setDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<{
    detected_type: string;
    confidence: number;
    reasoning: string;
    alternative_type?: string;
    alternative_confidence?: number;
  } | null>(null);
  const [chunking, setChunking] = useState(false);
  const [chunks, setChunks] = useState<any[] | null>(null);
  const [showChunks, setShowChunks] = useState(false);
  const [selectedChunkIds, setSelectedChunkIds] = useState<Set<string>>(new Set());
  const [showGenerator, setShowGenerator] = useState(false);

  // Extracted entities state
  const [extractedEntities, setExtractedEntities] = useState<ExtractedEntity[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [showEntities, setShowEntities] = useState(false);
  const [processingEntityId, setProcessingEntityId] = useState<string | null>(null);
  const [showEntityProcessor, setShowEntityProcessor] = useState(false);
  const [selectedEntityForProcessing, setSelectedEntityForProcessing] = useState<string | null>(null);

  const toggleChunkSelection = (chunkId: string) => {
    setSelectedChunkIds(prev => {
      const next = new Set(prev);
      if (next.has(chunkId)) {
        next.delete(chunkId);
      } else {
        next.add(chunkId);
      }
      return next;
    });
  };

  const selectAllChunks = () => {
    if (chunks) {
      setSelectedChunkIds(new Set(chunks.map(c => c.id)));
    }
  };

  const clearSelection = () => {
    setSelectedChunkIds(new Set());
  };

  const handleTracksGenerated = (tracks: any[]) => {
    // Refresh chunks to show converted status
    loadExistingChunks();
    clearSelection();
  };

  const handleGenerateChunks = async () => {
    if (!sourceFile?.extracted_text) {
      toast.error('No extracted text available', {
        description: 'Please extract text from the file first.'
      });
      return;
    }

    setChunking(true);
    setChunks(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/chunk-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ source_file_id: sourceFile.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Chunking failed');
      }

      // Fetch full chunks
      const chunksResponse = await fetch(`${serverUrl}/chunks/${sourceFile.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
      });

      const chunksData = await chunksResponse.json();
      setChunks(chunksData.chunks || []);
      setShowChunks(true);

      toast.success(`Generated ${data.chunk_count} chunks`, {
        description: `Processed in ${data.processing_time_ms}ms`
      });
    } catch (error: any) {
      console.error('Chunking error:', error);
      toast.error('Chunking failed', {
        description: error.message
      });
    } finally {
      setChunking(false);
    }
  };

  const loadExistingChunks = async () => {
    if (!sourceFile?.id) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/chunks/${sourceFile.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
      });

      const data = await response.json();
      if (data.chunks && data.chunks.length > 0) {
        setChunks(data.chunks);
      }
    } catch (error) {
      console.error('Failed to load chunks:', error);
    }
  };

  // Load extracted entities for this file
  const loadExtractedEntities = async () => {
    if (!sourceFile?.id) return;

    setLoadingEntities(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/extracted-entities/${sourceFile.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
      });

      const data = await response.json();
      if (data.entities) {
        setExtractedEntities(data.entities);
        // Auto-show if there are pending entities
        if (data.entities.some((e: ExtractedEntity) => e.entity_status === 'pending')) {
          setShowEntities(true);
        }
      }
    } catch (error) {
      console.error('Failed to load extracted entities:', error);
    } finally {
      setLoadingEntities(false);
    }
  };

  // Process an extracted entity (extract_jd or skip)
  const handleProcessEntity = async (entityId: string, action: 'extract_jd' | 'skip') => {
    setProcessingEntityId(entityId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/process-extracted-entity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ entity_id: entityId, action }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Processing failed');
      }

      if (action === 'skip') {
        toast.success('Entity skipped');
      } else {
        toast.success('Job description extracted', {
          description: data.extracted_data?.role_name || 'Processing complete'
        });
      }

      // Reload entities to get updated status
      await loadExtractedEntities();
    } catch (error: any) {
      console.error('Entity processing error:', error);
      toast.error('Processing failed', { description: error.message });
    } finally {
      setProcessingEntityId(null);
    }
  };

  // Load existing chunks when modal opens
  React.useEffect(() => {
    if (isOpen && sourceFile?.id) {
      loadExistingChunks();
      loadExtractedEntities();
    }
  }, [isOpen, sourceFile?.id]);

  if (!sourceFile) return null;

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (fileType.includes('word') || fileType.includes('document')) return <FileText className="h-5 w-5 text-blue-500" />;
    if (fileType.includes('excel') || fileType.includes('spreadsheet') || fileType.includes('csv')) return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return <Presentation className="h-5 w-5 text-orange-500" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const getFileTypeBadge = (fileType: string) => {
    if (fileType.includes('pdf')) return 'PDF';
    if (fileType.includes('word') || fileType.includes('document')) return 'DOCX';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'XLSX';
    if (fileType.includes('csv')) return 'CSV';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'PPTX';
    if (fileType.includes('text/plain')) return 'TXT';
    return 'FILE';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDetectType = async () => {
    if (!sourceFile.extracted_text) {
      toast.error('No extracted text available', {
        description: 'Please extract text from the file first before detecting document type.'
      });
      return;
    }

    setDetecting(true);
    setDetectionResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/detect-document-type`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ source_file_id: sourceFile.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Detection failed');
      }

      setDetectionResult(data);

      // Auto-select type if confidence > 80%
      if (data.confidence > 0.8 && onSourceTypeChange) {
        onSourceTypeChange(data.detected_type);
        toast.success(`Document type detected: ${data.detected_type}`, {
          description: `${Math.round(data.confidence * 100)}% confidence`
        });
      }
    } catch (error: any) {
      console.error('Detection error:', error);
      toast.error('Detection failed', {
        description: error.message
      });
    } finally {
      setDetecting(false);
    }
  };

  // Simple markdown renderer for extracted text
  const renderExtractedText = (text: string) => {
    // Split into lines and process
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: string[] = [];
    let listKey = 0;

    const processInline = (line: string): React.ReactNode => {
      // Process bold text
      const parts: React.ReactNode[] = [];
      let remaining = line;
      let partKey = 0;

      while (remaining.length > 0) {
        const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);

        if (!boldMatch) {
          parts.push(remaining);
          break;
        }

        const index = remaining.indexOf(boldMatch[0]);
        if (index > 0) {
          parts.push(remaining.slice(0, index));
        }

        parts.push(<strong key={`bold-${partKey++}`} className="font-semibold">{boldMatch[1]}</strong>);
        remaining = remaining.slice(index + boldMatch[0].length);
      }

      return parts.length === 1 ? parts[0] : <>{parts}</>;
    };

    const flushList = () => {
      if (currentList.length > 0) {
        elements.push(
          <ul key={`list-${listKey++}`} className="list-disc list-inside space-y-1 my-2 ml-4">
            {currentList.map((item, i) => (
              <li key={i} className="text-sm text-foreground/90">{processInline(item)}</li>
            ))}
          </ul>
        );
        currentList = [];
      }
    };

    lines.forEach((line, i) => {
      const trimmedLine = line.trim();

      // Headers (## or ###)
      if (trimmedLine.startsWith('### ')) {
        flushList();
        elements.push(
          <h4 key={`h4-${i}`} className="font-semibold text-sm mt-4 mb-2 text-foreground">
            {processInline(trimmedLine.slice(4))}
          </h4>
        );
      } else if (trimmedLine.startsWith('## ')) {
        flushList();
        elements.push(
          <h3 key={`h3-${i}`} className="font-bold text-base mt-5 mb-2 text-foreground border-b border-border pb-1">
            {processInline(trimmedLine.slice(3))}
          </h3>
        );
      } else if (trimmedLine.startsWith('# ')) {
        flushList();
        elements.push(
          <h2 key={`h2-${i}`} className="font-bold text-lg mt-6 mb-3 text-foreground">
            {processInline(trimmedLine.slice(2))}
          </h2>
        );
      }
      // List item
      else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ') || trimmedLine.startsWith('* ')) {
        currentList.push(trimmedLine.slice(2));
      }
      // Numbered list
      else if (/^\d+\.\s/.test(trimmedLine)) {
        currentList.push(trimmedLine.replace(/^\d+\.\s/, ''));
      }
      // Empty line
      else if (trimmedLine === '') {
        flushList();
        elements.push(<div key={`br-${i}`} className="h-2" />);
      }
      // Regular paragraph
      else {
        flushList();
        elements.push(
          <p key={`p-${i}`} className="text-sm leading-relaxed text-foreground/90">
            {processInline(line)}
          </p>
        );
      }
    });

    flushList();
    return <div className="space-y-1">{elements}</div>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-4xl w-full max-h-[90vh] flex flex-col"
        style={{ width: '90vw', maxWidth: '900px' }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            {getFileIcon(sourceFile.file_type)}
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg truncate" title={sourceFile.file_name}>
                {sourceFile.file_name}
              </DialogTitle>
            </div>
            <Badge variant="outline" className="shrink-0">
              {getFileTypeBadge(sourceFile.file_type)}
            </Badge>
          </div>
          <DialogDescription className="sr-only">
            Preview and manage source file: {sourceFile.file_name}
          </DialogDescription>
        </DialogHeader>

        {/* Metadata Bar */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground py-2 border-b">
          <div className="flex items-center gap-1.5">
            <HardDrive className="h-4 w-4" />
            <span>{formatFileSize(sourceFile.file_size)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>Uploaded {formatDate(sourceFile.created_at)}</span>
          </div>
          {sourceFile.metadata?.processing_time_ms && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>Processed in {sourceFile.metadata.processing_time_ms}ms</span>
            </div>
          )}
          {sourceFile.metadata?.word_count && (
            <div className="flex items-center gap-1.5">
              <FileType className="h-4 w-4" />
              <span>{sourceFile.metadata.word_count.toLocaleString()} words</span>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div
          className="border rounded-md bg-muted/20 my-4"
          style={{ height: '400px', overflowY: 'auto' }}
        >
          {sourceFile.extracted_text ? (
            <div className="p-4">
              {renderExtractedText(sourceFile.extracted_text)}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-3">
                <AlertCircle className="h-12 w-12 text-muted-foreground/50 mx-auto" />
                <div>
                  <p className="font-medium text-foreground">Not yet processed</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Extract text to see the content preview.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Document Type Section */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Document Type:</span>
              <Select
                value={sourceFile.source_type || ''}
                onValueChange={(value) => onSourceTypeChange?.(value)}
              >
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDetectType}
              disabled={detecting || !sourceFile.extracted_text}
            >
              {detecting ? (
                <>
                  <Zap className="h-4 w-4 mr-2 text-[#F74A05] animate-pulse" />
                  Detecting...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Detect Type
                </>
              )}
            </Button>
          </div>

          {/* Detection Result */}
          {detectionResult && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="font-medium capitalize">{detectionResult.detected_type}</span>
                <Badge variant="secondary" className="ml-2">
                  {Math.round(detectionResult.confidence * 100)}% confident
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {detectionResult.reasoning}
              </p>
              {detectionResult.alternative_type && detectionResult.alternative_confidence && detectionResult.alternative_confidence > 0.1 && (
                <p className="text-xs text-muted-foreground">
                  Alternative: <span className="capitalize">{detectionResult.alternative_type}</span> ({Math.round(detectionResult.alternative_confidence * 100)}%)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Chunking Section */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Document Chunks</span>
              {chunks && chunks.length > 0 && (
                <Badge variant="secondary">{chunks.length} chunks</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {chunks && chunks.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowChunks(!showChunks)}
                >
                  {showChunks ? (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Hide
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-4 w-4 mr-1" />
                      Show
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateChunks}
                disabled={chunking || !sourceFile.extracted_text}
              >
                {chunking ? (
                  <>
                    <Scissors className="h-4 w-4 mr-2 animate-pulse text-[#F74A05]" />
                    Chunking...
                  </>
                ) : (
                  <>
                    <Scissors className="h-4 w-4 mr-2" />
                    {chunks && chunks.length > 0 ? 'Re-chunk' : 'Generate Chunks'}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Chunks List */}
          {showChunks && chunks && chunks.length > 0 && (
            <div className="space-y-2">
              {/* Selection controls */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {selectedChunkIds.size > 0
                      ? `${selectedChunkIds.size} selected`
                      : 'Select chunks to generate tracks'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedChunkIds.size > 0 && (
                    <>
                      <Button variant="ghost" size="sm" onClick={clearSelection}>
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setShowGenerator(true)}
                        className="bg-[#F74A05] hover:bg-[#F74A05]/90"
                      >
                        <Zap className="h-4 w-4 mr-1" />
                        Generate Tracks
                      </Button>
                    </>
                  )}
                  {selectedChunkIds.size === 0 && (
                    <Button variant="ghost" size="sm" onClick={selectAllChunks}>
                      Select All
                    </Button>
                  )}
                </div>
              </div>

              {/* Chunk items */}
              <div
                className="border rounded-md bg-muted/20"
                style={{ maxHeight: '300px', overflowY: 'auto' }}
              >
                <div className="divide-y">
                  {chunks.map((chunk, index) => (
                    <div
                      key={chunk.id || index}
                      className={`p-3 hover:bg-muted/30 transition-colors cursor-pointer ${
                        selectedChunkIds.has(chunk.id) ? 'bg-primary/10' : ''
                      }`}
                      onClick={() => toggleChunkSelection(chunk.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedChunkIds.has(chunk.id)}
                          onCheckedChange={() => toggleChunkSelection(chunk.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-mono">
                              #{chunk.chunk_index + 1}
                            </span>
                            <span className="font-medium text-sm truncate">
                              {chunk.title || `Chunk ${chunk.chunk_index + 1}`}
                            </span>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {chunk.chunk_type}
                            </Badge>
                            {chunk.is_converted && (
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                Converted
                              </Badge>
                            )}
                          </div>
                          {chunk.summary && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {chunk.summary}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span>{chunk.word_count} words</span>
                            <span>~{Math.ceil(chunk.estimated_read_time_seconds / 60)} min read</span>
                            {chunk.key_terms && chunk.key_terms.length > 0 && (
                              <span className="truncate">
                                {chunk.key_terms.slice(0, 3).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Detected Entities Section */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Detected Content</span>
              {extractedEntities.length > 0 && (
                <>
                  <Badge variant="secondary">{extractedEntities.length} detected</Badge>
                  {extractedEntities.filter(e => e.entity_status === 'pending').length > 0 && (
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                      {extractedEntities.filter(e => e.entity_status === 'pending').length} pending review
                    </Badge>
                  )}
                </>
              )}
              {loadingEntities && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center gap-2">
              {extractedEntities.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEntities(!showEntities)}
                >
                  {showEntities ? (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Hide
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-4 w-4 mr-1" />
                      Show
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={loadExtractedEntities}
                disabled={loadingEntities}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Entities List */}
          {showEntities && extractedEntities.length > 0 && (
            <div
              className="border rounded-md bg-muted/20"
              style={{ maxHeight: '250px', overflowY: 'auto' }}
            >
              <div className="divide-y">
                {extractedEntities.map((entity) => (
                  <div
                    key={entity.id}
                    className={`p-3 hover:bg-muted/30 transition-colors ${
                      entity.entity_status === 'pending' ? 'bg-amber-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={
                              entity.entity_type === 'job_description'
                                ? 'border-blue-500 text-blue-600'
                                : ''
                            }
                          >
                            {entity.entity_type === 'job_description' ? 'Job Description' : entity.entity_type}
                          </Badge>
                          <span className="font-medium text-sm">
                            {entity.extracted_data?.role_name || 'Unnamed Role'}
                          </span>
                          {entity.extracted_data?.department && (
                            <span className="text-xs text-muted-foreground">
                              ({entity.extracted_data.department})
                            </span>
                          )}
                          {entity.extraction_confidence && (
                            <Badge variant="secondary" className="text-xs">
                              {Math.round(entity.extraction_confidence * 100)}% confidence
                            </Badge>
                          )}
                          {entity.entity_status === 'completed' && (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                              <Check className="h-3 w-3 mr-1" />
                              Processed
                            </Badge>
                          )}
                          {entity.entity_status === 'skipped' && (
                            <Badge variant="secondary" className="text-xs">
                              Skipped
                            </Badge>
                          )}
                        </div>
                        {entity.onet_suggestions && entity.onet_suggestions.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            O*NET suggestions: {entity.onet_suggestions.slice(0, 2).map((s: any) => s.title).join(', ')}
                          </p>
                        )}
                      </div>
                      {entity.entity_status === 'pending' && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 bg-[#F74A05] hover:bg-[#F74A05]/90"
                            onClick={() => {
                              setSelectedEntityForProcessing(entity.id);
                              setShowEntityProcessor(true);
                            }}
                          >
                            <Zap className="h-4 w-4 mr-1" />
                            Process
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            onClick={() => handleProcessEntity(entity.id, 'skip')}
                            disabled={processingEntityId === entity.id}
                          >
                            <SkipForward className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {showEntities && extractedEntities.length === 0 && !loadingEntities && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No entities detected in this document.
              {chunks && chunks.length > 0 && (
                <span className="block mt-1">
                  Content is classified during chunking.
                </span>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>

        {/* Track Generator Modal */}
        <ChunkToTrackGenerator
          isOpen={showGenerator}
          onClose={() => setShowGenerator(false)}
          selectedChunks={chunks?.filter(c => selectedChunkIds.has(c.id)) || []}
          sourceFileName={sourceFile?.file_name || ''}
          onTracksGenerated={handleTracksGenerated}
        />

        {/* Extracted Entity Processor Modal */}
        {selectedEntityForProcessing && (
          <ExtractedEntityProcessor
            isOpen={showEntityProcessor}
            onClose={() => {
              setShowEntityProcessor(false);
              setSelectedEntityForProcessing(null);
            }}
            entityId={selectedEntityForProcessing}
            onProcessComplete={() => {
              loadExtractedEntities();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
