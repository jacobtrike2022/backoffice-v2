import React, { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { rolesApi } from '../lib/api/roles';
import type { Role, CreateRoleInput, UpdateRoleInput, DuplicateRoleSuggestion } from '../types/roles';
import { RoleModal } from './RoleModal';
import { DuplicatesModal } from './DuplicatesModal';

export function RolesManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [showArchived, setShowArchived] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [userListPopover, setUserListPopover] = useState<string | null>(null);
  const [userListData, setUserListData] = useState<{ name: string; email: string }[]>([]);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);

  useEffect(() => {
    loadRoles();
  }, [showArchived]);

  async function loadRoles() {
    try {
      setLoading(true);
      const data = await rolesApi.list(showArchived);
      setRoles(data);
    } catch (error: any) {
      console.error('Error loading roles:', error);
      toast.error('Failed to load roles', {
        description: error.message || 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  }

  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      // Search filter
      const matchesSearch =
        searchTerm === '' ||
        role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.job_family?.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === 'all' || role.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [roles, searchTerm, statusFilter]);

  const handleCreateRole = async (input: CreateRoleInput) => {
    try {
      await rolesApi.create(input);
      await loadRoles();
      setIsModalOpen(false);
      toast.success('Role created successfully');
    } catch (error: any) {
      console.error('Error creating role:', error);
      toast.error('Failed to create role', {
        description: error.message || 'An unexpected error occurred',
      });
      throw error;
    }
  };

  const handleUpdateRole = async (input: UpdateRoleInput) => {
    try {
      await rolesApi.update(input);
      await loadRoles();
      setIsModalOpen(false);
      setEditingRole(null);
      toast.success('Role updated successfully');
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role', {
        description: error.message || 'An unexpected error occurred',
      });
      throw error;
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (
      !confirm(
        'Are you sure you want to archive this role? It will be marked as archived and hidden from active lists.'
      )
    )
      return;

    try {
      await rolesApi.delete(roleId);
      await loadRoles();
      toast.success('Role archived successfully');
    } catch (error: any) {
      console.error('Error deleting role:', error);
      toast.error('Failed to archive role', {
        description: error.message || 'An unexpected error occurred',
      });
    }
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setIsModalOpen(true);
  };

  const handleOpenCreateModal = () => {
    setEditingRole(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRole(null);
  };

  const handleViewUsers = async (roleId: string) => {
    try {
      const users = await rolesApi.getUsersForRole(roleId);
      setUserListData(
        users.map((u) => ({
          name: `${u.first_name} ${u.last_name}`,
          email: u.email || '',
        }))
      );
      setUserListPopover(roleId);
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'archived':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'pending_review':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPermissionLevelLabel = (level: number) => {
    switch (level) {
      case 1:
        return 'Basic Employee';
      case 2:
        return 'Team Lead';
      case 3:
        return 'Manager';
      case 4:
        return 'District/Regional Manager';
      case 5:
        return 'Corporate/Executive';
      default:
        return `Level ${level}`;
    }
  };

  // Get unique departments for filter (future enhancement)
  const uniqueDepartments = useMemo(() => {
    const depts = new Set<string>();
    roles.forEach((role) => {
      if (role.department) depts.add(role.department);
    });
    return Array.from(depts).sort();
  }, [roles]);

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
            onClick={handleOpenCreateModal}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Role
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDuplicatesModal(true)}
          >
            Find Duplicates
          </Button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search roles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="status-filter" className="text-sm font-medium">
            Status:
          </Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="status-filter" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="show-archived"
            checked={showArchived}
            onCheckedChange={(checked) => setShowArchived(checked === true)}
          />
          <Label
            htmlFor="show-archived"
            className="text-sm font-normal cursor-pointer"
          >
            Show archived
          </Label>
        </div>
      </div>

      {/* Roles Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4 text-sm text-muted-foreground">
                Loading roles...
              </p>
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">
                {searchTerm || statusFilter !== 'all'
                  ? 'No roles match your search'
                  : 'No roles found'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your filters or search terms'
                  : 'Create your first role to get started'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Button
                  className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
                  onClick={handleOpenCreateModal}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Role
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Job Family</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Permission Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.map((role) => (
                  <TableRow
                    key={role.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleEditRole(role)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{role.display_name || role.name}</span>
                        {role.display_name && (
                          <span className="text-xs text-muted-foreground">
                            {role.name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {role.department || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {role.job_family || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Popover
                        open={userListPopover === role.id}
                        onOpenChange={(open) => {
                          if (!open) setUserListPopover(null);
                        }}
                      >
                        <PopoverTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewUsers(role.id);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium transition-colors ${
                              role.user_count && role.user_count > 0
                                ? 'text-blue-600 hover:bg-blue-50'
                                : 'text-muted-foreground'
                            }`}
                          >
                            <Users className="w-3 h-3" />
                            {role.user_count || 0}
                          </button>
                        </PopoverTrigger>
                        {userListData.length > 0 && (
                          <PopoverContent className="w-64">
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm mb-2">
                                Users with this role
                              </h4>
                              {userListData.slice(0, 5).map((user, idx) => (
                                <div
                                  key={idx}
                                  className="text-sm py-1 border-b last:border-0"
                                >
                                  <div className="font-medium">{user.name}</div>
                                  {user.email && (
                                    <div className="text-xs text-muted-foreground">
                                      {user.email}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {userListData.length > 5 && (
                                <p className="text-xs text-muted-foreground pt-2">
                                  and {userListData.length - 5} more
                                </p>
                              )}
                            </div>
                          </PopoverContent>
                        )}
                      </Popover>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {role.permission_level} -{' '}
                        {getPermissionLevelLabel(role.permission_level)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${getStatusColor(role.status)} border`}
                      >
                        {role.status.charAt(0).toUpperCase() +
                          role.status.slice(1).replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditRole(role);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRole(role.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Role Modal */}
      <RoleModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={editingRole ? handleUpdateRole : handleCreateRole}
        editingRole={editingRole}
      />

      {/* Duplicates Modal */}
      <DuplicatesModal
        isOpen={showDuplicatesModal}
        onClose={() => setShowDuplicatesModal(false)}
        onRolesChanged={loadRoles}
        roles={roles}
      />
    </div>
  );
}

