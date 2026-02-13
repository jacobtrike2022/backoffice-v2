import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  ArrowLeft,
  Edit,
  Eye,
  Users,
  FileText,
  Calendar,
  Clock,
  TrendingUp,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Share2,
  Loader2
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { getFormById, getFormSubmissions, getFormAssignments } from '@/lib/crud/forms';
import { FormRenderer } from './shared/FormRenderer';

interface FormDetailProps {
  formId: string;
  onBack: () => void;
  onEdit: (formId?: string) => void;
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
}

export function FormDetail({ formId, onBack, onEdit, currentRole = 'admin' }: FormDetailProps) {
  const { data: form, isLoading: formLoading, error: formError } = useQuery({
    queryKey: ['form', formId],
    queryFn: () => getFormById(formId),
  });

  const { data: submissions } = useQuery({
    queryKey: ['formSubmissions', formId],
    queryFn: () => getFormSubmissions(formId),
    enabled: !!formId,
  });

  const { data: assignmentsData } = useQuery({
    queryKey: ['formAssignments', formId],
    queryFn: () => getFormAssignments({ formId }),
    enabled: !!formId,
  });

  const assignments = assignmentsData?.assignments || [];
  const activeAssignments = assignments.filter((a: any) => a.status === 'active').length;
  const approvedCount = (submissions || []).filter((s: any) => s.status === 'approved').length;
  const totalSubmissions = (submissions || []).length;
  const completionRate = totalSubmissions > 0
    ? Math.round((approvedCount / totalSubmissions) * 100)
    : 0;

  const submissionTrendData = useMemo(() => {
    if (!submissions?.length) return [];
    const byDate: Record<string, number> = {};
    submissions.forEach((s: any) => {
      const d = new Date(s.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      byDate[d] = (byDate[d] || 0) + 1;
    });
    return Object.entries(byDate)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .slice(-7)
      .map(([date, submissions]) => ({ date, submissions }));
  }, [submissions]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-0">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      case 'submitted':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-0">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formBlocks = form?.form_blocks
    ? [...(form.form_blocks as any[])].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    : [];

  if (formLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (formError || !form) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Library
        </Button>
        <Card className="border-red-200">
          <CardContent className="p-6 flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
            <div>
              <p className="font-semibold">Form not found</p>
              <p className="text-sm text-muted-foreground">
                {(formError as Error)?.message || 'The form may have been deleted.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const createdBy = (form.created_by as any)?.name || 
    `${(form.created_by as any)?.first_name || ''} ${(form.created_by as any)?.last_name || ''}`.trim() ||
    'Unknown';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Library
        </Button>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" disabled>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="sm" disabled>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
            onClick={() => onEdit?.(formId)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Form
          </Button>
        </div>
      </div>

      <div>
        <div className="flex items-center space-x-3 mb-2">
          <h1 className="text-foreground">{form.title}</h1>
          <Badge
            className={
              form.status === 'published'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0'
                : form.status === 'draft'
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-0'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 border-0'
            }
          >
            {form.status}
          </Badge>
        </div>
        <p className="text-muted-foreground">{form.description || 'No description'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Submissions</p>
                <p className="text-3xl font-bold mt-2">{totalSubmissions}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Assignments</p>
                <p className="text-3xl font-bold mt-2">{activeAssignments}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approval Rate</p>
                <p className="text-3xl font-bold mt-2">{completionRate}%</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-3xl font-bold mt-2">{approvedCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Activity className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Form Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Created</p>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{new Date(form.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">by {createdBy}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Last Updated</p>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{new Date(form.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Form Type</p>
              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-0">
                {form.type || '—'}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Category</p>
              <span className="text-sm">{form.category || '—'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Eye className="h-5 w-5" />
                <span>Form Preview</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-muted/30">
                <FormRenderer
                  blocks={formBlocks.map((b: any) => ({
                    id: b.id,
                    type: b.type,
                    label: b.label,
                    description: b.description,
                    placeholder: b.placeholder,
                    is_required: b.is_required,
                    options: b.options,
                    validation_rules: b.validation_rules,
                  }))}
                  answers={{}}
                  readOnly
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {submissionTrendData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Submission Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={submissionTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#9ca3af' }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="submissions" 
                      stroke="#F74A05" 
                      strokeWidth={2}
                      dot={{ fill: '#F74A05', r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(submissions || []).slice(0, 5).map((submission: any) => (
                  <div
                    key={submission.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-brand-gradient text-white">
                          {submission.submitted_by
                            ? `${(submission.submitted_by as any).first_name?.[0] || ''}${(submission.submitted_by as any).last_name?.[0] || ''}`.toUpperCase()
                            : '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {submission.submitted_by
                            ? `${(submission.submitted_by as any).first_name} ${(submission.submitted_by as any).last_name}`
                            : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {submission.submitted_at
                            ? new Date(submission.submitted_at).toLocaleString()
                            : '—'}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(submission.status)}
                  </div>
                ))}
                {(!submissions || submissions.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-8">No submissions yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
