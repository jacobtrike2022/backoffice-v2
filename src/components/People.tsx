import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  Upload,
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
import { EditPeopleDialog } from './EditPeopleDialog';
import { BulkEmployeeImport } from './BulkEmployeeImport';
import { useUsers, useCurrentUser, useRoles, useStores, useEffectiveOrgId } from '../lib/hooks/useSupabase';
import * as crud from '../lib/crud';
import { toast } from 'sonner@2.0.3';
import { Edit } from 'lucide-react';

type UserRole = 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';

interface PeopleProps {
  currentRole: UserRole;
  onBackToDashboard: () => void;
}

export function People({ currentRole, onBackToDashboard }: PeopleProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
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

  // Get current user and effective org (respects demo_org_id and Super Admin preview)
  const { user: currentUser } = useCurrentUser();
  const { orgId: effectiveOrgId } = useEffectiveOrgId();

  // Fetch roles and stores for the effective org
  const { roles } = useRoles(effectiveOrgId ?? undefined);
  const { stores } = useStores(effectiveOrgId ? { organization_id: effectiveOrgId } : undefined);

  // Fetch users from Supabase
  // For Trike Super Admin, don't filter by status unless explicitly selected
  const { users: fetchedUsers, loading, error, refetch } = useUsers({
    search: searchQuery || undefined,
    role_id: selectedRoles.length > 0 ? selectedRoles[0] : undefined,
    store_id: selectedStores.length > 0 ? selectedStores[0] : undefined,
    status: selectedStatus.length > 0 ? selectedStatus[0] as any : (currentRole === 'trike-super-admin' ? undefined : 'active')
  });

  // State for users with calculated progress
  const [users, setUsers] = useState<any[]>([]);

  // Use training_progress from getUsers() instead of recalculating
  // getUsers() already calculates progress correctly using track_completions
  useEffect(() => {
    if (fetchedUsers.length === 0) {
      setUsers([]);
      return;
    }

    // Use training_progress from fetchedUsers (already calculated correctly in getUsers)
    setUsers(fetchedUsers.map(user => ({
      ...user,
      overallProgress: user.training_progress || 0
    })));
  }, [fetchedUsers]);

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
    if (!effectiveOrgId) {
      toast.error(t('people.orgRequired'));
      return;
    }

    if (!newUser.first_name || !newUser.last_name || !newUser.email || !newUser.role_id || !newUser.store_id) {
      toast.error(t('people.fillRequired'));
      return;
    }

    setCreating(true);
    try {
      const result = await crud.createUser({
        ...newUser,
        organization_id: effectiveOrgId
      });
      
      toast.success(t('people.userCreated', { inviteUrl: result.inviteUrl }));
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
      toast.error(err.message || t('people.failedToCreate'));
    } finally {
      setCreating(false);
    }
  };

  // If employee is selected, show profile
  if (selectedEmployee) {
    // Transform database user to Employee format for EmployeeProfile
    const lastActiveDate = selectedEmployee.last_active_at || selectedEmployee.last_login;
    const transformedEmployee = {
      id: selectedEmployee.id,
      name: `${selectedEmployee.first_name || ''} ${selectedEmployee.last_name || ''}`.trim(),
      email: selectedEmployee.email || '',
      role: selectedEmployee.role?.name || t('people.noRole'),
      homeStore: selectedEmployee.store?.name || t('people.noStore'),
      district: selectedEmployee.store?.district?.name || t('people.noDistrict'),
      avatar: selectedEmployee.avatar_url || undefined,
      progress: selectedEmployee.training_progress || 0,
      status: selectedEmployee.status as 'active' | 'inactive' | 'on-leave',
      completedTracks: selectedEmployee.completed_tracks || 0,
      totalTracks: selectedEmployee.total_tracks || 0,
      lastActive: lastActiveDate ? new Date(lastActiveDate).toLocaleDateString() : t('people.never'),
      certifications: selectedEmployee.certifications_count || 0,
      complianceScore: selectedEmployee.compliance_score || 0,
      // Additional fields
      phone: selectedEmployee.phone || undefined,
      mobilePhone: selectedEmployee.mobile_phone || undefined,
      employeeId: selectedEmployee.employee_id || undefined,
      hireDate: selectedEmployee.hire_date || undefined,
      terminationDate: selectedEmployee.termination_date || undefined,
      createdAt: selectedEmployee.created_at || undefined,
      updatedAt: selectedEmployee.updated_at || undefined
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
          <h1 className="text-foreground">{t('people.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('people.subtitle')}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            {t('common.export')}
          </Button>
          {(currentRole === 'admin' || currentRole === 'trike-super-admin') && (
            <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
          )}
          {currentRole === 'admin' && (
            <Button 
              size="sm" 
              className="bg-brand-gradient hover:opacity-90 text-white shadow-brand"
              onClick={() => setShowCreateDialog(true)}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {t('people.addEmployee')}
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
                <p className="text-sm text-muted-foreground">{t('people.totalEmployees')}</p>
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
                <p className="text-sm text-muted-foreground">{t('people.activeEmployees')}</p>
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
                <p className="text-sm text-muted-foreground">{t('people.avgProgress')}</p>
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
                  placeholder={t('people.searchPlaceholder')}
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
                {t('common.filters')}
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
                  <h3 className="font-semibold text-foreground">{t('people.filterOptions')}</h3>
                  {activeFiltersCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3 mr-1" />
                      {t('common.clearAll')}
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Role Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t('people.role')}</label>
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
                    <label className="text-sm font-medium text-foreground">{t('people.homeStore')}</label>
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
                      <label className="text-sm font-medium text-foreground">{t('people.district')}</label>
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
                    <label className="text-sm font-medium text-foreground">{t('common.status')}</label>
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
                            {status === 'active' ? t('common.active') : status === 'inactive' ? t('common.inactive') : t('common.onLeave')}
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
            {t('people.employees')} ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Table Header */}
          <div
            className="grid gap-4 px-4 py-3 border-b bg-muted/30 text-xs font-medium text-muted-foreground"
            style={{ gridTemplateColumns: 'auto 1fr 120px 120px 140px 100px 80px 32px' }}
          >
            <div className="w-10"></div>
            <div>{t('people.employee')}</div>
            <div>{t('people.unit')}</div>
            <div>{t('people.district')}</div>
            <div>{t('people.progress')}</div>
            <div className="text-center">{t('people.tracks')}</div>
            <div className="text-center">{t('people.certs')}</div>
            <div></div>
          </div>
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
                <p className="text-muted-foreground">{t('people.noEmployees')}</p>
              </div>
            ) : (
              users.map((employee) => {
                const fullName = `${employee.first_name} ${employee.last_name}`;
                const initials = `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase();
                const completedTracks = employee.completed_tracks || 0;
                const totalTracks = employee.total_tracks || 0;
                const certifications = employee.certifications_count || 0;

                return (
                  <div
                    key={employee.id}
                    className="grid gap-4 px-4 py-4 hover:bg-accent/50 cursor-pointer transition-colors items-center relative group"
                    style={{ gridTemplateColumns: 'auto 1fr 120px 120px 140px 100px 80px 32px' }}
                    onClick={() => setSelectedEmployee(employee)}
                  >
                    {(currentRole === 'admin' || currentRole === 'district-manager') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-10 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingEmployee(employee);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}

                    <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                      <AvatarImage src={employee.avatar_url || undefined} alt={fullName} />
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 mb-0.5">
                        <h3 className="font-semibold text-foreground text-sm truncate">{fullName}</h3>
                        <Badge variant="outline" className={`${getStatusColor(employee.status)} text-xs py-0 h-5 flex-shrink-0`}>
                          {employee.status}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                        <span className="truncate">{employee.role?.name || t('people.noRole')}</span>
                        {(employee.last_active_at || employee.last_login) && (
                          <>
                            <span>•</span>
                            <span className="flex-shrink-0">{t('people.lastActive', { date: new Date(employee.last_active_at || employee.last_login).toLocaleDateString() })}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-sm text-foreground truncate">
                      {employee.store?.name || t('people.noStore')}
                    </div>

                    <div className="text-sm text-foreground truncate">
                      {employee.store?.district?.name || t('people.noDistrict')}
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="w-16 h-2 bg-accent rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${employee.overallProgress || 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-foreground w-10 text-right">
                        {employee.overallProgress || 0}%
                      </span>
                    </div>

                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{completedTracks}</p>
                      <p className="text-xs text-muted-foreground">{t('people.of')} {totalTracks}</p>
                    </div>

                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{certifications}</p>
                    </div>

                    <ChevronDown className="h-4 w-4 text-muted-foreground -rotate-90" />
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      {editingEmployee && (
        <EditPeopleDialog
          isOpen={!!editingEmployee}
          onClose={() => setEditingEmployee(null)}
          user={editingEmployee}
          onSuccess={() => {
            setEditingEmployee(null);
            refetch();
          }}
        />
      )}

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('people.addNewEmployee')}</DialogTitle>
            <DialogDescription>
              {t('people.addNewEmployeeDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">{t('people.firstName')} *</Label>
                <Input
                  id="first_name"
                  value={newUser.first_name}
                  onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="last_name">{t('people.lastName')} *</Label>
                <Input
                  id="last_name"
                  value={newUser.last_name}
                  onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">{t('common.email')} *</Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="john.doe@trike.com"
              />
            </div>

            <div>
              <Label htmlFor="phone">{t('common.phone')}</Label>
              <Input
                id="phone"
                type="tel"
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div>
              <Label htmlFor="role">{t('people.role')} *</Label>
              <Select value={newUser.role_id} onValueChange={(val) => setNewUser({ ...newUser, role_id: val })}>
                <SelectTrigger id="role">
                  <SelectValue placeholder={t('people.selectRole')} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="store">{t('people.homeStore')} *</Label>
              <Select value={newUser.store_id} onValueChange={(val) => setNewUser({ ...newUser, store_id: val })}>
                <SelectTrigger id="store">
                  <SelectValue placeholder={t('people.selectStore')} />
                </SelectTrigger>
                <SelectContent>
                  {stores.map(store => (
                    <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="hire_date">{t('people.hireDate')}</Label>
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
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateUser} disabled={creating} className="bg-brand-gradient">
              {creating ? t('common.creating') : t('people.createEmployee')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Employee Import Dialog */}
      <BulkEmployeeImport
        open={showImportDialog}
        onClose={() => {
          setShowImportDialog(false);
          refetch();
        }}
        onSuccess={() => refetch()}
      />

      <Footer />
    </div>
  );
}