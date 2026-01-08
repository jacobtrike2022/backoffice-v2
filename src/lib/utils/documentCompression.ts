// ============================================================================
// DOCUMENT COMPRESSION UTILITY
// ============================================================================

import { compressImage } from './imageCompression';

/**
 * Compress a document file if possible
 * - Images: Compressed using image compression
 * - PDFs/Office docs: Cannot be compressed client-side, returned as-is
 * 
 * @param file - The file to compress
 * @param options - Compression options
 * @returns A compressed File object (or original if compression not applicable)
 */
export async function compressDocument(
  file: File,
  options: {
    maxSizeMB?: number; // Target max file size in MB (default: 45MB to stay under 50MB limit)
    maxImageSizeMB?: number; // Max size for images before compression (default: 5MB)
  } = {}
): Promise<{ file: File; wasCompressed: boolean; originalSizeMB: number; compressedSizeMB: number }> {
  const {
    maxSizeMB = 45, // Target 45MB to stay safely under 50MB limit
    maxImageSizeMB = 5, // Compress images larger than 5MB
  } = options;

  const originalSizeMB = file.size / (1024 * 1024);
  
  // If file is already small enough, return as-is
  if (originalSizeMB <= maxSizeMB) {
    return {
      file,
      wasCompressed: false,
      originalSizeMB,
      compressedSizeMB: originalSizeMB,
    };
  }

  // Check if file is an image
  if (file.type.startsWith('image/')) {
    try {
      console.log(`[DocumentCompression] Compressing image: ${file.name} (${originalSizeMB.toFixed(2)}MB)`);
      
      // Compress image with target size
      const compressedFile = await compressImage(file, {
        maxSizeMB: maxImageSizeMB,
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.8,
      });

      const compressedSizeMB = compressedFile.size / (1024 * 1024);
      
      return {
        file: compressedFile,
        wasCompressed: true,
        originalSizeMB,
        compressedSizeMB,
      };
    } catch (error) {
      console.warn('[DocumentCompression] Image compression failed, using original:', error);
      // Return original file if compression fails
      return {
        file,
        wasCompressed: false,
        originalSizeMB,
        compressedSizeMB: originalSizeMB,
      };
    }
  }

  // For PDFs and Office documents, we can't compress them client-side
  // Return original file with a warning if it's too large
  if (originalSizeMB > maxSizeMB) {
    console.warn(
      `[DocumentCompression] File ${file.name} is ${originalSizeMB.toFixed(2)}MB. ` +
      `PDF/Office documents cannot be compressed client-side. Consider compressing the file before upload.`
    );
  }

  return {
    file,
    wasCompressed: false,
    originalSizeMB,
    compressedSizeMB: originalSizeMB,
  };
}

/**
 * Check if a file should be compressed
 */
export function shouldCompressDocument(file: File, maxSizeMB: number = 45): boolean {
  const fileSizeMB = file.size / (1024 * 1024);
  
  // Always compress images over 5MB
  if (file.type.startsWith('image/') && fileSizeMB > 5) {
    return true;
  }
  
  // For other files, only suggest compression if over limit
  return fileSizeMB > maxSizeMB;
}

