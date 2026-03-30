import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { MessageSquare, Loader2, AlertCircle, Video as VideoIcon } from 'lucide-react';
import { getServerUrl } from '../../utils/supabase/info';

interface Word {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: string;
}

interface Utterance {
  speaker: string;
  start: number;
  end: number;
  text: string;
  words: Word[];
  confidence: number;
}

interface VideoTranscript {
  slideName: string;
  slideId: string;
  slideOrder: number;
  transcript?: {
    text: string;
    words: Word[];
    utterances: Utterance[];
    confidence: number;
    audio_duration: number;
  };
  error?: string;
}

interface StoryTranscriptProps {
  storyData: string | any[] | { slides: any[] }; // JSON string, parsed array of slides, or object with slides property
  trackId: string;
  projectId: string;
  publicAnonKey: string;
  onTranscriptsGenerated?: (transcripts: VideoTranscript[]) => void; // Callback to save transcripts to slides
  readOnly?: boolean; // Hide regenerate/generate buttons (for KB view)
}

// Helper function to extract slides array from various data formats
const extractSlides = (data: string | any[] | { slides: any[] }): any[] => {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    // Handle object with slides property
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.slides)) {
      return parsed.slides;
    }
    // Handle direct array
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (e) {
    console.error('Error extracting slides:', e);
    return [];
  }
};

export function StoryTranscript({ storyData, trackId, projectId, publicAnonKey, onTranscriptsGenerated, readOnly }: StoryTranscriptProps) {
  const { t } = useTranslation();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcripts, setTranscripts] = useState<VideoTranscript[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasTranscripts, setHasTranscripts] = useState(false);

  // Load existing transcripts from slides on mount
  useEffect(() => {
    try {
      const slides = extractSlides(storyData);
      const existingTranscripts: VideoTranscript[] = slides
        .filter((slide: any) => slide.type === 'video' && slide.transcript)
        .map((slide: any, index: number) => ({
          slideName: slide.name,
          slideId: slide.id,
          slideOrder: slide.order,
          transcript: slide.transcript
        }));
      
      if (existingTranscripts.length > 0) {
        console.log('📝 Loaded existing transcripts from slides:', existingTranscripts.length);
        setTranscripts(existingTranscripts);
        setHasTranscripts(true);
      }
    } catch (e) {
      console.error('Error loading existing transcripts:', e);
    }
  }, [storyData]);

  // Check if we have video slides with audio
  const hasVideoSlides = () => {
    const slides = extractSlides(storyData);
    return slides.some((slide: any) => slide.type === 'video' && slide.url);
  };

  // Transcribe all video slides
  const handleTranscribe = async () => {
    setIsTranscribing(true);
    setError(null);

    try {
      console.log('🎬 Starting story transcription...');

      // Extract slides from storyData
      const slides = extractSlides(storyData);

      if (!trackId || !slides || slides.length === 0) {
        throw new Error('Missing track ID or no slides available');
      }

      console.log('📤 Sending transcription request:', { trackId, slidesCount: slides.length });

      const response = await fetch(
        `${getServerUrl()}/transcribe-story`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            trackId: trackId,
            slides: slides,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to transcribe story');
      }

      const data = await response.json();
      console.log('✅ Story transcription complete:', data);
      
      // Sort transcripts by slide order
      const sortedTranscripts = (data.transcripts || []).sort(
        (a: VideoTranscript, b: VideoTranscript) => a.slideOrder - b.slideOrder
      );
      
      setTranscripts(sortedTranscripts);
      setHasTranscripts(sortedTranscripts.length > 0);
      
      // Notify parent to save transcripts to slides
      if (onTranscriptsGenerated) {
        onTranscriptsGenerated(sortedTranscripts);
      }
      
      if (data.errorCount > 0) {
        setError(`${data.errorCount} video(s) failed to transcribe. See details below.`);
      }
    } catch (err: any) {
      console.error('Story transcription error:', err);
      setError(err.message || 'Failed to transcribe story videos');
    } finally {
      setIsTranscribing(false);
    }
  };

  if (!hasVideoSlides()) {
    return null; // Don't show transcript section if there are no videos
  }

  // In readOnly mode, don't show anything if there are no transcripts
  if (readOnly && !hasTranscripts) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t('contentAuthoring.storyTranscriptTitle')}
          </CardTitle>
          {!hasTranscripts && !readOnly && (
            <Button
              onClick={handleTranscribe}
              disabled={isTranscribing}
              size="sm"
              className="hero-primary"
            >
              {isTranscribing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('contentAuthoring.transcribing')}
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {t('contentAuthoring.generateTranscripts')}
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">{error}</p>
          </div>
        )}

        {isTranscribing && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">{t('contentAuthoring.processingVideoTranscripts')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('contentAuthoring.processingMayTakeMinutes')}
              </p>
            </div>
          </div>
        )}

        {!isTranscribing && !hasTranscripts && !readOnly && (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t('contentAuthoring.noTranscriptsYet')}</p>
          </div>
        )}

        {hasTranscripts && transcripts.length > 0 && (
          <div className="space-y-6">
            {transcripts.map((videoTranscript, index) => (
              <div key={videoTranscript.slideId} className="space-y-3">
                {/* Video Title */}
                <div className="flex items-center gap-2 pb-2 border-b">
                  <VideoIcon className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">{videoTranscript.slideName}</h3>
                  <Badge variant="outline" className="text-xs">
                    {t('contentAuthoring.slideLabel', { number: videoTranscript.slideOrder + 1 })}
                  </Badge>
                </div>

                {/* Transcript Content */}
                {videoTranscript.error ? (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-800 dark:text-red-200">
                      ❌ Failed to transcribe: {videoTranscript.error}
                    </p>
                  </div>
                ) : videoTranscript.transcript ? (
                  <div className="space-y-3">
                    {/* Speaker-based transcript */}
                    {videoTranscript.transcript.utterances && videoTranscript.transcript.utterances.length > 0 ? (
                      <div className="space-y-3">
                        {videoTranscript.transcript.utterances.map((utterance, uttIndex) => (
                          <div key={uttIndex} className="flex gap-3">
                            <Badge 
                              variant="outline" 
                              className="flex-shrink-0 h-6 bg-primary/10 text-primary border-primary/30"
                            >
                              {utterance.speaker}
                            </Badge>
                            <p className="text-sm leading-relaxed flex-1">
                              {utterance.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Fallback to plain text */
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {videoTranscript.transcript.text}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            ))}

            {/* Regenerate button - only shown in edit mode */}
            {!readOnly && (
              <div className="pt-4 border-t">
                <Button
                  onClick={handleTranscribe}
                  disabled={isTranscribing}
                  variant="outline"
                  size="sm"
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('contentAuthoring.regenerating')}
                    </>
                  ) : (
                    t('contentAuthoring.regenerateTranscripts')
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}