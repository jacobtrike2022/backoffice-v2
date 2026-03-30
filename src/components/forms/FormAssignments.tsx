import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Plus, Calendar, ClipboardList, Repeat } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { supabase } from '../../lib/supabase';
import { computeNextDueAt } from '../../lib/crud/forms';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormOption {
  id: string;
  title: string;
}

interface StoreOption {
  id: string;
  name: string;
  code: string | null;
}

interface DistrictOption {
  id: string;
  name: string;
}

interface FormAssignment {
  id: string;
  assignment_type: string;
  target_id: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
  recurrence_rule: string | null;
  next_due_at: string | null;
  form: { id: string; title: string; type: string; organization_id: string } | null;
}

interface FormAssignmentsProps {
  orgId?: string;
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'No due date';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };
  return map[status] || 'bg-muted text-muted-foreground';
}

function assignmentTypeBadge(type: string) {
  const map: Record<string, string> = {
    store: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    district: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    user: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    role: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    group: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  };
  return map[type] || 'bg-muted text-muted-foreground';
}

const RECURRENCE_OPTIONS = [
  { value: 'once', label: 'Once (no repeat)' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

function recurrenceBadge(rule: string | null) {
  if (!rule || rule === 'once') return null;
  const label = RECURRENCE_LABELS[rule] || rule;
  return (
    <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-0 text-xs flex items-center gap-1">
      <Repeat className="h-3 w-3" />
      {label}
    </Badge>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FormAssignments({ orgId, currentRole = 'admin' }: FormAssignmentsProps) {
  const canAssign = currentRole !== 'store-manager';

  // List state
  const [assignments, setAssignments] = useState<FormAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Dialog form data
  const [forms, setForms] = useState<FormOption[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);

  const [selectedFormId, setSelectedFormId] = useState('');
  const [assignType, setAssignType] = useState('store'); // 'store' | 'district'
  const [selectedTargetId, setSelectedTargetId] = useState('none');
  const [dueDate, setDueDate] = useState('');
  const [recurrenceRule, setRecurrenceRule] = useState('once');

  // ─── Fetch assignments ──────────────────────────────────────────────────────

  async function loadAssignments() {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);

    // Try query with recurrence columns first; fall back if columns don't exist yet
    let data: any[] | null = null;
    let error: any = null;

    const fullQuery = await supabase
      .from('form_assignments')
      .select(`
        id,
        assignment_type,
        target_id,
        due_date,
        status,
        created_at,
        recurrence_rule,
        next_due_at,
        form:forms!form_assignments_form_id_fkey(id, title, type, organization_id)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (fullQuery.error && fullQuery.error.message.includes('recurrence_rule')) {
      // Columns not yet migrated — retry without them
      const fallback = await supabase
        .from('form_assignments')
        .select(`
          id,
          assignment_type,
          target_id,
          due_date,
          status,
          created_at,
          form:forms!form_assignments_form_id_fkey(id, title, type, organization_id)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      data = (fallback.data || []).map((row: any) => ({
        ...row,
        recurrence_rule: 'once',
        next_due_at: null,
      }));
      error = fallback.error;
    } else {
      data = fullQuery.data;
      error = fullQuery.error;
    }

    if (error) {
      setFetchError(error.message);
      setAssignments([]);
    } else {
      const filtered = ((data || []).filter(
        (a) => (a.form as any)?.organization_id === orgId
      ) as unknown) as FormAssignment[];
      setAssignments(filtered);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  // ─── Fetch dialog options ───────────────────────────────────────────────────

  async function loadDialogOptions() {
    if (!orgId) return;

    const [formsRes, storesRes, districtsRes] = await Promise.all([
      supabase
        .from('forms')
        .select('id, title')
        .eq('organization_id', orgId)
        .eq('status', 'published'),
      supabase
        .from('stores')
        .select('id, name, code')
        .eq('organization_id', orgId)
        .eq('is_active', true),
      supabase
        .from('districts')
        .select('id, name')
        .eq('organization_id', orgId),
    ]);

    setForms((formsRes.data || []) as FormOption[]);
    setStores((storesRes.data || []) as StoreOption[]);
    setDistricts((districtsRes.data || []) as DistrictOption[]);
  }

  function openDialog() {
    setSelectedFormId('');
    setAssignType('store');
    setSelectedTargetId('none');
    setDueDate('');
    setRecurrenceRule('once');
    setSubmitError(null);
    loadDialogOptions();
    setDialogOpen(true);
  }

  // ─── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!orgId) return;
    if (!selectedFormId) {
      setSubmitError('Please select a form.');
      return;
    }
    if (selectedTargetId === 'none') {
      setSubmitError('Please select a target.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const nextDueAt = computeNextDueAt(dueDate || null, recurrenceRule);

    const { error } = await supabase.from('form_assignments').insert({
      form_id: selectedFormId,
      assignment_type: assignType,
      target_id: selectedTargetId,
      due_date: dueDate || null,
      status: 'active',
      recurrence_rule: recurrenceRule,
      next_due_at: nextDueAt,
      organization_id: orgId,
    });

    if (error) {
      setSubmitError(error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setDialogOpen(false);
    loadAssignments();
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const targetOptions = assignType === 'store' ? stores : districts;

  if (!orgId) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        Waiting for organization data…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Form Assignments</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Assign forms to stores or districts across your organization
          </p>
        </div>
        {canAssign && (
          <Button
            className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
            onClick={openDialog}
          >
            <Plus className="h-4 w-4 mr-2" />
            Assign Form
          </Button>
        )}
      </div>

      {/* Assignments list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : fetchError ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-destructive text-sm mb-3">Failed to load assignments: {fetchError}</p>
            <Button variant="outline" size="sm" onClick={loadAssignments}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : assignments.length === 0 ? (
        /* Empty state */
        <Card>
          <CardContent className="p-12 flex flex-col items-center text-center gap-4">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <ClipboardList className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-lg">No assignments yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Assign a form to a store or district to get started.
              </p>
            </div>
            {canAssign && (
              <Button
                className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
                onClick={openDialog}
              >
                <Plus className="h-4 w-4 mr-2" />
                Assign Form
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => {
            const formTitle = (a.form as any)?.title ?? 'Unknown Form';
            const shortTarget = a.target_id
              ? a.target_id.slice(0, 8) + '…'
              : '—';

            return (
              <Card key={a.id} className={`border-l-4 ${
                a.status === 'completed' ? 'border-l-blue-400' :
                a.status === 'overdue' ? 'border-l-red-400' :
                'border-l-green-400'
              }`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="font-semibold truncate">{formTitle}</p>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge
                          className={`border-0 text-xs ${assignmentTypeBadge(a.assignment_type)}`}
                        >
                          {a.assignment_type}
                        </Badge>
                        {recurrenceBadge(a.recurrence_rule)}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(a.due_date)}
                        </span>
                        {a.recurrence_rule && a.recurrence_rule !== 'once' && a.next_due_at && (
                          <span className="text-xs text-indigo-600 dark:text-indigo-400">
                            Next due: {formatDate(a.next_due_at)}
                          </span>
                        )}
                        <span className="text-xs opacity-60">
                          Target ID: {shortTarget}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`border-0 text-xs ${statusBadge(a.status)}`}>
                        {a.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(a.created_at)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Assignment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Form</DialogTitle>
            <DialogDescription>
              Choose a published form and assign it to a store or district.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Form picker */}
            <div className="space-y-2">
              <Label>Form</Label>
              <Select
                value={selectedFormId || 'none'}
                onValueChange={(v) => setSelectedFormId(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a published form..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select a form…</SelectItem>
                  {forms.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assign type */}
            <div className="space-y-2">
              <Label>Assign to</Label>
              <Select
                value={assignType}
                onValueChange={(v) => {
                  setAssignType(v);
                  setSelectedTargetId('none');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="store">Store</SelectItem>
                  <SelectItem value="district">District</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Target picker */}
            <div className="space-y-2">
              <Label>{assignType === 'store' ? 'Store' : 'District'}</Label>
              <Select
                value={selectedTargetId}
                onValueChange={setSelectedTargetId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={`Select a ${assignType}...`}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    Select a {assignType}…
                  </SelectItem>
                  {targetOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {'code' in t && (t as StoreOption).code
                        ? `${t.name} (${(t as StoreOption).code})`
                        : t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due date */}
            <div className="space-y-2">
              <Label>Due Date (optional)</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Recurrence */}
            <div className="space-y-2">
              <Label>Recurrence</Label>
              <Select
                value={recurrenceRule}
                onValueChange={setRecurrenceRule}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {recurrenceRule !== 'once' && !dueDate && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Set a due date so the next occurrence can be calculated.
                </p>
              )}
            </div>

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Saving…' : 'Create Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
