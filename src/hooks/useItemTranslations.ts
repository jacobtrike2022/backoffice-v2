import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kgzhlvxzdlexsrozbbxs';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const EDGE_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/trike-server`;

type ItemTranslationMap = Record<string, string>; // id → translated_title

async function callTranslateItemsEndpoint(
  items: { id: string; title: string }[],
  language: string
): Promise<ItemTranslationMap> {
  const { data: session } = await supabase.auth.getSession();
  const authToken = session?.session?.access_token || ANON_KEY;

  const res = await fetch(`${EDGE_URL}/translate/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({ items, language }),
  });

  if (!res.ok) return {};
  const data = await res.json();
  return (data.translations as ItemTranslationMap) ?? {};
}

/**
 * Translates a list of titled items (albums, playlists, categories, etc.)
 * Caches results in item_translations table. Falls back to original title.
 */
export function useItemTranslations(
  items: { id: string; title: string }[],
  language: string
) {
  const [translations, setTranslations] = useState<ItemTranslationMap>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const lastKey = useRef('');

  useEffect(() => {
    if (!language || language === 'en' || items.length === 0) {
      setTranslations({});
      return;
    }

    const key = `${language}:${items.map((i) => i.id).join(',')}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    let cancelled = false;

    (async () => {
      setIsTranslating(true);
      try {
        const result = await callTranslateItemsEndpoint(items, language);
        if (!cancelled) setTranslations(result);
      } catch {
        // Silent — original title fallback
      } finally {
        if (!cancelled) setIsTranslating(false);
      }
    })();

    return () => { cancelled = true; };
  }, [items, language]);

  function translateTitle(id: string, fallback: string): string {
    return translations[id] || fallback;
  }

  return { translateTitle, isTranslating };
}
