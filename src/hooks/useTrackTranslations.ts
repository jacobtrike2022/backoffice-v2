import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kgzhlvxzdlexsrozbbxs';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const EDGE_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/trike-server`;

interface TranslatableTrack {
  id: string;
  title: string;
  description?: string | null;
  [key: string]: unknown;
}

interface TranslationMap {
  [trackId: string]: {
    title: string;
    description?: string;
  };
}

/**
 * Translates track titles and descriptions to the org's preferred language.
 * - Skips translation when language is 'en' (no-op)
 * - Fetches cached translations from Supabase first, only calls OpenAI for misses
 * - Shows English while translation is in flight, swaps in translated text when ready
 *
 * Usage:
 *   const { applyTranslations, isTranslating } = useTrackTranslations(tracks, orgLanguage);
 *   const displayTrack = applyTranslations(track);
 */
export function useTrackTranslations(
  tracks: TranslatableTrack[],
  language: string
) {
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const lastRequestKey = useRef<string>('');

  useEffect(() => {
    if (!language || language === 'en' || tracks.length === 0) {
      setTranslations({});
      return;
    }

    // Build a stable key so we don't re-fetch if tracks haven't changed
    const requestKey = `${language}:${tracks.map((t) => t.id).join(',')}`;
    if (requestKey === lastRequestKey.current) return;
    lastRequestKey.current = requestKey;

    let cancelled = false;

    async function fetchTranslations() {
      setIsTranslating(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        const authToken = session?.session?.access_token || ANON_KEY;

        const payload = {
          tracks: tracks.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description ?? '',
          })),
          language,
        };

        const res = await fetch(`${EDGE_URL}/translate/tracks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'apikey': ANON_KEY,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.translations) {
          setTranslations(data.translations as TranslationMap);
        }
      } catch (err) {
        // Silent fail — English fallback stays in place
      } finally {
        if (!cancelled) setIsTranslating(false);
      }
    }

    fetchTranslations();
    return () => { cancelled = true; };
  }, [tracks, language]);

  /**
   * Returns a track with translated title/description merged in.
   * Falls back to original English values if no translation is available.
   */
  function applyTranslations<T extends TranslatableTrack>(track: T): T {
    const t = translations[track.id];
    if (!t) return track;
    return {
      ...track,
      title: t.title || track.title,
      description: t.description ?? track.description,
    };
  }

  return { applyTranslations, isTranslating, translations };
}
