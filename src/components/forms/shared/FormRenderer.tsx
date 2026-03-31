import React from 'react';
import { useTranslation } from 'react-i18next';
import SignatureCanvas from 'react-signature-canvas';
import { isBlockVisible, ConditionalLogic, getSkippedSectionIds } from '../../../lib/forms/conditionalLogic';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Star, Upload, X, FileText, Loader2, AlertCircle, ClipboardCheck, Shield, FileSignature, GraduationCap, MessageSquare } from 'lucide-react';
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
}

export interface FormSectionData {
  id: string;
  title?: string;
  description?: string;
  display_order: number;
}

export interface ScoringResult {
  score_percentage: number;
  passed: boolean;
  total_weight: number;
  earned_weight: number;
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
}

export interface FormRendererProps {
  blocks: FormBlockData[];
  /** Ordered list of form sections. When provided, section headers are rendered and skip_to_section logic is active. */
  sections?: FormSectionData[];
  answers?: Record<string, unknown>;
  readOnly?: boolean;
  scoringEnabled?: boolean;
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

export function FormRenderer({ blocks, sections = EMPTY_SECTIONS, answers = EMPTY_ANSWERS, readOnly = false, scoringEnabled, passThreshold = 70, onSubmit, formId, submissionConfig, formType, formTitle }: FormRendererProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = React.useState<Record<string, unknown>>(answers);
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [uploadStates, setUploadStates] = React.useState<Record<string, UploadState>>({});
  const sigCanvasRefs = React.useRef<Record<string, SignatureCanvas | null>>({});
  const prevSkippedRef = React.useRef<Set<string>>(new Set());

  // Compute which sections are skipped due to active skip_to_section rules
  const skippedSectionIds = React.useMemo(
    () => getSkippedSectionIds(blocks, sections, formData),
    [blocks, sections, formData]
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
    const INPUT_BLOCK_TYPES = new Set([
      'text', 'textarea', 'number', 'date', 'time', 'radio', 'checkbox', 'checkboxes',
      'select', 'dropdown', 'multiselect', 'rating', 'file', 'yes_no', 'slider',
      'photo', 'signature', 'location',
    ]);
    for (const block of blocks) {
      if (!block.is_required) continue;
      if (!INPUT_BLOCK_TYPES.has(block.type)) continue;
      if (!isBlockVisible(block.conditional_logic, formData)) continue;
      // Skip validation for blocks in skipped sections
      if (block.section_id && skippedSectionIds.has(block.section_id)) continue;
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
      // Compute scoring if enabled
      let scoring: ScoringResult | undefined;
      if (scoringEnabled) {
        let totalWeight = 0;
        let earnedWeight = 0;

        for (const block of blocks) {
          // Skip hidden blocks — they should not affect scoring
          if (!isBlockVisible(block.conditional_logic, formData)) continue;
          // Skip blocks in skipped sections
          if (block.section_id && skippedSectionIds.has(block.section_id)) continue;

          const _settings = (block.validation_rules?._settings as Record<string, unknown>) || {};
          const weight = (_settings.score_weight as number) || 0;
          const correctAnswer = (_settings.correct_answer as string) || '';
          if (weight <= 0 || !correctAnswer) continue;

          totalWeight += weight;
          const response = formData[block.id];

          // Compare response to correct answer
          let isCorrect = false;
          if (block.type === 'checkboxes') {
            // For checkboxes, compare sorted comma-separated values
            const correctSet = correctAnswer.split(',').map(s => s.trim().toLowerCase()).sort();
            const responseArr = Array.isArray(response)
              ? (response as string[]).map(s => String(s).trim().toLowerCase()).sort()
              : [];
            isCorrect = correctSet.length === responseArr.length &&
              correctSet.every((v, i) => v === responseArr[i]);
          } else if (block.type === 'number' || block.type === 'rating') {
            isCorrect = String(response) === String(correctAnswer);
          } else {
            isCorrect = String(response || '').toLowerCase().trim() === correctAnswer.toLowerCase().trim();
          }

          if (isCorrect) {
            earnedWeight += weight;
          }
        }

        const scorePercentage = totalWeight > 0 ? (earnedWeight / totalWeight) * 100 : 0;
        scoring = {
          score_percentage: Math.round(scorePercentage * 100) / 100,
          passed: scorePercentage >= passThreshold,
          total_weight: totalWeight,
          earned_weight: earnedWeight,
        };
      }

      await onSubmit?.(formData, scoring);
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderBlock = (block: FormBlockData) => {
    // Evaluate conditional logic — skip blocks that should be hidden
    if (!isBlockVisible(block.conditional_logic, formData)) {
      return null;
    }

    // Skip blocks whose section is being skipped via skip_to_section
    if (block.section_id && skippedSectionIds.has(block.section_id)) {
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
            <Label>
              {block.label}
              {block.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
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
            <Label>
              {block.label}
              {block.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
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
            <Label>
              {block.label}
              {block.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
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

      case 'date':
        return (
          <div key={block.id} className="space-y-2">
            <Label>
              {block.label}
              {block.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <Input
              type="date"
              value={(value as string) || ''}
              onChange={(e) => handleChange(block.id, e.target.value)}
              disabled={readOnly}
            />
          </div>
        );

      case 'time':
        return (
          <div key={block.id} className="space-y-2">
            <Label>
              {block.label}
              {block.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <Input
              type="time"
              value={(value as string) || ''}
              onChange={(e) => handleChange(block.id, e.target.value)}
              disabled={readOnly}
            />
          </div>
        );

      case 'radio':
        return (
          <div key={block.id} className="space-y-2">
            <Label>
              {block.label}
              {block.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
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
            <Label>
              {block.label}
              {block.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
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
            <Label>
              {block.label}
              {block.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
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
            <Label>
              {block.label}
              {block.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
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
            <Label>
              {block.label}
              {block.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
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
            <Label>
              {block.label}
              {block.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
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
        return (
          <div key={block.id} className="space-y-2">
            <Label>
              {block.label}
              {block.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {block.description && <p className="text-xs text-muted-foreground">{block.description}</p>}
            {readOnly ? (
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                value === 'yes' ? 'bg-green-500/20 text-green-400' :
                value === 'no' ? 'bg-red-500/20 text-red-400' :
                'text-muted-foreground'
              }`}>{value === 'yes' ? yesLabel : value === 'no' ? noLabel : '—'}</div>
            ) : (
              <div className="flex gap-3">
                <button type="button" onClick={() => handleChange(block.id, 'yes')}
                  className={`flex-1 py-3 rounded-lg border-2 font-medium text-sm transition-colors ${
                    value === 'yes' ? 'border-green-500 bg-green-500/20 text-green-400' : 'border-border hover:border-green-500/50'
                  }`}>{yesLabel}</button>
                <button type="button" onClick={() => handleChange(block.id, 'no')}
                  className={`flex-1 py-3 rounded-lg border-2 font-medium text-sm transition-colors ${
                    value === 'no' ? 'border-red-500 bg-red-500/20 text-red-400' : 'border-border hover:border-red-500/50'
                  }`}>{noLabel}</button>
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
    const confirmMsg = submissionConfig?.confirmation_message || t('forms.publicSubmissionReceived');
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <div className="rounded-full bg-green-100 p-3">
          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-base font-semibold">{confirmMsg}</p>
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

      {/* Sign-off acknowledgement banner */}
      {formType === 'sign-off' && !readOnly && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-green-500/30 bg-green-500/10 text-sm">
          <FileSignature className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
          <span>{t('forms.fillSignOffNotice')}</span>
        </div>
      )}

      {/* Inspection/Audit completion counter */}
      {(formType === 'inspection' || formType === 'audit') && !readOnly && totalCount > 0 && (
        <div className="flex items-center justify-between text-sm px-1">
          <span className="text-muted-foreground">{t('forms.fillItemsCompleted', { done: completedCount, total: totalCount })}</span>
          {scoringEnabled && completionPct > 0 && (
            <span className="font-medium">{completionPct}%</span>
          )}
        </div>
      )}

      {/* Survey progress bar */}
      {formType === 'survey' && !readOnly && totalCount > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 rounded-full transition-all duration-300" style={{ width: `${completionPct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground text-right">{completionPct}%</p>
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
              if (section && !skippedSectionIds.has(sid)) {
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
        <div className="pt-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      )}
    </div>
  );
}
