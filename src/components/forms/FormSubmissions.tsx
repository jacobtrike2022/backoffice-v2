import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  Download,
  Search,
  Filter,
  Calendar,
  FileText,
  ChevronDown,
  Eye,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getAllFormSubmissions,
  getFormById,
  getForms,
  approveFormSubmission,
  rejectFormSubmission,
} from '@/lib/crud/forms';
import { getCurrentUserProfile } from '@/lib/supabase';
import { FormRenderer } from './shared/FormRenderer';

interface FormSubmissionsProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
}

export function FormSubmissions({ currentRole = 'admin' }: FormSubmissionsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedForm, setSelectedForm] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedSubmissions, setSelectedSubmissions] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState<any | null>(null);
  const [showDetailView, setShowDetailView] = useState(false);
  const [currentSubmissionIndex, setCurrentSubmissionIndex] = useState(0);

  const { data: formsData } = useQuery({
    queryKey: ['forms-all'],
    queryFn: () => getForms({ limit: 100 }),
  });

  const { data: submissionsData, isLoading, error, refetch } = useQuery({
    queryKey: ['formSubmissions', selectedForm, filterStatus],
    queryFn: () => getAllFormSubmissions({
      formId: selectedForm === 'all' ? undefined : selectedForm,
      status: filterStatus === 'all' ? undefined : filterStatus,
      limit: 100,
    }),
  });

  const { data: formDetail, isLoading: formDetailLoading } = useQuery({
    queryKey: ['form', viewingSubmission?.form_id],
    queryFn: () => getFormById(viewingSubmission!.form_id),
    enabled: !!viewingSubmission?.form_id,
  });

  const forms = formsData?.forms || [];
  const submissions = submissionsData?.submissions || [];

  const filteredSubmissions = submissions.filter((s: any) => {
    const formTitle = (s.form as any)?.title || '';
    const submitterName = s.submitted_by
      ? `${(s.submitted_by as any).first_name || ''} ${(s.submitted_by as any).last_name || ''}`.trim()
      : '';
    const matchesSearch = !searchQuery || 
      formTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submitterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleViewSubmission = (submission: any) => {
    const index = filteredSubmissions.findIndex((s: any) => s.id === submission.id);
    setCurrentSubmissionIndex(index);
    setViewingSubmission(submission);
    setShowDetailView(true);
  };

  const handleBackToList = () => {
    setShowDetailView(false);
    setViewingSubmission(null);
  };

  const handlePreviousSubmission = () => {
    if (currentSubmissionIndex > 0) {
      const newIndex = currentSubmissionIndex - 1;
      setCurrentSubmissionIndex(newIndex);
      setViewingSubmission(filteredSubmissions[newIndex]);
    }
  };

  const handleNextSubmission = () => {
    if (currentSubmissionIndex < filteredSubmissions.length - 1) {
      const newIndex = currentSubmissionIndex + 1;
      setCurrentSubmissionIndex(newIndex);
      setViewingSubmission(filteredSubmissions[newIndex]);
    }
  };

  const handleApprove = async () => {
    if (!viewingSubmission) return;
    const profile = await getCurrentUserProfile();
    if (!profile) return;
    try {
      await approveFormSubmission(viewingSubmission.id, profile.id);
      toast.success('Submission approved');
      refetch();
      setViewingSubmission({ ...viewingSubmission, status: 'approved' });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleReject = async () => {
    if (!viewingSubmission) return;
    const reason = window.prompt('Rejection reason (optional):');
    const profile = await getCurrentUserProfile();
    if (!profile) return;
    try {
      await rejectFormSubmission(viewingSubmission.id, profile.id, reason || undefined);
      toast.success('Submission rejected');
      refetch();
      setViewingSubmission({ ...viewingSubmission, status: 'rejected' });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedSubmissions(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedSubmissions.length === filteredSubmissions.length) {
      setSelectedSubmissions([]);
    } else {
      setSelectedSubmissions(filteredSubmissions.map((s: any) => s.id));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0">
            <CheckCircle className="h-3 w-3 mr-1" />
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
        return (
          <Badge variant="secondary">{status}</Badge>
        );
    }
  };

  const getFormBlocks = () => {
    if (!formDetail?.form_blocks) return [];
    return (formDetail.form_blocks as any[]).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  };

  return (
    <div className="space-y-6">
      {showDetailView && viewingSubmission ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handleBackToList} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back to Submissions
            </Button>
            <div className="flex items-center space-x-2">
              {viewingSubmission.status === 'submitted' && (
                <>
                  <Button variant="outline" className="text-green-600 hover:text-green-700" onClick={handleApprove}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={handleReject}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </>
              )}
              <Button variant="outline" disabled>
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    {(viewingSubmission.form as any)?.title || 'Unknown Form'}
                  </CardTitle>
                  <p className="text-muted-foreground mt-1">{viewingSubmission.id}</p>
                </div>
                {getStatusBadge(viewingSubmission.status)}
              </div>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Submitted By</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {viewingSubmission.submitted_by
                        ? `${(viewingSubmission.submitted_by as any).first_name?.[0] || ''}${(viewingSubmission.submitted_by as any).last_name?.[0] || ''}`.toUpperCase()
                        : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {viewingSubmission.submitted_by
                        ? `${(viewingSubmission.submitted_by as any).first_name} ${(viewingSubmission.submitted_by as any).last_name}`
                        : '—'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Date Submitted</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <p className="font-medium">
                    {viewingSubmission.submitted_at
                      ? new Date(viewingSubmission.submitted_at).toLocaleString()
                      : '—'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Status</CardTitle>
              </CardHeader>
              <CardContent>
                {getStatusBadge(viewingSubmission.status)}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Form Responses</CardTitle>
            </CardHeader>
            <CardContent>
              {formDetailLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <FormRenderer
                  blocks={getFormBlocks().map((b: any) => ({
                    id: b.id,
                    type: b.type,
                    label: b.label,
                    description: b.description,
                    placeholder: b.placeholder,
                    is_required: b.is_required,
                    options: b.options,
                    validation_rules: b.validation_rules,
                  }))}
                  answers={viewingSubmission.answers || {}}
                  readOnly
                />
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={handlePreviousSubmission} disabled={currentSubmissionIndex === 0}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Submission {currentSubmissionIndex + 1} of {filteredSubmissions.length}
            </span>
            <Button
              variant="outline"
              onClick={handleNextSubmission}
              disabled={currentSubmissionIndex >= filteredSubmissions.length - 1}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Form Submissions</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Review and manage all form submission data
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>Export All as CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by form, submitter, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={selectedForm} onValueChange={setSelectedForm}>
                  <SelectTrigger className="w-full lg:w-[220px]">
                    <SelectValue placeholder="All Forms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Forms</SelectItem>
                    {forms.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full lg:w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="submitted">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-6 flex items-center gap-4">
                <AlertCircle className="h-8 w-8 text-red-600" />
                <div>
                  <p className="font-semibold text-red-900">Error loading submissions</p>
                  <p className="text-sm text-red-700">{(error as Error).message}</p>
                </div>
                <Button variant="outline" onClick={() => refetch()}>Retry</Button>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No submissions yet</p>
                <p className="text-sm mt-1">Submissions will appear here when users complete forms</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Showing {filteredSubmissions.length} {filteredSubmissions.length === 1 ? 'submission' : 'submissions'}
                {selectedSubmissions.length > 0 && ` (${selectedSubmissions.length} selected)`}
              </p>

              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedSubmissions.length === filteredSubmissions.length && filteredSubmissions.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Form</TableHead>
                      <TableHead>Submitted By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubmissions.map((submission: any) => (
                      <TableRow
                        key={submission.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewSubmission(submission)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedSubmissions.includes(submission.id)}
                            onCheckedChange={() => toggleSelection(submission.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{submission.id.slice(0, 8)}...</TableCell>
                        <TableCell>{(submission.form as any)?.title || '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                {submission.submitted_by
                                  ? `${(submission.submitted_by as any).first_name?.[0] || ''}${(submission.submitted_by as any).last_name?.[0] || ''}`.toUpperCase()
                                  : '?'}
                              </AvatarFallback>
                            </Avatar>
                            <span>
                              {submission.submitted_by
                                ? `${(submission.submitted_by as any).first_name} ${(submission.submitted_by as any).last_name}`
                                : '—'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {submission.submitted_at
                            ? new Date(submission.submitted_at).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell>{getStatusBadge(submission.status)}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewSubmission(submission)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
