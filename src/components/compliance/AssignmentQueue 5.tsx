// ============================================================================
// COMPLIANCE ASSIGNMENT QUEUE COMPONENT
// ============================================================================
// Displays and manages the compliance assignment queue with stats, filtering,
// and actions for assigning playlists or suppressing assignments.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  PlayCircle,
  Users,
  Calendar,
  Building2,
  MoreHorizontal,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ArrowUpRight,
  Ban
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import { Skeleton } from '../ui/skeleton';
import { toast } from 'sonner';
import {
  type ComplianceAssignment,
  type ComplianceAssignmentStats,
  type AssignmentStatus,
  type AssignmentTrigger,
  getComplianceAssignmentQueue,
  getComplianceAssignmentStats,
  assignCompliancePlaylist,
  suppressComplianceAssignment,
} from '../../lib/crud/complianceAssignments';
import { getPlaylistsForRequirement, type Album } from '../../lib/crud/albums';
import { formatDate } from '../../lib/utils/dateFormat';

// ============================================================================
// TYPES
// ============================================================================

interface AssignmentQueueProps {
  onAssignmentClick?: (assignment: ComplianceAssignment) => void;
  defaultTab?: 'pending' | 'assigned' | 'all';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatTrigger(trigger: AssignmentTrigger): string {
  const labels: Record<AssignmentTrigger, string> = {
    onboarding: 'Onboarding',
    transfer: 'Location Transfer',
    promotion: 'Role Change',
    expiration: 'Cert Expiring',
    manual: 'Manual'
  };
  return labels[trigger] || trigger;
}

function getStatusBadge(status: AssignmentStatus, dueDate: string | null) {
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = dueDate && dueDate < today && ['pending', 'assigned'].includes(status);

  if (isOverdue) {
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-0">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Overdue
      </Badge>
    );
  }

  const variants: Record<AssignmentStatus, { className: string; icon: React.ReactNode; label: string }> = {
    pending: {
      className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-0',
      icon: <Clock className="h-3 w-3 mr-1" />,
      label: 'Pending'
    },
    assigned: {
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0',
      icon: <PlayCircle className="h-3 w-3 mr-1" />,
      label: 'Assigned'
    },
    completed: {
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0',
      icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
      label: 'Completed'
    },
    suppressed: {
      className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 border-0',
      icon: <Ban className="h-3 w-3 mr-1" />,
      label: 'Suppressed'
    },
    expired: {
      className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-0',
      icon: <XCircle className="h-3 w-3 mr-1" />,
      label: 'Expired'
    },
    cancelled: {
      className: 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400 border-0',
      icon: <XCircle className="h-3 w-3 mr-1" />,
      label: 'Cancelled'
    }
  };

  const variant = variants[status];
  return (
    <Badge className={variant.className}>
      {variant.icon}
      {variant.label}
    </Badge>
  );
}

function getTriggerBadge(trigger: AssignmentTrigger) {
  const variants: Record<AssignmentTrigger, string> = {
    onboarding: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    transfer: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    promotion: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    expiration: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    manual: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
  };

  return (
    <Badge variant="outline" className={`${variants[trigger]} border-0`}>
      {formatTrigger(trigger)}
    </Badge>
  );
}

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  iconBgClass: string;
  iconClass: string;
  onClick?: () => void;
  isActive?: boolean;
}

function StatCard({ title, value, icon, iconBgClass, iconClass, onClick, isActive }: StatCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isActive ? 'ring-2 ring-primary ring-offset-2' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
          </div>
          <div className={`h-12 w-12 rounded-full ${iconBgClass} flex items-center justify-center`}>
            {React.cloneElement(icon as React.ReactElement, { className: `h-6 w-6 ${iconClass}` })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ASSIGN PLAYLIST DIALOG
// ============================================================================

interface AssignPlaylistDialogProps {
  assignment: ComplianceAssignment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (assignmentId: string, playlistId: string) => Promise<void>;
}

function AssignPlaylistDialog({ assignment, open, onOpenChange, onAssign }: AssignPlaylistDialogProps) {
  const [playlists, setPlaylists] = useState<Album[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadPlaylists() {
      if (!assignment?.requirement_id) return;
      setLoading(true);
      try {
        const data = await getPlaylistsForRequirement(assignment.requirement_id);
        setPlaylists(data);
        if (data.length === 1) {
          setSelectedPlaylist(data[0].id);
        }
      } catch (error) {
        console.error('Failed to load playlists:', error);
      } finally {
        setLoading(false);
      }
    }

    if (open && assignment) {
      loadPlaylists();
    } else {
      setPlaylists([]);
      setSelectedPlaylist('');
    }
  }, [open, assignment]);

  const handleAssign = async () => {
    if (!assignment || !selectedPlaylist) return;
    setSubmitting(true);
    try {
      await onAssign(assignment.id, selectedPlaylist);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to assign playlist:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Compliance Playlist</DialogTitle>
          <DialogDescription>
            Select a playlist to fulfill the {assignment?.requirement?.requirement_name} requirement
            for {assignment?.employee?.first_name} {assignment?.employee?.last_name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : playlists.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p>No playlists are linked to this compliance requirement.</p>
              <p className="text-sm mt-2">
                Create a playlist and link it to this requirement first.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Select Playlist</Label>
              <Select value={selectedPlaylist} onValueChange={setSelectedPlaylist}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a playlist..." />
                </SelectTrigger>
                <SelectContent>
                  {playlists.map((playlist) => (
                    <SelectItem key={playlist.id} value={playlist.id}>
                      {playlist.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {assignment?.requirement && (
            <Card className="bg-muted/50">
              <CardContent className="p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Requirement:</span>
                  <span className="font-medium">{assignment.requirement.requirement_name}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-muted-foreground">State:</span>
                  <Badge variant="outline" className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white border-0 text-xs font-medium">
                    {assignment.requirement.state_code}
                  </Badge>
                </div>
                {assignment.due_date && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-muted-foreground">Due Date:</span>
                    <span>{formatDate(assignment.due_date)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
            onClick={handleAssign}
            disabled={!selectedPlaylist || submitting}
          >
            {submitting ? 'Assigning...' : 'Assign Playlist'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// SUPPRESS DIALOG
// ============================================================================

interface SuppressDialogProps {
  assignment: ComplianceAssignment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuppress: (assignmentId: string, reason: string) => Promise<void>;
}

function SuppressDialog({ assignment, open, onOpenChange, onSuppress }: SuppressDialogProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSuppress = async () => {
    if (!assignment || !reason.trim()) return;
    setSubmitting(true);
    try {
      await onSuppress(assignment.id, reason);
      onOpenChange(false);
      setReason('');
    } catch (error) {
      console.error('Failed to suppress assignment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suppress Assignment</DialogTitle>
          <DialogDescription>
            Suppressing this assignment will remove it from the queue. This is typically used when
            an employee has an external certification that satisfies this requirement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Reason for Suppression</Label>
            <Textarea
              placeholder="e.g., Employee has valid external certification, expires 12/2025"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {assignment && (
            <Card className="bg-muted/50">
              <CardContent className="p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Employee:</span>
                  <span className="font-medium">
                    {assignment.employee?.first_name} {assignment.employee?.last_name}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-muted-foreground">Requirement:</span>
                  <span>{assignment.requirement?.requirement_name}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSuppress}
            disabled={!reason.trim() || submitting}
          >
            {submitting ? 'Suppressing...' : 'Suppress Assignment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AssignmentQueue({ onAssignmentClick, defaultTab = 'pending' }: AssignmentQueueProps) {
  // State
  const [assignments, setAssignments] = useState<ComplianceAssignment[]>([]);
  const [stats, setStats] = useState<ComplianceAssignmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [triggerFilter, setTriggerFilter] = useState<string>('all');

  // Dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [suppressDialogOpen, setSuppressDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<ComplianceAssignment | null>(null);

  // Load data
  const loadData = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    else setLoading(true);

    try {
      const [assignmentsData, statsData] = await Promise.all([
        getComplianceAssignmentQueue(),
        getComplianceAssignmentStats()
      ]);
      setAssignments(assignmentsData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load compliance queue:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter assignments based on tab, search, and trigger
  const filteredAssignments = assignments.filter((a) => {
    // Tab filter
    if (activeTab === 'pending' && a.status !== 'pending') return false;
    if (activeTab === 'assigned' && a.status !== 'assigned') return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const employeeName = `${a.employee?.first_name} ${a.employee?.last_name}`.toLowerCase();
      const requirementName = a.requirement?.requirement_name?.toLowerCase() || '';
      if (!employeeName.includes(query) && !requirementName.includes(query)) {
        return false;
      }
    }

    // Trigger filter
    if (triggerFilter !== 'all' && a.triggered_by !== triggerFilter) {
      return false;
    }

    return true;
  });

  // Handlers
  const handleAssign = async (assignmentId: string, playlistId: string) => {
    try {
      await assignCompliancePlaylist(assignmentId, playlistId);
      toast.success('Playlist assigned successfully', {
        description: 'The compliance playlist has been assigned to the employee.'
      });
      await loadData(true);
    } catch (error) {
      console.error('Failed to assign playlist:', error);
      toast.error('Failed to assign playlist', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred'
      });
      throw error;
    }
  };

  const handleSuppress = async (assignmentId: string, reason: string) => {
    try {
      await suppressComplianceAssignment(assignmentId, reason);
      toast.success('Assignment suppressed', {
        description: 'The compliance assignment has been suppressed.'
      });
      await loadData(true);
    } catch (error) {
      console.error('Failed to suppress assignment:', error);
      toast.error('Failed to suppress assignment', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred'
      });
      throw error;
    }
  };

  const openAssignDialog = (assignment: ComplianceAssignment) => {
    setSelectedAssignment(assignment);
    setAssignDialogOpen(true);
  };

  const openSuppressDialog = (assignment: ComplianceAssignment) => {
    setSelectedAssignment(assignment);
    setSuppressDialogOpen(true);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-12" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Compliance Assignment Queue</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage pending compliance training assignments
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadData(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            title="Pending"
            value={stats.pending}
            icon={<Clock />}
            iconBgClass="bg-yellow-100 dark:bg-yellow-900/30"
            iconClass="text-yellow-600 dark:text-yellow-400"
            onClick={() => setActiveTab('pending')}
            isActive={activeTab === 'pending'}
          />
          <StatCard
            title="Assigned"
            value={stats.assigned}
            icon={<PlayCircle />}
            iconBgClass="bg-blue-100 dark:bg-blue-900/30"
            iconClass="text-blue-600 dark:text-blue-400"
            onClick={() => setActiveTab('assigned')}
            isActive={activeTab === 'assigned'}
          />
          <StatCard
            title="Completed"
            value={stats.completed}
            icon={<CheckCircle2 />}
            iconBgClass="bg-green-100 dark:bg-green-900/30"
            iconClass="text-green-600 dark:text-green-400"
            onClick={() => setActiveTab('all')}
          />
          <StatCard
            title="Suppressed"
            value={stats.suppressed}
            icon={<Ban />}
            iconBgClass="bg-gray-100 dark:bg-gray-900/30"
            iconClass="text-gray-600 dark:text-gray-400"
            onClick={() => setActiveTab('all')}
          />
          <StatCard
            title="Overdue"
            value={stats.overdue}
            icon={<AlertTriangle />}
            iconBgClass="bg-red-100 dark:bg-red-900/30"
            iconClass="text-red-600 dark:text-red-400"
            onClick={() => setActiveTab('all')}
          />
        </div>
      )}

      {/* Tabs and Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending">
              Pending
              {stats && stats.pending > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {stats.pending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="assigned">
              Assigned
              {stats && stats.assigned > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {stats.assigned}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employee or requirement..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Select value={triggerFilter} onValueChange={setTriggerFilter}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Trigger" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Triggers</SelectItem>
              <SelectItem value="onboarding">Onboarding</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
              <SelectItem value="promotion">Promotion</SelectItem>
              <SelectItem value="expiration">Expiration</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Assignments Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Requirement</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    {searchQuery || triggerFilter !== 'all'
                      ? 'No assignments match your filters'
                      : 'No compliance assignments in queue'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {assignment.employee?.first_name} {assignment.employee?.last_name}
                          </p>
                          {assignment.employee?.store && (
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Building2 className="h-3 w-3 mr-1" />
                              {assignment.employee.store.name}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{assignment.requirement?.requirement_name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Badge variant="outline" className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white border-0 text-[10px] font-medium px-1.5 py-0">
                            {assignment.requirement?.state_code}
                          </Badge>
                          {assignment.requirement?.topic?.name && `• ${assignment.requirement.topic.name}`}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getTriggerBadge(assignment.triggered_by)}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        {formatDate(assignment.due_date)}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(assignment.status, assignment.due_date)}</TableCell>
                    <TableCell className="text-right">
                      {assignment.status === 'pending' ? (
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            size="sm"
                            className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
                            onClick={() => openAssignDialog(assignment)}
                          >
                            <ArrowUpRight className="h-3 w-3 mr-1" />
                            Assign
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openSuppressDialog(assignment)}>
                                <Ban className="h-4 w-4 mr-2" />
                                Suppress
                              </DropdownMenuItem>
                              {onAssignmentClick && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => onAssignmentClick(assignment)}>
                                    View Details
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {assignment.status === 'assigned' && (
                              <DropdownMenuItem onClick={() => openSuppressDialog(assignment)}>
                                <Ban className="h-4 w-4 mr-2" />
                                Suppress
                              </DropdownMenuItem>
                            )}
                            {onAssignmentClick && (
                              <DropdownMenuItem onClick={() => onAssignmentClick(assignment)}>
                                View Details
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AssignPlaylistDialog
        assignment={selectedAssignment}
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        onAssign={handleAssign}
      />
      <SuppressDialog
        assignment={selectedAssignment}
        open={suppressDialogOpen}
        onOpenChange={setSuppressDialogOpen}
        onSuppress={handleSuppress}
      />
    </div>
  );
}

export default AssignmentQueue;
