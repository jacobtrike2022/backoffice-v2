import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import {
  Loader2,
  Zap,
  BookOpen,
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
  // For single chunk, use its title. For multiple, allow custom title
  const defaultTitle = selectedChunks.length === 1
    ? selectedChunks[0].title
    : '';

  const [title, setTitle] = useState(defaultTitle);
  const [publishImmediately, setPublishImmediately] = useState(true);
  const [useAI, setUseAI] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalWords = selectedChunks.reduce((sum, c) => sum + (c.word_count || 0), 0);
  const isSingleChunk = selectedChunks.length === 1;
  const alreadyConverted = selectedChunks.filter(c => c.is_converted).length;

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const serverUrl = getServerUrl();
      const chunkIds = selectedChunks.map(c => c.id);

      let response;
      if (isSingleChunk) {
        // Single chunk = individual track
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
              skipAI: !useAI,
              customTitle: title || undefined,
            },
          }),
        });
      } else {
        // Multiple chunks = combined track
        response = await fetch(`${serverUrl}/generate-combined-track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({
            chunk_ids: chunkIds,
            title: title || undefined,
            options: {
              publish: publishImmediately,
              skipAI: !useAI,
            },
          }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      const tracks = isSingleChunk ? data.tracks : [data.track];
      onTracksGenerated?.(tracks);
      handleClose();

    } catch (error: any) {
      console.error('Generation error:', error);
      setError(error.message);
      toast.error('Failed to create track', { description: error.message });
    } finally {
      setGenerating(false);
    }
  };

  const handleClose = () => {
    setTitle(defaultTitle);
    setPublishImmediately(true);
    setUseAI(true);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#F74A05]" />
            Create Training Track
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Already converted warning */}
          {alreadyConverted > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>This content was already converted to a track</span>
            </div>
          )}

          {/* Source info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            <span>{totalWords.toLocaleString()} words from {sourceFileName}</span>
          </div>

          {/* Title input */}
          <div className="space-y-2">
            <Label htmlFor="trackTitle">Track Title</Label>
            <Input
              id="trackTitle"
              placeholder={isSingleChunk ? "Use AI to generate title" : "e.g., Customer Service Guidelines"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {!title && useAI && (
              <p className="text-xs text-muted-foreground">
                Leave blank for AI-generated title
              </p>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="publish" className="text-sm">Publish immediately</Label>
                <p className="text-xs text-muted-foreground">Otherwise saves as draft</p>
              </div>
              <Switch
                id="publish"
                checked={publishImmediately}
                onCheckedChange={setPublishImmediately}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="useAI" className="text-sm">AI Enhancement</Label>
                <p className="text-xs text-muted-foreground">Format and structure content</p>
              </div>
              <Switch
                id="useAI"
                checked={useAI}
                onCheckedChange={setUseAI}
              />
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={generating}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Create Track
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
