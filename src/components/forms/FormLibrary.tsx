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
  Calendar
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

interface Form {
  id: string;
  title: string;
  type: 'OJT Checklist' | 'Inspection' | 'Audit' | 'Survey';
  status: 'Published' | 'Draft' | 'Archived';
  submissions: number;
  assignments: number;
  lastModified: string;
  createdBy: string;
  tags: string[];
}

const mockForms: Form[] = [
  {
    id: '1',
    title: 'Days 1-5 OJT Checklist',
    type: 'OJT Checklist',
    status: 'Published',
    submissions: 47,
    assignments: 12,
    lastModified: '2024-02-10',
    createdBy: 'Sarah Johnson',
    tags: ['Training', 'New Hire']
  },
  {
    id: '2',
    title: 'Store Daily Walk',
    type: 'Inspection',
    status: 'Published',
    submissions: 234,
    assignments: 8,
    lastModified: '2024-02-15',
    createdBy: 'Mike Chen',
    tags: ['Daily', 'Recurring', 'Ops']
  },
  {
    id: '3',
    title: 'Store Inspection Checklist',
    type: 'Inspection',
    status: 'Published',
    submissions: 89,
    assignments: 15,
    lastModified: '2024-02-12',
    createdBy: 'Sarah Johnson',
    tags: ['Quality', 'Compliance']
  },
  {
    id: '4',
    title: 'Safety Audit Form',
    type: 'Audit',
    status: 'Published',
    submissions: 23,
    assignments: 5,
    lastModified: '2024-02-08',
    createdBy: 'Mike Chen',
    tags: ['Safety', 'Monthly']
  },
  {
    id: '5',
    title: 'License Audit Checklist',
    type: 'Audit',
    status: 'Draft',
    submissions: 0,
    assignments: 0,
    lastModified: '2024-02-14',
    createdBy: 'Sarah Johnson',
    tags: ['Legal', 'Quarterly', 'Admin']
  },
  {
    id: '6',
    title: 'Night Shift Closing Procedures',
    type: 'OJT Checklist',
    status: 'Published',
    submissions: 56,
    assignments: 9,
    lastModified: '2024-02-11',
    createdBy: 'Alex Rodriguez',
    tags: ['Closing', 'Night']
  }
];

interface FormLibraryProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
  onFormSelect?: (formId: string) => void;
}

export function FormLibrary({ currentRole = 'admin', onFormSelect }: FormLibraryProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('modified');

  const filteredForms = mockForms.filter(form => {
    const matchesSearch = searchQuery === '' || 
      form.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.type.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || form.status.toLowerCase() === filterStatus;
    
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'created') return new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime();
    if (sortBy === 'used') return b.submissions - a.submissions;
    return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Published':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0">Published</Badge>;
      case 'Draft':
        return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-0">Draft</Badge>;
      case 'Archived':
        return <Badge variant="outline">Archived</Badge>;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors = {
      'OJT Checklist': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      'Inspection': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      'Audit': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      'Survey': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
    };
    return <Badge className={`${colors[type as keyof typeof colors]} border-0`}>{type}</Badge>;
  };

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
        <Button className="bg-brand-gradient text-white shadow-brand hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" />
          New Form
        </Button>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                <SelectItem value="all">All Forms</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="modified">Recently Modified</SelectItem>
                <SelectItem value="created">Date Created</SelectItem>
                <SelectItem value="title">Alphabetical</SelectItem>
                <SelectItem value="used">Most Used</SelectItem>
              </SelectContent>
            </Select>

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

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredForms.length} {filteredForms.length === 1 ? 'form' : 'forms'}
        </p>
      </div>

      {/* Forms Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredForms.map((form) => (
            <Card 
              key={form.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => onFormSelect?.(form.id)}
            >
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <FileText className="h-10 w-10 text-primary" />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Form
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Users className="h-4 w-4 mr-2" />
                          Assign to Units
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <FileText className="h-4 w-4 mr-2" />
                          View Submissions
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
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

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Submissions</p>
                      <p className="font-semibold">{form.submissions}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Assignments</p>
                      <p className="font-semibold">{form.assignments}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t text-xs text-muted-foreground">
                    <div className="flex items-end justify-between">
                      <div>
                        <p>Modified {new Date(form.lastModified).toLocaleDateString()}</p>
                        <p>by {form.createdBy}</p>
                      </div>
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
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredForms.map((form) => (
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
                        <span>{form.submissions} submissions</span>
                        <span>{form.assignments} assignments</span>
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          Modified {new Date(form.lastModified).toLocaleDateString()}
                        </span>
                        <span>by {form.createdBy}</span>
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
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Form
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Users className="h-4 w-4 mr-2" />
                        Assign to Units
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <FileText className="h-4 w-4 mr-2" />
                        View Submissions
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <FileText className="h-4 w-4 mr-2" />
                        Export Submissions
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600">
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
    </div>
  );
}