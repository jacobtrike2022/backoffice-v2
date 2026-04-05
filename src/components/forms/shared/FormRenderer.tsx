import React from 'react';
import { useTranslation } from 'react-i18next';
import SignatureCanvas from 'react-signature-canvas';
import { isBlockVisible, ConditionalLogic, getSkippedSectionIds, isSectionVisible } from '../../../lib/forms/conditionalLogic';
import { calculateFormScore, type ScoringResult as ScoringResultFromEngine, type ScoringMode } from '../../../lib/forms/scoring';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Star, Upload, X as XIcon, FileText, Loader2, AlertCircle, ClipboardCheck, Shield, FileSignature, GraduationCap, MessageSquare, Info, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '../../../lib/supabase';

export interface FormBlockData {
  id: string;
  type: string;
  label?: string;
  description?: string;
  placeholder?: string;
  is_required?: boolean;
  options?: string[] | { choices?: string[] };
  validation_rules?: Record<string, unknown>;
  conditional_logic?: ConditionalLogic | null;
  section_id?: string | null;
  guideline_text?: string;
  guideline_attachments?: Array<{ url: string; type: string; name: string }>;
}

export interface FormSectionData {
  id: string;
  title?: string;
  description?: string;
  display_order: number;
  settings?: Record<string, unknown> | null;
}

// Re-export ScoringResult from the unified scoring engine for backward compat
export type ScoringResult = ScoringResultFromEngine;
export type { SectionScore } from '../../../lib/forms/scoring';

export interface OnFailConfig {
  reassign?: { enabled: boolean; delay_hours: number };
  assign_form?: { enabled: boolean; form_id: string; form_title: string };
  assign_training?: { enabled: boolean; playlist_id: string; playlist_title: string };
  fail_message?: string;
}

export interface SubmissionConfig {
  confirmation_message?: string;
  redirect_url?: string;
  send_email_to_submitter?: boolean;
  allow_multiple_submissions?: boolean;
  email_notifications?: unknown[];
  score_threshold_action?: {
    below_threshold_email?: string;
    below_threshold_message?: string;
  };
  on_fail?: OnFailConfig;
}

/** Start configuration for forms */
export interface StartConfig {
  identity_mode?: 'individual' | 'location' | 'anonymous';
  require_location?: boolean;
  require_shift?: boolean;
  shift_options?: string[];
  submission_limit?: 'unlimited' | 'daily' | 'shift' | 'weekly';
}

/** Store/location option for start config dropdowns */
export interface StoreOption {
  id: string;
  name: string;
  code?: string;
}

/** Linked content info for sign-off forms (e.g. the playlist this form belongs to) */
export interface LinkedContentInfo {
  title: string;
  type: string;
}

/** OJT metadata (trainer/trainee names) managed externally */
export interface OjtMetadata {
  trainerName: string;
  traineeName: string;
}

export interface FormRendererProps {
  blocks: FormBlockData[];
  /** Ordered list of form sections. When provided, section headers are rendered and skip_to_section logic is active. */
  sections?: FormSectionData[];
  answers?: Record<string, unknown>;
  readOnly?: boolean;
  scoringEnabled?: boolean;
  scoringMode?: ScoringMode;
  passThreshold?: number;
  onSubmit?: (data: Record<string, unknown>, scoring?: ScoringResult) => void | Promise<void>;
  /** Required for file/photo upload blocks — used as the storage path prefix */
  formId?: string;
  /** Post-submission configuration (confirmation message, etc.) */
  submissionConfig?: SubmissionConfig;
  /** Form type — drives type-specific UX (header, banners, counters) */
  formType?: 'inspection' | 'audit' | 'sign-off' | 'ojt-checklist' | 'survey' | string;
  /** Form title for the type-aware header */
  formTitle?: string;
  /** Linked content shown as a banner for sign-off forms */
  linkedContent?: LinkedContentInfo;
  /** OJT trainer/trainee metadata */
  ojtMetadata?: OjtMetadata;
  /** Callback when OJT metadata changes */
  onOjtMetadataChange?: (metadata: OjtMetadata) => void;
  /** Start configuration (location/shift requirements) */
  startConfig?: StartConfig;
  /** Available stores for location selector */
  stores?: StoreOption[];
  /** Organization ID — used to scope store/role lookup blocks to the form's org */
  organizationId?: string;
}

/** Type-specific UX configuration */
const FORM_TYPE_UX: Record<string, { icon: React.ElementType; accent: string; accentBg: string; labelKey: string }> = {
  'inspection': { icon: ClipboardCheck, accent: 'text-blue-500', accentBg: 'bg-blue-500/10 border-blue-500/30', labelKey: 'forms.fillHeaderInspection' },
  'audit': { icon: Shield, accent: 'text-amber-500', accentBg: 'bg-amber-500/10 border-amber-500/30', labelKey: 'forms.fillHeaderAudit' },
  'sign-off': { icon: FileSignature, accent: 'text-green-500', accentBg: 'bg-green-500/10 border-green-500/30', labelKey: 'forms.fillHeaderSignOff' },
  'ojt-checklist': { icon: GraduationCap, accent: 'text-purple-500', accentBg: 'bg-purple-500/10 border-purple-500/30', labelKey: 'forms.fillHeaderOJT' },
  'survey': { icon: MessageSquare, accent: 'text-teal-500', accentBg: 'bg-teal-500/10 border-teal-500/30', labelKey: 'forms.fillHeaderSurvey' },
};

// Per-block upload state tracked outside React state to avoid re-render loops
interface UploadState {
  uploading: boolean;
  progress: number;
  error: string | null;
  fileName: string | null;
  previewUrl: string | null;
}

function getOptions(block: FormBlockData): string[] {
  if (Array.isArray(block.options)) return block.options;
  if (block.options && typeof block.options === 'object' && 'choices' in block.options) {
    return (block.options as { choices?: string[] }).choices || [];
  }
  return [];
}

const EMPTY_ANSWERS: Record<string, unknown> = {};
const EMPTY_SECTIONS: FormSectionData[] = [];
const EMPTY_STORES: StoreOption[] = [];
const DEFAULT_SHIFT_OPTIONS = ['Opening', 'Mid-day', 'Closing', 'Overnight'];

// ─── Reference Lookup Block Components ───────────────────────────────────────

function StoreLookupBlock({ block, value, onChange, readOnly, t, organizationId }: {
  block: FormBlockData; value: unknown; onChange: (id: string, val: unknown) => void; readOnly: boolean; t: (k: string) => string; organizationId?: string;
}) {
  const [options, setOptions] = React.useState<{ id: string; name: string; code?: string }[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      let query = supabase.from('stores').select('id, name, code').order('name');
      if (organizationId) query = query.eq('organization_id', organizationId);
      const { data } = await query;
      if (!cancelled && data) setOptions(data);
    })();
    return () => { cancelled = true; };
  }, [organizationId]);
  return (
    <div className="space-y-2">
      <Label>
        {block.label || t('forms.storeLookup')}
        {block.is_required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {block.description && <p className="text-xs text-muted-foreground">{block.description}</p>}
      <Select
        value={(value as string) || 'none'}
        onValueChange={(v) => {
          const selected = options.find(o => o.id === v);
          onChange(block.id, v === 'none' ? '' : v);
          if (selected) onChange(`${block.id}__label`, selected.code ? `${selected.name} (${selected.code})` : selected.name);
        }}
        disabled={readOnly}
      >
        <SelectTrigger>
          <SelectValue placeholder={t('forms.storeLookupPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t('forms.storeLookupPlaceholder')}</SelectItem>
          {options.map(s => (
            <SelectItem key={s.id} value={s.id}>
              {s.code ? `${s.name} (${s.code})` : s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function RoleLookupBlock({ block, value, onChange, readOnly, t, organizationId }: {
  block: FormBlockData; value: unknown; onChange: (id: string, val: unknown) => void; readOnly: boolean; t: (k: string) => string; organizationId?: string;
}) {
  const [options, setOptions] = React.useState<{ id: string; name: string }[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      let query = supabase.from('roles').select('id, name').order('name');
      if (organizationId) query = query.eq('organization_id', organizationId);
      const { data } = await query;
      if (!cancelled && data) setOptions(data);
    })();
    return () => { cancelled = true; };
  }, [organizationId]);
  return (
    <div className="space-y-2">
      <Label>
        {block.label || t('forms.roleLookup')}
        {block.is_required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {block.description && <p className="text-xs text-muted-foreground">{block.description}</p>}
      <Select
        value={(value as string) || 'none'}
        onValueChange={(v) => {
          const selected = options.find(o => o.id === v);
          onChange(block.id, v === 'none' ? '' : v);
          if (selected) onChange(`${block.id}__label`, selected.name);
        }}
        disabled={readOnly}
      >
        <SelectTrigger>
          <SelectValue placeholder={t('forms.roleLookupPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t('forms.roleLookupPlaceholder')}</SelectItem>
          {options.map(r => (
            <SelectItem key={r.id} value={r.id}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PersonLookupBlock({ block, value, onChange, readOnly, t, organizationId }: {
  block: FormBlockData; value: unknown; onChange: (id: string, val: unknown) => void; readOnly: boolean; t: (k: string) => string; organizationId?: string;
}) {
  const [options, setOptions] = React.useState<{ id: string; first_name: string; last_name: string; email?: string }[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      let query = supabase.from('users').select('id, first_name, last_name, email').eq('status', 'active').order('last_name');
      if (organizationId) query = query.eq('organization_id', organizationId);
      const { data } = await query;
      if (!cancelled && data) setOptions(data as any[]);
    })();
    return () => { cancelled = true; };
  }, [organizationId]);
  return (
    <div className="space-y-2">
      <Label>
        {block.label || t('forms.personLookup')}
        {block.is_required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {block.description && <p className="text-xs text-muted-foreground">{block.description}</p>}
      <Select
        value={(value as string) || 'none'}
        onValueChange={(v) => {
          const selected = options.find(o => o.id === v);
          onChange(block.id, v === 'none' ? '' : v);
          if (selected) {
            const displayName = [selected.first_name, selected.last_name].filter(Boolean).join(' ');
            onChange(`${block.id}__label`, displayName);
          }
        }}
        disabled={readOnly}
      >
        <SelectTrigger>
          <SelectValue placeholder={t('forms.personLookupPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t('forms.personLookupPlaceholder')}</SelectItem>
          {options.map(p => {
            const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
            return (
              <SelectItem key={p.id} value={p.id}>
                {name}{p.email ? ` (${p.email})` : ''}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

export function FormRenderer({ blocks: rawBlocks, sections = EMPTY_SECTIONS, answers = EMPTY_ANSWERS, readOnly = false, scoringEnabled, scoringMode, passThreshold = 70, onSubmit, formId, submissionConfig, formType, formTitle, linkedContent, ojtMetadata, onOjtMetadataChange, startConfig, stores = EMPTY_STORES, organizationId }: FormRendererProps) {
  const { t } = useTranslation();

  // Auto-inject identity block based on submission mode (individual → person, location → store)
  // Default is 'individual' when no start_config is set
  const blocks = React.useMemo(() => {
    const identityMode = startConfig?.identity_mode || 'individual';
    if (identityMode === 'anonymous') return rawBlocks;

    const IDENTITY_BLOCK_ID = '_identity_submitted_by';
    // Don't inject if already present (e.g. re-render)
    if (rawBlocks.some(b => b.id === IDENTITY_BLOCK_ID)) return rawBlocks;

    if (identityMode === 'individual') {
      const identityBlock: FormBlockData = {
        id: IDENTITY_BLOCK_ID,
        type: 'person_lookup',
        label: 'Submitted by',
        is_required: true,
      };
      return [identityBlock, ...rawBlocks];
    }

    if (identityMode === 'location') {
      const identityBlock: FormBlockData = {
        id: IDENTITY_BLOCK_ID,
        type: 'store_lookup',
        label: 'Submitted by',
        is_required: true,
      };
      return [identityBlock, ...rawBlocks];
    }

    return rawBlocks;
  }, [rawBlocks, startConfig?.identity_mode]);

  const [formData, setFormData] = React.useState<Record<string, unknown>>(answers);
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [lastScoringResult, setLastScoringResult] = React.useState<ScoringResult | null>(null);
  const [uploadStates, setUploadStates] = React.useState<Record<string, UploadState>>({});
  const [isSectionPillListExpanded, setIsSectionPillListExpanded] = React.useState(false);
  const [isSectionPillListOverflowing, setIsSectionPillListOverflowing] = React.useState(false);
  const [collapsedSectionIds, setCollapsedSectionIds] = React.useState<string[]>([]);
  const sigCanvasRefs = React.useRef<Record<string, SignatureCanvas | null>>({});
  const prevSkippedRef = React.useRef<Set<string>>(new Set());
  const sectionPillButtonRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  // Compute which sections are skipped due to active skip_to_section rules
  const skippedSectionIds = React.useMemo(
    () => getSkippedSectionIds(blocks, sections, formData),
    [blocks, sections, formData]
  );

  // Compute which sections are hidden due to section-level conditional logic
  const conditionallyHiddenSectionIds = React.useMemo(() => {
    const hidden = new Set<string>();
    for (const section of sections) {
      if (!isSectionVisible(section.settings, formData)) {
        hidden.add(section.id);
      }
    }
    return hidden;
  }, [sections, formData]);

  // Combined set: sections hidden by skip_to_section OR section-level conditions
  const allHiddenSectionIds = React.useMemo(() => {
    const combined = new Set(skippedSectionIds);
    for (const id of conditionallyHiddenSectionIds) combined.add(id);
    return combined;
  }, [skippedSectionIds, conditionallyHiddenSectionIds]);
  const visibleSections = React.useMemo(
    () => sections.filter(s => !allHiddenSectionIds.has(s.id)),
    [sections, allHiddenSectionIds]
  );

  // Build a map of section_id → section data for quick lookups
  const sectionMap = React.useMemo(() => {
    const map = new Map<string, FormSectionData>();
    for (const s of sections) map.set(s.id, s);
    return map;
  }, [sections]);

  // Smooth scroll to target section when a new skip activates
  React.useEffect(() => {
    if (sections.length === 0) return;

    // Find the skip targets that just became active (newly skipped sections appeared)
    const prevSkipped = prevSkippedRef.current;
    const newlySkipped = new Set<string>();
    for (const id of skippedSectionIds) {
      if (!prevSkipped.has(id)) newlySkipped.add(id);
    }
    prevSkippedRef.current = skippedSectionIds;

    if (newlySkipped.size === 0) return;

    // Find the active skip_to_section rules to determine scroll target
    for (const block of blocks) {
      const logic = block.conditional_logic;
      if (!logic || logic.action !== 'skip_to_section' || !logic.target_section_id) continue;
      const targetId = logic.target_section_id;
      // Check if this skip's intermediate sections are the newly skipped ones
      const el = document.getElementById(`form-section-${targetId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
    }
  }, [skippedSectionIds, sections, blocks]);

  /** Upload a file to Supabase Storage and store its public URL in formData */
  const uploadFile = async (blockId: string, file: File) => {
    if (!formId) {
      // No formId available (e.g. builder preview) — fall back to filename-only
      handleChange(blockId, file.name);
      return;
    }

    // Sanitize the filename: remove special chars, keep extension
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const storagePath = `${formId}/${blockId}/${timestamp}_${safeName}`;

    setUploadStates(prev => ({
      ...prev,
      [blockId]: { uploading: true, progress: 0, error: null, fileName: file.name, previewUrl: null },
    }));

    try {
      // Simulate progress since Supabase JS v2 upload doesn't provide progress callbacks
      const progressInterval = setInterval(() => {
        setUploadStates(prev => {
          const current = prev[blockId];
          if (!current || !current.uploading) return prev;
          const nextProgress = Math.min(current.progress + 15, 90);
          return { ...prev, [blockId]: { ...current, progress: nextProgress } };
        });
      }, 200);

      const { data, error } = await supabase.storage
        .from('form-uploads')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      clearInterval(progressInterval);

      if (error) {
        setUploadStates(prev => ({
          ...prev,
          [blockId]: { uploading: false, progress: 0, error: error.message, fileName: file.name, previewUrl: null },
        }));
        return;
      }

      // Get the public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('form-uploads')
        .getPublicUrl(data.path);

      const publicUrl = urlData.publicUrl;

      // Build a preview URL for images
      const isImage = file.type.startsWith('image/');
      const previewUrl = isImage ? publicUrl : null;

      setUploadStates(prev => ({
        ...prev,
        [blockId]: { uploading: false, progress: 100, error: null, fileName: file.name, previewUrl },
      }));

      // Store the public URL as the answer value
      handleChange(blockId, publicUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setUploadStates(prev => ({
        ...prev,
        [blockId]: { uploading: false, progress: 0, error: message, fileName: file.name, previewUrl: null },
      }));
    }
  };

  // NOTE: answers prop is only used as initial state (line 107).
  // Do NOT sync answers→formData via useEffect — it causes infinite loops
  // when callers pass `answers={}` (new object reference each render).

  // Reset collapsed state when section visibility changes.
  React.useEffect(() => {
    setIsSectionPillListExpanded(false);
  }, [sections, allHiddenSectionIds]);

  // Collapse section pills to exactly two full rows (no clipped third row).
  React.useEffect(() => {
    if (isSectionPillListExpanded) return;
    if (visibleSections.length === 0) {
      setCollapsedSectionIds([]);
      setIsSectionPillListOverflowing(false);
      return;
    }

    const measureRows = () => {
      const rendered = visibleSections
        .map(s => ({ id: s.id, el: sectionPillButtonRefs.current[s.id] }))
        .filter((item): item is { id: string; el: HTMLButtonElement } => Boolean(item.el));

      if (rendered.length === 0) {
        setCollapsedSectionIds([]);
        setIsSectionPillListOverflowing(false);
        return;
      }

      const rowTops: number[] = [];
      for (const item of rendered) {
        const top = item.el.offsetTop;
        if (!rowTops.some(t => Math.abs(t - top) <= 1)) rowTops.push(top);
      }
      rowTops.sort((a, b) => a - b);

      if (rowTops.length <= 2) {
        setCollapsedSectionIds(rendered.map(item => item.id));
        setIsSectionPillListOverflowing(false);
        return;
      }

      const secondRowTop = rowTops[1];
      const allowedIds = rendered
        .filter(item => item.el.offsetTop <= secondRowTop + 1)
        .map(item => item.id);

      setCollapsedSectionIds(allowedIds);
      setIsSectionPillListOverflowing(true);
    };

    const frame = window.requestAnimationFrame(measureRows);
    window.addEventListener('resize', measureRows);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', measureRows);
    };
  }, [visibleSections, isSectionPillListExpanded]);

  const handleChange = (blockId: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [blockId]: value }));
    // Clear validation error for this field when user fills it
    if (validationErrors[blockId]) {
      setValidationErrors(prev => { const next = { ...prev }; delete next[blockId]; return next; });
    }
  };

  const handleSubmit = async () => {
    // Validate required fields that are currently visible
    const errors: Record<string, string> = {};

    // Validate start config fields
    if (startConfig) {
      if (startConfig.identity_mode === 'location' && !formData._location_id) {
        errors._location_id = t('forms.fieldRequired');
      }
    }

    const INPUT_BLOCK_TYPES = new Set([
      'text', 'textarea', 'number', 'date', 'time', 'radio', 'checkbox', 'checkboxes',
      'select', 'dropdown', 'multiselect', 'rating', 'file', 'yes_no', 'slider',
      'photo', 'signature', 'location',
    ]);
    for (const block of blocks) {
      if (!block.is_required) continue;
      if (!INPUT_BLOCK_TYPES.has(block.type)) continue;
      if (!isBlockVisible(block.conditional_logic, formData)) continue;
      // Skip validation for blocks in hidden sections (skip_to_section or section conditions)
      if (block.section_id && allHiddenSectionIds.has(block.section_id)) continue;
      const val = formData[block.id];
      const isEmpty =
        val === undefined ||
        val === null ||
        val === '' ||
        (Array.isArray(val) && val.length === 0);
      if (isEmpty) {
        errors[block.id] = t('forms.fieldRequired');
      }
    }
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      // Scroll to the first invalid field
      const firstErrorId = Object.keys(errors)[0];
      const el = document.getElementById(`form-field-${firstErrorId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setValidationErrors({});
    setIsSubmitting(true);
    try {
      // Compute scoring if enabled — delegates to the unified scoring engine
      let scoring: ScoringResult | undefined;
      if (scoringEnabled) {
        const hiddenBlockIds = new Set<string>();
        for (const block of blocks) {
          if (!isBlockVisible(block.conditional_logic, formData)) hiddenBlockIds.add(block.id);
          if (block.section_id && allHiddenSectionIds.has(block.section_id)) hiddenBlockIds.add(block.id);
        }

        scoring = calculateFormScore(
          blocks.map(b => ({
            id: b.id,
            section_id: b.section_id,
            type: b.type,
            label: b.label,
            options: getOptions(b),
            validation_rules: b.validation_rules as Record<string, unknown> | null,
          })),
          formData,
          {
            scoring_mode: scoringMode || 'pass_fail',
            pass_threshold: passThreshold,
            sections: sections.map(s => ({ id: s.id, title: s.title, settings: s.settings })),
          },
          hiddenBlockIds,
        );
      }

      await onSubmit?.(formData, scoring);
      if (scoring) setLastScoringResult(scoring);
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Guideline drawer state — inline within the form, not a portal
  const [openGuidelineBlock, setOpenGuidelineBlock] = React.useState<FormBlockData | null>(null);

  const BlockLabel = ({ block }: { block: FormBlockData }) => (
    <Label className="flex items-center gap-1.5">
      <span>
        {block.label}
        {block.is_required && <span className="text-destructive ml-1">*</span>}
      </span>
      {block.guideline_text && (
        <button
          type="button"
          onClick={() => setOpenGuidelineBlock(block)}
          className="inline-flex items-center justify-center h-5 w-5 rounded-full hover:bg-muted transition-colors shrink-0"
          aria-label="View guidelines"
        >
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </Label>
  );

  // Inline guideline drawer — rendered at the bottom of the form container
  const GuidelineDrawer = () => {
    const block = openGuidelineBlock;
    if (!block) return null;

    const images = (block.guideline_attachments || []).filter(a => a.type === 'image');
    const videos = (block.guideline_attachments || []).filter(a => a.type === 'video');
    const files = (block.guideline_attachments || []).filter(a => a.type !== 'image' && a.type !== 'video');
    const hasAttachments = images.length > 0 || videos.length > 0 || files.length > 0;

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/60 z-40 animate-in fade-in duration-200 backdrop-blur-[2px]"
          onClick={() => setOpenGuidelineBlock(null)}
        />
        {/* Drawer — anchored to the form container width */}
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4 animate-in slide-in-from-bottom duration-300">
          <div
            className="relative isolate w-full max-w-2xl bg-background border border-border border-b-0 rounded-t-[1.5rem] shadow-2xl flex flex-col overflow-hidden"
            style={{
              maxHeight: '65vh',
              // Force child/background clipping so top corners always render rounded.
              clipPath: 'inset(0 0 0 0 round 1.5rem 1.5rem 0 0)',
            }}
          >
            {/* Drag handle — tappable to close */}
            <button
              type="button"
              onClick={() => setOpenGuidelineBlock(null)}
              className="flex justify-center pt-3 pb-2 cursor-pointer hover:opacity-70 transition-opacity"
              aria-label="Close guidelines"
            >
              <div className="w-12 h-1.5 rounded-full bg-muted-foreground/40" />
            </button>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 border-b border-border shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                  Guideline
                </div>
                {block.label && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{block.label}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpenGuidelineBlock(null)}
                className="h-8 w-8 flex items-center justify-center rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-3"
                aria-label="Close"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4 overscroll-contain">
              <div className={hasAttachments ? '' : 'rounded-2xl border border-border/70 bg-muted/20 px-4 py-3.5 shadow-sm'}>
                <p
                  className={`whitespace-pre-wrap ${
                    hasAttachments ? 'text-sm leading-relaxed' : 'text-[15px] leading-7 text-foreground/95'
                  }`}
                >
                  {block.guideline_text}
                </p>
              </div>

              {hasAttachments && (
                <div className="space-y-3 pt-3 border-t border-border">
                  {images.length > 0 && (
                    <div className={images.length === 1 ? '' : 'grid grid-cols-2 gap-2'}>
                      {images.map((att, i) => (
                        <div key={`img-${i}`} className="space-y-1.5">
                          <img
                            src={att.url}
                            alt={att.name || 'Reference photo'}
                            className="w-full rounded-xl border border-border bg-muted/20"
                            style={{ maxHeight: '35vh', objectFit: 'contain' }}
                          />
                          {att.name && (
                            <p className="text-[11px] text-muted-foreground truncate px-0.5">{att.name}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {videos.map((att, i) => (
                    <div key={`vid-${i}`} className="space-y-1.5">
                      <video
                        src={att.url}
                        controls
                        className="w-full rounded-xl border border-border"
                        style={{ maxHeight: '35vh' }}
                        preload="metadata"
                      />
                      {att.name && (
                        <p className="text-[11px] text-muted-foreground truncate px-0.5">{att.name}</p>
                      )}
                    </div>
                  ))}

                  {files.map((att, i) => (
                    <a
                      key={`file-${i}`}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{att.name || 'Attachment'}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderBlock = (block: FormBlockData) => {
    // Evaluate conditional logic — skip blocks that should be hidden
    if (!isBlockVisible(block.conditional_logic, formData)) {
      return null;
    }

    // Skip blocks whose section is hidden (skip_to_section or section conditions)
    if (block.section_id && allHiddenSectionIds.has(block.section_id)) {
      return null;
    }

    const value = formData[block.id];
    const options = getOptions(block);

    if (block.type === 'section' || block.type === 'html') {
      return (
        <div key={block.id} className="space-y-2">
          {block.label && (
            <h3 className="text-base font-semibold">{block.label}</h3>
          )}
          {block.description && (
            <p className="text-sm text-muted-foreground">{block.description}</p>
          )}
          {block.type === 'section' && <Separator className="my-4" />}
        </div>
      );
    }

    if (readOnly && !['yes_no', 'slider', 'instruction', 'divider', 'location', 'photo', 'signature'].includes(block.type)) {
      const displayValue = value === undefined || value === null
        ? '—'
        : Array.isArray(value)
          ? (value as unknown[]).join(', ')
          : String(value);
      return (
        <div key={block.id} className="space-y-2">
          <Label className="text-sm font-medium">{block.label}</Label>
          <div className="text-sm text-muted-foreground">{displayValue}</div>
        </div>
      );
    }

    switch (block.type) {
      case 'text':
        return (
          <div key={block.id} className="space-y-2">
            <BlockLabel block={block} />
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <Input
              value={(value as string) || ''}
              onChange={(e) => handleChange(block.id, e.target.value)}
              placeholder={block.placeholder}
              disabled={readOnly}
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={block.id} className="space-y-2">
            <BlockLabel block={block} />
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <Textarea
              value={(value as string) || ''}
              onChange={(e) => handleChange(block.id, e.target.value)}
              placeholder={block.placeholder}
              rows={4}
              disabled={readOnly}
            />
          </div>
        );

      case 'number':
        return (
          <div key={block.id} className="space-y-2">
            <BlockLabel block={block} />
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <Input
              type="number"
              value={(value as number) ?? ''}
              onChange={(e) => handleChange(block.id, e.target.value ? Number(e.target.value) : null)}
              placeholder={block.placeholder}
              min={(block.validation_rules?.min as number) ?? undefined}
              max={(block.validation_rules?.max as number) ?? undefined}
              disabled={readOnly}
            />
          </div>
        );

      case 'date': {
        const defaultCurrent = (block.validation_rules as Record<string, unknown> | undefined)?._default_to_current;
        const dateVal = (value as string) || '';
        // Auto-fill current date if default_to_current is set and no value yet
        if (defaultCurrent && !dateVal && !readOnly) {
          const today = new Date().toISOString().split('T')[0];
          setTimeout(() => handleChange(block.id, today), 0);
        }
        return (
          <div key={block.id} className="space-y-2">
            <BlockLabel block={block} />
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <div className="flex gap-2">
              <Input
                type="date"
                value={dateVal}
                onChange={(e) => handleChange(block.id, e.target.value)}
                disabled={readOnly}
                className="flex-1"
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleChange(block.id, new Date().toISOString().split('T')[0])}
                  className="text-[11px] text-primary hover:underline shrink-0 px-2"
                >
                  {t('forms.useCurrent')}
                </button>
              )}
            </div>
          </div>
        );
      }

      case 'time': {
        const defaultCurrentTime = (block.validation_rules as Record<string, unknown> | undefined)?._default_to_current;
        const timeVal = (value as string) || '';
        if (defaultCurrentTime && !timeVal && !readOnly) {
          const now = new Date();
          const hh = String(now.getHours()).padStart(2, '0');
          const mm = String(now.getMinutes()).padStart(2, '0');
          setTimeout(() => handleChange(block.id, `${hh}:${mm}`), 0);
        }
        return (
          <div key={block.id} className="space-y-2">
            <BlockLabel block={block} />
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <div className="flex gap-2">
              <Input
                type="time"
                value={timeVal}
                onChange={(e) => handleChange(block.id, e.target.value)}
                disabled={readOnly}
                className="flex-1"
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    handleChange(block.id, `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                  }}
                  className="text-[11px] text-primary hover:underline shrink-0 px-2"
                >
                  {t('forms.useCurrent')}
                </button>
              )}
            </div>
          </div>
        );
      }

      case 'radio':
        return (
          <div key={block.id} className="space-y-2">
            <BlockLabel block={block} />
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <div className="space-y-2">
              {(options.length ? options : ['Option 1', 'Option 2']).map((opt, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id={`${block.id}-${i}`}
                    name={block.id}
                    value={opt}
                    checked={value === opt}
                    onChange={() => handleChange(block.id, opt)}
                    disabled={readOnly}
                    className="h-4 w-4"
                  />
                  <Label htmlFor={`${block.id}-${i}`} className="font-normal cursor-pointer">
                    {opt}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 'checkbox':
      case 'checkboxes':
        return (
          <div key={block.id} className="space-y-2">
            <BlockLabel block={block} />
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <div className="space-y-2">
              {(options.length ? options : ['Option 1', 'Option 2']).map((opt, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${block.id}-${i}`}
                    checked={Array.isArray(value) ? (value as unknown[]).includes(opt) : value === opt}
                    onCheckedChange={(checked) => {
                      const arr = Array.isArray(value) ? [...(value as unknown[])] : [];
                      if (checked) {
                        arr.push(opt);
                      } else {
                        arr.splice(arr.indexOf(opt), 1);
                      }
                      handleChange(block.id, arr);
                    }}
                    disabled={readOnly}
                  />
                  <Label htmlFor={`${block.id}-${i}`} className="font-normal cursor-pointer">
                    {opt}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 'select':
      case 'dropdown':
        return (
          <div key={block.id} className="space-y-2">
            <BlockLabel block={block} />
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <Select
              value={(value as string) || 'none'}
              onValueChange={(v) => handleChange(block.id, v === 'none' ? '' : v)}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder={block.placeholder || t('forms.selectOption')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('forms.selectOption')}</SelectItem>
                {(options.length ? options : ['Option 1', 'Option 2', 'Option 3']).map((opt, i) => (
                  <SelectItem key={i} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'multiselect':
        return (
          <div key={block.id} className="space-y-2">
            <BlockLabel block={block} />
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <div className="space-y-2">
              {(options.length ? options : ['Option 1', 'Option 2', 'Option 3']).map((opt, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${block.id}-${i}`}
                    checked={Array.isArray(value) ? value.includes(opt) : false}
                    onCheckedChange={(checked) => {
                      const arr = Array.isArray(value) ? [...value] : [];
                      if (checked) {
                        arr.push(opt);
                      } else {
                        arr.splice(arr.indexOf(opt), 1);
                      }
                      handleChange(block.id, arr);
                    }}
                    disabled={readOnly}
                  />
                  <Label htmlFor={`${block.id}-${i}`} className="font-normal cursor-pointer">
                    {opt}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 'rating':
        const maxRating = (block.validation_rules?.max as number) || 5;
        return (
          <div key={block.id} className="space-y-2">
            <BlockLabel block={block} />
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <div className="flex gap-1">
              {Array.from({ length: maxRating }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => !readOnly && handleChange(block.id, i + 1)}
                  disabled={readOnly}
                  className="p-1 rounded hover:bg-muted/50 transition-colors"
                >
                  <Star
                    className={`h-8 w-8 ${
                      (value as number) !== undefined && (value as number) >= i + 1
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-muted-foreground'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        );

      case 'file': {
        const fileUpState = uploadStates[block.id];
        return (
          <div key={block.id} className="space-y-2">
            <BlockLabel block={block} />
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            {readOnly && value ? (
              <p className="text-sm text-muted-foreground">
                {typeof value === 'string' && value.startsWith('http') ? (
                  <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary underline flex items-center gap-1">
                    <FileText className="w-4 h-4" /> {t('forms.viewAttachment')}
                  </a>
                ) : (
                  String(value)
                )}
              </p>
            ) : fileUpState?.uploading ? (
              <div className="flex items-center gap-3 p-3 border border-border rounded-md bg-muted/30">
                <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{fileUpState.fileName}</p>
                  <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-200"
                      style={{ width: `${fileUpState.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : fileUpState?.error ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 border border-destructive/50 rounded-md bg-destructive/10 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t('forms.uploadFailed', { error: fileUpState.error })}</span>
                </div>
                <Input
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(block.id, f);
                  }}
                  disabled={readOnly}
                />
              </div>
            ) : value && typeof value === 'string' && value.startsWith('http') ? (
              <div className="flex items-center gap-2 p-3 border border-border rounded-md bg-muted/30">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm truncate flex-1">{fileUpState?.fileName || 'File uploaded'}</span>
                <button
                  type="button"
                  onClick={() => {
                    handleChange(block.id, '');
                    setUploadStates(prev => { const next = { ...prev }; delete next[block.id]; return next; });
                  }}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <label className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t('forms.clickToUploadFile')}</span>
                  <input
                    type="file"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadFile(block.id, f);
                    }}
                    disabled={readOnly}
                  />
                </label>
              </div>
            )}
          </div>
        );
      }

      case 'yes_no': {
        const yesLabel = (block.validation_rules?.yes_label as string) || 'Yes';
        const noLabel = (block.validation_rules?.no_label as string) || 'No';
        const allowNa = !!(block.validation_rules as Record<string, unknown> | undefined)?._allow_na;
        return (
          <div key={block.id} className="space-y-2">
            <BlockLabel block={block} />
            {block.description && <p className="text-xs text-muted-foreground">{block.description}</p>}
            {readOnly ? (
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                value === 'yes' ? 'bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-400' :
                value === 'no' ? 'bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-400' :
                value === 'n/a' ? 'bg-gray-500/10 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400' :
                'text-muted-foreground'
              }`}>{value === 'yes' ? yesLabel : value === 'no' ? noLabel : value === 'n/a' ? 'N/A' : '—'}</div>
            ) : (
              <div className="flex gap-3 items-center">
                <button type="button" onClick={() => handleChange(block.id, 'yes')}
                  className={`flex-1 py-3 rounded-lg border-2 font-medium text-sm transition-colors outline-none focus:outline-none ${
                    value === 'yes' ? 'border-green-500 bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'border-border hover:border-green-500/50'
                  }`}>{yesLabel}</button>
                <button type="button" onClick={() => handleChange(block.id, 'no')}
                  className={`flex-1 py-3 rounded-lg border-2 font-medium text-sm transition-colors outline-none focus:outline-none ${
                    value === 'no' ? 'border-red-500 bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-400' : 'border-border hover:border-red-500/50'
                  }`}>{noLabel}</button>
                {allowNa && (
                  <button type="button" onClick={() => handleChange(block.id, 'n/a')}
                    className={`px-4 py-3 rounded-lg border-2 font-medium text-sm transition-colors outline-none focus:outline-none shrink-0 ${
                      value === 'n/a' ? 'border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300' : 'border-border hover:border-gray-400/50 dark:hover:border-gray-500/50'
                    }`}>N/A</button>
                )}
              </div>
            )}
          </div>
        );
      }

      case 'slider': {
        const min = (block.validation_rules?.min as number) ?? 0;
        const max = (block.validation_rules?.max as number) ?? 10;
        const step = (block.validation_rules?.step as number) ?? 1;
        const currentVal = (value as number) ?? min;
        return (
          <div key={block.id} className="space-y-2">
            <Label>{block.label}{block.is_required && <span className="text-red-500 ml-1">*</span>}</Label>
            {block.description && <p className="text-xs text-muted-foreground">{block.description}</p>}
            {readOnly ? (
              <div className="text-sm font-medium">{value !== undefined && value !== null ? String(value) : '—'}</div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{min}</span>
                  <span className="text-lg font-bold text-primary tabular-nums">{currentVal}</span>
                  <span className="text-xs text-muted-foreground">{max}</span>
                </div>
                <input type="range" min={min} max={max} step={step}
                  value={currentVal} onChange={(e) => handleChange(block.id, Number(e.target.value))}
                  className="w-full accent-primary" />
              </div>
            )}
          </div>
        );
      }

      case 'photo': {
        const photoUpState = uploadStates[block.id];
        return (
          <div key={block.id} className="space-y-2">
            <Label>{block.label}{block.is_required && <span className="text-red-500 ml-1">*</span>}</Label>
            {block.description && <p className="text-xs text-muted-foreground">{block.description}</p>}
            {readOnly ? (
              value && typeof value === 'string' ? (
                value.startsWith('http') ? <img src={value} alt={block.label} className="max-w-xs rounded-md" /> :
                <p className="text-sm text-muted-foreground">{String(value)}</p>
              ) : <p className="text-sm text-muted-foreground">--</p>
            ) : photoUpState?.uploading ? (
              <div className="flex items-center gap-3 p-3 border border-border rounded-md bg-muted/30">
                <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{photoUpState.fileName}</p>
                  <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-200"
                      style={{ width: `${photoUpState.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : photoUpState?.error ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 border border-destructive/50 rounded-md bg-destructive/10 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t('forms.uploadFailed', { error: photoUpState.error })}</span>
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(block.id, f); }}
                  disabled={readOnly}
                />
              </div>
            ) : value && typeof value === 'string' && value.startsWith('http') ? (
              <div className="space-y-2">
                <div className="relative inline-block">
                  <img
                    src={photoUpState?.previewUrl || (value as string)}
                    alt={block.label || 'Uploaded photo'}
                    className="max-w-xs max-h-48 rounded-md border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      handleChange(block.id, '');
                      setUploadStates(prev => { const next = { ...prev }; delete next[block.id]; return next; });
                    }}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 hover:bg-destructive/80 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{photoUpState?.fileName || 'Photo uploaded'}</p>
              </div>
            ) : (
              <div className="relative">
                <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t('forms.clickToTakePhoto')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(block.id, f); }}
                    disabled={readOnly}
                  />
                </label>
              </div>
            )}
          </div>
        );
      }

      case 'signature':
        return (
          <div key={block.id} className="space-y-2">
            <Label>{block.label}{block.is_required && <span className="text-red-500 ml-1">*</span>}</Label>
            {block.description && <p className="text-xs text-muted-foreground">{block.description}</p>}
            {readOnly ? (
              <div className="border border-border rounded-md bg-muted/30 p-2 flex items-center justify-center" style={{ minHeight: 120 }}>
                {value ? (
                  <img
                    src={value as string}
                    alt="Signature"
                    className="max-h-[160px] max-w-full object-contain"
                  />
                ) : (
                  <span className="text-sm italic text-muted-foreground">{t('forms.noSignature')}</span>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  className="border border-border rounded-md overflow-hidden bg-gray-50 dark:bg-gray-900"
                  style={{ width: '100%', maxWidth: 500 }}
                >
                  <SignatureCanvas
                    ref={(ref) => { sigCanvasRefs.current[block.id] = ref; }}
                    penColor="black"
                    canvasProps={{
                      width: 500,
                      height: 200,
                      className: 'w-full',
                      style: { width: '100%', height: 200, touchAction: 'none' },
                    }}
                    onEnd={() => {
                      const canvas = sigCanvasRefs.current[block.id];
                      if (canvas && !canvas.isEmpty()) {
                        const dataUrl = canvas.getTrimmedCanvas().toDataURL('image/png');
                        handleChange(block.id, dataUrl);
                      }
                    }}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const canvas = sigCanvasRefs.current[block.id];
                      if (canvas) {
                        canvas.clear();
                        handleChange(block.id, '');
                      }
                    }}
                    className="text-xs px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted transition-colors"
                  >
                    {t('forms.clearSignature')}
                  </button>
                  {value && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                      {t('forms.signatureCaptured')} &#10003;
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t('forms.drawSignatureHint')}</p>
              </div>
            )}
          </div>
        );

      case 'location':
        return (
          <div key={block.id} className="space-y-2">
            <Label>{block.label}{block.is_required && <span className="text-red-500 ml-1">*</span>}</Label>
            {block.description && <p className="text-xs text-muted-foreground">{block.description}</p>}
            {readOnly ? (
              <p className="text-sm text-muted-foreground">{value ? String(value) : '—'}</p>
            ) : (
              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (pos) => handleChange(block.id, `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`),
                        () => handleChange(block.id, 'Location unavailable')
                      );
                    }
                  }}
                  className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted/50 transition-colors">
                  📍 {t('forms.captureLocation')}
                </button>
                {value && <span className="text-xs text-muted-foreground">{String(value)}</span>}
              </div>
            )}
          </div>
        );

      case 'store_lookup':
        return <StoreLookupBlock key={block.id} block={block} value={value} onChange={handleChange} readOnly={readOnly} t={t} organizationId={organizationId} />;

      case 'role_lookup':
        return <RoleLookupBlock key={block.id} block={block} value={value} onChange={handleChange} readOnly={readOnly} t={t} organizationId={organizationId} />;

      case 'person_lookup':
        return <PersonLookupBlock key={block.id} block={block} value={value} onChange={handleChange} readOnly={readOnly} t={t} organizationId={organizationId} />;

      case 'instruction': {
        // Render description with basic formatting: **bold**, _italic_, \n → <br>
        const renderInstructionText = (text: string) => {
          const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_|\n)/g);
          return parts.map((part, idx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={idx}>{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('_') && part.endsWith('_')) {
              return <em key={idx}>{part.slice(1, -1)}</em>;
            }
            if (part === '\n') {
              return <br key={idx} />;
            }
            return <React.Fragment key={idx}>{part}</React.Fragment>;
          });
        };
        return (
          <div key={block.id} className="rounded-md bg-muted/50 border border-border p-4 space-y-1">
            {block.label && <p className="text-sm font-semibold">{block.label}</p>}
            {block.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {renderInstructionText(block.description)}
              </p>
            )}
          </div>
        );
      }

      case 'divider':
        return (
          <div key={block.id} className="py-2">
            {block.label ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">{block.label}</span>
                <div className="flex-1 border-t border-border" />
              </div>
            ) : (
              <div className="border-t border-border" />
            )}
          </div>
        );

      default:
        return (
          <div key={block.id} className="space-y-2">
            <Label>{block.label}</Label>
            <Input
              value={(value as string) || ''}
              onChange={(e) => handleChange(block.id, e.target.value)}
              placeholder={block.placeholder}
              disabled={readOnly}
            />
          </div>
        );
    }
  };

  // --- Type-specific computed values ---
  const typeUx = formType ? FORM_TYPE_UX[formType] : undefined;
  const INPUT_TYPES = new Set(['text','textarea','number','date','time','radio','checkbox','checkboxes','select','dropdown','multiselect','rating','file','yes_no','slider','photo','signature','location']);
  const inputBlocks = blocks.filter(b => INPUT_TYPES.has(b.type) && isBlockVisible(b.conditional_logic, formData));
  const completedCount = inputBlocks.filter(b => {
    const v = formData[b.id];
    return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
  }).length;
  const totalCount = inputBlocks.length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (isSubmitted) {
    const didFail = lastScoringResult && !lastScoringResult.passed;
    const failMessage = didFail ? submissionConfig?.on_fail?.fail_message : undefined;
    const confirmMsg = submissionConfig?.confirmation_message || t('forms.publicSubmissionReceived');
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        {failMessage ? (
          <>
            <div className="rounded-full bg-red-100 dark:bg-red-950/50 p-4">
              <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <div className="w-full max-w-md rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">{t('forms.onFailBannerTitle')}</p>
              <p className="mt-1 text-sm text-red-700 dark:text-red-400">{failMessage}</p>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-full bg-green-100 dark:bg-green-950/50 p-4">
              <ClipboardCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-lg font-semibold">{confirmMsg}</p>
            {lastScoringResult && (
              <p className="text-sm text-muted-foreground">
                {t('forms.fillFinalScore', { score: Math.round(lastScoringResult.percentage) })}
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Type-specific header */}
      {typeUx && (
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${typeUx.accentBg}`}>
          <typeUx.icon className={`h-5 w-5 ${typeUx.accent}`} />
          <div className="min-w-0">
            <p className={`text-xs font-semibold uppercase tracking-wide ${typeUx.accent}`}>{t(typeUx.labelKey)}</p>
            {formTitle && <p className="text-sm font-medium truncate">{formTitle}</p>}
          </div>
        </div>
      )}

      {/* Start config: location selector for location-based mode */}
      {startConfig && !readOnly && startConfig.identity_mode === 'location' && stores.length > 0 && (
        <div className="space-y-2 p-4 rounded-lg border border-primary/20 bg-primary/5">
          <Label className="text-xs font-medium">
            {t('forms.startFieldLocation')} <span className="text-destructive">*</span>
          </Label>
          <Select
            value={(formData._location_id as string) || 'none'}
            onValueChange={(v) => {
              const store = stores.find(s => s.id === v);
              handleChange('_location_id', v === 'none' ? '' : v);
              handleChange('_location_name', store?.name || '');
            }}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder={t('forms.startFieldLocationPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('forms.startFieldLocationPlaceholder')}</SelectItem>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.code ? `${store.code} - ${store.name}` : store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {validationErrors._location_id && (
            <p className="text-xs text-destructive">{validationErrors._location_id}</p>
          )}
        </div>
      )}

      {/* Sign-off acknowledgement banner */}
      {formType === 'sign-off' && !readOnly && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-green-500/30 bg-green-500/10 text-sm">
          <FileSignature className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
          <span>{t('forms.fillSignOffNotice')}</span>
        </div>
      )}

      {/* Sign-off: linked content banner */}
      {formType === 'sign-off' && linkedContent && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 text-sm">
          <FileText className="h-5 w-5 text-blue-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{t('forms.fillSignOffLinkedLabel')}</p>
            <p className="font-medium truncate">{linkedContent.title}</p>
          </div>
        </div>
      )}

      {/* OJT: trainer/trainee context */}
      {formType === 'ojt-checklist' && !readOnly && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-purple-500/30 bg-purple-500/10 text-sm">
            <GraduationCap className="h-5 w-5 text-purple-500 shrink-0" />
            <span className="font-medium">{t('forms.fillOjtBanner')}</span>
          </div>
          {onOjtMetadataChange && ojtMetadata && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ojt-trainer-name" className="text-sm mb-1.5 block">{t('forms.fillOjtTrainerName')}</Label>
                <Input
                  id="ojt-trainer-name"
                  value={ojtMetadata.trainerName}
                  onChange={(e) => onOjtMetadataChange({ ...ojtMetadata, trainerName: e.target.value })}
                  placeholder={t('forms.fillOjtTrainerPlaceholder')}
                />
              </div>
              <div>
                <Label htmlFor="ojt-trainee-name" className="text-sm mb-1.5 block">{t('forms.fillOjtTraineeName')}</Label>
                <Input
                  id="ojt-trainee-name"
                  value={ojtMetadata.traineeName}
                  onChange={(e) => onOjtMetadataChange({ ...ojtMetadata, traineeName: e.target.value })}
                  placeholder={t('forms.fillOjtTraineePlaceholder')}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress bar — shown for all form types when not read-only */}
      {!readOnly && totalCount > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm px-0.5">
            <span className="text-muted-foreground text-xs">
              {t('forms.fillItemsCompleted', { done: completedCount, total: totalCount })}
            </span>
            <span className="text-xs font-medium tabular-nums">{completionPct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                completionPct === 100 ? 'bg-green-500' : 'bg-primary'
              }`}
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Section quick-nav for forms with multiple sections */}
      {!readOnly && sections.length > 2 && (
        <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-2.5">
          <div className="flex items-start gap-2">
            <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
              {(isSectionPillListExpanded
                ? visibleSections
                : visibleSections.filter(s => collapsedSectionIds.includes(s.id))
              ).map(s => (
                  <button
                    key={s.id}
                    ref={(el) => { sectionPillButtonRefs.current[s.id] = el; }}
                    type="button"
                    onClick={() => document.getElementById(`form-section-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="text-xs px-2.5 py-1 rounded-full border border-border bg-background hover:bg-muted transition-colors truncate max-w-[200px]"
                    title={s.title || ''}
                  >
                    {s.title}
                  </button>
                ))}
            </div>

            {isSectionPillListOverflowing && (
              <button
                type="button"
                onClick={() => setIsSectionPillListExpanded(prev => !prev)}
                className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                aria-label={isSectionPillListExpanded ? 'Collapse sections' : 'Expand sections'}
                title={isSectionPillListExpanded ? 'Collapse sections' : 'Expand sections'}
              >
                {isSectionPillListExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      )}

      {(() => {
        const elems: React.ReactNode[] = [];
        const sectionHeadersRendered = new Set<string>();
        for (const block of blocks) {
          // If we have sections, inject section headers before first block in each section
          if (sections.length > 0) {
            const sid = block.section_id;
            if (sid && !sectionHeadersRendered.has(sid)) {
              sectionHeadersRendered.add(sid);
              const section = sectionMap.get(sid);
              if (section && !allHiddenSectionIds.has(sid)) {
                elems.push(
                  <div key={`section-header-${sid}`} id={`form-section-${sid}`} className="pt-4 first:pt-0">
                    {elems.length > 0 && <Separator className="mb-5" />}
                    <div className="mb-4">
                      {section.title && (
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</h3>
                      )}
                      {section.description && (
                        <p className="text-xs text-muted-foreground/70 mt-1">{section.description}</p>
                      )}
                    </div>
                  </div>
                );
              }
            }
          }
          const rendered = renderBlock(block);
          if (!rendered) continue;
          const errorMsg = validationErrors[block.id];
          elems.push(
            <div key={block.id} id={`form-field-${block.id}`} className={errorMsg ? 'rounded-md ring-1 ring-destructive/50 p-1 -m-1' : undefined}>
              {rendered}
              {errorMsg && <p className="mt-1 text-xs text-destructive font-medium">{errorMsg}</p>}
            </div>
          );
        }
        return elems;
      })()}
      {/* Inspection/Audit bottom score summary */}
      {(formType === 'inspection' || formType === 'audit') && scoringEnabled && !readOnly && totalCount > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 text-sm">
          <span className="font-medium">{t('forms.fillScoreSummary')}</span>
          <span className="font-bold text-lg">{completionPct}%</span>
        </div>
      )}
      {!readOnly && onSubmit && (
        <div className="pt-6 border-t mt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed font-medium text-sm flex items-center justify-center gap-2"
          >
            {isSubmitting && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {isSubmitting ? t('forms.fillSubmitting', 'Submitting...') : t('forms.fillSubmit', 'Submit')}
          </button>
        </div>
      )}

      {/* Guideline slide-up drawer */}
      <GuidelineDrawer />
    </div>
  );
}
