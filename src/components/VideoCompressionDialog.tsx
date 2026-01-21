import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Progress } from './ui/progress';
import { Film, Loader2 } from 'lucide-react';

interface VideoCompressionDialogProps {
  isOpen: boolean;
  progress: number;
  stage: string;
  fileName: string;
  originalSizeMB: number;
}

export function VideoCompressionDialog({
  isOpen,
  progress,
  stage,
  fileName,
  originalSizeMB,
}: VideoCompressionDialogProps) {
  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Film className="h-5 w-5 text-primary" />
            <span>Processing Video</span>
          </DialogTitle>
          <DialogDescription>
            Optimizing your video for faster uploads and storage...
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{fileName}</span>
              <span className="font-medium text-foreground">{originalSizeMB.toFixed(1)} MB</span>
            </div>
            
            <Progress value={progress} className="h-2" />
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                {stage}
              </span>
              <span className="font-medium text-primary">{progress}%</span>
            </div>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              💡 This happens automatically in your browser. Large videos are compressed to stay under the 25MB limit while maintaining quality.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}