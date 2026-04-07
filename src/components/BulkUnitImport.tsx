import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { Card, CardContent } from './ui/card';
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
  RefreshCw,
  Play,
  Eye,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import {
  normalizeHeader,
  extractNumber,
  fuzzyMatchValue,
  getConfidenceColor,
  getConfidenceLabel,
  parseImportFile,
  ImportFileParseError,
  SKIP_VALUE,
} from '../lib/importMapping';
import { bulkCreateStores, type BulkCreateStoresResult } from '../lib/crud/stores';
import { useEffectiveOrgId, useDistricts } from '../lib/hooks/useSupabase';
import { toast } from 'sonner@2.0.3';

// ============================================================================
// TYPES
// ============================================================================

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'results';

interface BulkUnitImportProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface UnitTargetField {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
}

interface UnitColumnMatch {
  sourceHeader: string;
  targetField: string | null;
  confidence: number;
}

const UNIT_FIELDS: UnitTargetField[] = [
  {
    key: 'name',
    label: 'Unit Name',
    required: true,
    aliases: ['name', 'unitname', 'storename', 'location', 'locationname', 'sitename', 'site']
  },
  {
    key: 'unit_number',
    label: 'Unit Number',
    required: true,
    aliases: ['unitnumber', 'unitno', 'unit', 'storenumber', 'storeno', 'number', 'locationnumber', 'sitenumber', 'storecode']
  },
  {
    key: 'code',
    label: 'Code',
    required: false,
    aliases: ['code', 'storecode', 'unitcode', 'locationcode']
  },
  {
    key: 'district_name',
    label: 'District',
    required: false,
    aliases: ['district', 'districtname', 'region', 'area', 'zone', 'group']
  },
  {
    key: 'address',
    label: 'Address',
    required: false,
    aliases: ['address', 'streetaddress', 'street', 'addressline1']
  },
  {
    key: 'city',
    label: 'City',
    required: false,
    aliases: ['city', 'town']
  },
  {
    key: 'state',
    label: 'State',
    required: false,
    aliases: ['state', 'province', 'region']
  },
  {
    key: 'zip',
    label: 'Zip',
    required: false,
    aliases: ['zip', 'zipcode', 'postalcode', 'postal']
  },
  {
    key: 'phone',
    label: 'Phone',
    required: false,
    aliases: ['phone', 'phonenumber', 'storephone', 'telephone']
  }
];

// ============================================================================
// LOCAL HELPERS
// ============================================================================

function matchUnitColumns(headers: string[]): UnitColumnMatch[] {
  const used = new Set<string>();
  const matches: UnitColumnMatch[] = [];

  // First pass: exact matches on normalized header against any alias
  const headerNormMap = headers.map(h => ({ raw: h, norm: normalizeHeader(h) }));

  for (const { raw, norm } of headerNormMap) {
    let bestField: string | null = null;
    let bestConfidence = 0;

    for (const field of UNIT_FIELDS) {
      if (used.has(field.key)) continue;
      // exact match
      if (field.aliases.includes(norm)) {
        bestField = field.key;
        bestConfidence = 100;
        break;
      }
      // contains match
      if (field.aliases.some(a => norm.includes(a) || a.includes(norm))) {
        if (bestConfidence < 70) {
          bestField = field.key;
          bestConfidence = 70;
        }
      }
    }

    if (bestField) used.add(bestField);
    matches.push({ sourceHeader: raw, targetField: bestField, confidence: bestConfidence });
  }

  return matches;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BulkUnitImport({ open, onClose, onSuccess }: BulkUnitImportProps) {
  const { orgId } = useEffectiveOrgId();

  // Districts via shared hook
  const { districts } = useDistricts(orgId ?? undefined);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mapping
  const [columnMappings, setColumnMappings] = useState<UnitColumnMatch[]>([]);

  // Step state
  const [step, setStep] = useState<Step>('upload');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BulkCreateStoresResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // DERIVED
  // ============================================================================

  const getMappingForTarget = (key: string) =>
    columnMappings.find(m => m.targetField === key);

  const resolvedRows = useMemo(() => {
    return rawRows.map((row, idx) => {
      const getValue = (targetKey: string): string => {
        const mapping = getMappingForTarget(targetKey);
        if (!mapping) return '';
        return (row[mapping.sourceHeader] || '').trim();
      };

      const name = getValue('name');
      const parsedNum = extractNumber(getValue('unit_number'));
      const unit_number = parsedNum != null && parsedNum > 0 ? parsedNum : null;

      const districtRaw = getValue('district_name');
      let district_id: string | null = null;
      let districtMatchedName: string | null = null;
      if (districtRaw && districts.length > 0) {
        const matchedId = fuzzyMatchValue(districtRaw, districts.map(d => ({ id: d.id, name: d.name })));
        if (matchedId) {
          const matched = districts.find(d => d.id === matchedId);
          if (matched) {
            district_id = matched.id;
            districtMatchedName = matched.name;
          }
        }
      }

      const missingName = !name;
      const missingNumber = unit_number == null;

      return {
        rowIndex: idx + 1,
        name,
        unit_number,
        code: getValue('code'),
        district_id,
        districtRaw,
        districtMatchedName,
        address: getValue('address'),
        city: getValue('city'),
        state: getValue('state'),
        zip: getValue('zip'),
        phone: getValue('phone'),
        missingName,
        missingNumber,
        hasError: missingName || missingNumber
      };
    });
  }, [rawRows, columnMappings, districts]);

  const readyRows = resolvedRows.filter(r => !r.hasError);
  const errorRows = resolvedRows.filter(r => r.hasError);

  const hasRequiredMappings =
    columnMappings.some(m => m.targetField === 'name') &&
    columnMappings.some(m => m.targetField === 'unit_number');

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const resetState = useCallback(() => {
    setFile(null);
    setHeaders([]);
    setRawRows([]);
    setColumnMappings([]);
    setStep('upload');
    setProgress(0);
    setResults(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = useCallback(() => {
    onClose();
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = setTimeout(() => {
      resetState();
      resetTimeoutRef.current = null;
    }, 200);
  }, [onClose, resetState]);

  // Cancel any pending reset if the dialog reopens quickly
  useEffect(() => {
    if (open && resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, [open]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setError(null);

    try {
      const { headers: parsedHeaders, rows: parsedRows } = await parseImportFile(selectedFile);
      setFile(selectedFile);
      setHeaders(parsedHeaders);
      setRawRows(parsedRows);
      setColumnMappings(matchUnitColumns(parsedHeaders));
      setStep('mapping');
    } catch (err: any) {
      if (err instanceof ImportFileParseError) {
        setError(err.message);
      } else {
        setError('Failed to parse file. Please check the format and try again.');
        console.error('File parse error:', err);
      }
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect]
  );

  const updateMapping = (sourceHeader: string, newTargetKey: string) => {
    setColumnMappings(prev =>
      prev.map(m => {
        // Clear other columns mapped to this same target (no fallbacks for units)
        if (
          newTargetKey !== SKIP_VALUE &&
          m.targetField === newTargetKey &&
          m.sourceHeader !== sourceHeader
        ) {
          return { ...m, targetField: null, confidence: 0 };
        }
        if (m.sourceHeader === sourceHeader) {
          if (newTargetKey === SKIP_VALUE) {
            return { ...m, targetField: null, confidence: 0 };
          }
          return { ...m, targetField: newTargetKey, confidence: 100 };
        }
        return m;
      })
    );
  };

  const handleImport = async () => {
    if (!orgId) {
      toast.error('No organization context available.');
      return;
    }

    setStep('importing');
    setProgress(0);

    try {
      const rowsToImport = readyRows.map(r => ({
        name: r.name,
        unit_number: r.unit_number as number,
        code: r.code || undefined,
        district_id: r.district_id || undefined,
        address: r.address || undefined,
        city: r.city || undefined,
        state: r.state || undefined,
        zip: r.zip || undefined,
        phone: r.phone || undefined
      }));

      const result = await bulkCreateStores({
        rows: rowsToImport,
        organization_id: orgId,
        onProgress: (current, total) =>
          setProgress(Math.round((current / total) * 100))
      });

      setResults(result);
      setStep('results');

      if (result.created > 0 && onSuccess) onSuccess();
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
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />
        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="font-semibold text-lg">Drop your unit file here</p>
        <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <Badge variant="secondary">.csv</Badge>
          <Badge variant="secondary">.xlsx</Badge>
          <Badge variant="secondary">.xls</Badge>
        </div>
      </div>
    </div>
  );

  const renderMappingStep = () => {
    const targetCounts: Record<string, number> = {};
    columnMappings.forEach(m => {
      if (m.targetField)
        targetCounts[m.targetField] = (targetCounts[m.targetField] || 0) + 1;
    });

    const isTargetAvailable = (targetKey: string, currentCol: UnitColumnMatch) => {
      if (currentCol.targetField === targetKey) return true;
      return (targetCounts[targetKey] || 0) === 0;
    };

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
                {mappedCols.map(col => (
                  <TableRow key={col.sourceHeader}>
                    <TableCell className="font-medium text-sm">
                      {col.sourceHeader}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getConfidenceColor(col.confidence)}`}
                      >
                        {getConfidenceLabel(col.confidence)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={col.targetField || SKIP_VALUE}
                        onValueChange={v => updateMapping(col.sourceHeader, v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SKIP_VALUE}>
                            <span className="text-muted-foreground">-- Skip --</span>
                          </SelectItem>
                          {UNIT_FIELDS.map(f => (
                            <SelectItem
                              key={f.key}
                              value={f.key}
                              disabled={!isTargetAvailable(f.key, col)}
                            >
                              {f.label} {f.required ? '*' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
                {unmappedCols.map(col => (
                  <TableRow key={col.sourceHeader} className="opacity-50">
                    <TableCell className="font-medium text-sm italic">
                      {col.sourceHeader}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className="text-xs bg-gray-50 text-gray-400 border-gray-200"
                      >
                        Skip
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={SKIP_VALUE}
                        onValueChange={v => updateMapping(col.sourceHeader, v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SKIP_VALUE}>
                            <span className="text-muted-foreground">-- Skip --</span>
                          </SelectItem>
                          {UNIT_FIELDS.map(f => (
                            <SelectItem
                              key={f.key}
                              value={f.key}
                              disabled={!isTargetAvailable(f.key, col)}
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

        {!hasRequiredMappings && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {(() => {
                const missing = [];
                if (!columnMappings.some(m => m.targetField === 'name'))
                  missing.push('Unit Name');
                if (!columnMappings.some(m => m.targetField === 'unit_number'))
                  missing.push('Unit Number');
                return `Required: ${missing.join(', ')}`;
              })()}
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  const renderPreviewStep = () => {
    const previewData = resolvedRows.slice(0, 10);

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-green-100 text-green-700 border-green-200">
            {readyRows.length} ready
          </Badge>
          {errorRows.length > 0 && (
            <Badge variant="destructive">
              {errorRows.length} missing name or number
            </Badge>
          )}
        </div>

        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs w-8">#</TableHead>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Unit #</TableHead>
                <TableHead className="text-xs">Code</TableHead>
                <TableHead className="text-xs">District</TableHead>
                <TableHead className="text-xs">City</TableHead>
                <TableHead className="text-xs">State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewData.map(row => (
                <TableRow
                  key={row.rowIndex}
                  className={row.hasError ? 'bg-red-50 dark:bg-red-900/10' : ''}
                >
                  <TableCell className="text-xs text-muted-foreground">
                    {row.rowIndex}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {row.name || (
                      <span className="text-red-400 italic">missing</span>
                    )}
                    {row.missingName && (
                      <AlertTriangle className="h-3 w-3 text-red-500 inline ml-1" />
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.unit_number ?? (
                      <span className="text-red-400 italic">missing</span>
                    )}
                    {row.missingNumber && (
                      <AlertTriangle className="h-3 w-3 text-red-500 inline ml-1" />
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.code || (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.districtMatchedName ? (
                      row.districtMatchedName
                    ) : row.districtRaw ? (
                      <span className="text-amber-600">({row.districtRaw})</span>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.city || (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.state || (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {resolvedRows.length > 10 && (
          <p className="text-xs text-muted-foreground text-center">
            ... and {resolvedRows.length - 10} more rows
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
      <p className="text-center text-sm text-muted-foreground">
        {progress}% complete
      </p>
    </div>
  );

  const renderResultsStep = () => {
    if (!results) return null;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
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
                  Row {err.row + 1} ({err.name || 'unnamed'}): {err.error}
                </div>
              ))}
              {results.errors.length > 15 && (
                <p className="text-muted-foreground">
                  ... and {results.errors.length - 15} more errors
                </p>
              )}
            </div>
          </div>
        )}

        {results.created > 0 && (
          <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              {results.created} unit{results.created !== 1 ? 's' : ''} imported.
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
        return <Button variant="outline" onClick={handleClose}>Cancel</Button>;
      case 'mapping':
        return (
          <>
            <Button variant="outline" onClick={resetState}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Start Over
            </Button>
            <Button
              disabled={!hasRequiredMappings}
              onClick={() => setStep('preview')}
            >
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
              Import {readyRows.length} unit{readyRows.length !== 1 ? 's' : ''}
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
    preview: 'Confirm and import.',
    importing: 'Importing...',
    results: 'Import complete.'
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" role="dialog" aria-labelledby="unit-import-title">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-background">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <div>
            <h2 id="unit-import-title" className="text-lg font-semibold">Import Units</h2>
            {file && step !== 'upload' && (
              <p className="text-xs text-muted-foreground">{file.name} · {rawRows.length} rows</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {step !== 'importing' && step !== 'results' && (
            <div className="flex items-center gap-1 text-xs">
              {(['upload', 'mapping', 'preview'] as Step[]).map((s, i) => (
                <React.Fragment key={s}>
                  {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                  <Badge
                    variant={step === s ? 'default' : 'secondary'}
                    className={`text-xs ${step === s ? '' : 'opacity-50'}`}
                  >
                    {s === 'upload' ? 'Upload' : s === 'mapping' ? 'Map' : 'Review'}
                  </Badge>
                </React.Fragment>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Step description */}
      <div className="px-6 py-2 border-b bg-muted/20">
        <p className="text-xs text-muted-foreground">{stepDescriptions[step]}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-4">
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
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-6 py-3 border-t bg-background">
        {getFooterButtons()}
      </div>
    </div>
  );
}
