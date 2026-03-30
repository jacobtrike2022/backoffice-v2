import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Upload,
  FileText,
  Loader2,
  Sparkles,
  X,
  Trash2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { createForm } from '../../lib/crud/forms';
import { getServerUrl } from '../../utils/supabase/info';
import { supabase, supabaseAnonKey } from '../../lib/supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ImportFromPDFProps {
  orgId: string;
  onImported: (formId: string) => void;
  onCancel: () => void;
}

interface ParsedBlock {
  block_type: string;
  label: string;
  description?: string;
  is_required: boolean;
  options?: string[];
  display_order: number;
  _removed?: boolean;
}

interface ParseResult {
  blocks: ParsedBlock[];
  detected_form_type: string;
  title: string;
  description: string;
}

type UploadState = 'idle' | 'uploading' | 'analyzing' | 'review' | 'creating' | 'done' | 'error';

const BLOCK_TYPE_OPTIONS = [
  { value: 'text', label: 'Short Answer' },
  { value: 'textarea', label: 'Long Answer' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'radio', label: 'Multiple Choice' },
  { value: 'checkboxes', label: 'Checkboxes' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'rating', label: 'Rating' },
  { value: 'file', label: 'File Upload' },
  { value: 'signature', label: 'Signature' },
  { value: 'photo', label: 'Photo' },
  { value: 'instruction', label: 'Instruction' },
  { value: 'divider', label: 'Divider' },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Component ──────────────────────────────────────────────────────────────

export function ImportFromPDF({ orgId, onImported, onCancel }: ImportFromPDFProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<UploadState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [blocks, setBlocks] = useState<ParsedBlock[]>([]);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // ── File handling ─────────────────────────────────────────────────────────

  const handleFile = useCallback(async (selectedFile: File) => {
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }

    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['pdf'].includes(ext || '')) {
      setError('Only PDF files are supported.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setState('uploading');

    try {
      setState('analyzing');

      // Call edge function directly with multipart
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || supabaseAnonKey;
      const serverUrl = getServerUrl();

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`${serverUrl}/forms/parse-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'apikey': supabaseAnonKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const data: ParseResult = await response.json();

      if (!data.blocks || data.blocks.length === 0) {
        throw new Error('No form fields were detected in this document. Try a different PDF.');
      }

      setResult(data);
      setBlocks(data.blocks.map((b, i) => ({ ...b, display_order: i })));
      setFormTitle(data.title || 'Imported Form');
      setFormDescription(data.description || '');
      setState('review');
    } catch (err) {
      console.error('PDF parse error:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze PDF');
      setState('error');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // ── Block editing ─────────────────────────────────────────────────────────

  const removeBlock = (index: number) => {
    setBlocks(prev => prev.filter((_, i) => i !== index));
  };

  const updateBlockLabel = (index: number, label: string) => {
    setBlocks(prev => prev.map((b, i) => i === index ? { ...b, label } : b));
  };

  const updateBlockType = (index: number, block_type: string) => {
    setBlocks(prev => prev.map((b, i) => i === index ? { ...b, block_type } : b));
  };

  // ── Create form ───────────────────────────────────────────────────────────

  const handleCreateForm = async () => {
    if (blocks.length === 0) {
      setError('No blocks to create a form with.');
      return;
    }

    setState('creating');
    setError(null);

    try {
      const formType = result?.detected_form_type || 'inspection';
      const validTypes = ['ojt-checklist', 'inspection', 'audit', 'survey', 'sign-off'] as const;
      const safeType = validTypes.includes(formType as any) ? formType : 'inspection';

      const newForm = await createForm(
        {
          title: formTitle || 'Imported Form',
          description: formDescription || undefined,
          type: safeType as any,
        },
        orgId,
      );

      // Store blocks in sessionStorage for the form builder to pick up
      const blocksForBuilder = blocks.map((b, i) => ({
        block_type: b.block_type,
        label: b.label,
        description: b.description,
        is_required: b.is_required,
        options: b.options,
        display_order: i,
      }));

      sessionStorage.setItem(
        `imported_form_blocks_${newForm.id}`,
        JSON.stringify(blocksForBuilder),
      );

      setState('done');
      onImported(newForm.id);
    } catch (err) {
      console.error('Error creating form:', err);
      setError(err instanceof Error ? err.message : 'Failed to create form');
      setState('creating'); // allow retry
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const activeBlocks = blocks.filter(b => !b._removed);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Import Form from PDF
          </DialogTitle>
          <DialogDescription>
            Upload a PDF document and AI will detect form fields automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* ── Idle / Error: Drop zone ──────────────────────────────────── */}
          {(state === 'idle' || state === 'error') && (
            <>
              <div
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                  transition-colors
                  ${isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50'}
                `}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">
                  Drag and drop a PDF here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF files up to 10MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}

          {/* ── Uploading / Analyzing ────────────────────────────────────── */}
          {(state === 'uploading' || state === 'analyzing') && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">
                  {state === 'uploading' ? 'Uploading document...' : 'AI is analyzing your document...'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {state === 'analyzing'
                    ? 'Detecting form fields, checkboxes, signature lines, and more'
                    : 'Please wait'}
                </p>
              </div>
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  {file.name}
                </div>
              )}
            </div>
          )}

          {/* ── Review ───────────────────────────────────────────────────── */}
          {state === 'review' && (
            <>
              {/* Form metadata */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Form Title</label>
                  <Input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Form title"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Brief description (optional)"
                    className="mt-1"
                  />
                </div>
                {result?.detected_form_type && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Detected type:</span>
                    <Badge variant="secondary">{result.detected_form_type}</Badge>
                  </div>
                )}
              </div>

              {/* Block list */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Detected Fields ({activeBlocks.length})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Edit labels, change types, or remove unwanted fields
                  </p>
                </div>

                <div className="border rounded-md divide-y max-h-[340px] overflow-y-auto">
                  {activeBlocks.map((block, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2.5 hover:bg-muted/50 group"
                    >
                      {/* Block type selector */}
                      <Select
                        value={block.block_type}
                        onValueChange={(val) => updateBlockType(blocks.indexOf(block), val)}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BLOCK_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Editable label */}
                      <Input
                        value={block.label}
                        onChange={(e) => updateBlockLabel(blocks.indexOf(block), e.target.value)}
                        className="flex-1 h-8 text-sm"
                      />

                      {/* Required badge */}
                      {block.is_required && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          Required
                        </Badge>
                      )}

                      {/* Options count */}
                      {block.options && block.options.length > 0 && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {block.options.length} opts
                        </span>
                      )}

                      {/* Remove button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={() => removeBlock(blocks.indexOf(block))}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}

          {/* ── Creating ─────────────────────────────────────────────────── */}
          {state === 'creating' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="font-medium">Creating your form...</p>
            </div>
          )}
        </div>

        {/* ── Footer actions ───────────────────────────────────────────── */}
        <div className="flex justify-end gap-2 pt-4 border-t mt-2">
          {state === 'review' && (
            <>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateForm}
                disabled={activeBlocks.length === 0}
                className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Create Form ({activeBlocks.length} fields)
              </Button>
            </>
          )}
          {(state === 'idle' || state === 'error') && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {(state === 'uploading' || state === 'analyzing') && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
