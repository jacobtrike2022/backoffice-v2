/**
 * QR Archive Warning Modal
 * Warns users when archiving/deleting tracks with active QR codes
 */

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
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-orange-500" />
            Active QR Code Warning
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              This article has an active QR code that may be printed and posted in:
            </p>
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-orange-900">
                    {track.kb_qr_location || 'Physical location (unspecified)'}
                  </div>
                  <div className="text-sm text-orange-700 mt-1">
                    Downloaded {track.kb_qr_downloaded_count || 0} time
                    {track.kb_qr_downloaded_count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-sm">
              If you {actionType === 'archive' ? 'archive' : 'delete'} this article,
              anyone scanning the QR code will see an error message:{' '}
              <span className="italic text-muted-foreground">
                "This reference material is no longer available."
              </span>
            </p>
            <p className="text-sm font-semibold text-orange-600">
              Consider updating the article instead, or removing the physical QR code first.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {actionType === 'archive' ? 'Archive' : 'Delete'} Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
