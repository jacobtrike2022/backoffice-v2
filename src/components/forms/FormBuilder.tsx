import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  GripVertical,
  Type,
  CheckSquare,
  ChevronDown,
  Hash,
  Calendar,
  Clock,
  Upload,
  PenTool,
  Star,
  ToggleLeft,
  Image as ImageIcon,
  MapPin,
  Minus,
  Info,
  SlidersHorizontal,
  X,
  Plus,
  ChevronLeft,
  Eye,
  Send,
  GitBranch,
  Loader2,
  Check,
  AlertCircle,
  Trash2,
  FileText,
} from 'lucide-react';
import { useFormBuilder, type LocalBlock } from '../../hooks/useFormBuilder';
import { FormRenderer } from './shared/FormRenderer';
import type { ConditionalLogic } from '../../lib/forms/conditionalLogic';

// ============================================================================
// TYPES
// ============================================================================

export interface FormBuilderProps {
  formId?: string;
  orgId?: string;
  currentRole?: 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';
  onSaveDraft?: () => void;
  onPublished?: () => void;
  onCancel?: () => void;
  /** @deprecated — kept for backwards compatibility with Forms.tsx call site */
  onNavigateToAssignments?: () => void;
  /** When true the builder fills 100% of its fixed-overlay parent for a full-screen editing experience */
  fullPage?: boolean;
}

// ============================================================================
// BLOCK TYPE DEFINITIONS
// ============================================================================

interface BlockTypeDef {
  type: string;
  label: string;
  icon: React.ElementType;
  category: 'questions' | 'content' | 'actions';
}

const BLOCK_TYPES: BlockTypeDef[] = [
  // Questions
  { type: 'text', label: 'Short Answer', icon: Type, category: 'questions' },
  { type: 'textarea', label: 'Long Answer', icon: Type, category: 'questions' },
  { type: 'number', label: 'Number', icon: Hash, category: 'questions' },
  { type: 'date', label: 'Date', icon: Calendar, category: 'questions' },
  { type: 'time', label: 'Time', icon: Clock, category: 'questions' },
  { type: 'radio', label: 'Multiple Choice', icon: CheckSquare, category: 'questions' },
  { type: 'checkboxes', label: 'Checkboxes', icon: CheckSquare, category: 'questions' },
  { type: 'dropdown', label: 'Dropdown', icon: ChevronDown, category: 'questions' },
  { type: 'yes_no', label: 'Yes / No', icon: ToggleLeft, category: 'questions' },
  { type: 'rating', label: 'Rating', icon: Star, category: 'questions' },
  { type: 'file', label: 'File Upload', icon: Upload, category: 'questions' },
  { type: 'signature', label: 'Signature', icon: PenTool, category: 'questions' },
  { type: 'slider', label: 'Slider', icon: SlidersHorizontal, category: 'questions' },
  { type: 'location', label: 'Location', icon: MapPin, category: 'questions' },
  { type: 'photo', label: 'Photo', icon: ImageIcon, category: 'questions' },
  // Content
  { type: 'instruction', label: 'Instruction', icon: Info, category: 'content' },
  { type: 'divider', label: 'Divider', icon: Minus, category: 'content' },
  // Actions
  { type: 'conditional', label: 'Conditional Logic', icon: GitBranch, category: 'actions' },
];

function getBlockTypeDef(blockType: string): BlockTypeDef | undefined {
  return BLOCK_TYPES.find(b => b.type === blockType);
}

// ============================================================================
// BLOCK PICKER POPOVER
// ============================================================================

interface BlockPickerProps {
  onSelect: (blockType: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}

function BlockPicker({ onSelect, onClose, anchorRef }: BlockPickerProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'questions' | 'content' | 'actions'>('questions');
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, anchorRef]);

  const filtered = BLOCK_TYPES.filter(b => b.category === activeTab);

  return (
    <div
      ref={pickerRef}
      className="absolute z-50 mt-1 w-[400px] rounded-lg border border-border bg-popover shadow-lg p-3"
    >
      <div className="flex gap-1 mb-2 text-xs">
        {(['questions', 'content', 'actions'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded px-2 py-1 capitalize transition-colors ${
              activeTab === tab
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {t(`forms.blockPickerTab_${tab}`)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {filtered.map(bt => {
          const Icon = bt.icon;
          return (
            <button
              key={bt.type}
              type="button"
              onClick={() => {
                onSelect(bt.type);
                onClose();
              }}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted transition-colors text-left"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>{bt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// ADD BLOCK BUTTON (between blocks)
// ============================================================================

interface AddBlockButtonProps {
  afterBlockId?: string;
  sectionId?: string | null;
  onAdd: (blockType: string, sectionId?: string | null, afterBlockId?: string) => void;
}

function AddBlockButton({ afterBlockId, sectionId, onAdd }: AddBlockButtonProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative flex justify-center my-1" ref={anchorRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="h-7 w-7 rounded-full border-2 border-border bg-background flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary hover:shadow-[0_0_8px_2px_hsl(var(--primary)/0.35)] transition-all duration-200"
        aria-label="Add block"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      {open && (
        <BlockPicker
          onSelect={(blockType) => onAdd(blockType, sectionId, afterBlockId)}
          onClose={() => setOpen(false)}
          anchorRef={anchorRef}
        />
      )}
    </div>
  );
}

// ============================================================================
// SORTABLE BLOCK CARD
// ============================================================================

interface BlockCardProps {
  block: LocalBlock;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onAdd: (blockType: string, sectionId?: string | null, afterBlockId?: string) => void;
}

function SortableBlockCard({ block, isSelected, onSelect, onDelete, onAdd }: BlockCardProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const typeDef = getBlockTypeDef(block.block_type);
  const Icon = typeDef?.icon ?? Type;
  const borderAccent = typeDef?.category === 'content'
    ? 'border-l-blue-400'
    : typeDef?.category === 'actions'
    ? 'border-l-purple-400'
    : 'border-l-primary';

  return (
    <div>
      <div
        ref={setNodeRef}
        style={style}
        className={`group relative rounded-xl border bg-card shadow-sm cursor-pointer transition-all hover:shadow-md border-l-4 ${
          isSelected ? 'border-primary border-l-primary ring-2 ring-primary/20' : `${borderAccent} border-border hover:border-primary/40`
        }`}
        onClick={onSelect}
      >
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute left-2 top-1/2 -translate-y-1/2 cursor-grab text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Delete button */}
        <button
          className="absolute right-2 top-2 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete block"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="pl-8 pr-8 py-4">
          {/* Block type label */}
          <div className="flex items-center gap-1.5 mb-1">
            <Icon className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {typeDef?.label ?? block.block_type}
            </span>
            {!!block.conditional_logic && (
              <Badge variant="outline" className="text-xs px-1 py-0 h-4 ml-1">
                <GitBranch className="h-2.5 w-2.5 mr-0.5" />
                {t('forms.logicBadge')}
              </Badge>
            )}
          </div>

          {/* Question label */}
          <p className="text-sm font-medium truncate">
            {block.label
              ? (
                <>
                  {block.label}
                  {block.is_required && (
                    <span className="text-destructive ml-1 text-xs">*</span>
                  )}
                </>
              )
              : (
                <span className="text-muted-foreground italic">
                  {typeDef ? `${typeDef.label} ${t('forms.questionSuffix')}` : t('forms.untitledQuestion')}
                </span>
              )
            }
          </p>

          {/* Preview for choice blocks */}
          {block.options && block.options.length > 0 && (
            <div className="mt-2 space-y-1">
              {block.options.slice(0, 3).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`h-3 w-3 shrink-0 border border-muted-foreground/40 ${
                    block.block_type === 'checkboxes' ? 'rounded-sm' : 'rounded-full'
                  }`} />
                  <span className="text-xs text-muted-foreground truncate">{opt}</span>
                </div>
              ))}
              {block.options.length > 3 && (
                <p className="text-xs text-muted-foreground/60 pl-5">
                  {t('forms.moreOptions', { count: block.options.length - 3 })}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add block button after this card */}
      <AddBlockButton
        afterBlockId={block.id}
        sectionId={block.section_id}
        onAdd={onAdd}
      />
    </div>
  );
}

// ============================================================================
// CONDITION BUILDER
// ============================================================================

interface ConditionBuilderProps {
  block: LocalBlock;
  allBlocks: LocalBlock[];
  onChange: (logic: ConditionalLogic) => void;
}

function ConditionBuilder({ block, allBlocks, onChange }: ConditionBuilderProps) {
  const { t } = useTranslation();
  const logic: ConditionalLogic = (block.conditional_logic as ConditionalLogic) || {
    action: 'show',
    operator: 'AND',
    conditions: [{ source_block_id: '', operator: 'equals', value: '' }],
  };

  const updateLogic = (patch: Partial<ConditionalLogic>) => {
    onChange({ ...logic, ...patch });
  };

  const updateCondition = (index: number, patch: Partial<ConditionalLogic['conditions'][0]>) => {
    const updated = logic.conditions.map((c, i) => i === index ? { ...c, ...patch } : c);
    updateLogic({ conditions: updated });
  };

  const addCondition = () => {
    updateLogic({
      conditions: [...logic.conditions, { source_block_id: '', operator: 'equals', value: '' }],
    });
  };

  const removeCondition = (index: number) => {
    updateLogic({ conditions: logic.conditions.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3">
      {/* Action + Operator row */}
      <div className="flex items-center gap-2 text-xs flex-wrap">
        <Select
          value={logic.action}
          onValueChange={(v) => updateLogic({ action: v as 'show' | 'hide' })}
        >
          <SelectTrigger className="h-7 text-xs w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="show">{t('forms.conditionShow')}</SelectItem>
            <SelectItem value="hide">{t('forms.conditionHide')}</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">{t('forms.conditionThisBlockWhen')}</span>
        <Select
          value={logic.operator}
          onValueChange={(v) => updateLogic({ operator: v as 'AND' | 'OR' })}
        >
          <SelectTrigger className="h-7 text-xs w-16">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">{t('forms.conditionAll')}</SelectItem>
            <SelectItem value="OR">{t('forms.conditionAny')}</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">{t('forms.conditionOfTheseAreTrue')}</span>
      </div>

      {/* Conditions list */}
      {logic.conditions.map((cond, i) => (
        <div key={i} className="flex flex-col gap-1.5 pl-3 border-l-2 border-primary/40 bg-muted/30 rounded-r-md py-2 pr-2">
          {/* Source block picker */}
          <Select
            value={cond.source_block_id || 'none'}
            onValueChange={(v) => updateCondition(i, { source_block_id: v === 'none' ? '' : v })}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder={t('forms.conditionSelectQuestion')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('forms.conditionSelectQuestion')}</SelectItem>
              {allBlocks
                .filter(b => b.label && !['instruction', 'divider', 'section'].includes(b.block_type))
                .map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {(b.label?.slice(0, 40)) || t('forms.untitled')}
                  </SelectItem>
                ))
              }
            </SelectContent>
          </Select>

          {/* Operator + Value row */}
          <div className="flex gap-1.5">
            <Select
              value={cond.operator}
              onValueChange={(v) => updateCondition(i, { operator: v as ConditionalLogic['conditions'][0]['operator'] })}
            >
              <SelectTrigger className="h-7 text-xs w-36 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">{t('forms.opEquals')}</SelectItem>
                <SelectItem value="not_equals">{t('forms.opNotEquals')}</SelectItem>
                <SelectItem value="contains">{t('forms.opContains')}</SelectItem>
                <SelectItem value="not_contains">{t('forms.opNotContains')}</SelectItem>
                <SelectItem value="greater_than">{t('forms.opGreaterThan')}</SelectItem>
                <SelectItem value="less_than">{t('forms.opLessThan')}</SelectItem>
                <SelectItem value="is_empty">{t('forms.opIsEmpty')}</SelectItem>
                <SelectItem value="is_not_empty">{t('forms.opIsNotEmpty')}</SelectItem>
              </SelectContent>
            </Select>

            {!['is_empty', 'is_not_empty'].includes(cond.operator) && (
              <input
                type="text"
                value={cond.value}
                onChange={(e) => updateCondition(i, { value: e.target.value })}
                placeholder={t('forms.conditionValuePlaceholder')}
                className="flex-1 h-7 px-2 text-xs rounded-md border border-input bg-background"
              />
            )}

            {logic.conditions.length > 1 && (
              <button
                type="button"
                onClick={() => removeCondition(i)}
                className="text-muted-foreground hover:text-destructive text-xs px-1"
              >
                ×
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Add condition */}
      <button
        type="button"
        onClick={addCondition}
        className="text-xs text-primary hover:underline"
      >
        {t('forms.addCondition')}
      </button>
    </div>
  );
}

// ============================================================================
// PROPERTIES DRAWER
// ============================================================================

// Block types that can be scored (have a definite correct answer)
const SCOREABLE_BLOCK_TYPES = ['radio', 'checkboxes', 'dropdown', 'yes_no', 'rating', 'number'];

interface PropertiesDrawerProps {
  block: LocalBlock;
  allBlocks: LocalBlock[];
  scoringEnabled?: boolean;
  onUpdate: (updates: Partial<LocalBlock>) => void;
  onDelete: () => void;
  onClose: () => void;
}

function PropertiesDrawer({ block, allBlocks, scoringEnabled, onUpdate, onDelete, onClose }: PropertiesDrawerProps) {
  const { t } = useTranslation();
  const typeDef = getBlockTypeDef(block.block_type);
  const Icon = typeDef?.icon ?? Type;
  const hasChoices = ['radio', 'checkboxes', 'dropdown'].includes(block.block_type);
  const options = block.options ?? [];

  const handleOptionChange = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    onUpdate({ options: updated });
  };

  const handleAddOption = () => {
    onUpdate({ options: [...options, `Option ${options.length + 1}`] });
  };

  const handleRemoveOption = (index: number) => {
    const updated = options.filter((_, i) => i !== index);
    onUpdate({ options: updated });
  };

  return (
    <div className="absolute right-0 top-0 h-full w-[340px] bg-background border-l border-border shadow-xl z-40 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{typeDef?.label ?? block.block_type}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Label */}
        <div className="space-y-1.5">
          <Label htmlFor="block-label" className="text-xs font-medium">{t('forms.propQuestionLabel')}</Label>
          <Input
            id="block-label"
            value={block.label}
            onChange={e => onUpdate({ label: e.target.value })}
            placeholder="Enter question..."
            className="text-sm"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="block-description" className="text-xs font-medium">{t('forms.propHelperText')}</Label>
          <Textarea
            id="block-description"
            value={block.description ?? ''}
            onChange={e => onUpdate({ description: e.target.value })}
            placeholder="Optional helper text..."
            rows={2}
            className="text-sm resize-none"
          />
        </div>

        {/* Required toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="block-required" className="text-xs font-medium cursor-pointer">{t('forms.propRequired')}</Label>
          <Switch
            id="block-required"
            checked={block.is_required}
            onCheckedChange={checked => onUpdate({ is_required: checked })}
          />
        </div>

        <Separator />

        {/* Placeholder — text, textarea */}
        {['text', 'textarea', 'number'].includes(block.block_type) && (
          <div className="space-y-1.5">
            <Label htmlFor="block-placeholder" className="text-xs font-medium">{t('forms.propPlaceholderText')}</Label>
            <Input
              id="block-placeholder"
              value={block.placeholder ?? ''}
              onChange={e => onUpdate({ placeholder: e.target.value })}
              placeholder="Placeholder..."
              className="text-sm"
            />
          </div>
        )}

        {/* Max length — text, textarea */}
        {['text', 'textarea'].includes(block.block_type) && (
          <div className="space-y-1.5">
            <Label htmlFor="block-maxlength" className="text-xs font-medium">{t('forms.propMaxLength')}</Label>
            <Input
              id="block-maxlength"
              type="number"
              min={1}
              value={(block.validation_rules?.max_length as number) ?? ''}
              onChange={e => {
                const val = e.target.value ? parseInt(e.target.value) : undefined;
                onUpdate({
                  validation_rules: { ...block.validation_rules, max_length: val },
                });
              }}
              placeholder="No limit"
              className="text-sm"
            />
          </div>
        )}

        {/* Min/Max/Unit — number */}
        {block.block_type === 'number' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('forms.propMinValue')}</Label>
                <Input
                  type="number"
                  value={(block.validation_rules?.min as number) ?? ''}
                  onChange={e =>
                    onUpdate({
                      validation_rules: {
                        ...block.validation_rules,
                        min: e.target.value ? parseFloat(e.target.value) : undefined,
                      },
                    })
                  }
                  placeholder="—"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('forms.propMaxValue')}</Label>
                <Input
                  type="number"
                  value={(block.validation_rules?.max as number) ?? ''}
                  onChange={e =>
                    onUpdate({
                      validation_rules: {
                        ...block.validation_rules,
                        max: e.target.value ? parseFloat(e.target.value) : undefined,
                      },
                    })
                  }
                  placeholder="—"
                  className="text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('forms.propUnitLabel')}</Label>
              <Input
                value={(block.settings?.unit as string) ?? ''}
                onChange={e =>
                  onUpdate({ settings: { ...block.settings, unit: e.target.value } })
                }
                placeholder="e.g. kg, $, hours"
                className="text-sm"
              />
            </div>
          </>
        )}

        {/* Options — radio, checkboxes, dropdown */}
        {hasChoices && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">{t('forms.propOptions')}</Label>
            <div className="space-y-1.5">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 cursor-grab shrink-0" />
                  <Input
                    value={opt}
                    onChange={e => handleOptionChange(i, e.target.value)}
                    className="text-sm h-8 flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(i)}
                    className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={handleAddOption}
            >
              <Plus className="h-3 w-3 mr-1" />
              {t('forms.propAddOption')}
            </Button>
          </div>
        )}

        {/* Rating — max stars */}
        {block.block_type === 'rating' && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('forms.propMaxStars')}</Label>
            <Select
              value={String((block.settings?.max_stars as number) ?? 5)}
              onValueChange={(v: string) =>
                onUpdate({ settings: { ...block.settings, max_stars: parseInt(v) } })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 4, 5, 10].map(n => (
                  <SelectItem key={n} value={String(n)}>{t('forms.propNStars', { count: n })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Yes/No labels */}
        {block.block_type === 'yes_no' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('forms.propYesLabel')}</Label>
              <Input
                value={(block.settings?.yes_label as string) ?? 'Yes'}
                onChange={e =>
                  onUpdate({ settings: { ...block.settings, yes_label: e.target.value } })
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('forms.propNoLabel')}</Label>
              <Input
                value={(block.settings?.no_label as string) ?? 'No'}
                onChange={e =>
                  onUpdate({ settings: { ...block.settings, no_label: e.target.value } })
                }
                className="text-sm"
              />
            </div>
          </div>
        )}

        {/* Slider */}
        {block.block_type === 'slider' && (
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('forms.propMin')}</Label>
              <Input
                type="number"
                value={(block.settings?.min as number) ?? 0}
                onChange={e =>
                  onUpdate({ settings: { ...block.settings, min: parseFloat(e.target.value) } })
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('forms.propMax')}</Label>
              <Input
                type="number"
                value={(block.settings?.max as number) ?? 100}
                onChange={e =>
                  onUpdate({ settings: { ...block.settings, max: parseFloat(e.target.value) } })
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('forms.propStep')}</Label>
              <Input
                type="number"
                value={(block.settings?.step as number) ?? 1}
                onChange={e =>
                  onUpdate({ settings: { ...block.settings, step: parseFloat(e.target.value) } })
                }
                className="text-sm"
              />
            </div>
          </div>
        )}

        {/* ── Scoring (only for scoreable block types when scoring is enabled) ── */}
        {scoringEnabled && SCOREABLE_BLOCK_TYPES.includes(block.block_type) && (() => {
          const scoreWeight = ((block.settings?.score_weight as number) ?? 0);
          const correctAnswer = ((block.settings?.correct_answer as string) ?? '');
          const options = block.options ?? [];

          const updateScoringSetting = (key: string, value: unknown) => {
            onUpdate({
              settings: { ...block.settings, [key]: value },
            });
          };

          return (
            <div className="border-t border-border pt-4 mt-4 space-y-3">
              <div>
                <p className="text-sm font-medium">{t('forms.propScoring')}</p>
                <p className="text-xs text-muted-foreground">{t('forms.propScoringDesc')}</p>
              </div>

              {/* Score Weight */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('forms.propScoreWeight')}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={scoreWeight}
                  onChange={e => {
                    const v = e.target.value ? Math.min(100, Math.max(0, parseInt(e.target.value))) : 0;
                    updateScoringSetting('score_weight', v);
                  }}
                  placeholder="0"
                  className="text-sm"
                />
                <p className="text-[10px] text-muted-foreground">{t('forms.propScoreWeightHint')}</p>
              </div>

              {/* Correct Answer */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('forms.propCorrectAnswer')}</Label>
                {['radio', 'dropdown'].includes(block.block_type) && options.length > 0 ? (
                  <Select
                    value={correctAnswer || 'none'}
                    onValueChange={v => updateScoringSetting('correct_answer', v === 'none' ? '' : v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder={t('forms.propSelectCorrectAnswer')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('forms.propSelectCorrectAnswer')}</SelectItem>
                      {options.map((opt, i) => (
                        <SelectItem key={i} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : block.block_type === 'checkboxes' && options.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground">{t('forms.propCheckboxesCorrectHint')}</p>
                    <Input
                      value={correctAnswer}
                      onChange={e => updateScoringSetting('correct_answer', e.target.value)}
                      placeholder="e.g. Option 1, Option 3"
                      className="text-sm"
                    />
                  </div>
                ) : block.block_type === 'yes_no' ? (
                  <Select
                    value={correctAnswer || 'none'}
                    onValueChange={v => updateScoringSetting('correct_answer', v === 'none' ? '' : v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder={t('forms.propSelectCorrectAnswer')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('forms.propSelectCorrectAnswer')}</SelectItem>
                      <SelectItem value="yes">{t('forms.propYes')}</SelectItem>
                      <SelectItem value="no">{t('forms.propNo')}</SelectItem>
                    </SelectContent>
                  </Select>
                ) : block.block_type === 'rating' ? (
                  <Input
                    type="number"
                    min={1}
                    max={(block.settings?.max_stars as number) ?? 5}
                    value={correctAnswer}
                    onChange={e => updateScoringSetting('correct_answer', e.target.value)}
                    placeholder="e.g. 5"
                    className="text-sm"
                  />
                ) : (
                  <Input
                    value={correctAnswer}
                    onChange={e => updateScoringSetting('correct_answer', e.target.value)}
                    placeholder="Enter correct answer..."
                    className="text-sm"
                  />
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Conditional Logic ─────────────────────────────── */}
        <div className="border-t border-border pt-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium">{t('forms.propConditionalLogic')}</p>
              <p className="text-xs text-muted-foreground">{t('forms.propConditionalLogicDesc')}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const hasLogic = !!(block.conditional_logic && (block.conditional_logic as ConditionalLogic).conditions?.length);
                if (hasLogic) {
                  onUpdate({ conditional_logic: null });
                } else {
                  onUpdate({
                    conditional_logic: {
                      action: 'show',
                      operator: 'AND',
                      conditions: [{ source_block_id: '', operator: 'equals', value: '' }],
                    } as ConditionalLogic,
                  });
                }
              }}
              className="text-xs text-primary underline"
            >
              {!!(block.conditional_logic && (block.conditional_logic as ConditionalLogic).conditions?.length) ? t('forms.propRemoveCondition') : t('forms.propAddCondition')}
            </button>
          </div>

          {!!(block.conditional_logic && (block.conditional_logic as ConditionalLogic).conditions?.length) && (
            <ConditionBuilder
              block={block}
              allBlocks={allBlocks}
              onChange={(logic) => onUpdate({ conditional_logic: logic })}
            />
          )}
        </div>
      </div>

      {/* Footer — delete */}
      <div className="p-4 border-t border-border shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          {t('forms.propDeleteBlock')}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// SECTION HEADER CARD
// ============================================================================

interface SectionHeaderCardProps {
  title: string;
  description?: string;
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onDelete: () => void;
}

function SectionHeaderCard({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  onDelete,
}: SectionHeaderCardProps) {
  return (
    <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-5 py-3 mb-2 group relative">
      <button
        type="button"
        onClick={onDelete}
        className="absolute right-2 top-2 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <Input
        value={title}
        onChange={e => onTitleChange(e.target.value)}
        className="font-semibold text-sm bg-transparent border-none shadow-none h-auto p-0 focus-visible:ring-0 mb-1"
        placeholder="Section title..."
      />
      <Input
        value={description ?? ''}
        onChange={e => onDescriptionChange(e.target.value)}
        className="text-xs text-muted-foreground bg-transparent border-none shadow-none h-auto p-0 focus-visible:ring-0"
        placeholder="Section description (optional)..."
      />
    </div>
  );
}

// ============================================================================
// AUTOSAVE INDICATOR
// ============================================================================

interface AutosaveIndicatorProps {
  isSaving: boolean;
  isDirty: boolean;
}

function AutosaveIndicator({ isSaving, isDirty }: AutosaveIndicatorProps) {
  const { t } = useTranslation();
  if (isSaving) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('forms.builderSaving')}
      </span>
    );
  }
  if (isDirty) {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600">
        <AlertCircle className="h-3 w-3" />
        {t('forms.builderUnsaved')}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Check className="h-3 w-3 text-green-500" />
      {t('forms.builderSaved')}
    </span>
  );
}

// ============================================================================
// CONNECTOR LINE
// ============================================================================

function ConnectorLine() {
  return <div className="w-px h-6 bg-border mx-auto" />;
}

// ============================================================================
// MAIN FORM BUILDER COMPONENT
// ============================================================================

export function FormBuilder({
  formId,
  orgId = '',
  currentRole,
  onSaveDraft,
  onPublished,
  onCancel,
  fullPage = false,
}: FormBuilderProps) {
  const { t } = useTranslation();
  const hook = useFormBuilder({ formId, orgId });
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim().replace(/,/g, '');
    if (!trimmed) return;
    const current = hook.form?.tags || [];
    if (!current.includes(trimmed)) {
      hook.setFormTags([...current, trimmed]);
    }
    setTagInput('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hook.form?.tags, hook.setFormTags]);

  const removeTag = useCallback((tag: string) => {
    const current = hook.form?.tags || [];
    hook.setFormTags(current.filter(t => t !== tag));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hook.form?.tags, hook.setFormTags]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Group blocks by section
  const unsectionedBlocks = hook.blocks.filter(b => !b.section_id);
  const blocksBySection: Record<string, LocalBlock[]> = {};
  for (const section of hook.sections) {
    blocksBySection[section.id] = hook.blocks.filter(b => b.section_id === section.id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const allBlockIds = hook.blocks.map(b => b.id);
    const oldIndex = allBlockIds.indexOf(active.id as string);
    const newIndex = allBlockIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const movedBlock = hook.blocks[oldIndex];
    hook.reorderBlock(active.id as string, newIndex, movedBlock.section_id);
  }

  async function handlePublish() {
    setShowPublishConfirm(false);
    await hook.publishForm();
    onPublished?.();
  }

  // Map blocks to FormRenderer format for preview
  const previewBlocks = hook.blocks.map(b => ({
    id: b.id,
    type: b.block_type,
    label: b.label,
    description: b.description,
    placeholder: b.placeholder,
    is_required: b.is_required,
    options: b.options,
    validation_rules: b.validation_rules,
  }));

  if (hook.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (hook.error && !hook.form) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <FileText className="h-10 w-10 text-muted-foreground opacity-60" />
        <div className="text-center">
          <p className="font-semibold text-lg">{t('forms.builderNoFormSelected')}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t('forms.builderNoFormSelectedDesc')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {t('forms.builderGoToLibrary')}
          </Button>
          <Button
            className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
            size="sm"
            onClick={onCancel}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('forms.builderCreateNew')}
          </Button>
        </div>
      </div>
    );
  }

  const selectedBlock = hook.selectedBlockId
    ? hook.blocks.find(b => b.id === hook.selectedBlockId) ?? null
    : null;

  // In fullPage mode the parent is a fixed inset-0 overlay; use 100% of that container.
  // In embedded tab mode keep the previous calc-based height so it fits inside the dashboard.
  const containerStyle = fullPage
    ? { height: '100%', minHeight: 0 }
    : { height: 'calc(100vh - 120px)', minHeight: '600px' };

  return (
    <div className="flex flex-col bg-muted/30 overflow-hidden" style={containerStyle}>
      {/* ================================================================
          TOOLBAR
      ================================================================ */}
      <div className="sticky top-0 z-30 bg-background border-b border-border shrink-0">
        {/* Primary toolbar row */}
        <div className="flex items-center gap-3 px-4 py-2.5">
          {/* Back */}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground shrink-0"
            onClick={() => {
              hook.saveForm();
              onCancel?.();
              onSaveDraft?.();
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            {fullPage ? t('forms.builderBackToLibrary') : t('forms.builderBack')}
          </Button>

          <Separator orientation="vertical" className="h-5" />

          {/* Form title inline editor */}
          <input
            type="text"
            value={hook.form?.title ?? ''}
            onChange={e => hook.setFormTitle(e.target.value)}
            onBlur={e => {
              if (!e.target.value.trim()) {
                hook.setFormTitle(t('forms.builderUntitledForm'));
              }
            }}
            className="flex-1 min-w-0 bg-transparent text-base font-semibold outline-none placeholder:text-muted-foreground/50 border-none border-b border-transparent hover:border-border focus:border-primary transition-colors"
            placeholder={t('forms.builderUntitledForm')}
          />

          {/* Status badge */}
          <Badge
            variant="outline"
            className={`shrink-0 text-xs ${
              hook.form?.status === 'published'
                ? 'border-green-500 text-green-600 bg-green-50'
                : hook.form?.status === 'archived'
                ? 'border-muted-foreground text-muted-foreground'
                : 'border-amber-500 text-amber-600 bg-amber-50'
            }`}
          >
            {hook.form?.status === 'published'
              ? t('forms.builderStatusPublished')
              : hook.form?.status === 'archived'
              ? t('forms.builderStatusArchived')
              : t('forms.builderStatusDraft')}
          </Badge>

          {/* Template toggle — super admin only */}
          {currentRole === 'trike-super-admin' && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">{t('forms.builderTemplate')}</span>
              <Switch
                checked={hook.form?.is_template ?? false}
                onCheckedChange={(checked) => hook.setFormIsTemplate(checked)}
              />
            </div>
          )}

          {/* Autosave indicator */}
          <AutosaveIndicator isSaving={hook.isSaving} isDirty={hook.isDirty} />

          {/* Preview button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowPreviewDialog(true)}
          >
            <Eye className="h-3.5 w-3.5" />
            {t('forms.builderPreview')}
          </Button>

          {/* Publish button */}
          {hook.form?.status !== 'published' && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setShowPublishConfirm(true)}
              disabled={hook.isSaving}
            >
              <Send className="h-3.5 w-3.5" />
              {t('forms.builderPublish')}
            </Button>
          )}
        </div>

        {/* Scoring settings row */}
        <div className="flex items-center gap-4 px-4 pb-2 border-b border-border mb-0">
          <div className="flex items-center gap-2">
            <Label htmlFor="scoring-toggle" className="text-xs font-medium cursor-pointer text-muted-foreground">
              {t('forms.builderScoring')}
            </Label>
            <Switch
              id="scoring-toggle"
              checked={hook.form?.scoring_enabled ?? false}
              onCheckedChange={(checked) => hook.setFormSettings({ scoring_enabled: checked })}
            />
          </div>
          {hook.form?.scoring_enabled && (
            <div className="flex items-center gap-2">
              <Label htmlFor="pass-threshold" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                {t('forms.builderPassThreshold')}
              </Label>
              <Input
                id="pass-threshold"
                type="number"
                min={0}
                max={100}
                value={hook.form?.pass_threshold ?? 70}
                onChange={e => {
                  const v = e.target.value ? Math.min(100, Math.max(0, parseInt(e.target.value))) : 70;
                  hook.setFormSettings({ pass_threshold: v });
                }}
                className="h-7 w-16 text-xs"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          )}
        </div>

        {/* Tags row */}
        <div className="flex items-center gap-2 flex-wrap px-4 pb-2">
          {(hook.form?.tags || []).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:text-destructive leading-none"
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            placeholder={t('forms.builderAddTag')}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                e.preventDefault();
                addTag(tagInput);
              }
            }}
            className="text-xs bg-transparent border-none outline-none placeholder:text-muted-foreground w-24"
          />
        </div>
      </div>

      {/* ================================================================
          MAIN AREA
      ================================================================ */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Canvas */}
        <div
          className={`flex-1 overflow-y-auto py-8 transition-all ${
            selectedBlock
              ? fullPage ? 'pr-[440px]' : 'pr-[356px]'
              : ''
          }`}
        >
          <div className={`mx-auto w-full px-4 ${fullPage ? 'max-w-[800px]' : 'max-w-[680px]'}`}>
            {/* START node */}
            <div className="flex justify-center mb-0">
              <div className="bg-green-500 text-white text-xs font-bold px-6 py-2 rounded-full shadow-sm">
                {t('forms.builderStart')}
              </div>
            </div>

            <ConnectorLine />

            {/* Top-level + only when canvas is empty (cards render their own + after themselves) */}
            {unsectionedBlocks.length === 0 && hook.sections.length === 0 && (
              <AddBlockButton
                sectionId={null}
                onAdd={hook.addBlock}
              />
            )}

            {/* Empty canvas hint */}
            {hook.blocks.length === 0 && hook.sections.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground/60 pointer-events-none select-none">
                <Plus className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">{t('forms.builderEmptyHint')}</p>
              </div>
            )}

            {/* Unsectioned blocks */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={unsectionedBlocks.map(b => b.id)}
                strategy={verticalListSortingStrategy}
              >
                {unsectionedBlocks.map(block => (
                  <SortableBlockCard
                    key={block.id}
                    block={block}
                    isSelected={hook.selectedBlockId === block.id}
                    onSelect={() =>
                      hook.setSelectedBlockId(
                        hook.selectedBlockId === block.id ? null : block.id
                      )
                    }
                    onDelete={() => hook.deleteBlock(block.id)}
                    onAdd={hook.addBlock}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* Sectioned blocks */}
            {hook.sections.map(section => (
              <div key={section.id} className="mt-4">
                <SectionHeaderCard
                  title={section.title}
                  description={section.description}
                  onTitleChange={v => hook.updateSection(section.id, { title: v })}
                  onDescriptionChange={v => hook.updateSection(section.id, { description: v })}
                  onDelete={() => hook.deleteSection(section.id)}
                />

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={(blocksBySection[section.id] ?? []).map(b => b.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {(blocksBySection[section.id] ?? []).map(block => (
                      <SortableBlockCard
                        key={block.id}
                        block={block}
                        isSelected={hook.selectedBlockId === block.id}
                        onSelect={() =>
                          hook.setSelectedBlockId(
                            hook.selectedBlockId === block.id ? null : block.id
                          )
                        }
                        onDelete={() => hook.deleteBlock(block.id)}
                        onAdd={hook.addBlock}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                {/* Only show section-level + when section is empty (cards render their own + after themselves) */}
                {(blocksBySection[section.id] ?? []).length === 0 && (
                  <AddBlockButton sectionId={section.id} onAdd={hook.addBlock} />
                )}
              </div>
            ))}

            {/* Add Section button */}
            <div className="flex justify-center mt-6 mb-4">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 text-muted-foreground border-dashed border-border"
                onClick={hook.addSection}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('forms.builderAddSection')}
              </Button>
            </div>

            <ConnectorLine />

            {/* END node */}
            <div className="flex justify-center mt-0">
              <div className="bg-muted text-muted-foreground text-xs font-bold px-6 py-2 rounded-full">
                {t('forms.builderEnd')}
              </div>
            </div>

            {/* Bottom padding */}
            <div className="h-16" />
          </div>
        </div>

        {/* Properties Drawer — fixed right panel */}
        {selectedBlock && (
          <PropertiesDrawer
            block={selectedBlock}
            allBlocks={hook.blocks.filter(b => b.id !== selectedBlock.id)}
            scoringEnabled={hook.form?.scoring_enabled ?? false}
            onUpdate={updates => hook.updateBlock(selectedBlock.id, updates)}
            onDelete={() => hook.deleteBlock(selectedBlock.id)}
            onClose={() => hook.setSelectedBlockId(null)}
            wide={fullPage}
          />
        )}
      </div>

      {/* ================================================================
          PREVIEW DIALOG
      ================================================================ */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{hook.form?.title ?? t('forms.builderFormPreviewTitle')}</DialogTitle>
            <DialogDescription>
              {t('forms.builderFormPreviewDesc')}
            </DialogDescription>
          </DialogHeader>
          <div>
            {previewBlocks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t('forms.builderNoBlocksPreview')}
              </p>
            ) : (
              <FormRenderer blocks={previewBlocks} answers={{}} readOnly={false} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ================================================================
          PUBLISH CONFIRM DIALOG
      ================================================================ */}
      <Dialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('forms.builderPublishConfirm')}</DialogTitle>
            <DialogDescription>
              {t('forms.builderPublishConfirmDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" size="sm" onClick={() => setShowPublishConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={handlePublish} disabled={hook.isSaving}>
              {hook.isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Send className="h-3.5 w-3.5 mr-1.5" />
              )}
              {t('forms.builderPublish')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default FormBuilder;
