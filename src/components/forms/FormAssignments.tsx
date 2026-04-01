import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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

function formatDate(dateStr: string | null, noDateLabel: string = 'No due date'): string {
  if (!dateStr) return noDateLabel;
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

const RECURRENCE_LABEL_KEYS: Record<string, string> = {
  daily: 'forms.recurrenceDaily',
  weekly: 'forms.recurrenceWeekly',
  monthly: 'forms.recurrenceMonthly',
};

function recurrenceBadge(rule: string | null, t: (key: string) => string) {
  if (!rule || rule === 'once') return null;
  const labelKey = RECURRENCE_LABEL_KEYS[rule];
  const label = labelKey ? t(labelKey) : rule;
  return (
    <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-0 text-xs flex items-center gap-1">
      <Repeat className="h-3 w-3" />
      {label}
    </Badge>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FormAssignments({ orgId, currentRole = 'admin' }: FormAssignmentsProps) {
  const { t } = useTranslation();
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
      setSubmitError(t('forms.pleaseSelectForm'));
      return;
    }
    if (selectedTargetId === 'none') {
      setSubmitError(t('forms.pleaseSelectTarget'));
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
        {t('forms.waitingForOrg')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t('forms.assignmentsTitle')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('forms.assignmentsSubtitle')}
          </p>
        </div>
        {canAssign && (
          <Button
            className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
            onClick={openDialog}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('forms.assignForm')}
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
            <p className="text-destructive text-sm mb-3">{t('forms.failedLoadAssignments', { error: fetchError })}</p>
            <Button variant="outline" size="sm" onClick={loadAssignments}>
              {t('forms.retry')}
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
              <p className="font-semibold text-lg">{t('forms.noAssignmentsYet')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('forms.noAssignmentsDesc')}
              </p>
            </div>
            {canAssign && (
              <Button
                className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
                onClick={openDialog}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('forms.assignForm')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {assignments.map((a) => {
            const formTitle = (a.form as any)?.title ?? 'Unknown Form';
            const formType = (a.form as any)?.type ?? '';

            return (
              <div key={a.id} className={`rounded-lg border bg-card p-4 border-l-4 ${
                a.status === 'completed' ? 'border-l-blue-400' :
                a.status === 'overdue' ? 'border-l-red-400' :
                'border-l-green-400'
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{formTitle}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <Badge className={`border-0 text-[11px] px-1.5 py-0 h-5 ${assignmentTypeBadge(a.assignment_type)}`}>
                        {a.assignment_type}
                      </Badge>
                      {recurrenceBadge(a.recurrence_rule, t)}
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(a.due_date, t('forms.noDueDate'))}
                      </span>
                      {a.recurrence_rule && a.recurrence_rule !== 'once' && a.next_due_at && (
                        <span className="text-[11px] text-indigo-500 dark:text-indigo-400">
                          {t('forms.nextDue', { date: formatDate(a.next_due_at, t('forms.noDueDate')) })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge className={`border-0 text-[11px] px-1.5 py-0 h-5 ${statusBadge(a.status)}`}>
                      {a.status}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatDate(a.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Assignment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('forms.assignFormDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('forms.assignFormDialogDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Form picker */}
            <div className="space-y-2">
              <Label>{t('forms.selectForm')}</Label>
              <Select
                value={selectedFormId || 'none'}
                onValueChange={(v) => setSelectedFormId(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('forms.selectAForm')} />
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
            </div>

            {/* Assign type */}
            <div className="space-y-2">
              <Label>{t('forms.assignTo')}</Label>
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
                  <SelectItem value="store">{t('forms.store')}</SelectItem>
                  <SelectItem value="district">{t('forms.district')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Target picker */}
            <div className="space-y-2">
              <Label>{assignType === 'store' ? t('forms.store') : t('forms.district')}</Label>
              <Select
                value={selectedTargetId}
                onValueChange={setSelectedTargetId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={assignType === 'store' ? t('forms.selectAStore') : t('forms.selectADistrict')}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {assignType === 'store' ? t('forms.selectAStore') : t('forms.selectADistrict')}
                  </SelectItem>
                  {targetOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {'code' in opt && (opt as StoreOption).code
                        ? `${opt.name} (${(opt as StoreOption).code})`
                        : opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due date */}
            <div className="space-y-2">
              <Label>{t('forms.dueDateOptional')}</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Recurrence */}
            <div className="space-y-2">
              <Label>{t('forms.recurrence')}</Label>
              <Select
                value={recurrenceRule}
                onValueChange={setRecurrenceRule}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">{t('forms.recurrenceOnce')}</SelectItem>
                  <SelectItem value="daily">{t('forms.recurrenceDaily')}</SelectItem>
                  <SelectItem value="weekly">{t('forms.recurrenceWeekly')}</SelectItem>
                  <SelectItem value="monthly">{t('forms.recurrenceMonthly')}</SelectItem>
                </SelectContent>
              </Select>
              {recurrenceRule !== 'once' && !dueDate && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t('forms.setDueDateHint')}
                </p>
              )}
            </div>

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? t('forms.saving') : t('forms.createAssignment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
