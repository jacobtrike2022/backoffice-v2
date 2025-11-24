import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Download, X } from 'lucide-react';

interface AttachmentPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  attachment: {
    fileName: string;
    fileType: string;
    url: string;
    fileSize: number;
  } | null;
}

export function AttachmentPreviewDialog({ isOpen, onClose, attachment }: AttachmentPreviewDialogProps) {
  if (!attachment) return null;

  const handleDownload = () => {
    window.open(attachment.url, '_blank');
  };

  const renderPreview = () => {
    const fileType = attachment.fileType.toLowerCase();

    // Image preview
    if (fileType.includes('image')) {
      return (
        <div className="flex items-center justify-center bg-gray-100 rounded-lg p-4">
          <img 
            src={attachment.url} 
            alt={attachment.fileName}
            className="max-w-full max-h-[70vh] object-contain rounded"
          />
        </div>
      );
    }

    // PDF preview
    if (fileType.includes('pdf')) {
      return (
        <div className="w-full h-[70vh] rounded-lg overflow-hidden">
          <iframe
            src={attachment.url}
            className="w-full h-full border-0"
            title={attachment.fileName}
          />
        </div>
      );
    }

    // Document preview (Word, Excel, etc.) using Google Docs Viewer
    if (
      fileType.includes('word') || 
      fileType.includes('document') || 
      fileType.includes('msword') ||
      fileType.includes('openxmlformats-officedocument') ||
      fileType.includes('spreadsheet') ||
      fileType.includes('excel') ||
      fileType.includes('presentation') ||
      fileType.includes('powerpoint')
    ) {
      return (
        <div className="w-full h-[70vh] rounded-lg overflow-hidden">
          <iframe
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(attachment.url)}&embedded=true`}
            className="w-full h-full border-0"
            title={attachment.fileName}
          />
        </div>
      );
    }

    // Fallback for unsupported file types
    return (
      <div className="flex flex-col items-center justify-center bg-gray-100 rounded-lg p-12 text-center">
        <p className="text-lg font-medium mb-2">Preview not available</p>
        <p className="text-sm text-muted-foreground mb-6">
          This file type cannot be previewed in the browser.
        </p>
        <Button onClick={handleDownload} className="hero-primary">
          <Download className="h-4 w-4 mr-2" />
          Download to View
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{attachment.fileName}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Preview and download attachment: {attachment.fileName}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {renderPreview()}
        </div>
      </DialogContent>
    </Dialog>
  );
}