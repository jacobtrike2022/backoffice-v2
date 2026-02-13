import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  Plus,
  Users,
  Calendar,
  Repeat,
  CheckCircle2,
  ChevronDown,
  Edit,
  Trash2,
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
import { Separator } from '../ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getForms,
  getFormAssignments,
  assignForm,
  cancelFormAssignment,
} from '@/lib/crud/forms';
import { getStores, getDistricts, getRoles } from '@/lib/crud/stores';
import { supabase, getCurrentUserOrgId } from '@/lib/supabase';

interface FormAssignmentsProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
}

function getTargetName(
  assignmentType: string,
  targetId: string,
  stores: any[],
  districts: any[],
  roles: any[],
  users: any[]
): string {
  if (assignmentType === 'store') {
    const s = stores?.find((x: any) => x.id === targetId);
    return s?.name || s?.store_name || targetId;
  }
  if (assignmentType === 'district') {
    const d = districts?.find((x: any) => x.id === targetId);
    return d?.name || d?.district_name || targetId;
  }
  if (assignmentType === 'role') {
    const r = roles?.find((x: any) => x.id === targetId);
    return r?.name || targetId;
  }
  if (assignmentType === 'user') {
    const u = users?.find((x: any) => x.id === targetId);
    return u ? `${u.first_name} ${u.last_name}` : targetId;
  }
  return targetId;
}

export function FormAssignments({ currentRole = 'admin' }: FormAssignmentsProps) {
  const queryClient = useQueryClient();
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [selectedForm, setSelectedForm] = useState('none');
  const [assignmentType, setAssignmentType] = useState<'user' | 'store' | 'district' | 'role'>('store');
  const [targetId, setTargetId] = useState('none');
  const [dueDate, setDueDate] = useState('');
  const [recurrence, setRecurrence] = useState('none');

  const { data: formsData, isLoading: formsLoading } = useQuery({
    queryKey: ['forms-published'],
    queryFn: () => getForms({ status: 'published', limit: 100 }),
  });

  const { data: assignmentsData, isLoading: assignmentsLoading, error: assignmentsError } = useQuery({
    queryKey: ['formAssignments'],
    queryFn: () => getFormAssignments({ status: 'active' }),
  });

  const { data: stores } = useQuery({
    queryKey: ['stores-for-assign'],
    queryFn: () => getStores({ is_active: true }),
  });

  const { data: districts } = useQuery({
    queryKey: ['districts-for-assign'],
    queryFn: () => getDistricts(),
  });

  const { data: roles } = useQuery({
    queryKey: ['roles-for-assign'],
    queryFn: () => getRoles(),
  });

  const { data: users } = useQuery({
    queryKey: ['users-for-assign'],
    queryFn: async () => {
      const orgId = await getCurrentUserOrgId();
      if (!orgId) return [];
      const { data } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .order('first_name');
      return data || [];
    },
  });

  const targetOptions = assignmentType === 'store' ? (stores || []) :
    assignmentType === 'district' ? (districts || []) :
    assignmentType === 'role' ? (roles || []) :
    (users || []);

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (selectedForm === 'none' || !selectedForm) throw new Error('Select a form');
      if (targetId === 'none' || !targetId) throw new Error('Select who to assign to');
      return assignForm(selectedForm, assignmentType, targetId, dueDate || undefined);
    },
    onSuccess: () => {
      toast.success('Form assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['formAssignments'] });
      setShowAssignmentForm(false);
      setSelectedForm('none');
      setTargetId('none');
      setDueDate('');
      setRecurrence('none');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to assign form');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelFormAssignment,
    onSuccess: () => {
      toast.success('Assignment cancelled');
      queryClient.invalidateQueries({ queryKey: ['formAssignments'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to cancel assignment');
    },
  });

  const forms = formsData?.forms || [];
  const assignments = assignmentsData?.assignments || [];
  const activeCount = assignments.filter((a: any) => a.status === 'active').length;

  const handleCreateAssignment = () => {
    assignMutation.mutate();
  };

  const handleCancelAssignment = (id: string) => {
    if (confirm('Cancel this assignment? Recipients will no longer see it.')) {
      cancelMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Form Assignments</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Assign forms to specific employees, stores, districts, or roles
          </p>
        </div>
        <Button
          className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
          onClick={() => setShowAssignmentForm(!showAssignmentForm)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Assign Form
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Assignments</p>
                <p className="text-3xl font-bold mt-2">
                  {assignmentsLoading ? '—' : activeCount}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Published Forms</p>
                <p className="text-3xl font-bold mt-2">
                  {formsLoading ? '—' : forms.length}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Assignments</p>
                <p className="text-3xl font-bold mt-2">
                  {assignmentsLoading ? '—' : assignments.length}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Users className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {showAssignmentForm && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle>Create New Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Select Form</Label>
              <Select value={selectedForm} onValueChange={setSelectedForm}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a form to assign..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select a form...</SelectItem>
                  {forms.map((form: any) => (
                    <SelectItem key={form.id} value={form.id}>
                      {form.title}
                    </SelectItem>
                  ))}
                  {forms.length === 0 && !formsLoading && (
                    <SelectItem value="none" disabled>No published forms</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select value={assignmentType} onValueChange={(v: any) => { setAssignmentType(v); setTargetId('none'); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="store">Store</SelectItem>
                    <SelectItem value="district">District</SelectItem>
                    <SelectItem value="role">Role</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  {assignmentType === 'store' ? 'Store' :
                   assignmentType === 'district' ? 'District' :
                   assignmentType === 'role' ? 'Role' : 'User'}
                </Label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${assignmentType}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select...</SelectItem>
                    {assignmentType === 'store' && (stores || []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name || s.store_name}</SelectItem>
                    ))}
                    {assignmentType === 'district' && (districts || []).map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>{d.name || d.district_name}</SelectItem>
                    ))}
                    {assignmentType === 'role' && (roles || []).map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                    {assignmentType === 'user' && (users || []).map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Recurrence</Label>
                <Select value={recurrence} onValueChange={setRecurrence}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (One-time)</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowAssignmentForm(false)}>
                Cancel
              </Button>
              <Button
                className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
                onClick={handleCreateAssignment}
                disabled={assignMutation.isPending || selectedForm === 'none' || targetId === 'none'}
              >
                {assignMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  'Create Assignment'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h3 className="font-semibold">Active Assignments</h3>

        {assignmentsError && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6 flex items-center gap-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">Error loading assignments</p>
                <p className="text-sm text-red-700">{(assignmentsError as Error).message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {assignmentsLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : assignments.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No assignments yet</p>
              <p className="text-sm mt-1">Assign a form to get started</p>
            </CardContent>
          </Card>
        ) : (
          assignments.map((assignment: any) => (
            <Collapsible key={assignment.id}>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold">
                          {(assignment.form as any)?.title || 'Unknown Form'}
                        </h3>
                        <Badge variant={assignment.status === 'active' ? 'default' : 'secondary'}>
                          {assignment.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Assigned to:</span>
                          <span className="font-medium">
                            {getTargetName(
                              assignment.assignment_type,
                              assignment.target_id,
                              stores || [],
                              districts || [],
                              roles || [],
                              users || []
                            )}
                          </span>
                          <span className="text-muted-foreground">
                            ({assignment.assignment_type})
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Due:</span>
                          <span className="font-medium">
                            {assignment.due_date
                              ? new Date(assignment.due_date).toLocaleDateString()
                              : '—'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Repeat className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Recurrence:</span>
                          <span className="font-medium">
                            {assignment.recurrence || 'None'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </CollapsibleTrigger>
                      {assignment.status === 'active' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleCancelAssignment(assignment.id)}
                          disabled={cancelMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <CollapsibleContent>
                    <Separator className="my-4" />
                    <div className="text-sm text-muted-foreground">
                      Assigned by: {(assignment.assigned_by as any)?.first_name} {(assignment.assigned_by as any)?.last_name}
                      {' • '}
                      {new Date(assignment.created_at).toLocaleString()}
                    </div>
                  </CollapsibleContent>
                </CardContent>
              </Card>
            </Collapsible>
          ))
        )}
      </div>
    </div>
  );
}
