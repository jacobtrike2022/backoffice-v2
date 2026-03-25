// ============================================================================
// BULK CERTIFICATE IMPORT COMPONENT
// ============================================================================
// Allows admins to import multiple employee certifications from a CSV file.
// Matches employees by email, creates certifications, and suppresses pending
// compliance assignments automatically.
// ============================================================================

import React, { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import {
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Download,
  Eye,
  Play,
  RefreshCw
} from 'lucide-react';
import { processBulkCertImport, type BulkImportResult } from '../../lib/crud/certifications';

// ============================================================================
// TYPES
// ============================================================================

interface ParsedRow {
  employee_email: string;
  certificate_type: string;
  issue_date: string;
  expiry_date?: string;
  certificate_number?: string;
  raw: Record<string, string>;
}

interface ColumnMapping {
  employee_email: string | null;
  certificate_type: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  certificate_number: string | null;
}

interface BulkCertImportProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// ============================================================================
// CSV PARSING HELPER
// ============================================================================

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };

  // Parse headers - handle quoted values
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.length === headers.length && values.some(v => v)) {
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      rows.push(row);
    }
  }

  return { headers, rows };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BulkCertImport({ open, onClose, onSuccess }: BulkCertImportProps) {
  // File state
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column mapping state
  const [mapping, setMapping] = useState<ColumnMapping>({
    employee_email: null,
    certificate_type: null,
    issue_date: null,
    expiry_date: null,
    certificate_number: null
  });

  // Import state
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'results'>('upload');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BulkImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state
  const resetState = useCallback(() => {
    setFile(null);
    setHeaders([]);
    setRawRows([]);
    setMapping({
      employee_email: null,
      certificate_type: null,
      issue_date: null,
      expiry_date: null,
      certificate_number: null
    });
    setStep('upload');
    setProgress(0);
    setResults(null);
    setError(null);
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setError(null);

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    try {
      const text = await selectedFile.text();
      const { headers: parsedHeaders, rows: parsedRows } = parseCSV(text);

      if (parsedHeaders.length === 0) {
        setError('CSV file appears to be empty or invalid');
        return;
      }

      if (parsedRows.length === 0) {
        setError('CSV file has no data rows');
        return;
      }

      setFile(selectedFile);
      setHeaders(parsedHeaders);
      setRawRows(parsedRows);

      // Auto-map columns based on header names
      const autoMapping: ColumnMapping = {
        employee_email: null,
        certificate_type: null,
        issue_date: null,
        expiry_date: null,
        certificate_number: null
      };

      parsedHeaders.forEach(header => {
        const lower = header.toLowerCase();
        if (lower.includes('email')) autoMapping.employee_email = header;
        else if (lower.includes('type') || lower.includes('cert')) autoMapping.certificate_type = header;
        else if (lower.includes('issue') || lower.includes('start')) autoMapping.issue_date = header;
        else if (lower.includes('expir') || lower.includes('end')) autoMapping.expiry_date = header;
        else if (lower.includes('number') || lower.includes('id') || lower.includes('license')) autoMapping.certificate_number = header;
      });

      setMapping(autoMapping);
      setStep('mapping');
    } catch (err) {
      setError('Failed to parse CSV file');
      console.error('CSV parse error:', err);
    }
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  // Get mapped rows for preview
  const getMappedRows = useCallback((): ParsedRow[] => {
    if (!mapping.employee_email || !mapping.certificate_type || !mapping.issue_date) {
      return [];
    }

    return rawRows.map(row => ({
      employee_email: row[mapping.employee_email!] || '',
      certificate_type: row[mapping.certificate_type!] || '',
      issue_date: row[mapping.issue_date!] || '',
      expiry_date: mapping.expiry_date ? row[mapping.expiry_date] : undefined,
      certificate_number: mapping.certificate_number ? row[mapping.certificate_number] : undefined,
      raw: row
    })).filter(row => row.employee_email && row.certificate_type && row.issue_date);
  }, [rawRows, mapping]);

  // Check if mapping is valid
  const isMappingValid = mapping.employee_email && mapping.certificate_type && mapping.issue_date;

  // Run import
  const handleImport = useCallback(async () => {
    const rows = getMappedRows();
    if (rows.length === 0) return;

    setStep('importing');
    setProgress(0);
    setError(null);

    try {
      const result = await processBulkCertImport(
        rows.map(r => ({
          employee_email: r.employee_email,
          certificate_type: r.certificate_type,
          issue_date: r.issue_date,
          expiry_date: r.expiry_date,
          certificate_number: r.certificate_number
        })),
        file?.name || 'bulk_import.csv',
        (current, total) => setProgress(Math.round((current / total) * 100))
      );

      setResults(result);
      setStep('results');

      if (result.successful > 0 && onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  }, [getMappedRows, file, onSuccess]);

  // Render upload step
  const renderUploadStep = () => (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />
        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="font-medium">Drop a CSV file here or click to browse</p>
        <p className="text-sm text-muted-foreground mt-1">
          Expected columns: employee_email, certificate_type, issue_date, expiry_date (optional), certificate_number (optional)
        </p>
      </div>

      <Alert>
        <FileSpreadsheet className="h-4 w-4" />
        <AlertDescription>
          <strong>CSV Format:</strong> Your file should have headers in the first row. We'll auto-detect column mappings, but you can adjust them in the next step.
        </AlertDescription>
      </Alert>
    </div>
  );

  // Render mapping step
  const renderMappingStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileSpreadsheet className="h-4 w-4" />
        <span>{file?.name}</span>
        <Badge variant="secondary">{rawRows.length} rows</Badge>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4">
        {/* Required fields */}
        <div>
          <label className="text-sm font-medium text-red-500">Employee Email *</label>
          <Select value={mapping.employee_email || ''} onValueChange={(v) => setMapping(m => ({ ...m, employee_email: v }))}>
            <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
            <SelectContent>
              {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-red-500">Certificate Type *</label>
          <Select value={mapping.certificate_type || ''} onValueChange={(v) => setMapping(m => ({ ...m, certificate_type: v }))}>
            <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
            <SelectContent>
              {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-red-500">Issue Date *</label>
          <Select value={mapping.issue_date || ''} onValueChange={(v) => setMapping(m => ({ ...m, issue_date: v }))}>
            <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
            <SelectContent>
              {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Optional fields */}
        <div>
          <label className="text-sm font-medium">Expiry Date</label>
          <Select value={mapping.expiry_date || ''} onValueChange={(v) => setMapping(m => ({ ...m, expiry_date: v || null }))}>
            <SelectTrigger><SelectValue placeholder="Select column (optional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium">Certificate Number</label>
          <Select value={mapping.certificate_number || ''} onValueChange={(v) => setMapping(m => ({ ...m, certificate_number: v || null }))}>
            <SelectTrigger><SelectValue placeholder="Select column (optional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!isMappingValid && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please map all required fields (marked with *)
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

  // Render preview step
  const renderPreviewStep = () => {
    const rows = getMappedRows();
    const previewRows = rows.slice(0, 5);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Previewing first {previewRows.length} of {rows.length} rows
          </div>
          <Badge variant="outline">{rows.length} valid rows</Badge>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Certificate</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Number</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono text-xs">{row.employee_email}</TableCell>
                  <TableCell>{row.certificate_type}</TableCell>
                  <TableCell>{row.issue_date}</TableCell>
                  <TableCell>{row.expiry_date || '—'}</TableCell>
                  <TableCell>{row.certificate_number || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {rows.length > 5 && (
          <p className="text-sm text-muted-foreground text-center">
            ... and {rows.length - 5} more rows
          </p>
        )}
      </div>
    );
  };

  // Render importing step
  const renderImportingStep = () => (
    <div className="space-y-4 py-8">
      <div className="text-center">
        <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
        <p className="font-medium">Importing certifications...</p>
        <p className="text-sm text-muted-foreground">Please wait while we process your file</p>
      </div>
      <Progress value={progress} className="w-full" />
      <p className="text-center text-sm text-muted-foreground">{progress}% complete</p>
    </div>
  );

  // Render results step
  const renderResultsStep = () => {
    if (!results) return null;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{results.successful}</p>
                  <p className="text-sm text-muted-foreground">Imported</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <X className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{results.failed}</p>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{results.suppressedAssignments}</p>
                  <p className="text-sm text-muted-foreground">Assignments Suppressed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {results.errors.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-red-500">Errors:</p>
            <div className="max-h-40 overflow-auto border rounded-lg p-2 text-sm">
              {results.errors.slice(0, 10).map((err, idx) => (
                <div key={idx} className="text-red-600 py-1">
                  Row {err.row}: {err.error}
                </div>
              ))}
              {results.errors.length > 10 && (
                <p className="text-muted-foreground">... and {results.errors.length - 10} more errors</p>
              )}
            </div>
          </div>
        )}

        {results.successful > 0 && (
          <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Successfully imported {results.successful} certification{results.successful !== 1 ? 's' : ''}.
              {results.suppressedAssignments > 0 && ` ${results.suppressedAssignments} pending compliance assignment${results.suppressedAssignments !== 1 ? 's were' : ' was'} automatically suppressed.`}
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  // Get dialog footer buttons based on step
  const getFooterButtons = () => {
    switch (step) {
      case 'upload':
        return (
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        );
      case 'mapping':
        return (
          <>
            <Button variant="outline" onClick={() => { resetState(); }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Start Over
            </Button>
            <Button disabled={!isMappingValid} onClick={() => setStep('preview')}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </>
        );
      case 'preview':
        return (
          <>
            <Button variant="outline" onClick={() => setStep('mapping')}>Back to Mapping</Button>
            <Button onClick={handleImport} disabled={getMappedRows().length === 0}>
              <Play className="h-4 w-4 mr-2" />
              Import {getMappedRows().length} Rows
            </Button>
          </>
        );
      case 'importing':
        return null;
      case 'results':
        return (
          <>
            <Button variant="outline" onClick={resetState}>Import More</Button>
            <Button onClick={onClose}>Done</Button>
          </>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Certificate Import
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a CSV file containing employee certifications'}
            {step === 'mapping' && 'Map your CSV columns to certification fields'}
            {step === 'preview' && 'Review the data before importing'}
            {step === 'importing' && 'Importing certifications...'}
            {step === 'results' && 'Import complete'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 'upload' && renderUploadStep()}
        {step === 'mapping' && renderMappingStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'importing' && renderImportingStep()}
        {step === 'results' && renderResultsStep()}

        <DialogFooter className="gap-2">
          {getFooterButtons()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BulkCertImport;
