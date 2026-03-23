// Client-side video compression using native browser APIs
// No external dependencies - works in all modern browsers

interface CompressionOptions {
  maxSizeMB?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

interface CompressionResult {
  blob: Blob;
  originalSizeMB: number;
  compressedSizeMB: number;
  compressionRatio: number;
}

export async function compressVideo(
  file: File,
  options: CompressionOptions = {},
  onProgress?: (progress: number, stage: string) => void
): Promise<CompressionResult> {
  const {
    maxSizeMB = 15,
    maxWidth = 1080,
    maxHeight = 1920,
    quality = 0.7,
  } = options;

  const originalSizeMB = file.size / (1024 * 1024);
  
  // If file is already small enough, return as-is
  if (originalSizeMB <= maxSizeMB) {
    return {
      blob: file,
      originalSizeMB,
      compressedSizeMB: originalSizeMB,
      compressionRatio: 1,
    };
  }

  onProgress?.(10, 'Loading video...');

  // Create video element to load the file
  const video = document.createElement('video');
  // IMPORTANT: Do NOT mute - we need audio to flow through captureStream()
  video.muted = false;
  video.playsInline = true;
  // Set volume to 0 so user doesn't hear playback, but audio still captures
  video.volume = 0;
  
  const videoUrl = URL.createObjectURL(file);
  video.src = videoUrl;

  // Wait for video to load
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video'));
  });

  onProgress?.(20, 'Analyzing video...');

  // Calculate target dimensions maintaining aspect ratio
  let targetWidth = video.videoWidth;
  let targetHeight = video.videoHeight;

  if (targetWidth > maxWidth || targetHeight > maxHeight) {
    const widthRatio = maxWidth / targetWidth;
    const heightRatio = maxHeight / targetHeight;
    const ratio = Math.min(widthRatio, heightRatio);

    targetWidth = Math.round(targetWidth * ratio);
    targetHeight = Math.round(targetHeight * ratio);
  }

  // Ensure dimensions are even (required for some video codecs)
  targetWidth = targetWidth - (targetWidth % 2);
  targetHeight = targetHeight - (targetHeight % 2);

  console.log(`Compressing: ${video.videoWidth}x${video.videoHeight} → ${targetWidth}x${targetHeight}`);

  onProgress?.(30, 'Setting up compression...');

  // Create canvas for drawing video frames
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d')!;

  // Calculate target bitrate based on desired file size
  const duration = video.duration;
  const targetBitrate = Math.floor((maxSizeMB * 8 * 1024 * 1024) / duration * 0.8); // 80% of max to leave room for audio

  console.log(`Target bitrate: ${(targetBitrate / 1000000).toFixed(2)} Mbps`);

  // Set up MediaRecorder with canvas stream for video
  const canvasStream = canvas.captureStream(30); // 30 fps

  // Create combined stream - start with video track from canvas
  const combinedStream = new MediaStream();
  canvasStream.getVideoTracks().forEach(track => {
    combinedStream.addTrack(track);
  });

  // Add audio from original video using captureStream() on the video element
  // This is more reliable than createMediaElementSource which has issues
  let hasAudio = false;
  try {
    // captureStream() on HTMLVideoElement captures both video and audio tracks
    // We only want the audio tracks (video comes from canvas for resizing)
    const videoStream = (video as any).captureStream ?
      (video as any).captureStream() :
      (video as any).mozCaptureStream?.();

    if (videoStream) {
      const audioTracks = videoStream.getAudioTracks();
      console.log(`Found ${audioTracks.length} audio track(s) in source video`);

      if (audioTracks.length > 0) {
        audioTracks.forEach((track: MediaStreamTrack) => {
          combinedStream.addTrack(track);
          hasAudio = true;
        });
        console.log('✅ Audio tracks added to compressed video stream');
      } else {
        console.log('⚠️ Source video has no audio tracks');
      }
    } else {
      console.warn('⚠️ captureStream() not supported on video element');
    }
  } catch (audioError) {
    console.warn('Could not extract audio from video:', audioError);
  }

  const stream = combinedStream;

  // Determine the best codec and bitrate
  const mimeType = getSupportedMimeType();
  console.log('Using codec:', mimeType);

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: targetBitrate,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  onProgress?.(40, 'Processing video...');

  // Start recording
  recorder.start(100); // Collect data every 100ms

  // Play video and draw frames to canvas
  video.currentTime = 0;
  await video.play();

  const startTime = Date.now();
  const drawFrame = () => {
    if (video.paused || video.ended) return;

    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

    // Update progress based on video playback
    const progress = 40 + Math.min(50, (video.currentTime / duration) * 50);
    const timeRemaining = Math.ceil((duration - video.currentTime) * 1000);
    onProgress?.(progress, `Processing... ${Math.ceil(video.currentTime)}s / ${Math.ceil(duration)}s`);

    requestAnimationFrame(drawFrame);
  };

  drawFrame();

  // Wait for video to finish playing
  await new Promise<void>((resolve) => {
    video.onended = () => resolve();
  });

  onProgress?.(90, 'Finalizing...');

  // Stop recording
  recorder.stop();

  // Wait for final data
  const compressedBlob = await new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };
  });

  // Cleanup
  URL.revokeObjectURL(videoUrl);

  onProgress?.(100, 'Complete!');

  const compressedSizeMB = compressedBlob.size / (1024 * 1024);
  const compressionRatio = compressedSizeMB / originalSizeMB;

  console.log(`Compression complete: ${originalSizeMB.toFixed(2)}MB → ${compressedSizeMB.toFixed(2)}MB (${(compressionRatio * 100).toFixed(1)}%) | Audio preserved: ${hasAudio ? 'Yes' : 'No'}`);

  return {
    blob: compressedBlob,
    originalSizeMB,
    compressedSizeMB,
    compressionRatio,
  };
}

function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm;codecs=h264',
    'video/webm',
    'video/mp4',
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return 'video/webm'; // Fallback
}

export function shouldCompressVideo(file: File, maxSizeMB: number = 15): boolean {
  const sizeMB = file.size / (1024 * 1024);
  return sizeMB > maxSizeMB;
}
