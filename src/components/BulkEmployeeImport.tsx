// ============================================================================
// BULK EMPLOYEE IMPORT — FULLSCREEN, SMART MATCHING WITH CREATE-IF-NOT-FOUND
// ============================================================================
// A flexible multi-step employee import flow that:
//   1. Accepts any CSV/Excel file from any HRIS
//   2. Auto-detects column mappings with confidence scoring
//   3. Resolves roles & stores with fuzzy matching + inline create-new
//   4. Validates email/mobile phone with libphonenumber-js
//   5. Lets admin edit any cell inline before committing
//   6. Batches pending role/store creates and fires the real import
// ============================================================================

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
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
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Play,
  Eye,
  Sparkles
} from 'lucide-react';
import {
  matchColumns,
  parseImportFile,
  ImportFileParseError,
  parseName,
  normalizeDateValue,
  normalizeEmailValue,
  validatePhone,
  formatPhoneDisplay,
  normalizeNameCase,
  normalizeEmploymentType,
  extractNumber,
  getConfidenceColor,
  getConfidenceLabel,
  fuzzyMatchValue,
  fuzzyMatchRole,
  FIELD_DEFINITIONS,
  FALLBACK_FIELDS,
  SKIP_VALUE,
  type ColumnMatch
} from '../lib/importMapping';
import { bulkCreateUsers, type BulkCreateUsersResult } from '../lib/crud/users';
import { bulkCreateStores } from '../lib/crud/stores';
import { bulkCreateRoles } from '../lib/api/roles';
import { useRoles, useStores, useEffectiveOrgId } from '../lib/hooks/useSupabase';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner@2.0.3';
import { EditableImportTable, type ColumnDef, type RowData, type CellStatus } from './EditableImportTable';

// ============================================================================
// TYPES
// ============================================================================

type Step = 'upload' | 'mapping' | 'review' | 'importing' | 'results';

interface BulkEmployeeImportProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Track pending role/store creations that will be flushed at import time
interface PendingCreate {
  rawValue: string;    // the exact CSV value (used to match rows)
  displayName: string; // what we'll create in DB
}

// Normalize a CSV value for pending-create deduplication.
// "Store 47", "store 47", "STORE  47" all collapse to the same key.
function normalizePendingKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ----------------------------------------------------------------------------
// Mapping preference persistence (localStorage)
// ----------------------------------------------------------------------------
// Build a stable fingerprint of a header set so the same HRIS export
// (regardless of column order) maps to the same saved preference.
function headersFingerprint(headers: string[]): string {
  return headers
    .map(h => h.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('|');
}

const STORAGE_KEY_PREFIX = 'trike:employee-import-mapping';
const getStorageKey = (orgId: string, fingerprint: string) =>
  `${STORAGE_KEY_PREFIX}:${orgId}:${fingerprint}`;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BulkEmployeeImport({ open, onClose, onSuccess }: BulkEmployeeImportProps) {
  const { orgId } = useEffectiveOrgId();
  const { roles, refetch: refetchRoles } = useRoles(orgId ?? undefined);
  const { stores, refetch: refetchStores } = useStores(orgId ? { organization_id: orgId } : undefined);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column mapping
  const [columnMappings, setColumnMappings] = useState<ColumnMatch[]>([]);
  // True when the current columnMappings were restored from a saved preference
  const [mappingFromCache, setMappingFromCache] = useState(false);

  // Per-row cell overrides from the editable table
  // Shape: { [rowIndex]: { [targetKey]: overrideValue } }
  const [rowOverrides, setRowOverrides] = useState<Record<string, Record<string, string>>>({});

  // Per-row resolved lookup IDs from user selection / auto-match
  // Shape: { [rowIndex]: { role_name?: string (role_id), store_name?: string (store_id) } }
  const [rowResolvedIds, setRowResolvedIds] = useState<Record<string, Record<string, string>>>({});

  // Pending creates — keyed by CSV raw value, deduped
  const [pendingStoreCreates, setPendingStoreCreates] = useState<Record<string, PendingCreate>>({});
  const [pendingRoleCreates, setPendingRoleCreates] = useState<Record<string, PendingCreate>>({});

  // Filter for the table
  const [tableFilter, setTableFilter] = useState<'all' | 'issues' | 'ready'>('all');

  // Duplicate handling
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update'>('skip');
  const [existingEmails, setExistingEmails] = useState<Set<string>>(new Set());

  // Step state
  const [step, setStep] = useState<Step>('upload');
  const [progress, setProgress] = useState(0);
  const [importingMessage, setImportingMessage] = useState('Importing...');
  const [results, setResults] = useState<BulkCreateUsersResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // HELPERS
  // ============================================================================

  // Lookup table: targetField -> source headers (sorted by priority).
  // Built once per columnMappings change so resolvedRows doesn't filter+sort per row.
  const targetToHeaders = useMemo(() => {
    const map = new Map<string, string[]>();
    [...columnMappings]
      .filter(m => m.targetField)
      .sort((a, b) => a.priority - b.priority)
      .forEach(m => {
        const list = map.get(m.targetField!) || [];
        list.push(m.sourceHeader);
        map.set(m.targetField!, list);
      });
    return map;
  }, [columnMappings]);

  // Get raw CSV value for a (rawRow, targetKey) — honors fallbacks for email
  const getRawValue = useCallback((row: Record<string, string>, targetKey: string): string => {
    const headers = targetToHeaders.get(targetKey);
    if (!headers) return '';
    for (const h of headers) {
      const v = row[h]?.trim();
      if (v) return v;
    }
    return '';
  }, [targetToHeaders]);

  // ============================================================================
  // DERIVED — unique role/store values and store/role candidate lists
  // ============================================================================

  const storeCandidates = useMemo(() => {
    return stores.map(s => ({
      id: s.id,
      name: s.name,
      code: s.code,
      unit_number: s.unit_number ?? null,
      subtitle: [s.code ? `Code: ${s.code}` : null, s.unit_number != null ? `Unit #${s.unit_number}` : null].filter(Boolean).join(' · ') || undefined
    }));
  }, [stores]);

  const roleCandidates = useMemo(() => {
    return roles.map(r => ({ id: r.id, name: r.name }));
  }, [roles]);

  // ============================================================================
  // RESOLVED ROWS — the source of truth for table display & import
  // ============================================================================

  const resolvedRows = useMemo(() => {
    return rawRows.map((row, idx) => {
      // Helper scoped to this row
      const eff = (targetKey: string) => {
        const override = rowOverrides[idx]?.[targetKey];
        if (override !== undefined) return override;
        return getRawValue(row, targetKey);
      };

      // ---------- Name resolution ----------
      // Priority:
      //   1. If first_name + last_name are both mapped and populated, use them directly.
      //   2. If first_name is mapped but last_name is empty AND first_name contains a space,
      //      auto-split (handles HRIS quirks where full name landed in the first column).
      //   3. If full_name is mapped, parse it via parseName().
      let firstName = '';
      let lastName = '';
      const firstRaw = eff('first_name');
      const lastRaw = eff('last_name');
      if (firstRaw || lastRaw) {
        firstName = normalizeNameCase(firstRaw);
        lastName = normalizeNameCase(lastRaw);
        // Auto-split: first_name contains the whole name, last_name is empty
        if (firstName && !lastName && /\s/.test(firstName)) {
          const parsed = parseName(firstName);
          firstName = parsed.first;
          lastName = parsed.last;
        }
      } else {
        const fullRaw = eff('full_name');
        if (fullRaw) {
          const parsed = parseName(fullRaw);
          firstName = normalizeNameCase(parsed.first);
          lastName = normalizeNameCase(parsed.last);
        }
      }

      // ---------- Email ----------
      const emailRaw = eff('email');
      const email = normalizeEmailValue(emailRaw);

      // ---------- Mobile phone ----------
      const mobileRaw = eff('mobile_phone');
      const phoneResult = validatePhone(mobileRaw);
      const isLandline = phoneResult.valid && !phoneResult.isMobile;

      // ---------- Other fields ----------
      const employeeId = eff('employee_id');
      const hireRaw = eff('hire_date');
      const hireDate = normalizeDateValue(hireRaw);
      const employmentTypeRaw = eff('employment_type');
      const employmentType = normalizeEmploymentType(employmentTypeRaw);
      const statusRaw = eff('status');
      const statusLower = statusRaw.toLowerCase();
      const isTerminated = statusLower.includes('termin') || statusLower.includes('inactive') || statusLower.includes('separated');

      // ---------- Role & Store lookup values ----------
      const roleRaw = eff('role_name');
      const storeRaw = eff('store_name');

      // Auto-match if not yet resolved by user
      let roleId = rowResolvedIds[idx]?.role_name ?? '';
      let storeId = rowResolvedIds[idx]?.store_name ?? '';

      // Pending creates take precedence — these will be created at import time
      // Use normalized keys so "Store 47" and "store 47" map to the same pending create
      const rolePending = roleRaw ? pendingRoleCreates[normalizePendingKey(roleRaw)] : undefined;
      const storePending = storeRaw ? pendingStoreCreates[normalizePendingKey(storeRaw)] : undefined;

      if (!roleId && !rolePending && roleRaw) {
        const match = fuzzyMatchRole(roleRaw, roleCandidates);
        if (match) roleId = match;
      }
      if (!storeId && !storePending && storeRaw) {
        const match = fuzzyMatchValue(storeRaw, storeCandidates);
        if (match) storeId = match;
      }

      // ---------- Validation ----------
      const missingName = !firstName || !lastName;
      const missingEmail = !email;
      const missingMobile = !phoneResult.e164;
      const roleUnresolved = !!roleRaw && !roleId && !rolePending;
      const storeUnresolved = !!storeRaw && !storeId && !storePending;

      const hasError = missingName || missingEmail || missingMobile;
      const hasWarning = !hasError && (roleUnresolved || storeUnresolved || isLandline);

      const rowStatus: 'ready' | 'warning' | 'error' | 'skipped' =
        isTerminated ? 'skipped'
          : hasError ? 'error'
          : hasWarning ? 'warning'
          : 'ready';

      return {
        rowIndex: idx,
        first_name: firstName,
        last_name: lastName,
        email: email || '',
        mobile_phone: phoneResult.e164 || '',
        mobile_phone_display: phoneResult.formatted || mobileRaw,
        mobile_phone_valid: phoneResult.valid,
        isLandline,
        employee_id: employeeId,
        hire_date: hireDate || '',
        hire_date_raw: hireRaw,
        employment_type: employmentType || '',
        role_id: roleId,
        store_id: storeId,
        roleRaw,
        storeRaw,
        rolePending: !!rolePending,
        storePending: !!storePending,
        isTerminated,
        rowStatus,
        missingName,
        missingEmail,
        missingMobile,
        roleUnresolved,
        storeUnresolved,
        rawEmailInvalid: !!emailRaw && !email,
        rawMobileInvalid: !!mobileRaw && !phoneResult.valid,
        rawDateInvalid: !!hireRaw && !hireDate,
      };
    });
  }, [rawRows, columnMappings, rowOverrides, rowResolvedIds, roleCandidates, storeCandidates, pendingStoreCreates, pendingRoleCreates, getRawValue]);

  // ============================================================================
  // STATS
  // ============================================================================

  const activeRows = resolvedRows.filter(r => !r.isTerminated);
  const readyRows = activeRows.filter(r => r.rowStatus === 'ready');
  const warningRows = activeRows.filter(r => r.rowStatus === 'warning');
  const errorRows = activeRows.filter(r => r.rowStatus === 'error');

  // Compute "active" pending creates — only those actually referenced by an importable row.
  // This filters out orphans (e.g. user clicked "Create new" then changed their mind).
  const activePendingStores = useMemo(() => {
    const used = new Set<string>();
    activeRows.forEach(r => {
      if (r.storePending && r.storeRaw) used.add(normalizePendingKey(r.storeRaw));
    });
    return Object.fromEntries(Object.entries(pendingStoreCreates).filter(([k]) => used.has(k)));
  }, [activeRows, pendingStoreCreates]);

  const activePendingRoles = useMemo(() => {
    const used = new Set<string>();
    activeRows.forEach(r => {
      if (r.rolePending && r.roleRaw) used.add(normalizePendingKey(r.roleRaw));
    });
    return Object.fromEntries(Object.entries(pendingRoleCreates).filter(([k]) => used.has(k)));
  }, [activeRows, pendingRoleCreates]);

  // Count rows whose email already exists in the org (preview of duplicate strategy effect)
  const duplicateEmailCount = useMemo(() => {
    if (existingEmails.size === 0) return 0;
    return activeRows.filter(r => r.email && existingEmails.has(r.email)).length;
  }, [activeRows, existingEmails]);
  const skippedRows = resolvedRows.filter(r => r.isTerminated);
  const stats = {
    total: resolvedRows.length,
    ready: readyRows.length,
    warnings: warningRows.length,
    errors: errorRows.length
  };

  // Check if required mappings are present — needs either (first+last) or full_name, plus email and mobile
  const hasRequiredMappings =
    (
      (columnMappings.some(m => m.targetField === 'first_name') && columnMappings.some(m => m.targetField === 'last_name'))
      || columnMappings.some(m => m.targetField === 'full_name')
    )
    && columnMappings.some(m => m.targetField === 'email')
    && columnMappings.some(m => m.targetField === 'mobile_phone');

  // Heuristic: if a `first_name` column is mapped but no `last_name` is mapped,
  // and the majority of sample values contain a space, the column probably
  // holds the full name. Surface a one-click suggestion in MappingStep.
  const firstNameLooksLikeFullName = useMemo(() => {
    const firstNameMapping = columnMappings.find(m => m.targetField === 'first_name');
    if (!firstNameMapping) return false;
    const hasLastName = columnMappings.some(m => m.targetField === 'last_name');
    if (hasLastName) return false;
    const sample = rawRows.slice(0, 10);
    if (sample.length === 0) return false;
    const withSpace = sample.filter(row => {
      const val = row[firstNameMapping.sourceHeader]?.trim() || '';
      return val.includes(' ');
    }).length;
    return withSpace / sample.length >= 0.6;
  }, [columnMappings, rawRows]);

  const handleConvertToFullName = useCallback(() => {
    setColumnMappings(prev => prev.map(m =>
      m.targetField === 'first_name'
        ? { ...m, targetField: 'full_name', priority: 1 }
        : m
    ));
  }, []);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const resetState = useCallback(() => {
    setFile(null);
    setHeaders([]);
    setRawRows([]);
    setColumnMappings([]);
    setMappingFromCache(false);
    setRowOverrides({});
    setRowResolvedIds({});
    setPendingStoreCreates({});
    setPendingRoleCreates({});
    setTableFilter('all');
    setDuplicateStrategy('skip');
    setStep('upload');
    setProgress(0);
    setImportingMessage('Importing...');
    setResults(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = useCallback(() => {
    onClose();
    // Defer reset so the close animation finishes before state clears
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = setTimeout(() => {
      resetState();
      resetTimeoutRef.current = null;
    }, 200);
  }, [onClose, resetState]);

  // Cancel any pending reset if the dialog is reopened quickly
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

      // Auto-detect mappings, then merge any saved preference for this header set on top.
      const autoMappings = matchColumns(parsedHeaders);
      let finalMappings = autoMappings;
      let restored = false;
      if (orgId) {
        try {
          const fp = headersFingerprint(parsedHeaders);
          const saved = localStorage.getItem(getStorageKey(orgId, fp));
          if (saved) {
            const parsed: Array<{ source: string; target: string; priority: number }> = JSON.parse(saved);
            const savedMap = new Map(parsed.map(p => [p.source, { target: p.target, priority: p.priority }]));
            finalMappings = autoMappings.map(m => {
              const override = savedMap.get(m.sourceHeader);
              if (override) {
                return { ...m, targetField: override.target, confidence: 100, matchType: 'exact' as const, priority: override.priority };
              }
              return m;
            });
            restored = true;
          }
        } catch (err) {
          console.warn('Failed to load mapping preference:', err);
        }
      }
      setColumnMappings(finalMappings);
      setMappingFromCache(restored);
      setStep('mapping');
    } catch (err: any) {
      if (err instanceof ImportFileParseError) {
        setError(err.message);
      } else {
        setError('Failed to parse file. Please check the format and try again.');
        console.error('File parse error:', err);
      }
    }
  }, [orgId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  const updateMapping = (sourceHeader: string, newTargetKey: string) => {
    setColumnMappings(prev => {
      const isFallbackEligible = FALLBACK_FIELDS.has(newTargetKey);
      const existingCount = prev.filter(m => m.targetField === newTargetKey && m.sourceHeader !== sourceHeader).length;

      const updated = prev.map(m => {
        if (!isFallbackEligible && m.targetField === newTargetKey && m.sourceHeader !== sourceHeader) {
          return { ...m, targetField: null, confidence: 0, matchType: 'none' as const, priority: 1 };
        }
        if (isFallbackEligible && m.targetField === newTargetKey && m.sourceHeader !== sourceHeader && existingCount >= 2) {
          if (m.priority === 2) {
            return { ...m, targetField: null, confidence: 0, matchType: 'none' as const, priority: 1 };
          }
        }
        if (m.sourceHeader === sourceHeader) {
          if (newTargetKey === SKIP_VALUE) {
            return { ...m, targetField: null, confidence: 0, matchType: 'none' as const, priority: 1 };
          }
          const priority = (isFallbackEligible && existingCount > 0) ? 2 : 1;
          return { ...m, targetField: newTargetKey, confidence: 100, matchType: 'exact' as const, priority };
        }
        return m;
      });
      return updated;
    });
  };

  const handleGoToReview = async () => {
    // Persist this mapping for next time the same headers are imported
    if (orgId && headers.length > 0) {
      try {
        const fp = headersFingerprint(headers);
        const key = getStorageKey(orgId, fp);
        const toSave = columnMappings
          .filter(m => m.targetField)
          .map(m => ({ source: m.sourceHeader, target: m.targetField as string, priority: m.priority }));
        localStorage.setItem(key, JSON.stringify(toSave));
      } catch (err) {
        // localStorage full or unavailable — silently fail
        console.warn('Failed to save mapping preference:', err);
      }
    }
    // Pre-fetch existing emails so the table can flag duplicates live
    if (orgId) {
      try {
        const { data } = await supabase
          .from('users')
          .select('email')
          .eq('organization_id', orgId)
          .not('email', 'is', null);
        if (data) {
          setExistingEmails(new Set(data.map(u => (u.email as string).toLowerCase()).filter(Boolean)));
        }
      } catch (err) {
        console.error('Failed to pre-fetch existing emails:', err);
      }
    }
    setStep('review');
  };

  // ============================================================================
  // EDITABLE TABLE WIRING
  // ============================================================================

  // Map targetKey → column.key for the editable table
  const tableColumns = useMemo<ColumnDef[]>(() => {
    const cols: ColumnDef[] = [
      { key: 'first_name', label: 'First Name', type: 'text', required: true, width: '120px' },
      { key: 'last_name', label: 'Last Name', type: 'text', required: true, width: '120px' },
      { key: 'email', label: 'Email', type: 'email', required: true, width: '200px' },
      { key: 'mobile_phone', label: 'Mobile', type: 'phone', required: true, width: '140px' },
      { key: 'role_name', label: 'Role', type: 'lookup', width: '180px',
        lookupOptions: roleCandidates,
        allowCreate: true,
        onCreateRequest: (newValue) => {
          const key = normalizePendingKey(newValue);
          if (!key) return;
          setPendingRoleCreates(prev => prev[key] ? prev : ({ ...prev, [key]: { rawValue: newValue, displayName: newValue.trim() } }));
        }
      },
      { key: 'store_name', label: 'Unit / Store', type: 'lookup', width: '220px',
        lookupOptions: storeCandidates,
        allowCreate: true,
        onCreateRequest: (newValue) => {
          const key = normalizePendingKey(newValue);
          if (!key) return;
          setPendingStoreCreates(prev => prev[key] ? prev : ({ ...prev, [key]: { rawValue: newValue, displayName: newValue.trim() } }));
        }
      },
      { key: 'hire_date', label: 'Hire Date', type: 'date', width: '130px' },
      { key: 'employee_id', label: 'Emp ID', type: 'text', width: '100px' },
      { key: 'employment_type', label: 'Type', type: 'text', width: '90px' },
    ];
    return cols;
  }, [roleCandidates, storeCandidates]);

  const tableRows = useMemo<RowData[]>(() => {
    return resolvedRows.map(r => {
      const cellStatus: Record<string, CellStatus> = {};
      const cellMessages: Record<string, string> = {};

      // First / Last
      if (!r.first_name) cellStatus.first_name = 'error';
      if (!r.last_name) cellStatus.last_name = 'error';

      // Email
      if (!r.email) cellStatus.email = 'error';
      else if (r.rawEmailInvalid) { cellStatus.email = 'warning'; cellMessages.email = 'Invalid format'; }
      else if (existingEmails.has(r.email)) {
        // Already exists in this org — preview the duplicate strategy effect
        cellStatus.email = 'warning';
        cellMessages.email = duplicateStrategy === 'skip' ? 'Already exists — will skip' : 'Already exists — will update';
      }

      // Mobile
      if (!r.mobile_phone) {
        cellStatus.mobile_phone = 'error';
        if (r.rawMobileInvalid) cellMessages.mobile_phone = 'Invalid number';
      } else if (r.isLandline) {
        cellStatus.mobile_phone = 'warning';
        cellMessages.mobile_phone = 'possible landline';
      }

      // Role
      if (r.rolePending) cellStatus.role_name = 'pending_create';
      else if (r.roleUnresolved) cellStatus.role_name = 'warning';

      // Store
      if (r.storePending) cellStatus.store_name = 'pending_create';
      else if (r.storeUnresolved) cellStatus.store_name = 'warning';

      // Hire date
      if (r.rawDateInvalid) { cellStatus.hire_date = 'warning'; cellMessages.hire_date = 'Unparseable date'; }

      return {
        id: String(r.rowIndex),
        values: {
          first_name: r.first_name,
          last_name: r.last_name,
          email: r.email,
          mobile_phone: r.mobile_phone ? r.mobile_phone_display : '',
          role_name: r.roleRaw,
          store_name: r.storeRaw,
          hire_date: r.hire_date,
          employee_id: r.employee_id,
          employment_type: r.employment_type,
        },
        resolvedIds: {
          role_name: r.role_id,
          store_name: r.store_id,
        },
        cellStatus,
        cellMessages,
        rowStatus: r.rowStatus,
        rowMessage: r.isTerminated ? 'Terminated — will be skipped' : undefined,
      };
    });
  }, [resolvedRows, existingEmails, duplicateStrategy]);

  const handleCellChange = useCallback((rowId: string, columnKey: string, newValue: string) => {
    const rowIdx = parseInt(rowId, 10);
    if (isNaN(rowIdx)) return;
    setRowOverrides(prev => ({
      ...prev,
      [rowIdx]: { ...(prev[rowIdx] || {}), [columnKey]: newValue }
    }));
  }, []);

  const handleResolveLookup = useCallback((rowId: string, columnKey: string, resolvedId: string) => {
    const rowIdx = parseInt(rowId, 10);
    if (isNaN(rowIdx)) return;
    setRowResolvedIds(prev => ({
      ...prev,
      [rowIdx]: { ...(prev[rowIdx] || {}), [columnKey]: resolvedId }
    }));
  }, []);

  // ============================================================================
  // IMPORT
  // ============================================================================

  const handleImport = async () => {
    if (!orgId) {
      toast.error('No organization context available.');
      return;
    }

    setStep('importing');
    setProgress(0);
    setError(null);

    try {
      // Importable rows = ready + warning (but NOT error/terminated).
      // Warning rows (landlines, etc.) are still valid — they just had soft flags.
      const importableRows = resolvedRows.filter(r => !r.isTerminated && r.rowStatus !== 'error');

      // Only create pending stores/roles that are actually referenced by importable rows
      // (filters out orphans from admin's prior "Create new" clicks they later reverted)
      const newStoreEntries = Object.entries(activePendingStores);
      const newRoleEntries = Object.entries(activePendingRoles);

      const createdStoreByKey: Record<string, string> = {};
      const failedStoreByKey: Record<string, string> = {};
      const createdRoleByKey: Record<string, string> = {};
      const failedRoleByKey: Record<string, string> = {};

      // ========== Phase 1: create pending stores + roles in parallel ==========
      if (newStoreEntries.length > 0 || newRoleEntries.length > 0) {
        const parts: string[] = [];
        if (newStoreEntries.length > 0) parts.push(`${newStoreEntries.length} new unit${newStoreEntries.length !== 1 ? 's' : ''}`);
        if (newRoleEntries.length > 0) parts.push(`${newRoleEntries.length} new role${newRoleEntries.length !== 1 ? 's' : ''}`);
        setImportingMessage(`Creating ${parts.join(' and ')}...`);

        const [storeResult, roleResult] = await Promise.all([
          newStoreEntries.length > 0
            ? bulkCreateStores({
                rows: newStoreEntries.map(([, s]) => ({
                  name: s.displayName,
                  unit_number: extractNumber(s.displayName) ?? undefined,
                })),
                organization_id: orgId,
              })
            : Promise.resolve(null),
          newRoleEntries.length > 0
            ? bulkCreateRoles({
                rows: newRoleEntries.map(([, r]) => ({ name: r.displayName })),
                organization_id: orgId,
              })
            : Promise.resolve(null),
        ]);

        if (storeResult) {
          storeResult.createdStores.forEach(created => {
            const entry = newStoreEntries[created.input_index];
            if (entry) createdStoreByKey[entry[0]] = created.id;
          });
          storeResult.errors.forEach(err => {
            const entry = newStoreEntries[err.row];
            if (entry) failedStoreByKey[entry[0]] = err.error;
          });
          if (storeResult.failed > 0) {
            toast.error(`Failed to create ${storeResult.failed} unit${storeResult.failed !== 1 ? 's' : ''}`);
          }
        }

        if (roleResult) {
          roleResult.createdRoles.forEach(created => {
            const entry = newRoleEntries[created.input_index];
            if (entry) createdRoleByKey[entry[0]] = created.id;
          });
          roleResult.errors.forEach(err => {
            const entry = newRoleEntries[err.row];
            if (entry) failedRoleByKey[entry[0]] = err.error;
          });
          if (roleResult.failed > 0) {
            toast.error(`Failed to create ${roleResult.failed} role${roleResult.failed !== 1 ? 's' : ''}`);
          }
        }
        setProgress(40);
      }

      // ========== Step 3: Import users ==========
      setImportingMessage('Importing employees...');
      const importErrors: Array<{ row: number; name: string; error: string }> = [];
      const rowsToImport = importableRows.map(r => {
        const storeKey = r.storeRaw ? normalizePendingKey(r.storeRaw) : '';
        const roleKey = r.roleRaw ? normalizePendingKey(r.roleRaw) : '';

        // Resolve final IDs:
        // 1) Already-resolved ID (existing DB record, picked from dropdown or fuzzy matched)
        // 2) Newly-created ID from this batch
        // Note: if a pending create FAILED, the row proceeds without a store/role assigned
        // rather than silently using an old/wrong ID.
        const finalStoreId = r.store_id || createdStoreByKey[storeKey] || undefined;
        const finalRoleId = r.role_id || createdRoleByKey[roleKey] || undefined;

        // Surface warnings for failed pending creates so admins see them in the results screen
        if (r.storePending && storeKey && !finalStoreId && failedStoreByKey[storeKey]) {
          importErrors.push({
            row: r.rowIndex + 1,
            name: `${r.first_name} ${r.last_name}`,
            error: `Unit "${r.storeRaw}" creation failed: ${failedStoreByKey[storeKey]} — imported without unit`
          });
        }
        if (r.rolePending && roleKey && !finalRoleId && failedRoleByKey[roleKey]) {
          importErrors.push({
            row: r.rowIndex + 1,
            name: `${r.first_name} ${r.last_name}`,
            error: `Role "${r.roleRaw}" creation failed: ${failedRoleByKey[roleKey]} — imported without role`
          });
        }

        return {
          email: r.email || undefined,
          first_name: r.first_name,
          last_name: r.last_name,
          role_id: finalRoleId,
          store_id: finalStoreId,
          employee_id: r.employee_id || undefined,
          hire_date: r.hire_date || undefined,
          mobile_phone: r.mobile_phone || undefined,
        };
      });

      const hadPendingCreates = newStoreEntries.length > 0 || newRoleEntries.length > 0;
      const importResult = await bulkCreateUsers({
        rows: rowsToImport,
        organization_id: orgId,
        duplicateStrategy,
        onProgress: (current, total) => {
          const base = hadPendingCreates ? 40 : 0;
          const span = 100 - base;
          setProgress(base + Math.round((current / total) * span));
        }
      });

      // Merge pre-insert errors (e.g., failed pending creates) into the final results
      const mergedResult: BulkCreateUsersResult = {
        ...importResult,
        errors: [...importErrors, ...importResult.errors]
      };
      setResults(mergedResult);
      setStep('results');

      if (mergedResult.created > 0) {
        if (onSuccess) onSuccess();
      }

      // Refetch so the next open shows new stores/roles
      if (newStoreEntries.length > 0) refetchStores();
      if (newRoleEntries.length > 0) refetchRoles();

    } catch (err: any) {
      console.error('Import failed:', err);
      setError(err.message || 'Import failed');
      setStep('review');
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" role="dialog" aria-labelledby="import-title">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-background">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <div>
            <h2 id="import-title" className="text-lg font-semibold">Import Employees</h2>
            {file && step !== 'upload' && (
              <p className="text-xs text-muted-foreground">{file.name} · {rawRows.length} rows</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StepIndicator step={step} />
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {step === 'upload' && <UploadStep fileInputRef={fileInputRef} onFileSelect={handleFileSelect} onDrop={handleDrop} error={error} onDownloadTemplate={downloadTemplate} />}
        {step === 'mapping' && (
          <MappingStep
            file={file}
            rawRows={rawRows}
            headers={headers}
            columnMappings={columnMappings}
            updateMapping={updateMapping}
            hasRequiredMappings={hasRequiredMappings}
            mappingFromCache={mappingFromCache}
            firstNameLooksLikeFullName={firstNameLooksLikeFullName}
            onConvertToFullName={handleConvertToFullName}
          />
        )}
        {step === 'review' && (
          <ReviewStep
            tableColumns={tableColumns}
            tableRows={tableRows}
            stats={stats}
            tableFilter={tableFilter}
            setTableFilter={setTableFilter}
            onCellChange={handleCellChange}
            onResolveLookup={handleResolveLookup}
            pendingStoreCreates={activePendingStores}
            pendingRoleCreates={activePendingRoles}
            onClearPendingCreates={() => {
              setPendingStoreCreates({});
              setPendingRoleCreates({});
            }}
            duplicateStrategy={duplicateStrategy}
            setDuplicateStrategy={setDuplicateStrategy}
            skippedCount={skippedRows.length}
            duplicateEmailCount={duplicateEmailCount}
          />
        )}
        {step === 'importing' && <ImportingStep progress={progress} message={importingMessage} />}
        {step === 'results' && results && <ResultsStep results={results} />}
      </div>

      {/* Footer with actions */}
      <div className="flex items-center justify-between px-6 py-3 border-t bg-background">
        <div className="text-xs text-muted-foreground">
          {step === 'review' && (
            <span>
              {readyRows.length} ready · {warningRows.length} warnings · {errorRows.length} errors
              {skippedRows.length > 0 && ` · ${skippedRows.length} skipped`}
              {Object.keys(activePendingStores).length > 0 && ` · ${Object.keys(activePendingStores).length} new unit${Object.keys(activePendingStores).length !== 1 ? 's' : ''}`}
              {Object.keys(activePendingRoles).length > 0 && ` · ${Object.keys(activePendingRoles).length} new role${Object.keys(activePendingRoles).length !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {getFooterButtons({ step, hasRequiredMappings, importableCount: readyRows.length + warningRows.length, resetState, handleClose, handleGoToReview, handleImport, setStep })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STEP COMPONENTS
// ============================================================================

function StepIndicator({ step }: { step: Step }) {
  if (step === 'importing' || step === 'results') return null;
  const steps: Array<{ key: Step; label: string }> = [
    { key: 'upload', label: 'Upload' },
    { key: 'mapping', label: 'Map' },
    { key: 'review', label: 'Review' },
  ];
  return (
    <div className="flex items-center gap-1 text-xs">
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
          <Badge
            variant={step === s.key ? 'default' : 'secondary'}
            className={`text-xs ${step === s.key ? '' : 'opacity-50'}`}
          >
            {s.label}
          </Badge>
        </React.Fragment>
      ))}
    </div>
  );
}

function UploadStep({
  fileInputRef,
  onFileSelect,
  onDrop,
  error,
  onDownloadTemplate,
}: {
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileSelect: (file: File) => void;
  onDrop: (e: React.DragEvent) => void;
  error: string | null;
  onDownloadTemplate: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-xl space-y-4">
        <div
          className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-all"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
          />
          <Upload className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
          <p className="font-semibold text-lg">Drop your employee file here</p>
          <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
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
            onClick={(e) => { e.stopPropagation(); onDownloadTemplate(); }}
            className="underline hover:text-foreground transition-colors"
          >
            Need a template?
          </button>
        </p>
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

function MappingStep({
  file,
  rawRows,
  headers,
  columnMappings,
  updateMapping,
  hasRequiredMappings,
  mappingFromCache,
  firstNameLooksLikeFullName,
  onConvertToFullName,
}: {
  file: File | null;
  rawRows: Record<string, string>[];
  headers: string[];
  columnMappings: ColumnMatch[];
  updateMapping: (source: string, target: string) => void;
  hasRequiredMappings: boolean;
  mappingFromCache: boolean;
  firstNameLooksLikeFullName: boolean;
  onConvertToFullName: () => void;
}) {
  const targetCounts: Record<string, number> = {};
  columnMappings.forEach(m => {
    if (m.targetField) targetCounts[m.targetField] = (targetCounts[m.targetField] || 0) + 1;
  });

  const isTargetAvailable = (targetKey: string, currentCol: ColumnMatch) => {
    if (currentCol.targetField === targetKey) return true;
    const count = targetCounts[targetKey] || 0;
    if (count === 0) return true;
    if (FALLBACK_FIELDS.has(targetKey) && count < 2) return true;
    return false;
  };

  const mappedCols = columnMappings.filter(m => m.targetField);
  const unmappedCols = columnMappings.filter(m => !m.targetField);

  const renderMatchBadge = (col: ColumnMatch) => {
    const hasFallback = (targetCounts[col.targetField!] || 0) > 1;
    if (hasFallback) {
      return (
        <Badge variant="outline" className={`text-xs ${col.priority === 1 ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
          {col.priority === 1 ? 'Primary' : 'Fallback'}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className={`text-xs ${getConfidenceColor(col.confidence)}`}>
        {getConfidenceLabel(col.confidence)}
      </Badge>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-2">Column Mapping</h3>
          <p className="text-xs text-muted-foreground mb-3">We auto-detected your columns — review and adjust below.</p>
          {mappingFromCache && (
            <p className="text-xs text-blue-600 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Restored from previous import
            </p>
          )}
        </div>

        {firstNameLooksLikeFullName && (
          <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm">
              <span className="text-blue-900 dark:text-blue-100">Looks like your "First Name" column contains full names.</span>{' '}
              <button
                type="button"
                onClick={onConvertToFullName}
                className="underline text-blue-700 hover:text-blue-900 font-medium"
              >
                Map as Full Name instead?
              </button>
            </AlertDescription>
          </Alert>
        )}

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
              {mappedCols.map((col) => (
                <TableRow key={col.sourceHeader}>
                  <TableCell className="font-medium text-sm">{col.sourceHeader}</TableCell>
                  <TableCell className="text-center">{renderMatchBadge(col)}</TableCell>
                  <TableCell>
                    <Select
                      value={col.targetField || SKIP_VALUE}
                      onValueChange={(v) => updateMapping(col.sourceHeader, v)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP_VALUE}><span className="text-muted-foreground">-- Skip --</span></SelectItem>
                        {FIELD_DEFINITIONS.map(f => (
                          <SelectItem key={f.key} value={f.key} disabled={!isTargetAvailable(f.key, col)}>
                            {f.label} {f.required ? '*' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {unmappedCols.map((col) => (
                <TableRow key={col.sourceHeader} className="opacity-50">
                  <TableCell className="font-medium text-sm italic">{col.sourceHeader}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-xs bg-gray-50 text-gray-400 border-gray-200">Skip</Badge>
                  </TableCell>
                  <TableCell>
                    <Select value={SKIP_VALUE} onValueChange={(v) => updateMapping(col.sourceHeader, v)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP_VALUE}><span className="text-muted-foreground">-- Skip --</span></SelectItem>
                        {FIELD_DEFINITIONS.map(f => (
                          <SelectItem key={f.key} value={f.key} disabled={!isTargetAvailable(f.key, col)}>
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

        {!hasRequiredMappings && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {(() => {
                const hasName = (columnMappings.some(m => m.targetField === 'first_name') && columnMappings.some(m => m.targetField === 'last_name'))
                  || columnMappings.some(m => m.targetField === 'full_name');
                const missing: string[] = [];
                if (!hasName) missing.push('Name (First + Last, or Full Name)');
                if (!columnMappings.some(m => m.targetField === 'email')) missing.push('Email');
                if (!columnMappings.some(m => m.targetField === 'mobile_phone')) missing.push('Mobile Phone');
                return `Required: ${missing.join(', ')}`;
              })()}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

function ReviewStep({
  tableColumns,
  tableRows,
  stats,
  tableFilter,
  setTableFilter,
  onCellChange,
  onResolveLookup,
  pendingStoreCreates,
  pendingRoleCreates,
  onClearPendingCreates,
  duplicateStrategy,
  setDuplicateStrategy,
  skippedCount,
  duplicateEmailCount,
}: {
  tableColumns: ColumnDef[];
  tableRows: RowData[];
  stats: { total: number; ready: number; warnings: number; errors: number };
  tableFilter: 'all' | 'issues' | 'ready';
  setTableFilter: (v: 'all' | 'issues' | 'ready') => void;
  onCellChange: (rowId: string, columnKey: string, newValue: string) => void;
  onResolveLookup: (rowId: string, columnKey: string, resolvedId: string) => void;
  pendingStoreCreates: Record<string, PendingCreate>;
  pendingRoleCreates: Record<string, PendingCreate>;
  onClearPendingCreates: () => void;
  duplicateStrategy: 'skip' | 'update';
  setDuplicateStrategy: (v: 'skip' | 'update') => void;
  skippedCount: number;
  duplicateEmailCount: number;
}) {
  const pendingStoreCount = Object.keys(pendingStoreCreates).length;
  const pendingRoleCount = Object.keys(pendingRoleCreates).length;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left sidebar — settings & summary */}
      <div className="w-64 border-r bg-muted/20 p-4 overflow-y-auto space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Import Summary</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total rows</span><span className="font-semibold">{stats.total}</span></div>
            <div className="flex justify-between"><span className="text-green-600">Ready</span><span className="font-semibold text-green-600">{stats.ready}</span></div>
            <div className="flex justify-between"><span className="text-amber-600">Warnings</span><span className="font-semibold text-amber-600">{stats.warnings}</span></div>
            <div className="flex justify-between"><span className="text-red-600">Errors</span><span className="font-semibold text-red-600">{stats.errors}</span></div>
            {skippedCount > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Skipped (terminated)</span><span className="font-semibold text-muted-foreground">{skippedCount}</span></div>
            )}
          </div>
        </div>

        {(pendingStoreCount > 0 || pendingRoleCount > 0) && (
          <>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Pending Creates
                </h3>
                <button
                  type="button"
                  onClick={onClearPendingCreates}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  Clear all
                </button>
              </div>
              <div className="space-y-1.5 text-sm">
                {pendingStoreCount > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded p-2">
                    <div className="font-medium text-blue-700 text-xs mb-1">{pendingStoreCount} new unit{pendingStoreCount !== 1 ? 's' : ''}</div>
                    <div className="text-xs text-blue-600 space-y-0.5 max-h-24 overflow-y-auto">
                      {Object.values(pendingStoreCreates).map(s => <div key={s.rawValue} className="truncate">• {s.displayName}</div>)}
                    </div>
                  </div>
                )}
                {pendingRoleCount > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded p-2">
                    <div className="font-medium text-blue-700 text-xs mb-1">{pendingRoleCount} new role{pendingRoleCount !== 1 ? 's' : ''}</div>
                    <div className="text-xs text-blue-600 space-y-0.5 max-h-24 overflow-y-auto">
                      {Object.values(pendingRoleCreates).map(r => <div key={r.rawValue} className="truncate">• {r.displayName}</div>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {duplicateEmailCount > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Duplicate Emails</h3>
              <Select value={duplicateStrategy} onValueChange={(v) => setDuplicateStrategy(v as 'skip' | 'update')}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip existing</SelectItem>
                  <SelectItem value="update">Update existing</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-amber-600 mt-1.5">
                {duplicateEmailCount} {duplicateEmailCount === 1 ? 'email already exists in your org' : 'emails already exist in your org'} — will {duplicateStrategy === 'skip' ? 'skip' : 'update'}
              </p>
            </div>
          </>
        )}

        <Separator />

        <div className="text-xs text-muted-foreground space-y-2">
          <p><strong>Tip:</strong> Click any cell to edit. Click role or unit cells to search and resolve.</p>
          <p>Unresolved roles/units will offer a <span className="text-blue-600 font-medium">+ Create new</span> option.</p>
        </div>
      </div>

      {/* Main table area */}
      <div className="flex-1 p-4 overflow-hidden">
        <EditableImportTable
          columns={tableColumns}
          rows={tableRows}
          stats={stats}
          filter={tableFilter}
          onFilterChange={setTableFilter}
          onCellChange={onCellChange}
          onResolveLookup={onResolveLookup}
        />
      </div>
    </div>
  );
}

function ImportingStep({ progress, message }: { progress: number; message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <Loader2 className="h-14 w-14 mx-auto animate-spin text-primary mb-4" />
          <p className="font-medium text-lg">{message}</p>
        </div>
        <Progress value={progress} className="w-full" />
        <p className="text-center text-sm text-muted-foreground">{progress}% complete</p>
      </div>
    </div>
  );
}

function ResultsStep({ results }: { results: BulkCreateUsersResult }) {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto space-y-4">
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
            <div className="max-h-60 overflow-auto border rounded-lg p-2 text-sm">
              {results.errors.slice(0, 30).map((err, idx) => (
                <div key={idx} className="text-red-600 py-1">
                  Row {err.row} ({err.name}): {err.error}
                </div>
              ))}
              {results.errors.length > 30 && (
                <p className="text-muted-foreground">... and {results.errors.length - 30} more errors</p>
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
    </div>
  );
}

function getFooterButtons({
  step,
  hasRequiredMappings,
  importableCount,
  resetState,
  handleClose,
  handleGoToReview,
  handleImport,
  setStep,
}: {
  step: Step;
  hasRequiredMappings: boolean;
  importableCount: number;
  resetState: () => void;
  handleClose: () => void;
  handleGoToReview: () => void;
  handleImport: () => void;
  setStep: (s: Step) => void;
}): React.ReactNode {
  switch (step) {
    case 'upload':
      return <Button variant="outline" onClick={handleClose}>Cancel</Button>;
    case 'mapping':
      return (
        <>
          <Button variant="outline" onClick={resetState}>
            <RefreshCw className="h-4 w-4 mr-2" />Start Over
          </Button>
          <Button disabled={!hasRequiredMappings} onClick={handleGoToReview}>
            <Eye className="h-4 w-4 mr-2" />Review & Edit
          </Button>
        </>
      );
    case 'review':
      return (
        <>
          <Button variant="outline" onClick={() => setStep('mapping')}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back
          </Button>
          <Button onClick={handleImport} disabled={importableCount === 0}>
            <Play className="h-4 w-4 mr-2" />
            Import {importableCount} employee{importableCount !== 1 ? 's' : ''}
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
}

// ============================================================================
// TEMPLATE DOWNLOAD
// ============================================================================

function downloadTemplate() {
  const headers = 'First Name,Last Name,Email,Cell Phone,Employee ID,Hire Date,Position,Store\n';
  const sample = 'Jane,Smith,jane@example.com,(555) 123-4567,EMP001,01/15/2024,Store Associate,Main Street\n' +
    'John,Doe,john@example.com,(555) 987-6543,EMP002,03/22/2023,Store Manager,Downtown\n';
  const blob = new Blob([headers + sample], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'employee_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}
