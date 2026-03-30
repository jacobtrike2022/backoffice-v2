/**
 * QR Archive Warning Modal
 * Warns users when archiving/deleting tracks with active QR codes
 */

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
} from '../ui/alert-dialog';
import { QrCode, MapPin } from 'lucide-react';

interface QRArchiveWarningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  track: {
    title: string;
    kb_qr_location?: string;
    kb_qr_downloaded_count?: number;
  };
  actionType: 'archive' | 'delete';
}

export function QRArchiveWarningModal({
  open,
  onOpenChange,
  onConfirm,
  track,
  actionType
}: QRArchiveWarningModalProps) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-orange-500" />
            {t('knowledgeBase.qrWarningTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              {t('knowledgeBase.qrWarningHasActiveCode')}
            </p>
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-orange-900">
                    {track.kb_qr_location || t('knowledgeBase.qrLocationUnspecified')}
                  </div>
                  <div className="text-sm text-orange-700 mt-1">
                    {t('knowledgeBase.qrDownloadCount', { count: track.kb_qr_downloaded_count || 0 })}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-sm">
              {actionType === 'archive'
                ? t('knowledgeBase.qrWarningIfArchive')
                : t('knowledgeBase.qrWarningIfDelete')}
              {' '}
              <span className="italic text-muted-foreground">
                "{t('knowledgeBase.qrWarningErrorMsg')}"
              </span>
            </p>
            <p className="text-sm font-semibold text-orange-600">
              {t('knowledgeBase.qrWarningAdvice')}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('knowledgeBase.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {actionType === 'archive' ? t('knowledgeBase.qrArchiveAnyway') : t('knowledgeBase.qrDeleteAnyway')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
