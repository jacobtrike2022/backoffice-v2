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
  role1: Role;
  role2: Role;
  onMergeComplete: () => void;
}

export function MergeRoleWizard({
  isOpen,
  onClose,
  role1,
  role2,
  onMergeComplete,
}: MergeRoleWizardProps) {
  const [targetRole, setTargetRole] = useState<'role1' | 'role2'>('role1');
  const [reason, setReason] = useState('');
  const [merging, setMerging] = useState(false);

  // Auto-select role with more users as the one to keep
  useEffect(() => {
    if (role1.user_count && role2.user_count) {
      if (role1.user_count > role2.user_count) {
        setTargetRole('role1');
      } else if (role2.user_count > role1.user_count) {
        setTargetRole('role2');
      } else {
        // If equal users, pick older role (created_at earlier)
        const role1Date = new Date(role1.created_at);
        const role2Date = new Date(role2.created_at);
        setTargetRole(role1Date < role2Date ? 'role1' : 'role2');
      }
    } else if (role1.user_count && !role2.user_count) {
      setTargetRole('role1');
    } else if (!role1.user_count && role2.user_count) {
      setTargetRole('role2');
    } else {
      // Both have 0 users, pick older one
      const role1Date = new Date(role1.created_at);
      const role2Date = new Date(role2.created_at);
      setTargetRole(role1Date < role2Date ? 'role1' : 'role2');
    }
  }, [role1, role2]);

  // Determine which is source and which is target
  const keepRole = targetRole === 'role1' ? role1 : role2;
  const sourceRole = targetRole === 'role1' ? role2 : role1;

  async function handleMerge() {
    try {
      setMerging(true);

      const result = await rolesApi.mergeRoles(
        sourceRole.id, // FROM this role
        keepRole.id, // TO this role
        reason || undefined
      );

      toast.success('Roles merged successfully', {
        description: `${result.users_migrated} user${result.users_migrated !== 1 ? 's' : ''} moved to ${keepRole.name}`,
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

  if (!isOpen) return null;

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
            <h3 className="font-semibold text-sm">Step 1: Select which role to keep</h3>
            <Separator />

            <RadioGroup value={targetRole} onValueChange={(value) => setTargetRole(value as 'role1' | 'role2')}>
              <div className="space-y-4">
                {/* Role 1 Option */}
                <div className="border-2 rounded-lg p-4 cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setTargetRole('role1')}
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="role1" id="role1" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="role1" className="cursor-pointer font-semibold text-base">
                        Keep: {role1.name}
                      </Label>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {role1.department && (
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            <span>Department: {role1.department}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>Users: {role1.user_count || 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Created: {formatDate(role1.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Role 2 Option */}
                <div className="border-2 rounded-lg p-4 cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setTargetRole('role2')}
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="role2" id="role2" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="role2" className="cursor-pointer font-semibold text-base">
                        Merge from: {role2.name}
                      </Label>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {role2.department && (
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            <span>Department: {role2.department}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>Users: {role2.user_count || 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Created: {formatDate(role2.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Step 2: Preview */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Step 2: What will happen?</h3>
            <Separator />

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5"></div>
                <p className="text-sm">
                  <strong>{sourceRole.user_count || 0} user{sourceRole.user_count !== 1 ? 's' : ''}</strong> will be moved to{' '}
                  <strong>"{keepRole.name}"</strong>
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5"></div>
                <p className="text-sm">
                  <strong>"{sourceRole.name}"</strong> (duplicate) will be archived
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5"></div>
                <p className="text-sm">
                  An alias will be created to map <strong>"{sourceRole.name}"</strong> → <strong>"{keepRole.name}"</strong> for future matching
                </p>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {sourceRole.department !== keepRole.department && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    ⚠️ Different Departments
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    These roles have different departments: <strong>{sourceRole.department || 'None'}</strong> → <strong>{keepRole.department || 'None'}</strong>
                  </p>
                </div>
              </div>
            </div>
          )}

          {sourceRole.user_count && sourceRole.user_count > 0 && (
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    ℹ️ Users Will Be Moved
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    {sourceRole.user_count} user{sourceRole.user_count !== 1 ? 's' : ''} currently assigned to "{sourceRole.name}" will be reassigned to "{keepRole.name}".
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

