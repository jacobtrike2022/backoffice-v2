import DOMPurify from 'dompurify';

const DEFAULT_CONFIG = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['target', 'rel', 'data-note-id', 'data-op-type', 'data-op-id'],
  ALLOW_DATA_ATTR: true,
};

/**
 * Sanitize HTML before dangerouslySetInnerHTML (AI/untrusted content).
 */
export function sanitizeHtml(dirty: string): string {
  if (typeof window === 'undefined') return dirty;
  return DOMPurify.sanitize(dirty || '', DEFAULT_CONFIG);
}
