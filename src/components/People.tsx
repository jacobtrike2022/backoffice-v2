import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Footer } from './Footer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Progress } from './ui/progress';
import { Skeleton } from './ui/skeleton';
import { 
  Search, 
  Filter, 
  Download, 
  UserPlus,
  Users,
  Building,
  TrendingUp,
  X,
  ChevronDown
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { EmployeeProfile } from './EmployeeProfile';
import { useUsers, useCurrentUser } from '../lib/hooks/useSupabase';
import * as crud from '../lib/crud';
import { toast } from 'sonner@2.0.3';

type UserRole = 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';

interface PeopleProps {
  currentRole: UserRole;
  onBackToDashboard: () => void;
}

export function People({ currentRole, onBackToDashboard }: PeopleProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Filter states
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);

  // New user form
  const [newUser, setNewUser] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role_id: '',
    store_id: '',
    hire_date: new Date().toISOString().split('T')[0]
  });

  // Get current user for organization context
  const { user: currentUser } = useCurrentUser();

  // Fetch users from Supabase
  const { users, loading, error, refetch } = useUsers({
    search: searchQuery || undefined,
    role_id: selectedRoles.length > 0 ? selectedRoles[0] : undefined,
    store_id: selectedStores.length > 0 ? selectedStores[0] : undefined,
    status: selectedStatus.length > 0 ? selectedStatus[0] as any : 'active'
  });

  // Get unique values for filters from loaded data
  const uniqueRoles = Array.from(new Set(users.map(emp => emp.role?.name).filter(Boolean)));
  const uniqueStores = Array.from(new Set(users.map(emp => emp.store?.name).filter(Boolean)));
  const uniqueDistricts = Array.from(new Set(users.map(emp => emp.store?.district?.name).filter(Boolean)));

  const toggleFilter = (value: string, selected: string[], setter: (val: string[]) => void) => {
    if (selected.includes(value)) {
      setter(selected.filter(v => v !== value));
    } else {
      setter([...selected, value]);
    }
  };

  const clearAllFilters = () => {
    setSelectedRoles([]);
    setSelectedStores([]);
    setSelectedDistricts([]);
    setSelectedStatus([]);
  };

  const activeFiltersCount = 
    selectedRoles.length + 
    selectedStores.length + 
    selectedDistricts.length + 
    selectedStatus.length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'on-leave':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 60) return 'bg-blue-500';
    if (progress >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleCreateUser = async () => {
    if (!currentUser?.organization_id) {
      toast.error('Organization context required');
      return;
    }

    if (!newUser.first_name || !newUser.last_name || !newUser.email || !newUser.role_id || !newUser.store_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCreating(true);
    try {
      const result = await crud.users.create({
        ...newUser,
        organization_id: currentUser.organization_id
      });
      
      toast.success(`User created! Invite link: ${result.inviteUrl}`);
      setShowCreateDialog(false);
      setNewUser({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        role_id: '',
        store_id: '',
        hire_date: new Date().toISOString().split('T')[0]
      });
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  // If employee is selected, show profile
  if (selectedEmployee) {
    // Transform database user to Employee format for EmployeeProfile
    const transformedEmployee = {
      id: selectedEmployee.id,
      name: `${selectedEmployee.first_name || ''} ${selectedEmployee.last_name || ''}`.trim(),
      email: selectedEmployee.email || '',
      role: selectedEmployee.role?.name || 'No Role',
      homeStore: selectedEmployee.store?.name || 'No Store',
      district: selectedEmployee.store?.district?.name || 'No District',
      avatar: selectedEmployee.avatar_url || undefined,
      progress: selectedEmployee.training_progress || 0,
      status: selectedEmployee.status as 'active' | 'inactive' | 'on-leave',
      completedTracks: selectedEmployee.completed_tracks || 0,
      totalTracks: selectedEmployee.total_tracks || 0,
      lastActive: selectedEmployee.last_login ? new Date(selectedEmployee.last_login).toLocaleDateString() : 'Never',
      certifications: selectedEmployee.certifications_count || 0,
      complianceScore: selectedEmployee.compliance_score || 0
    };

    return (
      <EmployeeProfile 
        employee={transformedEmployee}
        onBack={() => setSelectedEmployee(null)}
        currentRole={currentRole}
      />
    );
  }

  // Calculate stats
  const totalEmployees = users.length;
  const activeEmployees = users.filter(emp => emp.status === 'active').length;
  
  // WEIGHTED average: total completed / total assigned (NOT average of percentages)
  const totalCompletedTracks = users.reduce((sum, emp) => sum + (emp.completed_tracks || 0), 0);
  const totalAssignedTracks = users.reduce((sum, emp) => sum + (emp.total_tracks || 0), 0);
  const avgProgress = totalAssignedTracks > 0 
    ? Math.round((totalCompletedTracks / totalAssignedTracks) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground">People Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage and monitor employee training and performance
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          {currentRole === 'admin' && (
            <Button 
              size="sm" 
              className="bg-brand-gradient hover:opacity-90 text-white shadow-brand"
              onClick={() => setShowCreateDialog(true)}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 border-primary/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Employees</p>
                <p className="text-3xl font-bold text-foreground mt-1">{totalEmployees}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-500/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Employees</p>
                <p className="text-3xl font-bold text-foreground mt-1">{activeEmployees}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-orange-500/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Progress</p>
                <p className="text-3xl font-bold text-foreground mt-1">{avgProgress}%</p>
              </div>
              <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                <Building className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees by name, email, role, or store..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant={showFilters ? "default" : "outline"}
                onClick={() => setShowFilters(!showFilters)}
                className="relative"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge className="ml-2 bg-white text-primary border-0 px-1.5 py-0 h-5 min-w-5">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="border rounded-lg p-4 bg-accent/50 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Filter Options</h3>
                  {activeFiltersCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear All
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Role Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Role</label>
                    <div className="space-y-2">
                      {uniqueRoles.map(role => (
                        <div key={role} className="flex items-center space-x-2">
                          <Checkbox
                            id={`role-${role}`}
                            checked={selectedRoles.includes(role)}
                            onCheckedChange={() => toggleFilter(role, selectedRoles, setSelectedRoles)}
                          />
                          <label
                            htmlFor={`role-${role}`}
                            className="text-sm text-foreground cursor-pointer"
                          >
                            {role}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Store Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Home Store</label>
                    <div className="space-y-2">
                      {uniqueStores.map(store => (
                        <div key={store} className="flex items-center space-x-2">
                          <Checkbox
                            id={`store-${store}`}
                            checked={selectedStores.includes(store)}
                            onCheckedChange={() => toggleFilter(store, selectedStores, setSelectedStores)}
                          />
                          <label
                            htmlFor={`store-${store}`}
                            className="text-sm text-foreground cursor-pointer"
                          >
                            {store}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* District Filter - Only for Admin and DM */}
                  {(currentRole === 'admin' || currentRole === 'district-manager') && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">District</label>
                      <div className="space-y-2">
                        {uniqueDistricts.map(district => (
                          <div key={district} className="flex items-center space-x-2">
                            <Checkbox
                              id={`district-${district}`}
                              checked={selectedDistricts.includes(district)}
                              onCheckedChange={() => toggleFilter(district, selectedDistricts, setSelectedDistricts)}
                            />
                            <label
                              htmlFor={`district-${district}`}
                              className="text-sm text-foreground cursor-pointer"
                            >
                              {district}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Status Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Status</label>
                    <div className="space-y-2">
                      {['active', 'inactive', 'on-leave'].map(status => (
                        <div key={status} className="flex items-center space-x-2">
                          <Checkbox
                            id={`status-${status}`}
                            checked={selectedStatus.includes(status)}
                            onCheckedChange={() => toggleFilter(status, selectedStatus, setSelectedStatus)}
                          />
                          <label
                            htmlFor={`status-${status}`}
                            className="text-sm text-foreground cursor-pointer capitalize"
                          >
                            {status.replace('-', ' ')}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Employee List */}
      <Card>
        <CardHeader className="border-b bg-accent/50">
          <CardTitle className="text-lg">
            Employees ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {loading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No employees found matching your criteria</p>
              </div>
            ) : (
              users.map((employee) => {
                const fullName = `${employee.first_name} ${employee.last_name}`;
                const initials = `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase();
                const progress = employee.training_progress || 0;
                const completedTracks = employee.completed_tracks || 0;
                const totalTracks = employee.total_tracks || 0;
                const certifications = employee.certifications_count || 0;
                
                return (
                  <div
                    key={employee.id}
                    className="p-4 hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedEmployee(employee)}
                  >
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                        <AvatarImage src={employee.avatar_url || undefined} alt={fullName} />
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
                          {initials}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-0.5">
                          <h3 className="font-semibold text-foreground text-sm">{fullName}</h3>
                          <Badge variant="outline" className={`${getStatusColor(employee.status)} text-xs py-0 h-5`}>
                            {employee.status}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                          <span>{employee.role?.name || 'No Role'}</span>
                          <span>•</span>
                          <span>{employee.store?.name || 'No Store'}</span>
                          {currentRole === 'admin' && employee.store?.district?.name && (
                            <>
                              <span>•</span>
                              <span>{employee.store.district.name} District</span>
                            </>
                          )}
                          {employee.last_login && (
                            <>
                              <span>•</span>
                              <span>Last active {new Date(employee.last_login).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Training Progress</p>
                          <div className="flex items-center space-x-2">
                            <div className="w-24">
                              <Progress 
                                value={progress} 
                                className="h-1.5"
                                indicatorClassName={getProgressColor(progress)}
                              />
                            </div>
                            <span className="text-xs font-semibold text-foreground w-10 text-right">
                              {progress}%
                            </span>
                          </div>
                        </div>

                        <div className="text-center border-l border-border pl-4">
                          <p className="text-xl font-bold text-foreground">{completedTracks}</p>
                          <p className="text-xs text-muted-foreground">of {totalTracks} tracks</p>
                        </div>

                        <div className="text-center border-l border-border pl-4">
                          <p className="text-xl font-bold text-foreground">{certifications}</p>
                          <p className="text-xs text-muted-foreground">certifications</p>
                        </div>

                        <ChevronDown className="h-4 w-4 text-muted-foreground -rotate-90" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>
              Create a new employee profile with role and assignment details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={newUser.first_name}
                  onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={newUser.last_name}
                  onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="john.doe@trike.com"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div>
              <Label htmlFor="role">Role *</Label>
              <Select value={newUser.role_id} onValueChange={(val) => setNewUser({ ...newUser, role_id: val })}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="role-1">Store Manager</SelectItem>
                  <SelectItem value="role-2">Sales Associate</SelectItem>
                  <SelectItem value="role-3">Assistant Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="store">Store *</Label>
              <Select value={newUser.store_id} onValueChange={(val) => setNewUser({ ...newUser, store_id: val })}>
                <SelectTrigger id="store">
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="store-1">Store A</SelectItem>
                  <SelectItem value="store-2">Store B</SelectItem>
                  <SelectItem value="store-3">Store C</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="hire_date">Hire Date</Label>
              <Input
                id="hire_date"
                type="date"
                value={newUser.hire_date}
                onChange={(e) => setNewUser({ ...newUser, hire_date: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={creating} className="bg-brand-gradient">
              {creating ? 'Creating...' : 'Create Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}