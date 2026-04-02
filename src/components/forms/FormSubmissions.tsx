import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  FileText,
  ChevronDown,
  Download,
  Loader2,
} from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Separator } from '../ui/separator';
import { getForms, getFormSubmissions } from '../../lib/crud/forms';
import { FormRenderer, type FormBlockData } from './shared/FormRenderer';
import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormRecord {
  id: string;
  title: string;
  type: string;
  status: string;
  organization_id: string;
}

interface SubmissionRecord {
  id: string;
  form_id: string;
  organization_id: string;
  answers: Record<string, unknown> | null;
  status: string;
  submitted_at: string | null;
  user_id: string | null;
  reviewed_by_id: string | null;
  total_score: number | null;
  max_possible_score: number | null;
  score_percentage: number | null;
  completion_time_seconds: number | null;
  submitted_by: { first_name?: string; last_name?: string; email?: string } | null;
  reviewed_by: { first_name?: string; last_name?: string; email?: string } | null;
}

/** Get display name from a joined user record */
function getSubmitterName(user: { first_name?: string; last_name?: string; email?: string } | null | undefined): string {
  if (!user) return 'Anonymous';
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  return name || user.email || 'Anonymous';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusBadge(status: string) {
  switch (status) {
    case 'approved':
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0 gap-1">
          <CheckCircle className="h-3 w-3" />
          Approved
        </Badge>
      );
    case 'rejected':
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-0 gap-1">
          <XCircle className="h-3 w-3" />
          Rejected
        </Badge>
      );
    case 'pending_review':
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-0 gap-1">
          <Clock className="h-3 w-3" />
          Pending Review
        </Badge>
      );
    case 'draft':
      return (
        <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-0 gap-1">
          <FileText className="h-3 w-3" />
          Draft
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          {status}
        </Badge>
      );
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── CSV Export ──────────────────────────────────────────────────────────────

/** Escape a cell value for CSV (RFC 4180) */
function csvCell(value: unknown): string {
  if (value == null) return '';
  const str = String(value);
  // If the cell contains commas, quotes, or newlines, wrap in quotes and escape inner quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Flatten a single response value into a plain string for CSV */
function flattenResponseValue(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    // Array of primitives (e.g. checkbox selections) → semicolon-separated
    return val.map((v) => {
      if (typeof v === 'object' && v !== null) {
        // File objects with url
        if ('url' in v) return (v as { url: string }).url;
        return JSON.stringify(v);
      }
      return String(v);
    }).join('; ');
  }
  if (typeof val === 'object') {
    // Signature-like objects
    if ('dataUrl' in (val as Record<string, unknown>) || 'data_url' in (val as Record<string, unknown>)) {
      return '[Signature]';
    }
    // File-like objects
    if ('url' in (val as Record<string, unknown>)) {
      return (val as { url: string }).url;
    }
    return JSON.stringify(val);
  }
  return String(val);
}

async function exportSubmissionsCsv(
  formId: string,
  formTitle: string,
  supabaseClient: typeof import('../../lib/supabase').supabase
) {
  // 1. Fetch ALL submissions for this form
  const { data: allSubmissions, error: subErr } = await supabaseClient
    .from('form_submissions')
    .select(`
      *,
      submitted_by:users!form_submissions_submitted_by_id_fkey(name, email),
      approved_by:users!form_submissions_approved_by_id_fkey(name, email)
    `)
    .eq('form_id', formId)
    .order('submitted_at', { ascending: false });

  if (subErr) throw subErr;
  if (!allSubmissions || allSubmissions.length === 0) {
    throw new Error('No submissions to export.');
  }

  // 2. Fetch form blocks to build dynamic columns
  const { data: blocks, error: blocksErr } = await supabaseClient
    .from('form_blocks')
    .select('id, label, type, display_order')
    .eq('form_id', formId)
    .order('display_order', { ascending: true });

  if (blocksErr) throw blocksErr;

  // Filter to question blocks only (exclude headings, separators, etc.)
  const questionBlocks = (blocks || []).filter(
    (b: any) => b.type !== 'heading' && b.type !== 'separator' && b.type !== 'section_header' && b.type !== 'paragraph'
  );

  // 3. Build CSV header
  const fixedHeaders = ['Submission ID', 'Submitted By', 'Email', 'Submitted At', 'Status'];
  const hasScoring = allSubmissions.some((s: any) => s.score_percentage != null);
  if (hasScoring) {
    fixedHeaders.push('Score %', 'Pass/Fail');
  }
  const blockHeaders = questionBlocks.map((b: any) => b.label || `Question ${b.display_order}`);
  const allHeaders = [...fixedHeaders, ...blockHeaders];

  // 4. Build rows
  const rows: string[][] = [];
  for (const sub of allSubmissions as any[]) {
    const rd = sub.answers || {};
    const submitterName = getSubmitterName(sub.submitted_by);
    const submitterEmail = sub.submitted_by?.email || '';

    const fixedCells = [
      sub.id,
      submitterName,
      submitterEmail,
      sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : '',
      sub.status || '',
    ];

    if (hasScoring) {
      fixedCells.push(
        sub.score_percentage != null ? String(Math.round(sub.score_percentage)) : '',
        rd._scoring_passed === true ? 'Pass' : rd._scoring_passed === false ? 'Fail' : ''
      );
    }

    const blockCells = questionBlocks.map((b: any) => {
      // Try block id key first, then label key
      const val = rd[b.id] ?? rd[b.label] ?? '';
      return flattenResponseValue(val);
    });

    rows.push([...fixedCells, ...blockCells]);
  }

  // 5. Build CSV string
  const csvLines = [
    allHeaders.map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ];
  const csvString = csvLines.join('\r\n');

  // 6. Download with UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10);
  const safeTitle = formTitle.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
  const filename = `${safeTitle}_submissions_${dateStr}.csv`;

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// ─── Status filter options (Radix UI — no empty string values) ────────────────

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg animate-pulse">
      <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/2" />
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FormSubmissionsProps {
  orgId?: string;
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FormSubmissions({ orgId, currentRole = 'admin' }: FormSubmissionsProps) {
  const { t } = useTranslation();
  const canApproveReject = currentRole === 'admin' || currentRole === 'district-manager';

  // Forms list
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [formsLoading, setFormsLoading] = useState(true);
  const [formsError, setFormsError] = useState<string | null>(null);

  // Selected form
  const [selectedFormId, setSelectedFormId] = useState<string>('none');

  // Submissions for selected form
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  // Status filter
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Selected submission for detail view
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRecord | null>(null);

  // Blocks for the selected form (for FormRenderer)
  const [formBlocks, setFormBlocks] = useState<FormBlockData[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);

  // Approve/reject loading state
  const [actionLoading, setActionLoading] = useState(false);

  // CSV export loading state
  const [csvExporting, setCsvExporting] = useState(false);

  // ── Load forms ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      if (!orgId) { setFormsLoading(false); return; }
      setFormsLoading(true);
      setFormsError(null);
      try {
        const data = await getForms({ status: 'published' }, orgId);
        setForms((data as unknown as FormRecord[]) || []);
      } catch (err) {
        setFormsError('Failed to load forms.');
        console.error(err);
      } finally {
        setFormsLoading(false);
      }
    }
    load();
  }, [orgId]);

  // ── Load submissions when form changes ──────────────────────────────────────

  const loadSubmissions = useCallback(async (formId: string) => {
    if (!formId || formId === 'none') {
      setSubmissions([]);
      return;
    }
    setSubmissionsLoading(true);
    try {
      const data = await getFormSubmissions(formId, {});
      setSubmissions((data as unknown as SubmissionRecord[]) || []);
      setSelectedSubmission(null);
    } catch (err) {
      console.error('Failed to load submissions:', err);
      setSubmissions([]);
    } finally {
      setSubmissionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions(selectedFormId);
  }, [selectedFormId, loadSubmissions]);

  // ── Load blocks when submission is selected ─────────────────────────────────

  useEffect(() => {
    if (!selectedSubmission) return;
    async function loadBlocks() {
      setBlocksLoading(true);
      try {
        const { data, error } = await supabase
          .from('form_blocks')
          .select('*')
          .eq('form_id', selectedSubmission!.form_id)
          .order('display_order', { ascending: true });
        if (error) throw error;
        setFormBlocks((data || []) as FormBlockData[]);
      } catch (err) {
        console.error('Failed to load form blocks:', err);
        setFormBlocks([]);
      } finally {
        setBlocksLoading(false);
      }
    }
    loadBlocks();
  }, [selectedSubmission?.form_id]);

  // ── Approve / Reject ────────────────────────────────────────────────────────

  async function handleApprove(submissionId: string) {
    setActionLoading(true);
    try {
      // Resolve current user's internal id — may be null in demo mode (no auth session)
      let approverId: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('users')
            .select('id')
            .eq('auth_user_id', user.id)
            .maybeSingle();
          approverId = profile?.id || null;
        }
      } catch {
        // Non-fatal — continue without approverId in demo mode
      }

      const { error } = await supabase
        .from('form_submissions')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by_id: approverId,
        })
        .eq('id', submissionId);
      if (error) throw error;
      // Optimistically update local state
      setSubmissions((prev) =>
        prev.map((s) => (s.id === submissionId ? { ...s, status: 'approved' } : s))
      );
      setSelectedSubmission((prev) => (prev ? { ...prev, status: 'approved' } : prev));
    } catch (err) {
      console.error('Approve failed:', err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(submissionId: string) {
    setActionLoading(true);
    try {
      // Resolve current user's internal id — may be null in demo mode (no auth session)
      let approverId: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('users')
            .select('id')
            .eq('auth_user_id', user.id)
            .maybeSingle();
          approverId = profile?.id || null;
        }
      } catch {
        // Non-fatal — continue without approverId in demo mode
      }

      const { error } = await supabase
        .from('form_submissions')
        .update({
          status: 'rejected',
          approved_at: new Date().toISOString(),
          approved_by_id: approverId,
        })
        .eq('id', submissionId);
      if (error) throw error;
      setSubmissions((prev) =>
        prev.map((s) => (s.id === submissionId ? { ...s, status: 'rejected' } : s))
      );
      setSelectedSubmission((prev) => (prev ? { ...prev, status: 'rejected' } : prev));
    } catch (err) {
      console.error('Reject failed:', err);
    } finally {
      setActionLoading(false);
    }
  }

  // ── CSV Export handler ───────────────────────────────────────────────────────

  async function handleExportCsv() {
    if (selectedFormId === 'none' || csvExporting) return;
    const form = forms.find((f) => f.id === selectedFormId);
    if (!form) return;
    setCsvExporting(true);
    try {
      await exportSubmissionsCsv(selectedFormId, form.title, supabase);
    } catch (err) {
      console.error('CSV export failed:', err);
    } finally {
      setCsvExporting(false);
    }
  }

  // ── PDF / HTML download handler ──────────────────────────────────────────────

  function handleDownloadPdf(submission: SubmissionRecord) {
    const form = forms.find((f) => f.id === submission.form_id);
    const formTitle = form?.title || 'Form Submission';

    // Build block-aware response HTML from client-side data
    const rd = submission.answers || {};
    const blocks = formBlocks.length > 0 ? formBlocks : [];

    const submitterName = getSubmitterName(submission.submitted_by as any);
    const submitterEmailAddr = (submission.submitted_by as any)?.email || '';
    const submittedAt = submission.submitted_at
      ? new Date(submission.submitted_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    // Score section
    let scoreHtml = '';
    if (submission.score_percentage != null) {
      const pct = Math.round(submission.score_percentage);
      const total = submission.total_score ?? 0;
      const max = submission.max_possible_score ?? 0;
      const passed = rd._scoring_passed as boolean | undefined;
      const statusColor = passed === false ? '#dc2626' : '#16a34a';
      const statusLabel = passed === false ? 'FAIL' : passed === true ? 'PASS' : '';
      scoreHtml = `
        <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:20px 0;border:1px solid #e2e8f0;">
          <div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Score Summary</div>
          <div style="font-size:32px;font-weight:700;color:#0f172a;">${total} / ${max} <span style="font-size:16px;color:#64748b;">(${pct}%)</span></div>
          ${statusLabel ? `<div style="display:inline-block;margin-top:8px;padding:4px 14px;border-radius:9999px;font-size:12px;font-weight:700;color:#fff;background:${statusColor};">${statusLabel}</div>` : ''}
        </div>`;
    }

    // Build response rows
    const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    // Identity "Submitted by" row (from auto-injected identity block)
    const identityLabel = rd['_identity_submitted_by__label'] as string | undefined;
    const identityRow = identityLabel
      ? `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#334155;vertical-align:top;width:35%;font-size:13px;">Submitted by</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#1e293b;font-size:14px;font-weight:500;">${escHtml(identityLabel)}</td>
        </tr>`
      : '';
    const responsesHtml = identityRow + blocks
      .filter((b) => b.type !== 'heading' && b.type !== 'separator' && b.type !== 'section_header' && b.type !== 'paragraph')
      .map((block) => {
        const rawVal = rd[block.id] ?? rd[block.label || ''] ?? null;
        const label = block.label || 'Question';
        let displayVal: string;

        if (block.type === 'signature') {
          let sigUrl: string | null = null;
          if (rawVal && typeof rawVal === 'string' && (rawVal as string).startsWith('data:')) sigUrl = rawVal as string;
          else if (rawVal && typeof rawVal === 'object') sigUrl = (rawVal as any).dataUrl || (rawVal as any).data_url || null;
          if (sigUrl) {
            displayVal = `<div><img src="${escHtml(sigUrl)}" alt="Signature" style="max-width:280px;max-height:100px;border:1px solid #e2e8f0;border-radius:4px;background:#fff;padding:4px;" /><br/><em style="color:#64748b;font-size:11px;">[Digital signature captured]</em></div>`;
          } else {
            displayVal = rawVal
              ? '<em style="color:#64748b;">[Digital signature captured]</em>'
              : '<em style="color:#94a3b8;">No signature</em>';
          }
        } else if (block.type === 'yes_no' || block.type === 'yesno') {
          if (rawVal === true || rawVal === 'yes' || rawVal === 'Yes') {
            displayVal = '<span style="color:#16a34a;font-weight:600;">&#10003; Yes</span>';
          } else if (rawVal === false || rawVal === 'no' || rawVal === 'No') {
            displayVal = '<span style="color:#dc2626;font-weight:600;">&#10007; No</span>';
          } else {
            displayVal = '<em style="color:#94a3b8;">No response</em>';
          }
        } else if (block.type === 'rating') {
          const num = Number(rawVal);
          if (!isNaN(num) && num > 0) {
            displayVal = '&#9733;'.repeat(num) + '<span style="color:#d4d4d8;">&#9733;</span>'.repeat(Math.max(0, 5 - num)) + ` <span style="color:#64748b;">(${num}/5)</span>`;
          } else {
            displayVal = '<em style="color:#94a3b8;">No rating</em>';
          }
        } else if (block.type === 'slider') {
          displayVal = rawVal != null ? `<strong>${escHtml(String(rawVal))}</strong>` : '<em style="color:#94a3b8;">No response</em>';
        } else if (block.type === 'location') {
          if (rawVal && typeof rawVal === 'object') {
            const loc = rawVal as Record<string, unknown>;
            displayVal = `${loc.latitude ?? '—'}, ${loc.longitude ?? '—'}`;
          } else if (rawVal) {
            displayVal = escHtml(String(rawVal));
          } else {
            displayVal = '<em style="color:#94a3b8;">No location</em>';
          }
        } else if (block.type === 'store_lookup' || block.type === 'role_lookup' || block.type === 'person_lookup') {
          const labelVal = rd[`${block.id}__label`];
          displayVal = labelVal ? escHtml(String(labelVal)) : (rawVal ? escHtml(String(rawVal)) : '<em style="color:#94a3b8;">No selection</em>');
        } else if (block.type === 'photo' || block.type === 'file' || block.type === 'file_upload') {
          if (Array.isArray(rawVal)) {
            displayVal = rawVal.map((f: unknown) => {
              if (typeof f === 'object' && f !== null && 'url' in (f as Record<string, unknown>)) {
                return escHtml((f as { filename?: string; name?: string }).filename || (f as { name?: string }).name || 'File');
              }
              return escHtml(String(f));
            }).join(', ') || '<em style="color:#94a3b8;">No files</em>';
          } else {
            displayVal = '<em style="color:#94a3b8;">No files</em>';
          }
        } else if (rawVal === null || rawVal === undefined) {
          displayVal = '<em style="color:#94a3b8;">No response</em>';
        } else if (Array.isArray(rawVal)) {
          displayVal = escHtml(rawVal.map((v: unknown) => {
            if (typeof v === 'object' && v !== null && 'url' in (v as Record<string, unknown>)) {
              return (v as { url: string; filename?: string }).filename || 'File';
            }
            return String(v);
          }).join(', '));
        } else if (typeof rawVal === 'boolean') {
          displayVal = rawVal ? 'Yes' : 'No';
        } else {
          displayVal = escHtml(String(rawVal));
        }

        return `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:500;color:#334155;vertical-align:top;width:35%;font-size:13px;">${escHtml(label)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#1e293b;font-size:14px;">${displayVal}</td>
        </tr>`;
      })
      .join('');

    const now = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(formTitle)} — Submission Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; background: #fff; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { padding-bottom: 20px; border-bottom: 3px solid #f97316; margin-bottom: 24px; }
    .brand { font-size: 14px; font-weight: 700; color: #f97316; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px; }
    .form-title { font-size: 24px; font-weight: 700; color: #0f172a; }
    .meta { font-size: 13px; color: #64748b; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #94a3b8; text-align: center; }
    .save-btn { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: #f97316; color: #fff; border: none; border-radius: 8px; cursor: pointer; transition: background 0.15s; }
    .save-btn:hover { background: #ea580c; }
    @media print {
      body { padding: 20px; }
      @page { margin: 15mm; }
      .save-btn, .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:right;margin-bottom:16px;">
    <button class="save-btn" onclick="window.print()" title="Save as PDF"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
  </div>
  <div class="header">
    <div class="brand">TRIKE BACKOFFICE</div>
    <div class="form-title">${escHtml(formTitle)}</div>
    <div class="meta">Submitted: ${submittedAt}</div>
  </div>
  <div style="margin-bottom:16px;">
    <div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Submitted By</div>
    <div style="font-size:14px;color:#334155;"><strong>${escHtml(submitterName)}</strong>${submitterEmailAddr ? ` &middot; ${escHtml(submitterEmailAddr)}` : ''}</div>
  </div>
  ${scoreHtml}
  ${responsesHtml ? `<table>${responsesHtml}</table>` : '<p style="color:#94a3b8;font-size:14px;">No responses recorded.</p>'}
  <div class="footer">Generated by Trike Backoffice &middot; ${now}</div>
</body>
</html>`;

    // Open in a new window for print-to-PDF
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    // Clean up the blob URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    // If popup was blocked, fall back to download
    if (!win) {
      const anchor = document.createElement('a');
      anchor.href = url;
      const safeTitle = formTitle.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
      anchor.download = `${safeTitle}_submission.html`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
  }

  // ── Filtered submissions ─────────────────────────────────────────────────────

  const filteredSubmissions = submissions.filter((s) => {
    if (statusFilter === 'all') return true;
    return s.status === statusFilter;
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={`gap-4 min-h-[600px] overflow-hidden ${selectedSubmission ? 'flex flex-row' : 'flex flex-col'}`}>
      {/* ── Left pane: form selector + submission list ── */}
      <div className={`flex flex-col gap-3 shrink-0 ${selectedSubmission ? 'w-[380px]' : 'w-full'}`}>
        {/* Form selector */}
        <div>
          {!orgId ? (
            <p className="text-sm text-muted-foreground">{t('forms.waitingForOrg')}</p>
          ) : formsLoading ? (
            <div className="h-10 bg-muted rounded-md animate-pulse" />
          ) : formsError ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 flex items-center justify-between gap-2">
              <p className="text-sm text-destructive flex-1">{formsError}</p>
              <button
                type="button"
                onClick={() => {
                  setFormsError(null);
                  setFormsLoading(true);
                  getForms({ status: 'published' }, orgId!)
                    .then((data) => setForms((data as unknown as FormRecord[]) || []))
                    .catch((err) => { setFormsError('Failed to load forms.'); console.error(err); })
                    .finally(() => setFormsLoading(false));
                }}
                className="text-xs font-medium text-destructive underline shrink-0"
              >
                Retry
              </button>
            </div>
          ) : (
            <Select
              value={selectedFormId}
              onValueChange={(v) => {
                setSelectedFormId(v);
                setStatusFilter('all');
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a form…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('forms.selectAForm')}</SelectItem>
                {forms.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Status filter pills + Export CSV */}
        {selectedFormId !== 'none' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex flex-wrap gap-1 flex-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === f.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={csvExporting || submissions.length === 0}
              className="shrink-0"
            >
              {csvExporting ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1.5" />
              )}
              {csvExporting ? t('forms.exporting') : t('forms.exportCsv')}
            </Button>
          </div>
        )}

        {/* Submission list — hidden when no form is selected */}
        {selectedFormId === 'none' ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-muted-foreground">
            <ChevronDown className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">{t('forms.selectAFormToView')}</p>
          </div>
        ) : (
        <Card className="flex-1 min-h-0 overflow-hidden">
          <CardContent className="p-0 h-full overflow-y-auto">
            {submissionsLoading ? (
              <div className="p-3 space-y-1">
                {[...Array(5)].map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">{t('forms.noSubmissionsForForm')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filteredSubmissions.map((sub) => {
                  const submitterName = getSubmitterName(sub.submitted_by as any);
                  const isSelected = selectedSubmission?.id === sub.id;
                  return (
                    <li key={sub.id}>
                      <button
                        type="button"
                        className={`w-full text-left p-3 flex items-start gap-3 hover:bg-muted/50 transition-colors ${
                          isSelected ? 'bg-muted border-l-2 border-primary' : 'border-l-2 border-transparent'
                        }`}
                        onClick={() => setSelectedSubmission(sub)}
                      >
                        {/* Status dot */}
                        <div className="flex-shrink-0 mt-2">
                          <span className={`inline-block h-2 w-2 rounded-full ${
                            sub.status === 'approved' ? 'bg-green-500' :
                            sub.status === 'rejected' ? 'bg-red-500' :
                            sub.status === 'pending_review' ? 'bg-yellow-400' :
                            'bg-gray-400'
                          }`} />
                        </div>
                        <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            {getInitials(submitterName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{submitterName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(sub.submitted_at)}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            {getStatusBadge(sub.status)}
                            {sub.score_percentage != null && (() => {
                              const rd = sub.answers || {};
                              const passed = rd._scoring_passed as boolean | undefined;
                              if (passed === true) {
                                return (
                                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0 gap-1 text-[10px] px-1.5 py-0">
                                    <CheckCircle className="h-2.5 w-2.5" />
                                    Pass
                                  </Badge>
                                );
                              }
                              if (passed === false) {
                                return (
                                  <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-0 gap-1 text-[10px] px-1.5 py-0">
                                    <XCircle className="h-2.5 w-2.5" />
                                    Fail
                                  </Badge>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          {sub.score_percentage != null && (
                            <div className="mt-1.5">
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      (() => {
                                        const rd = sub.answers || {};
                                        const passed = rd._scoring_passed as boolean | undefined;
                                        return passed === false ? 'bg-red-500' : 'bg-primary';
                                      })()
                                    }`}
                                    style={{ width: `${sub.score_percentage}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] font-semibold shrink-0 ${
                                  (() => {
                                    const rd = sub.answers || {};
                                    const passed = rd._scoring_passed as boolean | undefined;
                                    return passed === false ? 'text-red-500' : 'text-primary';
                                  })()
                                }`}>
                                  {Math.round(sub.score_percentage)}%
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      {/* ── Right pane: submission detail (only shown when a submission is selected) ── */}
      {selectedFormId !== 'none' && selectedSubmission && (
      <div className="flex-1 min-w-0 overflow-auto">
          <Card className="overflow-auto">
            <CardHeader className="pb-3">
              {/* Header row: submitter + status + export */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(getSubmitterName(selectedSubmission.submitted_by as any))}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">
                      {getSubmitterName(selectedSubmission.submitted_by as any)}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {(selectedSubmission.submitted_by as any)?.email || ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {getStatusBadge(selectedSubmission.status)}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadPdf(selectedSubmission)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {t('forms.exportPdf')}
                  </Button>
                </div>
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-3">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(selectedSubmission.submitted_at)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(selectedSubmission.completion_time_seconds)}
                </span>
              </div>

              {/* Score gauge */}
              {selectedSubmission.score_percentage != null && (() => {
                const rd = selectedSubmission.answers || {};
                const passed = rd._scoring_passed as boolean | undefined;
                const scoreColor = passed === false ? 'text-red-500' : 'text-primary';
                const barColor = passed === false ? 'bg-red-500' : 'bg-brand-gradient';
                return (
                  <div className="mt-4">
                    <div className="flex items-end gap-2 mb-1">
                      <span className={`text-4xl font-bold ${scoreColor}`}>
                        {Math.round(selectedSubmission.score_percentage)}
                      </span>
                      <span className="text-sm text-muted-foreground mb-1.5">/100%</span>
                      {passed === true && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0 gap-1 mb-1.5">
                          <CheckCircle className="h-3 w-3" />
                          Pass
                        </Badge>
                      )}
                      {passed === false && (
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-0 gap-1 mb-1.5">
                          <XCircle className="h-3 w-3" />
                          Fail
                        </Badge>
                      )}
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`${barColor} h-2 rounded-full transition-all`}
                        style={{ width: `${selectedSubmission.score_percentage}%` }}
                      />
                    </div>
                    {selectedSubmission.total_score != null &&
                      selectedSubmission.max_possible_score != null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedSubmission.total_score} / {selectedSubmission.max_possible_score} pts
                        </p>
                      )}
                  </div>
                );
              })()}

              {/* Approve / Reject actions */}
              {canApproveReject && selectedSubmission.status === 'pending_review' && (
                <>
                  <Separator className="mt-4" />
                  <div className="flex gap-2 pt-3">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white gap-1"
                      disabled={actionLoading}
                      onClick={() => handleApprove(selectedSubmission.id)}
                    >
                      <CheckCircle className="h-4 w-4" />
                      {t('forms.approve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10 border-destructive/30 gap-1"
                      disabled={actionLoading}
                      onClick={() => handleReject(selectedSubmission.id)}
                    >
                      <XCircle className="h-4 w-4" />
                      {t('forms.reject')}
                    </Button>
                  </div>
                </>
              )}
            </CardHeader>

            <Separator />

            <CardContent className="pt-4">
              {blocksLoading ? (
                <div className="space-y-4 animate-pulse">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-3 bg-muted rounded w-1/3" />
                      <div className="h-8 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              ) : formBlocks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t('forms.noFormQuestionsAvailable')}
                </p>
              ) : (
                <FormRenderer
                  blocks={formBlocks}
                  answers={selectedSubmission.answers || {}}
                  readOnly
                  organizationId={orgId}
                />
              )}
            </CardContent>
          </Card>
      </div>
      )}
    </div>
  );
}
