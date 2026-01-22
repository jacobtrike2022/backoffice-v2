import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, FastForward, Radio, Loader2, Mic2 } from 'lucide-react';
import { projectId, publicAnonKey, getServerUrl } from '../../utils/supabase/info';

const VOICES = [
  { id: 'alloy', label: 'Alloy (Neutral)', description: 'Balanced voice' },
  { id: 'echo', label: 'Echo (Male)', description: 'Clear & professional' },
  { id: 'onyx', label: 'Onyx (Male)', description: 'Deep & authoritative' },
  { id: 'nova', label: 'Nova (Female)', description: 'Warm & friendly' },
  { id: 'shimmer', label: 'Shimmer (Female)', description: 'Bright & energetic' }
];

interface TTSPlayerProps {
  trackId: string;
  initialAudioUrl?: string;
  initialVoice?: string;
  showVoiceSelector?: boolean; // Only true on admin page
  onAudioGenerated?: (audioUrl: string, voice: string) => void;
}

export function TTSPlayer({ 
  trackId, 
  initialAudioUrl, 
  initialVoice = 'alloy',
  showVoiceSelector = false,
  onAudioGenerated
}: TTSPlayerProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(initialAudioUrl || null);
  const [voice, setVoice] = useState<string>(initialVoice);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const speedButtonRef = useRef<HTMLButtonElement>(null);
  const voiceButtonRef = useRef<HTMLButtonElement>(null);

  // Always verify TTS with backend on mount/refresh
  // The backend uses content hashing to determine if regeneration is needed
  useEffect(() => {
    // Reset state when trackId changes
    setVoice(initialVoice);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError(null);

    // ALWAYS call backend to verify/generate TTS
    // The backend compares content hash and returns cached audio if unchanged,
    // or regenerates if the article body has been modified.
    // This ensures edits to article content trigger proper regeneration
    // while metadata-only changes (tags, thumbnail) use cached audio.
    setAudioUrl(null); // Clear to show loading state
    generateTTS(initialVoice);
  }, [trackId, initialVoice]); // Re-run when trackId or voice changes (not initialAudioUrl)

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (showSpeedMenu && speedButtonRef.current && 
          !speedButtonRef.current.contains(event.target as Node) &&
          !(event.target as HTMLElement).closest('.speed-menu')) {
        setShowSpeedMenu(false);
      }
      if (showVoiceMenu && voiceButtonRef.current && 
          !voiceButtonRef.current.contains(event.target as Node) &&
          !(event.target as HTMLElement).closest('.voice-menu')) {
        setShowVoiceMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSpeedMenu, showVoiceMenu]);

  async function generateTTS(selectedVoice: string) {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(
        `${getServerUrl()}/tts/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ 
            trackId, 
            voice: selectedVoice 
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate audio');
      }

      const data = await response.json();
      setAudioUrl(data.audioUrl);
      setVoice(selectedVoice);
      
      if (onAudioGenerated) {
        onAudioGenerated(data.audioUrl, selectedVoice);
      }

      console.log('✅ TTS audio generated:', { 
        audioUrl: data.audioUrl, 
        voice: selectedVoice,
        cached: data.cached 
      });
    } catch (err: any) {
      console.error('❌ Error generating TTS:', err);
      setError(err.message || 'Failed to generate audio');
    } finally {
      setIsGenerating(false);
    }
  }

  function togglePlay() {
    if (audioRef.current && !isGenerating) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }

  function handleTimeUpdate() {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }

  function handleLoadedMetadata() {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }

  function changePlaybackRate(rate: number) {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  }

  function handleVoiceChange(newVoice: string) {
    if (newVoice === voice) return;
    
    // Regenerate audio with new voice
    setVoice(newVoice);
    setAudioUrl(null); // Clear current audio
    setIsPlaying(false);
    setCurrentTime(0);
    generateTTS(newVoice);
  }

  function formatTime(seconds: number): string {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-3 text-red-400">
          <Mic2 className="w-5 h-5" />
          <div>
            <div className="font-medium">Audio generation failed</div>
            <div className="text-sm text-red-400/70">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  // Show inactive player during generation
  const isInactive = isGenerating || !audioUrl;

  return (
    <div className="bg-transparent rounded-lg p-4 mb-6">
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      />

      <div className="flex items-center gap-4">
        {/* Play/Pause Button with Loading Spinner */}
        <button
          onClick={togglePlay}
          disabled={isInactive}
          className="relative w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-orange-500/20 flex-shrink-0 disabled:cursor-not-allowed"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isGenerating ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white ml-0.5" />
          )}
        </button>

        {/* Progress Bar Container */}
        <div className={`flex-1 min-w-0 transition-opacity ${isInactive ? 'opacity-30' : ''}`}>
          {/* Slider */}
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            disabled={isInactive}
            className="w-full h-2 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer tts-progress-bar disabled:cursor-not-allowed"
            style={{
              background: `linear-gradient(to right, #FF6B35 0%, #FF6B35 ${(currentTime / duration) * 100}%, rgb(209 213 219) ${(currentTime / duration) * 100}%, rgb(209 213 219) 100%)`
            }}
            aria-label="Audio progress"
          />
          {/* Time Display */}
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls (Speed + Voice) */}
        <div className={`flex items-center gap-2 flex-shrink-0 transition-opacity ${isInactive ? 'opacity-30' : ''}`}>
          {/* Playback Speed */}
          <div className="relative">
            <button
              ref={speedButtonRef}
              onClick={() => !isInactive && setShowSpeedMenu(!showSpeedMenu)}
              disabled={isInactive}
              className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center disabled:cursor-not-allowed"
              aria-label="Playback speed"
            >
              <FastForward className="w-4 h-4" />
            </button>

            {showSpeedMenu && (
              <div className="speed-menu absolute bottom-full right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden z-10 min-w-[120px]">
                {[0.75, 1, 1.25, 1.5, 2].map(rate => (
                  <button
                    key={rate}
                    onClick={() => {
                      changePlaybackRate(rate);
                      setShowSpeedMenu(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                      playbackRate === rate 
                        ? 'bg-orange-500 text-white' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {rate}× speed
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Voice Selector (Admin Only) */}
          {showVoiceSelector && (
            <div className="relative">
              <button
                ref={voiceButtonRef}
                onClick={() => !isInactive && setShowVoiceMenu(!showVoiceMenu)}
                disabled={isInactive}
                className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center disabled:cursor-not-allowed"
                aria-label="Voice selection"
              >
                <Radio className="w-4 h-4" />
              </button>

              {showVoiceMenu && (
                <div className="voice-menu absolute bottom-full right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden z-10 min-w-[200px]">
                  {VOICES.map(v => (
                    <button
                      key={v.id}
                      onClick={() => {
                        handleVoiceChange(v.id);
                        setShowVoiceMenu(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left transition-colors ${
                        voice === v.id 
                          ? 'bg-orange-500 text-white' 
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="text-sm font-medium">{v.label}</div>
                      <div className={`text-xs ${voice === v.id ? 'text-orange-100' : 'text-gray-500 dark:text-gray-400'}`}>
                        {v.description}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .tts-progress-bar::-webkit-slider-thumb {
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #FF6B35;
          cursor: pointer;
          border: 2px solid #4a4a4a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }

        .tts-progress-bar::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #FF6B35;
          cursor: pointer;
          border: 2px solid #4a4a4a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }

        .tts-progress-bar:disabled::-webkit-slider-thumb {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .tts-progress-bar:disabled::-moz-range-thumb {
          cursor: not-allowed;
          opacity: 0.5;
        }

        @media (prefers-color-scheme: light) {
          .tts-progress-bar {
            background: linear-gradient(to right, #FF6B35 0%, #FF6B35 var(--progress, 0%), rgb(209 213 219) var(--progress, 0%), rgb(209 213 219) 100%) !important;
          }
        }

        @media (prefers-color-scheme: dark) {
          .tts-progress-bar {
            background: linear-gradient(to right, #FF6B35 0%, #FF6B35 var(--progress, 0%), rgb(55 65 81) var(--progress, 0%), rgb(55 65 81) 100%) !important;
          }
          
          .tts-progress-bar::-webkit-slider-thumb {
            border-color: rgb(31 41 55);
          }
          
          .tts-progress-bar::-moz-range-thumb {
            border-color: rgb(31 41 55);
          }
        }

        @media (max-width: 640px) {
          .tts-progress-bar {
            height: 4px;
          }

          .tts-progress-bar::-webkit-slider-thumb {
            width: 16px;
            height: 16px;
          }

          .tts-progress-bar::-moz-range-thumb {
            width: 16px;
            height: 16px;
          }
        }
      `}</style>
    </div>
  );
}