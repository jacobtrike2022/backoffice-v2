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
import {
  Upload,
  FileText,
  Loader2,
  Zap,
  AlertCircle,
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

interface ParseResult {
  blocks: Array<{
    block_type: string;
    label: string;
    description?: string;
    is_required: boolean;
    options?: string[];
    display_order: number;
    section_title?: string | null;
  }>;
  sections?: Array<{ title: string; description?: string }>;
  detected_form_type: string;
  title: string;
  description: string;
}

type UploadState = 'idle' | 'analyzing' | 'creating' | 'error';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv'];
const ACCEPT_STRING = '.pdf,.docx,.doc,.xlsx,.xls,.csv';

// ─── Text extractors for non-PDF files ──────────────────────────────────────

async function extractTextFromDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.default.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractTextFromXlsx(file: File): Promise<string> {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (workbook.SheetNames.length > 1) {
      lines.push(`\n=== Sheet: ${sheetName} ===\n`);
    }
    // Convert to CSV-like text preserving structure
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    lines.push(csv);
  }
  return lines.join('\n');
}

async function extractTextFromCsv(file: File): Promise<string> {
  return await file.text();
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ImportFromPDF({ orgId, onImported, onCancel }: ImportFromPDFProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<UploadState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Parse PDF via vision endpoint
  const parsePdf = useCallback(async (selectedFile: File, authToken: string): Promise<ParseResult> => {
    const formData = new FormData();
    formData.append('file', selectedFile);

    const response = await fetch(`${getServerUrl()}/forms/parse-pdf`, {
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
    return await response.json();
  }, []);

  // Parse text-based documents (docx, xlsx, csv) via text extraction + parse-text endpoint
  const parseTextDocument = useCallback(async (selectedFile: File, authToken: string): Promise<ParseResult> => {
    const ext = getFileExtension(selectedFile.name);
    let extractedText: string;

    if (ext === 'docx' || ext === 'doc') {
      extractedText = await extractTextFromDocx(selectedFile);
    } else if (ext === 'xlsx' || ext === 'xls') {
      extractedText = await extractTextFromXlsx(selectedFile);
    } else if (ext === 'csv') {
      extractedText = await extractTextFromCsv(selectedFile);
    } else {
      throw new Error(`Unsupported file type: .${ext}`);
    }

    if (!extractedText || extractedText.trim().length < 20) {
      throw new Error('Could not extract enough text from the document. The file may be empty or image-only.');
    }

    const response = await fetch(`${getServerUrl()}/forms/parse-text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: extractedText,
        title: selectedFile.name.replace(/\.[^.]+$/, ''),
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errData.error || `Server error: ${response.status}`);
    }
    return await response.json();
  }, []);

  // Upload → Parse → Create form → Open builder
  const handleFile = useCallback(async (selectedFile: File) => {
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }

    const ext = getFileExtension(selectedFile.name);
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.map(e => `.${e}`).join(', ')}`);
      return;
    }

    setFile(selectedFile);
    setError(null);
    setState('analyzing');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || supabaseAnonKey;

      // Route to the right parser based on file type
      let data: ParseResult;
      if (ext === 'pdf') {
        data = await parsePdf(selectedFile, authToken);
      } else {
        data = await parseTextDocument(selectedFile, authToken);
      }

      if (!data.blocks || data.blocks.length === 0) {
        throw new Error('No form fields were detected in this document.');
      }

      // Create form immediately
      setState('creating');
      const validTypes = ['ojt-checklist', 'inspection', 'audit', 'survey', 'sign-off'] as const;
      const formType = validTypes.includes(data.detected_form_type as any)
        ? data.detected_form_type
        : 'inspection';

      const cleanTitle = selectedFile.name.replace(/\.[^.]+$/, '');
      const newForm = await createForm(
        {
          title: data.title || cleanTitle,
          description: data.description || undefined,
          type: formType as any,
        },
        orgId
      );

      // Store blocks + sections in sessionStorage for the builder to pick up
      sessionStorage.setItem(
        `imported_form_blocks_${newForm.id}`,
        JSON.stringify({
          blocks: data.blocks.map((b: any, i: number) => ({ ...b, display_order: i })),
          sections: data.sections || [],
        })
      );

      onImported(newForm.id);
    } catch (err) {
      console.error('Document import error:', err);
      setError(err instanceof Error ? err.message : 'Failed to import document');
      setState('error');
    }
  }, [orgId, onImported, parsePdf, parseTextDocument]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  }, [handleFile]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Import from Document
          </DialogTitle>
          <DialogDescription>
            Upload a PDF, Word document, or spreadsheet and we'll create a form with all detected fields.
          </DialogDescription>
        </DialogHeader>

        {/* Idle / Error: Drop zone */}
        {(state === 'idle' || state === 'error') && (
          <div className="space-y-3">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Drop a file here, or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, Word (.docx), Excel (.xlsx), or CSV — up to 10MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_STRING}
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Analyzing / Creating: Spinner */}
        {(state === 'analyzing' || state === 'creating') && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Processing...</p>
            {file && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                {file.name}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
