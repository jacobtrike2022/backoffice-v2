import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Skeleton } from './ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { updateUser } from '../lib/crud/users';
import { useRoles, useStores, useCurrentUser } from '../lib/hooks/useSupabase';
import { toast } from 'sonner@2.0.3';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  employee_id?: string | null;
  hire_date?: string | null;
  termination_date?: string | null;
  status: 'active' | 'inactive' | 'on-leave';
  role_id?: string | null;
  store_id?: string | null;
}

interface EditPeopleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSuccess: () => void;
}

export function EditPeopleDialog({ isOpen, onClose, user, onSuccess }: EditPeopleDialogProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [terminationDate, setTerminationDate] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'on-leave'>('active');
  const [roleId, setRoleId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [saving, setSaving] = useState(false);

  const { user: currentUser } = useCurrentUser();
  const { roles } = useRoles(currentUser?.organization_id);
  const { stores } = useStores({ organization_id: currentUser?.organization_id });

  // Pre-fill form when user data is provided
  useEffect(() => {
    if (user && isOpen) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setEmployeeId(user.employee_id || '');
      setHireDate(user.hire_date ? user.hire_date.split('T')[0] : '');
      setTerminationDate(user.termination_date ? user.termination_date.split('T')[0] : '');
      setStatus(user.status || 'active');
      setRoleId(user.role_id || '');
      setStoreId(user.store_id || '');
    }
  }, [user, isOpen]);

  const handleSave = async () => {
    if (!user) return;

    if (!firstName.trim()) {
      toast.error('First name is required');
      return;
    }

    if (!lastName.trim()) {
      toast.error('Last name is required');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      toast.error('Valid email is required');
      return;
    }

    setSaving(true);
    try {
      const updateData: any = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        employee_id: employeeId.trim() || null,
        hire_date: hireDate || null,
        termination_date: terminationDate || null,
        status,
        role_id: roleId || null,
        store_id: storeId || null,
      };

      await updateUser(user.id, updateData);
      toast.success('Employee updated successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating employee:', error);
      toast.error(error.message || 'Failed to update employee');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
          <DialogDescription>
            Update employee information and details
          </DialogDescription>
        </DialogHeader>

        {!user ? (
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Employment Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john.doe@company.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          {/* Employment Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Employment Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input
                  id="employeeId"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="EMP-001"
                />
              </div>
              <div>
                <Label htmlFor="status">Status *</Label>
                <Select value={status} onValueChange={(value: 'active' | 'inactive' | 'on-leave') => setStatus(value)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on-leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hireDate">Hire Date</Label>
                <Input
                  id="hireDate"
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="terminationDate">Termination Date</Label>
                <Input
                  id="terminationDate"
                  type="date"
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                  disabled={status !== 'inactive'}
                />
              </div>
            </div>
          </div>

          {/* Role and Store Assignment */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Role and Store Assignment</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={roleId || undefined} onValueChange={setRoleId}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.length > 0 ? (
                      roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No roles available
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="store">Home Store</Label>
                <Select value={storeId || undefined} onValueChange={setStoreId}>
                  <SelectTrigger id="store">
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.length > 0 ? (
                      stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No stores available
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving || !user}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !user}
            className="bg-brand-gradient hover:opacity-90 text-white shadow-brand"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

