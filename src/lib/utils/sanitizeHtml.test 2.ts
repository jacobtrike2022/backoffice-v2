/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './sanitizeHtml';

describe('sanitizeHtml', () => {
  it('strips script tags', () => {
    const dirty = '<p>Hi</p><script>alert(1)</script>';
    expect(sanitizeHtml(dirty)).not.toContain('script');
    expect(sanitizeHtml(dirty)).toContain('Hi');
  });

  it('preserves allowed diff/data attributes', () => {
    const html =
      '<span data-note-id="n1" data-op-type="insert" data-op-id="o1">x</span>';
    const out = sanitizeHtml(html);
    expect(out).toContain('data-note-id');
    expect(out).toContain('data-op-type');
  });
});
