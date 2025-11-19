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
  ChevronDown,
  Mail,
  Phone,
  MapPin
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
import { Label } from './ui/label';
import { EmployeeProfile } from './EmployeeProfile';
import { useUsers, useCurrentUser } from '../lib/hooks/useSupabase';
import * as crud from '../lib/crud';
import { toast } from 'sonner@2.0.3';

type UserRole = 'admin' | 'district-manager' | 'store-manager';

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
    setSelectedStatus([]);
  };

  const activeFiltersCount = 
    selectedRoles.length + 
    selectedStores.length + 
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
      toast.error('Organization not found');
      return;
    }

    if (!newUser.first_name || !newUser.last_name || !newUser.email || !newUser.role_id || !newUser.store_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setCreating(true);
      const result = await crud.createUser({
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
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  // If employee is selected, show profile
  if (selectedEmployee) {
    return (
      <EmployeeProfile 
        employee={selectedEmployee}
        onBack={() => {
          setSelectedEmployee(null);
          refetch(); // Refresh list when returning
        }}
        currentRole={currentRole}
      />
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-xl font-semibold text-red-700 mb-2">Error Loading Users</h2>
        <p className="text-red-600 mb-4">{error.message}</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  // Calculate stats
  const totalEmployees = users?.length || 0;
  const activeEmployees = users?.filter(emp => emp.status === 'active').length || 0;

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
              className="hero-primary"
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
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmployees}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeEmployees}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building className="h-4 w-4" />
              {currentRole === 'admin' ? 'Organizations' : 'Locations'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(users?.map(u => u.store_id).filter(Boolean)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="relative"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge className="ml-2 bg-primary text-primary-foreground">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Filters</h3>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                    <X className="h-3 w-3 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Status Filter */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Status</Label>
                  <div className="space-y-2">
                    {['active', 'inactive', 'on-leave'].map((status) => (
                      <div key={status} className="flex items-center space-x-2">
                        <Checkbox
                          id={`status-${status}`}
                          checked={selectedStatus.includes(status)}
                          onCheckedChange={() => toggleFilter(status, selectedStatus, setSelectedStatus)}
                        />
                        <Label htmlFor={`status-${status}`} className="text-sm capitalize cursor-pointer">
                          {status.replace('-', ' ')}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add more filter sections as needed */}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        {users?.length || 0} {users?.length === 1 ? 'employee' : 'employees'} found
      </div>

      {/* Employee List */}
      {!users || users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No employees found</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery || activeFiltersCount > 0
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first employee'}
            </p>
            {currentRole === 'admin' && (
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((employee) => {
            const fullName = `${employee.first_name} ${employee.last_name}`;
            const initials = `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase();

            return (
              <Card
                key={employee.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedEmployee(employee)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={employee.avatar_url || undefined} />
                      <AvatarFallback className="bg-brand-gradient text-white">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{fullName}</h3>
                      <p className="text-sm text-muted-foreground truncate">{employee.email}</p>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {employee.role?.name || 'No Role'}
                        </Badge>
                        <Badge className={`${getStatusColor(employee.status)} text-xs`}>
                          {employee.status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {/* Quick Stats */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        Store
                      </span>
                      <span className="font-medium">{employee.store?.name || 'N/A'}</span>
                    </div>
                    
                    {employee.phone && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          Phone
                        </span>
                        <span className="font-medium text-xs">{employee.phone}</span>
                      </div>
                    )}

                    {employee.hire_date && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Hire Date</span>
                        <span className="font-medium text-xs">
                          {new Date(employee.hire_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
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
                placeholder="john.doe@example.com"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <Label htmlFor="hire_date">Hire Date *</Label>
              <Input
                id="hire_date"
                type="date"
                value={newUser.hire_date}
                onChange={(e) => setNewUser({ ...newUser, hire_date: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="role_id">Role * (Enter Role ID)</Label>
              <Input
                id="role_id"
                value={newUser.role_id}
                onChange={(e) => setNewUser({ ...newUser, role_id: e.target.value })}
                placeholder="role-uuid"
              />
            </div>

            <div>
              <Label htmlFor="store_id">Store * (Enter Store ID)</Label>
              <Input
                id="store_id"
                value={newUser.store_id}
                onChange={(e) => setNewUser({ ...newUser, store_id: e.target.value })}
                placeholder="store-uuid"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={creating} className="hero-primary">
              {creating ? 'Creating...' : 'Create Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
