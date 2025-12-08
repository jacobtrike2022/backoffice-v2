import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { 
  Zap, 
  X, 
  Loader2, 
  Info, 
  AlertTriangle 
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { getSupabaseClient } from '../../utils/supabase/client';

interface AIGenerateCheckpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (questions: any[], sourceInfo: { trackId: string; trackTitle: string; factCount: number; metadata?: { suggestedTitle: string; suggestedDescription: string } }) => void;
}

export function AIGenerateCheckpointModal({ isOpen, onClose, onGenerate }: AIGenerateCheckpointModalProps) {
  const [tracks, setTracks] = useState<any[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

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
      const { data, error } = await supabase
        .from('tracks')
        .select('id, title, description, transcript, status')
        .eq('type', 'article')
        .in('status', ['published', 'draft'])
        .order('status', { ascending: false }) // Published first
        .order('title');

      if (error) throw error;
      
      setTracks(data || []);
    } catch (error: any) {
      console.error('Error loading tracks:', error);
      toast.error('Failed to load articles');
    } finally {
      setIsLoadingTracks(false);
    }
  }

  async function handleGenerate() {
    if (!selectedTrackId) {
      toast.error('Please select an article');
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b/checkpoint-ai/ai-generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ trackId: selectedTrackId })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.needsFactExtraction) {
          toast.error(data.error, {
            duration: 6000,
            description: 'Open the article and use the "Generate Key Facts" button first.'
          });
        } else {
          toast.error(data.error || 'Failed to generate questions');
        }
        return;
      }

      toast.success(`Generated ${data.questions.length} questions!`, {
        description: `Based on ${data.factCount} key facts from "${data.sourceTrackTitle}"`
      });

      // Pass to parent
      onGenerate(data.questions, {
        trackId: data.sourceTrackId,
        trackTitle: data.sourceTrackTitle,
        factCount: data.factCount,
        metadata: data.metadata
      });
      
      onClose();

    } catch (error: any) {
      console.error('Error generating questions:', error);
      toast.error('Failed to generate questions');
    } finally {
      setIsGenerating(false);
    }
  }

  if (!isOpen) return null;

  const selectedTrack = tracks.find(t => t.id === selectedTrackId);
  const wordCount = selectedTrack 
    ? (selectedTrack.transcript || selectedTrack.description || '').split(/\s+/).filter((w: string) => w.length > 0).length 
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">AI-Assisted Checkpoint Generator</h2>
              <p className="text-sm text-muted-foreground">Generate questions from article key facts</p>
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

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Track Selector */}
          <div>
            <Label htmlFor="track-select" className="text-sm font-medium mb-2 block">
              Select Source Article
            </Label>
            {isLoadingTracks ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <select
                id="track-select"
                value={selectedTrackId}
                onChange={(e) => setSelectedTrackId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
                disabled={isGenerating}
              >
                <option value="">Choose an article...</option>
                {tracks.map(track => (
                  <option key={track.id} value={track.id}>
                    {track.title} ({track.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Info/Warning Banners */}
          {selectedTrack && (
            <>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
                <div className="flex gap-2">
                  <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-blue-400">
                    Will generate 3-15 questions based on key facts and content length
                  </p>
                </div>
              </div>

              {wordCount < 300 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm">
                  <div className="flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <p className="text-yellow-400">
                      This article is quite short ({wordCount} words). Questions may be limited.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!selectedTrackId || isGenerating}
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
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}