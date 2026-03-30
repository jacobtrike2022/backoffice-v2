import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  type: 'task' | 'skill' | 'knowledge' | 'ability' | 'work_style';
  loading?: boolean;
}

export function AddCompetencyModal({
  isOpen,
  onClose,
  onSave,
  type,
  loading = false,
}: AddCompetencyModalProps) {
  const { t } = useTranslation();
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
    ability: { singular: 'Ability', plural: 'Abilities' },
    work_style: { singular: 'Work Style', plural: 'Work Styles' },
  };

  const labels = typeLabels[type];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('compliance.addCustomCompetency', { type: labels.singular })}</DialogTitle>
          <DialogDescription>
            {t('compliance.addCustomCompetencyDesc', { type: labels.singular.toLowerCase() })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">
              {t('compliance.competencyDescription', { type: labels.singular })} <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`${t('compliance.enterDescription')} ${labels.singular.toLowerCase()}...`}
              rows={4}
              className="resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="importance">
              {t('compliance.competencyImportance', { value: importance[0] })}
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
              {t('compliance.importanceHint', { type: labels.singular.toLowerCase() })}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {t('compliance.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !description.trim()}
            className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
          >
            {loading ? t('compliance.adding') : t('common.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

