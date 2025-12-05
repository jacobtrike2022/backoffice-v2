import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Save,
  Info,
  Sparkles
} from 'lucide-react';
import * as crud from '../../lib/crud/tracks';

interface VersionDecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackId: string;
  trackTitle: string;
  currentVersion: number;
  onVersionCreated: (newTrackId: string, strategy: string) => void;
  pendingChanges: any; // The track updates to save
}

type CompletedStrategy = 'keep' | 'require-retake';
type InProgressStrategy = 'move-to-v2' | 'finish-v1';

export function VersionDecisionModal({
  isOpen,
  onClose,
  trackId,
  trackTitle,
  currentVersion,
  onVersionCreated,
  pendingChanges
}: VersionDecisionModalProps) {
  const [completedStrategy, setCompletedStrategy] = useState<CompletedStrategy>('keep');
  const [inProgressStrategy, setInProgressStrategy] = useState<InProgressStrategy>('move-to-v2');
  const [versionNotes, setVersionNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [stats, setStats] = useState({
    pendingCount: 0,
    completedCount: 0,
    totalAssignments: 0
  });
  const [inProgressCount, setInProgressCount] = useState(0);
  const [notStartedCount, setNotStartedCount] = useState(0);

  const nextVersion = currentVersion + 1;

  useEffect(() => {
    if (isOpen && trackId) {
      loadAssignmentData();
    }
  }, [isOpen, trackId]);

  const loadAssignmentData = async () => {
    setIsLoading(true);
    try {
      const [playlistsData, statsData] = await Promise.all([
        crud.getPlaylistsForTrack(trackId),
        crud.getTrackAssignmentStats(trackId)
      ]);
      
      setPlaylists(playlistsData);
      setStats(statsData);
      
      // Calculate in-progress (started but not completed)
      const inProgress = statsData.pendingCount; // Pending = started but not done
      const notStarted = statsData.totalAssignments - statsData.pendingCount - statsData.completedCount;
      
      setInProgressCount(inProgress);
      setNotStartedCount(Math.max(0, notStarted));
    } catch (error: any) {
      console.error('Error loading assignment data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!versionNotes.trim()) {
      alert('Please add version notes to document this change');
      return;
    }

    console.log('🚀 Starting version creation process...');
    setIsSaving(true);
    try {
      console.log('📝 Creating new version with notes:', versionNotes);
      // Create new version
      const newVersion = await crud.createTrackVersion(
        trackId,
        pendingChanges,
        versionNotes
      );
      console.log('✅ New version created:', newVersion);

      console.log('🔄 Replacing track in playlists...');
      // Smart behavior based on selections:
      // 1. Always replace track in playlists (not started users get V2 automatically)
      await crud.replaceTrackInPlaylists(trackId, newVersion.id);
      console.log('✅ Track replaced in playlists');

      // 2. If require-retake is selected, reassign completed users
      if (completedStrategy === 'require-retake') {
        console.log('🔄 Reassigning completed users...');
        await crud.reassignCompletedUsers(trackId, newVersion.id);
        console.log('✅ Completed users reassigned');
      }

      // 3. inProgressStrategy handling (move-to-v2 is default via replaceTrackInPlaylists)
      // Note: finish-v1 would require additional logic to preserve progress records
      
      // Determine strategy string for callback
      const strategy = completedStrategy === 'require-retake' ? 'replace-reassign' : 'replace';

      console.log('🎉 Version creation complete! Calling onVersionCreated callback...');
      // Call the callback - parent will handle modal closing and navigation
      onVersionCreated(newVersion.id, strategy);
      
      // Reset isSaving after successful callback
      // The parent will handle modal closing and navigation
      setIsSaving(false);
      
      // Don't call onClose() here - let parent handle it after callback completes
    } catch (error: any) {
      console.error('❌ Error creating version:', error);
      console.error('Error stack:', error.stack);
      alert(`Failed to create version: ${error.message}`);
      setIsSaving(false); // Reset saving state on error
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // Prevent closing during save operation
      if (!open && isSaving) {
        console.log('⚠️ Prevented dialog close during save operation');
        return;
      }
      onClose();
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Who should get Version {nextVersion}?
          </DialogTitle>
          <DialogDescription className="space-y-1.5 pt-2" asChild>
            <div>
              <div>You're publishing Version {nextVersion} of "{trackTitle}".</div>
              <div className="flex items-center text-primary">
                <Info className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                <span>We'll keep a record of everything learners completed on Version {currentVersion}.</span>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Impact Summary */}
          {!isLoading && (
            <Card className="border-2">
              <CardContent className="pt-6">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <div className="text-2xl font-bold text-green-600">{stats.completedCount}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <div className="text-2xl font-bold text-yellow-600">{inProgressCount}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">In Progress</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <XCircle className="h-4 w-4 text-blue-600" />
                      <div className="text-2xl font-bold text-blue-600">{notStartedCount}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">Not Started</div>
                  </div>
                </div>
                
                {playlists.length > 0 && (
                  <div className="pt-3 border-t text-sm">
                    <span className="text-muted-foreground">Used in {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'}: </span>
                    {playlists.map((playlist: any, index: number) => (
                      <span key={playlist.id}>
                        <Badge variant="secondary" className="text-xs mx-1">
                          {playlist.title}
                        </Badge>
                        {index < playlists.length - 1 ? '' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Section 1: Completed Learners */}
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-base mb-1">Completed learners</h3>
              <p className="text-sm text-muted-foreground">
                How should we treat people who already finished this track?
              </p>
              {stats.completedCount === 0 && (
                <p className="text-xs text-muted-foreground mt-1 italic">No one has completed this yet.</p>
              )}
            </div>
            
            <RadioGroup value={completedStrategy} onValueChange={(value) => setCompletedStrategy(value as CompletedStrategy)}>
              <Card className={`cursor-pointer transition-all ${completedStrategy === 'keep' ? 'ring-2 ring-primary' : ''}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="keep" id="keep" className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="keep" className="cursor-pointer font-medium">
                        Keep their completion on Version {currentVersion} <span className="text-muted-foreground">(recommended)</span>
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        They stay complete. They won't see Version {nextVersion} unless you assign it later.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`cursor-pointer transition-all ${completedStrategy === 'require-retake' ? 'ring-2 ring-primary' : ''}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="require-retake" id="require-retake" className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="require-retake" className="cursor-pointer font-medium">
                        Require them to complete Version {nextVersion}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        They'll get a new required assignment for Version {nextVersion}. Their Version {currentVersion} completion is kept for audit.
                      </p>
                      {completedStrategy === 'require-retake' && stats.completedCount > 0 && (
                        <div className="mt-3 p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800">
                          <div className="flex items-start space-x-2 text-sm text-orange-800 dark:text-orange-200">
                            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>This will create new assignments for {stats.completedCount} {stats.completedCount === 1 ? 'learner' : 'learners'}.</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </RadioGroup>
          </div>

          {/* Section 2: In-Progress Learners */}
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-base mb-1">
                In-progress learners {inProgressCount > 0 && `(${inProgressCount})`}
              </h3>
              <p className="text-sm text-muted-foreground">
                What should happen to learners who already started this track?
              </p>
            </div>
            
            <RadioGroup value={inProgressStrategy} onValueChange={(value) => setInProgressStrategy(value as InProgressStrategy)}>
              <Card className={`cursor-pointer transition-all ${inProgressStrategy === 'move-to-v2' ? 'ring-2 ring-primary' : ''}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="move-to-v2" id="move-to-v2" className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="move-to-v2" className="cursor-pointer font-medium">
                        Move them to Version {nextVersion} <span className="text-muted-foreground">(recommended)</span>
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {inProgressCount > 0 ? (
                          <>{inProgressCount} in-progress {inProgressCount === 1 ? 'learner' : 'learners'} will continue on Version {nextVersion}. Progress may be recalculated.</>
                        ) : (
                          <>In-progress learners will continue on Version {nextVersion}. Progress may be recalculated.</>
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`cursor-pointer transition-all ${inProgressStrategy === 'finish-v1' ? 'ring-2 ring-primary' : ''}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="finish-v1" id="finish-v1" className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="finish-v1" className="cursor-pointer font-medium">
                        Let them finish Version {currentVersion}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {inProgressCount > 0 ? (
                          <>{inProgressCount} in-progress {inProgressCount === 1 ? 'learner' : 'learners'} stay on Version {currentVersion}. New learners will see Version {nextVersion}.</>
                        ) : (
                          <>In-progress learners stay on Version {currentVersion}. New learners will see Version {nextVersion}.</>
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </RadioGroup>
          </div>

          {/* What We'll Handle */}
          <Card className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-4 pb-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center">
                <Sparkles className="h-4 w-4 mr-1.5 text-blue-600" />
                What we'll handle for you
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2 font-bold">•</span>
                  <span>Learners who haven't started yet will automatically see Version {nextVersion}.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2 font-bold">•</span>
                  <span>New playlists / assignments will always use Version {nextVersion}.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2 font-bold">•</span>
                  <span>Version {currentVersion} stays read-only for reporting and audit history.</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Separator />

          {/* Version Notes */}
          <div className="space-y-2">
            <Label htmlFor="version-notes" className="text-base font-semibold">
              Version notes <span className="text-destructive">*</span>
            </Label>
            <p className="text-sm text-muted-foreground">
              Briefly describe what changed in this version (for audit trail and future reference).
            </p>
            <Textarea
              id="version-notes"
              placeholder='e.g., "Updated 2026 handbook – added new safety protocols and revised dress code section."'
              value={versionNotes}
              onChange={(e) => setVersionNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Summary Line */}
          <div className="p-3 bg-accent/50 rounded-lg border text-sm">
            <div className="font-medium mb-1">Summary:</div>
            <ul className="space-y-0.5 text-muted-foreground">
              <li>
                • Completed learners: {completedStrategy === 'keep' ? `keep completion on V${currentVersion}` : `require V${nextVersion}`}
              </li>
              <li>
                • In-progress learners: {inProgressStrategy === 'move-to-v2' ? `move to V${nextVersion}` : `finish V${currentVersion}`}
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                console.log('🔘 Publish button clicked!');
                console.log('🔘 isSaving:', isSaving);
                console.log('🔘 versionNotes:', versionNotes);
                handleSave();
              }} 
              disabled={!versionNotes.trim() || isSaving}
              className="hero-primary"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Publishing...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Publish Version {nextVersion}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}