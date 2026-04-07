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
  getMissingRecommendedFields,
  FIELD_DEFINITIONS,
  FALLBACK_FIELDS,
  SKIP_VALUE,
  type ColumnMatch,
  type MissingRecommendedField,
} from '../lib/importMapping';
import {
  classifyUserSync,
  commitUserSync,
  type UserSyncInput,
  type SyncClassificationResult,
  type SyncCommitResult,
  type MatchStrategy,
} from '../lib/crud/users';
import { bulkCreateStores, getIgnoredStoreIds } from '../lib/crud/stores';
import { bulkCreateRoles } from '../lib/api/roles';
import { useRoles, useStores, useEffectiveOrgId } from '../lib/hooks/useSupabase';
import { supabase, getEffectiveMatchStrategy } from '../lib/supabase';
import { toast } from 'sonner@2.0.3';
import { EditableImportTable, type ColumnDef, type RowData, type CellStatus } from './EditableImportTable';
import { SyncReviewDiff, type SyncTab, type MissingAction } from './SyncReviewDiff';

// ============================================================================
// TYPES
// ============================================================================

type Step = 'upload' | 'mapping' | 'review' | 'sync_preview' | 'importing' | 'results';

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
  const [results, setResults] = useState<SyncCommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync engine state — populated when transitioning into sync_preview step
  const [classification, setClassification] = useState<SyncClassificationResult | null>(null);
  const [syncTab, setSyncTab] = useState<SyncTab>('all');
  const [applyFilter, setApplyFilter] = useState<Record<number, { create?: boolean; update?: boolean }>>({});
  const [missingAction, setMissingAction] = useState<MissingAction>('leave');
  const [matchStrategy, setMatchStrategy] = useState<MatchStrategy>('auto');
  // Confirmation text the admin must type to commit a "deactivate" action
  const [deactivateConfirmText, setDeactivateConfirmText] = useState('');
  // Loading state for the Preview Sync button (classifyUserSync can take a few seconds for large files)
  const [previewLoading, setPreviewLoading] = useState(false);

  // Stores configured as "ignored" (.gitignore-style) — fetched on entering review.
  // Rows whose resolved store_id is in this set are soft-skipped from the sync.
  const [ignoredStoreIds, setIgnoredStoreIds] = useState<Set<string>>(new Set());

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
      const externalId = eff('external_id').trim();
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
        external_id: externalId,
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

  // Missing recommended fields — flagged in the Mapping step so admins know
  // which data will go stale during sync.
  const missingRecommended = useMemo(
    () => getMissingRecommendedFields(columnMappings),
    [columnMappings]
  );

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

    // Fetch the cross-cutting context the review step needs:
    //   - existing org emails (live duplicate flagging)
    //   - ignored store IDs (.gitignore-style filter)
    //   - effective match strategy from org settings
    if (orgId) {
      try {
        const [emailRes, ignoredIds, strategy] = await Promise.all([
          supabase.from('users').select('email').eq('organization_id', orgId).not('email', 'is', null),
          getIgnoredStoreIds(orgId),
          getEffectiveMatchStrategy(orgId),
        ]);
        if (emailRes.data) {
          setExistingEmails(new Set(emailRes.data.map(u => (u.email as string).toLowerCase()).filter(Boolean)));
        }
        setIgnoredStoreIds(ignoredIds);
        setMatchStrategy(strategy);
      } catch (err) {
        console.error('Failed to pre-fetch review-step context:', err);
      }
    }
    setStep('review');
  };

  // Build UserSyncInput[] from the resolved rows. Used by sync_preview classification
  // and the eventual commit. Filters out terminated rows and rows that mapped to an ignored store.
  const buildSyncInputs = useCallback((): { rows: UserSyncInput[]; ignoredCount: number } => {
    let ignoredCount = 0;
    const rows: UserSyncInput[] = [];
    resolvedRows.forEach(r => {
      if (r.isTerminated || r.rowStatus === 'error') return;
      const finalStoreId = r.store_id; // already resolved (existing or pending)
      if (finalStoreId && ignoredStoreIds.has(finalStoreId)) {
        ignoredCount++;
        return;
      }
      rows.push({
        external_id: r.external_id || undefined,
        email: r.email || undefined,
        mobile_phone: r.mobile_phone || undefined,
        first_name: r.first_name,
        last_name: r.last_name,
        role_id: r.role_id || undefined,
        store_id: r.store_id || undefined,
        employee_id: r.employee_id || undefined,
        hire_date: r.hire_date || undefined,
        source_row: r.rowIndex,
      });
    });
    return { rows, ignoredCount };
  }, [resolvedRows, ignoredStoreIds]);

  // Maps populated when pending stores/roles are flushed to the DB.
  // Keyed by normalized pending key, value is the new id.
  const [resolvedStoreCreates, setResolvedStoreCreates] = useState<Record<string, string>>({});
  const [resolvedRoleCreates, setResolvedRoleCreates] = useState<Record<string, string>>({});
  const [failedStoreCreates, setFailedStoreCreates] = useState<Record<string, string>>({});
  const [failedRoleCreates, setFailedRoleCreates] = useState<Record<string, string>>({});

  const handleGoToSyncPreview = async () => {
    if (!orgId) {
      toast.error('No organization context available.');
      return;
    }
    setError(null);
    setPreviewLoading(true);
    try {
      // ========== Phase 1: Flush pending store/role creates BEFORE classifying ==========
      // This ensures the preview the admin sees is identical to what gets committed —
      // no reclassification drift between preview and apply.
      const newStoreEntries = Object.entries(activePendingStores);
      const newRoleEntries = Object.entries(activePendingRoles);

      const createdStoreByKey: Record<string, string> = {};
      const failedStoreByKey: Record<string, string> = {};
      const createdRoleByKey: Record<string, string> = {};
      const failedRoleByKey: Record<string, string> = {};

      if (newStoreEntries.length > 0 || newRoleEntries.length > 0) {
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
          storeResult.createdStores.forEach(c => {
            const entry = newStoreEntries[c.input_index];
            if (entry) createdStoreByKey[entry[0]] = c.id;
          });
          storeResult.errors.forEach(e => {
            const entry = newStoreEntries[e.row];
            if (entry) failedStoreByKey[entry[0]] = e.error;
          });
          if (storeResult.failed > 0) {
            toast.error(`Failed to create ${storeResult.failed} unit${storeResult.failed !== 1 ? 's' : ''}`);
          }
          if (storeResult.created > 0) refetchStores();
        }

        if (roleResult) {
          roleResult.createdRoles.forEach(c => {
            const entry = newRoleEntries[c.input_index];
            if (entry) createdRoleByKey[entry[0]] = c.id;
          });
          roleResult.errors.forEach(e => {
            const entry = newRoleEntries[e.row];
            if (entry) failedRoleByKey[entry[0]] = e.error;
          });
          if (roleResult.failed > 0) {
            toast.error(`Failed to create ${roleResult.failed} role${roleResult.failed !== 1 ? 's' : ''}`);
          }
          if (roleResult.created > 0) refetchRoles();
        }

        setResolvedStoreCreates(createdStoreByKey);
        setResolvedRoleCreates(createdRoleByKey);
        setFailedStoreCreates(failedStoreByKey);
        setFailedRoleCreates(failedRoleByKey);
      }

      // ========== Phase 2: Build sync inputs with resolved IDs (existing or just-created) ==========
      const rowsForSync: UserSyncInput[] = [];
      let ignoredCount = 0;
      resolvedRows.forEach(r => {
        if (r.isTerminated || r.rowStatus === 'error') return;
        const storeKey = r.storeRaw ? normalizePendingKey(r.storeRaw) : '';
        const roleKey = r.roleRaw ? normalizePendingKey(r.roleRaw) : '';
        const finalStoreId = r.store_id || createdStoreByKey[storeKey] || undefined;
        const finalRoleId = r.role_id || createdRoleByKey[roleKey] || undefined;
        if (finalStoreId && ignoredStoreIds.has(finalStoreId)) {
          ignoredCount++;
          return;
        }
        rowsForSync.push({
          external_id: r.external_id || undefined,
          email: r.email || undefined,
          mobile_phone: r.mobile_phone || undefined,
          first_name: r.first_name,
          last_name: r.last_name,
          role_id: finalRoleId,
          store_id: finalStoreId,
          employee_id: r.employee_id || undefined,
          hire_date: r.hire_date || undefined,
          source_row: r.rowIndex,
        });
      });

      // ========== Phase 3: Classify (this is now the SOURCE OF TRUTH for commit) ==========
      const result = await classifyUserSync(rowsForSync, {
        organization_id: orgId,
        match_strategy: matchStrategy,
        external_id_source: 'csv',
        missing_action: missingAction,
        source: 'csv',
        filename: file?.name,
      });
      setClassification(result);
      setApplyFilter({});
      setSyncTab('all');
      setDeactivateConfirmText('');
      setStep('sync_preview');
    } catch (err: any) {
      console.error('Sync classification failed:', err);
      const msg = err.message || 'Failed to classify import. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  // ============================================================================
  // EDITABLE TABLE WIRING
  // ============================================================================

  // Map targetKey → column.key for the editable table
  const tableColumns = useMemo<ColumnDef[]>(() => {
    const cols: ColumnDef[] = [
      { key: 'external_id', label: 'HRIS ID', type: 'text', width: '110px' },
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
          external_id: r.external_id,
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
    if (!classification) {
      toast.error('No sync preview available. Please go back and try again.');
      return;
    }

    // Mass-deactivation safety circuit (QA finding #13)
    if (missingAction === 'deactivate' && classification.missing_users.length > 0) {
      // Require typed confirmation
      if (deactivateConfirmText.trim().toLowerCase() !== 'deactivate') {
        toast.error('Type "deactivate" in the confirmation field to proceed with deactivations.');
        return;
      }
      // Refuse mass deactivation without an extra hard confirmation
      const totalActive = classification.classifications.length + classification.missing_users.length;
      const deactivateRatio = classification.missing_users.length / Math.max(totalActive, 1);
      if (deactivateRatio > 0.5) {
        const proceed = window.confirm(
          `WARNING: This will deactivate ${classification.missing_users.length} employees — more than half of your active workforce. ` +
          `This usually means the uploaded file is a partial report (e.g. one department), not a complete census. ` +
          `Are you absolutely sure you want to deactivate this many employees?`
        );
        if (!proceed) return;
      }
    }

    setStep('importing');
    setProgress(0);
    setError(null);

    try {
      setImportingMessage('Applying changes...');

      // Build pre-insert errors from any pending creates that failed in handleGoToSyncPreview
      const preInsertErrors: Array<{ source_row: number; name: string; error: string }> = [];
      Object.entries(failedStoreCreates).forEach(([rawValue, errMsg]) => {
        // Find rows referencing this raw value and surface as warnings
        resolvedRows.forEach(r => {
          if (r.storeRaw && normalizePendingKey(r.storeRaw) === rawValue && !r.isTerminated) {
            preInsertErrors.push({
              source_row: r.rowIndex + 1,
              name: `${r.first_name} ${r.last_name}`,
              error: `Unit "${r.storeRaw}" creation failed: ${errMsg} — imported without unit`,
            });
          }
        });
      });
      Object.entries(failedRoleCreates).forEach(([rawValue, errMsg]) => {
        resolvedRows.forEach(r => {
          if (r.roleRaw && normalizePendingKey(r.roleRaw) === rawValue && !r.isTerminated) {
            preInsertErrors.push({
              source_row: r.rowIndex + 1,
              name: `${r.first_name} ${r.last_name}`,
              error: `Role "${r.roleRaw}" creation failed: ${errMsg} — imported without role`,
            });
          }
        });
      });

      // Commit using the SAME classification the admin saw in preview (no reclassification drift)
      const commitResult = await commitUserSync(classification, {
        organization_id: orgId,
        match_strategy: matchStrategy,
        external_id_source: 'csv',
        missing_action: missingAction,
        apply_filter: applyFilter,
        source: 'csv',
        filename: file?.name,
        onProgress: (current, total) => {
          setProgress(Math.round((current / total) * 100));
        },
      });

      const mergedResult: SyncCommitResult = {
        ...commitResult,
        errors: [...preInsertErrors, ...commitResult.errors],
      };

      setResults(mergedResult);
      setStep('results');

      if (mergedResult.created > 0 || mergedResult.updated > 0 || mergedResult.reactivated > 0) {
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      console.error('Import failed:', err);
      const msg = err.message || 'Import failed';
      setError(msg);
      toast.error(msg);
      setStep('sync_preview');
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
            missingRecommended={missingRecommended}
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
        {step === 'sync_preview' && classification && (
          <SyncPreviewStep
            classification={classification}
            activeTab={syncTab}
            onTabChange={setSyncTab}
            applyFilter={applyFilter}
            onToggleApply={(sourceRow, kind, value) => {
              setApplyFilter(prev => ({
                ...prev,
                [sourceRow]: { ...(prev[sourceRow] || {}), [kind]: value },
              }));
            }}
            missingAction={missingAction}
            onMissingActionChange={setMissingAction}
            deactivateConfirmText={deactivateConfirmText}
            onDeactivateConfirmTextChange={setDeactivateConfirmText}
            matchStrategy={matchStrategy}
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
          {getFooterButtons({
            step,
            hasRequiredMappings,
            importableCount: readyRows.length + warningRows.length,
            syncReadyCount: classification
              ? classification.stats.new + classification.stats.update + classification.stats.reactivate
              : 0,
            previewLoading,
            resetState,
            handleClose,
            handleGoToReview,
            handleGoToSyncPreview,
            handleImport,
            setStep,
          })}
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
    { key: 'review', label: 'Edit' },
    { key: 'sync_preview', label: 'Sync' },
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
  missingRecommended,
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
  missingRecommended: MissingRecommendedField[];
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

        {missingRecommended.length > 0 && (
          <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm">
              <p className="text-amber-900 dark:text-amber-100 font-medium">
                This file is missing some recommended columns:
              </p>
              <ul className="mt-1.5 text-xs text-amber-800 dark:text-amber-200 space-y-0.5">
                {missingRecommended.map(f => (
                  <li key={f.key}>
                    <strong>{f.label}</strong> — {f.reason}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1.5">
                You can still import, but these fields will go stale during ongoing sync.
              </p>
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

function SyncPreviewStep({
  classification,
  activeTab,
  onTabChange,
  applyFilter,
  onToggleApply,
  missingAction,
  onMissingActionChange,
  deactivateConfirmText,
  onDeactivateConfirmTextChange,
  matchStrategy,
}: {
  classification: SyncClassificationResult;
  activeTab: SyncTab;
  onTabChange: (t: SyncTab) => void;
  applyFilter: Record<number, { create?: boolean; update?: boolean }>;
  onToggleApply: (sourceRow: number, kind: 'create' | 'update', value: boolean) => void;
  missingAction: MissingAction;
  onMissingActionChange: (a: MissingAction) => void;
  deactivateConfirmText: string;
  onDeactivateConfirmTextChange: (v: string) => void;
  matchStrategy: MatchStrategy;
}) {
  const { stats } = classification;
  const isInitialSeed = stats.unchanged === 0 && stats.update === 0 && stats.reactivate === 0 && stats.missing === 0;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left sidebar — sync summary */}
      <div className="w-64 border-r bg-muted/20 p-4 overflow-y-auto space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
            {isInitialSeed ? 'Initial Import' : 'Sync Summary'}
          </h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total in file</span><span className="font-semibold">{stats.total}</span></div>
            <Separator className="my-2" />
            <div className="flex justify-between"><span className="text-green-600">New</span><span className="font-semibold text-green-600">{stats.new}</span></div>
            <div className="flex justify-between"><span className="text-blue-600">Updates</span><span className="font-semibold text-blue-600">{stats.update}</span></div>
            {stats.reactivate > 0 && (
              <div className="flex justify-between"><span className="text-amber-600">Reactivate</span><span className="font-semibold text-amber-600">{stats.reactivate}</span></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Unchanged</span><span className="font-semibold text-muted-foreground">{stats.unchanged}</span></div>
            <Separator className="my-2" />
            {stats.missing > 0 && (
              <div className="flex justify-between"><span className="text-amber-600">Missing from file</span><span className="font-semibold text-amber-600">{stats.missing}</span></div>
            )}
            {stats.ambiguous > 0 && (
              <div className="flex justify-between"><span className="text-red-600">Ambiguous</span><span className="font-semibold text-red-600">{stats.ambiguous}</span></div>
            )}
            {stats.duplicate_in_file > 0 && (
              <div className="flex justify-between"><span className="text-red-600">Dupes in file</span><span className="font-semibold text-red-600">{stats.duplicate_in_file}</span></div>
            )}
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Match Strategy</h3>
          <Badge variant="outline" className="text-xs">
            {matchStrategy === 'auto' ? 'Auto-detected' :
             matchStrategy === 'external_id' ? 'HRIS Employee ID' :
             matchStrategy === 'email' ? 'Email' :
             'Mobile Phone'}
          </Badge>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            How we identify the same employee across imports. Configurable in Settings.
          </p>
        </div>

        <Separator />

        <div className="text-xs text-muted-foreground space-y-2">
          <p><strong>Tip:</strong> Click any tab to inspect a category. Untick rows in the Changes tab to skip specific updates.</p>
          {stats.missing > 0 && (
            <p className="text-amber-600">
              <strong>{stats.missing} employees</strong> in your DB aren't in this file. Decide what to do in the Missing tab before importing.
            </p>
          )}
        </div>
      </div>

      {/* Main diff area */}
      <div className="flex-1 overflow-hidden">
        <SyncReviewDiff
          classification={classification}
          activeTab={activeTab}
          onTabChange={onTabChange}
          applyFilter={applyFilter}
          onToggleApply={onToggleApply}
          missingAction={missingAction}
          onMissingActionChange={onMissingActionChange}
          deactivateConfirmText={deactivateConfirmText}
          onDeactivateConfirmTextChange={onDeactivateConfirmTextChange}
        />
      </div>
    </div>
  );
}

function ResultsStep({ results }: { results: SyncCommitResult }) {
  const ignoredCount = (results as any).ignoredCount as number | undefined;
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="grid grid-cols-4 gap-4">
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
                  <p className="text-2xl font-bold">{results.updated}</p>
                  <p className="text-sm text-muted-foreground">Updated</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{results.reactivated + results.deactivated}</p>
                  <p className="text-sm text-muted-foreground">
                    {results.reactivated > 0 && results.deactivated > 0 ? 'Reactivated/Deactivated' : results.reactivated > 0 ? 'Reactivated' : 'Deactivated'}
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

        {(results.unchanged > 0 || results.skipped > 0 || (ignoredCount && ignoredCount > 0)) && (
          <div className="text-xs text-muted-foreground flex items-center gap-3">
            {results.unchanged > 0 && <span>{results.unchanged} unchanged</span>}
            {results.skipped > 0 && <span>{results.skipped} skipped</span>}
            {ignoredCount && ignoredCount > 0 && <span>{ignoredCount} from ignored units</span>}
          </div>
        )}

        {results.errors.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-red-500">Errors</p>
            <div className="max-h-60 overflow-auto border rounded-lg p-2 text-sm">
              {results.errors.slice(0, 30).map((err, idx) => (
                <div key={idx} className="text-red-600 py-1">
                  Row {err.source_row} ({err.name}): {err.error}
                </div>
              ))}
              {results.errors.length > 30 && (
                <p className="text-muted-foreground">... and {results.errors.length - 30} more errors</p>
              )}
            </div>
          </div>
        )}

        {(results.created > 0 || results.updated > 0 || results.reactivated > 0) && (
          <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Sync complete.
              {results.created > 0 && ` ${results.created} created.`}
              {results.updated > 0 && ` ${results.updated} updated.`}
              {results.reactivated > 0 && ` ${results.reactivated} reactivated.`}
              {results.deactivated > 0 && ` ${results.deactivated} deactivated.`}
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
  syncReadyCount,
  previewLoading,
  resetState,
  handleClose,
  handleGoToReview,
  handleGoToSyncPreview,
  handleImport,
  setStep,
}: {
  step: Step;
  hasRequiredMappings: boolean;
  importableCount: number;
  syncReadyCount: number;
  previewLoading: boolean;
  resetState: () => void;
  handleClose: () => void;
  handleGoToReview: () => void;
  handleGoToSyncPreview: () => void;
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
          <Button variant="outline" onClick={() => setStep('mapping')} disabled={previewLoading}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back
          </Button>
          <Button onClick={handleGoToSyncPreview} disabled={importableCount === 0 || previewLoading}>
            {previewLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Classifying...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Preview Sync
              </>
            )}
          </Button>
        </>
      );
    case 'sync_preview':
      return (
        <>
          <Button variant="outline" onClick={() => setStep('review')}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back to Edit
          </Button>
          <Button onClick={handleImport} disabled={syncReadyCount === 0}>
            <Play className="h-4 w-4 mr-2" />
            Apply {syncReadyCount} change{syncReadyCount !== 1 ? 's' : ''}
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
