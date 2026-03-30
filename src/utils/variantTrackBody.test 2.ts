import { describe, it, expect } from 'vitest';
import { getTrackBodyForAdaptation } from './variantTrackBody';

describe('getTrackBodyForAdaptation', () => {
  it('prefers transcript for articles', () => {
    expect(
      getTrackBodyForAdaptation({
        type: 'article',
        transcript: 'Body in transcript',
        content_text: 'Legacy body',
      })
    ).toBe('Body in transcript');
  });

  it('falls back to content_text when article transcript empty', () => {
    expect(
      getTrackBodyForAdaptation({
        type: 'article',
        transcript: '',
        content_text: 'Only legacy',
      })
    ).toBe('Only legacy');
  });

  it('uses content_text before transcript for non-article by default', () => {
    expect(
      getTrackBodyForAdaptation({
        type: 'video',
        content_text: 'Desc',
        transcript: 'Speech',
      })
    ).toBe('Desc');
  });
});
