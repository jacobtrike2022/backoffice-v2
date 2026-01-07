// ============================================================================
// CHANGE NOTES RAIL
// ============================================================================
// Right rail showing change notes with:
// - Title and status badge
// - Citations with hover embed previews
// - Click to jump to affected range in editor
// - Grouped by status: Needs Review (top) > Applied > Blocked (collapsed)
// ============================================================================

import React, { useState } from 'react';
import {
  FileText,
  Check,
  AlertTriangle,
  X,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Link2,
  Calendar,
  Shield
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent
} from '../ui/hover-card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import type { ChangeNote, CitationRef, ChangeNoteStatus, SourceTier } from '../../lib/crud/trackRelationships';

interface ChangeNotesRailProps {
  changeNotes: ChangeNote[];
  selectedNoteId: string | null;
  onNoteClick: (noteId: string) => void;
}

const statusConfig: Record<ChangeNoteStatus, {
  label: string;
  icon: React.ElementType;
  className: string;
}> = {
  applied: {
    label: 'Applied',
    icon: Check,
    className: 'bg-green-500/10 text-green-500 border-green-500/30',
  },
  needs_review: {
    label: 'Needs Review',
    icon: AlertTriangle,
    className: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  },
  blocked: {
    label: 'Blocked',
    icon: X,
    className: 'bg-red-500/10 text-red-500 border-red-500/30',
  },
};

const tierConfig: Record<SourceTier, {
  label: string;
  className: string;
  description: string;
}> = {
  tier1_official: {
    label: 'Official',
    className: 'bg-green-500/10 text-green-400 border-green-500/30',
    description: 'Official government source',
  },
  tier2_legal_database: {
    label: 'Legal DB',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    description: 'Legal database (Justia, etc.)',
  },
  tier3_secondary: {
    label: 'Secondary',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    description: 'Secondary source - verify claims',
  },
  unclassified: {
    label: 'Unknown',
    className: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    description: 'Source tier not determined',
  },
};

export function ChangeNotesRail({
  changeNotes,
  selectedNoteId,
  onNoteClick,
}: ChangeNotesRailProps) {
  // State for collapsed sections
  const [blockedExpanded, setBlockedExpanded] = useState(false);

  // Group notes by status
  const needsReviewNotes = changeNotes.filter(n => n.status === 'needs_review');
  const appliedNotes = changeNotes.filter(n => n.status === 'applied');
  const blockedNotes = changeNotes.filter(n => n.status === 'blocked');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h3 className="font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Change Notes
          <span className="text-xs text-muted-foreground font-normal">
            ({changeNotes.length})
          </span>
        </h3>
      </div>

      {/* Notes list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Needs Review section - always at top with warning styling */}
          {needsReviewNotes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-1 py-1 rounded-md bg-amber-500/10">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <h4 className="text-xs font-semibold text-amber-500 uppercase tracking-wide">
                  Needs Review
                </h4>
                <span className="text-xs text-amber-500/70">
                  ({needsReviewNotes.length})
                </span>
              </div>
              <div className="space-y-2">
                {needsReviewNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    isSelected={selectedNoteId === note.id}
                    onClick={() => onNoteClick(note.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Applied section */}
          {appliedNotes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-3.5 h-3.5 text-green-500" />
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Applied Changes
                </h4>
                <span className="text-xs text-muted-foreground/70">
                  ({appliedNotes.length})
                </span>
              </div>
              <div className="space-y-2">
                {appliedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    isSelected={selectedNoteId === note.id}
                    onClick={() => onNoteClick(note.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Blocked section - collapsed by default */}
          {blockedNotes.length > 0 && (
            <Collapsible open={blockedExpanded} onOpenChange={setBlockedExpanded}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
                {blockedExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-red-500" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-red-500" />
                )}
                <X className="w-3.5 h-3.5 text-red-500" />
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide group-hover:text-foreground transition-colors">
                  Blocked
                </h4>
                <span className="text-xs text-muted-foreground/70">
                  ({blockedNotes.length})
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="space-y-2">
                  {blockedNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      isSelected={selectedNoteId === note.id}
                      onClick={() => onNoteClick(note.id)}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {changeNotes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No changes to review
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Summary */}
      <div className="px-4 py-3 border-t border-border shrink-0 bg-muted/30">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            {needsReviewNotes.length > 0 && (
              <span className="flex items-center gap-1 text-amber-500">
                <AlertTriangle className="w-3 h-3" />
                {needsReviewNotes.length} to review
              </span>
            )}
            {appliedNotes.length > 0 && (
              <span className="text-green-500">
                {appliedNotes.length} applied
              </span>
            )}
            {blockedNotes.length > 0 && (
              <span className="text-red-500">
                {blockedNotes.length} blocked
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Note Card Component
function NoteCard({
  note,
  isSelected,
  onClick,
}: {
  note: ChangeNote;
  isSelected: boolean;
  onClick: () => void;
}) {
  const config = statusConfig[note.status];
  const StatusIcon = config.icon;

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-3 rounded-lg border transition-all
        ${isSelected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border bg-card hover:border-primary/50 hover:bg-accent/50'}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h5 className="font-medium text-sm line-clamp-2">{note.title}</h5>
        <Badge
          variant="outline"
          className={`shrink-0 text-xs ${config.className}`}
        >
          <StatusIcon className="w-3 h-3 mr-1" />
          {config.label}
        </Badge>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
        {note.description}
      </p>

      {/* Mapped action */}
      <div className="flex items-center gap-1 text-xs text-primary mb-2">
        <ChevronRight className="w-3 h-3" />
        <span className="truncate">{note.mappedAction}</span>
      </div>

      {/* Citations */}
      {note.citations.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border">
          {note.citations.slice(0, 3).map((citation, index) => (
            <CitationBadge key={index} citation={citation} />
          ))}
          {note.citations.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{note.citations.length - 3} more
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// Citation Badge with Hover Card
function CitationBadge({ citation }: { citation: CitationRef }) {
  const tierCfg = tierConfig[citation.tier];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(citation.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          onClick={handleClick}
          className={`
            inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs
            border transition-colors
            ${tierCfg.className}
            hover:opacity-80
          `}
        >
          <Link2 className="w-3 h-3" />
          <span className="truncate max-w-[100px]">
            {citation.hostname || new URL(citation.url).hostname}
          </span>
        </button>
      </HoverCardTrigger>

      <HoverCardContent
        className="w-80 p-0 overflow-hidden"
        side="left"
        align="start"
      >
        <CitationPreview citation={citation} />
      </HoverCardContent>
    </HoverCard>
  );
}

// Citation Preview (hover card content)
function CitationPreview({ citation }: { citation: CitationRef }) {
  const tierCfg = tierConfig[citation.tier];

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {citation.title ? (
              <h4 className="font-medium text-sm line-clamp-2">{citation.title}</h4>
            ) : (
              <h4 className="font-medium text-sm text-muted-foreground truncate">
                {new URL(citation.url).hostname}
              </h4>
            )}
          </div>
          <Badge variant="outline" className={`shrink-0 text-xs ${tierCfg.className}`}>
            <Shield className="w-3 h-3 mr-1" />
            {tierCfg.label}
          </Badge>
        </div>

        {/* Tier description */}
        <p className="text-xs text-muted-foreground mt-1">{tierCfg.description}</p>
      </div>

      {/* Snippet */}
      {citation.snippet && (
        <div className="p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground italic line-clamp-4">
            "{citation.snippet}"
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-border bg-card flex items-center justify-between">
        {citation.effectiveOrUpdatedDate && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {citation.effectiveOrUpdatedDate}
          </div>
        )}
        <a
          href={citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Open source
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

export default ChangeNotesRail;
