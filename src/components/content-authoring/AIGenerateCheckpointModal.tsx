import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { 
  Zap, 
  X, 
  Loader2, 
  Info, 
  AlertTriangle,
  Link as LinkIcon
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey, getServerUrl } from '../../utils/supabase/info';
import { getSupabaseClient } from '../../utils/supabase/client';

interface SourceTrackInfo {
  trackId: string;
  trackTitle: string;
}

interface AIGenerateCheckpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (questions: any[], sourceInfo: {
    trackIds: string[];
    trackTitles: string[];
    factCount: number;
    thumbnailUrl?: string;
    metadata?: { suggestedTitle: string; suggestedDescription: string };
    // Legacy single-track fields for backward compatibility
    trackId: string;
    trackTitle: string;
  }) => void;
}

interface TrackWithRelationships {
  id: string;
  title: string;
  description: string;
  transcript: string;
  status: string;
  type: string;
  thumbnail_url: string;
  version_number?: number;
  is_latest_version?: boolean;
  relationshipCount?: number;
  relatedTracks?: Array<{
    id: string;
    title: string;
    type: string;
    relationship_type: string;
  }>;
}

export function AIGenerateCheckpointModal({ isOpen, onClose, onGenerate }: AIGenerateCheckpointModalProps) {
  const [tracks, setTracks] = useState<TrackWithRelationships[]>([]);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);

  // Question count settings
  const [useDefaultQuestions, setUseDefaultQuestions] = useState(true);
  const [minQuestions, setMinQuestions] = useState(3);
  const [maxQuestions, setMaxQuestions] = useState(10);

  // Use singleton Supabase client to avoid multiple GoTrueClient instances
  const supabase = getSupabaseClient();

  useEffect(() => {
    if (isOpen) {
      loadTracks();
    }
  }, [isOpen]);

  async function loadTracks() {
    setIsLoadingTracks(true);
    try {
      // Fetch tracks: exclude archived, only latest versions or non-versioned tracks
      const { data, error } = await supabase
        .from('tracks')
        .select('id, title, description, transcript, status, type, thumbnail_url, version_number, is_latest_version')
        .in('type', ['article', 'video', 'story'])
        .in('status', ['published', 'draft']) // Excludes archived
        .or('is_latest_version.eq.true,version_number.is.null') // Only latest versions or non-versioned
        .order('type') // Group by type
        .order('status', { ascending: false }) // Published first within each type
        .order('title');

      if (error) throw error;
      
      // Filter to only show video/story tracks that have transcripts
      const filteredTracks = (data || []).filter((track: any) => {
        if (track.type === 'article') return true; // Always show articles
        // Only show video/story if they have a transcript
        return track.transcript && track.transcript.trim().length > 0;
      });
      
      // Fetch relationship counts for all tracks
      if (filteredTracks.length > 0) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const accessToken = session?.access_token;
          
          if (accessToken) {
            const response = await fetch(
              `${getServerUrl()}/track-relationships/batch`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ 
                  trackIds: filteredTracks.map((t: any) => t.id) 
                })
              }
            );

            if (response.ok) {
              const { relationships } = await response.json();
              
              console.log('🔗 Raw relationships response:', relationships);
              console.log('🔗 Sample relationship:', Object.keys(relationships).length > 0 ? relationships[Object.keys(relationships)[0]] : 'none');
              
              // Merge relationship data with tracks
              const tracksWithRelationships = filteredTracks.map((track: any) => ({
                ...track,
                relationshipCount: relationships[track.id]?.derivedCount || 0,
                relatedTracks: relationships[track.id]?.derivedTracks || []
              }));
              
              console.log('🔗 Tracks with counts:', tracksWithRelationships.filter(t => t.relationshipCount > 0).map(t => ({ title: t.title, count: t.relationshipCount })));
              
              setTracks(tracksWithRelationships);
            } else {
              // If relationship fetch fails, still show tracks without counts
              console.warn('Failed to fetch relationships');
              setTracks(filteredTracks.map((t: any) => ({ ...t, relationshipCount: 0, relatedTracks: [] })));
            }
          } else {
            setTracks(filteredTracks.map((t: any) => ({ ...t, relationshipCount: 0, relatedTracks: [] })));
          }
        } catch (relError) {
          console.error('Error fetching relationships:', relError);
          // Still show tracks without relationship counts
          setTracks(filteredTracks.map((t: any) => ({ ...t, relationshipCount: 0, relatedTracks: [] })));
        }
      } else {
        setTracks([]);
      }
    } catch (error: any) {
      console.error('Error loading tracks:', error);
      toast.error('Failed to load content');
    } finally {
      setIsLoadingTracks(false);
    }
  }

  async function handleGenerate() {
    if (selectedTrackIds.length === 0) {
      toast.error('Please select at least one content item to generate from');
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch(
        `${getServerUrl()}/checkpoint-ai/ai-generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            trackIds: selectedTrackIds,
            ...(useDefaultQuestions ? {} : { minQuestions, maxQuestions })
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.needsFactExtraction) {
          toast.error(data.error, {
            duration: 6000,
            description: 'Open the content and use the "Generate Key Facts" button first.'
          });
        } else {
          toast.error(data.error || 'Failed to generate questions');
        }
        setIsGenerating(false);
        return;
      }

      const trackCount = data.sourceTrackIds?.length || 1;
      const trackDescription = trackCount > 1
        ? `${trackCount} source tracks`
        : `"${data.sourceTrackTitles?.[0] || data.sourceTrackTitle}"`;

      toast.success(`Generated ${data.questions.length} questions!`, {
        description: `Based on ${data.factCount} key facts from ${trackDescription}`
      });

      // Pass to parent with both legacy and new formats
      onGenerate(data.questions, {
        trackIds: data.sourceTrackIds || [data.sourceTrackId],
        trackTitles: data.sourceTrackTitles || [data.sourceTrackTitle],
        factCount: data.factCount,
        thumbnailUrl: data.thumbnailUrl,
        metadata: data.metadata,
        // Legacy fields for backward compatibility
        trackId: data.sourceTrackIds?.[0] || data.sourceTrackId,
        trackTitle: data.sourceTrackTitles?.[0] || data.sourceTrackTitle,
      });

      // Small delay before closing to ensure state updates complete
      setTimeout(() => {
        onClose();
        setIsGenerating(false);
      }, 300);

    } catch (error: any) {
      console.error('Error generating checkpoint:', error);
      toast.error('Failed to generate questions');
      setIsGenerating(false);
    }
  }

  if (!isOpen) return null;

  const selectedTracks = tracks.filter(t => selectedTrackIds.includes(t.id));
  const totalWordCount = selectedTracks.reduce((total, track) => {
    const content = track.transcript || track.description || '';
    return total + content.split(/\s+/).filter((w: string) => w.length > 0).length;
  }, 0);

  // Validation: max must be >= min
  const isQuestionCountValid = useDefaultQuestions || maxQuestions >= minQuestions;

  // Toggle track selection
  const toggleTrackSelection = (trackId: string) => {
    setSelectedTrackIds(prev =>
      prev.includes(trackId)
        ? prev.filter(id => id !== trackId)
        : [...prev, trackId]
    );
  };
  
  // Helper to get track type badge styling
  const getTrackTypeBadge = (type: string) => {
    const typeLabels: Record<string, string> = {
      article: 'Article',
      video: 'Video',
      story: 'Story'
    };
    
    return (
      <Badge className="bg-brand-gradient text-white text-xs px-2 py-0.5">
        {typeLabels[type] || type}
      </Badge>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header - fixed */}
        <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">AI-Assisted Checkpoint Generator</h2>
              <p className="text-sm text-muted-foreground">Generate questions from content with key facts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            disabled={isGenerating}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Track Selector */}
          <div>
            <Label htmlFor="track-select" className="text-sm font-medium mb-2 block">
              Select Source Content
            </Label>
            {isLoadingTracks ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : tracks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <p>No content available with key facts.</p>
                <p className="text-xs mt-1">Video/Story content must have transcripts.</p>
              </div>
            ) : (
              <div className="border border-border rounded-lg max-h-64 overflow-y-auto">
                {tracks.map(track => {
                  const isSelected = selectedTrackIds.includes(track.id);
                  return (
                    <div key={track.id} className="relative">
                      <button
                        type="button"
                        onClick={() => toggleTrackSelection(track.id)}
                        disabled={isGenerating}
                        className={`w-full px-3 py-2.5 text-left border-b border-border last:border-b-0 transition-colors ${
                          isSelected
                            ? 'bg-orange-500/10 border-l-2 border-l-orange-500'
                            : 'hover:bg-muted'
                        } ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Checkbox indicator */}
                          <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-orange-500 border-orange-500'
                              : 'border-muted-foreground/50'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">
                              {track.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {getTrackTypeBadge(track.type)}
                              <Badge variant="outline" className="text-xs">
                                {track.status}
                              </Badge>
                              {track.version_number && track.version_number > 1 && (
                                <Badge variant="outline" className="text-xs">
                                  V{track.version_number}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {track.relationshipCount! > 0 && (
                            <div
                              className="relative group flex-shrink-0"
                              onMouseEnter={() => setHoveredTrackId(track.id)}
                              onMouseLeave={() => setHoveredTrackId(null)}
                            >
                              <div className="flex items-center gap-1.5 cursor-help">
                                <LinkIcon className="w-3.5 h-3.5 text-blue-500" />
                                <span className="text-xs text-blue-500 font-medium">
                                  {track.relationshipCount} related
                                </span>
                              </div>
                              {hoveredTrackId === track.id && track.relatedTracks && track.relatedTracks.length > 0 && (
                                <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-popover border border-border rounded-lg shadow-lg p-3">
                                  <p className="text-xs font-semibold text-foreground mb-2">
                                    This {track.type} is already a source for:
                                  </p>
                                  <div className="space-y-2">
                                    {track.relatedTracks.map((relTrack) => (
                                      <div
                                        key={relTrack.id}
                                        className="text-xs text-muted-foreground bg-muted/50 rounded p-2 hover:bg-muted transition-colors"
                                      >
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.location.hash = `#/content-library?track=${relTrack.id}`;
                                          }}
                                          className="w-full text-left hover:text-foreground transition-colors"
                                        >
                                          <span className="font-medium text-foreground">{relTrack.title}</span>
                                          {' '}
                                          <Badge className="ml-1 text-xs px-1.5 py-0 bg-brand-gradient text-white">
                                            {relTrack.type}
                                          </Badge>
                                          <span className="text-muted-foreground">
                                            {' '}({relTrack.relationship_type === 'source' ? 'source' : relTrack.relationship_type})
                                          </span>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Tracks Info */}
          {selectedTracks.length > 0 && (
            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Selected ({selectedTracks.length} {selectedTracks.length === 1 ? 'track' : 'tracks'}):
                  </p>
                  <div className="mt-2 space-y-1.5 max-h-24 overflow-y-auto">
                    {selectedTracks.map(track => (
                      <div key={track.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleTrackSelection(track.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          disabled={isGenerating}
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <span className="text-sm text-muted-foreground truncate flex-1">{track.title}</span>
                        {getTrackTypeBadge(track.type)}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      Total: {totalWordCount.toLocaleString()} words
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Question Count Settings */}
          {selectedTracks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground">Number of questions:</span>
                <button
                  type="button"
                  onClick={() => setUseDefaultQuestions(!useDefaultQuestions)}
                  disabled={isGenerating}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-colors ${
                    useDefaultQuestions
                      ? 'bg-orange-500/10 border-orange-500/30 text-orange-500'
                      : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                  } ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                    useDefaultQuestions
                      ? 'bg-orange-500 border-orange-500'
                      : 'border-muted-foreground/50'
                  }`}>
                    {useDefaultQuestions && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm">default</span>
                </button>
              </div>

              {!useDefaultQuestions && (
                <div className="flex items-center gap-3 pl-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={3}
                      max={99}
                      value={minQuestions}
                      onChange={(e) => setMinQuestions(Math.min(99, Math.max(3, parseInt(e.target.value) || 3)))}
                      disabled={isGenerating}
                      className="w-14 px-2 py-1 text-sm border border-border rounded bg-background text-foreground text-center focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                    <span className="text-sm text-muted-foreground">minimum</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={3}
                      max={99}
                      value={maxQuestions}
                      onChange={(e) => setMaxQuestions(Math.min(99, Math.max(3, parseInt(e.target.value) || 10)))}
                      disabled={isGenerating}
                      className={`w-14 px-2 py-1 text-sm border rounded bg-background text-center focus:outline-none focus:ring-1 ${
                        !isQuestionCountValid
                          ? 'border-red-500 text-red-500 focus:ring-red-500'
                          : 'border-border text-foreground focus:ring-orange-500'
                      }`}
                    />
                    <span className="text-sm text-muted-foreground">maximum</span>
                  </div>
                </div>
              )}

              {!useDefaultQuestions && !isQuestionCountValid && (
                <div className="flex items-center gap-2 pl-4 text-red-500 text-xs">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Maximum must be equal to or greater than minimum</span>
                </div>
              )}
            </div>
          )}

          {/* Info Banner */}
          {selectedTracks.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
              <div className="flex gap-2">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-blue-400">
                    {selectedTracks.length === 1
                      ? 'Will generate 3-15 questions based on key facts and content length'
                      : `Will generate a combined quiz from ${selectedTracks.length} tracks, creating questions that span all selected content`
                    }
                  </p>
                  {totalWordCount < 300 && (
                    <p className="text-yellow-400 mt-2 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>Combined content is quite short ({totalWordCount} words). Questions may be limited.</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer - fixed */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border flex-shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={selectedTrackIds.length === 0 || isGenerating || !isQuestionCountValid}
            className="bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Generate Questions
                {selectedTrackIds.length > 1 && (
                  <span className="ml-1">({selectedTrackIds.length} tracks)</span>
                )}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}