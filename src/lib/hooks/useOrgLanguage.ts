import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, getCurrentUserOrgId } from '../supabase';

/**
 * Syncs the i18n language with the organization's preferred_language setting.
 * Boots in English instantly, then switches if the org prefers another language.
 * Re-syncs when the 'organization-updated' event fires (org switch, settings save).
 */
export function useOrgLanguage() {
  const { i18n } = useTranslation();

  useEffect(() => {
    let cancelled = false;

    const syncLanguage = async () => {
      try {
        const orgId = await getCurrentUserOrgId();
        if (!orgId || cancelled) return;

        const { data: org } = await supabase
          .from('organizations')
          .select('preferred_language')
          .eq('id', orgId)
          .single();

        if (org?.preferred_language && !cancelled) {
          i18n.changeLanguage(org.preferred_language);
        }
      } catch {
        // Silent — English fallback is fine
      }
    };

    syncLanguage();

    const handleOrgUpdate = () => {
      syncLanguage();
    };
    window.addEventListener('organization-updated', handleOrgUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener('organization-updated', handleOrgUpdate);
    };
  }, [i18n]);
}
