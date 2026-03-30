import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import {
  Plus,
  Search,
  Grid3x3,
  List,
  MoreVertical,
  Copy,
  Edit,
  FileText,
  Archive,
  Trash2,
  Calendar,
  Building2,
  Share2,
  Link2,
  Check,
  Download,
  QrCode,
  Repeat,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { QRCodeCanvas } from 'qrcode.react';
import { getForms, archiveForm, duplicateForm, deleteForm } from '../../lib/crud/forms';
import { supabase } from '../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FormRecord {
  id: string;
  organization_id: string;
  title: string;
  description?: string;
  type: string;
  category?: string;
  status: string;
  is_template?: boolean;
  tags?: string[];
  requires_approval: boolean;
  created_by_id?: string;
  created_by?: { first_name?: string; last_name?: string };
  created_at: string;
  updated_at: string;
}

interface FormLibraryProps {
  orgId: string;
  currentRole?: 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';
  onNewForm?: () => void;
  onEditForm?: (formId: string) => void;
  onViewSubmissions?: (formId: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusDot(status: string) {
  switch (status.toLowerCase()) {
    case 'published':
      return <span className="inline-block h-2 w-2 rounded-full bg-green-500 shrink-0" />;
    case 'draft':
      return <span className="inline-block h-2 w-2 rounded-full bg-yellow-400 shrink-0" />;
    case 'archived':
      return <span className="inline-block h-2 w-2 rounded-full bg-gray-400 shrink-0" />;
    default:
      return <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground shrink-0" />;
  }
}

function getStatusBadge(status: string) {
  switch (status.toLowerCase()) {
    case 'published':
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0 flex items-center gap-1">
          {getStatusDot(status)}
          Published
        </Badge>
      );
    case 'draft':
      return (
        <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-0 flex items-center gap-1">
          {getStatusDot(status)}
          Draft
        </Badge>
      );
    case 'archived':
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          {getStatusDot(status)}
          Archived
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

const TYPE_COLORS: Record<string, string> = {
  'ojt-checklist': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  inspection: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  audit: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  survey: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
};

const TYPE_LABELS: Record<string, string> = {
  'ojt-checklist': 'OJT Checklist',
  inspection: 'Inspection',
  audit: 'Audit',
  survey: 'Survey',
};

function getTypeBadge(type: string) {
  const colorClass = TYPE_COLORS[type.toLowerCase()] ?? 'bg-gray-100 text-gray-700';
  const label = TYPE_LABELS[type.toLowerCase()] ?? type;
  return <Badge className={`${colorClass} border-0`}>{label}</Badge>;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-6 space-y-4">
            <div className="h-10 w-10 bg-muted rounded" />
            <div className="h-5 w-3/4 bg-muted rounded" />
            <div className="flex gap-2">
              <div className="h-5 w-20 bg-muted rounded-full" />
              <div className="h-5 w-16 bg-muted rounded-full" />
            </div>
            <div className="h-4 w-1/2 bg-muted rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Card Actions ────────────────────────────────────────────────────────────

interface CardActionsProps {
  form: FormRecord;
  canEdit: boolean;
  canArchive: boolean;
  canDelete: boolean;
  isSuperAdmin?: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onViewSubmissions: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onCloneToOrg?: () => void;
  onShare: () => void;
}

function CardActions({
  form,
  canEdit,
  canArchive,
  canDelete,
  isSuperAdmin,
  onEdit,
  onDuplicate,
  onViewSubmissions,
  onArchive,
  onDelete,
  onCloneToOrg,
  onShare,
}: CardActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="sm">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Form
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare(); }}>
          <Share2 className="h-4 w-4 mr-2" />
          Share / QR Code
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
          <Copy className="h-4 w-4 mr-2" />
          Duplicate
        </DropdownMenuItem>
        {isSuperAdmin && form.is_template && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCloneToOrg?.(); }}>
            <Building2 className="h-4 w-4 mr-2" />
            Duplicate to org...
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewSubmissions(); }}>
          <FileText className="h-4 w-4 mr-2" />
          View Submissions
        </DropdownMenuItem>
        {(canArchive || canDelete) && <DropdownMenuSeparator />}
        {canArchive && form.status !== 'archived' && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(); }}>
            <Archive className="h-4 w-4 mr-2" />
            Archive
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem
            className="text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Share QR Dialog ────────────────────────────────────────────────────────

interface ShareQRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  formTitle: string;
}

function ShareQRDialog({ open, onOpenChange, formId, formTitle }: ShareQRDialogProps) {
  const [linkCopied, setLinkCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const publicFillUrl = `${window.location.origin}/fill/${formId}`;

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicFillUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = publicFillUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }, [publicFillUrl]);

  const handleDownloadQR = useCallback(() => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `form-${formId}-qrcode.png`;
    link.href = url;
    link.click();
  }, [formId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <QrCode className="h-5 w-5" />
            <span>Share Form</span>
          </DialogTitle>
          <DialogDescription>
            Share "{formTitle}" via QR code or direct link.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 pt-2">
          {/* QR Code */}
          <div ref={qrRef} className="bg-white p-4 rounded-lg border">
            <QRCodeCanvas
              value={publicFillUrl}
              size={180}
              level="H"
              includeMargin={false}
            />
          </div>

          {/* Public Link */}
          <div className="w-full space-y-2">
            <p className="text-xs text-muted-foreground">
              Anyone with this link can fill out the form without signing in.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-md px-3 py-2 text-sm font-mono truncate border">
                {publicFillUrl}
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyLink} className="flex-shrink-0">
                {linkCopied ? (
                  <>
                    <Check className="h-4 w-4 mr-1 text-green-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          <Separator />

          <Button variant="outline" size="sm" onClick={handleDownloadQR} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download QR Code as PNG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FormLibrary({
  orgId,
  currentRole = 'admin',
  onNewForm,
  onEditForm,
  onViewSubmissions,
}: FormLibraryProps) {
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterTag, setFilterTag] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [shareForm, setShareForm] = useState<FormRecord | null>(null);

  // Set of form IDs that have active recurring assignments
  const [recurringFormIds, setRecurringFormIds] = useState<Set<string>>(new Set());

  const canEdit = currentRole === 'admin' || currentRole === 'trike-super-admin';
  const canArchive = currentRole === 'admin' || currentRole === 'trike-super-admin';
  const canDelete = currentRole === 'admin' || currentRole === 'trike-super-admin';
  const canCreate = currentRole === 'admin' || currentRole === 'trike-super-admin';
  const isSuperAdmin = currentRole === 'trike-super-admin';

  async function loadForms() {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await getForms(
        {
          status: filterStatus !== 'all' ? filterStatus : undefined,
          type: filterType !== 'all' ? filterType : undefined,
          search: searchQuery || undefined,
          is_template: isSuperAdmin && showTemplates ? true : undefined,
        },
        orgId
      );
      setForms((data as FormRecord[]) || []);
    } catch (err) {
      console.error('Failed to load forms:', err);
      setError('Failed to load forms. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function loadRecurringFormIds() {
    if (!orgId) return;
    try {
      const { data } = await supabase
        .from('form_assignments')
        .select('form_id, recurrence_rule')
        .eq('status', 'active')
        .neq('recurrence_rule', 'once');
      if (data && data.length > 0) {
        setRecurringFormIds(new Set(data.map((r: any) => r.form_id as string)));
      } else {
        setRecurringFormIds(new Set());
      }
    } catch {
      // non-critical — the column may not exist yet if migration hasn't run
      setRecurringFormIds(new Set());
    }
  }

  useEffect(() => {
    loadForms();
    loadRecurringFormIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, filterStatus, filterType, showTemplates]);

  // Debounced search: trigger reload when searchQuery settles
  useEffect(() => {
    const timer = setTimeout(() => {
      loadForms();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  async function handleDuplicate(formId: string) {
    try {
      await duplicateForm(formId, orgId);
      await loadForms();
    } catch (err) {
      console.error('Failed to duplicate form:', err);
    }
  }

  async function handleArchive(formId: string) {
    try {
      await archiveForm(formId);
      await loadForms();
    } catch (err) {
      console.error('Failed to archive form:', err);
    }
  }

  async function handleDelete(formId: string) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this form? This action cannot be undone.'
    );
    if (!confirmed) return;
    try {
      await deleteForm(formId);
      await loadForms();
    } catch (err) {
      console.error('Failed to delete form:', err);
    }
  }

  function handleCloneToOrg(_formId: string) {
    // Template cloning to a specific org is an admin operation done at provisioning time.
    // For now, show a message — actual per-org cloning is handled automatically for new demo orgs.
    window.alert('Template cloning happens automatically for new demo orgs.');
  }

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    forms.forEach(f => (f.tags || []).forEach((t: string) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [forms]);

  const filteredForms = filterTag
    ? forms.filter(f => (f.tags || []).includes(filterTag))
    : forms;

  if (!orgId) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        Waiting for organization data…
      </div>
    );
  }

  const sharedCardActionsProps = (form: FormRecord): CardActionsProps => ({
    form,
    canEdit,
    canArchive,
    canDelete,
    isSuperAdmin,
    onEdit: () => onEditForm?.(form.id),
    onDuplicate: () => handleDuplicate(form.id),
    onViewSubmissions: () => onViewSubmissions?.(form.id),
    onArchive: () => handleArchive(form.id),
    onDelete: () => handleDelete(form.id),
    onCloneToOrg: () => handleCloneToOrg(form.id),
    onShare: () => setShareForm(form),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Form Library</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and organize all your forms in one place
          </p>
        </div>
        {canCreate && (
          <Button
            className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
            onClick={onNewForm}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Form
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search forms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full lg:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="inspection">Inspection</SelectItem>
                <SelectItem value="audit">Audit</SelectItem>
                <SelectItem value="survey">Survey</SelectItem>
                <SelectItem value="ojt-checklist">OJT Checklist</SelectItem>
              </SelectContent>
            </Select>

            {/* Tag Filter */}
            {allTags.length > 0 && (
              <Select value={filterTag || 'all'} onValueChange={(v) => setFilterTag(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-full lg:w-[140px]">
                  <SelectValue placeholder="All Tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {allTags.map(tag => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Template Toggle — super admin only */}
            {isSuperAdmin && (
              <Button
                variant={showTemplates ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowTemplates((v) => !v)}
                className={showTemplates ? 'bg-brand-gradient text-white' : ''}
              >
                Templates
              </Button>
            )}

            {/* View Toggle */}
            <div className="flex border rounded-lg">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-brand-gradient' : ''}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-brand-gradient' : ''}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 flex items-center justify-between">
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={loadForms}
            className="text-sm font-medium text-destructive underline ml-4 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Results Count */}
      {!loading && !error && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredForms.length} {filteredForms.length === 1 ? 'form' : 'forms'}
          </p>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && <GridSkeleton />}

      {/* Empty State */}
      {!loading && !error && filteredForms.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <FileText className="h-8 w-8 text-muted-foreground opacity-60" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              {filterStatus !== 'all' || filterType !== 'all' || filterTag || searchQuery
                ? 'No matching forms'
                : 'No forms yet'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {filterStatus !== 'all' || filterType !== 'all' || filterTag || searchQuery
                ? 'Try adjusting your filters or search query.'
                : 'Create your first form to get started.'}
            </p>
          </div>
          {canCreate && filterStatus === 'all' && filterType === 'all' && !searchQuery && (
            <Button
              className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
              onClick={onNewForm}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create your first form
            </Button>
          )}
        </div>
      )}

      {/* Grid View */}
      {!loading && !error && filteredForms.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredForms.map((form) => (
            <Card key={form.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <FileText className="h-10 w-10 text-primary" />
                    <CardActions {...sharedCardActionsProps(form)} />
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">{form.title}</h3>
                    <div className="flex flex-wrap gap-2">
                      {getTypeBadge(form.type)}
                      {getStatusBadge(form.status)}
                      {form.is_template && (
                        <Badge className="bg-amber-500 text-white border-0 font-semibold text-[10px] px-2">
                          TEMPLATE
                        </Badge>
                      )}
                      {recurringFormIds.has(form.id) && (
                        <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-0 text-[10px] px-2 flex items-center gap-1">
                          <Repeat className="h-3 w-3" />
                          Recurring
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t text-xs text-muted-foreground">
                    <div className="flex items-end justify-between">
                      <div>
                        <p>
                          Modified{' '}
                          {new Date(form.updated_at).toLocaleDateString()}
                        </p>
                        {(form.created_by?.first_name || form.created_by?.last_name) && (
                          <p>by {[form.created_by.first_name, form.created_by.last_name].filter(Boolean).join(' ')}</p>
                        )}
                      </div>
                      {form.tags && form.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-end">
                          {form.tags.map((tag, index) => (
                            <Badge
                              key={index}
                              className="bg-brand-gradient text-white border-0 text-[10px] px-2 py-0 h-5"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* List View */}
      {!loading && !error && filteredForms.length > 0 && viewMode === 'list' && (
        <div className="space-y-4">
          {filteredForms.map((form) => (
            <Card key={form.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <FileText className="h-10 w-10 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-2">
                        <h3 className="font-semibold">{form.title}</h3>
                        {getTypeBadge(form.type)}
                        {getStatusBadge(form.status)}
                        {form.is_template && (
                          <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10">
                            Template
                          </Badge>
                        )}
                        {recurringFormIds.has(form.id) && (
                          <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-0 text-[10px] px-2 flex items-center gap-1">
                            <Repeat className="h-3 w-3" />
                            Recurring
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          Modified{' '}
                          {new Date(form.updated_at).toLocaleDateString()}
                        </span>
                        {(form.created_by?.first_name || form.created_by?.last_name) && (
                          <span>by {[form.created_by.first_name, form.created_by.last_name].filter(Boolean).join(' ')}</span>
                        )}
                        {form.tags && form.tags.length > 0 && (
                          <span className="flex flex-wrap gap-1">
                            {form.tags.map((tag, index) => (
                              <Badge
                                key={index}
                                className="bg-brand-gradient text-white border-0 text-[10px] px-2 py-0 h-5"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <CardActions {...sharedCardActionsProps(form)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Share QR Code Dialog */}
      {shareForm && (
        <ShareQRDialog
          open={!!shareForm}
          onOpenChange={(open) => { if (!open) setShareForm(null); }}
          formId={shareForm.id}
          formTitle={shareForm.title}
        />
      )}
    </div>
  );
}
