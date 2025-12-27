import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Separator } from './ui/separator';
import { AlertCircle, ArrowDown, Users, X } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { rolesApi } from '../lib/api/roles';
import type { Role, DuplicateRoleSuggestion } from '../types/roles';
import { MergeRoleWizard } from './MergeRoleWizard';

interface DuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRolesChanged: () => void;
  roles: Role[];
}

export function DuplicatesModal({
  isOpen,
  onClose,
  onRolesChanged,
  roles,
}: DuplicatesModalProps) {
  const [duplicates, setDuplicates] = useState<DuplicateRoleSuggestion[]>([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [showMergeWizard, setShowMergeWizard] = useState(false);
  const [mergingPair, setMergingPair] = useState<{ role1: Role; role2: Role } | null>(null);

  useEffect(() => {
    if (isOpen) {
      scanForDuplicates();
    } else {
      // Reset state when modal closes
      setDuplicates([]);
      setShowMergeWizard(false);
      setMergingPair(null);
    }
  }, [isOpen]);

  async function scanForDuplicates() {
    try {
      setLoadingDuplicates(true);
      const results = await rolesApi.findDuplicates(0.4); // 40% similarity threshold (lower to catch abbreviations)
      setDuplicates(results);
    } catch (error: any) {
      console.error('Error finding duplicates:', error);
      
      // Check for type mismatch error
      if (error.name === 'TypeMismatchError' || error.message?.includes('type mismatch')) {
        toast.error('Database function needs update', {
          description: 'The find_duplicate_roles function returns REAL type but needs NUMERIC. See FIX_DUPLICATE_ROLES_FUNCTION.md for instructions.',
          duration: 10000,
        });
      } else {
        toast.error('Failed to scan for duplicates', {
          description: error.message || 'An unexpected error occurred',
        });
      }
    } finally {
      setLoadingDuplicates(false);
    }
  }

  function getSimilarityColor(score: number): string {
    if (score >= 0.9) return 'text-red-600';
    if (score >= 0.75) return 'text-orange-600';
    return 'text-yellow-600';
  }

  function getSimilarityBadgeColor(score: number): string {
    if (score >= 0.9) return 'bg-red-100 text-red-800 border-red-200';
    if (score >= 0.75) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  }

  function handleMergeClick(duplicate: DuplicateRoleSuggestion) {
    const role1 = roles.find((r) => r.id === duplicate.role_id);
    const role2 = roles.find((r) => r.id === duplicate.potential_match_id);

    if (role1 && role2) {
      setMergingPair({ role1, role2 });
      setShowMergeWizard(true);
    } else {
      toast.error('Could not find role details');
    }
  }

  function handleMergeComplete() {
    setShowMergeWizard(false);
    setMergingPair(null);
    scanForDuplicates(); // Re-scan after merge
    onRolesChanged(); // Refresh main list
  }

  function getRoleUserCount(roleId: string): number {
    const role = roles.find((r) => r.id === roleId);
    return role?.user_count || 0;
  }

  function getRoleDepartment(roleId: string): string | null {
    const role = roles.find((r) => r.id === roleId);
    return role?.department || null;
  }

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Duplicate Roles Detected</DialogTitle>
            <DialogDescription>
              We found {duplicates.length} potential duplicate role{duplicates.length !== 1 ? 's' : ''}. Review each pair and merge if appropriate.
            </DialogDescription>
          </DialogHeader>

          {loadingDuplicates ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-gray-600">Scanning for duplicate roles...</p>
            </div>
          ) : duplicates.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No duplicates found!
              </h3>
              <p className="text-gray-500">
                Your roles are clean and unique.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {duplicates.map((duplicate, index) => {
                const similarityPercent = Math.round(duplicate.similarity_score * 100);
                const role1Users = getRoleUserCount(duplicate.role_id);
                const role2Users = getRoleUserCount(duplicate.potential_match_id);
                const role1Dept = getRoleDepartment(duplicate.role_id);
                const role2Dept = getRoleDepartment(duplicate.potential_match_id);

                return (
                  <Card key={index} className="border-2">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        {/* Role 1 */}
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-lg">
                              {duplicate.role_name}
                            </h4>
                            {role1Dept && (
                              <p className="text-sm text-muted-foreground">
                                {role1Dept}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                {role1Users} user{role1Users !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Similarity Score */}
                        <div className="flex items-center justify-center py-2">
                          <ArrowDown className="w-5 h-5 text-muted-foreground" />
                          <Badge
                            className={`ml-2 ${getSimilarityBadgeColor(
                              duplicate.similarity_score
                            )} border font-semibold`}
                          >
                            {similarityPercent}% match
                          </Badge>
                        </div>

                        {/* Role 2 */}
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-lg">
                              {duplicate.potential_match_name}
                            </h4>
                            {role2Dept && (
                              <p className="text-sm text-muted-foreground">
                                {role2Dept}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                {role2Users} user{role2Users !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Warning if different departments */}
                        {role1Dept && role2Dept && role1Dept !== role2Dept && (
                          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                              <p className="text-sm text-yellow-700">
                                ⚠️ These roles have different departments:{' '}
                                {role1Dept} → {role2Dept}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* User migration preview */}
                        {role2Users > 0 && (
                          <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                            <p className="text-sm text-blue-700">
                              {role2Users} user{role2Users !== 1 ? 's' : ''} will be moved to{' '}
                              {duplicate.role_name}
                            </p>
                          </div>
                        )}

                        <Separator />

                        {/* Actions */}
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              // Remove from duplicates list (ignore)
                              setDuplicates(
                                duplicates.filter((_, i) => i !== index)
                              );
                            }}
                          >
                            Ignore
                          </Button>
                          <Button
                            className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
                            onClick={() => handleMergeClick(duplicate)}
                          >
                            Merge These Roles
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Info Footer */}
          {duplicates.length > 0 && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-1">💡 What happens when you merge:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>All users from the second role will be moved to the first role</li>
                    <li>The second role will be archived</li>
                    <li>An alias will be created for future matching</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={onClose}>
              Done
            </Button>
            {duplicates.length > 0 && (
              <Button
                variant="outline"
                onClick={scanForDuplicates}
                disabled={loadingDuplicates}
              >
                Scan Again
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Merge Wizard */}
      {showMergeWizard && mergingPair && (
        <MergeRoleWizard
          isOpen={showMergeWizard}
          onClose={() => {
            setShowMergeWizard(false);
            setMergingPair(null);
          }}
          roles={[mergingPair.role1, mergingPair.role2]}
          onMergeComplete={handleMergeComplete}
        />
      )}
    </>
  );
}

