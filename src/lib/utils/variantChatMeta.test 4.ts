import { describe, it, expect } from 'vitest';
import { parseVariantAssistantContent } from './variantChatMeta';

describe('parseVariantAssistantContent', () => {
  it('parses structured meta and strips footer from display', () => {
    const raw =
      'Here is the plan.\n\n[[VARIANT_CHAT_META:{"status":"READY_TO_GENERATE","needsReview":false}]]';
    const { display, meta, legacyReady, legacyNeedsReview } =
      parseVariantAssistantContent(raw);
    expect(display).toBe('Here is the plan.');
    expect(meta?.status).toBe('READY_TO_GENERATE');
    expect(meta?.needsReview).toBe(false);
    expect(legacyReady).toBe(false);
    expect(legacyNeedsReview).toBe(false);
  });

  it('supports legacy bracket markers', () => {
    const raw = 'Almost done [READY_TO_GENERATE]';
    const { display, meta, legacyReady } = parseVariantAssistantContent(raw);
    expect(display).toBe('Almost done');
    expect(meta).toBeNull();
    expect(legacyReady).toBe(true);
  });

  it('strips NEEDS_REVIEW legacy token', () => {
    const raw = 'Check this [NEEDS_REVIEW]';
    const { display, legacyNeedsReview } = parseVariantAssistantContent(raw);
    expect(display).toBe('Check this');
    expect(legacyNeedsReview).toBe(true);
  });
});
