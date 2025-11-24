import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let isLoaded = false;

export async function loadFFmpeg(onProgress?: (progress: number) => void) {
  if (isLoaded && ffmpeg) return ffmpeg;
  
  ffmpeg = new FFmpeg();
  
  // Set up logging
  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg]', message);
  });
  
  // Set up progress tracking
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.round(progress * 100));
    });
  }
  
  try {
    // Use direct URLs without toBlobURL
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: `${baseURL}/ffmpeg-core.js`,
      wasmURL: `${baseURL}/ffmpeg-core.wasm`,
    });
    isLoaded = true;
    console.log('FFmpeg loaded successfully');
    return ffmpeg;
  } catch (error) {
    console.error('Failed to load FFmpeg:', error);
    throw new Error('Failed to initialize video compressor');
  }
}

export interface CompressionOptions {
  maxSizeMB?: number; // Target max size in MB
  quality?: 'low' | 'medium' | 'high'; // Compression quality
  maxWidth?: number; // Max width (maintains aspect ratio)
  maxHeight?: number; // Max height (maintains aspect ratio)
  format?: 'mp4' | 'webm'; // Output format
  onProgress?: (progress: number, stage: string) => void;
}

export async function compressVideo(
  file: File,
  options: CompressionOptions = {}
): Promise<Blob> {
  const {
    maxSizeMB = 25,
    quality = 'medium',
    maxWidth = 1080,
    maxHeight = 1920, // Portrait format default
    format = 'mp4',
    onProgress
  } = options;

  // Check if compression is needed
  const fileSizeMB = file.size / (1024 * 1024);
  
  try {
    onProgress?.(0, 'Initializing compressor...');
    
    // Load FFmpeg
    const ffmpegInstance = await loadFFmpeg((progress) => {
      onProgress?.(Math.min(progress, 90), 'Compressing video...');
    });
    
    if (!ffmpegInstance) {
      throw new Error('FFmpeg not available');
    }

    onProgress?.(10, 'Loading video...');
    
    // Write input file to FFmpeg virtual filesystem
    const inputFileName = 'input.' + file.name.split('.').pop();
    const outputFileName = `output.${format}`;
    
    await ffmpegInstance.writeFile(inputFileName, await fetchFile(file));
    
    onProgress?.(20, 'Analyzing video...');
    
    // Determine compression settings based on quality preset
    let crf: number; // Constant Rate Factor (lower = better quality, 18-28 is good range)
    let preset: string; // Encoding speed preset
    
    switch (quality) {
      case 'low':
        crf = 28;
        preset = 'veryfast';
        break;
      case 'high':
        crf = 23;
        preset = 'medium';
        break;
      case 'medium':
      default:
        crf = 26;
        preset = 'fast';
        break;
    }
    
    // Build FFmpeg command
    const ffmpegArgs = [
      '-i', inputFileName,
      '-vf', `scale='min(${maxWidth},iw)':min'(${maxHeight},ih)':force_original_aspect_ratio=decrease`, // Scale down if needed
      '-c:v', 'libx264', // H.264 codec
      '-preset', preset,
      '-crf', crf.toString(),
      '-c:a', 'aac', // Audio codec
      '-b:a', '128k', // Audio bitrate
      '-movflags', '+faststart', // Enable streaming
      '-y', // Overwrite output
      outputFileName
    ];
    
    onProgress?.(30, 'Compressing video...');
    
    // Run FFmpeg
    await ffmpegInstance.exec(ffmpegArgs);
    
    onProgress?.(90, 'Finalizing...');
    
    // Read the output file
    const data = await ffmpegInstance.readFile(outputFileName);
    
    // Clean up
    await ffmpegInstance.deleteFile(inputFileName);
    await ffmpegInstance.deleteFile(outputFileName);
    
    // Convert to Blob
    const blob = new Blob([data], { type: `video/${format}` });
    
    const compressedSizeMB = blob.size / (1024 * 1024);
    console.log(`Video compressed: ${fileSizeMB.toFixed(2)}MB → ${compressedSizeMB.toFixed(2)}MB (${((1 - compressedSizeMB / fileSizeMB) * 100).toFixed(1)}% reduction)`);
    
    onProgress?.(100, 'Complete!');
    
    // If still too large, try with lower quality
    if (compressedSizeMB > maxSizeMB && quality !== 'low') {
      console.log('Still too large, trying lower quality...');
      return compressVideo(file, { ...options, quality: 'low' });
    }
    
    return blob;
    
  } catch (error: any) {
    console.error('Video compression error:', error);
    throw new Error(`Compression failed: ${error.message}`);
  }
}

export async function shouldCompressVideo(file: File, maxSizeMB: number = 25): Promise<boolean> {
  const fileSizeMB = file.size / (1024 * 1024);
  return fileSizeMB > maxSizeMB;
}

export function getVideoInfo(file: File): { sizeMB: number; name: string; type: string } {
  return {
    sizeMB: file.size / (1024 * 1024),
    name: file.name,
    type: file.type
  };
}