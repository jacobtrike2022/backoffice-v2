import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kgzhlvxzdlexsrozbbxs';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const EDGE_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/trike-server`;

async function callTranslateFactsEndpoint(
  facts: any[],
  language: string
): Promise<any[]> {
  const { data: session } = await supabase.auth.getSession();
  const authToken = session?.session?.access_token || ANON_KEY;

  const res = await fetch(`${EDGE_URL}/translate/facts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({ facts, language }),
  });

  if (!res.ok) return facts;
  const data = await res.json();
  return (data.facts as any[]) ?? facts;
}

/**
 * Translates an array of KeyFact objects for display purposes.
 * Each fact may have: id, title, content (or fact), type, steps[].
 * Falls back to the original facts array on any error.
 */
export function useFactTranslations(facts: any[], language: string) {
  const [translatedFacts, setTranslatedFacts] = useState<any[]>(facts);
  const [isTranslating, setIsTranslating] = useState(false);
  const lastKey = useRef('');

  // Keep translatedFacts in sync when facts change (e.g. English or empty)
  useEffect(() => {
    if (!language || language === 'en') {
      setTranslatedFacts(facts);
    }
  }, [facts, language]);

  useEffect(() => {
    if (!language || language === 'en' || facts.length === 0) {
      setTranslatedFacts(facts);
      return;
    }

    // Build a stable cache key from fact ids (or stringified content if no id)
    const keyParts = facts.map((f) =>
      f?.id ?? JSON.stringify(f).slice(0, 40)
    );
    const key = `${language}:${keyParts.join(',')}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    let cancelled = false;

    (async () => {
      setIsTranslating(true);
      try {
        const result = await callTranslateFactsEndpoint(facts, language);
        if (!cancelled) setTranslatedFacts(result);
      } catch {
        // Silent — fall back to original facts
        if (!cancelled) setTranslatedFacts(facts);
      } finally {
        if (!cancelled) setIsTranslating(false);
      }
    })();

    return () => { cancelled = true; };
  }, [facts, language]);

  return { translatedFacts, isTranslating };
}
