// ============================================================================
// STORE PHOTO UPLOAD TO SUPABASE STORAGE
// ============================================================================

import { supabase } from '../supabase';

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

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('File size must be less than 5MB');
    }

    // Create a unique file name
    const fileExt = file.name.split('.').pop();
    const fileName = `${storeId}-${Date.now()}.${fileExt}`;
    const filePath = `stores/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('store-photos')
      .upload(filePath, file, {
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
