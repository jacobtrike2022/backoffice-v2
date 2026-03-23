// ============================================================================
// TRACK DURATION CALCULATION UTILITIES
// ============================================================================

/**
 * Calculate article duration based on word count and WPM (words per minute)
 * Formula: wordCount / WPM = minutes
 * Default WPM: 200 (standard reading speed)
 */
export function calculateArticleDuration(htmlContent: string, wpm: number = 200): number {
  if (!htmlContent) return 0;
  
  // Strip HTML tags and get plain text
  const plainText = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Count words
  const wordCount = plainText.split(/\s+/).filter(word => word.length > 0).length;
  
  if (wordCount === 0) return 0;
  
  // Calculate reading time (words per minute)
  const readingTime = Math.ceil(wordCount / wpm);
  
  // Minimum 1 minute for any content
  return Math.max(1, readingTime);
}

/**
 * Calculate story duration by summing only video slide durations
 * Ignores image slides - only counts videos
 */
export function calculateStoryDuration(storyData: any): number {
  if (!storyData || !storyData.slides || !Array.isArray(storyData.slides)) {
    return 0;
  }
  
  // Filter to only video slides
  const videoSlides = storyData.slides.filter((slide: any) => slide.type === 'video' && slide.url);
  
  if (videoSlides.length === 0) return 0;
  
  // Sum up video durations (in seconds)
  const totalSeconds = videoSlides.reduce((total: number, slide: any) => {
    if (slide.duration && !isNaN(slide.duration) && slide.duration > 0) {
      return total + slide.duration;
    }
    // If video has URL but no duration, skip it (should have duration from upload)
    return total;
  }, 0);
  
  if (totalSeconds === 0) return 0;
  
  // Convert to minutes, minimum 1 minute for valid content
  return Math.max(1, Math.round(totalSeconds / 60));
}

/**
 * Calculate checkpoint duration based on timeLimit or number of questions
 * Priority: timeLimit (if set) > questionCount * 0.5 minutes per question
 */
export function calculateCheckpointDuration(checkpointData: any): number {
  if (!checkpointData) return 0;

  // Parse checkpoint data if it's a string
  let parsed: any = {};
  if (typeof checkpointData === 'string') {
    try {
      parsed = JSON.parse(checkpointData);
    } catch (e) {
      return 0;
    }
  } else {
    parsed = checkpointData;
  }

  // If timeLimit is set (not null/undefined), use it
  if (parsed.timeLimit != null && parsed.timeLimit !== '') {
    const timeLimit = typeof parsed.timeLimit === 'string'
      ? parseInt(parsed.timeLimit)
      : parsed.timeLimit;
    if (!isNaN(timeLimit) && timeLimit > 0) {
      return timeLimit;
    }
  }

  // Fall back to question count calculation (0.5 min per question, rounded up)
  const questions = parsed.questions || [];
  if (questions.length === 0) return 0;

  return Math.ceil(questions.length * 0.5);
}

/**
 * Calculate duration for any track type based on its content
 * This is the main function to use when saving/updating tracks
 */
export function calculateTrackDuration(
  trackType: 'video' | 'article' | 'story' | 'checkpoint',
  content: {
    transcript?: string; // For articles (HTML content) or checkpoints (JSON)
    storyData?: any; // For stories (parsed JSON)
    checkpointData?: any; // For checkpoints (parsed JSON or string)
    duration_minutes?: number; // For videos (already extracted from media)
  }
): number | undefined {
  switch (trackType) {
    case 'article':
      if (content.transcript) {
        return calculateArticleDuration(content.transcript);
      }
      return undefined;
      
    case 'story':
      if (content.storyData) {
        return calculateStoryDuration(content.storyData);
      }
      // Try parsing from transcript if storyData not provided
      if (content.transcript) {
        try {
          const storyData = typeof content.transcript === 'string' 
            ? JSON.parse(content.transcript) 
            : content.transcript;
          return calculateStoryDuration(storyData);
        } catch (e) {
          return undefined;
        }
      }
      return undefined;
      
    case 'checkpoint':
      if (content.checkpointData) {
        return calculateCheckpointDuration(content.checkpointData);
      }
      // Try parsing from transcript if checkpointData not provided
      if (content.transcript) {
        return calculateCheckpointDuration(content.transcript);
      }
      return undefined;
      
    case 'video':
      // Video duration should already be extracted from media file
      // Return the provided duration_minutes or undefined
      return content.duration_minutes;
      
    default:
      return undefined;
  }
}

