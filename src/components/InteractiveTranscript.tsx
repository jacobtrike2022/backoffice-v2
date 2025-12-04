import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { MessageSquare, User, Sparkles } from 'lucide-react';

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

interface InteractiveTranscriptProps {
  transcript: {
    text?: string;
    words?: Word[];
    utterances?: Utterance[];
  } | null;
  currentTime: number;
  onSeek: (time: number) => void;
  canTranscribe?: boolean; // Can we generate a transcript?
  onTranscribe?: () => void; // Callback to generate transcript
  isTranscribing?: boolean; // Is transcription in progress?
  isEditMode?: boolean; // Are we in edit mode?
  onTranscriptEdit?: (editedText: string) => void; // Callback when transcript is edited
}

export function InteractiveTranscript({ 
  transcript, 
  currentTime, 
  onSeek, 
  canTranscribe, 
  onTranscribe, 
  isTranscribing,
  isEditMode = false,
  onTranscriptEdit
}: InteractiveTranscriptProps) {
  const [hoveredWord, setHoveredWord] = useState<number | null>(null);
  const [editedText, setEditedText] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const lastScrollTopRef = useRef<number>(0);

  // Initialize edited text when entering edit mode (only once!)
  useEffect(() => {
    if (isEditMode && transcript && !editedText) {
      // Only initialize if editedText is empty
      // Check for pre-edited text first, then reconstruct from utterances or words
      let fullText = '';
      if (transcript.text) {
        // Use pre-edited text if available (this preserves manual edits)
        fullText = transcript.text;
      } else if (transcript.utterances && transcript.utterances.length > 0) {
        fullText = transcript.utterances
          .map(utt => `Speaker ${utt.speaker}: ${utt.text}`)
          .join('\n\n');
      } else if (transcript.words && transcript.words.length > 0) {
        fullText = transcript.words.map(w => w.text).join(' ');
      }
      console.log('Initializing edit mode with text:', fullText.substring(0, 100) + '...');
      setEditedText(fullText);
    }
    
    // Clear editedText when exiting edit mode
    if (!isEditMode) {
      setEditedText('');
    }
  }, [isEditMode]); // Remove transcript and editedText from dependencies
  
  // Detect user scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const currentScrollTop = container.scrollTop;
      // If scroll position changed and it wasn't from our auto-scroll, mark as user scrolled
      if (Math.abs(currentScrollTop - lastScrollTopRef.current) > 50) {
        setUserHasScrolled(true);
      }
      lastScrollTopRef.current = currentScrollTop;
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle text changes in edit mode
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setEditedText(newText);
    if (onTranscriptEdit) {
      onTranscriptEdit(newText);
    }
  };

  // Debug: Log props
  useEffect(() => {
    console.log('InteractiveTranscript props:', { 
      hasTranscript: !!transcript, 
      currentTime,
      hasUtterances: transcript?.utterances?.length || 0,
      hasWords: transcript?.words?.length || 0,
      hasText: !!transcript?.text,
      textPreview: transcript?.text?.substring(0, 100)
    });
  }, [transcript, currentTime]);

  // Auto-scroll to current word (only in view mode and if user hasn't manually scrolled)
  useEffect(() => {
    if (isEditMode || !containerRef.current || userHasScrolled) return;
    
    const currentWordElement = containerRef.current.querySelector('.word-active');
    if (currentWordElement) {
      // Check if element is already in view
      const container = containerRef.current;
      const elementRect = currentWordElement.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      const isInView = (
        elementRect.top >= containerRect.top &&
        elementRect.bottom <= containerRect.bottom
      );
      
      // Only scroll if not in view
      if (!isInView) {
        lastScrollTopRef.current = container.scrollTop; // Track our auto-scroll
        currentWordElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }
  }, [currentTime, isEditMode, userHasScrolled]);

  const getSpeakerColor = (speaker: string) => {
    const colors = [
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    ];
    const index = speaker.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const formatTime = (milliseconds: number) => {
    const seconds = milliseconds / 1000;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isWordActive = (word: Word) => {
    // Convert milliseconds to seconds for comparison
    const wordStartSec = word.start / 1000;
    const wordEndSec = word.end / 1000;
    return currentTime >= wordStartSec && currentTime <= wordEndSec;
  };

  const handleWordClick = (startTime: number) => {
    // Convert milliseconds to seconds before seeking
    const timeInSeconds = startTime / 1000;
    console.log('Word clicked - converting', startTime, 'ms to', timeInSeconds, 'seconds');
    onSeek(timeInSeconds);
  };

  // If no transcript yet, show empty state with transcribe button (if eligible)
  if (!transcript || (!transcript.text && !transcript.words && !transcript.utterances)) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Transcript
            </CardTitle>
            {canTranscribe && onTranscribe && (
              <Button
                size="sm"
                variant="outline"
                onClick={onTranscribe}
                disabled={isTranscribing}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {isTranscribing ? 'Transcribing...' : 'Generate Transcript'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {isTranscribing ? (
              <div>
                <Sparkles className="h-8 w-8 mx-auto mb-2 animate-pulse text-primary" />
                <p>Generating transcript... This may take 30-60 seconds.</p>
              </div>
            ) : canTranscribe ? (
              <div>
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p>No transcript available yet.</p>
                <p className="text-sm mt-1">Click "Generate Transcript" to create one.</p>
              </div>
            ) : (
              <div>
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p>No transcript available.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // If we have utterances (speaker-separated), display them nicely
  if (transcript?.utterances && transcript.utterances.length > 0) {
    // EDIT MODE: Show editable textarea
    if (isEditMode) {
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Edit Transcript
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                Edit mode - Interactive features disabled
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <textarea
              value={editedText}
              onChange={handleTextChange}
              className="w-full h-96 p-4 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Edit transcript text here..."
            />
            <p className="text-xs text-muted-foreground mt-2">
              Note: Editing text will preserve word-level timestamps for highlighting. Minor mismatches between edited text and timestamps are expected.
            </p>
          </CardContent>
        </Card>
      );
    }

    // VIEW MODE: ALWAYS show interactive word-by-word version with highlighting
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Interactive Transcript
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              Click words to jump
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div 
            ref={containerRef}
            className="space-y-4 max-h-96 overflow-y-auto pr-2"
          >
            {transcript.utterances.map((utterance, uttIndex) => {
              // Check if we have edited text - if so, extract the edited words for this speaker
              let displayWords = utterance.words; // Default to original words
              
              if (transcript.text) {
                // Parse edited text to get this speaker's section
                const textParagraphs = transcript.text.split('\n\n');
                const speakerText = textParagraphs[uttIndex] || '';
                const speakerMatch = speakerText.match(/^Speaker ([A-Z]):\s*(.+)$/s);
                
                if (speakerMatch) {
                  const editedSpeakerText = speakerMatch[2].trim();
                  const editedWordsArray = editedSpeakerText.split(/\s+/); // Split by whitespace
                  
                  // Map edited words to original timestamps
                  displayWords = editedWordsArray.map((editedWord, idx) => {
                    const originalWord = utterance.words[idx];
                    if (originalWord) {
                      // Use edited text but keep original timestamps
                      return {
                        ...originalWord,
                        text: editedWord
                      };
                    }
                    // If we have more edited words than original, just use the edited word without timestamp
                    return {
                      text: editedWord,
                      start: 0,
                      end: 0,
                      confidence: 1
                    };
                  });
                }
              }
              
              return (
                <div 
                  key={uttIndex} 
                  className="border-l-2 border-muted pl-4 py-2 hover:border-primary/50 transition-colors"
                >
                  {/* Speaker badge with timestamp */}
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getSpeakerColor(utterance.speaker)}>
                      <User className="h-3 w-3 mr-1" />
                      Speaker {utterance.speaker}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-2 text-xs text-muted-foreground hover:text-primary"
                      onClick={() => handleWordClick(utterance.start)}
                    >
                      {formatTime(utterance.start)}
                    </Button>
                  </div>

                  {/* Words with highlighting - uses edited text if available */}
                  <div className="flex flex-wrap gap-1">
                    {displayWords.map((word, wordIndex) => {
                      const active = isWordActive(word);
                      return (
                        <span
                          key={`${uttIndex}-${wordIndex}`}
                          onClick={() => handleWordClick(word.start)}
                          onMouseEnter={() => setHoveredWord(wordIndex)}
                          onMouseLeave={() => setHoveredWord(null)}
                          className={`
                            cursor-pointer px-1 py-0.5 rounded transition-all
                            ${active ? 'word-active bg-primary text-primary-foreground font-semibold' : ''}
                            ${hoveredWord === wordIndex && !active ? 'bg-muted' : ''}
                            ${!active ? 'hover:bg-muted' : ''}
                          `}
                          title={`${formatTime(word.start)} - Confidence: ${Math.round(word.confidence * 100)}%`}
                        >
                          {word.text}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Fallback: If we only have words (no speaker diarization)
  if (transcript?.words && transcript.words.length > 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Interactive Transcript
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              Click words to jump
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div 
            ref={containerRef}
            className="flex flex-wrap gap-1 max-h-96 overflow-y-auto pr-2"
          >
            {transcript.words.map((word, index) => {
              const active = isWordActive(word);
              return (
                <span
                  key={index}
                  onClick={() => handleWordClick(word.start)}
                  onMouseEnter={() => setHoveredWord(index)}
                  onMouseLeave={() => setHoveredWord(null)}
                  className={`
                    cursor-pointer px-1 py-0.5 rounded transition-all
                    ${active ? 'word-active bg-primary text-primary-foreground font-semibold' : ''}
                    ${hoveredWord === index && !active ? 'bg-muted' : ''}
                    ${!active ? 'hover:bg-muted' : ''}
                  `}
                  title={`${formatTime(word.start)} - Confidence: ${Math.round(word.confidence * 100)}%`}
                >
                  {word.text}
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Fallback: Plain text transcript
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Transcript
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {transcript?.text || 'No transcript available'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}