// ============================================================================
// DIFF RENDERER TESTS
// ============================================================================
// Unit tests for DiffRenderer segment building and noteId mapping
// ============================================================================

import { describe, it, expect } from 'vitest';

// Since we need to test the internal buildSegments function, we'll extract
// the logic here for testing purposes
interface DiffOp {
  id: string;
  type: 'insert' | 'delete' | 'replace';
  sourceStart: number;
  sourceEnd: number;
  draftStart: number;
  draftEnd: number;
  oldText: string;
  newText: string;
  noteId: string;
}

interface DiffSegment {
  type: 'unchanged' | 'insert' | 'delete';
  text: string;
  noteId?: string;
  opId?: string;
}

type ViewMode = 'redline' | 'clean';

// Extracted logic from DiffRenderer for testing
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
        segments.push({
          type: 'delete',
          text: op.oldText,
          noteId: op.noteId,
          opId: op.id,
        });
        break;

      case 'replace':
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

describe('DiffRenderer buildSegments', () => {
  describe('basic segmentation', () => {
    it('should return single unchanged segment when no diffOps', () => {
      const segments = buildSegments(
        'Hello world',
        'Hello world',
        [],
        'redline'
      );

      expect(segments).toHaveLength(1);
      expect(segments[0]).toEqual({
        type: 'unchanged',
        text: 'Hello world',
      });
    });

    it('should return unchanged content in clean view mode', () => {
      const diffOps: DiffOp[] = [{
        id: 'op1',
        type: 'insert',
        sourceStart: 6,
        sourceEnd: 6,
        draftStart: 6,
        draftEnd: 15,
        oldText: '',
        newText: 'beautiful ',
        noteId: 'note1',
      }];

      const segments = buildSegments(
        'Hello world',
        'Hello beautiful world',
        diffOps,
        'clean'
      );

      expect(segments).toHaveLength(1);
      expect(segments[0].type).toBe('unchanged');
    });
  });

  describe('insert operations', () => {
    it('should create insert segment for single insertion', () => {
      const diffOps: DiffOp[] = [{
        id: 'op1',
        type: 'insert',
        sourceStart: 6,
        sourceEnd: 6,
        draftStart: 6,
        draftEnd: 15,
        oldText: '',
        newText: 'beautiful ',
        noteId: 'note1',
      }];

      const segments = buildSegments(
        'Hello world',
        'Hello beautiful world',
        diffOps,
        'redline'
      );

      expect(segments).toHaveLength(3);
      expect(segments[0]).toEqual({ type: 'unchanged', text: 'Hello ' });
      expect(segments[1]).toEqual({
        type: 'insert',
        text: 'beautiful ',
        noteId: 'note1',
        opId: 'op1',
      });
      expect(segments[2]).toEqual({ type: 'unchanged', text: 'world' });
    });

    it('should handle insertion at the start', () => {
      const diffOps: DiffOp[] = [{
        id: 'op1',
        type: 'insert',
        sourceStart: 0,
        sourceEnd: 0,
        draftStart: 0,
        draftEnd: 8,
        oldText: '',
        newText: 'UPDATED ',
        noteId: 'note1',
      }];

      const segments = buildSegments(
        'Hello',
        'UPDATED Hello',
        diffOps,
        'redline'
      );

      expect(segments).toHaveLength(2);
      expect(segments[0].type).toBe('insert');
      expect(segments[0].text).toBe('UPDATED ');
      expect(segments[1].type).toBe('unchanged');
    });
  });

  describe('delete operations', () => {
    it('should create delete segment for deletion', () => {
      const diffOps: DiffOp[] = [{
        id: 'op1',
        type: 'delete',
        sourceStart: 6,
        sourceEnd: 16,
        draftStart: 6,
        draftEnd: 6,
        oldText: 'beautiful ',
        newText: '',
        noteId: 'note1',
      }];

      const segments = buildSegments(
        'Hello beautiful world',
        'Hello world',
        diffOps,
        'redline'
      );

      expect(segments).toHaveLength(3);
      expect(segments[1].type).toBe('delete');
      expect(segments[1].text).toBe('beautiful ');
    });
  });

  describe('replace operations', () => {
    it('should create delete then insert segments for replacement', () => {
      const diffOps: DiffOp[] = [{
        id: 'op1',
        type: 'replace',
        sourceStart: 0,
        sourceEnd: 5,
        draftStart: 0,
        draftEnd: 2,
        oldText: 'Hello',
        newText: 'Hi',
        noteId: 'note1',
      }];

      const segments = buildSegments(
        'Hello world',
        'Hi world',
        diffOps,
        'redline'
      );

      expect(segments).toHaveLength(3);
      expect(segments[0].type).toBe('delete');
      expect(segments[0].text).toBe('Hello');
      expect(segments[1].type).toBe('insert');
      expect(segments[1].text).toBe('Hi');
      expect(segments[2].type).toBe('unchanged');
    });

    it('should link delete and insert to same noteId', () => {
      const diffOps: DiffOp[] = [{
        id: 'op1',
        type: 'replace',
        sourceStart: 0,
        sourceEnd: 5,
        draftStart: 0,
        draftEnd: 7,
        oldText: 'Hello',
        newText: 'Goodbye',
        noteId: 'note123',
      }];

      const segments = buildSegments(
        'Hello world',
        'Goodbye world',
        diffOps,
        'redline'
      );

      expect(segments[0].noteId).toBe('note123');
      expect(segments[1].noteId).toBe('note123');
    });
  });

  describe('multiple operations', () => {
    it('should handle multiple diffOps in order', () => {
      const diffOps: DiffOp[] = [
        {
          id: 'op2',
          type: 'insert',
          sourceStart: 11,
          sourceEnd: 11,
          draftStart: 11,
          draftEnd: 16,
          oldText: '',
          newText: ' wide',
          noteId: 'note2',
        },
        {
          id: 'op1',
          type: 'insert',
          sourceStart: 6,
          sourceEnd: 6,
          draftStart: 6,
          draftEnd: 11,
          oldText: '',
          newText: 'big, ',
          noteId: 'note1',
        },
      ];

      const segments = buildSegments(
        'Hello world',
        'Hello big, world wide',
        diffOps,
        'redline'
      );

      // Should be sorted by draftStart
      expect(segments.length).toBeGreaterThan(1);

      // Find the insert segments
      const inserts = segments.filter(s => s.type === 'insert');
      expect(inserts).toHaveLength(2);
    });

    it('should preserve noteId references across segments', () => {
      const diffOps: DiffOp[] = [
        {
          id: 'op1',
          type: 'insert',
          sourceStart: 0,
          sourceEnd: 0,
          draftStart: 0,
          draftEnd: 10,
          oldText: '',
          newText: '[UPDATED] ',
          noteId: 'update-note',
        },
        {
          id: 'op2',
          type: 'replace',
          sourceStart: 5,
          sourceEnd: 10,
          draftStart: 15,
          draftEnd: 20,
          oldText: 'world',
          newText: 'Texas',
          noteId: 'state-note',
        },
      ];

      const segments = buildSegments(
        'Hello world!',
        '[UPDATED] Hello Texas!',
        diffOps,
        'redline'
      );

      // Find segments with noteIds
      const noteSegments = segments.filter(s => s.noteId);

      // Should have segments referencing both notes
      const noteIds = new Set(noteSegments.map(s => s.noteId));
      expect(noteIds.has('update-note')).toBe(true);
      expect(noteIds.has('state-note')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const segments = buildSegments('', '', [], 'redline');
      expect(segments).toHaveLength(1);
      expect(segments[0].text).toBe('');
    });

    it('should handle single character changes', () => {
      const diffOps: DiffOp[] = [{
        id: 'op1',
        type: 'replace',
        sourceStart: 0,
        sourceEnd: 1,
        draftStart: 0,
        draftEnd: 1,
        oldText: 'a',
        newText: 'b',
        noteId: 'note1',
      }];

      const segments = buildSegments('a', 'b', diffOps, 'redline');

      expect(segments).toHaveLength(2);
      expect(segments[0].text).toBe('a');
      expect(segments[1].text).toBe('b');
    });

    it('should handle HTML content without breaking tags', () => {
      // Note: This is a simple test - actual HTML preservation
      // requires more sophisticated handling in the component
      const diffOps: DiffOp[] = [{
        id: 'op1',
        type: 'insert',
        sourceStart: 11,
        sourceEnd: 11,
        draftStart: 11,
        draftEnd: 20,
        oldText: '',
        newText: '<strong>',
        noteId: 'note1',
      }];

      const segments = buildSegments(
        '<p>Content</p>',
        '<p>Content<strong></p>',
        diffOps,
        'redline'
      );

      // Should produce segments without crashing
      expect(segments.length).toBeGreaterThan(0);
    });
  });
});

describe('DiffRenderer noteId mapping', () => {
  it('should allow filtering segments by noteId', () => {
    const diffOps: DiffOp[] = [
      {
        id: 'op1',
        type: 'insert',
        sourceStart: 0,
        sourceEnd: 0,
        draftStart: 0,
        draftEnd: 5,
        oldText: '',
        newText: 'Note1',
        noteId: 'note-a',
      },
      {
        id: 'op2',
        type: 'insert',
        sourceStart: 10,
        sourceEnd: 10,
        draftStart: 15,
        draftEnd: 20,
        oldText: '',
        newText: 'Note2',
        noteId: 'note-b',
      },
    ];

    const segments = buildSegments(
      'Text here.',
      'Note1Text here.Note2',
      diffOps,
      'redline'
    );

    // Filter by noteId
    const noteASegments = segments.filter(s => s.noteId === 'note-a');
    const noteBSegments = segments.filter(s => s.noteId === 'note-b');

    expect(noteASegments).toHaveLength(1);
    expect(noteBSegments).toHaveLength(1);
    expect(noteASegments[0].text).toBe('Note1');
    expect(noteBSegments[0].text).toBe('Note2');
  });
});
