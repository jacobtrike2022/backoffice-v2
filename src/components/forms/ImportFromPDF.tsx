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

async function extractTextFromPdf(file: File): Promise<string | null> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    // Use the bundled worker — Vite resolves this at build time
    const workerModule = await import('pdfjs-dist/build/pdf.worker.mjs?url');
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
      standardFontDataUrl: undefined, // Suppress font warning — we only need text, not rendering
    }).promise;

    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      // Group text items by Y position to reconstruct lines
      const lines: Map<number, string[]> = new Map();
      for (const item of content.items as any[]) {
        if (!item.str || !item.str.trim()) continue;
        // Round Y to nearest int to group items on the same line
        const y = Math.round(item.transform?.[5] ?? 0);
        if (!lines.has(y)) lines.set(y, []);
        lines.get(y)!.push(item.str);
      }

      // Sort by Y descending (PDF coordinates: Y=0 is bottom)
      const sortedLines = Array.from(lines.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([, texts]) => texts.join(' ').trim())
        .filter(Boolean);

      if (sortedLines.length > 0) {
        pages.push(sortedLines.join('\n'));
      }
    }

    const fullText = pages.join('\n\n');
    if (fullText.length > 100) {
      return fullText;
    }
    return null;
  } catch {
    return null;
  }
}

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

  // ── Smart multi-sheet handling ──
  // Classify sheets: questionnaire (Y/N/NA items), guidelines (grading criteria), recap (score summaries)
  // Skip legacy/duplicate sheets, skip recap/score sheets, match guidelines to questions.

  // Fill merged cells so all cells in a merge range contain the top-left value.
  // Without this, sheet_to_json returns undefined for non-origin cells in merges.
  const fillMergedCells = (sheet: any) => {
    const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = sheet['!merges'] || [];
    for (const merge of merges) {
      const originAddr = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
      const originCell = sheet[originAddr];
      if (!originCell) continue;
      // Only fill across columns on the same row (don't duplicate content into every row of tall merges)
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        if (c === merge.s.c) continue; // skip origin
        const addr = XLSX.utils.encode_cell({ r: merge.s.r, c });
        if (!sheet[addr]) {
          sheet[addr] = { ...originCell };
        }
      }
    }
  };

  const sheetData: Array<{ name: string; rows: string[][] }> = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    fillMergedCells(sheet);
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as string[][];
    sheetData.push({ name: sheetName, rows });
  }

  // ── Sheet classification heuristics ──

  // Recap/summary: has score totals but no Y/N columns (not a fillable form)
  const isRecap = (name: string, rows: string[][]) => {
    if (/\b(recap|summary|score\s*card|report)\b/i.test(name)) return true;
    const hasTotals = rows.some(r => r.some(c => typeof c === 'string' && /\b(OVERALL SCORE|SSI SCORE)\b/i.test(c)));
    const hasScoreCols = rows.some(r => r.some(c => typeof c === 'string' && /\b(ACTUAL|AVAILABLE|SCORE)\b/i.test(c)));
    const hasYN = rows.some(r => r.some(c => typeof c === 'string' && /Y\s*\/\s*N/i.test(c)));
    return hasTotals && hasScoreCols && !hasYN;
  };

  // Guidelines: grading criteria sheets with long descriptive text
  const isGuideline = (name: string, rows: string[][]) => {
    if (/guideline/i.test(name)) return true;
    const longTexts = rows.filter(r => r.some(c => typeof c === 'string' && c.length > 200)).length;
    const hasYN = rows.some(r => r.some(c => typeof c === 'string' && /Y\s*\/\s*N/i.test(c)));
    return longTexts > 5 && !hasYN;
  };

  // Legacy duplicates: exact _V1 suffix (not partial matches like "Version 1 Data")
  const isLegacyDuplicate = (name: string) => /_V1$/i.test(name);

  // ── Build guideline lookup from guideline sheets ──
  const guidelineMap = new Map<string, string>();
  for (const sd of sheetData) {
    if (isLegacyDuplicate(sd.name)) continue;
    if (!isGuideline(sd.name, sd.rows)) continue;
    for (const row of sd.rows) {
      // Find the longest text cell as guideline content, use first short cell as key
      const cells = row.map(c => c == null ? '' : String(c).trim()).filter(Boolean);
      if (cells.length < 2) continue;

      const longestCell = cells.reduce((a, b) => b.length > a.length ? b : a, '');
      if (longestCell.length < 30) continue;

      // Key is typically the first cell (lookup ID) or a short identifier
      const keyCandidates = cells.filter(c => c !== longestCell && c.length < 80);
      for (const key of keyCandidates) {
        guidelineMap.set(key, longestCell);
        guidelineMap.set(key.replace(/_$/, ''), longestCell);
      }
    }
  }

  // ── Filter to form/questionnaire sheets only ──
  const formSheets = sheetData.filter(sd => {
    if (isLegacyDuplicate(sd.name)) return false;
    if (isRecap(sd.name, sd.rows)) return false;
    if (isGuideline(sd.name, sd.rows)) return false;
    return true;
  });

  const sheetsToProcess = formSheets.length > 0 ? formSheets : sheetData;

  // ── Find non-empty columns to strip token waste ──
  const findUsedColumns = (rows: string[][]): Set<number> => {
    const used = new Set<number>();
    for (const row of rows) {
      for (let i = 0; i < row.length; i++) {
        if (row[i] != null && String(row[i]).trim() !== '') used.add(i);
      }
    }
    return used;
  };

  const lines: string[] = [];

  if (guidelineMap.size > 0) {
    lines.push('NOTE: This spreadsheet contains guideline/grading criteria for checklist items. When a checklist item has matching guidelines, include them in the "guideline_text" field for that block.\n');
  }

  for (const sd of sheetsToProcess) {
    if (sheetsToProcess.length > 1) {
      lines.push(`\n=== Sheet: ${sd.name} ===\n`);
    }

    // Only include columns that have data somewhere in the sheet
    const usedCols = findUsedColumns(sd.rows);

    for (const row of sd.rows) {
      // Build compact CSV with only non-empty columns
      const cells = Array.from(usedCols).sort((a, b) => a - b)
        .map(i => row[i] == null ? '' : String(row[i]));
      const csvLine = cells.join(',');

      // Skip rows that are entirely empty after column filtering
      if (cells.every(c => c.trim() === '')) continue;

      // Match guideline by checking each cell as a potential lookup key
      let matchedGuideline = '';
      if (guidelineMap.size > 0) {
        for (const cell of cells) {
          const key = cell.trim();
          if (key && key.length < 80 && guidelineMap.has(key)) {
            matchedGuideline = guidelineMap.get(key)!;
            break;
          }
        }
      }

      if (matchedGuideline) {
        lines.push(`${csvLine} [GUIDELINE: ${matchedGuideline}]`);
      } else {
        lines.push(csvLine);
      }
    }
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

  // ── Single API call to parse-text ──
  const callParseTextAPI = useCallback(async (
    text: string,
    title: string,
    authToken: string,
  ): Promise<ParseResult> => {
    const response = await fetch(`${getServerUrl()}/forms/parse-text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, title }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errData.error || `Server error: ${response.status}`);
    }
    return await response.json();
  }, []);

  // ── Split text into section-based chunks for batched processing ──
  const splitTextIntoChunks = (text: string, maxChunkSize: number): string[] => {
    if (text.length <= maxChunkSize) return [text];

    const lines = text.split('\n');
    // Detect section boundaries: numbered headers, "=== Sheet:" markers, all-caps headers
    const isSectionBoundary = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      // "1. Pumps / Parking Lot", "7. Food - Grab-n-Go", "=== Sheet: ..."
      if (/^\d{1,3}\.\s+[A-Z]/.test(trimmed)) return true;
      if (/^===\s+Sheet:/.test(trimmed)) return true;
      // ALL-CAPS section headers (2+ words, no punctuation at end)
      if (/^[A-Z][A-Z\s\/&-]{4,}$/.test(trimmed) && !trimmed.endsWith(':')) return true;
      return false;
    };

    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentSize = 0;

    for (const line of lines) {
      const lineSize = line.length + 1;

      // If adding this line would exceed the limit AND we're at a section boundary, split
      if (currentSize + lineSize > maxChunkSize && currentChunk.length > 0 && isSectionBoundary(line)) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        currentSize = 0;
      }

      // If a single chunk is still too big and we hit any section boundary, force split
      if (currentSize > maxChunkSize * 0.8 && isSectionBoundary(line) && currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        currentSize = 0;
      }

      currentChunk.push(line);
      currentSize += lineSize;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  };

  // ── Batched parse: split large text into chunks, call API in parallel, merge results ──
  const parseTextBatched = useCallback(async (
    text: string,
    title: string,
    authToken: string,
  ): Promise<ParseResult> => {
    const BATCH_THRESHOLD = 12000; // chars — below this, single call is fine

    if (text.length <= BATCH_THRESHOLD) {
      return callParseTextAPI(text, title, authToken);
    }

    // Split into section-based chunks
    const chunks = splitTextIntoChunks(text, BATCH_THRESHOLD);

    if (chunks.length === 1) {
      return callParseTextAPI(text, title, authToken);
    }

    // Fire all chunks in parallel
    const results = await Promise.all(
      chunks.map((chunk, i) =>
        callParseTextAPI(
          chunk,
          i === 0 ? title : `${title} (part ${i + 1})`,
          authToken,
        )
      )
    );

    // Merge results: concatenate blocks (maintaining order), dedupe sections, take title/type from first result
    const mergedBlocks: ParseResult['blocks'] = [];
    const mergedSections: ParseResult['sections'] = [];
    const seenSectionTitles = new Set<string>();

    let blockOrder = 0;
    for (const result of results) {
      if (result.blocks) {
        for (const block of result.blocks) {
          mergedBlocks.push({ ...block, display_order: blockOrder++ });
        }
      }
      if (result.sections) {
        for (const section of result.sections) {
          if (!seenSectionTitles.has(section.title)) {
            seenSectionTitles.add(section.title);
            mergedSections.push(section);
          }
        }
      }
    }

    return {
      blocks: mergedBlocks,
      sections: mergedSections,
      detected_form_type: results[0]?.detected_form_type || 'inspection',
      title: results[0]?.title || title,
      description: results[0]?.description || '',
    };
  }, [callParseTextAPI]);

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

    return parseTextBatched(extractedText, selectedFile.name.replace(/\.[^.]+$/, ''), authToken);
  }, [parseTextBatched]);

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
        // Try text extraction first (faster, cheaper, handles large forms better)
        const pdfText = await extractTextFromPdf(selectedFile);
        if (pdfText) {
          // Compact large PDFs: merge short label lines with following long guideline lines
          let processedText = pdfText;
          if (pdfText.length > 15000) {
            const lines = pdfText.split('\n');
            const compacted: string[] = [];
            let i = 0;
            while (i < lines.length) {
              const line = lines[i].trim();
              if (line.length > 10 && line.length < 150 && i + 1 < lines.length) {
                const guideLines: string[] = [];
                let j = i + 1;
                while (j < lines.length && lines[j].trim().length > 120) {
                  guideLines.push(lines[j].trim());
                  j++;
                }
                if (guideLines.length > 0) {
                  compacted.push(`${line} [GUIDELINE: ${guideLines.join(' ')}]`);
                  i = j;
                  continue;
                }
              }
              compacted.push(line);
              i++;
            }
            processedText = compacted.join('\n');
          }

          // Text-based PDF — use batched parse-text (auto-splits large forms)
          const cleanTitle = selectedFile.name.replace(/\.[^.]+$/, '');
          data = await parseTextBatched(processedText, cleanTitle, authToken);
        } else {
          // Scanned/image PDF — fall back to vision API
          data = await parsePdf(selectedFile, authToken);
        }
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
