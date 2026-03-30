import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { ClipboardList, Calendar, ArrowRight, Repeat, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormAssignmentItem {
  id: string;
  form_id: string;
  form_title: string;
  due_date: string | null;
  status: string;
  recurrence_rule: string | null;
  next_due_at: string | null;
  submission_status: 'not_started' | 'in_progress' | 'completed';
}

interface MyFormsWidgetProps {
  orgId: string | null;
  onNavigate?: (view: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

function formatDueDate(dateStr: string | null, noDueDateLabel: string): string {
  if (!dateStr) return noDueDateLabel;
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function submissionStatusClass(status: 'not_started' | 'in_progress' | 'completed'): string {
  switch (status) {
    case 'not_started': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    case 'in_progress': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MyFormsWidget({ orgId, onNavigate }: MyFormsWidgetProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<FormAssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAssignments() {
      setLoading(true);

      try {
        // Fetch active form assignments scoped through the forms join (no org_id on form_assignments)
        // Try with recurrence columns first; fall back if they don't exist yet
        let assignments: any[] | null = null;

        const fullQuery = await supabase
          .from('form_assignments')
          .select(`
            id,
            due_date,
            status,
            recurrence_rule,
            next_due_at,
            form:forms!form_assignments_form_id_fkey(id, title, organization_id)
          `)
          .eq('status', 'active')
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(50);

        if (fullQuery.error && fullQuery.error.message.includes('recurrence_rule')) {
          // Columns not yet migrated — retry without them
          const fallback = await supabase
            .from('form_assignments')
            .select(`
              id,
              due_date,
              status,
              form:forms!form_assignments_form_id_fkey(id, title, organization_id)
            `)
            .eq('status', 'active')
            .order('due_date', { ascending: true, nullsFirst: false })
            .limit(50);

          if (fallback.error) {
            console.error('MyFormsWidget: failed to fetch assignments', fallback.error);
            if (!cancelled) setLoading(false);
            return;
          }
          assignments = (fallback.data || []).map((row: any) => ({
            ...row,
            recurrence_rule: 'once',
            next_due_at: null,
          }));
        } else if (fullQuery.error) {
          console.error('MyFormsWidget: failed to fetch assignments', fullQuery.error);
          if (!cancelled) setLoading(false);
          return;
        } else {
          assignments = fullQuery.data;
        }

        // Filter to this org
        const orgAssignments = (assignments || []).filter(
          (a) => (a.form as any)?.organization_id === orgId
        );

        // For each assignment, determine submission status.
        // In demo mode (no current user) we check if ANY submission exists for the form.
        const formIds = [...new Set(orgAssignments.map((a) => (a.form as any)?.id).filter(Boolean))];

        let submissionMap: Record<string, string> = {};
        if (formIds.length > 0) {
          const { data: submissions } = await supabase
            .from('form_submissions')
            .select('form_id, status')
            .in('form_id', formIds);

          // Build a map: form_id -> best status (approved > pending > rejected)
          for (const sub of (submissions || [])) {
            const existing = submissionMap[sub.form_id];
            if (!existing) {
              submissionMap[sub.form_id] = sub.status;
            } else if (sub.status === 'approved' || sub.status === 'completed') {
              submissionMap[sub.form_id] = sub.status;
            }
          }
        }

        const mapped: FormAssignmentItem[] = orgAssignments.map((a) => {
          const formId = (a.form as any)?.id || '';
          const subStatus = submissionMap[formId];
          let submissionStatus: 'not_started' | 'in_progress' | 'completed' = 'not_started';
          if (subStatus === 'approved' || subStatus === 'completed') {
            submissionStatus = 'completed';
          } else if (subStatus === 'pending' || subStatus === 'rejected') {
            submissionStatus = 'in_progress';
          }

          return {
            id: a.id,
            form_id: formId,
            form_title: (a.form as any)?.title || 'Untitled Form',
            due_date: a.due_date,
            status: a.status,
            recurrence_rule: a.recurrence_rule,
            next_due_at: a.next_due_at,
            submission_status: submissionStatus,
          };
        });

        // Sort: overdue first (by due date asc), then non-overdue by due date asc, then no-due-date last
        mapped.sort((a, b) => {
          const aOverdue = isOverdue(a.due_date) && a.submission_status !== 'completed';
          const bOverdue = isOverdue(b.due_date) && b.submission_status !== 'completed';
          if (aOverdue && !bOverdue) return -1;
          if (!aOverdue && bOverdue) return 1;
          // Both same overdue status — sort by due date
          if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          if (a.due_date && !b.due_date) return -1;
          if (!a.due_date && b.due_date) return 1;
          return 0;
        });

        if (!cancelled) {
          setItems(mapped.slice(0, 5));
          setLoading(false);
        }
      } catch (err) {
        console.error('MyFormsWidget: unexpected error', err);
        if (!cancelled) setLoading(false);
      }
    }

    fetchAssignments();
    return () => { cancelled = true; };
  }, [orgId]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Card className="border-border/50 shadow-sm w-full">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            {t('forms.myFormsTitle')}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs self-start sm:self-auto"
            onClick={() => onNavigate?.('forms')}
          >
            {t('forms.viewAll')}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('forms.myFormsSubtitle')}</p>
      </CardHeader>
      <CardContent className="pb-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <ClipboardList className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">{t('forms.noFormsAssigned')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('forms.noFormsAssignedDesc')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const overdue = isOverdue(item.due_date) && item.submission_status !== 'completed';
              return (
                <div
                  key={item.id}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border transition-colors ${
                    overdue
                      ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                      : 'bg-accent/20 border-border/50 hover:border-primary/50'
                  }`}
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-medium text-sm truncate">{item.form_title}</h4>
                      {item.recurrence_rule && item.recurrence_rule !== 'once' && (
                        <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-0 text-xs flex items-center gap-1">
                          <Repeat className="h-3 w-3" />
                          {t(`forms.recurrence_${item.recurrence_rule}`, { defaultValue: item.recurrence_rule })}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className={`flex items-center gap-1 ${overdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
                        {overdue && <AlertCircle className="h-3 w-3" />}
                        <Calendar className="h-3 w-3" />
                        {overdue ? `${t('forms.overdue')} — ` : ''}
                        {formatDueDate(item.due_date, t('forms.noDueDate'))}
                      </span>
                      <Badge className={`border-0 text-xs ${submissionStatusClass(item.submission_status)}`}>
                        {item.submission_status === 'not_started'
                          ? t('forms.statusNotStarted')
                          : item.submission_status === 'in_progress'
                          ? t('forms.statusInProgress')
                          : t('forms.statusCompleted')}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {item.submission_status !== 'completed' && (
                      <Button
                        size="sm"
                        variant={overdue ? 'default' : 'outline'}
                        className={`h-7 text-xs ${overdue ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}
                        onClick={() => {
                          // Navigate to fill form — in a real app this would use router
                          window.location.hash = `fill/${item.form_id}`;
                        }}
                      >
                        {t('forms.fillForm')}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
