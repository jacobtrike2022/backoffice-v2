// ============================================================================
// IMAGE COMPRESSION UTILITY
// ============================================================================

/**
 * Compress an image file to reduce its size
 * 
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns A compressed File object
 */
export async function compressImage(
  file: File,
  options: {
    maxSizeMB?: number; // Target max file size in MB (default: 1MB)
    maxWidth?: number; // Max width in pixels (default: 1920)
    maxHeight?: number; // Max height in pixels (default: 1920)
    quality?: number; // JPEG quality 0-1 (default: 0.8)
  } = {}
): Promise<File> {
  const {
    maxSizeMB = 1, // Target 1MB
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.8,
  } = options;

  // If file is already small enough, return as-is
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB <= maxSizeMB) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
          const widthRatio = maxWidth / width;
          const heightRatio = maxHeight / height;
          const ratio = Math.min(widthRatio, heightRatio);
          
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Draw image on canvas
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            
            // If still too large, try with lower quality
            const compressedSizeMB = blob.size / (1024 * 1024);
            if (compressedSizeMB > maxSizeMB && quality > 0.5) {
              // Recursively compress with lower quality
              // Ensure we use JPEG format for better compression
              const newFile = new File([blob], file.name, { 
                type: 'image/jpeg', // Use JPEG for better compression
                lastModified: Date.now(),
              });
              compressImage(newFile, { ...options, quality: Math.max(0.5, quality - 0.1) })
                .then(resolve)
                .catch(reject);
              return;
            }
            
            // Create new File from blob
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            
            console.log(
              `Image compressed: ${fileSizeMB.toFixed(2)}MB → ${compressedSizeMB.toFixed(2)}MB ` +
              `(${((1 - compressedSizeMB / fileSizeMB) * 100).toFixed(1)}% reduction)`
            );
            
            resolve(compressedFile);
          },
          'image/jpeg', // Always use JPEG for better compression
          quality
        );
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

