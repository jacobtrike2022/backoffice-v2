/**
 * Primary body text for training tracks when adapting variants.
 * Articles: transcript first (project standard), then content_text.
 */
export function getTrackBodyForAdaptation(track: {
  type?: string | null;
  transcript?: string | null;
  content_text?: string | null;
  content?: string | null;
}): string {
  const t = (track.type || '').toLowerCase();
  if (t === 'article') {
    return (track.transcript || track.content_text || track.content || '').trim();
  }
  return (track.content_text || track.transcript || track.content || '').trim();
}
