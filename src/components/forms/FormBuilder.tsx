import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
  ChevronUp,
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
  Settings2,
  Mail,
  AlertTriangle,
  Pen,
  Network,
  ArrowRight,
  ShieldAlert,
  RefreshCw,
  BookOpen,
  MessageSquare,
  Play,
  Building2,
  Timer,
  Repeat,
  UserCircle,
  GraduationCap,
  Globe,
  Tag,
} from 'lucide-react';
import { useFormBuilder, type LocalBlock, type SubmissionConfig, type EmailNotification, type OnFailConfig, type StartConfig } from '../../hooks/useFormBuilder';
import type { ConditionalLogic } from '../../lib/forms/conditionalLogic';
import { buildBlockDependencyMap, conditionSummaryText } from '../../lib/forms/conditionalLogic';
import { supabase } from '../../lib/supabase';
import {
  getFormScope,
  upsertFormScope,
  formatScopeLabel,
  getScopeLevels,
  getSectorOptions,
  getUsStates,
  getIndustriesForScope,
  getProgramsForScope,
  getOrganizationsForScope,
  getStoresForScope,
  type FormScopeEnriched,
} from '../../lib/crud/formScopes';
import type { TrackScopeLevel, SectorType } from '../../lib/crud/trackScopes';
import { getTagsByCategory } from '../../lib/crud/tags';

// ============================================================================
// TYPES
// ============================================================================

export interface FormBuilderProps {
  formId?: string;
  orgId?: string;
  /** Pre-selects form type when creating a new form. Has no effect when editing an existing form. */
  initialType?: string;
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
  labelKey: string;
  icon: React.ElementType;
  category: 'questions' | 'content' | 'actions';
}

const BLOCK_TYPES: BlockTypeDef[] = [
  // Questions
  { type: 'text', labelKey: 'forms.shortAnswer', icon: Type, category: 'questions' },
  { type: 'textarea', labelKey: 'forms.longAnswer', icon: Type, category: 'questions' },
  { type: 'number', labelKey: 'forms.number', icon: Hash, category: 'questions' },
  { type: 'date', labelKey: 'forms.date', icon: Calendar, category: 'questions' },
  { type: 'time', labelKey: 'forms.time', icon: Clock, category: 'questions' },
  { type: 'radio', labelKey: 'forms.multipleChoice', icon: CheckSquare, category: 'questions' },
  { type: 'checkboxes', labelKey: 'forms.checkboxes', icon: CheckSquare, category: 'questions' },
  { type: 'dropdown', labelKey: 'forms.dropdown', icon: ChevronDown, category: 'questions' },
  { type: 'yes_no', labelKey: 'forms.yesNo', icon: ToggleLeft, category: 'questions' },
  { type: 'rating', labelKey: 'forms.rating', icon: Star, category: 'questions' },
  { type: 'file', labelKey: 'forms.fileUpload', icon: Upload, category: 'questions' },
  { type: 'signature', labelKey: 'forms.signature', icon: PenTool, category: 'questions' },
  { type: 'slider', labelKey: 'forms.slider', icon: SlidersHorizontal, category: 'questions' },
  { type: 'location', labelKey: 'forms.location', icon: MapPin, category: 'questions' },
  { type: 'photo', labelKey: 'forms.photo', icon: ImageIcon, category: 'questions' },
  { type: 'store_lookup', labelKey: 'forms.storeLookup', icon: Building2, category: 'questions' },
  { type: 'role_lookup', labelKey: 'forms.roleLookup', icon: ShieldAlert, category: 'questions' },
  // Content
  { type: 'instruction', labelKey: 'forms.instruction', icon: Info, category: 'content' },
  { type: 'divider', labelKey: 'forms.divider', icon: Minus, category: 'content' },
  // NOTE: 'conditional' is intentionally NOT listed here.
  // Conditional logic is configured per-block via the Properties Drawer (Logic tab),
  // not as a standalone block type. Keeping it here caused UX confusion.
];

// ─── Form Type Config ─────────────────────────────────────────────────────────

interface FormTypeConfig {
  value: string;
  labelKey: string;
  descriptionKey: string;
  /** Block types that are especially relevant / auto-suggested for this form type */
  suggestedBlocks?: string[];
}

const FORM_TYPES: FormTypeConfig[] = [
  {
    value: 'inspection',
    labelKey: 'forms.formTypeInspection',
    descriptionKey: 'forms.inspectionDesc',
    suggestedBlocks: ['yes_no', 'photo', 'text'],
  },
  {
    value: 'audit',
    labelKey: 'forms.formTypeAudit',
    descriptionKey: 'forms.auditDesc',
    suggestedBlocks: ['rating', 'yes_no', 'textarea'],
  },
  {
    value: 'sign-off',
    labelKey: 'forms.formTypeSignOff',
    descriptionKey: 'forms.signOffDesc',
    suggestedBlocks: ['instruction', 'signature', 'checkboxes'],
  },
  {
    value: 'ojt-checklist',
    labelKey: 'forms.formTypeOJT',
    descriptionKey: 'forms.ojtDesc',
    suggestedBlocks: ['yes_no', 'rating', 'textarea'],
  },
  {
    value: 'survey',
    labelKey: 'forms.formTypeSurvey',
    descriptionKey: 'forms.surveyDesc',
    suggestedBlocks: ['radio', 'rating', 'textarea'],
  },
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
  formType?: string;
}

function BlockPicker({ onSelect, onClose, anchorRef, formType }: BlockPickerProps) {
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

  // Resolve suggested block types for the current form type
  const formTypeConfig = formType ? FORM_TYPES.find(ft => ft.value === formType) : undefined;
  const suggestedBlockTypes = formTypeConfig?.suggestedBlocks ?? [];
  const suggestedDefs = activeTab === 'questions'
    ? suggestedBlockTypes
        .map(st => BLOCK_TYPES.find(bt => bt.type === st))
        .filter((bt): bt is BlockTypeDef => !!bt)
    : [];

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

      {/* Suggested blocks hint for current form type */}
      {suggestedDefs.length > 0 && (
        <div className="mb-2">
          <p className="text-[11px] text-muted-foreground mb-1">
            Suggested for {formTypeConfig?.labelKey ? t(formTypeConfig.labelKey) : formType}
          </p>
          <div className="grid grid-cols-2 gap-1">
            {suggestedDefs.map(bt => {
              const Icon = bt.icon;
              return (
                <button
                  key={`suggested-${bt.type}`}
                  type="button"
                  onClick={() => {
                    onSelect(bt.type);
                    onClose();
                  }}
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors text-left"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>{t(bt.labelKey)}</span>
                  <Badge variant="outline" className="ml-auto text-[10px] px-1 py-0 h-4 border-primary/30 text-primary">
                    suggested
                  </Badge>
                </button>
              );
            })}
          </div>
          <Separator className="mt-2" />
        </div>
      )}

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
              <span>{t(bt.labelKey)}</span>
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
  formType?: string;
}

function AddBlockButton({ afterBlockId, sectionId, onAdd, formType }: AddBlockButtonProps) {
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
          formType={formType}
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
  allBlocks: LocalBlock[];
  isSelected: boolean;
  referencedByCount: number;
  onSelect: () => void;
  onDelete: () => void;
  onAdd: (blockType: string, sectionId?: string | null, afterBlockId?: string) => void;
  onOpenLogic: () => void;
  formType?: string;
}

function SortableBlockCard({ block, allBlocks, isSelected, referencedByCount, onSelect, onDelete, onAdd, onOpenLogic, formType }: BlockCardProps) {
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

  const hasLogic = !!(block.conditional_logic && (block.conditional_logic as ConditionalLogic).conditions?.length);
  const isCritical = !!(block.validation_rules as Record<string, unknown> | undefined)?._critical;
  const hasOnFailAssign = !!(block.validation_rules as Record<string, unknown> | undefined)?._on_fail_assign;
  const summaryText = hasLogic && !isSelected
    ? conditionSummaryText(block.conditional_logic as ConditionalLogic, allBlocks, t)
    : '';

  // ── Divider: render as a visual line, not a full block card ──
  if (block.block_type === 'divider') {
    return (
      <div>
        <div
          ref={setNodeRef}
          style={style}
          data-block-id={block.id}
          className={`group relative cursor-pointer py-3 px-2 rounded-lg transition-all ${
            isSelected ? 'ring-2 ring-primary/30 bg-primary/5' : 'hover:bg-muted/30'
          }`}
          onClick={onSelect}
        >
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab text-muted-foreground/30 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>

          {/* Delete button */}
          <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
              onClick={e => { e.stopPropagation(); onDelete(); }}
              aria-label="Delete divider"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* The actual divider line */}
          {block.label ? (
            <div className="flex items-center gap-3 px-6">
              <div className="flex-1 border-t border-border" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">{block.label}</span>
              <div className="flex-1 border-t border-border" />
            </div>
          ) : (
            <div className="px-6">
              <div className="border-t border-border" />
            </div>
          )}
        </div>

        {/* Add block button after this card */}
        <AddBlockButton
          afterBlockId={block.id}
          sectionId={block.section_id}
          onAdd={onAdd}
          formType={formType}
        />
      </div>
    );
  }

  return (
    <div>
      <div
        ref={setNodeRef}
        style={style}
        data-block-id={block.id}
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

        {/* Quick-add logic button + Delete button */}
        <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {!hasLogic && (
            <button
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-primary transition-colors"
              onClick={e => {
                e.stopPropagation();
                onOpenLogic();
              }}
              aria-label="Add conditional logic"
              title={t('forms.quickAddLogic')}
            >
              <GitBranch className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
            onClick={e => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label="Delete block"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="pl-8 pr-8 py-4">
          {/* Block type label */}
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <Icon className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {typeDef ? t(typeDef.labelKey) : block.block_type}
            </span>
            {isCritical && (
              <Badge variant="outline" className="text-xs px-1 py-0 h-4 ml-1 border-red-500/40 text-red-500">
                <ShieldAlert className="h-2.5 w-2.5 mr-0.5" />
                {t('forms.criticalBadge')}
              </Badge>
            )}
            {hasOnFailAssign && (
              <Badge variant="outline" className="text-xs px-1 py-0 h-4 ml-1 border-amber-500/40 text-amber-500">
                <GraduationCap className="h-2.5 w-2.5 mr-0.5" />
                {t('forms.onFailTrainingBadge')}
              </Badge>
            )}
            {hasLogic && (
              <Badge variant="outline" className="text-xs px-1 py-0 h-4 ml-1">
                <GitBranch className="h-2.5 w-2.5 mr-0.5" />
                {t('forms.logicBadge')}
              </Badge>
            )}
            {referencedByCount > 0 && (
              <Badge variant="secondary" className="text-xs px-1 py-0 h-4 ml-1">
                <GitBranch className="h-2.5 w-2.5 mr-0.5" />
                {t('forms.referencedBy', { count: referencedByCount })}
              </Badge>
            )}
          </div>

          {/* Question label */}
          <p className="text-sm font-medium">
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
                  {typeDef ? `${t(typeDef.labelKey)} ${t('forms.questionSuffix')}` : t('forms.untitledQuestion')}
                </span>
              )
            }
          </p>

          {/* Condition summary text */}
          {summaryText && (
            <div className="mt-1.5 px-2 py-1 rounded bg-muted/50 border border-border/50" title={summaryText}>
              <p className="text-[10px] text-muted-foreground line-clamp-1">
                {summaryText}
              </p>
            </div>
          )}

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
        formType={formType}
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
  sections?: Array<{ id: string; title: string }>;
  onChange: (logic: ConditionalLogic) => void;
}

// Block types whose answers come from a predefined options list.
const CHOICE_BLOCK_TYPES = ['radio', 'checkboxes', 'dropdown'];
// yes_no has implicit options 'Yes' / 'No'.
const YES_NO_OPTIONS = ['Yes', 'No'];

// Operators that are sensible for choice/text vs. numeric blocks.
const NUMERIC_OPERATORS = ['equals', 'not_equals', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'] as const;
const TEXT_OPERATORS = ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty'] as const;

function ConditionBuilder({ block, allBlocks, sections = [], onChange }: ConditionBuilderProps) {
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

  // Eligible source blocks — anything except non-interactive content
  const eligibleBlocks = allBlocks.filter(
    b => !['instruction', 'divider', 'section', 'conditional'].includes(b.block_type)
  );

  // Build a set of all existing block IDs for stale-reference checks
  const existingBlockIds = new Set(allBlocks.map(b => b.id));

  return (
    <div className="space-y-3">
      {/* Action + Operator row */}
      <div className="flex items-center gap-2 text-xs flex-wrap">
        <Select
          value={logic.action}
          onValueChange={(v) => {
            const patch: Partial<ConditionalLogic> = { action: v as ConditionalLogic['action'] };
            // Clear target_section_id when switching away from skip_to_section
            if (v !== 'skip_to_section') {
              patch.target_section_id = undefined;
            }
            updateLogic(patch);
          }}
        >
          <SelectTrigger className="h-7 text-xs w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="show">{t('forms.conditionShow')}</SelectItem>
            <SelectItem value="hide">{t('forms.conditionHide')}</SelectItem>
            {sections.length > 0 && (
              <SelectItem value="skip_to_section">{t('forms.conditionSkipToSection')}</SelectItem>
            )}
          </SelectContent>
        </Select>
        {logic.action !== 'skip_to_section' && (
          <span className="text-muted-foreground">{t('forms.conditionThisBlockWhen')}</span>
        )}
        {logic.action === 'skip_to_section' && (
          <span className="text-muted-foreground">{t('forms.conditionWhen')}</span>
        )}
        {logic.conditions.length > 1 && (
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
        )}
        {logic.conditions.length > 1 && (
          <span className="text-muted-foreground">{t('forms.conditionOfTheseAreTrue')}</span>
        )}
      </div>

      {/* Target section picker for skip_to_section */}
      {logic.action === 'skip_to_section' && sections.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground shrink-0">{t('forms.conditionJumpTo')}</span>
          <Select
            value={logic.target_section_id || 'none'}
            onValueChange={(v) => updateLogic({ target_section_id: v === 'none' ? undefined : v })}
          >
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue placeholder={t('forms.conditionSelectSection')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('forms.conditionSelectSection')}</SelectItem>
              {sections.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.title || t('forms.untitled')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Conditions list */}
      {logic.conditions.map((cond, i) => {
        const sourceBlock = eligibleBlocks.find(b => b.id === cond.source_block_id) ?? null;
        const isStaleRef = cond.source_block_id && !existingBlockIds.has(cond.source_block_id) && cond.source_block_id !== block.id;
        const isNoSource = !cond.source_block_id;
        const isChoiceBlock = sourceBlock ? CHOICE_BLOCK_TYPES.includes(sourceBlock.block_type) : false;
        const isYesNo = sourceBlock?.block_type === 'yes_no';
        const isNumeric = sourceBlock?.block_type === 'number' || sourceBlock?.block_type === 'rating' || sourceBlock?.block_type === 'slider';
        const choiceOptions = isYesNo
          ? YES_NO_OPTIONS
          : isChoiceBlock
          ? (sourceBlock?.options ?? [])
          : [];
        const showChoicePicker = (isChoiceBlock || isYesNo) && !['is_empty', 'is_not_empty'].includes(cond.operator);
        const showValueInput = !showChoicePicker && !['is_empty', 'is_not_empty'].includes(cond.operator);
        const needsValue = !['is_empty', 'is_not_empty'].includes(cond.operator);
        const isMissingValue = needsValue && !cond.value && cond.source_block_id;

        return (
          <div key={i} className="flex flex-col gap-1.5 pl-3 border-l-2 border-primary/40 bg-muted/30 rounded-r-md py-2 pr-2">
            {/* Validation warnings */}
            {isStaleRef && (
              <div className="flex items-center gap-1 text-[10px] text-red-500 px-1">
                <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                {t('forms.conditionStaleRef')}
              </div>
            )}

            {/* Source block picker */}
            <Select
              value={cond.source_block_id || 'none'}
              onValueChange={(v) => {
                // When source changes, clear value to avoid stale references
                updateCondition(i, { source_block_id: v === 'none' ? '' : v, value: '' });
              }}
            >
              <SelectTrigger className={`h-7 text-xs ${isNoSource ? 'border-amber-400' : ''}`}>
                <SelectValue placeholder={t('forms.conditionSelectQuestion')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('forms.conditionSelectQuestion')}</SelectItem>
                {eligibleBlocks.map(b => {
                  const btDef = getBlockTypeDef(b.block_type);
                  return (
                    <SelectItem key={b.id} value={b.id}>
                      {(b.label?.slice(0, 40)) || `${btDef ? t(btDef.labelKey) : b.block_type} ${t('forms.questionSuffix')}`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {isNoSource && (
              <div className="flex items-center gap-1 text-[10px] text-amber-500 px-1">
                <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                {t('forms.conditionNoSource')}
              </div>
            )}

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
                  {!isChoiceBlock && !isYesNo && (
                    <>
                      <SelectItem value="contains">{t('forms.opContains')}</SelectItem>
                      <SelectItem value="not_contains">{t('forms.opNotContains')}</SelectItem>
                    </>
                  )}
                  {(isNumeric || (!isChoiceBlock && !isYesNo)) && (
                    <>
                      <SelectItem value="greater_than">{t('forms.opGreaterThan')}</SelectItem>
                      <SelectItem value="less_than">{t('forms.opLessThan')}</SelectItem>
                    </>
                  )}
                  <SelectItem value="is_empty">{t('forms.opIsEmpty')}</SelectItem>
                  <SelectItem value="is_not_empty">{t('forms.opIsNotEmpty')}</SelectItem>
                </SelectContent>
              </Select>

              {/* Smart value input: dropdown for choice blocks, text for everything else */}
              {showChoicePicker && (
                <Select
                  value={cond.value || 'none'}
                  onValueChange={(v) => updateCondition(i, { value: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className={`h-7 text-xs flex-1 ${isMissingValue ? 'border-amber-400' : ''}`}>
                    <SelectValue placeholder={t('forms.conditionSelectValue')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('forms.conditionSelectValue')}</SelectItem>
                    {choiceOptions.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {showValueInput && (
                <input
                  type={isNumeric ? 'number' : 'text'}
                  value={cond.value}
                  onChange={(e) => updateCondition(i, { value: e.target.value })}
                  placeholder={t('forms.conditionValuePlaceholder')}
                  className={`flex-1 h-7 px-2 text-xs rounded-md border bg-background ${isMissingValue ? 'border-amber-400' : 'border-input'}`}
                />
              )}

              {logic.conditions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCondition(i)}
                  className="text-muted-foreground hover:text-destructive text-xs px-1 shrink-0"
                  aria-label="Remove condition"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {isMissingValue && (
              <div className="flex items-center gap-1 text-[10px] text-amber-500 px-1">
                <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                {t('forms.conditionMissingValue')}
              </div>
            )}

            {/* AND/OR label between conditions */}
            {i < logic.conditions.length - 1 && (
              <div className="text-xs text-muted-foreground/60 pl-1 font-medium">
                {logic.operator === 'AND' ? t('forms.conditionAnd') : t('forms.conditionOr')}
              </div>
            )}
          </div>
        );
      })}

      {/* Add condition */}
      <button
        type="button"
        onClick={addCondition}
        className="text-xs text-primary hover:underline flex items-center gap-1"
      >
        <Plus className="h-3 w-3" />
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
  sections?: Array<{ id: string; title: string }>;
  scoringEnabled?: boolean;
  onUpdate: (updates: Partial<LocalBlock>) => void;
  onDelete: () => void;
  onClose: () => void;
  /** Use wider drawer width (fullPage builder mode) */
  wide?: boolean;
  /** When set, forces the drawer to open on this tab */
  initialTab?: string;
  /** Dependency map for the mini dependency graph */
  dependencyMap?: Record<string, string[]>;
  /** Order issue error message for this block (dependency appears after it) */
  orderIssueMessage?: string;
}

function PropertiesDrawer({ block, allBlocks, sections = [], scoringEnabled, onUpdate, onDelete, onClose, wide = false, initialTab, dependencyMap = {}, orderIssueMessage }: PropertiesDrawerProps) {
  const { t } = useTranslation();
  const typeDef = getBlockTypeDef(block.block_type);
  const Icon = typeDef?.icon ?? Type;
  const hasChoices = ['radio', 'checkboxes', 'dropdown'].includes(block.block_type);
  const options = block.options ?? [];
  const hasConditionalLogic = !!(block.conditional_logic && (block.conditional_logic as ConditionalLogic).conditions?.length);
  const showScoringTab = scoringEnabled && SCOREABLE_BLOCK_TYPES.includes(block.block_type);

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
    <div className="shrink-0 h-full bg-background border-l border-border shadow-xl z-40 flex flex-col animate-in slide-in-from-right duration-200" style={{ width: wide ? 'min(28vw, 620px)' : '460px', minWidth: wide ? '510px' : '420px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{typeDef ? t(typeDef.labelKey) : block.block_type}</span>
          {hasConditionalLogic && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
              <GitBranch className="h-2.5 w-2.5" />
              {t('forms.logicBadge')}
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tab navigation */}
      <Tabs defaultValue={initialTab || 'settings'} className="flex flex-col flex-1 min-h-0">
        <div className="px-6 pt-3 shrink-0">
        <TabsList className="w-auto h-8">
          <TabsTrigger value="settings" className="text-xs h-7 px-3">{t('forms.propTabSettings')}</TabsTrigger>
          <TabsTrigger value="logic" className="text-xs h-7 px-3 relative">
            {t('forms.propTabLogic')}
            {(hasConditionalLogic || orderIssueMessage) && (
              <span className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ${orderIssueMessage ? 'bg-red-500' : 'bg-primary'}`} style={{ border: '2px solid var(--background)' }} />
            )}
          </TabsTrigger>
        </TabsList>
        </div>

        {/* ── SETTINGS TAB ─────────────────────────────────── */}
        <TabsContent value="settings" className="flex-1 overflow-y-auto px-6 py-4 space-y-4 mt-2">
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

        {/* Default to current — date/time blocks */}
        {(block.block_type === 'date' || block.block_type === 'time') && (
          <div className="flex items-center justify-between">
            <Label htmlFor="block-default-current" className="text-xs font-medium cursor-pointer">
              {block.block_type === 'date' ? t('forms.propDefaultCurrentDate') : t('forms.propDefaultCurrentTime')}
            </Label>
            <Switch
              id="block-default-current"
              checked={!!(block.validation_rules as Record<string, unknown> | undefined)?._default_to_current}
              onCheckedChange={checked => onUpdate({ validation_rules: { ...block.validation_rules, _default_to_current: checked } })}
            />
          </div>
        )}

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

        {/* ── SCORING CONTROLS (inline in Settings tab) ──── */}
        {showScoringTab && (() => {
          const vr = (block.validation_rules ?? {}) as Record<string, unknown>;
          const isCritical = !!(vr._critical);
          const allowNa = !!(vr._allow_na);
          const correctAnswer = ((vr._correct_answer as string) ?? '');
          const opts = block.options ?? [];

          const updateValidationRule = (key: string, value: unknown) => {
            onUpdate({ validation_rules: { ...block.validation_rules, [key]: value } });
          };

          return (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium">{t('forms.propScoring')}</p>
                <p className="text-xs text-muted-foreground">{t('forms.propScoringDescNew')}</p>
              </div>

              {/* Critical item toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="block-critical" className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                    {t('forms.propCriticalItem')}
                  </Label>
                  <p className="text-[10px] text-muted-foreground">{t('forms.propCriticalItemDesc')}</p>
                </div>
                <Switch
                  id="block-critical"
                  checked={isCritical}
                  onCheckedChange={checked => updateValidationRule('_critical', checked)}
                />
              </div>

              {/* Allow N/A toggle — only for yes_no blocks */}
              {block.block_type === 'yes_no' && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="block-allow-na" className="text-xs font-medium cursor-pointer">{t('forms.propAllowNA')}</Label>
                    <p className="text-[10px] text-muted-foreground">{t('forms.propAllowNADesc')}</p>
                  </div>
                  <Switch
                    id="block-allow-na"
                    checked={allowNa}
                    onCheckedChange={checked => updateValidationRule('_allow_na', checked)}
                  />
                </div>
              )}

              {/* Correct answer */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('forms.propCorrectAnswer')}</Label>
                {block.block_type === 'yes_no' ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateValidationRule('_correct_answer', 'yes')}
                      className={`flex-1 py-2 rounded-lg border-2 font-medium text-xs transition-colors ${
                        (!correctAnswer || correctAnswer === 'yes') ? 'border-green-500 bg-green-500/20 text-green-400' : 'border-border hover:border-green-500/50'
                      }`}
                    >
                      {t('forms.propExpectedYes')}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateValidationRule('_correct_answer', 'no')}
                      className={`flex-1 py-2 rounded-lg border-2 font-medium text-xs transition-colors ${
                        correctAnswer === 'no' ? 'border-red-500 bg-red-500/20 text-red-400' : 'border-border hover:border-red-500/50'
                      }`}
                    >
                      {t('forms.propExpectedNo')}
                    </button>
                  </div>
                ) : ['radio', 'dropdown'].includes(block.block_type) && opts.length > 0 ? (
                  <Select
                    value={correctAnswer || 'none'}
                    onValueChange={v => updateValidationRule('_correct_answer', v === 'none' ? '' : v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder={t('forms.propSelectCorrectAnswer')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('forms.propSelectCorrectAnswer')}</SelectItem>
                      {opts.map((opt, i) => (
                        <SelectItem key={i} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : block.block_type === 'checkboxes' && opts.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground">{t('forms.propCheckboxesCorrectHint')}</p>
                    <Input
                      value={correctAnswer}
                      onChange={e => updateValidationRule('_correct_answer', e.target.value)}
                      placeholder="e.g. Option 1, Option 3"
                      className="text-sm"
                    />
                  </div>
                ) : block.block_type === 'rating' ? (
                  <Input
                    type="number"
                    min={1}
                    max={(block.settings?.max_stars as number) ?? 5}
                    value={correctAnswer}
                    onChange={e => updateValidationRule('_correct_answer', e.target.value)}
                    placeholder="e.g. 5"
                    className="text-sm"
                  />
                ) : (
                  <Input
                    value={correctAnswer}
                    onChange={e => updateValidationRule('_correct_answer', e.target.value)}
                    placeholder={t('forms.propEnterCorrectAnswer')}
                    className="text-sm"
                  />
                )}
              </div>
            </>
          );
        })()}

        {/* ── PER-ITEM ON-FAIL → ASSIGN TRAINING ──── */}
        {showScoringTab && <PerItemOnFailTraining block={block} onUpdate={onUpdate} />}

        </TabsContent>

        {/* ── LOGIC TAB ────────────────────────────────────── */}
        <TabsContent value="logic" className="flex-1 overflow-y-auto px-6 py-4 mt-2">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">{t('forms.propConditionalLogic')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('forms.propConditionalLogicDesc')}</p>
            </div>

            {orderIssueMessage && (
              <div className="flex items-start gap-1.5 text-[11px] text-red-500 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{t('forms.dragDependencyWarning')}: {orderIssueMessage}</span>
              </div>
            )}

            {!hasConditionalLogic ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => {
                  onUpdate({
                    conditional_logic: {
                      action: 'show',
                      operator: 'AND',
                      conditions: [{ source_block_id: '', operator: 'equals', value: '' }],
                    } as ConditionalLogic,
                  });
                }}
              >
                <GitBranch className="h-3.5 w-3.5" />
                {t('forms.propAddCondition')}
              </Button>
            ) : (
              <>
                <ConditionBuilder
                  block={block}
                  allBlocks={allBlocks}
                  sections={sections}
                  onChange={(logic) => onUpdate({ conditional_logic: logic })}
                />
                <Separator />
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground/60 hover:text-destructive flex items-center gap-1 mx-auto transition-colors"
                  onClick={() => onUpdate({ conditional_logic: null })}
                >
                  <X className="h-3 w-3" />
                  {t('forms.propRemoveCondition')}
                </button>
              </>
            )}
            {/* Mini dependency graph */}
            <Separator />
            <MiniDependencyGraph
              block={block}
              allBlocks={[...allBlocks, block]}
              dependencyMap={dependencyMap}
            />
          </div>
        </TabsContent>


      </Tabs>

      {/* Footer — delete */}
      <div className="px-6 py-3 border-t border-border shrink-0 flex justify-end">
        <button
          type="button"
          onClick={onDelete}
          className="p-2 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
          title={t('forms.propDeleteBlock')}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// SECTION HEADER CARD
// ============================================================================

interface SectionHeaderCardProps {
  sectionId: string;
  title: string;
  description?: string;
  hasConditions?: boolean;
  isSelected?: boolean;
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onDelete: () => void;
  onClick?: () => void;
}

function SectionHeaderCard({
  sectionId,
  title,
  description,
  hasConditions,
  isSelected,
  onTitleChange,
  onDescriptionChange,
  onDelete,
  onClick,
}: SectionHeaderCardProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `section-${sectionId}` });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border-2 border-dashed px-5 py-3 mb-2 group relative cursor-pointer transition-colors ${
        isSelected
          ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
          : 'border-primary/30 bg-primary/5 hover:border-primary/50'
      }`}
      onClick={onClick}
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

      {/* Top-right controls */}
      <div className="absolute right-2 top-2 flex items-center gap-1">
        {hasConditions && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
            <GitBranch className="h-2.5 w-2.5" />
            {t('forms.logicBadge')}
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
          {t('forms.sectionBadge')}
        </Badge>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <Input
        value={title}
        onChange={e => { e.stopPropagation(); onTitleChange(e.target.value); }}
        onClick={e => e.stopPropagation()}
        className="font-semibold text-sm bg-transparent border-none shadow-none h-auto p-0 focus-visible:ring-0 mb-1"
        placeholder={t('forms.sectionTitlePlaceholder')}
      />
      <Input
        value={description ?? ''}
        onChange={e => { e.stopPropagation(); onDescriptionChange(e.target.value); }}
        onClick={e => e.stopPropagation()}
        className="text-xs text-muted-foreground bg-transparent border-none shadow-none h-auto p-0 focus-visible:ring-0"
        placeholder={t('forms.sectionDescPlaceholder')}
      />
    </div>
  );
}

// ============================================================================
// SECTION PROPERTIES DRAWER
// ============================================================================

interface SectionPropertiesDrawerProps {
  section: import('../../lib/crud/forms').FormSection;
  allBlocks: LocalBlock[];
  otherSections?: Array<{ id: string; title: string }>;
  onUpdate: (updates: Partial<import('../../lib/crud/forms').FormSection>) => void;
  onDelete: () => void;
  onClose: () => void;
  wide?: boolean;
}

function SectionPropertiesDrawer({ section, allBlocks, onUpdate, onDelete, onClose, wide = false }: SectionPropertiesDrawerProps) {
  const { t } = useTranslation();

  const sectionSettings = (section.settings ?? {}) as Record<string, unknown>;
  const sectionLogic = sectionSettings.conditional_logic as ConditionalLogic | null | undefined;
  const hasConditions = !!(sectionLogic?.conditions?.length);

  // Build a pseudo-block for the ConditionBuilder component (reuse existing UI)
  const pseudoBlock: LocalBlock = {
    id: `section-${section.id}`,
    form_id: section.form_id,
    block_type: 'section',
    label: section.title,
    is_required: false,
    display_order: -1,
    conditional_logic: sectionLogic ?? undefined,
  };

  // For section conditions, eligible source blocks are blocks NOT in this section
  const eligibleBlocks = allBlocks.filter(b => b.section_id !== section.id);

  const handleLogicChange = (logic: ConditionalLogic) => {
    // Section-level conditions only support show/hide, not skip_to_section
    const sanitized: ConditionalLogic = {
      ...logic,
      action: logic.action === 'skip_to_section' ? 'show' : logic.action,
    };
    onUpdate({
      settings: { ...sectionSettings, conditional_logic: sanitized },
    });
  };

  const handleRemoveLogic = () => {
    const { conditional_logic: _removed, ...rest } = sectionSettings;
    onUpdate({ settings: Object.keys(rest).length > 0 ? rest : null });
  };

  return (
    <div className="shrink-0 h-full bg-background border-l border-border shadow-xl z-40 flex flex-col animate-in slide-in-from-right duration-200" style={{ width: wide ? 'min(28vw, 620px)' : '460px', minWidth: wide ? '510px' : '420px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t('forms.sectionProperties')}</span>
          {hasConditions && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
              <GitBranch className="h-2.5 w-2.5" />
              {t('forms.logicBadge')}
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <Tabs defaultValue="settings" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full justify-start rounded-none border-b border-border px-6 py-0 bg-transparent shrink-0">
          <TabsTrigger value="settings" className="text-xs">
            <Settings2 className="h-3 w-3 mr-1" />
            {t('forms.sectionSettingsTab')}
          </TabsTrigger>
          <TabsTrigger value="logic" className="text-xs">
            <GitBranch className="h-3 w-3 mr-1" />
            {t('forms.sectionLogicTab')}
            {hasConditions && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary inline-block" />}
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="flex-1 overflow-y-auto px-6 py-4 mt-2">
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium">{t('forms.sectionTitle')}</Label>
              <Input
                value={section.title}
                onChange={e => onUpdate({ title: e.target.value })}
                className="mt-1"
                placeholder={t('forms.sectionTitlePlaceholder')}
              />
            </div>
            <div>
              <Label className="text-xs font-medium">{t('forms.sectionDescription')}</Label>
              <Textarea
                value={section.description ?? ''}
                onChange={e => onUpdate({ description: e.target.value })}
                className="mt-1"
                placeholder={t('forms.sectionDescPlaceholder')}
                rows={3}
              />
            </div>
            <Separator />
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive hover:bg-destructive/10 gap-1.5"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('forms.sectionDelete')}
            </Button>
          </div>
        </TabsContent>

        {/* Logic Tab */}
        <TabsContent value="logic" className="flex-1 overflow-y-auto px-6 py-4 mt-2">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">{t('forms.sectionConditionalLogic')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('forms.sectionConditionalLogicDesc')}</p>
            </div>

            {!hasConditions ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => {
                  handleLogicChange({
                    action: 'show',
                    operator: 'AND',
                    conditions: [{ source_block_id: '', operator: 'equals', value: '' }],
                  });
                }}
              >
                <GitBranch className="h-3.5 w-3.5" />
                {t('forms.propAddCondition')}
              </Button>
            ) : (
              <>
                <ConditionBuilder
                  block={pseudoBlock}
                  allBlocks={eligibleBlocks}
                  sections={[]}
                  onChange={handleLogicChange}
                />
                <Separator />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive hover:bg-destructive/10 gap-1.5"
                  onClick={handleRemoveLogic}
                >
                  <X className="h-3.5 w-3.5" />
                  {t('forms.propRemoveCondition')}
                </Button>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
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
// FORM SCOPE MODAL
// ============================================================================

const SCOPE_LABELS: Record<string, string> = {
  UNIVERSAL: 'Universal (all sectors)',
  SECTOR: 'Sector',
  INDUSTRY: 'Industry',
  STATE: 'State',
  COMPANY: 'Company',
  PROGRAM: 'Program',
  UNIT: 'Unit (location)',
};

function FormScopeModal({ isOpen, onClose, formId, organizationId, onSaved }: {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  organizationId: string;
  onSaved: (scope: FormScopeEnriched) => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scopeLevel, setScopeLevel] = useState<TrackScopeLevel>('COMPANY');
  const [sector, setSector] = useState<SectorType | ''>('');
  const [industryId, setIndustryId] = useState('');
  const [stateId, setStateId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [programId, setProgramId] = useState('');
  const [unitId, setUnitId] = useState('');

  const [usStates, setUsStates] = useState<{ id: string; code: string; name: string }[]>([]);
  const [industries, setIndustries] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string; code: string | null }[]>([]);

  useEffect(() => {
    if (!isOpen || !formId) return;
    setLoading(true);
    Promise.all([
      getFormScope(formId),
      getUsStates(),
      getIndustriesForScope(null),
      getProgramsForScope(),
      getOrganizationsForScope(true).catch(() => []),
      // Also fetch current org name as fallback
      supabase.from('organizations').select('id, name').eq('id', organizationId).then(r => r.data?.[0]),
    ])
      .then(([scope, states, ind, prog, orgs, currentOrg]) => {
        setUsStates(states as any[]);
        setIndustries(ind as any[]);
        setPrograms(prog);
        // Ensure current org is always in the list
        let orgList = (orgs || []) as { id: string; name: string }[];
        if (currentOrg && !orgList.find(o => o.id === currentOrg.id)) {
          orgList = [currentOrg as { id: string; name: string }, ...orgList];
        }
        setOrganizations(orgList);
        if (scope) {
          setScopeLevel(scope.scope_level);
          setSector((scope.sector as SectorType) || '');
          setIndustryId(scope.industry_id || '');
          setStateId(scope.state_id || '');
          setCompanyId(scope.company_id || organizationId);
          setProgramId(scope.program_id || '');
          setUnitId(scope.unit_id || '');
        } else {
          setScopeLevel('COMPANY');
          setCompanyId(organizationId);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, formId, organizationId]);

  useEffect(() => {
    if (scopeLevel !== 'INDUSTRY') return;
    const sf = sector ? (sector as SectorType) : null;
    getIndustriesForScope(sf).then(list => setIndustries(list as any[]));
  }, [scopeLevel, sector]);

  useEffect(() => {
    if (scopeLevel !== 'UNIT' || !companyId) { setStores([]); setUnitId(''); return; }
    getStoresForScope(companyId).then(s => { setStores(s as any[]); setUnitId(''); });
  }, [scopeLevel, companyId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertFormScope({
        form_id: formId,
        organization_id: organizationId,
        scope_level: scopeLevel,
        sector: scopeLevel === 'SECTOR' && sector ? (sector as SectorType) : null,
        industry_id: scopeLevel === 'INDUSTRY' && industryId ? industryId : null,
        state_id: scopeLevel === 'STATE' && stateId ? stateId : null,
        company_id: scopeLevel === 'COMPANY' && companyId ? companyId : null,
        program_id: scopeLevel === 'PROGRAM' && programId ? programId : null,
        unit_id: scopeLevel === 'UNIT' && unitId ? unitId : null,
      });
      const updated = await getFormScope(formId);
      if (updated) onSaved(updated);
      onClose();
    } catch (e: any) {
      console.error('[FormScope] Save error:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Form Scope</DialogTitle>
          <DialogDescription>
            Set the visibility scope for this form. This controls which organizations and users can see it.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-6 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Scope Level</Label>
              <Select value={scopeLevel} onValueChange={v => setScopeLevel(v as TrackScopeLevel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {getScopeLevels().map(level => (
                    <SelectItem key={level} value={level}>{SCOPE_LABELS[level] || level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {scopeLevel === 'SECTOR' && (
              <div className="space-y-2">
                <Label>Sector</Label>
                <Select value={sector || 'none'} onValueChange={v => setSector(v === 'none' ? '' : v as SectorType)}>
                  <SelectTrigger><SelectValue placeholder="Select sector..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select sector...</SelectItem>
                    {getSectorOptions().map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scopeLevel === 'INDUSTRY' && (
              <>
                <div className="space-y-2">
                  <Label>Sector (optional filter)</Label>
                  <Select value={sector || 'none'} onValueChange={v => { setSector(v === 'none' ? '' : v as SectorType); setIndustryId(''); }}>
                    <SelectTrigger><SelectValue placeholder="All sectors" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All sectors</SelectItem>
                      {getSectorOptions().map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Select value={industryId || 'none'} onValueChange={v => setIndustryId(v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Select industry..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select industry...</SelectItem>
                      {industries.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {scopeLevel === 'STATE' && (
              <div className="space-y-2">
                <Label>State</Label>
                <Select value={stateId || 'none'} onValueChange={v => setStateId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select state..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select state...</SelectItem>
                    {usStates.map(s => <SelectItem key={s.id} value={s.id}>{s.code} – {s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scopeLevel === 'COMPANY' && (
              <div className="space-y-2">
                <Label>Company</Label>
                <Select value={companyId || 'none'} onValueChange={v => setCompanyId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select company..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select company...</SelectItem>
                    {organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scopeLevel === 'PROGRAM' && (
              <div className="space-y-2">
                <Label>Program</Label>
                <Select value={programId || 'none'} onValueChange={v => setProgramId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select program..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select program...</SelectItem>
                    {programs.map(p => <SelectItem key={p.id} value={p.id}>{(p as any).name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scopeLevel === 'UNIT' && (
              <>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Select value={companyId || 'none'} onValueChange={v => setCompanyId(v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Select company first..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select company first...</SelectItem>
                      {organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {companyId && (
                  <div className="space-y-2">
                    <Label>Unit / Store</Label>
                    <Select value={unitId || 'none'} onValueChange={v => setUnitId(v === 'none' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Select unit..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select unit...</SelectItem>
                        {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// PER-ITEM ON-FAIL → ASSIGN TRAINING (inside Properties Drawer Settings tab)
// ============================================================================

function PerItemOnFailTraining({ block, onUpdate }: { block: LocalBlock; onUpdate: (updates: Partial<LocalBlock>) => void }) {
  const { t } = useTranslation();
  const vr = (block.validation_rules ?? {}) as Record<string, unknown>;
  const onFailAssign = vr._on_fail_assign as { type: 'playlist' | 'track'; id: string; title: string } | undefined;

  const [playlists, setPlaylists] = useState<{ id: string; title: string }[]>([]);
  const [tracks, setTracks] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      const { data: pl } = await supabase.from('playlists').select('id, title').eq('status', 'published').order('title');
      if (!cancelled && pl) setPlaylists(pl);
      const { data: tr } = await supabase.from('tracks').select('id, title').eq('status', 'published').order('title');
      if (!cancelled && tr) setTracks(tr);
    }
    fetch();
    return () => { cancelled = true; };
  }, []);

  const actionType = onFailAssign?.type ?? 'none';
  const actionId = onFailAssign?.id ?? '';

  function setOnFail(type: string, id: string, title: string) {
    if (type === 'none') {
      const { _on_fail_assign, ...rest } = vr;
      onUpdate({ validation_rules: rest as LocalBlock['validation_rules'] });
    } else {
      onUpdate({ validation_rules: { ...block.validation_rules, _on_fail_assign: { type, id, title } } });
    }
  }

  return (
    <>
      <Separator />
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <GraduationCap className="h-3.5 w-3.5 text-amber-500" />
          <Label className="text-xs font-medium">{t('forms.propOnFailAction')}</Label>
        </div>
        <p className="text-[10px] text-muted-foreground">{t('forms.propOnFailActionDesc')}</p>

        <Select
          value={actionType}
          onValueChange={v => setOnFail(v, '', '')}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('forms.propOnFailNoAction')}</SelectItem>
            <SelectItem value="playlist">{t('forms.propOnFailAssignPlaylist')}</SelectItem>
            <SelectItem value="track">{t('forms.propOnFailAssignTrack')}</SelectItem>
          </SelectContent>
        </Select>

        {actionType === 'playlist' && (
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">{t('forms.propOnFailTitle')}</Label>
            <Select
              value={actionId || 'none'}
              onValueChange={v => {
                const selected = playlists.find(p => p.id === v);
                setOnFail('playlist', v === 'none' ? '' : v, selected?.title ?? '');
              }}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder={t('forms.propOnFailIdPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('forms.propOnFailIdPlaceholder')}</SelectItem>
                {playlists.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {actionType === 'track' && (
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">{t('forms.propOnFailTitle')}</Label>
            <Select
              value={actionId || 'none'}
              onValueChange={v => {
                const selected = tracks.find(tr => tr.id === v);
                setOnFail('track', v === 'none' ? '' : v, selected?.title ?? '');
              }}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder={t('forms.propOnFailIdPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('forms.propOnFailIdPlaceholder')}</SelectItem>
                {tracks.map(tr => (
                  <SelectItem key={tr.id} value={tr.id}>{tr.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================================
// SUBMISSION ACTIONS PANEL
// ============================================================================

interface SubmissionActionsPanelProps {
  config: SubmissionConfig;
  scoringEnabled: boolean;
  identityMode: 'individual' | 'location' | 'anonymous';
  onChange: (config: SubmissionConfig) => void;
}

// Determine if a stored below_threshold_email value is a "role" keyword or a custom email
function isRoleKeyword(val: string | undefined): boolean {
  return !val || ['manager', 'district_manager', 'admin'].includes(val);
}

function SubmissionActionsPanel({ config, scoringEnabled, identityMode, onChange }: SubmissionActionsPanelProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  // Local state for custom threshold email input (when 'specific_email' is chosen in dropdown)
  const [thresholdCustomEmail, setThresholdCustomEmail] = useState<string>(() => {
    const val = config.score_threshold_action?.below_threshold_email;
    return isRoleKeyword(val) ? '' : (val ?? '');
  });

  const notifications = config.email_notifications ?? [];

  function addNotification() {
    const newEntry: EmailNotification = {
      id: Math.random().toString(36).slice(2),
      to_type: 'store_manager',
      trigger: 'always',
      include_score: false,
      include_responses: false,
    };
    onChange({ ...config, email_notifications: [...notifications, newEntry] });
  }

  function updateNotification(id: string, updates: Partial<EmailNotification>) {
    onChange({
      ...config,
      email_notifications: notifications.map(n => n.id === id ? { ...n, ...updates } : n),
    });
  }

  function removeNotification(id: string) {
    onChange({ ...config, email_notifications: notifications.filter(n => n.id !== id) });
  }

  return (
    <div className="mt-4 border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <span>{t('forms.submissionActionsTitle')}</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="p-4 space-y-5 text-sm">
          <p className="text-xs text-muted-foreground">{t('forms.submissionActionsDesc')}</p>

          <Separator />

          {/* Confirmation message */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('forms.submissionConfirmMessage')}</Label>
            <Textarea
              value={config.confirmation_message ?? ''}
              onChange={e => onChange({ ...config, confirmation_message: e.target.value })}
              placeholder="Thank you for submitting!"
              className="text-xs min-h-[60px]"
            />
          </div>

          {/* Send confirmation email — hidden for anonymous mode */}
          {identityMode !== 'anonymous' && (
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">
                {identityMode === 'location'
                  ? t('forms.submissionToStore')
                  : t('forms.submissionToSubmitter')}
              </Label>
              <Switch
                checked={config.send_email_to_submitter ?? false}
                onCheckedChange={v => onChange({ ...config, send_email_to_submitter: v })}
              />
            </div>
          )}

          <Separator />

          {/* Email Notifications */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs font-medium">{t('forms.submissionEmailNotifications')}</Label>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-xs gap-1 px-2"
                onClick={addNotification}
              >
                <Plus className="h-3 w-3" />
                {t('forms.submissionAddNotification')}
              </Button>
            </div>

            {notifications.length === 0 && (
              <p className="text-xs text-muted-foreground italic">{t('forms.notifNoNotifications')}</p>
            )}

            {notifications.map(notif => (
              <div key={notif.id} className="border border-border rounded-md p-3 space-y-2 bg-muted/20">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs text-muted-foreground">{t('forms.submissionSendToType')}</Label>
                    <Select
                      value={notif.to_type}
                      onValueChange={(v) => updateNotification(notif.id, { to_type: v as EmailNotification['to_type'] })}
                    >
                      <SelectTrigger className="h-7 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="store_manager">{t('forms.notifToStoreManager')}</SelectItem>
                        <SelectItem value="district_manager">{t('forms.notifToDistrictManager')}</SelectItem>
                        <SelectItem value="admin">{t('forms.notifToAdmin')}</SelectItem>
                        <SelectItem value="specific_email">{t('forms.notifToSpecificEmail')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0 mt-4"
                    onClick={() => removeNotification(notif.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {notif.to_type === 'specific_email' && (
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('forms.notifEmailAddress')}</Label>
                    <Input
                      value={notif.to_email ?? ''}
                      onChange={e => updateNotification(notif.id, { to_email: e.target.value })}
                      placeholder="email@example.com"
                      className="h-7 text-xs mt-1"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('forms.submissionTrigger')}</Label>
                    <Select
                      value={notif.trigger}
                      onValueChange={(v) => updateNotification(notif.id, { trigger: v as EmailNotification['trigger'] })}
                    >
                      <SelectTrigger className="h-7 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="always">{t('forms.triggerAlways')}</SelectItem>
                        <SelectItem value="on_fail">{t('forms.triggerOnFail')}</SelectItem>
                        <SelectItem value="on_pass">{t('forms.triggerOnPass')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5 pt-1">
                    <div className="flex items-center gap-1.5 mt-4">
                      <input
                        type="checkbox"
                        id={`score-${notif.id}`}
                        checked={notif.include_score ?? false}
                        onChange={e => updateNotification(notif.id, { include_score: e.target.checked })}
                        className="h-3.5 w-3.5"
                      />
                      <label htmlFor={`score-${notif.id}`} className="text-xs text-muted-foreground cursor-pointer">
                        {t('forms.submissionIncludeScore')}
                      </label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        id={`responses-${notif.id}`}
                        checked={notif.include_responses ?? false}
                        onChange={e => updateNotification(notif.id, { include_responses: e.target.checked })}
                        className="h-3.5 w-3.5"
                      />
                      <label htmlFor={`responses-${notif.id}`} className="text-xs text-muted-foreground cursor-pointer">
                        {t('forms.submissionIncludeResponses')}
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Score threshold action — only when scoring is enabled */}
          {scoringEnabled && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-xs font-medium">{t('forms.submissionScoreThreshold')}</Label>
                <p className="text-xs text-muted-foreground">{t('forms.submissionBelowThresholdEmail')}</p>

                <div>
                  <Label className="text-xs text-muted-foreground">{t('forms.notifNotify')}</Label>
                  <Select
                    value={
                      !config.score_threshold_action?.below_threshold_email
                        ? 'none'
                        : isRoleKeyword(config.score_threshold_action.below_threshold_email)
                        ? config.score_threshold_action.below_threshold_email
                        : 'specific_email'
                    }
                    onValueChange={(v) => {
                      if (v === 'specific_email') {
                        // Don't write to config yet — wait for the email input
                        onChange({
                          ...config,
                          score_threshold_action: {
                            ...config.score_threshold_action,
                            below_threshold_email: thresholdCustomEmail || '',
                          },
                        });
                      } else {
                        onChange({
                          ...config,
                          score_threshold_action: {
                            ...config.score_threshold_action,
                            below_threshold_email: v === 'none' ? '' : v,
                          },
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs mt-1">
                      <SelectValue placeholder="Select recipient…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('forms.notifNone')}</SelectItem>
                      <SelectItem value="manager">{t('forms.notifToStoreManager')}</SelectItem>
                      <SelectItem value="district_manager">{t('forms.notifToDistrictManager')}</SelectItem>
                      <SelectItem value="admin">{t('forms.notifToAdmin')}</SelectItem>
                      <SelectItem value="specific_email">{t('forms.notifToSpecificEmail')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {!isRoleKeyword(config.score_threshold_action?.below_threshold_email) && config.score_threshold_action?.below_threshold_email !== '' && (
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('forms.notifEmailAddress')}</Label>
                    <Input
                      value={thresholdCustomEmail}
                      onChange={e => {
                        setThresholdCustomEmail(e.target.value);
                        onChange({
                          ...config,
                          score_threshold_action: {
                            ...config.score_threshold_action,
                            below_threshold_email: e.target.value,
                          },
                        });
                      }}
                      placeholder="email@example.com"
                      className="h-7 text-xs mt-1"
                    />
                  </div>
                )}

                <div>
                  <Label className="text-xs text-muted-foreground">{t('forms.notifCustomMessage')}</Label>
                  <Textarea
                    value={config.score_threshold_action?.below_threshold_message ?? ''}
                    onChange={e => onChange({
                      ...config,
                      score_threshold_action: {
                        ...config.score_threshold_action,
                        below_threshold_message: e.target.value,
                      },
                    })}
                    placeholder="Score below threshold. Please review with your manager."
                    className="text-xs min-h-[60px] mt-1"
                  />
                </div>
              </div>
            </>
          )}

          {/* On Fail Actions — only when scoring is enabled */}
          {scoringEnabled && (
            <>
              <Separator />
              <OnFailActionsSection config={config} onChange={onChange} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ON FAIL ACTIONS SECTION (within Submission Actions)
// ============================================================================

function OnFailActionsSection({ config, onChange }: { config: SubmissionConfig; onChange: (c: SubmissionConfig) => void }) {
  const { t } = useTranslation();
  const onFail = config.on_fail ?? {};

  const [availableForms, setAvailableForms] = useState<{ id: string; title: string }[]>([]);
  const [availablePlaylists, setAvailablePlaylists] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function fetchOptions() {
      const { data: forms } = await supabase
        .from('forms')
        .select('id, title')
        .eq('status', 'published')
        .order('title');
      if (!cancelled && forms) setAvailableForms(forms);

      const { data: playlists } = await supabase
        .from('playlists')
        .select('id, title')
        .eq('status', 'published')
        .order('title');
      if (!cancelled && playlists) setAvailablePlaylists(playlists);
    }
    fetchOptions();
    return () => { cancelled = true; };
  }, []);

  function updateOnFail(updates: Partial<OnFailConfig>) {
    onChange({ ...config, on_fail: { ...onFail, ...updates } });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
        <Label className="text-xs font-medium">{t('forms.onFailTitle')}</Label>
      </div>
      <p className="text-xs text-muted-foreground">{t('forms.onFailDesc')}</p>

      {/* a) Custom fail message */}
      <div className="border border-red-200 dark:border-red-900/40 rounded-md p-3 space-y-2 bg-red-50/50 dark:bg-red-950/20">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-red-400" />
          <Label className="text-xs font-medium">{t('forms.onFailMessage')}</Label>
        </div>
        <Textarea
          value={onFail.fail_message ?? ''}
          onChange={e => updateOnFail({ fail_message: e.target.value })}
          placeholder={t('forms.onFailMessagePlaceholder')}
          className="text-xs min-h-[60px]"
        />
      </div>

      {/* b) Reassign this form */}
      <div className="border border-red-200 dark:border-red-900/40 rounded-md p-3 space-y-2 bg-red-50/50 dark:bg-red-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 text-red-400" />
            <Label className="text-xs font-medium">{t('forms.onFailReassign')}</Label>
          </div>
          <Switch
            checked={onFail.reassign?.enabled ?? false}
            onCheckedChange={v => updateOnFail({ reassign: { enabled: v, delay_hours: onFail.reassign?.delay_hours ?? 48 } })}
          />
        </div>
        {onFail.reassign?.enabled && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">{t('forms.onFailReassignIn')}</span>
            <Input
              type="number"
              min={1}
              value={onFail.reassign.delay_hours}
              onChange={e => updateOnFail({ reassign: { enabled: true, delay_hours: parseInt(e.target.value) || 1 } })}
              className="h-7 w-20 text-xs"
            />
            <span className="text-muted-foreground">{t('forms.onFailHours')}</span>
          </div>
        )}
      </div>

      {/* c) Assign follow-up form */}
      <div className="border border-red-200 dark:border-red-900/40 rounded-md p-3 space-y-2 bg-red-50/50 dark:bg-red-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-red-400" />
            <Label className="text-xs font-medium">{t('forms.onFailAssignForm')}</Label>
          </div>
          <Switch
            checked={onFail.assign_form?.enabled ?? false}
            onCheckedChange={v => updateOnFail({
              assign_form: {
                enabled: v,
                form_id: onFail.assign_form?.form_id ?? '',
                form_title: onFail.assign_form?.form_title ?? '',
              },
            })}
          />
        </div>
        {onFail.assign_form?.enabled && (
          <div>
            <Label className="text-xs text-muted-foreground">{t('forms.onFailSelectForm')}</Label>
            <Select
              value={onFail.assign_form.form_id || 'none'}
              onValueChange={v => {
                const selected = availableForms.find(f => f.id === v);
                updateOnFail({
                  assign_form: {
                    enabled: true,
                    form_id: v === 'none' ? '' : v,
                    form_title: selected?.title ?? '',
                  },
                });
              }}
            >
              <SelectTrigger className="h-7 text-xs mt-1">
                <SelectValue placeholder={t('forms.onFailSelectFormPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('forms.notifNone')}</SelectItem>
                {availableForms.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* d) Assign training */}
      <div className="border border-red-200 dark:border-red-900/40 rounded-md p-3 space-y-2 bg-red-50/50 dark:bg-red-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-red-400" />
            <Label className="text-xs font-medium">{t('forms.onFailAssignTraining')}</Label>
          </div>
          <Switch
            checked={onFail.assign_training?.enabled ?? false}
            onCheckedChange={v => updateOnFail({
              assign_training: {
                enabled: v,
                playlist_id: onFail.assign_training?.playlist_id ?? '',
                playlist_title: onFail.assign_training?.playlist_title ?? '',
              },
            })}
          />
        </div>
        {onFail.assign_training?.enabled && (
          <div>
            <Label className="text-xs text-muted-foreground">{t('forms.onFailSelectPlaylist')}</Label>
            <Select
              value={onFail.assign_training.playlist_id || 'none'}
              onValueChange={v => {
                const selected = availablePlaylists.find(p => p.id === v);
                updateOnFail({
                  assign_training: {
                    enabled: true,
                    playlist_id: v === 'none' ? '' : v,
                    playlist_title: selected?.title ?? '',
                  },
                });
              }}
            >
              <SelectTrigger className="h-7 text-xs mt-1">
                <SelectValue placeholder={t('forms.onFailSelectPlaylistPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('forms.notifNone')}</SelectItem>
                {availablePlaylists.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// START CONFIG PANEL
// ============================================================================

const DEFAULT_SHIFT_OPTIONS = ['Opening', 'Mid-day', 'Closing', 'Overnight'];

interface StartConfigPanelProps {
  config: StartConfig;
  onChange: (config: StartConfig) => void;
}

function StartConfigPanel({ config, onChange }: StartConfigPanelProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const identityMode = config.identity_mode || 'individual';
  const submissionLimit = config.submission_limit || 'unlimited';

  const hasConfig = identityMode !== 'individual' || submissionLimit !== 'unlimited';

  return (
    <div className="mt-2 mb-2 border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Play className="h-4 w-4 text-green-500" />
          <span>{t('forms.startConfigTitle')}</span>
          {hasConfig && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {t('forms.startConfigActive')}
            </Badge>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="p-4 space-y-5 text-sm">
          <p className="text-xs text-muted-foreground">{t('forms.startConfigDesc')}</p>

          <Separator />

          {/* Identity Mode */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs font-medium">{t('forms.startConfigIdentityMode')}</Label>
            </div>
            <Select
              value={identityMode}
              onValueChange={(v) => onChange({ ...config, identity_mode: v as StartConfig['identity_mode'] })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">{t('forms.startConfigIdentityIndividual')}</SelectItem>
                <SelectItem value="location">{t('forms.startConfigIdentityLocation')}</SelectItem>
                <SelectItem value="anonymous">{t('forms.startConfigIdentityAnonymous')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground/70">
              {identityMode === 'individual' && t('forms.startConfigIdentityIndividualDesc')}
              {identityMode === 'location' && t('forms.startConfigIdentityLocationDesc')}
              {identityMode === 'anonymous' && t('forms.startConfigIdentityAnonymousDesc')}
            </p>
          </div>

          <Separator />

          {/* Submission Limit */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs font-medium">{t('forms.startConfigSubmissionLimit')}</Label>
            </div>
            <Select
              value={submissionLimit}
              onValueChange={(v) => onChange({ ...config, submission_limit: v as StartConfig['submission_limit'] })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unlimited">{t('forms.startConfigLimitUnlimited')}</SelectItem>
                <SelectItem value="daily">{t('forms.startConfigLimitDaily')}</SelectItem>
                <SelectItem value="shift">{t('forms.startConfigLimitShift')}</SelectItem>
                <SelectItem value="weekly">{t('forms.startConfigLimitWeekly')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CONNECTOR LINE
// ============================================================================

function ConnectorLine() {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="w-0.5 h-5 border-l-2 border-dashed border-muted-foreground/30" />
    </div>
  );
}

// ============================================================================
// DEPENDENCY LINES OVERLAY — SVG connector lines between blocks with conditions
// ============================================================================

/** Color for dependency lines based on the logic action */
function getDependencyLineColor(action: string): string {
  switch (action) {
    case 'show': return '#22c55e'; // green-500
    case 'hide': return '#ef4444'; // red-500
    case 'skip_to_section': return '#3b82f6'; // blue-500
    default: return '#a855f7'; // purple-500
  }
}

interface DependencyLine {
  sourceId: string;
  targetId: string;
  action: string;
  label: string;
}

interface DependencyLinesOverlayProps {
  blocks: LocalBlock[];
  selectedBlockId: string | null;
  showAll: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  orderIssues?: Map<string, string>;
}

function DependencyLinesOverlay({ blocks, selectedBlockId, showAll, canvasRef, orderIssues }: DependencyLinesOverlayProps) {
  const [lines, setLines] = useState<Array<{
    x1: number; y1: number; x2: number; y2: number;
    action: string; label: string; targetId: string;
  }>>([]);

  const OPERATOR_SYMBOLS: Record<string, string> = {
    equals: '=', not_equals: '\u2260', contains: '\u2283', not_contains: '\u2285',
    greater_than: '>', less_than: '<', is_empty: 'empty', is_not_empty: 'not empty',
  };

  // Collect dependency lines to draw
  const dependencyLines = useMemo(() => {
    const result: DependencyLine[] = [];
    for (const block of blocks) {
      const logic = block.conditional_logic as ConditionalLogic | null;
      if (!logic?.conditions?.length) continue;

      // Only show lines for selected block (or all if toggle is on)
      if (!showAll && block.id !== selectedBlockId) {
        // Also check if this block is a source for the selected block
        const selectedLogic = blocks.find(b => b.id === selectedBlockId)?.conditional_logic as ConditionalLogic | null;
        const isSourceForSelected = selectedLogic?.conditions?.some(c => c.source_block_id === block.id);
        // Also check if selected block is a source for this block
        const isTargetOfSelected = logic.conditions.some(c => c.source_block_id === selectedBlockId);
        if (!isSourceForSelected && !isTargetOfSelected) continue;
      }

      for (const cond of logic.conditions) {
        if (!cond.source_block_id) continue;
        const opSymbol = OPERATOR_SYMBOLS[cond.operator] || cond.operator;
        const labelText = cond.operator === 'is_empty' || cond.operator === 'is_not_empty'
          ? opSymbol
          : `${opSymbol} ${cond.value || '?'}`;
        result.push({
          sourceId: cond.source_block_id,
          targetId: block.id,
          action: logic.action,
          label: labelText,
        });
      }
    }
    return result;
  }, [blocks, selectedBlockId, showAll]);

  // Calculate pixel positions from DOM
  const recalculate = useCallback(() => {
    if (!canvasRef.current || dependencyLines.length === 0) {
      setLines([]);
      return;
    }
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const scrollTop = canvasRef.current.scrollTop;
    const scrollLeft = canvasRef.current.scrollLeft;

    const newLines: typeof lines = [];
    for (const dep of dependencyLines) {
      const sourceEl = canvasRef.current.querySelector(`[data-block-id="${dep.sourceId}"]`);
      const targetEl = canvasRef.current.querySelector(`[data-block-id="${dep.targetId}"]`);
      if (!sourceEl || !targetEl) continue;

      const sourceRect = sourceEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();

      // Anchor at right edge of each block card
      const x1 = sourceRect.right - canvasRect.left + scrollLeft;
      const y1 = sourceRect.top + sourceRect.height / 2 - canvasRect.top + scrollTop;
      const x2 = targetRect.right - canvasRect.left + scrollLeft;
      const y2 = targetRect.top + targetRect.height / 2 - canvasRect.top + scrollTop;

      newLines.push({ x1, y1, x2, y2, action: dep.action, label: dep.label, targetId: dep.targetId });
    }
    setLines(newLines);
  }, [dependencyLines, canvasRef]);

  useEffect(() => {
    recalculate();
    // Recalculate on scroll and resize
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('scroll', recalculate);
    window.addEventListener('resize', recalculate);
    // Also recalculate after a short delay for layout settling
    const timer = setTimeout(recalculate, 100);
    return () => {
      canvas.removeEventListener('scroll', recalculate);
      window.removeEventListener('resize', recalculate);
      clearTimeout(timer);
    };
  }, [recalculate]);

  if (lines.length === 0) return null;

  // Find the needed SVG dimensions
  const maxX = Math.max(...lines.map(l => Math.max(l.x1, l.x2))) + 80;
  const maxY = Math.max(...lines.map(l => Math.max(l.y1, l.y2))) + 40;

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none z-10"
      style={{ width: maxX, height: maxY }}
    >
      <defs>
        {/* Arrowhead markers for each color */}
        <marker id="arrow-show" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#22c55e" />
        </marker>
        <marker id="arrow-hide" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#ef4444" />
        </marker>
        <marker id="arrow-skip_to_section" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#3b82f6" />
        </marker>
        <marker id="arrow-default" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#a855f7" />
        </marker>
      </defs>
      {lines.map((line, i) => {
        const hasOrderIssue = orderIssues?.has(line.targetId);
        const color = hasOrderIssue ? '#ef4444' : getDependencyLineColor(line.action);
        const markerId = `arrow-${line.action === 'show' || line.action === 'hide' || line.action === 'skip_to_section' ? line.action : 'default'}`;

        // Draw a bezier curve to the right
        const offset = 16 + (i % 4) * 8;
        const midX = Math.max(line.x1, line.x2) + offset;
        const path = `M${line.x1},${line.y1} C${midX},${line.y1} ${midX},${line.y2} ${line.x2},${line.y2}`;
        const labelX = midX + 4;
        const labelY = (line.y1 + line.y2) / 2;

        return (
          <g key={i}>
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeDasharray="6 3"
              markerEnd={`url(#${markerId})`}
              opacity={0.7}
            >
              <animate
                attributeName="stroke-dashoffset"
                from="18"
                to="0"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </path>
            {/* Label */}
            <rect
              x={labelX - 2}
              y={labelY - 7}
              width={line.label.length * 5.5 + 8}
              height={14}
              rx="3"
              fill="var(--background, #1e293b)"
              stroke={color}
              strokeWidth="0.5"
              opacity="0.85"
            />
            <text
              x={labelX + 2}
              y={labelY + 3}
              fontSize="9"
              fill={color}
              fontFamily="monospace"
              fontWeight="500"
            >
              {line.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ============================================================================
// MINI DEPENDENCY GRAPH — shown in Logic tab of Properties Drawer
// ============================================================================

interface MiniDependencyGraphProps {
  block: LocalBlock;
  allBlocks: LocalBlock[];
  dependencyMap: Record<string, string[]>;
}

function MiniDependencyGraph({ block, allBlocks, dependencyMap }: MiniDependencyGraphProps) {
  const { t } = useTranslation();

  // Source blocks: blocks referenced in this block's conditions
  const logic = block.conditional_logic as ConditionalLogic | null;
  const sourceBlockIds = useMemo(() => {
    if (!logic?.conditions?.length) return [];
    return [...new Set(logic.conditions.map(c => c.source_block_id).filter(Boolean))];
  }, [logic]);

  // Dependent blocks: blocks that reference this block
  const dependentBlockIds = dependencyMap[block.id] ?? [];

  const getBlockLabel = (id: string): string => {
    const b = allBlocks.find(bl => bl.id === id);
    if (!b) return t('forms.unknownBlock');
    return b.label ? (b.label.length > 20 ? b.label.slice(0, 20) + '\u2026' : b.label) : (getBlockTypeDef(b.block_type) ? t(getBlockTypeDef(b.block_type)!.labelKey) : b.block_type);
  };

  const getBlockAction = (id: string): string => {
    const b = allBlocks.find(bl => bl.id === id);
    const bLogic = b?.conditional_logic as ConditionalLogic | null;
    return bLogic?.action || 'show';
  };

  if (sourceBlockIds.length === 0 && dependentBlockIds.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
      {/* Depends on */}
      {sourceBlockIds.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">{t('forms.depGraphSources')}</p>
          <div className="flex flex-wrap gap-1">
            {sourceBlockIds.map(id => (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted border border-border/60 max-w-[160px] truncate"
                title={getBlockLabel(id)}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getDependencyLineColor(logic?.action || 'show') }} />
                {getBlockLabel(id)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Used by */}
      {dependentBlockIds.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">{t('forms.depGraphDependents')}</p>
          <div className="flex flex-wrap gap-1">
            {dependentBlockIds.map(id => (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted border border-border/60 max-w-[160px] truncate"
                title={getBlockLabel(id)}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getDependencyLineColor(getBlockAction(id)) }} />
                {getBlockLabel(id)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN FORM BUILDER COMPONENT
// ============================================================================

export function FormBuilder({
  formId,
  orgId = '',
  initialType,
  currentRole,
  onSaveDraft,
  onPublished,
  onCancel,
  fullPage = false,
}: FormBuilderProps) {
  const { t } = useTranslation();
  const hook = useFormBuilder({ formId, orgId, initialType });
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showDependencies, setShowDependencies] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Scope
  const [showScopeModal, setShowScopeModal] = useState(false);
  const [scopeData, setScopeData] = useState<FormScopeEnriched | null>(null);
  useEffect(() => {
    if (!hook.form?.id || hook.form.id.startsWith('new-')) return;
    getFormScope(hook.form.id).then(setScopeData).catch(() => {});
  }, [hook.form?.id]);

  // Content topic tags from tags table
  const [contentTopics, setContentTopics] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    getTagsByCategory('content').then(tags => {
      setContentTopics(tags.map(t => ({ id: t.id, name: t.name })));
    }).catch(() => {});
  }, []);

  // Track blocks with out-of-order dependency issues: blockId → error message
  const orderIssues = useMemo(() => {
    const issues = new Map<string, string>();
    const positions = new Map(hook.blocks.map((b, i) => [b.id, i]));
    for (const block of hook.blocks) {
      const logic = block.conditional_logic as ConditionalLogic | null;
      if (!logic?.conditions?.length) continue;
      const blockPos = positions.get(block.id) ?? 0;
      for (const cond of logic.conditions) {
        if (!cond.source_block_id) continue;
        const sourcePos = positions.get(cond.source_block_id);
        if (sourcePos !== undefined && sourcePos > blockPos) {
          const sourceBlock = hook.blocks.find(b => b.id === cond.source_block_id);
          const sourceName = sourceBlock?.label || '?';
          issues.set(block.id, `${t('forms.dragDependsOn')} "${sourceName}" ${t('forms.dragWhichIsNowBelow')}`);
          break;
        }
      }
    }
    return issues;
  }, [hook.blocks, t]);

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const current = hook.form?.tags || [];
    if (!current.includes(trimmed)) {
      hook.setFormTags([...current, trimmed]);
    }
  }, [hook.form?.tags, hook.setFormTags]);

  const removeTag = useCallback((tag: string) => {
    const current = hook.form?.tags || [];
    hook.setFormTags(current.filter(t => t !== tag));
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

    // Check for dependency order issues after the move
    // Build the new order
    const reordered = [...hook.blocks];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    const newPositions = new Map(reordered.map((b, i) => [b.id, i]));

    // Check: does the moved block have conditions referencing blocks that are now AFTER it?
    const movedLogic = movedBlock.conditional_logic as ConditionalLogic | null;
    if (movedLogic?.conditions?.length) {
      const movedPos = newPositions.get(movedBlock.id) ?? 0;
      for (const cond of movedLogic.conditions) {
        if (!cond.source_block_id) continue;
        const sourcePos = newPositions.get(cond.source_block_id);
        if (sourcePos !== undefined && sourcePos > movedPos) {
          const sourceBlock = hook.blocks.find(b => b.id === cond.source_block_id);
          const sourceName = sourceBlock?.label || t('forms.unknownBlock');
          toast.warning(t('forms.dragDependencyWarning'), {
            description: `"${movedBlock.label}" ${t('forms.dragDependsOn')} "${sourceName}" ${t('forms.dragWhichIsNowBelow')}`,
            duration: 5000,
          });
          break;
        }
      }
    }

    // Check: does any block that depends on the moved block now appear BEFORE it?
    const movedNewPos = newPositions.get(movedBlock.id) ?? 0;
    for (const block of reordered) {
      if (block.id === movedBlock.id) continue;
      const logic = block.conditional_logic as ConditionalLogic | null;
      if (!logic?.conditions?.length) continue;
      const blockPos = newPositions.get(block.id) ?? 0;
      for (const cond of logic.conditions) {
        if (cond.source_block_id === movedBlock.id && blockPos < movedNewPos) {
          toast.warning(t('forms.dragDependencyWarning'), {
            description: `"${block.label}" ${t('forms.dragDependsOn')} "${movedBlock.label}" ${t('forms.dragWhichIsNowBelow')}`,
            duration: 5000,
          });
          return; // One warning is enough
        }
      }
    }
  }

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = (active.id as string).replace('section-', '');
    const overId = (over.id as string).replace('section-', '');
    const oldIndex = hook.sections.findIndex(s => s.id === activeId);
    const newIndex = hook.sections.findIndex(s => s.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;
    hook.reorderSection(activeId, newIndex);
  }

  async function handlePublish() {
    setShowPublishConfirm(false);
    await hook.publishForm();
    onPublished?.();
  }

  const selectedBlock = hook.selectedBlockId
    ? hook.blocks.find(b => b.id === hook.selectedBlockId) ?? null
    : null;

  const selectedSection = selectedSectionId
    ? hook.sections.find(s => s.id === selectedSectionId) ?? null
    : null;

  // Compute block dependency map: which blocks reference each block as a condition source
  const blockDependencyMap = React.useMemo(
    () => buildBlockDependencyMap(hook.blocks as Array<{ id: string; conditional_logic?: ConditionalLogic | null }>),
    [hook.blocks]
  );

  // State for controlling which drawer tab to open (used by quick-add logic shortcut)
  const [drawerInitialTab, setDrawerInitialTab] = useState<string | undefined>(undefined);

  // Handler for quick-add logic: select block, open drawer on Logic tab, create default condition if needed
  const handleOpenLogic = useCallback((blockId: string) => {
    const targetBlock = hook.blocks.find(b => b.id === blockId);
    if (targetBlock) {
      const hasLogic = !!(targetBlock.conditional_logic && (targetBlock.conditional_logic as ConditionalLogic).conditions?.length);
      if (!hasLogic) {
        hook.updateBlock(blockId, {
          conditional_logic: {
            action: 'show',
            operator: 'AND',
            conditions: [{ source_block_id: '', operator: 'equals', value: '' }],
          } as ConditionalLogic,
        });
      }
    }
    setDrawerInitialTab('logic');
    hook.setSelectedBlockId(blockId);
  }, [hook]);

  // Reset drawer tab when selection changes normally (clicking a card, not via quick-add)
  const handleSelectBlock = useCallback((blockId: string) => {
    setDrawerInitialTab(undefined);
    setSelectedSectionId(null); // Clear section selection when selecting a block
    hook.setSelectedBlockId(hook.selectedBlockId === blockId ? null : blockId);
  }, [hook]);

  // Handle section header click — open section properties drawer
  const handleSelectSection = useCallback((sectionId: string) => {
    hook.setSelectedBlockId(null); // Clear block selection when selecting a section
    setDrawerInitialTab(undefined);
    setSelectedSectionId(prev => prev === sectionId ? null : sectionId);
  }, [hook]);

  // ── Early returns (AFTER all hooks to satisfy Rules of Hooks) ──────────────
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

          {/* Preview button — opens the live fill page in a new tab */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              if (hook.form?.id) {
                window.open(`${window.location.origin}/fill/${hook.form.id}`, '_blank');
              }
            }}
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

        {/* Form type + Scoring settings row */}
        <div className="flex items-center gap-4 px-4 pb-2 border-b border-border mb-0 flex-wrap">
          {/* Form type picker */}
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {t('forms.builderFormType')}
            </Label>
            <Select
              value={hook.form?.type || 'inspection'}
              onValueChange={(v) => hook.setFormType(v)}
            >
              <SelectTrigger className="h-7 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORM_TYPES.map(ft => (
                  <SelectItem key={ft.value} value={ft.value}>
                    {t(ft.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator orientation="vertical" className="h-4" />

          {/* Scoring toggle */}
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

          <Separator orientation="vertical" className="h-4" />

          {/* Show logic flow toggle */}
          <button
            type="button"
            onClick={() => setShowDependencies(v => !v)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
              showDependencies
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            title={t('forms.builderShowLogicFlow')}
          >
            <Network className="h-3.5 w-3.5" />
            {t('forms.builderShowLogicFlow')}
          </button>
        </div>

        {/* Scope + Tags row */}
        <div className="flex items-center gap-2 flex-wrap px-4 pb-2">
          {/* Scope badge */}
          <button
            type="button"
            onClick={() => setShowScopeModal(true)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500 text-xs font-medium hover:bg-blue-500/25 transition-colors cursor-pointer border border-blue-500/20"
          >
            <Globe className="h-3 w-3" />
            {scopeData ? formatScopeLabel(scopeData) : 'Set scope'}
          </button>

          {/* Content topic tags */}
          {(hook.form?.tags || []).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium"
            >
              <Tag className="h-2.5 w-2.5" />
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

          {/* Add tag dropdown */}
          <Select
            value="__trigger__"
            onValueChange={v => { if (v !== '__trigger__') addTag(v); }}
          >
            <SelectTrigger className="h-6 w-auto gap-1 px-2 py-0 rounded-full border-dashed border-muted-foreground/30 text-muted-foreground text-xs hover:border-primary/40 hover:text-primary bg-transparent shadow-none">
              <Plus className="h-2.5 w-2.5" />
              <span>{t('forms.builderAddTag')}</span>
            </SelectTrigger>
            <SelectContent>
              {contentTopics
                .filter(ct => !(hook.form?.tags || []).includes(ct.name))
                .map(ct => (
                  <SelectItem key={ct.id} value={ct.name}>
                    {ct.name}
                  </SelectItem>
                ))}
              {contentTopics.filter(ct => !(hook.form?.tags || []).includes(ct.name)).length === 0 && (
                <SelectItem value="__none__" disabled>No more topics</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ================================================================
          MAIN AREA
      ================================================================ */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 overflow-y-auto py-8 transition-all relative min-w-0"
        >
          {/* SVG dependency lines overlay */}
          {(showDependencies || selectedBlock) && (
            <DependencyLinesOverlay
              blocks={hook.blocks}
              selectedBlockId={hook.selectedBlockId}
              showAll={showDependencies}
              canvasRef={canvasRef}
              orderIssues={orderIssues}
            />
          )}
          <div
            className="mx-auto w-full px-4 transition-all"
            style={{ maxWidth: (selectedBlock || showDependencies) ? '75%' : (fullPage ? '800px' : '680px') }}
          >
            {/* START node */}
            <div className="flex justify-center mb-0">
              <div className="bg-green-500 text-white text-xs font-semibold tracking-wide uppercase px-6 py-2 rounded-full shadow-md shadow-green-500/25 border border-green-400/30 text-center">
                {t('forms.builderStart')}
              </div>
            </div>

            {/* Start Config Panel */}
            <StartConfigPanel
              config={hook.form?.start_config ?? {}}
              onChange={hook.setStartConfig}
            />

            <ConnectorLine />

            {/* Top-level + only when canvas is empty (cards render their own + after themselves) */}
            {unsectionedBlocks.length === 0 && hook.sections.length === 0 && (
              <AddBlockButton
                sectionId={null}
                onAdd={hook.addBlock}
                formType={hook.form?.type}
              />
            )}

            {/* Empty canvas hint */}
            {hook.blocks.length === 0 && hook.sections.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground/60 pointer-events-none select-none">
                <Plus className="h-8 w-8 mb-2 opacity-30" />
                {hook.form?.type === 'sign-off' && (
                  <p className="text-sm">{t('forms.builderQuickStartSignOff')}</p>
                )}
                {hook.form?.type === 'inspection' && (
                  <p className="text-sm">{t('forms.builderQuickStartInspection')}</p>
                )}
                {hook.form?.type === 'audit' && (
                  <p className="text-sm">{t('forms.builderQuickStartAudit')}</p>
                )}
                {hook.form?.type === 'survey' && (
                  <p className="text-sm">{t('forms.builderQuickStartSurvey')}</p>
                )}
                {hook.form?.type === 'ojt-checklist' && (
                  <p className="text-sm">{t('forms.builderQuickStartOJT')}</p>
                )}
                {!hook.form?.type && (
                  <p className="text-sm">{t('forms.builderEmptyHint')}</p>
                )}
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
                    allBlocks={hook.blocks}
                    isSelected={hook.selectedBlockId === block.id}
                    referencedByCount={blockDependencyMap[block.id]?.length ?? 0}
                    onSelect={() => handleSelectBlock(block.id)}
                    onDelete={() => hook.deleteBlock(block.id)}
                    onAdd={hook.addBlock}
                    onOpenLogic={() => handleOpenLogic(block.id)}
                    formType={hook.form?.type}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* Sectioned blocks — sections are drag-and-drop reorderable */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSectionDragEnd}
            >
              <SortableContext
                items={hook.sections.map(s => `section-${s.id}`)}
                strategy={verticalListSortingStrategy}
              >
            {hook.sections.map(section => (
              <div key={section.id} className="mt-4">
                <SectionHeaderCard
                  sectionId={section.id}
                  title={section.title}
                  description={section.description}
                  hasConditions={!!(section.settings && (section.settings as Record<string, unknown>).conditional_logic && ((section.settings as Record<string, unknown>).conditional_logic as ConditionalLogic)?.conditions?.length)}
                  isSelected={selectedSectionId === section.id}
                  onTitleChange={v => hook.updateSection(section.id, { title: v })}
                  onDescriptionChange={v => hook.updateSection(section.id, { description: v })}
                  onDelete={() => hook.deleteSection(section.id)}
                  onClick={() => handleSelectSection(section.id)}
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
                        allBlocks={hook.blocks}
                        isSelected={hook.selectedBlockId === block.id}
                        referencedByCount={blockDependencyMap[block.id]?.length ?? 0}
                        onSelect={() => handleSelectBlock(block.id)}
                        onDelete={() => hook.deleteBlock(block.id)}
                        onAdd={hook.addBlock}
                        onOpenLogic={() => handleOpenLogic(block.id)}
                        formType={hook.form?.type}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                {/* Only show section-level + when section is empty (cards render their own + after themselves) */}
                {(blocksBySection[section.id] ?? []).length === 0 && (
                  <AddBlockButton sectionId={section.id} onAdd={hook.addBlock} formType={hook.form?.type} />
                )}
              </div>
            ))}
              </SortableContext>
            </DndContext>

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
              {hook.form?.type === 'sign-off' && !hook.blocks.some(b => b.block_type === 'signature') ? (
                <div className="inline-flex items-center justify-center gap-1.5 bg-muted text-muted-foreground text-xs font-semibold tracking-wide uppercase px-6 py-2 rounded-full border border-border shadow-sm">
                  <Pen className="h-3 w-3 shrink-0" />
                  {t('forms.builderEnd')} — {t('forms.builderSignatureRequired')}
                </div>
              ) : (
                <div className="bg-muted text-muted-foreground text-xs font-semibold tracking-wide uppercase px-6 py-2 rounded-full border border-border shadow-sm text-center">
                  {t('forms.builderEnd')}
                </div>
              )}
            </div>

            {/* Type-specific END node hints */}
            {hook.form?.type === 'sign-off' && !hook.blocks.some(b => b.block_type === 'signature') && (
              <div className="flex justify-center mt-2">
                <div className="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 text-xs px-3 py-1.5 rounded-full border border-yellow-200 dark:border-yellow-700/40">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {t('forms.builderSignOffMissingSignature')}
                </div>
              </div>
            )}
            {hook.form?.type === 'audit' && hook.form?.scoring_enabled && hook.blocks.length > 0 && (() => {
              const scoredBlocks = hook.blocks.filter(b => {
                const vr = (b.validation_rules as Record<string, unknown> | undefined) ?? {};
                return !!vr._correct_answer;
              });
              const criticalCount = scoredBlocks.filter(b => !!(b.validation_rules as Record<string, unknown> | undefined)?._critical).length;
              return scoredBlocks.length > 0 ? (
                <div className="flex justify-center mt-2 gap-2">
                  <div className="text-xs text-muted-foreground px-3 py-1 rounded-full bg-muted/60 border border-border">
                    {t('forms.builderAuditScoreHintNew', { scored: scoredBlocks.length, total: hook.blocks.filter(b => SCOREABLE_BLOCK_TYPES.includes(b.block_type)).length })}
                  </div>
                  {criticalCount > 0 && (
                    <div className="text-xs text-red-500 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                      {t('forms.builderCriticalCount', { count: criticalCount })}
                    </div>
                  )}
                </div>
              ) : null;
            })()}
            {hook.form?.type === 'inspection' && hook.blocks.length === 0 && (
              <div className="flex justify-center mt-2">
                <p className="text-xs text-muted-foreground/50 italic">
                  {t('forms.builderInspectionTip')}
                </p>
              </div>
            )}

            {/* Submission Actions Panel */}
            <SubmissionActionsPanel
              config={hook.form?.submission_config ?? {}}
              scoringEnabled={hook.form?.scoring_enabled ?? false}
              identityMode={hook.form?.start_config?.identity_mode ?? 'individual'}
              onChange={hook.setSubmissionConfig}
            />

            {/* Bottom padding */}
            <div className="h-16" />
          </div>
        </div>

        {/* Properties Drawer — fixed right panel (block or section) */}
        {selectedBlock && (
          <PropertiesDrawer
            block={selectedBlock}
            allBlocks={hook.blocks.filter(b => b.id !== selectedBlock.id)}
            sections={hook.sections}
            scoringEnabled={hook.form?.scoring_enabled ?? false}
            onUpdate={updates => hook.updateBlock(selectedBlock.id, updates)}
            onDelete={() => hook.deleteBlock(selectedBlock.id)}
            onClose={() => {
              hook.setSelectedBlockId(null);
              setDrawerInitialTab(undefined);
            }}
            wide={fullPage}
            initialTab={drawerInitialTab}
            dependencyMap={blockDependencyMap}
            orderIssueMessage={orderIssues.get(selectedBlock.id)}
          />
        )}
        {selectedSection && !selectedBlock && (
          <SectionPropertiesDrawer
            section={selectedSection}
            allBlocks={hook.blocks}
            onUpdate={updates => hook.updateSection(selectedSection.id, updates)}
            onDelete={() => { hook.deleteSection(selectedSection.id); setSelectedSectionId(null); }}
            onClose={() => setSelectedSectionId(null)}
            wide={fullPage}
          />
        )}
      </div>

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

      {/* ================================================================
          FORM SCOPE MODAL
      ================================================================ */}
      {hook.form?.id && hook.form.organization_id && (
        <FormScopeModal
          isOpen={showScopeModal}
          onClose={() => setShowScopeModal(false)}
          formId={hook.form.id}
          organizationId={hook.form.organization_id}
          onSaved={(scope) => setScopeData(scope)}
        />
      )}
    </div>
  );
}

export default FormBuilder;
