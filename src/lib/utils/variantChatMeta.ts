/** Structured footer appended by trike-server research responses. */
export interface VariantChatMeta {
  status: 'READY_TO_GENERATE' | 'NEEDS_REVIEW' | string;
  needsReview: boolean;
}

/**
 * Strip [[VARIANT_CHAT_META:...]] from assistant text and parse machine status.
 * Falls back to legacy [READY_TO_GENERATE] / [NEEDS_REVIEW] markers when meta absent.
 */
export function parseVariantAssistantContent(raw: string): {
  display: string;
  meta: VariantChatMeta | null;
  legacyReady: boolean;
  legacyNeedsReview: boolean;
} {
  const metaRe = /\[\[VARIANT_CHAT_META:({[\s\S]*?})\]\]/;
  const metaMatch = raw.match(metaRe);
  let display = raw;
  let meta: VariantChatMeta | null = null;

  if (metaMatch && metaMatch[1]) {
    try {
      meta = JSON.parse(metaMatch[1]) as VariantChatMeta;
      display = raw.replace(metaRe, '').trim();
    } catch {
      display = raw.replace(metaRe, '').trim();
    }
  }

  const legacyNeedsReview = display.includes('[NEEDS_REVIEW]');
  const legacyReady = display.includes('[READY_TO_GENERATE]');
  display = display
    .replace(/\[NEEDS_REVIEW\]/g, '')
    .replace(/\[READY_TO_GENERATE\]/g, '')
    .trim();

  return { display, meta, legacyReady, legacyNeedsReview };
}
