import React, { useState } from 'react';
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
import { Slider } from './ui/slider';

interface AddCompetencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (description: string, importance?: number) => Promise<void>;
  type: 'task' | 'skill' | 'knowledge';
  loading?: boolean;
}

export function AddCompetencyModal({
  isOpen,
  onClose,
  onSave,
  type,
  loading = false,
}: AddCompetencyModalProps) {
  const [description, setDescription] = useState('');
  const [importance, setImportance] = useState([50]);

  const handleSave = async () => {
    if (!description.trim()) return;
    
    try {
      await onSave(description.trim(), importance[0]);
      setDescription('');
      setImportance([50]);
      onClose();
    } catch (error) {
      // Error handling is done by parent
      throw error;
    }
  };

  const handleClose = () => {
    setDescription('');
    setImportance([50]);
    onClose();
  };

  const typeLabels = {
    task: { singular: 'Task', plural: 'Tasks' },
    skill: { singular: 'Skill', plural: 'Skills' },
    knowledge: { singular: 'Knowledge Area', plural: 'Knowledge Areas' },
  };

  const labels = typeLabels[type];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Custom {labels.singular}</DialogTitle>
          <DialogDescription>
            Add a custom {labels.singular.toLowerCase()} that's specific to your organization
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">
              {labels.singular} Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Enter ${labels.singular.toLowerCase()} description...`}
              rows={4}
              className="resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="importance">
              Importance: {importance[0]}%
            </Label>
            <Slider
              id="importance"
              value={importance}
              onValueChange={setImportance}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              How important is this {labels.singular.toLowerCase()} for this role?
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !description.trim()}
            className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
          >
            {loading ? 'Adding...' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

