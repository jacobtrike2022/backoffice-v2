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
  Eye,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { supabase, getCurrentUserOrgId, refreshSupabase, refreshAuthSession, supabaseAnonKey } from '../lib/supabase';
import { compressDocument, shouldCompressDocument } from '../lib/utils/documentCompression';
import { getServerUrl } from '../utils/supabase/info';
import { SourceFilePreview } from './SourceFilePreview';

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
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

const ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif';

export function SourcesManagement() {
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [compressingFileName, setCompressingFileName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [extracting, setExtracting] = useState<string | null>(null); // Track which file is being extracted
  const [previewFile, setPreviewFile] = useState<SourceFile | null>(null); // File for preview modal
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

  // Diagnostic function to test storage connectivity
  const testStorageConnectivity = async () => {
    try {
      // Refresh Supabase connection before testing
      refreshSupabase();
      await refreshAuthSession();
      
      // Test 1: List buckets
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

      if (bucketsError) {
        toast.error('Storage access error: ' + bucketsError.message);
        return false;
      }

      let bucketExists = buckets?.some(b => b.name === 'source-files');

      // Fallback: try listing from bucket (RLS may hide bucket listing)
      const { data: filesFallback, error: listFallbackError } = await supabase.storage
        .from('source-files')
        .list('', { limit: 1 });
      if (!!filesFallback && !listFallbackError) {
        bucketExists = true;
      }

      if (!bucketExists) {
        toast.error('Bucket "source-files" does not exist. Please create it in Supabase Dashboard > Storage.');
        return false;
      }

      // Test 2: List files in bucket (tests read access)
      const { data: files, error: listError } = await supabase.storage
        .from('source-files')
        .list('', { limit: 1 });

      if (listError) {
        toast.error('Cannot read from storage bucket: ' + listError.message);
        return false;
      }

      // Test 3: Try a small upload
      console.log('[SourcesManagement] Testing small file upload...');
      const testBlob = new Blob(['test'], { type: 'text/plain' });
      const testPath = `_test_${Date.now()}.txt`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('source-files')
        .upload(testPath, testBlob, { upsert: true });

      console.log('[SourcesManagement] Test upload result:', { uploadData, uploadError });

      if (uploadError) {
        toast.error('Storage upload test failed: ' + uploadError.message);
        return false;
      }

      // Clean up test file
      await supabase.storage.from('source-files').remove([testPath]);

      // Test 4: Try a slightly larger upload (100KB) to test connection stability
      console.log('[SourcesManagement] Testing 100KB file upload...');
      const largerContent = 'x'.repeat(100 * 1024); // 100KB of data
      const largerBlob = new Blob([largerContent], { type: 'text/plain' });
      const largerTestPath = `_test_100kb_${Date.now()}.txt`;

      const startTime = Date.now();
      const { data: largerUploadData, error: largerUploadError } = await supabase.storage
        .from('source-files')
        .upload(largerTestPath, largerBlob, { upsert: true });

      const elapsed = Date.now() - startTime;
      console.log(`[SourcesManagement] 100KB test upload completed in ${elapsed}ms:`, { largerUploadData, largerUploadError });

      if (largerUploadError) {
        console.warn('[SourcesManagement] 100KB test upload failed - may indicate network issues:', largerUploadError);
        // Don't fail the whole test, just warn
      } else {
        // Clean up
        await supabase.storage.from('source-files').remove([largerTestPath]);
        console.log(`[SourcesManagement] Network speed estimate: ${(100 / (elapsed / 1000)).toFixed(1)} KB/s`);
      }

      return true;
    } catch (error: any) {
      console.error('[SourcesManagement] Storage test error:', error);
      toast.error('Storage test failed: ' + error.message);
      return false;
    }
  };

  useEffect(() => {
    loadSourceFiles();
    // Run storage diagnostic on mount
    testStorageConnectivity();
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
      const originalSizeMB = file.size / (1024 * 1024);
      let fileToUpload = file;
      let wasCompressed = false;
      let compressedSizeMB = originalSizeMB;

      // Compress file if needed (especially for images)
      if (shouldCompressDocument(file, 180)) { // Compress if over 180MB (to stay under 200MB)
        setCompressing(true);
        setCompressingFileName(file.name);
        
        try {
          const compressionResult = await compressDocument(file, {
            maxSizeMB: 180,
            maxImageSizeMB: 10, // Compress images over 10MB
          });
          
          fileToUpload = compressionResult.file;
          wasCompressed = compressionResult.wasCompressed;
          compressedSizeMB = compressionResult.compressedSizeMB;
          
          if (wasCompressed) {
            toast.info(
              `Compressed ${file.name}: ${originalSizeMB.toFixed(1)}MB → ${compressedSizeMB.toFixed(1)}MB`,
              { duration: 3000 }
            );
          }
          } catch (compressionError: any) {
            console.error('[SourcesManagement] Compression failed, using original file:', compressionError);
            toast.warning(`Compression failed for ${file.name}, uploading original file`);
        } finally {
          setCompressing(false);
          setCompressingFileName('');
        }
      }

      // Validate final file size (200MB limit)
      const finalSizeMB = fileToUpload.size / (1024 * 1024);
      if (finalSizeMB > 200) {
        throw new Error(
          `File is too large (${finalSizeMB.toFixed(1)}MB). Maximum size is 200MB. ` +
          `Please compress the file before uploading.`
        );
      }

      // Generate unique file path
      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${orgId}/${crypto.randomUUID()}.${fileExt}`;

      // Verify Supabase session before upload
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('[SourcesManagement] Session error:', sessionError);
      }

      // Upload to storage with retry logic for network issues
      let uploadError: any = null;
      let uploadData: any = null;
      const maxRetries = 3;
      const retryDelay = 2000; // 2 seconds
      const uploadTimeout = 2 * 60 * 1000; // 2 minutes timeout (reduced from 10 min)

      console.log(`[SourcesManagement] Starting upload: ${fileToUpload.name} (${finalSizeMB.toFixed(2)}MB) to path: ${fileName}`);

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`[SourcesManagement] Upload attempt ${attempt}/${maxRetries} for ${fileToUpload.name} (${finalSizeMB.toFixed(1)}MB)`);

        try {
          // Check auth token before upload
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          console.log(`[SourcesManagement] Session status:`, {
            hasSession: !!currentSession,
            hasToken: !!currentSession?.access_token
          });

          const startTime = Date.now();

          // Upload using Supabase client with timeout
          const uploadPromise = supabase.storage
            .from('source-files')
            .upload(fileName, fileToUpload, {
              contentType: fileToUpload.type || file.type || 'application/octet-stream',
              cacheControl: '3600',
              upsert: false,
              duplex: 'half' // Required for streaming uploads in some environments
            });

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Upload timeout - the file may be too large or connection is slow')), uploadTimeout)
          );

          const result = await Promise.race([uploadPromise, timeoutPromise]);

          const elapsed = Date.now() - startTime;
          console.log(`[SourcesManagement] Upload completed in ${elapsed}ms`);

          uploadData = result.data;
          uploadError = result.error;

          console.log(`[SourcesManagement] Upload result:`, { uploadData, uploadError });

          if (!uploadError) {
            console.log(`[SourcesManagement] Upload successful on attempt ${attempt}`);
            break;
          }

          // If it's a network error and we have retries left, wait and retry
          const isNetworkError = uploadError?.message?.includes('fetch') ||
                               uploadError?.message?.includes('network') ||
                               uploadError?.message?.includes('Failed to fetch');

          if (isNetworkError && attempt < maxRetries) {
            console.log(`[SourcesManagement] Network error on attempt ${attempt}, retrying in ${retryDelay * attempt}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempt)); // Exponential backoff
            continue;
          }

          // If it's not a network error or we're out of retries, break and throw
          break;
        } catch (error: any) {
          uploadError = error;
          console.log(`[SourcesManagement] Upload exception on attempt ${attempt}:`, error.message);

          const isRetryable = (error.message?.includes('timeout') ||
                              error.message?.includes('fetch') ||
                              error.message?.includes('network')) && attempt < maxRetries;

          if (isRetryable) {
            console.log(`[SourcesManagement] Retryable error, waiting ${retryDelay * attempt}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            continue;
          }

          // If not retryable or out of retries, break
          break;
        }
      }

      if (uploadError) {
        console.error('[SourcesManagement] Upload error details:', {
          message: uploadError.message,
          error: uploadError
        });
        
        // Provide more helpful error messages
        const isNetworkIssue = uploadError.message?.includes('timeout') || 
                              uploadError.message?.includes('fetch') ||
                              uploadError.message?.includes('network') ||
                              uploadError.message?.includes('Failed to fetch');
        
        if (isNetworkIssue) {
          throw new Error(
            `Upload failed due to network issues. The file (${finalSizeMB.toFixed(1)}MB) may be too large for your connection. ` +
            `Please try: 1) Check your internet connection, 2) Try a smaller file, or 3) Compress the file before uploading.`
          );
        }
        
        throw uploadError;
      }

      // Since bucket is private, use signed URL instead of public URL
      // Create signed URL with 10 year expiration for long-term access
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('source-files')
        .createSignedUrl(fileName, 315360000); // 10 years in seconds

      if (signedUrlError) {
        console.error('[SourcesManagement] Error creating signed URL:', signedUrlError);
        throw new Error(`Failed to create file URL: ${signedUrlError.message}`);
      }

      const fileUrl = signedUrlData.signedUrl;

      // Insert record into database
      const { data: insertedFile, error: insertError } = await supabase
        .from('source_files')
        .insert({
          organization_id: orgId,
          file_name: file.name, // Keep original filename
          storage_path: fileName,
          file_url: fileUrl,
          file_type: file.type, // Keep original MIME type
          file_size: fileToUpload.size, // Store actual uploaded size
        })
        .select('id')
        .single();

      if (insertError) {
        // Clean up storage if database insert fails
        await supabase.storage.from('source-files').remove([fileName]);
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
        // Trigger extraction in the background
        triggerExtraction(insertedFile.id, file.name);
      }
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

  // Temporary test function to call extract-source endpoint
  const handleExtractSource = async (file: SourceFile) => {
    setExtracting(file.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const serverUrl = getServerUrl();
      console.log('[SourcesManagement] Calling extract-source endpoint:', {
        url: `${serverUrl}/extract-source`,
        source_file_id: file.id
      });

      const response = await fetch(`${serverUrl}/extract-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          source_file_id: file.id
        }),
      });

      console.log('[SourcesManagement] Extract response status:', response.status);

      const responseData = await response.json();
      console.log('[SourcesManagement] Extract response data:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || `Extraction failed with status ${response.status}`);
      }

      // Show success with full response details
      toast.success('Extraction completed!', {
        description: `Stats: ${responseData.stats?.word_count || 0} words, ${responseData.stats?.character_count || 0} chars, ${responseData.stats?.processing_time_ms || 0}ms`,
        duration: 10000
      });

      // Log full response to console for inspection
      console.log('[SourcesManagement] Full extraction response:', JSON.stringify(responseData, null, 2));

      // Reload source files to get updated is_processed status
      await loadSourceFiles();
    } catch (error: any) {
      console.error('[SourcesManagement] Extract error:', error);
      toast.error('Extraction failed', {
        description: error.message,
        duration: 10000
      });
    } finally {
      setExtracting(null);
    }
  };

  // Auto-trigger extraction after upload (runs in background, doesn't block)
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

      // Reload to show updated status
      await loadSourceFiles();
    } catch (error: any) {
      toast.dismiss(toastId);
      toast.error(`Failed to process ${fileName}`, {
        description: error.message
      });
    }
  };

  // Handle source type change (updates database)
  const handleSourceTypeUpdate = async (fileId: string, newType: string) => {
    try {
      const { error } = await supabase
        .from('source_files')
        .update({ source_type: newType })
        .eq('id', fileId);

      if (error) throw error;

      // Update local state
      setSourceFiles(prev =>
        prev.map(f => f.id === fileId ? { ...f, source_type: newType } : f)
      );

      // If preview modal is open for this file, update it too
      if (previewFile?.id === fileId) {
        setPreviewFile(prev => prev ? { ...prev, source_type: newType } : null);
      }

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

        {uploading || compressing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              {compressing ? `Compressing ${compressingFileName}...` : 'Uploading files...'}
            </p>
            {compressing && (
              <p className="text-xs text-muted-foreground">
                Large files are automatically compressed to reduce upload time
              </p>
            )}
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
                Supports PDF, Word, Excel, PowerPoint, Text, CSV (max 200MB)
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Images are automatically compressed for faster uploads
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
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-primary hover:text-primary"
                        onClick={() => setPreviewFile(file)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
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

      {/* Source File Preview Modal */}
      <SourceFilePreview
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        sourceFile={previewFile}
        onSourceTypeChange={(newType) => {
          if (previewFile) {
            handleSourceTypeUpdate(previewFile.id, newType);
          }
        }}
      />
    </div>
  );
}
