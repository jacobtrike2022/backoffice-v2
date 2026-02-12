import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Plus,
  Search,
  Grid3x3,
  List,
  MoreVertical,
  Eye,
  Copy,
  Edit,
  Users,
  FileText,
  Archive,
  Trash2,
  Calendar,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getForms, archiveForm, updateForm } from '@/lib/crud/forms';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Form {
  id: string;
  title: string;
  description?: string;
  type: 'ojt-checklist' | 'inspection' | 'audit' | 'survey' | 'other';
  category?: string;
  status: 'draft' | 'published' | 'archived';
  requires_approval: boolean;
  allow_anonymous: boolean;
  created_at: string;
  updated_at: string;
  created_by: {
    name: string;
  };
}

interface FormLibraryProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
  onFormSelect?: (formId: string) => void;
  onEdit?: (formId: string) => void;
  onCreateNew?: () => void;
}

export function FormLibrary({ currentRole = 'admin', onFormSelect, onEdit, onCreateNew }: FormLibraryProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('modified');
  const [page, setPage] = useState(0);

  // Fetch forms from database
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['forms', filterStatus, searchQuery, sortBy, page],
    queryFn: () => getForms({
      status: filterStatus === 'all' ? undefined : filterStatus as 'draft' | 'published' | 'archived',
      search: searchQuery || undefined,
      limit: 20,
      offset: page * 20
    })
  });

  const forms = data?.forms || [];
  const totalForms = data?.total || 0;

  // Archive form mutation
  const archiveMutation = useMutation({
    mutationFn: archiveForm,
    onSuccess: () => {
      toast.success('Form archived successfully');
      queryClient.invalidateQueries({ queryKey: ['forms'] });
    },
    onError: (error: Error) => {
      toast.error(`Error archiving form: ${error.message}`);
    }
  });

  // Helper functions for badges
  const getTypeBadge = (type: string) => {
    const typeColors: Record<string, string> = {
      'ojt-checklist': 'bg-blue-100 text-blue-700 border-blue-300',
      'inspection': 'bg-green-100 text-green-700 border-green-300',
      'audit': 'bg-purple-100 text-purple-700 border-purple-300',
      'survey': 'bg-orange-100 text-orange-700 border-orange-300',
      'other': 'bg-gray-100 text-gray-700 border-gray-300',
    };

    const typeLabels: Record<string, string> = {
      'ojt-checklist': 'OJT Checklist',
      'inspection': 'Inspection',
      'audit': 'Audit',
      'survey': 'Survey',
      'other': 'Other',
    };

    return (
      <Badge className={`${typeColors[type] || typeColors['other']} border`}>
        {typeLabels[type] || type}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      'published': 'bg-green-100 text-green-700 border-green-300',
      'draft': 'bg-yellow-100 text-yellow-700 border-yellow-300',
      'archived': 'bg-gray-100 text-gray-700 border-gray-300',
    };

    return (
      <Badge className={`${statusColors[status] || statusColors['draft']} border`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
          <div className="h-10 w-32 bg-gray-200 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="h-64">
              <CardContent className="p-6">
                <div className="space-y-4 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-20 bg-gray-200 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">Error loading forms</h3>
                <p className="text-sm text-red-700 mt-1">{error.message}</p>
              </div>
              <Button onClick={() => refetch()} variant="outline" className="border-red-300">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Form Library</h1>
        <Button onClick={onCreateNew} className="bg-brand-gradient">
          <Plus className="h-4 w-4 mr-2" />
          New Form
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search forms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Forms</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="modified">Last Modified</SelectItem>
            <SelectItem value="created">Date Created</SelectItem>
            <SelectItem value="title">Title</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Forms Grid/List */}
      {forms.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No forms found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || filterStatus !== 'all'
                ? 'Try adjusting your filters or search query'
                : 'Get started by creating your first form'}
            </p>
            {!searchQuery && filterStatus === 'all' && (
              <Button onClick={onCreateNew} className="bg-brand-gradient">
                <Plus className="h-4 w-4 mr-2" />
                Create First Form
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {forms.map((form) => (
            <Card
              key={form.id}
              className="hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => onFormSelect?.(form.id)}
            >
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onEdit?.(form.id);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Form
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                          <Users className="h-4 w-4 mr-2" />
                          Assign to Units
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                          <FileText className="h-4 w-4 mr-2" />
                          View Submissions
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          archiveMutation.mutate(form.id);
                        }}>
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={(e) => e.stopPropagation()}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">{form.title}</h3>
                    <div className="flex flex-wrap gap-2">
                      {getTypeBadge(form.type)}
                      {getStatusBadge(form.status)}
                    </div>
                  </div>

                  {form.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {form.description}
                    </p>
                  )}

                  <div className="pt-4 border-t text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <div>
                        <p>Modified {new Date(form.updated_at).toLocaleDateString()}</p>
                        <p>by {form.created_by?.name || 'Unknown'}</p>
                      </div>
                      {form.category && (
                        <Badge className="bg-brand-gradient text-white border-0 text-[10px] px-2 py-0 h-5">
                          {form.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {forms.map((form) => (
            <Card
              key={form.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onFormSelect?.(form.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <FileText className="h-10 w-10 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold">{form.title}</h3>
                        {getTypeBadge(form.type)}
                        {getStatusBadge(form.status)}
                      </div>
                      <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          Modified {new Date(form.updated_at).toLocaleDateString()}
                        </span>
                        <span>by {form.created_by?.name || 'Unknown'}</span>
                        {form.category && (
                          <Badge className="bg-brand-gradient text-white border-0 text-xs">
                            {form.category}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        onEdit?.(form.id);
                      }}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Form
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                        <Users className="h-4 w-4 mr-2" />
                        Assign to Units
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                        <FileText className="h-4 w-4 mr-2" />
                        View Submissions
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        archiveMutation.mutate(form.id);
                      }}>
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={(e) => e.stopPropagation()}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalForms > 20 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            Showing {page * 20 + 1}-{Math.min((page + 1) * 20, totalForms)} of {totalForms} forms
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * 20 >= totalForms}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
