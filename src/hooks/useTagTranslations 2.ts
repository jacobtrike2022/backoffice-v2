import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kgzhlvxzdlexsrozbbxs';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const EDGE_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/trike-server`;

type TagTranslationMap = Record<string, string>;

async function callTranslateTagsEndpoint(
  tagNames: string[],
  language: string
): Promise<TagTranslationMap> {
  const { data: session } = await supabase.auth.getSession();
  const authToken = session?.session?.access_token || ANON_KEY;

  const res = await fetch(`${EDGE_URL}/translate/tags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({ tagNames, language }),
  });

  if (!res.ok) return {};
  const data = await res.json();
  return (data.translations as TagTranslationMap) ?? {};
}

/**
 * Translates tag names for display purposes.
 * System tags starting with 'system:' are passed through as-is.
 * Falls back to the original tag name on any error.
 */
export function useTagTranslations(tagNames: string[], language: string) {
  const [translations, setTranslations] = useState<TagTranslationMap>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const lastKey = useRef('');

  useEffect(() => {
    const nonSystemTags = tagNames.filter((t) => !t.startsWith('system:'));

    if (!language || language === 'en' || nonSystemTags.length === 0) {
      setTranslations({});
      return;
    }

    const key = `${language}:${[...nonSystemTags].sort().join(',')}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    let cancelled = false;

    (async () => {
      setIsTranslating(true);
      try {
        const result = await callTranslateTagsEndpoint(nonSystemTags, language);
        if (!cancelled) setTranslations(result);
      } catch {
        // Silent — original tag name fallback
      } finally {
        if (!cancelled) setIsTranslating(false);
      }
    })();

    return () => { cancelled = true; };
  }, [tagNames, language]);

  function translateTag(name: string): string {
    // Never translate system tags
    if (name.startsWith('system:')) return name;
    return translations[name] || name;
  }

  return { translateTag, isTranslating };
}
