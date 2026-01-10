import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Checkbox } from './ui/checkbox';
import {
  Loader2,
  Zap,
  FileText,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase, supabaseAnonKey } from '../lib/supabase';
import { getServerUrl } from '../utils/supabase/info';

interface Chunk {
  id: string;
  chunk_index: number;
  title: string;
  summary?: string;
  word_count: number;
  chunk_type: string;
  is_converted?: boolean;
}

interface ChunkToTrackGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedChunks: Chunk[];
  sourceFileName: string;
  onTracksGenerated?: (tracks: any[]) => void;
}

export function ChunkToTrackGenerator({
  isOpen,
  onClose,
  selectedChunks,
  sourceFileName,
  onTracksGenerated,
}: ChunkToTrackGeneratorProps) {
  const [mode, setMode] = useState<'individual' | 'combined'>('individual');
  const [combinedTitle, setCombinedTitle] = useState('');
  const [publishImmediately, setPublishImmediately] = useState(false);
  const [skipAI, setSkipAI] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<{
    success: boolean;
    tracks?: any[];
    error?: string;
  } | null>(null);

  const totalWords = selectedChunks.reduce((sum, c) => sum + (c.word_count || 0), 0);
  const estimatedMinutes = Math.ceil(totalWords / 200);
  const alreadyConverted = selectedChunks.filter(c => c.is_converted).length;

  const handleGenerate = async () => {
    setGenerating(true);
    setResults(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const serverUrl = getServerUrl();
      const chunkIds = selectedChunks.map(c => c.id);

      let response;
      if (mode === 'individual') {
        response = await fetch(`${serverUrl}/generate-tracks-from-chunks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({
            chunk_ids: chunkIds,
            options: {
              publish: publishImmediately,
              skipAI: skipAI,
            },
          }),
        });
      } else {
        response = await fetch(`${serverUrl}/generate-combined-track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({
            chunk_ids: chunkIds,
            title: combinedTitle || undefined,
            options: {
              publish: publishImmediately,
              skipAI: skipAI,
            },
          }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      const tracks = mode === 'individual' ? data.tracks : [data.track];
      setResults({ success: true, tracks });

      toast.success(
        mode === 'individual'
          ? `Generated ${tracks.length} tracks`
          : 'Generated combined track',
        { description: `Processing took ${data.processing_time_ms}ms` }
      );

      onTracksGenerated?.(tracks);

    } catch (error: any) {
      console.error('Generation error:', error);
      setResults({ success: false, error: error.message });
      toast.error('Generation failed', { description: error.message });
    } finally {
      setGenerating(false);
    }
  };

  const handleClose = () => {
    setResults(null);
    setMode('individual');
    setCombinedTitle('');
    setPublishImmediately(false);
    setSkipAI(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#F74A05]" />
            Generate Training Content
          </DialogTitle>
          <DialogDescription>
            Convert {selectedChunks.length} chunk{selectedChunks.length !== 1 ? 's' : ''} into training tracks
          </DialogDescription>
        </DialogHeader>

        {!results ? (
          <>
            {/* Source Info */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{sourceFileName}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{selectedChunks.length} chunks selected</span>
                <span>{totalWords.toLocaleString()} total words</span>
                <span>~{estimatedMinutes} min read</span>
              </div>
              {alreadyConverted > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>{alreadyConverted} chunk{alreadyConverted !== 1 ? 's' : ''} already converted</span>
                </div>
              )}
            </div>

            {/* Generation Mode */}
            <div className="space-y-3">
              <Label>Generation Mode</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'individual' | 'combined')}>
                <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 cursor-pointer">
                  <RadioGroupItem value="individual" id="individual" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="individual" className="cursor-pointer font-medium">
                      Individual Tracks
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Create {selectedChunks.length} separate track{selectedChunks.length !== 1 ? 's' : ''}, one per chunk.
                      Best for distinct topics.
                    </p>
                  </div>
                  <Badge variant="secondary">{selectedChunks.length} tracks</Badge>
                </div>
                <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 cursor-pointer">
                  <RadioGroupItem value="combined" id="combined" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="combined" className="cursor-pointer font-medium">
                      Combined Track
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Merge all chunks into a single comprehensive track with sections.
                      Best for related content.
                    </p>
                  </div>
                  <Badge variant="secondary">1 track</Badge>
                </div>
              </RadioGroup>
            </div>

            {/* Combined Title */}
            {mode === 'combined' && (
              <div className="space-y-2">
                <Label htmlFor="combinedTitle">Module Title (optional)</Label>
                <Input
                  id="combinedTitle"
                  placeholder="e.g., Employee Safety Guidelines"
                  value={combinedTitle}
                  onChange={(e) => setCombinedTitle(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to auto-generate a title
                </p>
              </div>
            )}

            {/* Options */}
            <div className="space-y-3 pt-2">
              <Label>Options</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="publish"
                    checked={publishImmediately}
                    onCheckedChange={(c) => setPublishImmediately(c === true)}
                  />
                  <Label htmlFor="publish" className="text-sm cursor-pointer">
                    Publish immediately (otherwise saves as draft)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="skipAI"
                    checked={skipAI}
                    onCheckedChange={(c) => setSkipAI(c === true)}
                  />
                  <Label htmlFor="skipAI" className="text-sm cursor-pointer">
                    Skip AI enhancement (faster, uses raw content)
                  </Label>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Layers className="h-4 w-4" />
                Preview
              </div>
              <div
                className="text-sm text-muted-foreground space-y-1"
                style={{ maxHeight: '150px', overflowY: 'auto' }}
              >
                {mode === 'individual' ? (
                  selectedChunks.map((chunk, i) => (
                    <div key={chunk.id} className="flex items-center gap-2">
                      <ArrowRight className="h-3 w-3 shrink-0" />
                      <span className="truncate">{chunk.title || `Chunk ${chunk.chunk_index + 1}`}</span>
                      <span className="text-xs">({chunk.word_count} words)</span>
                    </div>
                  ))
                ) : (
                  <div>
                    <div className="font-medium text-foreground mb-1">
                      {combinedTitle || 'Auto-generated Title'}
                    </div>
                    {selectedChunks.map((chunk, i) => (
                      <div key={chunk.id} className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-muted-foreground">{i + 1}</span>
                        <span className="truncate">{chunk.title || `Section ${i + 1}`}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Results */
          <div className="space-y-4">
            {results.success ? (
              <>
                <div className="flex items-center gap-3 text-green-600">
                  <CheckCircle2 className="h-8 w-8" />
                  <div>
                    <p className="font-semibold text-lg">Generation Complete!</p>
                    <p className="text-sm text-muted-foreground">
                      Created {results.tracks?.length} track{results.tracks?.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="border rounded-lg divide-y">
                  {results.tracks?.map((track, i) => (
                    <div key={track.track_id || track.id} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{track.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {track.status === 'published' ? 'Published' : 'Draft'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Navigate to track editor
                          window.open(`/content-authoring?track=${track.track_id || track.id}`, '_blank');
                        }}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 text-red-600">
                <AlertCircle className="h-8 w-8" />
                <div>
                  <p className="font-semibold text-lg">Generation Failed</p>
                  <p className="text-sm">{results.error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!results ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Generate {mode === 'individual' ? `${selectedChunks.length} Tracks` : 'Track'}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
