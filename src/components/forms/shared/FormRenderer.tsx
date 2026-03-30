import React from 'react';
import { isBlockVisible, ConditionalLogic } from '../../../lib/forms/conditionalLogic';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Star, Upload, X, FileText, Loader2, AlertCircle } from 'lucide-react';
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
}

export interface ScoringResult {
  score_percentage: number;
  passed: boolean;
  total_weight: number;
  earned_weight: number;
}

export interface FormRendererProps {
  blocks: FormBlockData[];
  answers?: Record<string, unknown>;
  readOnly?: boolean;
  scoringEnabled?: boolean;
  passThreshold?: number;
  onSubmit?: (data: Record<string, unknown>, scoring?: ScoringResult) => void | Promise<void>;
  /** Required for file/photo upload blocks — used as the storage path prefix */
  formId?: string;
}

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

export function FormRenderer({ blocks, answers = {}, readOnly = false, scoringEnabled, passThreshold = 70, onSubmit, formId }: FormRendererProps) {
  const [formData, setFormData] = React.useState<Record<string, unknown>>(answers);
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [uploadStates, setUploadStates] = React.useState<Record<string, UploadState>>({});

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

  React.useEffect(() => {
    setFormData(answers);
  }, [answers]);

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
      const val = formData[block.id];
      const isEmpty =
        val === undefined ||
        val === null ||
        val === '' ||
        (Array.isArray(val) && val.length === 0);
      if (isEmpty) {
        errors[block.id] = 'This field is required';
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderBlock = (block: FormBlockData) => {
    // Evaluate conditional logic — skip blocks that should be hidden
    if (!isBlockVisible(block.conditional_logic, formData)) {
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
                <SelectValue placeholder={block.placeholder || 'Select...'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select...</SelectItem>
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
                    <FileText className="w-4 h-4" /> View attachment
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
                  <span className="truncate">Upload failed: {fileUpState.error}</span>
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
                  <span className="text-sm text-muted-foreground">Click to upload a file</span>
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
                  <span className="truncate">Upload failed: {photoUpState.error}</span>
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
                  <span className="text-sm text-muted-foreground">Click to take or upload a photo</span>
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
              <div className="h-24 border border-border rounded-md flex items-center justify-center text-sm italic text-muted-foreground">
                {value ? 'Signature captured' : 'No signature'}
              </div>
            ) : (
              <div className="relative">
                <Textarea placeholder="Type your name to sign..."
                  value={(value as string) || ''} onChange={(e) => handleChange(block.id, e.target.value)}
                  className="italic font-serif min-h-[80px]" />
                <p className="text-xs text-muted-foreground mt-1">Type your full name as your signature</p>
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
                  📍 Capture Location
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

  return (
    <div className="space-y-6">
      {blocks.map((block) => {
        const rendered = renderBlock(block);
        if (!rendered) return null;
        const errorMsg = validationErrors[block.id];
        return (
          <div
            key={block.id}
            id={`form-field-${block.id}`}
            className={errorMsg ? 'rounded-md ring-1 ring-destructive/50 p-1 -m-1' : undefined}
          >
            {rendered}
            {errorMsg && (
              <p className="mt-1 text-xs text-destructive font-medium">{errorMsg}</p>
            )}
          </div>
        );
      })}
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
