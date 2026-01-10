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
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { supabase, supabaseAnonKey } from '../lib/supabase';
import { getServerUrl } from '../utils/supabase/info';

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
    metadata: any;
    created_at: string;
  } | null;
  onSourceTypeChange?: (newType: string) => void;
}

type SourceType = 'handbook' | 'policy' | 'procedures' | 'communications' | 'training_docs' | 'other';

const SOURCE_TYPE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: 'handbook', label: 'Handbook' },
  { value: 'policy', label: 'Policy' },
  { value: 'procedures', label: 'Procedures' },
  { value: 'communications', label: 'Communications' },
  { value: 'training_docs', label: 'Training Docs' },
  { value: 'other', label: 'Other' },
];

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
        <div className="flex-1 min-h-0 overflow-hidden">
          {sourceFile.extracted_text ? (
            <ScrollArea className="h-[400px] pr-4">
              <div className="py-4">
                {renderExtractedText(sourceFile.extracted_text)}
              </div>
            </ScrollArea>
          ) : (
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-center space-y-3">
                <AlertCircle className="h-12 w-12 text-muted-foreground/50 mx-auto" />
                <div>
                  <p className="font-medium text-foreground">Not yet processed</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This file has not been processed yet. Extract text to see the content preview.
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
