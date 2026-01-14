import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  Presentation,
  File,
  Search,
  MoreVertical,
  Trash2,
  Download,
  ExternalLink,
  Check,
  X,
  Loader2,
  Zap,
  Layers,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { supabase, getCurrentUserOrgId, supabaseAnonKey } from '../lib/supabase';
import { uploadSourceFile } from '../lib/services/uploadService';
import { getServerUrl } from '../utils/supabase/info';

interface SourceFile {
  id: string;
  organization_id: string;
  file_name: string;
  storage_path: string;
  file_url: string;
  file_type: string;
  file_size: number;
  source_type: string | null;
  is_processed: boolean;
  processed_at: string | null;
  processing_error: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  extracted_text: string | null;
  metadata: any;
  is_chunked?: boolean;
  chunked_at?: string | null;
  chunk_count?: number;
  // Detected content type counts from chunks
  detected_entity_count?: number;
  pending_entity_count?: number;
  has_job_descriptions?: boolean;
}

// Content type configuration for pills (matches backend ContentClass types)
// - policy: Rules, expectations, standards
// - procedure: Step-by-step instructions
// - job_description: Role definitions
// - training_materials: Checklists, guides, OJT (catchall)
// - other: Miscellaneous
const CONTENT_TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  policy: { label: 'Policy', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  procedure: { label: 'Procedure', color: 'text-purple-700 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  job_description: { label: 'Job Description', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  training_materials: { label: 'Training', color: 'text-gray-700 dark:text-gray-400', bgColor: 'bg-gray-200 dark:bg-gray-700/50' },
  other: { label: 'Other', color: 'text-gray-700 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-900/30' },
};

interface ChunkContentSummary {
  source_file_id: string;
  content_class: string;
  count: number;
}


const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

const ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif';

interface SourcesManagementProps {
  onOpenEditor?: (sourceFileId: string) => void;
}

export function SourcesManagement({ onOpenEditor }: SourcesManagementProps) {
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [contentSummaries, setContentSummaries] = useState<Record<string, ChunkContentSummary[]>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [extracting, setExtracting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSourceFiles();
  }, []);

  const loadSourceFiles = async () => {
    try {
      setLoading(true);
      const orgId = await getCurrentUserOrgId();
      if (!orgId) {
        toast.error('Organization not found');
        return;
      }

      const { data, error } = await supabase
        .from('source_files')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSourceFiles(data || []);

      // Load content type summaries for chunked files
      const chunkedFileIds = (data || []).filter(f => f.is_chunked).map(f => f.id);
      if (chunkedFileIds.length > 0) {
        await loadContentSummaries(chunkedFileIds);
      }
    } catch (error: any) {
      console.error('Error loading source files:', error);
      toast.error('Failed to load source files');
    } finally {
      setLoading(false);
    }
  };

  // Load content type summaries from chunks
  const loadContentSummaries = async (fileIds: string[]) => {
    try {
      // Query chunks grouped by content_class for each file
      const { data: chunks, error } = await supabase
        .from('source_chunks')
        .select('source_file_id, content_class')
        .in('source_file_id', fileIds);

      if (error) throw error;

      // Group and count by file and content class
      const summaries: Record<string, ChunkContentSummary[]> = {};
      (chunks || []).forEach((chunk: { source_file_id: string; content_class: string }) => {
        if (!summaries[chunk.source_file_id]) {
          summaries[chunk.source_file_id] = [];
        }
        const existing = summaries[chunk.source_file_id].find(s => s.content_class === chunk.content_class);
        if (existing) {
          existing.count++;
        } else {
          summaries[chunk.source_file_id].push({
            source_file_id: chunk.source_file_id,
            content_class: chunk.content_class || 'other',
            count: 1,
          });
        }
      });

      setContentSummaries(summaries);
    } catch (error: any) {
      console.error('Error loading content summaries:', error);
    }
  };

  const getSignedUrl = async (storagePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('source-files')
        .createSignedUrl(storagePath, 3600);

      if (error) throw error;
      return data.signedUrl;
    } catch (error: any) {
      console.error('Error creating signed URL:', error);
      toast.error('Failed to access file');
      return null;
    }
  };

  const handleViewFile = async (file: SourceFile) => {
    const signedUrl = await getSignedUrl(file.storage_path);
    if (signedUrl) {
      window.open(signedUrl, '_blank');
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const orgId = await getCurrentUserOrgId();
    if (!orgId) {
      toast.error('Organization not found');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        toast.error(`Invalid file type: ${file.name}`);
        continue;
      }

      // Validate file size (50MB max)
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`File too large: ${file.name} (max 50MB)`);
        continue;
      }

      try {
        // Upload using the reliable upload service
        const result = await uploadSourceFile(file, orgId, (progress) => {
          setUploadProgress(progress);
        });

        if (!result.success || !result.path || !result.signedUrl) {
          throw new Error(result.error || 'Upload failed');
        }

        // Insert record into database
        const { data: insertedFile, error: insertError } = await supabase
          .from('source_files')
          .insert({
            organization_id: orgId,
            file_name: file.name,
            storage_path: result.path,
            file_url: result.signedUrl,
            file_type: file.type,
            file_size: file.size,
          })
          .select('id')
          .single();

        if (insertError) {
          // Clean up storage if database insert fails
          await supabase.storage.from('source-files').remove([result.path]);
          throw insertError;
        }

        toast.success(`Uploaded: ${file.name}`);

        // Auto-trigger extraction for supported file types
        const extractableTypes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'text/csv'
        ];

        if (extractableTypes.includes(file.type) && insertedFile?.id) {
          triggerExtraction(insertedFile.id, file.name);
        }

      } catch (error: any) {
        console.error('Error uploading file:', error);
        toast.error(`Failed to upload: ${file.name}`, {
          description: error.message
        });
      }
    }

    setUploading(false);
    setUploadProgress(0);
    await loadSourceFiles();
  };

  const triggerExtraction = async (fileId: string, fileName: string) => {
    const toastId = toast.loading(`Processing ${fileName}...`);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.dismiss(toastId);
        return;
      }

      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/extract-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ source_file_id: fileId }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Extraction failed');
      }

      toast.dismiss(toastId);
      toast.success(`Extracted ${responseData.stats?.word_count?.toLocaleString() || 0} words from ${fileName}`);
      await loadSourceFiles();
    } catch (error: any) {
      toast.dismiss(toastId);
      toast.error(`Failed to process ${fileName}`, {
        description: error.message
      });
    }
  };

  const handleExtractSource = async (file: SourceFile) => {
    setExtracting(file.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/extract-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ source_file_id: file.id }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Extraction failed');
      }

      toast.success('Extraction completed!', {
        description: `${responseData.stats?.word_count || 0} words extracted`,
      });

      await loadSourceFiles();
    } catch (error: any) {
      console.error('Extract error:', error);
      toast.error('Extraction failed', { description: error.message });
    } finally {
      setExtracting(null);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  }, []);

  const handleUpdateSourceType = async (fileId: string, sourceType: SourceType) => {
    try {
      const { error } = await supabase
        .from('source_files')
        .update({ source_type: sourceType })
        .eq('id', fileId);

      if (error) throw error;

      setSourceFiles(prev =>
        prev.map(f => f.id === fileId ? { ...f, source_type: sourceType } : f)
      );
      toast.success('Source type updated');
    } catch (error: any) {
      console.error('Error updating source type:', error);
      toast.error('Failed to update source type');
    }
  };

  const handleDeleteFile = async (file: SourceFile) => {
    if (!confirm(`Delete "${file.file_name}"? This cannot be undone.`)) return;

    try {
      // Delete from storage
      await supabase.storage.from('source-files').remove([file.storage_path]);

      // Delete from database
      const { error: dbError } = await supabase
        .from('source_files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      setSourceFiles(prev => prev.filter(f => f.id !== file.id));
      toast.success('File deleted');
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
    }
  };

  const handleSourceTypeUpdate = async (fileId: string, newType: string) => {
    try {
      const { error } = await supabase
        .from('source_files')
        .update({ source_type: newType })
        .eq('id', fileId);

      if (error) throw error;

      setSourceFiles(prev =>
        prev.map(f => f.id === fileId ? { ...f, source_type: newType } : f)
      );

      toast.success('Source type updated');
    } catch (error: any) {
      console.error('Error updating source type:', error);
      toast.error('Failed to update source type');
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />;
    if (fileType.includes('word') || fileType.includes('document')) return <FileText className="h-4 w-4 text-blue-500" />;
    if (fileType.includes('excel') || fileType.includes('spreadsheet') || fileType.includes('csv')) return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return <Presentation className="h-4 w-4 text-orange-500" />;
    return <File className="h-4 w-4 text-gray-500" />;
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
    });
  };

  const filteredFiles = sourceFiles.filter(file =>
    file.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              Uploading... {uploadProgress}%
            </p>
            <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">Import Source Files</p>
              <p className="text-sm text-muted-foreground mt-1">
                Drag and drop files here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Supports PDF, Word, Excel, PowerPoint, Text, CSV (max 50MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Files Table */}
      {filteredFiles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="font-semibold">No source files yet</h3>
              <p className="text-sm text-muted-foreground">
                Upload documents to get started
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">File Name</TableHead>
                <TableHead>Attachment</TableHead>
                <TableHead className="w-[200px]">Detected Content</TableHead>
                <TableHead className="w-[100px]">Extracted?</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[100px]">Size</TableHead>
                <TableHead className="w-[120px]">Uploaded</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFiles.map((file) => (
                <TableRow key={file.id}>
                  <TableCell>
                    <button
                      onClick={() => onOpenEditor?.(file.id)}
                      className="flex items-center gap-2 hover:text-primary transition-colors text-left"
                    >
                      {getFileIcon(file.file_type)}
                      <span className="font-medium truncate max-w-[250px]" title={file.file_name}>
                        {file.file_name}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => handleViewFile(file)}
                        title="Open original file"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => handleExtractSource(file)}
                        disabled={extracting === file.id}
                        title="Re-extract text"
                      >
                        {extracting === file.id ? (
                          <Zap className="h-4 w-4 text-[#F74A05] animate-pulse" />
                        ) : (
                          <Zap className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {/* Show detected content types from chunks - clickable to open editor */}
                    {file.is_chunked && contentSummaries[file.id]?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {contentSummaries[file.id].map((summary) => {
                          const config = CONTENT_TYPE_CONFIG[summary.content_class] || CONTENT_TYPE_CONFIG.other;
                          return (
                            <button
                              key={summary.content_class}
                              onClick={() => onOpenEditor?.(file.id)}
                              className="transition-opacity hover:opacity-80"
                            >
                              <Badge
                                variant="secondary"
                                className={`${config.bgColor} ${config.color} text-xs cursor-pointer`}
                              >
                                {config.label} ({summary.count})
                              </Badge>
                            </button>
                          );
                        })}
                      </div>
                    ) : file.is_chunked ? (
                      <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs">
                        Unclassified
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {file.is_processed ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <Check className="h-3 w-3 mr-1" />
                        Yes
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        <X className="h-3 w-3 mr-1" />
                        No
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {file.is_chunked ? (
                      <button
                        onClick={() => onOpenEditor?.(file.id)}
                        className="inline-flex items-center"
                      >
                        <Badge
                          variant="secondary"
                          className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 cursor-pointer transition-colors"
                        >
                          <Layers className="h-3 w-3 mr-1" />
                          {file.chunk_count || 0} chunks
                        </Badge>
                      </button>
                    ) : file.extracted_text ? (
                      <button
                        onClick={() => onOpenEditor?.(file.id)}
                        className="inline-flex items-center"
                      >
                        <Badge
                          variant="secondary"
                          className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 cursor-pointer transition-colors"
                        >
                          <Sparkles className="h-3 w-3 mr-1" />
                          Process
                        </Badge>
                      </button>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        <X className="h-3 w-3 mr-1" />
                        No
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatFileSize(file.file_size)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(file.created_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onOpenEditor && (
                          <DropdownMenuItem onClick={() => onOpenEditor(file.id)}>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Process Document
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleViewFile(file)}>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDeleteFile(file)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
