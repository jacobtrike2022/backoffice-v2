import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Footer } from './Footer';
import { 
  Plus, 
  Search, 
  Filter,
  Calendar,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  PlaySquare,
  MoreVertical,
  RefreshCw
} from 'lucide-react';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { supabase, getCurrentUserOrgId } from '../lib/supabase';
import { recalculateAllProgress } from '../lib/crud/progressCalculations';
import { toast } from 'sonner@2.0.3';

interface Assignment {
  id: string;
  organization_id: string;
  user_id: string;
  playlist_id: string;
  assigned_by: string;
  assigned_at: string;
  due_date: string | null;
  status: string;
  progress_percent: number;
  // Joined data
  playlist?: {
    title: string;
    type: string;
  };
  user?: {
    first_name: string;
    last_name: string;
  };
  assigner?: {
    first_name: string;
    last_name: string;
  };
}

interface AssignmentsProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
  onOpenAssignmentWizard?: () => void;
}

export function Assignments({ currentRole = 'admin', onOpenAssignmentWizard }: AssignmentsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const orgId = await getCurrentUserOrgId();
      if (!orgId) return;

      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          playlist:playlists(title, type),
          user:users!user_id(first_name, last_name),
          assigner:users!assigned_by(first_name, last_name)
        `)
        .eq('organization_id', orgId)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleRecalculateProgress = async () => {
    try {
      setRecalculating(true);
      const orgId = await getCurrentUserOrgId();
      if (!orgId) {
        toast.error('Organization not found');
        return;
      }

      toast.info('Recalculating progress for all assignments...');
      const result = await recalculateAllProgress(orgId);
      
      if (result.success) {
        toast.success(`Progress recalculated: ${result.processed} assignments updated`);
        if (result.errors > 0) {
          toast.warning(`${result.errors} assignments had errors`);
        }
        await fetchAssignments();
      } else {
        toast.error('Failed to recalculate progress');
      }
    } catch (error) {
      console.error('Error recalculating progress:', error);
      toast.error('Failed to recalculate progress');
    } finally {
      setRecalculating(false);
    }
  };

  const filteredAssignments = assignments.filter(assignment => {
    const playlistTitle = assignment.playlist?.title || '';
    const userName = assignment.user ? 
      `${assignment.user.first_name} ${assignment.user.last_name}` : '';
    const matchesSearch = searchQuery === '' || 
      playlistTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || assignment.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0">
          <Clock className="h-3 w-3 mr-1" />
          In Progress
        </Badge>;
      case 'overdue':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-0">
          <AlertCircle className="h-3 w-3 mr-1" />
          Overdue
        </Badge>;
      default:
        return <Badge variant="outline">
          Assigned
        </Badge>;
    }
  };

  const stats = [
    {
      label: 'Active Assignments',
      value: assignments.filter(a => a.status === 'in_progress').length,
      icon: Clock,
      color: 'text-blue-600 dark:text-blue-400'
    },
    {
      label: 'Completed',
      value: assignments.filter(a => a.status === 'completed').length,
      icon: CheckCircle,
      color: 'text-green-600 dark:text-green-400'
    },
    {
      label: 'Total Assignments',
      value: assignments.length,
      icon: PlaySquare,
      color: 'text-primary'
    },
    {
      label: 'Average Completion',
      value: assignments.length > 0 
        ? `${Math.round(assignments.reduce((acc, a) => acc + (a.progress_percent || 0), 0) / assignments.length)}%`
        : '0%',
      icon: Users,
      color: 'text-primary'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground mb-2">Content Assignments</h1>
          <p className="text-muted-foreground">
            Manage and track training assignments across your organization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={handleRecalculateProgress}
            disabled={recalculating || loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
            Recalculate Progress
          </Button>
          {currentRole === 'admin' && (
            <Button 
              className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
              onClick={onOpenAssignmentWizard}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Assignment
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div className={`h-12 w-12 rounded-full bg-muted flex items-center justify-center ${stat.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assignments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Assignments List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading assignments...</p>
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No assignments found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAssignments.map((assignment) => (
            <Card key={assignment.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  {/* Playlist title */}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {assignment.playlist?.title || 'Unknown Playlist'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Assigned to: {assignment.user ? 
                        `${assignment.user.first_name} ${assignment.user.last_name}` : 
                        'Unknown User'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-4">
                    <div className="text-right min-w-[120px]">
                      <p className="text-sm font-medium mb-1">
                        Progress: {assignment.progress_percent}%
                      </p>
                      <div className="w-32 h-2.5 bg-accent rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${assignment.progress_percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Status badge */}
                    <Badge 
                      variant={
                        assignment.status === 'completed' ? 'default' :
                        assignment.status === 'in_progress' ? 'secondary' :
                        'outline'
                      }
                      className="min-w-[100px] justify-center"
                    >
                      {assignment.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>

                    {/* Due date */}
                    {assignment.due_date && (
                      <div className="text-sm text-muted-foreground min-w-[100px] text-right">
                        Due: {new Date(assignment.due_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredAssignments.length === 0 && assignments.length > 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="font-semibold mb-2">No assignments found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Try adjusting your search or filter criteria
            </p>
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('all');
              }}
            >
              Clear all filters
            </Button>
          </CardContent>
        </Card>
      )}
      <Footer />
    </div>
  );
}
