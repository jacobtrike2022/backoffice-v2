import { publicAnonKey, getServerUrl } from '../../utils/supabase/info';
import { getHealthStatus } from '../serverHealth';

export interface Attachment {
  id: string;
  trackId: string;
  fileName: string;
  storagePath: string;
  url: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

/**
 * Upload an attachment for a track
 */
export async function uploadAttachment(trackId: string, file: File): Promise<Attachment> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('trackId', trackId);

  console.log('uploadAttachment - Sending request to server with trackId:', trackId, 'file:', file.name);

  const response = await fetch(`${getServerUrl()}/upload-attachment`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
    },
    body: formData,
  });

  console.log('uploadAttachment - Response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('uploadAttachment - Error response:', errorText);
    let error;
    try {
      error = JSON.parse(errorText);
    } catch {
      error = { error: errorText };
    }
    throw new Error(error.error || 'Failed to upload attachment');
  }

  const data = await response.json();
  console.log('uploadAttachment - Success response:', data);
  return data.attachment;
}

/**
 * Get all attachments for a track
 */
export async function getAttachments(trackId: string): Promise<Attachment[]> {
  try {
    const response = await fetch(`${getServerUrl()}/attachments/${trackId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get attachments');
    }

    const data = await response.json();
    return data.attachments || [];
  } catch (error) {
    // Return empty array silently - server health check handles the warning
    if (getHealthStatus()) {
      console.error('Failed to fetch attachments despite server being healthy:', error);
    }
    return [];
  }
}

/**
 * Delete an attachment
 */
export async function deleteAttachment(attachmentId: string): Promise<void> {
  const response = await fetch(`${getServerUrl()}/attachment/${attachmentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete attachment');
  }
}