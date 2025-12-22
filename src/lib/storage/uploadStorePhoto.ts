// ============================================================================
// STORE PHOTO UPLOAD TO SUPABASE STORAGE
// ============================================================================

import { supabase } from '../supabase';
import { compressImage } from '../utils/imageCompression';

/**
 * Upload a store photo to Supabase Storage
 * 
 * @param file - The image file to upload
 * @param storeId - The ID of the store (used for naming)
 * @returns The public URL of the uploaded photo
 */
export async function uploadStorePhoto(file: File, storeId: string): Promise<string> {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Compress image automatically
    let fileToUpload = file;
    try {
      fileToUpload = await compressImage(file, {
        maxSizeMB: 2, // Target 2MB for store photos
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.8,
      });
    } catch (compressionError) {
      console.warn('Image compression failed, using original file:', compressionError);
      // Continue with original file if compression fails
    }

    // Validate file size after compression (3MB max after compression)
    const maxSize = 3 * 1024 * 1024; // 3MB after compression
    if (fileToUpload.size > maxSize) {
      throw new Error('File size must be less than 3MB after compression');
    }

    // Create a unique file name
    const fileExt = fileToUpload.name.split('.').pop() || 'jpg';
    const fileName = `${storeId}-${Date.now()}.${fileExt}`;
    const filePath = `stores/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('store-photos')
      .upload(filePath, fileToUpload, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      throw error;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('store-photos')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.error('Error uploading store photo:', err);
    throw err;
  }
}

/**
 * Delete a store photo from Supabase Storage
 * 
 * @param photoUrl - The public URL of the photo to delete
 */
export async function deleteStorePhoto(photoUrl: string): Promise<void> {
  try {
    // Extract the file path from the URL
    const urlParts = photoUrl.split('/store-photos/');
    if (urlParts.length < 2) {
      throw new Error('Invalid photo URL');
    }

    const filePath = urlParts[1];

    // Delete from Supabase Storage
    const { error } = await supabase.storage
      .from('store-photos')
      .remove([filePath]);

    if (error) {
      console.error('Supabase storage delete error:', error);
      throw error;
    }
  } catch (err) {
    console.error('Error deleting store photo:', err);
    throw err;
  }
}
