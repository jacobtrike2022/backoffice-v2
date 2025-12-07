import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

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
  const audioRef = useRef<HTMLAudioElement>(null);

  // Generate TTS if no audio URL exists
  useEffect(() => {
    if (!audioUrl) {
      generateTTS(voice);
    }
  }, []);

  async function generateTTS(selectedVoice: string) {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b/tts/generate`,
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
    if (audioRef.current) {
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
          <Volume2 className="w-5 h-5" />
          <div>
            <div className="font-medium">Audio generation failed</div>
            <div className="text-sm text-red-400/70">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-4 mb-6 border border-gray-700">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-orange-500 border-t-transparent" />
          <div>
            <span className="text-sm text-gray-300">Generating audio narration...</span>
            <div className="text-xs text-gray-500 mt-0.5">Using OpenAI TTS with {VOICES.find(v => v.id === voice)?.label}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!audioUrl) return null;

  return (
    <div className="bg-gradient-to-r from-gray-800/70 to-gray-800/50 rounded-lg p-4 mb-6 border border-gray-700/50">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      />

      <div className="flex items-center gap-4">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-orange-500/20 flex-shrink-0"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white ml-0.5" />
          )}
        </button>

        {/* Progress Bar Container */}
        <div className="flex-1 min-w-0">
          {/* Slider */}
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer tts-progress-bar"
            style={{
              background: `linear-gradient(to right, #FF6B35 0%, #FF6B35 ${(currentTime / duration) * 100}%, #374151 ${(currentTime / duration) * 100}%, #374151 100%)`
            }}
            aria-label="Audio progress"
          />
          {/* Time Display */}
          <div className="flex justify-between text-xs text-gray-400 mt-1.5">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls (Speed + Voice) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Playback Speed */}
          <select
            value={playbackRate}
            onChange={(e) => changePlaybackRate(parseFloat(e.target.value))}
            className="bg-gray-700 text-white text-sm rounded px-2 py-1.5 border border-gray-600 hover:bg-gray-600 transition-colors min-w-[70px]"
            aria-label="Playback speed"
          >
            <option value="0.75">0.75×</option>
            <option value="1">1×</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>

          {/* Voice Selector (Admin Only) */}
          {showVoiceSelector && (
            <select
              value={voice}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="bg-gray-700 text-white text-sm rounded px-3 py-1.5 border border-gray-600 hover:bg-gray-600 transition-colors min-w-[140px]"
              aria-label="Voice selection"
            >
              {VOICES.map(v => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
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
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }

        .tts-progress-bar::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #FF6B35;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
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
