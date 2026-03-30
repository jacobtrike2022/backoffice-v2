import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';

const _publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const _supabaseProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const _supabaseUrl: string =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  `https://${_supabaseProjectId}.supabase.co`;
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
  responses: Record<string, unknown> | null;
  response_data: Record<string, unknown> | null;
  status: string;
  submitted_at: string | null;
  submitted_by_id: string | null;
  approved_by_id: string | null;
  total_score: number | null;
  max_possible_score: number | null;
  score_percentage: number | null;
  completion_time_seconds: number | null;
  submitted_by: { name?: string; email?: string } | null;
  approved_by: { name?: string; email?: string } | null;
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

  // ── Filtered submissions ─────────────────────────────────────────────────────

  const filteredSubmissions = submissions.filter((s) => {
    if (statusFilter === 'all') return true;
    return s.status === statusFilter;
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-[600px]">
      {/* ── Left pane: form selector + submission list ── */}
      <div className="w-full lg:w-80 flex flex-col gap-3 shrink-0">
        {/* Form selector */}
        <div>
          {!orgId ? (
            <p className="text-sm text-muted-foreground">Waiting for organization data…</p>
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
                <SelectItem value="none">— Select a form —</SelectItem>
                {forms.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Status filter pills */}
        {selectedFormId !== 'none' && (
          <div className="flex flex-wrap gap-1">
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
        )}

        {/* Submission list */}
        <Card className="flex-1 min-h-0 overflow-hidden">
          <CardContent className="p-0 h-full overflow-y-auto">
            {selectedFormId === 'none' ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-muted-foreground">
                <ChevronDown className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Select a form to view submissions</p>
              </div>
            ) : submissionsLoading ? (
              <div className="p-3 space-y-1">
                {[...Array(5)].map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No submissions yet for this form</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filteredSubmissions.map((sub) => {
                  const submitterName = (sub.submitted_by as any)?.name || 'Anonymous';
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
                              const rd = sub.response_data || sub.responses || {};
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
                                        const rd = sub.response_data || sub.responses || {};
                                        const passed = rd._scoring_passed as boolean | undefined;
                                        return passed === false ? 'bg-red-500' : 'bg-primary';
                                      })()
                                    }`}
                                    style={{ width: `${sub.score_percentage}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] font-semibold shrink-0 ${
                                  (() => {
                                    const rd = sub.response_data || sub.responses || {};
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
      </div>

      {/* ── Right pane: submission detail ── */}
      <div className="flex-1 min-w-0">
        {!selectedSubmission ? (
          <Card className="min-h-[400px] flex items-center justify-center">
            <CardContent className="text-center text-muted-foreground py-16">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <FileText className="h-7 w-7 opacity-40" />
              </div>
              <p className="font-medium">No submission selected</p>
              <p className="text-sm mt-1 opacity-70">Select a submission from the list to review it</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-auto">
            <CardHeader className="pb-3">
              {/* Header row: submitter + status + export */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials((selectedSubmission.submitted_by as any)?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">
                      {(selectedSubmission.submitted_by as any)?.name || 'Anonymous'}
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
                    onClick={() => {
                      const url = `${_supabaseUrl}/functions/v1/trike-server/forms/submissions/${selectedSubmission.id}/pdf`;
                      window.open(url, '_blank');
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
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
                const rd = selectedSubmission.response_data || selectedSubmission.responses || {};
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
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10 border-destructive/30 gap-1"
                      disabled={actionLoading}
                      onClick={() => handleReject(selectedSubmission.id)}
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
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
                  No form questions available.
                </p>
              ) : (
                <FormRenderer
                  blocks={formBlocks}
                  answers={selectedSubmission.responses || {}}
                  readOnly
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
