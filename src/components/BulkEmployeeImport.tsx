import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';
import { Card, CardContent } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from './ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from './ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import {
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Play,
  Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  matchColumns,
  parseCSV,
  normalizeDateValue,
  normalizeEmailValue,
  normalizeNameCase,
  getConfidenceColor,
  getConfidenceLabel,
  fuzzyMatchValue,
  FIELD_DEFINITIONS,
  type ColumnMatch
} from '../lib/importMapping';
import { bulkCreateUsers, type BulkCreateUsersResult } from '../lib/crud/users';
import { useRoles, useStores, useEffectiveOrgId } from '../lib/hooks/useSupabase';
import { toast } from 'sonner@2.0.3';

// ============================================================================
// TYPES
// ============================================================================

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'results';

interface BulkEmployeeImportProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BulkEmployeeImport({ open, onClose, onSuccess }: BulkEmployeeImportProps) {
  const { orgId } = useEffectiveOrgId();
  const { roles } = useRoles(orgId ?? undefined);
  const { stores } = useStores(orgId ? { organization_id: orgId } : undefined);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column mapping state — sourceHeader → targetFieldKey
  const [columnMappings, setColumnMappings] = useState<ColumnMatch[]>([]);

  // Role/store value mapping — csvValue → our ID
  const [roleValueMap, setRoleValueMap] = useState<Record<string, string>>({});
  const [storeValueMap, setStoreValueMap] = useState<Record<string, string>>({});
  const [defaultRoleId, setDefaultRoleId] = useState<string>('');
  const [defaultStoreId, setDefaultStoreId] = useState<string>('');
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update'>('skip');

  // Step state
  const [step, setStep] = useState<Step>('upload');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BulkCreateUsersResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // DERIVED DATA
  // ============================================================================

  // Get the mapping for a specific target field
  const getMappingForTarget = (targetKey: string) =>
    columnMappings.find(m => m.targetField === targetKey);

  // Unique role/store values from the file
  const uniqueRoleValues = useMemo(() => {
    const roleMapping = getMappingForTarget('role_name');
    if (!roleMapping) return [];
    const values = new Set<string>();
    rawRows.forEach(row => {
      const val = row[roleMapping.sourceHeader]?.trim();
      if (val) values.add(val);
    });
    return Array.from(values).sort();
  }, [rawRows, columnMappings]);

  const uniqueStoreValues = useMemo(() => {
    const storeMapping = getMappingForTarget('store_name');
    if (!storeMapping) return [];
    const values = new Set<string>();
    rawRows.forEach(row => {
      const val = row[storeMapping.sourceHeader]?.trim();
      if (val) values.add(val);
    });
    return Array.from(values).sort();
  }, [rawRows, columnMappings]);

  // Build resolved rows for preview
  const resolvedRows = useMemo(() => {
    return rawRows.map((row, idx) => {
      const getValue = (targetKey: string): string => {
        const mapping = columnMappings.find(m => m.targetField === targetKey);
        if (!mapping) return '';
        return row[mapping.sourceHeader]?.trim() || '';
      };

      const rawEmail = getValue('email');
      const email = normalizeEmailValue(rawEmail);
      const rawDate = getValue('hire_date');
      const hireDate = normalizeDateValue(rawDate);
      const roleRaw = getValue('role_name');
      const storeRaw = getValue('store_name');
      const statusRaw = getValue('status');

      // Resolve role/store to IDs
      const roleId = roleRaw ? (roleValueMap[roleRaw] || '') : '';
      const storeId = storeRaw ? (storeValueMap[storeRaw] || '') : '';

      // Resolve role/store names for display
      const roleName = roleId ? roles.find(r => r.id === roleId)?.name : undefined;
      const storeName = storeId ? stores.find(s => s.id === storeId)?.name : undefined;

      // Determine if row is active (skip terminated/inactive from source)
      const statusLower = statusRaw.toLowerCase();
      const isTerminated = statusLower.includes('termin') || statusLower.includes('inactive') || statusLower.includes('separated');

      return {
        rowIndex: idx + 1,
        first_name: normalizeNameCase(getValue('first_name')),
        last_name: normalizeNameCase(getValue('last_name')),
        email: email || '',
        employee_id: getValue('employee_id'),
        phone: getValue('phone'),
        hire_date: hireDate || '',
        role_id: roleId,
        store_id: storeId,
        roleName: roleName || (roleRaw ? `(${roleRaw})` : ''),
        storeName: storeName || (storeRaw ? `(${storeRaw})` : ''),
        isTerminated,
        hasError: !normalizeNameCase(getValue('first_name')) || !normalizeNameCase(getValue('last_name')),
        rawDateInvalid: !!rawDate && !hireDate,
        rawEmailInvalid: !!rawEmail && !email
      };
    });
  }, [rawRows, columnMappings, roleValueMap, storeValueMap, roles, stores]);

  // Stats for preview
  const activeRows = resolvedRows.filter(r => !r.isTerminated);
  const readyRows = activeRows.filter(r => !r.hasError);
  const warningRows = activeRows.filter(r => !r.email);
  const errorRows = activeRows.filter(r => r.hasError);
  const skippedRows = resolvedRows.filter(r => r.isTerminated);

  // Check if first_name and last_name are mapped
  const hasRequiredMappings = columnMappings.some(m => m.targetField === 'first_name') &&
    columnMappings.some(m => m.targetField === 'last_name');

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const resetState = useCallback(() => {
    setFile(null);
    setHeaders([]);
    setRawRows([]);
    setColumnMappings([]);
    setRoleValueMap({});
    setStoreValueMap({});
    setDefaultRoleId('');
    setDefaultStoreId('');
    setDuplicateStrategy('skip');
    setStep('upload');
    setProgress(0);
    setResults(null);
    setError(null);
    // Clear the file input so re-uploading the same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Reset state when dialog is closed
  const handleClose = useCallback(() => {
    onClose();
    // Delay reset so the close animation finishes before state clears
    setTimeout(resetState, 200);
  }, [onClose, resetState]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setError(null);

    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      setError('Please select a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }

    try {
      let parsedHeaders: string[] = [];
      let parsedRows: Record<string, string>[] = [];

      if (ext === 'csv') {
        const text = await selectedFile.text();
        const result = parseCSV(text);
        parsedHeaders = result.headers;
        parsedRows = result.rows;
      } else {
        // Excel
        const buffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        // raw: false formats dates as strings instead of serial numbers
        const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: '' });

        if (data.length < 2) {
          setError('File appears to be empty or has no data rows.');
          return;
        }

        parsedHeaders = (data[0] as any[]).map(h => String(h ?? '').trim()).filter(Boolean);
        for (let i = 1; i < data.length; i++) {
          const values = data[i] as any[];
          if (!values || !values.some(v => v != null && v !== '')) continue;
          const row: Record<string, string> = {};
          parsedHeaders.forEach((header, idx) => {
            row[header] = String(values[idx] ?? '').trim();
          });
          parsedRows.push(row);
        }
      }

      if (parsedHeaders.length === 0) {
        setError('Could not find headers in the file.');
        return;
      }
      if (parsedRows.length === 0) {
        setError('File has headers but no data rows.');
        return;
      }

      setFile(selectedFile);
      setHeaders(parsedHeaders);
      setRawRows(parsedRows);

      // Auto-map columns
      const autoMappings = matchColumns(parsedHeaders);
      setColumnMappings(autoMappings);

      setStep('mapping');
    } catch (err) {
      setError('Failed to parse file. Please check the format and try again.');
      console.error('File parse error:', err);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  const updateMapping = (sourceHeader: string, newTargetKey: string) => {
    setColumnMappings(prev => {
      const updated = prev.map(m => {
        // If another column was mapped to this target, clear it
        if (m.targetField === newTargetKey && m.sourceHeader !== sourceHeader) {
          return { ...m, targetField: null, confidence: 0, matchType: 'none' as const };
        }
        // Update the selected column
        if (m.sourceHeader === sourceHeader) {
          if (newTargetKey === '__skip__') {
            return { ...m, targetField: null, confidence: 0, matchType: 'none' as const };
          }
          return { ...m, targetField: newTargetKey, confidence: 100, matchType: 'exact' as const };
        }
        return m;
      });
      return updated;
    });
  };

  // Auto-map role/store values when entering preview
  const initPreviewMappings = useCallback(() => {
    // Auto-map role values
    if (uniqueRoleValues.length > 0 && roles.length > 0) {
      const autoRoleMap: Record<string, string> = {};
      uniqueRoleValues.forEach(val => {
        const match = fuzzyMatchValue(val, roles.map(r => ({ id: r.id, name: r.name })));
        if (match) autoRoleMap[val] = match;
      });
      setRoleValueMap(autoRoleMap);
    }

    // Auto-map store values
    if (uniqueStoreValues.length > 0 && stores.length > 0) {
      const autoStoreMap: Record<string, string> = {};
      uniqueStoreValues.forEach(val => {
        const match = fuzzyMatchValue(val, stores.map(s => ({ id: s.id, name: s.name, code: s.code })));
        if (match) autoStoreMap[val] = match;
      });
      setStoreValueMap(autoStoreMap);
    }
  }, [uniqueRoleValues, uniqueStoreValues, roles, stores]);

  const handleGoToPreview = () => {
    initPreviewMappings();
    setStep('preview');
  };

  const handleImport = async () => {
    if (!orgId) {
      toast.error('No organization context available.');
      return;
    }

    setStep('importing');
    setProgress(0);

    try {
      const rowsToImport = readyRows.filter(r => !r.isTerminated).map(r => ({
        email: r.email || undefined,
        first_name: r.first_name,
        last_name: r.last_name,
        role_id: r.role_id || undefined,
        store_id: r.store_id || undefined,
        employee_id: r.employee_id || undefined,
        hire_date: r.hire_date || undefined,
        phone: r.phone || undefined,
      }));

      const importResult = await bulkCreateUsers({
        rows: rowsToImport,
        organization_id: orgId,
        defaultRoleId: defaultRoleId || undefined,
        defaultStoreId: defaultStoreId || undefined,
        duplicateStrategy,
        onProgress: (current, total) => setProgress(Math.round((current / total) * 100))
      });

      setResults(importResult);
      setStep('results');

      if (importResult.created > 0 && onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Import failed');
      setStep('preview');
    }
  };

  // ============================================================================
  // RENDER STEPS
  // ============================================================================

  const renderUploadStep = () => (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-all"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />
        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="font-semibold text-lg">Drop your employee file here</p>
        <p className="text-sm text-muted-foreground mt-1">
          or click to browse
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <Badge variant="secondary">.csv</Badge>
          <Badge variant="secondary">.xlsx</Badge>
          <Badge variant="secondary">.xls</Badge>
        </div>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        We'll auto-detect your columns.{' '}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
          className="underline hover:text-foreground transition-colors"
        >
          Need a template?
        </button>
      </p>
    </div>
  );

  const renderMappingStep = () => {
    // Get all currently assigned target fields
    const assignedTargets = new Set(columnMappings.filter(m => m.targetField).map(m => m.targetField!));

    // Separate mapped and unmapped columns
    const mappedCols = columnMappings.filter(m => m.targetField);
    const unmappedCols = columnMappings.filter(m => !m.targetField);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="font-medium">{file?.name}</span>
            <Badge variant="secondary">{rawRows.length} rows</Badge>
            <Badge variant="secondary">{headers.length} columns</Badge>
          </div>
        </div>

        <Separator />

        {/* Mapped columns */}
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground mb-2">Column Mapping</p>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[40%]">Your Column</TableHead>
                  <TableHead className="w-[15%] text-center">Match</TableHead>
                  <TableHead className="w-[45%]">Maps To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Mapped columns first */}
                {mappedCols.map((col) => (
                  <TableRow key={col.sourceHeader}>
                    <TableCell className="font-medium text-sm">{col.sourceHeader}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-xs ${getConfidenceColor(col.confidence)}`}>
                        {getConfidenceLabel(col.confidence)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={col.targetField || '__skip__'}
                        onValueChange={(v) => updateMapping(col.sourceHeader, v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__skip__">
                            <span className="text-muted-foreground">-- Skip --</span>
                          </SelectItem>
                          {FIELD_DEFINITIONS.map(f => (
                            <SelectItem
                              key={f.key}
                              value={f.key}
                              disabled={assignedTargets.has(f.key) && col.targetField !== f.key}
                            >
                              {f.label} {f.required ? '*' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Unmapped columns — dimmed */}
                {unmappedCols.map((col) => (
                  <TableRow key={col.sourceHeader} className="opacity-50">
                    <TableCell className="font-medium text-sm italic">{col.sourceHeader}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs bg-gray-50 text-gray-400 border-gray-200">
                        Skip
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value="__skip__"
                        onValueChange={(v) => updateMapping(col.sourceHeader, v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__skip__">
                            <span className="text-muted-foreground">-- Skip --</span>
                          </SelectItem>
                          {FIELD_DEFINITIONS.map(f => (
                            <SelectItem
                              key={f.key}
                              value={f.key}
                              disabled={assignedTargets.has(f.key)}
                            >
                              {f.label} {f.required ? '*' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Warnings */}
        {!hasRequiredMappings && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              First Name and Last Name must be mapped to continue.
            </AlertDescription>
          </Alert>
        )}

        {hasRequiredMappings && !getMappingForTarget('email') && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No email mapped — employees won't be able to log in until one is added.
            </AlertDescription>
          </Alert>
        )}

        {/* Sample data preview */}
        {hasRequiredMappings && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Preview (first 3 rows)</p>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    {columnMappings.filter(m => m.targetField).map(m => (
                      <TableHead key={m.sourceHeader} className="text-xs whitespace-nowrap">
                        {FIELD_DEFINITIONS.find(f => f.key === m.targetField)?.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rawRows.slice(0, 3).map((row, idx) => (
                    <TableRow key={idx}>
                      {columnMappings.filter(m => m.targetField).map(m => (
                        <TableCell key={m.sourceHeader} className="text-xs py-1.5">
                          {row[m.sourceHeader] || <span className="text-muted-foreground">--</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPreviewStep = () => {
    const previewData = resolvedRows.filter(r => !r.isTerminated).slice(0, 10);

    return (
      <div className="space-y-5">
        {/* Role Mapping Panel */}
        {uniqueRoleValues.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Role Mapping</p>
            <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
              {uniqueRoleValues.map(val => (
                <div key={val} className="flex items-center justify-between px-3 py-2 gap-3">
                  <span className="text-sm truncate flex-1 min-w-0">{val}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <Select
                    value={roleValueMap[val] || '__none__'}
                    onValueChange={(v) => setRoleValueMap(prev => ({ ...prev, [val]: v === '__none__' ? '' : v }))}
                  >
                    <SelectTrigger className="h-7 w-48 text-xs flex-shrink-0">
                      <SelectValue placeholder="Select role..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">-- Unmapped --</span>
                      </SelectItem>
                      {roles.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Store Mapping Panel */}
        {uniqueStoreValues.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Store Mapping</p>
            <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
              {uniqueStoreValues.map(val => (
                <div key={val} className="flex items-center justify-between px-3 py-2 gap-3">
                  <span className="text-sm truncate flex-1 min-w-0">{val}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <Select
                    value={storeValueMap[val] || '__none__'}
                    onValueChange={(v) => setStoreValueMap(prev => ({ ...prev, [val]: v === '__none__' ? '' : v }))}
                  >
                    <SelectTrigger className="h-7 w-48 text-xs flex-shrink-0">
                      <SelectValue placeholder="Select store..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">-- Unmapped --</span>
                      </SelectItem>
                      {stores.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Defaults & Options */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium">Default Role</p>
            <Select
              value={defaultRoleId || '__none__'}
              onValueChange={(v) => setDefaultRoleId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {roles.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium">Default Store</p>
            <Select
              value={defaultStoreId || '__none__'}
              onValueChange={(v) => setDefaultStoreId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {stores.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium">Duplicate Emails</p>
            <Select
              value={duplicateStrategy}
              onValueChange={(v) => setDuplicateStrategy(v as 'skip' | 'update')}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">Skip existing</SelectItem>
                <SelectItem value="update">Update existing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Summary badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-green-100 text-green-700 border-green-200">
            {readyRows.length} ready
          </Badge>
          {warningRows.length > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
              {warningRows.length} no email
            </Badge>
          )}
          {errorRows.length > 0 && (
            <Badge variant="destructive">
              {errorRows.length} missing name
            </Badge>
          )}
          {skippedRows.length > 0 && (
            <Badge variant="secondary">
              {skippedRows.length} terminated (skipped)
            </Badge>
          )}
        </div>

        {/* Preview table */}
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs w-8">#</TableHead>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs">Store</TableHead>
                <TableHead className="text-xs">Hire Date</TableHead>
                <TableHead className="text-xs">Emp ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewData.map((row) => (
                <TableRow key={row.rowIndex} className={row.hasError ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                  <TableCell className="text-xs text-muted-foreground">{row.rowIndex}</TableCell>
                  <TableCell className="text-xs font-medium">
                    {row.first_name} {row.last_name}
                    {row.hasError && <AlertTriangle className="h-3 w-3 text-red-500 inline ml-1" />}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.email || <span className="text-muted-foreground italic">none</span>}
                    {row.rawEmailInvalid && <AlertTriangle className="h-3 w-3 text-amber-500 inline ml-1" />}
                  </TableCell>
                  <TableCell className="text-xs">{row.roleName || <span className="text-muted-foreground">--</span>}</TableCell>
                  <TableCell className="text-xs">{row.storeName || <span className="text-muted-foreground">--</span>}</TableCell>
                  <TableCell className="text-xs">
                    {row.hire_date || <span className="text-muted-foreground">--</span>}
                    {row.rawDateInvalid && <AlertTriangle className="h-3 w-3 text-amber-500 inline ml-1" />}
                  </TableCell>
                  <TableCell className="text-xs">{row.employee_id || <span className="text-muted-foreground">--</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {activeRows.length > 10 && (
          <p className="text-xs text-muted-foreground text-center">
            ... and {activeRows.length - 10} more rows
          </p>
        )}
      </div>
    );
  };

  const renderImportingStep = () => (
    <div className="space-y-4 py-8">
      <div className="text-center">
        <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
        <p className="font-medium">Importing...</p>
      </div>
      <Progress value={progress} className="w-full" />
      <p className="text-center text-sm text-muted-foreground">{progress}% complete</p>
    </div>
  );

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
                  <p className="text-2xl font-bold">{results.created}</p>
                  <p className="text-sm text-muted-foreground">Created</p>
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
                  <p className="text-2xl font-bold">{results.updated + results.skipped}</p>
                  <p className="text-sm text-muted-foreground">
                    {results.updated > 0 ? 'Updated' : 'Skipped'}
                  </p>
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
        </div>

        {results.errors.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-red-500">Errors</p>
            <div className="max-h-40 overflow-auto border rounded-lg p-2 text-sm">
              {results.errors.slice(0, 15).map((err, idx) => (
                <div key={idx} className="text-red-600 py-1">
                  Row {err.row} ({err.name}): {err.error}
                </div>
              ))}
              {results.errors.length > 15 && (
                <p className="text-muted-foreground">... and {results.errors.length - 15} more errors</p>
              )}
            </div>
          </div>
        )}

        {results.created > 0 && (
          <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              {results.created} imported{results.updated > 0 ? `, ${results.updated} updated` : ''}{results.skipped > 0 ? `, ${results.skipped} skipped` : ''}.
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  // ============================================================================
  // FOOTER BUTTONS
  // ============================================================================

  const getFooterButtons = () => {
    switch (step) {
      case 'upload':
        return (
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
        );
      case 'mapping':
        return (
          <>
            <Button variant="outline" onClick={resetState}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Start Over
            </Button>
            <Button disabled={!hasRequiredMappings} onClick={handleGoToPreview}>
              <Eye className="h-4 w-4 mr-2" />
              Review & Import
            </Button>
          </>
        );
      case 'preview':
        return (
          <>
            <Button variant="outline" onClick={() => setStep('mapping')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleImport} disabled={readyRows.length === 0}>
              <Play className="h-4 w-4 mr-2" />
              Import {readyRows.length} employee{readyRows.length !== 1 ? 's' : ''}
            </Button>
          </>
        );
      case 'importing':
        return null;
      case 'results':
        return (
          <>
            <Button variant="outline" onClick={resetState}>Import More</Button>
            <Button onClick={handleClose}>Done</Button>
          </>
        );
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const stepDescriptions: Record<Step, string> = {
    upload: 'Any CSV or Excel file will work.',
    mapping: 'Review the column mapping below.',
    preview: 'Confirm roles, stores, and data before importing.',
    importing: 'Processing...',
    results: 'Import complete.'
  };

  const downloadTemplate = () => {
    const headers = 'First Name,Last Name,Email,Phone,Employee ID,Hire Date,Position,Store\n';
    const sample = 'Jane,Smith,jane@example.com,555-123-4567,EMP001,2024-01-15,Store Associate,Main Street\n';
    const blob = new Blob([headers + sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Employees
          </DialogTitle>
          <DialogDescription>
            {stepDescriptions[step]}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        {step !== 'importing' && step !== 'results' && (
          <div className="flex items-center gap-1 text-xs">
            {(['upload', 'mapping', 'preview'] as Step[]).map((s, i) => (
              <React.Fragment key={s}>
                {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                <Badge
                  variant={step === s ? 'default' : 'secondary'}
                  className={`text-xs ${step === s ? '' : 'opacity-50'}`}
                >
                  {s === 'upload' ? 'Upload' : s === 'mapping' ? 'Map Columns' : 'Review & Import'}
                </Badge>
              </React.Fragment>
            ))}
          </div>
        )}

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
