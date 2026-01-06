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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
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
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { supabase, getCurrentUserOrgId } from '../lib/supabase';

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
];

const ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';

export function SourcesManagement() {
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get a signed URL for viewing/downloading files (private bucket)
  const getSignedUrl = async (storagePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('source-files')
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

      if (error) throw error;
      return data.signedUrl;
    } catch (error: any) {
      console.error('Error creating signed URL:', error);
      toast.error('Failed to access file');
      return null;
    }
  };

  // Open file in new tab using signed URL
  const handleViewFile = async (file: SourceFile) => {
    const signedUrl = await getSignedUrl(file.storage_path);
    if (signedUrl) {
      window.open(signedUrl, '_blank');
    }
  };

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
    } catch (error: any) {
      console.error('Error loading source files:', error);
      toast.error('Failed to load source files');
    } finally {
      setLoading(false);
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
    const uploadPromises: Promise<void>[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        toast.error(`Invalid file type: ${file.name}`, {
          description: 'Accepted formats: PDF, Word, Excel, PowerPoint, Text, CSV'
        });
        continue;
      }

      // Validate file size (50MB max)
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`File too large: ${file.name}`, {
          description: 'Maximum file size is 50MB'
        });
        continue;
      }

      uploadPromises.push(uploadSingleFile(file, orgId));
    }

    try {
      await Promise.all(uploadPromises);
      await loadSourceFiles();
    } finally {
      setUploading(false);
    }
  };

  const uploadSingleFile = async (file: File, orgId: string) => {
    try {
      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${orgId}/${crypto.randomUUID()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('source-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('source-files')
        .getPublicUrl(fileName);

      // Insert record into database
      const { error: insertError } = await supabase
        .from('source_files')
        .insert({
          organization_id: orgId,
          file_name: file.name,
          storage_path: fileName,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
        });

      if (insertError) {
        // Clean up storage if database insert fails
        await supabase.storage.from('source-files').remove([fileName]);
        throw insertError;
      }

      toast.success(`Uploaded: ${file.name}`);
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error(`Failed to upload: ${file.name}`, {
        description: error.message
      });
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
      const { error: storageError } = await supabase.storage
        .from('source-files')
        .remove([file.storage_path]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
      }

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
      {/* Drag and Drop Upload Area */}
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
            <p className="text-sm text-muted-foreground">Uploading files...</p>
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
                <TableHead className="w-[180px]">Source Type</TableHead>
                <TableHead className="w-[100px]">Processed?</TableHead>
                <TableHead className="w-[100px]">Size</TableHead>
                <TableHead className="w-[120px]">Uploaded</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFiles.map((file) => (
                <TableRow key={file.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getFileIcon(file.file_type)}
                      <span className="font-medium truncate max-w-[250px]" title={file.file_name}>
                        {file.file_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-primary hover:text-primary"
                      onClick={() => handleViewFile(file)}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={file.source_type || ''}
                      onValueChange={(value) => handleUpdateSourceType(file.id, value as SourceType)}
                    >
                      <SelectTrigger className="h-8 w-[160px]">
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
