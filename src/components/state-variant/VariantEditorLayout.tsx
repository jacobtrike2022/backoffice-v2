// ============================================================================
// VARIANT EDITOR LAYOUT
// ============================================================================
// Main editor view with:
// - Left/main: redline rendering with diff highlighting
// - Right rail: change notes with click-to-jump
// - Top controls: view toggle, publish, export
// - Floating: lightning bolt instruction panel
// ============================================================================

import React, { useState, useCallback, useMemo } from 'react';
import {
  X,
  Eye,
  EyeOff,
  Upload,
  Download,
  Check,
  AlertTriangle,
  MapPin,
  FileText,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';

import { DiffRenderer, type ViewMode } from './DiffRenderer';
import { ChangeNotesRail } from './ChangeNotesRail';
import { LightningBoltPanel } from './LightningBoltPanel';

import {
  publishDraft,
  type VariantDraft,
  type DraftStatus
} from '../../lib/crud/trackRelationships';

interface VariantEditorLayoutProps {
  draft: VariantDraft;
  sourceContent: string;
  onDraftUpdate: (draft: VariantDraft) => void;
  onPublish?: () => void;
  onClose: () => void;
  contractId?: string;
  extractionId?: string;
}

const statusConfig: Record<DraftStatus, {
  label: string;
  className: string;
  icon: React.ElementType;
}> = {
  generated: {
    label: 'Ready to publish',
    className: 'bg-green-500/10 text-green-500 border-green-500/30',
    icon: Check,
  },
  generated_needs_review: {
    label: 'Needs review',
    className: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    icon: AlertTriangle,
  },
  blocked: {
    label: 'Blocked',
    className: 'bg-red-500/10 text-red-500 border-red-500/30',
    icon: AlertTriangle,
  },
};

export function VariantEditorLayout({
  draft,
  sourceContent,
  onDraftUpdate,
  onPublish,
  onClose,
  contractId,
  extractionId,
}: VariantEditorLayoutProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('redline');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Determine if content is HTML (article type)
  const isHtml = useMemo(() => {
    return draft.trackType === 'article' &&
      (draft.draftContent.includes('<') || draft.draftContent.includes('&lt;'));
  }, [draft]);

  // Check if publish is allowed
  const canPublish = useMemo(() => {
    if (draft.status === 'blocked') return false;
    if (draft.status === 'generated') return true;
    if (draft.status === 'generated_needs_review') return reviewConfirmed;
    return false;
  }, [draft.status, reviewConfirmed]);

  // Handle note click - scroll to affected range
  const handleNoteClick = useCallback((noteId: string) => {
    setSelectedNoteId(noteId);
    // The DiffRenderer will handle scrolling to the element
  }, []);

  // Handle segment click in editor
  const handleSegmentClick = useCallback((noteId: string) => {
    setSelectedNoteId(noteId);
    // Scroll to the note in the rail
    const noteElement = document.querySelector(`[data-rail-note-id="${noteId}"]`);
    if (noteElement) {
      noteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Handle publish
  const handlePublish = async () => {
    if (!canPublish || isPublishing) return;

    setIsPublishing(true);
    try {
      const result = await publishDraft(draft.draftId, {
        skipReviewCheck: draft.status === 'generated',
      });

      if (result.success) {
        toast.success('Variant published', {
          description: 'The state variant has been created successfully',
        });
        onPublish?.();
      }
    } catch (error: any) {
      toast.error('Failed to publish', {
        description: error.message,
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle export (stub for now)
  const handleExport = () => {
    // Create a blob with the draft content
    const blob = new Blob([draft.draftContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${draft.draftTitle.replace(/[^a-z0-9]/gi, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Draft exported');
  };

  const StatusIcon = statusConfig[draft.status].icon;
  const needsReviewCount = draft.changeNotes.filter(n => n.status === 'needs_review').length;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-4">
          {/* Close button */}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>

          {/* Title and state */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">{draft.draftTitle}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  {draft.stateName || draft.stateCode}
                </span>
                <Badge
                  variant="outline"
                  className={`text-xs ${statusConfig[draft.status].className}`}
                >
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusConfig[draft.status].label}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="redline" className="text-xs gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                Redline
              </TabsTrigger>
              <TabsTrigger value="clean" className="text-xs gap-1.5">
                <EyeOff className="w-3.5 h-3.5" />
                Clean
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Export */}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1.5" />
            Export
          </Button>

          {/* Publish */}
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={!canPublish || isPublishing}
          >
            {isPublishing ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-1.5" />
            )}
            Publish
          </Button>
        </div>
      </header>

      {/* Review warning banner */}
      {draft.status === 'generated_needs_review' && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-amber-200">
              {needsReviewCount} change{needsReviewCount !== 1 ? 's' : ''} need{needsReviewCount === 1 ? 's' : ''} review before publishing
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="review-confirmed"
              checked={reviewConfirmed}
              onCheckedChange={(checked) => setReviewConfirmed(checked === true)}
            />
            <label
              htmlFor="review-confirmed"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              I reviewed flagged changes
            </label>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor pane */}
        <div className="flex-1 flex flex-col min-w-0">
          <ScrollArea className="flex-1">
            <div className="p-6 max-w-4xl mx-auto">
              {/* Draft title */}
              <h1 className="text-2xl font-bold mb-6">{draft.draftTitle}</h1>

              {/* Content with diff rendering */}
              <div className="prose prose-invert max-w-none">
                <DiffRenderer
                  sourceContent={sourceContent}
                  draftContent={draft.draftContent}
                  diffOps={draft.diffOps}
                  viewMode={viewMode}
                  isHtml={isHtml}
                  highlightedNoteId={selectedNoteId}
                  onSegmentClick={handleSegmentClick}
                />
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Right rail - Change notes */}
        <div className="w-[340px] border-l border-border shrink-0 bg-card">
          <ChangeNotesRail
            changeNotes={draft.changeNotes}
            selectedNoteId={selectedNoteId}
            onNoteClick={handleNoteClick}
          />
        </div>
      </div>

      {/* Lightning bolt panel */}
      <LightningBoltPanel
        draftId={draft.draftId}
        contractId={contractId}
        extractionId={extractionId}
        onDraftUpdate={onDraftUpdate}
        disabled={draft.status === 'blocked'}
      />
    </div>
  );
}

export default VariantEditorLayout;
