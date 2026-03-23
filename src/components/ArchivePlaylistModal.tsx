import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Card, CardContent } from './ui/card';
import {
  Archive,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  Info
} from 'lucide-react';

interface ArchivePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlistId: string;
  playlistTitle: string;
  onArchive: (playlistId: string, archiveAssignments: boolean) => Promise<void>;
}

type AssignmentStrategy = 'keep-active' | 'archive-assignments';

interface AssignmentStats {
  totalAssignments: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
}

export function ArchivePlaylistModal({
  isOpen,
  onClose,
  playlistId,
  playlistTitle,
  onArchive
}: ArchivePlaylistModalProps) {
  const [assignmentStrategy, setAssignmentStrategy] = useState<AssignmentStrategy>('keep-active');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState<AssignmentStats>({
    totalAssignments: 0,
    completedCount: 0,
    inProgressCount: 0,
    notStartedCount: 0
  });

  useEffect(() => {
    if (isOpen && playlistId) {
      loadAssignmentData();
    }
  }, [isOpen, playlistId]);

  const loadAssignmentData = async () => {
    setIsLoading(true);
    try {
      // Import dynamically to avoid circular deps
      const { getPlaylistAssignmentStats } = await import('../lib/crud/playlists');
      const statsData = await getPlaylistAssignmentStats(playlistId);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading assignment data:', error);
      // Set defaults if error
      setStats({
        totalAssignments: 0,
        completedCount: 0,
        inProgressCount: 0,
        notStartedCount: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchive = async () => {
    setIsSaving(true);
    try {
      await onArchive(playlistId, assignmentStrategy === 'archive-assignments');
      onClose();
    } catch (error) {
      console.error('Error archiving playlist:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const activeAssignments = stats.inProgressCount + stats.notStartedCount;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && isSaving) return;
      onClose();
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Archive className="h-5 w-5 text-muted-foreground" />
            Archive Playlist
          </DialogTitle>
          <DialogDescription className="space-y-1.5 pt-2" asChild>
            <div>
              <div>You're archiving "{playlistTitle}".</div>
              <div className="flex items-center text-primary text-sm">
                <Info className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                <span>Completion records will be preserved for reporting.</span>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-4">
          {/* Assignment Stats */}
          {!isLoading && stats.totalAssignments > 0 && (
            <Card className="border-2">
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">
                    {stats.totalAssignments} {stats.totalAssignments === 1 ? 'assignment' : 'assignments'} found
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <div className="text-xl font-bold text-green-600">{stats.completedCount}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <div className="text-xl font-bold text-yellow-600">{stats.inProgressCount}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">In Progress</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <Users className="h-4 w-4 text-blue-600" />
                      <div className="text-xl font-bold text-blue-600">{stats.notStartedCount}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">Not Started</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No assignments message */}
          {!isLoading && stats.totalAssignments === 0 && (
            <Card className="border bg-accent/30">
              <CardContent className="pt-5 pb-5 text-center">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No active assignments for this playlist.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Strategy Selection - Only show if there are active assignments */}
          {!isLoading && activeAssignments > 0 && (
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-base mb-1">
                  What should happen to active assignments?
                </h3>
                <p className="text-sm text-muted-foreground">
                  {activeAssignments} {activeAssignments === 1 ? 'learner has' : 'learners have'} an active assignment to this playlist.
                </p>
              </div>

              <RadioGroup
                value={assignmentStrategy}
                onValueChange={(value) => setAssignmentStrategy(value as AssignmentStrategy)}
              >
                <Card className={`cursor-pointer transition-all ${assignmentStrategy === 'keep-active' ? 'ring-2 ring-primary' : ''}`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="keep-active" id="keep-active" className="mt-0.5" />
                      <div className="flex-1">
                        <Label htmlFor="keep-active" className="cursor-pointer font-medium">
                          Keep assignments active <span className="text-muted-foreground">(recommended)</span>
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Learners can still complete their assignments. The playlist won't appear for new assignments.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`cursor-pointer transition-all ${assignmentStrategy === 'archive-assignments' ? 'ring-2 ring-primary' : ''}`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="archive-assignments" id="archive-assignments" className="mt-0.5" />
                      <div className="flex-1">
                        <Label htmlFor="archive-assignments" className="cursor-pointer font-medium">
                          Archive all assignments
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          All {activeAssignments} active {activeAssignments === 1 ? 'assignment' : 'assignments'} will be archived. Learners won't see this in their to-do list.
                        </p>
                        {assignmentStrategy === 'archive-assignments' && (
                          <div className="mt-3 p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800">
                            <div className="flex items-start space-x-2 text-sm text-orange-800 dark:text-orange-200">
                              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <span>This will remove {activeAssignments} {activeAssignments === 1 ? 'assignment' : 'assignments'} from learners' dashboards.</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </RadioGroup>
            </div>
          )}

          {/* What We'll Handle */}
          <Card className="bg-accent/30 border">
            <CardContent className="pt-4 pb-4">
              <h4 className="text-sm font-semibold mb-2">What happens when you archive:</h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Playlist won't appear in new assignment dropdowns</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>All completion records are preserved for reporting</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>You can unarchive the playlist at any time</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleArchive}
              disabled={isSaving || isLoading}
              variant="default"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Archiving...
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive Playlist
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
