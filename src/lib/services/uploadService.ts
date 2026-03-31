/**
 * UPLOAD SERVICE
 *
 * Centralized, reliable file upload handling for Supabase Storage.
 * Uses XMLHttpRequest for maximum reliability and progress tracking.
 * In demo mode (no session), uses anon key so uploads work for demo orgs.
 */

import { supabase } from '../supabase';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

export interface UploadResult {
  success: boolean;
  path?: string;
  signedUrl?: string;
  error?: string;
}

export interface UploadOptions {
  bucket: string;
  path: string;
  contentType?: string;
  onProgress?: (progress: number) => void;
}

/**
 * Upload a file to Supabase Storage using XMLHttpRequest.
 */
export async function uploadFile(
  file: File | Blob,
  options: UploadOptions
): Promise<UploadResult> {
  const { bucket, path, contentType, onProgress } = options;

  try {
    // Use session when authenticated; anon key in demo mode so uploads work for demo orgs
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || publicAnonKey;
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    // Build upload URL
    const uploadUrl = `https://${projectId}.supabase.co/storage/v1/object/${bucket}/${path}`;
    const fileContentType = contentType || file.type || 'application/octet-stream';

    // Upload directly - XHR handles File objects fine
    const result = await uploadWithXHR(
      uploadUrl,
      file,
      token,
      fileContentType,
      onProgress
    );

    if (!result.success) {
      return result;
    }

    // Create signed URL for the uploaded file
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 315360000); // 10 years

    if (signedUrlError) {
      return { success: false, error: `Failed to create signed URL: ${signedUrlError.message}` };
    }

    return {
      success: true,
      path,
      signedUrl: signedUrlData.signedUrl
    };

  } catch (error: any) {
    console.error('[uploadService] Upload failed:', error);
    return { success: false, error: error.message || 'Upload failed' };
  }
}

/**
 * Upload using XMLHttpRequest
 */
function uploadWithXHR(
  url: string,
  file: File | Blob,
  accessToken: string,
  contentType: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ success: true });
      } else {
        let errorMessage = `Upload failed with status ${xhr.status}`;
        try {
          const response = JSON.parse(xhr.responseText);
          errorMessage = response.error || response.message || errorMessage;
        } catch {
          // Use default error message
        }
        resolve({ success: false, error: errorMessage });
      }
    };

    xhr.onerror = () => {
      resolve({ success: false, error: 'Network error during upload' });
    };

    xhr.ontimeout = () => {
      resolve({ success: false, error: 'Upload timed out' });
    };

    xhr.open('POST', url, true);
    xhr.timeout = 5 * 60 * 1000; // 5 minutes
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.send(file);
  });
}

function isPdfMagicBytes(buf: Uint8Array): boolean {
  let i = 0;
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    i = 3;
  }
  while (
    i < buf.length &&
    (buf[i] === 0x20 || buf[i] === 0x09 || buf[i] === 0x0a || buf[i] === 0x0d)
  ) {
    i++;
  }
  const sig = [0x25, 0x50, 0x44, 0x46];
  if (i + sig.length > buf.length) return false;
  for (let j = 0; j < sig.length; j++) {
    if (buf[i + j] !== sig[j]) return false;
  }
  return true;
}

function isDocxMagicBytes(buf: Uint8Array): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    buf[2] === 0x03 &&
    buf[3] === 0x04
  );
}

/**
 * Reject HTML/other content saved as .pdf or mislabeled .docx before storage upload.
 */
async function validateSourceFileMagicBytes(
  file: File
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = file.name.toLowerCase();
  const treatAsPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
  const treatAsDocx =
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx');

  if (treatAsPdf) {
    const buf = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    if (!isPdfMagicBytes(buf)) {
      return {
        ok: false,
        error:
          'This file is not a valid PDF. It may be HTML or another format with a .pdf name. Use Print → Save as PDF or export a real PDF.',
      };
    }
  }
  if (treatAsDocx) {
    const buf = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (!isDocxMagicBytes(buf)) {
      return {
        ok: false,
        error:
          'This file is not a valid Word document (.docx). Save as .docx from Word or Google Docs, or upload a PDF.',
      };
    }
  }
  return { ok: true };
}

/**
 * Upload a source file with all the proper handling (storage only)
 */
export async function uploadSourceFile(
  file: File,
  organizationId: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  const magic = await validateSourceFileMagicBytes(file);
  if (!magic.ok) {
    return { success: false, error: magic.error };
  }

  const fileExt = file.name.split('.').pop() || 'bin';
  const fileName = `${organizationId}/${crypto.randomUUID()}.${fileExt}`;

  return uploadFile(file, {
    bucket: 'source-files',
    path: fileName,
    contentType: file.type,
    onProgress
  });
}

// Note: SourceType for files is less important now since content classification
// happens at the CHUNK level. A single file can contain multiple content types.
// This type is kept for backwards compatibility with existing records.
export type SourceType = 'policy' | 'procedure' | 'job_description' | 'training_materials' | 'form' | 'other';

export interface SourceFileRecord {
  id: string;
  organization_id: string;
  file_name: string;
  storage_path: string;
  file_url: string;
  file_type: string;
  file_size: number;
  source_type: SourceType;
  created_at: string;
}

export interface SourceFileUploadResult {
  success: boolean;
  file?: SourceFileRecord;
  error?: string;
}

/**
 * Upload a source file AND create the database record
 * This is the complete flow for JD uploads and other source files
 */
export async function uploadSourceFileWithRecord(
  file: File,
  organizationId: string,
  sourceType: SourceType = 'other',
  onProgress?: (progress: number) => void
): Promise<SourceFileUploadResult> {
  try {
    // Step 1: Upload to storage
    const uploadResult = await uploadSourceFile(file, organizationId, onProgress);

    if (!uploadResult.success || !uploadResult.path || !uploadResult.signedUrl) {
      return { success: false, error: uploadResult.error || 'Upload failed' };
    }

    // Step 2: Insert database record
    const { data: insertedFile, error: insertError } = await supabase
      .from('source_files')
      .insert({
        organization_id: organizationId,
        file_name: file.name,
        storage_path: uploadResult.path,
        file_url: uploadResult.signedUrl,
        file_type: file.type,
        file_size: file.size,
        source_type: sourceType,
      })
      .select()
      .single();

    if (insertError) {
      // Clean up storage if database insert fails
      await supabase.storage.from('source-files').remove([uploadResult.path]);
      return { success: false, error: insertError.message };
    }

    return {
      success: true,
      file: insertedFile as SourceFileRecord
    };
  } catch (error: any) {
    console.error('[uploadService] uploadSourceFileWithRecord failed:', error);
    return { success: false, error: error.message || 'Upload failed' };
  }
}

/**
 * Upload a certification document to the certification-documents bucket
 */
export async function uploadCertificationDocument(
  file: File,
  organizationId: string,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  const fileExt = file.name.split('.').pop() || 'bin';
  const fileName = `${organizationId}/${userId}/${crypto.randomUUID()}.${fileExt}`;

  return uploadFile(file, {
    bucket: 'certification-documents',
    path: fileName,
    contentType: file.type,
    onProgress
  });
}
