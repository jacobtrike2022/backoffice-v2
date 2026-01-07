// ============================================================================
// DIFF RENDERER
// ============================================================================
// Renders content with diff highlighting for variant review
// - Insert: orange highlight
// - Delete: strikethrough + muted
// - Replace: delete(old) then insert(new)
// Supports HTML content (articles) and plaintext (other types)
// ============================================================================

import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import type { DiffOp } from '../../lib/crud/trackRelationships';

export type ViewMode = 'redline' | 'clean';

interface DiffRendererProps {
  sourceContent: string;
  draftContent: string;
  diffOps: DiffOp[];
  viewMode: ViewMode;
  isHtml?: boolean;
  highlightedNoteId?: string | null;
  onSegmentClick?: (noteId: string) => void;
}

interface DiffSegment {
  type: 'unchanged' | 'insert' | 'delete';
  text: string;
  noteId?: string;
  opId?: string;
}

/**
 * Convert diffOps to a sequence of segments for rendering
 */
function buildSegments(
  sourceContent: string,
  draftContent: string,
  diffOps: DiffOp[],
  viewMode: ViewMode
): DiffSegment[] {
  if (diffOps.length === 0 || viewMode === 'clean') {
    return [{ type: 'unchanged', text: draftContent }];
  }

  // Sort ops by draftStart position
  const sortedOps = [...diffOps].sort((a, b) => a.draftStart - b.draftStart);

  const segments: DiffSegment[] = [];
  let lastEnd = 0;

  for (const op of sortedOps) {
    // Add unchanged text before this op
    if (op.draftStart > lastEnd) {
      const unchangedText = draftContent.slice(lastEnd, op.draftStart);
      if (unchangedText) {
        segments.push({ type: 'unchanged', text: unchangedText });
      }
    }

    // Process the op based on type
    switch (op.type) {
      case 'insert':
        segments.push({
          type: 'insert',
          text: op.newText,
          noteId: op.noteId,
          opId: op.id,
        });
        break;

      case 'delete':
        // In redline view, show deleted text as strikethrough
        segments.push({
          type: 'delete',
          text: op.oldText,
          noteId: op.noteId,
          opId: op.id,
        });
        break;

      case 'replace':
        // Show old text as deleted, then new text as inserted
        segments.push({
          type: 'delete',
          text: op.oldText,
          noteId: op.noteId,
          opId: op.id,
        });
        segments.push({
          type: 'insert',
          text: op.newText,
          noteId: op.noteId,
          opId: op.id,
        });
        break;
    }

    lastEnd = op.draftEnd;
  }

  // Add remaining unchanged text
  if (lastEnd < draftContent.length) {
    segments.push({ type: 'unchanged', text: draftContent.slice(lastEnd) });
  }

  return segments;
}

/**
 * Renders a segment with appropriate styling
 */
function SegmentRenderer({
  segment,
  isHighlighted,
  onClick,
}: {
  segment: DiffSegment;
  isHighlighted: boolean;
  onClick?: () => void;
}) {
  if (segment.type === 'unchanged') {
    return <span>{segment.text}</span>;
  }

  const baseClasses = "transition-all duration-200 cursor-pointer rounded-sm px-0.5";
  const highlightClasses = isHighlighted ? "ring-2 ring-primary ring-offset-1" : "";

  if (segment.type === 'insert') {
    return (
      <span
        className={`
          ${baseClasses} ${highlightClasses}
          bg-orange-500/20 text-orange-200 border-b-2 border-orange-500/50
          hover:bg-orange-500/30
        `}
        data-note-id={segment.noteId}
        data-op-type="insert"
        data-op-id={segment.opId}
        onClick={onClick}
        role="button"
        tabIndex={0}
      >
        {segment.text}
      </span>
    );
  }

  if (segment.type === 'delete') {
    return (
      <span
        className={`
          ${baseClasses} ${highlightClasses}
          line-through text-muted-foreground/60 bg-red-500/10
          hover:bg-red-500/20
        `}
        data-note-id={segment.noteId}
        data-op-type="delete"
        data-op-id={segment.opId}
        onClick={onClick}
        role="button"
        tabIndex={0}
      >
        {segment.text}
      </span>
    );
  }

  return null;
}

/**
 * Main DiffRenderer component
 */
export function DiffRenderer({
  sourceContent,
  draftContent,
  diffOps,
  viewMode,
  isHtml = false,
  highlightedNoteId,
  onSegmentClick,
}: DiffRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Build segments from diffOps
  const segments = useMemo(
    () => buildSegments(sourceContent, draftContent, diffOps, viewMode),
    [sourceContent, draftContent, diffOps, viewMode]
  );

  // Handle click on segment
  const handleSegmentClick = useCallback(
    (noteId?: string) => {
      if (noteId && onSegmentClick) {
        onSegmentClick(noteId);
      }
    },
    [onSegmentClick]
  );

  // Scroll to highlighted segment when it changes
  useEffect(() => {
    if (highlightedNoteId && containerRef.current) {
      const element = containerRef.current.querySelector(
        `[data-note-id="${highlightedNoteId}"]`
      );
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Add pulse animation
        element.classList.add('animate-highlight-pulse');
        setTimeout(() => {
          element.classList.remove('animate-highlight-pulse');
        }, 2000);
      }
    }
  }, [highlightedNoteId]);

  // If clean view or HTML content without diffs
  if (viewMode === 'clean' || (isHtml && diffOps.length === 0)) {
    if (isHtml) {
      return (
        <div
          ref={containerRef}
          className="prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: draftContent }}
        />
      );
    }
    return (
      <div ref={containerRef} className="whitespace-pre-wrap">
        {draftContent}
      </div>
    );
  }

  // For HTML with diffs, we need special handling
  // This is a simplified approach - for production you'd want a proper HTML diff library
  if (isHtml) {
    return (
      <HtmlDiffRenderer
        draftContent={draftContent}
        diffOps={diffOps}
        highlightedNoteId={highlightedNoteId}
        onSegmentClick={handleSegmentClick}
      />
    );
  }

  // Plain text rendering with segments
  return (
    <div
      ref={containerRef}
      className="whitespace-pre-wrap leading-relaxed"
    >
      {segments.map((segment, index) => (
        <SegmentRenderer
          key={index}
          segment={segment}
          isHighlighted={segment.noteId === highlightedNoteId}
          onClick={
            segment.noteId ? () => handleSegmentClick(segment.noteId) : undefined
          }
        />
      ))}

      {/* Highlight pulse animation */}
      <style>{`
        @keyframes highlight-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgb(246, 74, 5, 0.4);
          }
          50% {
            box-shadow: 0 0 0 6px rgb(246, 74, 5, 0.1);
          }
        }
        .animate-highlight-pulse {
          animation: highlight-pulse 1s ease-in-out 2;
        }
      `}</style>
    </div>
  );
}

/**
 * HTML-aware diff renderer
 * Preserves HTML structure while highlighting changes
 */
function HtmlDiffRenderer({
  draftContent,
  diffOps,
  highlightedNoteId,
  onSegmentClick,
}: {
  draftContent: string;
  diffOps: DiffOp[];
  highlightedNoteId?: string | null;
  onSegmentClick: (noteId?: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Process HTML and inject diff markers
  const processedHtml = useMemo(() => {
    if (diffOps.length === 0) return draftContent;

    let html = draftContent;
    const sortedOps = [...diffOps].sort((a, b) => b.draftStart - a.draftStart); // Reverse order

    for (const op of sortedOps) {
      const startTag = getStartTag(op, highlightedNoteId === op.noteId);
      const endTag = '</span>';

      switch (op.type) {
        case 'insert':
          html =
            html.slice(0, op.draftStart) +
            startTag +
            op.newText +
            endTag +
            html.slice(op.draftEnd);
          break;

        case 'delete':
          html =
            html.slice(0, op.draftStart) +
            getDeleteTag(op, highlightedNoteId === op.noteId) +
            op.oldText +
            endTag +
            html.slice(op.draftStart);
          break;

        case 'replace':
          html =
            html.slice(0, op.draftStart) +
            getDeleteTag(op, highlightedNoteId === op.noteId) +
            op.oldText +
            endTag +
            startTag +
            op.newText +
            endTag +
            html.slice(op.draftEnd);
          break;
      }
    }

    return html;
  }, [draftContent, diffOps, highlightedNoteId]);

  // Handle clicks on diff segments
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const noteId = target.closest('[data-note-id]')?.getAttribute('data-note-id');
      if (noteId) {
        onSegmentClick(noteId);
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [onSegmentClick]);

  // Scroll to highlighted segment
  useEffect(() => {
    if (highlightedNoteId && containerRef.current) {
      const element = containerRef.current.querySelector(
        `[data-note-id="${highlightedNoteId}"]`
      );
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedNoteId]);

  return (
    <div
      ref={containerRef}
      className="prose prose-invert max-w-none diff-html-container"
      dangerouslySetInnerHTML={{ __html: processedHtml }}
    />
  );
}

function getStartTag(op: DiffOp, isHighlighted: boolean): string {
  const highlightClass = isHighlighted ? 'ring-2 ring-primary ring-offset-1 animate-highlight-pulse' : '';
  return `<span class="diff-insert cursor-pointer rounded-sm px-0.5 bg-orange-500/20 text-orange-200 border-b-2 border-orange-500/50 hover:bg-orange-500/30 ${highlightClass}" data-note-id="${op.noteId}" data-op-type="insert" data-op-id="${op.id}">`;
}

function getDeleteTag(op: DiffOp, isHighlighted: boolean): string {
  const highlightClass = isHighlighted ? 'ring-2 ring-primary ring-offset-1 animate-highlight-pulse' : '';
  return `<span class="diff-delete cursor-pointer rounded-sm px-0.5 line-through text-muted-foreground/60 bg-red-500/10 hover:bg-red-500/20 ${highlightClass}" data-note-id="${op.noteId}" data-op-type="delete" data-op-id="${op.id}">`;
}

export default DiffRenderer;
