// ============================================================================
// PLAYLIST LOCKING PANEL - COMPLIANCE PLAYLIST MANAGEMENT
// ============================================================================
// Manages system-locked playlists for compliance requirements.
// Shows locked playlists, version history, and allows locking/unlocking.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Lock,
  Unlock,
  History,
  MoreHorizontal,
  Search,
  RefreshCw,
  Loader2,
  FileCheck,
  Clock,
  ListMusic,
  Play,
  AlertTriangle,
  Shield,
  Eye,
  ChevronRight,
  Calendar,
  User,
  FileText,
  ExternalLink
} from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import {
  getSystemLockedPlaylists,
  getPlaylistVersions,
  lockPlaylist,
  unlockPlaylist,
  getAlbums,
  type Album,
  type AlbumVersion,
  type SystemLockedAlbum
} from '../../lib/crud/albums';
import {
  getComplianceRequirements,
  type ComplianceRequirement
} from '../../lib/crud/compliance';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatDuration(minutes: number | undefined): string {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// ============================================================================
// VERSION HISTORY DIALOG
// ============================================================================

interface VersionHistoryDialogProps {
  playlist: SystemLockedAlbum | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function VersionHistoryDialog({ playlist, open, onOpenChange }: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<AlbumVersion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadVersions() {
      if (!playlist || !open) return;
      setLoading(true);
      try {
        const data = await getPlaylistVersions(playlist.id);
        setVersions(data);
      } catch (error) {
        console.error('Failed to load versions:', error);
      } finally {
        setLoading(false);
      }
    }
    loadVersions();
  }, [playlist, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </DialogTitle>
          <DialogDescription>
            Version history for "{playlist?.title}"
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No version history available</p>
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-4 pr-4">
              {versions.map((version, index) => (
                <Card key={version.id} className={index === 0 ? 'border-primary' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          index === 0
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}>
                          <span className="text-sm font-bold">v{version.version}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Version {version.version}</span>
                            {index === 0 && (
                              <Badge className="bg-primary/10 text-primary border-0">
                                Current
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDateTime(version.locked_at)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {version.change_notes && (
                      <div className="mt-3 pl-13">
                        <p className="text-sm bg-muted/50 p-2 rounded">
                          {version.change_notes}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 pl-13 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ListMusic className="h-3 w-3" />
                        {version.track_snapshot ? JSON.parse(version.track_snapshot).length : 0} tracks
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(version.total_duration_minutes)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// LOCK PLAYLIST DIALOG
// ============================================================================

interface LockPlaylistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLock: (albumId: string, requirementId: string, notes: string) => Promise<void>;
}

function LockPlaylistDialog({ open, onOpenChange, onLock }: LockPlaylistDialogProps) {
  const [playlists, setPlaylists] = useState<Album[]>([]);
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState('');
  const [selectedRequirement, setSelectedRequirement] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!open) return;
      setLoading(true);
      try {
        const [playlistsData, requirementsData] = await Promise.all([
          getAlbums({ status: 'published' }),
          getComplianceRequirements()
        ]);
        // Filter out already locked playlists
        const unlockedPlaylists = playlistsData.filter((p: Album) => !p.requirement_id);
        setPlaylists(unlockedPlaylists);
        setRequirements(requirementsData);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [open]);

  const handleLock = async () => {
    if (!selectedPlaylist || !selectedRequirement) return;
    setSubmitting(true);
    try {
      await onLock(selectedPlaylist, selectedRequirement, notes);
      onOpenChange(false);
      setSelectedPlaylist('');
      setSelectedRequirement('');
      setNotes('');
    } catch (error) {
      console.error('Failed to lock playlist:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPlaylistData = playlists.find(p => p.id === selectedPlaylist);
  const selectedRequirementData = requirements.find(r => r.id === selectedRequirement);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Lock Playlist for Compliance
          </DialogTitle>
          <DialogDescription>
            Link a playlist to a compliance requirement. Once locked, the playlist
            will be version-controlled and changes will be tracked.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Playlist</Label>
              <Select value={selectedPlaylist} onValueChange={setSelectedPlaylist}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a playlist..." />
                </SelectTrigger>
                <SelectContent>
                  {playlists.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No unlocked playlists available
                    </div>
                  ) : (
                    playlists.map((playlist) => (
                      <SelectItem key={playlist.id} value={playlist.id}>
                        <div className="flex items-center gap-2">
                          <ListMusic className="h-4 w-4" />
                          <span>{playlist.title}</span>
                          <Badge variant="secondary" className="text-xs">
                            {playlist.track_count || 0} tracks
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Link to Requirement</Label>
              <Select value={selectedRequirement} onValueChange={setSelectedRequirement}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a compliance requirement..." />
                </SelectTrigger>
                <SelectContent>
                  {requirements.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No requirements available
                    </div>
                  ) : (
                    requirements.map((req) => (
                      <SelectItem key={req.id} value={req.id}>
                        <div className="flex items-center gap-2">
                          <FileCheck className="h-4 w-4" />
                          <span>{req.requirement_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {req.state_code}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Version Notes (optional)</Label>
              <Textarea
                placeholder="e.g., Initial compliance playlist for Food Handler certification"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {selectedPlaylistData && selectedRequirementData && (
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-sm font-medium mb-2">Summary</p>
                  <p className="text-sm text-muted-foreground">
                    <strong>{selectedPlaylistData.title}</strong> will be locked to{' '}
                    <strong>{selectedRequirementData.requirement_name}</strong> ({selectedRequirementData.state_code}).
                    All future changes will create new versions.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleLock}
            disabled={!selectedPlaylist || !selectedRequirement || submitting}
            className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Locking...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Lock Playlist
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// UNLOCK CONFIRMATION DIALOG
// ============================================================================

interface UnlockDialogProps {
  playlist: SystemLockedAlbum | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlock: (albumId: string) => Promise<void>;
}

function UnlockDialog({ playlist, open, onOpenChange, onUnlock }: UnlockDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleUnlock = async () => {
    if (!playlist) return;
    setSubmitting(true);
    try {
      await onUnlock(playlist.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to unlock:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Unlock Playlist?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will remove the compliance lock from "{playlist?.title}".
            The playlist will no longer be linked to{' '}
            <strong>{playlist?.requirement?.requirement_name}</strong> and
            version tracking will stop. Existing assignments will not be affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleUnlock}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={submitting}
          >
            {submitting ? 'Unlocking...' : 'Unlock Playlist'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PlaylistLockingPanel() {
  // Data state
  const [lockedPlaylists, setLockedPlaylists] = useState<SystemLockedAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog state
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [unlockDialogPlaylist, setUnlockDialogPlaylist] = useState<SystemLockedAlbum | null>(null);
  const [versionHistoryPlaylist, setVersionHistoryPlaylist] = useState<SystemLockedAlbum | null>(null);

  // Load data
  const loadData = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getSystemLockedPlaylists();
      setLockedPlaylists(data);
    } catch (error) {
      console.error('Failed to load locked playlists:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter playlists
  const filteredPlaylists = lockedPlaylists.filter((p) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(query) ||
      p.requirement?.requirement_name?.toLowerCase().includes(query) ||
      p.requirement?.state_code?.toLowerCase().includes(query)
    );
  });

  // Handlers
  const handleLock = async (albumId: string, requirementId: string, notes: string) => {
    await lockPlaylist(albumId, requirementId, notes);
    await loadData(true);
  };

  const handleUnlock = async (albumId: string) => {
    await unlockPlaylist(albumId);
    await loadData(true);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance Playlists
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage system-locked playlists for compliance requirements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => setLockDialogOpen(true)}
            className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
          >
            <Lock className="h-4 w-4 mr-2" />
            Lock Playlist
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by playlist name or requirement..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{lockedPlaylists.length}</p>
              <p className="text-sm text-muted-foreground">Locked Playlists</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <ListMusic className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {lockedPlaylists.reduce((sum, p) => sum + (p.track_count || 0), 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Tracks</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {formatDuration(lockedPlaylists.reduce((sum, p) => sum + (p.total_duration_minutes || 0), 0))}
              </p>
              <p className="text-sm text-muted-foreground">Total Duration</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Locked Playlists Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Playlist</TableHead>
                <TableHead>Linked Requirement</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Locked</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlaylists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    {searchQuery
                      ? 'No playlists match your search'
                      : 'No locked playlists yet. Lock a playlist to link it to a compliance requirement.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredPlaylists.map((playlist) => (
                  <TableRow key={playlist.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                          <ListMusic className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            {playlist.title}
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {playlist.track_count || 0} tracks • {formatDuration(playlist.total_duration_minutes)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {playlist.requirement ? (
                        <div>
                          <p className="font-medium">{playlist.requirement.requirement_name}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {playlist.requirement.state_code}
                            </Badge>
                            {playlist.requirement.topic?.name && (
                              <span>• {playlist.requirement.topic.name}</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        v{playlist.version || 1}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(playlist.locked_at)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setVersionHistoryPlaylist(playlist)}>
                            <History className="h-4 w-4 mr-2" />
                            Version History
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            View Playlist
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setUnlockDialogPlaylist(playlist)}
                            className="text-destructive"
                          >
                            <Unlock className="h-4 w-4 mr-2" />
                            Unlock Playlist
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Empty state with call to action */}
      {lockedPlaylists.length === 0 && !searchQuery && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Compliance Playlists Yet</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Lock playlists to compliance requirements to enable version control
              and automatic assignment tracking.
            </p>
            <Button onClick={() => setLockDialogOpen(true)}>
              <Lock className="h-4 w-4 mr-2" />
              Lock Your First Playlist
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <LockPlaylistDialog
        open={lockDialogOpen}
        onOpenChange={setLockDialogOpen}
        onLock={handleLock}
      />
      <UnlockDialog
        playlist={unlockDialogPlaylist}
        open={!!unlockDialogPlaylist}
        onOpenChange={(open) => !open && setUnlockDialogPlaylist(null)}
        onUnlock={handleUnlock}
      />
      <VersionHistoryDialog
        playlist={versionHistoryPlaylist}
        open={!!versionHistoryPlaylist}
        onOpenChange={(open) => !open && setVersionHistoryPlaylist(null)}
      />
    </div>
  );
}

export default PlaylistLockingPanel;
