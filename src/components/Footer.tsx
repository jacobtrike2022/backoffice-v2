import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mt-12 pt-8 pb-6 border-t border-border">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Trike.co
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-medium text-amber-900 dark:text-amber-100">
            {t('footer.betaPreview')}
          </span>
          <span className="text-xs text-amber-700 dark:text-amber-300 hidden sm:inline">
            — {t('footer.limitedFunctionality')}
          </span>
        </div>
      </div>
    </footer>
  );
}
