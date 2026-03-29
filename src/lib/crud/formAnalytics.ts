import { supabase } from '../supabase';

/**
 * Get daily submission counts for the last N days, scoped to an org.
 * Returns array of { date: 'YYYY-MM-DD', count: number }
 */
export async function getSubmissionVolume(orgId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('form_submissions')
    .select('submitted_at, form:forms!inner(organization_id)')
    .eq('forms.organization_id', orgId)
    .gte('submitted_at', since.toISOString())
    .order('submitted_at', { ascending: true });

  if (error) throw error;

  // Group by date
  const counts: Record<string, number> = {};
  // Pre-fill all dates with 0
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    counts[d.toISOString().slice(0, 10)] = 0;
  }
  for (const row of data || []) {
    const date = (row.submitted_at as string).slice(0, 10);
    if (counts[date] !== undefined) counts[date]++;
  }

  return Object.entries(counts).map(([date, count]) => ({ date, count }));
}

/**
 * Get form-level completion rates (submitted / assigned).
 * Returns array of { formTitle: string, submitted: number, assigned: number, rate: number }
 */
export async function getCompletionRates(orgId: string) {
  const { data: forms, error } = await supabase
    .from('forms')
    .select('id, title')
    .eq('organization_id', orgId)
    .eq('status', 'published')
    .limit(10);

  if (error) throw error;

  const results = [];
  for (const form of forms || []) {
    const { count: submittedCount } = await supabase
      .from('form_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('form_id', form.id)
      .neq('status', 'draft');

    const { count: assignedCount } = await supabase
      .from('form_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('form_id', form.id)
      .eq('status', 'active');

    const submitted = submittedCount || 0;
    const assigned = assignedCount || 0;
    const rate = assigned > 0 ? Math.round((submitted / assigned) * 100) : (submitted > 0 ? 100 : 0);

    results.push({ formTitle: form.title, submitted, assigned, rate });
  }

  return results.filter(r => r.submitted > 0 || r.assigned > 0);
}

/**
 * Get average scores by form.
 * Returns array of { formTitle: string, avgScore: number, count: number }
 */
export async function getScoreSummary(orgId: string) {
  const { data, error } = await supabase
    .from('form_submissions')
    .select(`
      score_percentage,
      form:forms!inner(id, title, organization_id)
    `)
    .eq('forms.organization_id', orgId)
    .not('score_percentage', 'is', null)
    .limit(200);

  if (error) throw error;

  const byForm: Record<string, { title: string; scores: number[] }> = {};
  for (const row of data || []) {
    const title = (row.form as any)?.title || 'Unknown';
    const formId = (row.form as any)?.id || 'unknown';
    if (!byForm[formId]) byForm[formId] = { title, scores: [] };
    byForm[formId].scores.push(row.score_percentage as number);
  }

  return Object.values(byForm).map(({ title, scores }) => ({
    formTitle: title,
    avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    count: scores.length,
  }));
}

/**
 * Get top-level summary stats for the org.
 */
export async function getFormSummaryStats(orgId: string) {
  const [totalFormsRes, totalSubmissionsRes, pendingRes, avgScoreRes] = await Promise.all([
    supabase.from('forms').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'published'),
    supabase.from('form_submissions').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('form_submissions').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'pending_review'),
    supabase.from('form_submissions').select('score_percentage').eq('organization_id', orgId).not('score_percentage', 'is', null).limit(100),
  ]);

  const scores = (avgScoreRes.data || []).map(r => r.score_percentage as number).filter(Boolean);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return {
    totalForms: totalFormsRes.count || 0,
    totalSubmissions: totalSubmissionsRes.count || 0,
    pendingReview: pendingRes.count || 0,
    avgScore,
  };
}
