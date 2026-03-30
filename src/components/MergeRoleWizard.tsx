import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Separator } from './ui/separator';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { AlertCircle, Users, Calendar, Building2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { rolesApi } from '../lib/api/roles';
import type { Role } from '../types/roles';

interface MergeRoleWizardProps {
  isOpen: boolean;
  onClose: () => void;
  roles: Role[]; // Changed from role1/role2 to array
  onMergeComplete: () => void;
}

export function MergeRoleWizard({
  isOpen,
  onClose,
  roles,
  onMergeComplete,
}: MergeRoleWizardProps) {
  const { t } = useTranslation();
  const [targetRoleId, setTargetRoleId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [merging, setMerging] = useState(false);

  // Auto-select role with most users as default
  useEffect(() => {
    if (roles.length > 0) {
      const roleWithMostUsers = roles.reduce((prev, current) =>
        (current.user_count || 0) > (prev.user_count || 0) ? current : prev
      );
      setTargetRoleId(roleWithMostUsers.id);
    }
  }, [roles]);

  const targetRole = roles.find((r) => r.id === targetRoleId);
  const sourceRoles = roles.filter((r) => r.id !== targetRoleId);
  const totalUsersToMove = sourceRoles.reduce(
    (sum, r) => sum + (r.user_count || 0),
    0
  );

  async function handleMerge() {
    if (!targetRoleId || sourceRoles.length === 0) return;

    try {
      setMerging(true);

      // Merge each source role into the target role sequentially
      let totalUsersMoved = 0;
      for (const sourceRole of sourceRoles) {
        const result = await rolesApi.mergeRoles(
          sourceRole.id,
          targetRoleId,
          reason ||
            `Manual merge: ${sourceRoles.map((r) => r.name).join(', ')} → ${targetRole?.name}`
        );
        totalUsersMoved += result.users_migrated;
      }

      toast.success(t('roles.toastMergeSuccess'), {
        description: `${totalUsersMoved} user${totalUsersMoved !== 1 ? 's' : ''} moved to "${targetRole?.name}". ${sourceRoles.length} role${sourceRoles.length > 1 ? 's' : ''} archived.`,
      });

      onMergeComplete();
      onClose();
    } catch (error: any) {
      console.error('Error merging roles:', error);
      toast.error(t('roles.toastMergeFailed'), {
        description: error.message || 'An unexpected error occurred',
      });
    } finally {
      setMerging(false);
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (!isOpen || roles.length < 2) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('roles.mergeRolesTitle')}</DialogTitle>
          <DialogDescription>
            {t('roles.mergeRolesDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Select which role to keep */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">
              {t('roles.mergeStep1')}
            </h3>
            <Separator />

            <RadioGroup
              value={targetRoleId}
              onValueChange={(value) => setTargetRoleId(value)}
            >
              <div className="space-y-3">
                {roles.map((role) => (
                  <label
                    key={role.id}
                    className={`
                      flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all
                      ${
                        targetRoleId === role.id
                          ? 'border-orange-500 bg-orange-500/10 dark:bg-orange-500/20'
                          : 'border-border hover:border-primary/50'
                      }
                    `}
                  >
                    <RadioGroupItem
                      value={role.id}
                      id={`role-${role.id}`}
                      className="mt-1"
                    />
                    <div className="ml-3 flex-1">
                      <Label
                        htmlFor={`role-${role.id}`}
                        className={`cursor-pointer font-semibold text-base ${
                          targetRoleId === role.id ? 'text-foreground' : ''
                        }`}
                      >
                        {targetRoleId === role.id ? t('roles.keepPrefix') : ''}
                        {role.name}
                      </Label>
                      <div className={`mt-2 space-y-1 text-sm ${
                        targetRoleId === role.id ? 'text-foreground/80' : 'text-muted-foreground'
                      }`}>
                        {role.department && (
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            <span>{t('roles.departmentLabel', { dept: role.department })}</span>
                          </div>
                        )}
                        {role.job_family && (
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            <span>{t('roles.jobFamilyLabel', { family: role.job_family })}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>{t('roles.usersLabel', { count: role.user_count || 0 })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{t('roles.createdLabel', { date: formatDate(role.created_at) })}</span>
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Step 2: Preview */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">{t('roles.mergeStep2')}</h3>
            <Separator />

            <div className="bg-muted border-l-4 border-border p-4 rounded-lg">
              <h4 className="font-medium mb-2">
                {t('roles.whatWillHappen')}
              </h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>
                  • <strong>{totalUsersToMove} user{totalUsersToMove !== 1 ? 's' : ''}</strong> will be moved to{' '}
                  <strong>"{targetRole?.name}"</strong>
                </li>
                <li>
                  • <strong>{sourceRoles.length} role{sourceRoles.length > 1 ? 's' : ''}</strong> will be archived:
                </li>
                <ul className="ml-6 mt-1 space-y-1">
                  {sourceRoles.map((r) => (
                    <li key={r.id}>
                      - {r.name} ({r.user_count || 0} user{r.user_count !== 1 ? 's' : ''})
                    </li>
                  ))}
                </ul>
                <li>• {t('roles.aliasesWillBeCreated')}</li>
              </ul>
            </div>
          </div>

          {/* Warnings for Different Properties */}
          {sourceRoles.some(
            (r) => r.department !== targetRole?.department
          ) && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    {t('roles.differentDepartmentsWarning')}
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    {t('roles.differentDepartmentsDesc')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {totalUsersToMove > 0 && (
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    {t('roles.usersWillBeMovedTitle')}
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    {totalUsersToMove} user{totalUsersToMove !== 1 ? 's' : ''} currently assigned to the source role{sourceRoles.length > 1 ? 's' : ''} will be reassigned to "{targetRole?.name}".
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="merge-reason">{t('roles.reasonForMerge')}</Label>
            <Textarea
              id="merge-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('roles.mergeReasonPlaceholder')}
              rows={3}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={merging}>
              {t('common.cancel')}
            </Button>
            <Button
              className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
              onClick={handleMerge}
              disabled={merging}
            >
              {merging ? t('roles.merging') : t('roles.mergeRolesBtn')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
