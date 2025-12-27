import React, { useState, useEffect } from 'react';
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

      toast.success('Roles merged successfully', {
        description: `${totalUsersMoved} user${totalUsersMoved !== 1 ? 's' : ''} moved to "${targetRole?.name}". ${sourceRoles.length} role${sourceRoles.length > 1 ? 's' : ''} archived.`,
      });

      onMergeComplete();
      onClose();
    } catch (error: any) {
      console.error('Error merging roles:', error);
      toast.error('Failed to merge roles', {
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
          <DialogTitle>Merge Roles</DialogTitle>
          <DialogDescription>
            Select which role to keep and review what will happen during the merge.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Select which role to keep */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">
              Step 1: Select which role to keep
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
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
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
                        className="cursor-pointer font-semibold text-base"
                      >
                        {targetRoleId === role.id ? 'Keep: ' : ''}
                        {role.name}
                      </Label>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {role.department && (
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            <span>Department: {role.department}</span>
                          </div>
                        )}
                        {role.job_family && (
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            <span>Job Family: {role.job_family}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>Users: {role.user_count || 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Created: {formatDate(role.created_at)}</span>
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
            <h3 className="font-semibold text-sm">Step 2: What will happen?</h3>
            <Separator />

            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">
                What will happen:
              </h4>
              <ul className="space-y-1 text-sm text-blue-800">
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
                <li>• Aliases will be created for future matching</li>
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
                    ⚠️ Different Departments
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Some roles have different departments. Users will keep their
                    current role assignment after merge.
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
                    ℹ️ Users Will Be Moved
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
            <Label htmlFor="merge-reason">Reason for merge (optional)</Label>
            <Textarea
              id="merge-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Duplicate role created by mistake"
              rows={3}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={merging}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
              onClick={handleMerge}
              disabled={merging}
            >
              {merging ? 'Merging...' : 'Merge Roles'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
