import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useRoles, useStores, useCurrentUser, useEffectiveOrgId } from '../lib/hooks/useSupabase';
import { toast } from 'sonner@2.0.3';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  mobile_phone?: string | null;
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
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [terminationDate, setTerminationDate] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'on-leave'>('active');
  const [roleId, setRoleId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [saving, setSaving] = useState(false);

  const { user: currentUser } = useCurrentUser();
  const { orgId: effectiveOrgId } = useEffectiveOrgId();
  const { roles } = useRoles(effectiveOrgId ?? undefined);
  const { stores } = useStores(effectiveOrgId ? { organization_id: effectiveOrgId } : undefined);

  // Pre-fill form when user data is provided
  useEffect(() => {
    if (user && isOpen) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setMobilePhone(user.mobile_phone || '');
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
      toast.error(t('people.firstNameRequired'));
      return;
    }

    if (!lastName.trim()) {
      toast.error(t('people.lastNameRequired'));
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      toast.error(t('people.validEmailRequired'));
      return;
    }

    setSaving(true);
    try {
      const updateData: any = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        mobile_phone: mobilePhone.trim() || null,
        employee_id: employeeId.trim() || null,
        hire_date: hireDate || null,
        termination_date: terminationDate || null,
        status,
        role_id: roleId || null,
        store_id: storeId || null,
      };

      await updateUser(user.id, updateData);
      toast.success(t('people.employeeUpdated'));
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating employee:', error);
      toast.error(error.message || t('people.failedUpdateEmployee'));
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
          <DialogTitle>{t('people.editEmployee')}</DialogTitle>
          <DialogDescription>
            {t('people.editEmployeeDesc')}
          </DialogDescription>
        </DialogHeader>

        {!user ? (
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">{t('people.basicInformation')}</h3>
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
              <h3 className="font-semibold text-foreground">{t('people.employmentInformation')}</h3>
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
            <h3 className="font-semibold text-foreground">{t('people.basicInformation')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">{t('people.firstNameLabel')}</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="lastName">{t('people.lastNameLabel')}</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">{t('people.emailAddressLabel')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john.doe@company.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mobilePhone">Mobile Phone *</Label>
                <Input
                  id="mobilePhone"
                  type="tel"
                  value={mobilePhone}
                  onChange={(e) => setMobilePhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <Label htmlFor="phone">{t('people.phoneNumberLabel')}</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>

          {/* Employment Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">{t('people.employmentInformation')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employeeId">{t('people.employeeIdLabel')}</Label>
                <Input
                  id="employeeId"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="EMP-001"
                />
              </div>
              <div>
                <Label htmlFor="status">{t('people.statusLabel')}</Label>
                <Select value={status} onValueChange={(value: 'active' | 'inactive' | 'on-leave') => setStatus(value)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('common.active')}</SelectItem>
                    <SelectItem value="inactive">{t('common.inactive')}</SelectItem>
                    <SelectItem value="on-leave">{t('common.onLeave')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hireDate">{t('people.hireDateLabel')}</Label>
                <Input
                  id="hireDate"
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="terminationDate">{t('people.terminationDateLabel')}</Label>
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
            <h3 className="font-semibold text-foreground">{t('people.roleAndStoreAssignment')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">{t('people.roleLabel')}</Label>
                <Select
                  value={roleId || 'none'}
                  onValueChange={(v) => setRoleId(v === 'none' ? '' : v)}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder={t('people.selectRolePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('people.noneNotAssigned')}</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="store">{t('people.homeStoreLabel')}</Label>
                <Select
                  value={storeId || 'none'}
                  onValueChange={(v) => setStoreId(v === 'none' ? '' : v)}
                >
                  <SelectTrigger id="store">
                    <SelectValue placeholder={t('people.selectStorePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('people.noneUnassigned')}</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving || !user}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !user}
            className="bg-brand-gradient hover:opacity-90 text-white shadow-brand"
          >
{saving ? t('common.saving') : t('common.saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

