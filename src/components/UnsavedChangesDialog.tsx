import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
  onSave?: () => void;
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onDiscard,
  onSave
}: UnsavedChangesDialogProps) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('common.unsavedChanges')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('common.unsavedChangesDesc')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          {onSave && (
            <AlertDialogAction onClick={onSave} className="bg-primary">
              {t('common.saveChanges')}
            </AlertDialogAction>
          )}
          <AlertDialogAction
            onClick={onDiscard}
            className="bg-destructive hover:bg-destructive/90"
          >
            {t('common.discardChanges')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
