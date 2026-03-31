import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kgzhlvxzdlexsrozbbxs';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const EDGE_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/trike-server`;

interface TranslatableTrack {
  id: string;
  title: string;
  description?: string | null;
  transcript?: string | null;
  key_facts?: string[] | null;
  [key: string]: unknown;
}

interface CachedTranslation {
  title: string;
  description?: string;
  transcript?: string;
  key_facts?: string[];
}

type TranslationMap = Record<string, CachedTranslation>;

async function callTranslateEndpoint(
  tracks: TranslatableTrack[],
  language: string
): Promise<TranslationMap> {
  const { data: session } = await supabase.auth.getSession();
  const authToken = session?.session?.access_token || ANON_KEY;

  const res = await fetch(`${EDGE_URL}/translate/tracks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({
      tracks: tracks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description ?? '',
        transcript: t.transcript ?? null,
        key_facts: t.key_facts ?? null,
      })),
      language,
    }),
  });

  if (!res.ok) return {};
  const data = await res.json();
  return (data.translations as TranslationMap) ?? {};
}

/**
 * Translates track titles and descriptions for the library grid/list view.
 * Lightweight — only sends title+description, no full content.
 */
export function useTrackTranslations(tracks: TranslatableTrack[], language: string) {
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const lastKey = useRef('');

  useEffect(() => {
    if (!language || language === 'en' || tracks.length === 0) {
      setTranslations({});
      return;
    }

    const key = `${language}:${tracks.map((t) => t.id).join(',')}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    let cancelled = false;

    (async () => {
      setIsTranslating(true);
      try {
        // Library view: only translate title + description (fast batch)
        const lightTracks = tracks.map((t) => ({ id: t.id, title: t.title, description: t.description }));
        const result = await callTranslateEndpoint(lightTracks as TranslatableTrack[], language);
        if (!cancelled) setTranslations(result);
      } catch {
        // Silent — English fallback
      } finally {
        if (!cancelled) setIsTranslating(false);
      }
    })();

    return () => { cancelled = true; };
  }, [tracks, language]);

  function applyTranslations<T extends TranslatableTrack>(track: T): T {
    const tr = translations[track.id];
    if (!tr) return track;
    return {
      ...track,
      title: tr.title || track.title,
      description: tr.description ?? track.description,
    };
  }

  return { applyTranslations, isTranslating, translations };
}

/**
 * Deep translation for a single track in the detail view.
 * Translates title, description, transcript (article body), and key_facts.
 * Fetches from cache first — only calls OpenAI on cache miss.
 */
export function useTrackDetailTranslation(track: TranslatableTrack | null, language: string) {
  const [translated, setTranslated] = useState<TranslatableTrack | null>(track);
  const [isTranslating, setIsTranslating] = useState(false);
  const lastKey = useRef('');

  useEffect(() => {
    if (!track) { setTranslated(null); return; }
    if (!language || language === 'en') { setTranslated(track); return; }

    const key = `${language}:${track.id}:${track.transcript?.length ?? 0}:${track.key_facts?.length ?? 0}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    let cancelled = false;

    (async () => {
      setIsTranslating(true);
      // Show English immediately while translating
      setTranslated(track);
      try {
        const result = await callTranslateEndpoint([track], language);
        const tr = result[track.id];
        if (!cancelled && tr) {
          setTranslated({
            ...track,
            title: tr.title || track.title,
            description: tr.description ?? track.description,
            transcript: tr.transcript ?? track.transcript,
            key_facts: tr.key_facts ?? track.key_facts,
          });
        }
      } catch {
        // Keep English
      } finally {
        if (!cancelled) setIsTranslating(false);
      }
    })();

    return () => { cancelled = true; };
  }, [track?.id, track?.transcript, track?.key_facts, language]);

  // When track prop changes (different track), reset immediately
  useEffect(() => {
    if (!track) { setTranslated(null); return; }
    if (!language || language === 'en') { setTranslated(track); }
  }, [track?.id]);

  return { translated: translated ?? track, isTranslating };
}
