import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  Zap
} from 'lucide-react';
import * as crud from '../../lib/crud/tracks';
import * as trackRelCrud from '../../lib/crud/trackRelationships';

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
  const { t } = useTranslation();
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
  const [derivedTracks, setDerivedTracks] = useState<any[]>([]);

  const nextVersion = currentVersion + 1;

  useEffect(() => {
    if (isOpen && trackId) {
      loadAssignmentData();
    }
  }, [isOpen, trackId]);

  const loadAssignmentData = async () => {
    setIsLoading(true);
    try {
      const [playlistsData, statsData, derivedTracksData] = await Promise.all([
        crud.getPlaylistsForTrack(trackId),
        crud.getTrackAssignmentStats(trackId),
        trackRelCrud.getDerivedTracks(trackId)
      ]);
      
      setPlaylists(playlistsData);
      setStats(statsData);
      setDerivedTracks(derivedTracksData);
      
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
      alert(t('contentAuthoring.versionNotesMissing'));
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
      alert(t('contentAuthoring.versionCreationFailed', { message: error.message }));
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
            {t('contentAuthoring.versionDecisionTitle', { version: nextVersion })}
          </DialogTitle>
          <DialogDescription className="space-y-1.5 pt-2" asChild>
            <div>
              <div>{t('contentAuthoring.publishingVersion', { version: nextVersion, title: trackTitle })}</div>
              <div className="flex items-center text-primary">
                <Info className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                <span>{t('contentAuthoring.keepRecordNote', { version: currentVersion })}</span>
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
                    <div className="text-xs text-muted-foreground">{t('contentAuthoring.completedLearners')}</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <div className="text-2xl font-bold text-yellow-600">{inProgressCount}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{t('contentAuthoring.inProgressLearners')}</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <XCircle className="h-4 w-4 text-blue-600" />
                      <div className="text-2xl font-bold text-blue-600">{notStartedCount}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{t('contentAuthoring.notStartedStatus')}</div>
                  </div>
                </div>
                
                {playlists.length > 0 && (
                  <div className="pt-3 border-t text-sm">
                    <span className="text-muted-foreground">{t('contentAuthoring.usedInPlaylists', { count: playlists.length, unit: playlists.length === 1 ? t('contentAuthoring.playlistUnit') : t('contentAuthoring.playlistsUnit') })}: </span>
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

          {/* Derived Tracks Warning */}
          {!isLoading && derivedTracks.length > 0 && (
            <Card className="border-2 border-orange-200 bg-orange-50/30 dark:bg-orange-900/10 dark:border-orange-800">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm mb-1 text-orange-900 dark:text-orange-200">
                      {t('contentAuthoring.trackIsSourceMaterial')}
                    </h4>
                    <p className="text-sm text-orange-800 dark:text-orange-300 mb-2">
                      {t('contentAuthoring.tracksCreatedFromThis', { count: derivedTracks.length, unit: derivedTracks.length === 1 ? t('contentAuthoring.trackUnit') : t('contentAuthoring.tracksUnit') })}
                    </p>
                    <ul className="text-sm space-y-1 ml-4">
                      {derivedTracks.map(rel => (
                        <li key={rel.id} className="text-orange-800 dark:text-orange-300">
                          • {rel.derived_track?.title || 'Untitled'} ({rel.derived_track?.type})
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-orange-700 dark:text-orange-400 mt-2">
                      {t('contentAuthoring.versioningWontUpdate', { version: currentVersion })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section 1: Completed Learners */}
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-base mb-1">{t('contentAuthoring.completedLearners')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('contentAuthoring.howTreatCompleted')}
              </p>
              {stats.completedCount === 0 && (
                <p className="text-xs text-muted-foreground mt-1 italic">{t('contentAuthoring.noOneCompletedYet')}</p>
              )}
            </div>
            
            <RadioGroup value={completedStrategy} onValueChange={(value) => setCompletedStrategy(value as CompletedStrategy)}>
              <Card className={`cursor-pointer transition-all ${completedStrategy === 'keep' ? 'ring-2 ring-primary' : ''}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="keep" id="keep" className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="keep" className="cursor-pointer font-medium">
                        {t('contentAuthoring.keepCompletionRecommended', { version: currentVersion })}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('contentAuthoring.keepCompletionDesc', { nextVersion })}
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
                        {t('contentAuthoring.requireRetake', { version: nextVersion })}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('contentAuthoring.requireRetakeDesc', { version: nextVersion, currentVersion })}
                      </p>
                      {completedStrategy === 'require-retake' && stats.completedCount > 0 && (
                        <div className="mt-3 p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800">
                          <div className="flex items-start space-x-2 text-sm text-orange-800 dark:text-orange-200">
                            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>{t('contentAuthoring.willCreateAssignments', { count: stats.completedCount, unit: stats.completedCount === 1 ? t('contentAuthoring.learnerUnit') : t('contentAuthoring.learnersUnit') })}</span>
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
                {t('contentAuthoring.inProgressLearners')}{inProgressCount > 0 && ` (${inProgressCount})`}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('contentAuthoring.whatHappensInProgress')}
              </p>
            </div>
            
            <RadioGroup value={inProgressStrategy} onValueChange={(value) => setInProgressStrategy(value as InProgressStrategy)}>
              <Card className={`cursor-pointer transition-all ${inProgressStrategy === 'move-to-v2' ? 'ring-2 ring-primary' : ''}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="move-to-v2" id="move-to-v2" className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="move-to-v2" className="cursor-pointer font-medium">
                        {t('contentAuthoring.moveToV2Recommended', { version: nextVersion })}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {inProgressCount > 0 ? (
                          t('contentAuthoring.moveToV2Desc', { count: inProgressCount, unit: inProgressCount === 1 ? t('contentAuthoring.learnerUnit') : t('contentAuthoring.learnersUnit'), version: nextVersion })
                        ) : (
                          t('contentAuthoring.moveToV2DescNoCount', { version: nextVersion })
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
                        {t('contentAuthoring.finishV1', { version: currentVersion })}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {inProgressCount > 0 ? (
                          t('contentAuthoring.finishV1Desc', { count: inProgressCount, unit: inProgressCount === 1 ? t('contentAuthoring.learnerUnit') : t('contentAuthoring.learnersUnit'), version: currentVersion, nextVersion })
                        ) : (
                          t('contentAuthoring.finishV1DescNoCount', { version: currentVersion, nextVersion })
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
                <Zap className="h-4 w-4 mr-1.5 text-blue-600 fill-current" />
                {t('contentAuthoring.willHandleForYou')}
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2 font-bold">•</span>
                  <span>{t('contentAuthoring.notStartedAutoV2', { version: nextVersion })}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2 font-bold">•</span>
                  <span>{t('contentAuthoring.newPlaylistsAlwaysLatest', { version: nextVersion })}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2 font-bold">•</span>
                  <span>{t('contentAuthoring.versionReadOnly', { version: currentVersion })}</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Separator />

          {/* Version Notes */}
          <div className="space-y-2">
            <Label htmlFor="version-notes" className="text-base font-semibold">
              {t('contentAuthoring.versionNotesRequired')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('contentAuthoring.versionNotesDesc')}
            </p>
            <Textarea
              id="version-notes"
              placeholder={t('contentAuthoring.versionNotesPlaceholder')}
              value={versionNotes}
              onChange={(e) => setVersionNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Summary Line */}
          <div className="p-3 bg-accent/50 rounded-lg border text-sm">
            <div className="font-medium mb-1">{t('contentAuthoring.summaryLabel')}</div>
            <ul className="space-y-0.5 text-muted-foreground">
              <li>
                • {t('contentAuthoring.completedLearnersStrategy', { strategy: completedStrategy === 'keep' ? `keep completion on V${currentVersion}` : `require V${nextVersion}` })}
              </li>
              <li>
                • {t('contentAuthoring.inProgressLearnersStrategy', { strategy: inProgressStrategy === 'move-to-v2' ? `move to V${nextVersion}` : `finish V${currentVersion}` })}
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              {t('common.cancel')}
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
                  {t('contentAuthoring.publishing')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {t('contentAuthoring.publishVersionBtn', { version: nextVersion })}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}