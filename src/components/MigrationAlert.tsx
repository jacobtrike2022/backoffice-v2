import React from 'react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { AlertCircle, ExternalLink } from 'lucide-react';

export function MigrationAlert() {
  const [isDismissed, setIsDismissed] = React.useState(() => {
    return localStorage.getItem('migration-alert-dismissed') === 'true';
  });

  const handleDismiss = () => {
    localStorage.setItem('migration-alert-dismissed', 'true');
    setIsDismissed(true);
  };

  const handleOpenInstructions = () => {
    // Open the migration instructions in a new tab
    window.open('/.cursor/docs/MIGRATION_INSTRUCTIONS.mdc', '_blank');
  };

  if (isDismissed) return null;

  return (
    <Alert className="mb-6 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
      <AlertCircle className="h-4 w-4 text-orange-600" />
      <AlertTitle className="text-orange-900 dark:text-orange-100">
        Database Migration Required
      </AlertTitle>
      <AlertDescription className="text-orange-800 dark:text-orange-200">
        <div className="space-y-3">
          <p>
            To enable <strong>Track Versioning</strong> and <strong>Duplication</strong> features, 
            you need to run a one-time database migration in your Supabase dashboard.
          </p>
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleOpenInstructions}
              className="bg-white dark:bg-gray-800"
            >
              <ExternalLink className="h-3 w-3 mr-2" />
              View Migration Instructions
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleDismiss}
              className="text-orange-600 hover:text-orange-700"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
