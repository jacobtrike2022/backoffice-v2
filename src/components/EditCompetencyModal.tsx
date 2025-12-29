import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';

interface EditCompetencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customDescription: string, notes?: string) => Promise<void>;
  onRevert?: () => Promise<void>;
  originalDescription: string;
  currentDescription: string;
  type: 'task' | 'skill' | 'knowledge';
  source: 'standard' | 'modified' | 'custom';
  loading?: boolean;
}

export function EditCompetencyModal({
  isOpen,
  onClose,
  onSave,
  onRevert,
  originalDescription,
  currentDescription,
  type,
  source,
  loading = false,
}: EditCompetencyModalProps) {
  const [customDescription, setCustomDescription] = useState(currentDescription);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCustomDescription(currentDescription);
      setNotes('');
    }
  }, [isOpen, currentDescription]);

  const handleSave = async () => {
    if (!customDescription.trim()) return;
    
    try {
      await onSave(customDescription.trim(), notes.trim() || undefined);
      onClose();
    } catch (error) {
      // Error handling is done by parent
      throw error;
    }
  };

  const handleRevert = async () => {
    if (!onRevert) return;
    
    try {
      await onRevert();
      onClose();
    } catch (error) {
      // Error handling is done by parent
      throw error;
    }
  };

  const handleClose = () => {
    setCustomDescription(currentDescription);
    setNotes('');
    onClose();
  };

  const typeLabels = {
    task: { singular: 'Task', plural: 'Tasks' },
    skill: { singular: 'Skill', plural: 'Skills' },
    knowledge: { singular: 'Knowledge Area', plural: 'Knowledge Areas' },
  };

  const labels = typeLabels[type];
  const isModified = source === 'modified';
  const isCustom = source === 'custom';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {labels.singular}</DialogTitle>
          <DialogDescription>
            {isCustom
              ? `Modify this custom ${labels.singular.toLowerCase()}`
              : `Modify the description for this ${labels.singular.toLowerCase()}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Original (for reference) */}
          {!isCustom && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Original {labels.singular}</Label>
                <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
                  {originalDescription}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Custom Description */}
          <div className="space-y-2">
            <Label htmlFor="custom-description">
              {isCustom ? labels.singular : 'Custom'} Description{' '}
              <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="custom-description"
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder={`Enter custom ${labels.singular.toLowerCase()} description...`}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Notes (optional) */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why did you change this? (for internal reference)"
              rows={2}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Add notes about why you modified this {labels.singular.toLowerCase()}
            </p>
          </div>
        </div>
        <DialogFooter className="flex items-center justify-between">
          <div>
            {!isCustom && onRevert && (
              <Button
                variant="outline"
                onClick={handleRevert}
                disabled={loading}
                className="text-muted-foreground"
              >
                Revert to Original
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || !customDescription.trim()}
              className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

