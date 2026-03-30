import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Footer } from './Footer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import {
  Play,
  Search,
  Plus,
  MoreVertical,
  Edit,
  Copy,
  Users,
  TrendingUp,
  Archive,
  Trash2,
  Music,
  Album as AlbumIcon,
  ListMusic,
  Clock,
  CheckCircle2,
  Lock,
  Zap,
  Calendar,
  BarChart3,
  Filter,
  ChevronDown,
  ArrowLeft,
  AlertTriangle,
  ListChecks,
  Library,
  Award,
  GitBranch,
  Settings as SettingsIcon,
  Target,
  LayoutGrid,
  List,
  Download,
  History,
  FileText
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from './ui/tabs';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { useCurrentUser, useEffectiveOrgId } from '../lib/hooks/useSupabase';
import { supabase } from '../lib/supabase';
import * as crud from '../lib/crud';
import * as albumsCrud from '../lib/crud/albums';
import {
  getPlaylistAssignmentHistory,
  getPlaylistAssignmentHistoryForExport,
  type AssignmentHistoryEntry
} from '../lib/crud/assignments';
import type { Album } from '../lib/crud/albums';
import { AlbumDetailView } from './AlbumDetailView';
import { ArchivePlaylistModal } from './ArchivePlaylistModal';
import { toast } from 'sonner@2.0.3';

interface PlaylistsProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
  onOpenPlaylistWizard?: () => void;
  onEditPlaylist?: (playlistId: string) => void;
  selectedPlaylistId?: string;
  selectedAlbumId?: string;        // NEW: For deep-linking to album
  initialTab?: 'playlists' | 'albums';  // NEW: Which tab to show initially
  previousView?: string | null;
  onBackToPreviousView?: () => void;
}

export function Playlists({ currentRole = 'admin', onOpenPlaylistWizard, onEditPlaylist, selectedPlaylistId, selectedAlbumId, initialTab, previousView, onBackToPreviousView }: PlaylistsProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewFilter, setViewFilter] = useState<string>('all');
  const [selectedPlaylist, setSelectedPlaylist] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalDuration, setTotalDuration] = useState<number>(0); // in minutes

  // Albums state
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [albumSearchQuery, setAlbumSearchQuery] = useState('');
  const [albumStatusFilter, setAlbumStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');

  // Main view tab (playlists vs albums)
  const [mainTab, setMainTab] = useState<'playlists' | 'albums'>(initialTab || 'playlists');

  // Archive modal state
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [playlistToArchive, setPlaylistToArchive] = useState<{ id: string; title: string } | null>(null);

  // Expanded albums state for view mode
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());
  const [loadingPlaylistDetails, setLoadingPlaylistDetails] = useState(false);

  // Assignment history state for auto playlists
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistoryEntry[]>([]);
  const [assignmentHistoryLoading, setAssignmentHistoryLoading] = useState(false);

  const { user } = useCurrentUser();
  const { orgId: effectiveOrgId } = useEffectiveOrgId();

  useEffect(() => {
    fetchPlaylists();
  }, [effectiveOrgId, viewFilter]);

  // Function to fetch and set full playlist details
  const fetchAndSelectPlaylist = async (playlistId: string) => {
    setLoadingPlaylistDetails(true);
    try {
      const fullPlaylist = await crud.getPlaylistById(playlistId);
      console.log('🎵 Fetched full playlist details:', fullPlaylist);
      setSelectedPlaylist(fullPlaylist);
      setExpandedAlbums(new Set()); // Reset expanded albums
    } catch (error) {
      console.error('Error fetching playlist details:', error);
      toast.error(t('playlists.failedLoadPlaylistDetails'));
    } finally {
      setLoadingPlaylistDetails(false);
    }
  };

  // Auto-select playlist if selectedPlaylistId is provided
  useEffect(() => {
    if (selectedPlaylistId && playlists.length > 0 && !selectedPlaylist) {
      fetchAndSelectPlaylist(selectedPlaylistId);
    }
  }, [selectedPlaylistId, playlists.length, selectedPlaylist]);

  // Auto-select album if selectedAlbumId is provided
  useEffect(() => {
    if (selectedAlbumId && !selectedAlbum) {
      setMainTab('albums');
      albumsCrud.getAlbumById(selectedAlbumId).then(album => {
        if (album) {
          console.log('🎵 Auto-selecting album:', album.title);
          setSelectedAlbum(album);
        }
      });
    }
  }, [selectedAlbumId, selectedAlbum]);

  // Fetch albums when albums tab is active
  const fetchAlbums = async () => {
    try {
      setAlbumsLoading(true);
      const filters: { status?: 'draft' | 'published' | 'archived'; search?: string } = {};
      
      if (albumStatusFilter !== 'all') {
        filters.status = albumStatusFilter;
      }
      
      if (albumSearchQuery) {
        filters.search = albumSearchQuery;
      }
      
      const data = await albumsCrud.getAlbums(filters);
      setAlbums(data);
    } catch (err) {
      console.error('Error fetching albums:', err);
      toast.error(t('playlists.failedLoadAlbums'));
    } finally {
      setAlbumsLoading(false);
    }
  };

  useEffect(() => {
    if (mainTab === 'albums') {
      fetchAlbums();
    }
  }, [mainTab, albumStatusFilter]);

  // Fetch assignment history when an auto playlist is selected
  useEffect(() => {
    const fetchAssignmentHistory = async () => {
      if (!selectedPlaylist?.id || selectedPlaylist.type !== 'auto') {
        setAssignmentHistory([]);
        return;
      }

      setAssignmentHistoryLoading(true);
      try {
        const history = await getPlaylistAssignmentHistory(selectedPlaylist.id, 20);
        setAssignmentHistory(history);
      } catch (error) {
        console.error('Error fetching assignment history:', error);
      } finally {
        setAssignmentHistoryLoading(false);
      }
    };

    fetchAssignmentHistory();
  }, [selectedPlaylist?.id, selectedPlaylist?.type]);

  // Export assignment history to CSV
  const handleExportAssignmentHistoryCSV = async () => {
    if (!selectedPlaylist?.id) return;

    try {
      const history = await getPlaylistAssignmentHistoryForExport(selectedPlaylist.id);

      // Build CSV content
      const headers = ['Name', 'Email', 'Role', 'Location', 'Hire Date', 'Assigned Date', 'Progress %', 'Status', 'Completed Date'];
      const rows = history.map(h => [
        `${h.first_name} ${h.last_name}`,
        h.email,
        h.role_name || '',
        h.store_name || '',
        h.hire_date || '',
        h.assigned_at ? new Date(h.assigned_at).toLocaleDateString() : '',
        h.progress_percent?.toString() || '0',
        h.status,
        h.completed_at ? new Date(h.completed_at).toLocaleDateString() : ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${selectedPlaylist.title}-assignments-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      toast.success(t('playlists.exportedAssignments', { count: history.length }));
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error(t('playlists.failedExportCsv'));
    }
  };

  // Set total duration when a playlist is selected (now comes from CRUD layer)
  useEffect(() => {
    if (selectedPlaylist) {
      // Use pre-calculated duration from CRUD layer, or totalDuration from list
      const duration = selectedPlaylist.total_duration_minutes || selectedPlaylist.totalDuration || 0;
      setTotalDuration(duration);
      console.log(`⏱️ Playlist "${selectedPlaylist.title}" duration: ${duration} minutes`);
    } else {
      setTotalDuration(0);
    }
  }, [selectedPlaylist?.id, selectedPlaylist?.total_duration_minutes, selectedPlaylist?.totalDuration]);

  const fetchPlaylists = async () => {
    if (!effectiveOrgId) return;

    try {
      setLoading(true);
      
      // Use new CRUD operations
      const filters: any = {};
      
      if (viewFilter === 'archived') {
        filters.is_active = false;
      } else if (viewFilter === 'auto' || viewFilter === 'manual') {
        filters.type = viewFilter;
        filters.is_active = true;
      } else {
        filters.is_active = true; // 'all' shows only active
      }

      const data = await crud.getPlaylists(filters);

      // Transform data for display - duration is now calculated in CRUD layer
      const transformedPlaylists = data.map((playlist: any) => ({
        ...playlist,
        albumCount: playlist.album_count || 0,
        totalTracks: playlist.track_count || 0,
        trackCount: playlist.track_count || 0,
        assignedTo: playlist.assignment_count || 0,
        completionRate: playlist.completion_rate || 0,
        avgProgress: playlist.avg_progress || 0,
        releaseType: playlist.release_type || 'immediate',
        stages: playlist.release_schedule ? Object.keys(playlist.release_schedule).length : 0,
        createdDate: playlist.created_at,
        trigger: playlist.trigger_rules ? 'Auto-assignment enabled' : undefined,
        status: playlist.is_active ? 'active' : 'archived',
        totalDuration: playlist.total_duration_minutes || 0,
      }));

      setPlaylists(transformedPlaylists);
    } catch (err) {
      console.error('Error fetching playlists:', err);
      setError(err as Error);
      toast.error(t('playlists.failedLoadPlaylists'));
    } finally {
      setLoading(false);
    }
  };

  // Action handlers
  const handleDuplicatePlaylist = async (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await crud.duplicatePlaylist(playlistId);
      toast.success(t('playlists.playlistDuplicatedSuccess'));
      fetchPlaylists();
    } catch (err) {
      console.error('Error duplicating playlist:', err);
      toast.error(t('playlists.failedDuplicatePlaylist'));
    }
  };

  // Open archive modal instead of immediately archiving
  const handleOpenArchiveModal = (playlistId: string, playlistTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlaylistToArchive({ id: playlistId, title: playlistTitle });
    setArchiveModalOpen(true);
  };

  // Actually perform the archive (called from modal)
  const handleArchivePlaylist = async (playlistId: string, archiveAssignments: boolean) => {
    try {
      await crud.archivePlaylist(playlistId, archiveAssignments);
      toast.success(t('playlists.playlistArchivedSuccess'));
      fetchPlaylists();
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylist(null);
      }
    } catch (err) {
      console.error('Error archiving playlist:', err);
      toast.error(t('playlists.failedArchivePlaylist'));
      throw err; // Re-throw so modal knows it failed
    }
  };

  const handleDeletePlaylist = async (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('playlists.confirmDeletePlaylist'))) {
      return;
    }
    try {
      await crud.deletePlaylist(playlistId);
      toast.success(t('playlists.playlistDeletedSuccess'));
      fetchPlaylists();
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylist(null);
      }
    } catch (err) {
      console.error('Error deleting playlist:', err);
      toast.error(t('playlists.failedDeletePlaylist'));
    }
  };

  // Album action handlers
  const handleCreateAlbum = async () => {
    try {
      const orgId = effectiveOrgId;
      if (!orgId) {
        toast.error(t('playlists.orgNotFound'));
        return;
      }

      const newAlbum = await albumsCrud.createAlbum({
        title: 'New Album',
        organization_id: orgId,
        status: 'draft',
      });
      
      toast.success(t('playlists.albumCreated'));
      // Fetch full album with tracks relationship
      const fullAlbum = await albumsCrud.getAlbumById(newAlbum.id);
      if (fullAlbum) {
        setSelectedAlbum(fullAlbum);
      }
      await fetchAlbums();
    } catch (err) {
      console.error('Error creating album:', err);
      toast.error(t('playlists.failedCreateAlbum'));
    }
  };

  const handleDuplicateAlbum = async (albumId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await albumsCrud.duplicateAlbum(albumId);
      toast.success(t('playlists.albumDuplicated'));
      await fetchAlbums();
    } catch (err) {
      console.error('Error duplicating album:', err);
      toast.error(t('playlists.failedDuplicateAlbum'));
    }
  };

  const handleArchiveAlbum = async (albumId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await albumsCrud.archiveAlbum(albumId);
      toast.success(t('playlists.albumArchived'));
      await fetchAlbums();
      if (selectedAlbum?.id === albumId) {
        setSelectedAlbum(null);
      }
    } catch (err) {
      console.error('Error archiving album:', err);
      toast.error(t('playlists.failedArchiveAlbum'));
    }
  };

  const handleDeleteAlbum = async (albumId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('playlists.confirmDeleteAlbum'))) {
      return;
    }
    try {
      await albumsCrud.deleteAlbum(albumId);
      toast.success(t('playlists.albumDeleted'));
      await fetchAlbums();
      if (selectedAlbum?.id === albumId) {
        setSelectedAlbum(null);
      }
    } catch (err) {
      console.error('Error deleting album:', err);
      toast.error(t('playlists.failedDeleteAlbum'));
    }
  };

  const handlePublishAlbum = async (albumId: string) => {
    try {
      await albumsCrud.publishAlbum(albumId);
      toast.success(t('playlists.albumPublished'));
      await fetchAlbums();
      // Refresh selected album if it's the one being published
      if (selectedAlbum?.id === albumId) {
        const updated = await albumsCrud.getAlbumById(albumId);
        setSelectedAlbum(updated);
      }
    } catch (err) {
      console.error('Error publishing album:', err);
      toast.error(t('playlists.failedPublishAlbum'));
    }
  };

  const filteredAlbums = albums.filter(album => {
    const matchesSearch = album.title.toLowerCase().includes(albumSearchQuery.toLowerCase()) ||
                         album.description?.toLowerCase().includes(albumSearchQuery.toLowerCase());
    return matchesSearch;
  });

  const filteredPlaylists = playlists.filter(playlist => {
    const matchesSearch = playlist.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         playlist.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = 
      viewFilter === 'all' ? playlist.status === 'active' :
      viewFilter === 'auto' ? playlist.type === 'auto' && playlist.status === 'active' :
      viewFilter === 'manual' ? playlist.type === 'manual' && playlist.status === 'active' :
      viewFilter === 'archived' ? playlist.status === 'archived' :
      true;
    
    return matchesSearch && matchesFilter;
  });

  // Album detail view
  if (selectedAlbum) {
    return (
      <AlbumDetailView
        album={selectedAlbum}
        onBack={() => {
          setSelectedAlbum(null);
          if (onBackToPreviousView) {
            onBackToPreviousView();
          }
        }}
        onUpdate={async () => {
          const updated = await albumsCrud.getAlbumById(selectedAlbum.id);
          setSelectedAlbum(updated);
          await fetchAlbums();
        }}
        onPublish={() => handlePublishAlbum(selectedAlbum.id)}
        previousView={previousView}
      />
    );
  }

  // If a playlist is selected, show detail view
  if (selectedPlaylist) {
    return (
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => {
                console.log('🔙 Back button clicked, clearing playlist selection');
                setSelectedPlaylist(null);
                // Call parent handler to clear selectedPlaylistId and previousView
                if (onBackToPreviousView) {
                  onBackToPreviousView();
                }
              }}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {previousView ? `${previousView === 'content' ? t('playlists.backToContentLibrary') : t('playlists.backToPreviousView')}` : t('playlists.backToPlaylists')}
            </Button>
            <div>
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center">
                  <ListChecks className="h-6 w-6 text-foreground dark:text-white" />
                </div>
                <h1 className="text-foreground">{selectedPlaylist.title}</h1>
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-1">
                <Badge variant={selectedPlaylist.type === 'auto' ? 'default' : 'secondary'} className={selectedPlaylist.type === 'auto' ? 'bg-brand-gradient' : ''}>
                  {selectedPlaylist.type === 'auto' ? (
                    <>
                      <Zap className="h-3 w-3 mr-1" />
                      {t('playlists.autoAssigned')}
                    </>
                  ) : (
                    t('playlists.manualAssignment')
                  )}
                </Badge>
                <span>•</span>
                <Badge variant="outline">
                  {selectedPlaylist.releaseType === 'progressive' ? (
                    <>
                      <Lock className="h-3 w-3 mr-1" />
                      {t('playlists.progressiveRelease')}
                    </>
                  ) : (
                    t('playlists.immediateAccess')
                  )}
                </Badge>
                <span>•</span>
                <span>{t('playlists.playlistCreated')} {selectedPlaylist.created_at ? new Date(selectedPlaylist.created_at).toLocaleDateString() : ''}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => onEditPlaylist?.(selectedPlaylist.id)}>
              <Edit className="h-4 w-4 mr-2" />
              {t('playlists.editPlaylist')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => handleDuplicatePlaylist(selectedPlaylist.id, e)}>
                  <Copy className="h-4 w-4 mr-2" />
                  {t('playlists.duplicate')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => handleOpenArchiveModal(selectedPlaylist.id, selectedPlaylist.title, e)}>
                  <Archive className="h-4 w-4 mr-2" />
                  {t('playlists.archive')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={(e) => handleDeletePlaylist(selectedPlaylist.id, e)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('playlists.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('playlists.assignedLearners')}</p>
                  <p className="text-2xl font-bold">{selectedPlaylist.assignedTo}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('playlists.completionRate')}</p>
                  <p className="text-2xl font-bold">{selectedPlaylist.completionRate}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('playlists.totalContent')}</p>
                  <p className="text-2xl font-bold">{selectedPlaylist.total_track_count || selectedPlaylist.totalTracks || selectedPlaylist.track_ids?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedPlaylist.albumCount > 0 ? `${selectedPlaylist.albumCount} ${t('playlists.albums')} • ` : ''}{t('playlists.tracks')}
                  </p>
                </div>
                <Library className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('playlists.estCompletion')}</p>
                  <p className="text-2xl font-bold">
                    {totalDuration >= 60 
                      ? (totalDuration / 60).toFixed(1)
                      : totalDuration
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {totalDuration >= 60 ? t('playlists.hours') : t('playlists.minutes')}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">{t('playlists.tabOverview')}</TabsTrigger>
            <TabsTrigger value="triggers">{t('playlists.tabAssignmentLogic')}</TabsTrigger>
            <TabsTrigger value="stages">{t('playlists.tabStageDelivery')}</TabsTrigger>
            <TabsTrigger value="completion">{t('playlists.tabCompletionActions')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Content Structure */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('playlists.contentStructure')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedPlaylist.description && (
                    <p className="text-sm text-muted-foreground mb-4">{selectedPlaylist.description}</p>
                  )}

                  {/* Loading state */}
                  {loadingPlaylistDetails && (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                    </div>
                  )}

                  {/* Show albums with expandable track list */}
                  {!loadingPlaylistDetails && selectedPlaylist.playlist_albums?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        {t('playlists.albumsCount', { count: selectedPlaylist.playlist_albums.length })}
                      </p>
                      {selectedPlaylist.playlist_albums?.map((pa: any) => {
                        const albumId = pa.album?.id || pa.id;
                        const isExpanded = expandedAlbums.has(albumId);
                        const trackCount = pa.album?.track_count || pa.album?.tracks?.length || 0;

                        return (
                          <div key={pa.id} className="border rounded-lg overflow-hidden">
                            {/* Album header - clickable to expand */}
                            <button
                              onClick={() => {
                                const newExpanded = new Set(expandedAlbums);
                                if (isExpanded) {
                                  newExpanded.delete(albumId);
                                } else {
                                  newExpanded.add(albumId);
                                }
                                setExpandedAlbums(newExpanded);
                              }}
                              className="w-full flex items-center space-x-3 p-3 bg-muted hover:bg-muted/80 transition-colors text-left"
                            >
                              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                              <AlbumIcon className="h-5 w-5 text-primary" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{pa.album?.title || t('playlists.unnamedAlbum')}</p>
                                <p className="text-xs text-muted-foreground">
                                  {trackCount} {t('playlists.tracks')}
                                  {pa.album?.duration_minutes ? ` • ${pa.album.duration_minutes} ${t('playlists.min')}` : ''}
                                </p>
                              </div>
                            </button>

                            {/* Expanded track list */}
                            {isExpanded && pa.album?.tracks?.length > 0 && (
                              <div className="border-t bg-background">
                                {pa.album.tracks.map((track: any, idx: number) => (
                                  <div
                                    key={track.id || idx}
                                    className="flex items-center space-x-3 px-4 py-2 border-b last:border-b-0 hover:bg-muted/30"
                                  >
                                    <span className="w-6 text-xs text-muted-foreground text-center">{idx + 1}</span>
                                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                      <Library className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm truncate">{track.title}</p>
                                      <p className="text-xs text-muted-foreground">{track.type}</p>
                                    </div>
                                    <span className="text-xs text-muted-foreground flex-shrink-0">
                                      {track.duration_minutes || 0} {t('playlists.min')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Empty album state */}
                            {isExpanded && (!pa.album?.tracks || pa.album.tracks.length === 0) && (
                              <div className="border-t bg-background p-4 text-center text-sm text-muted-foreground">
                                {t('playlists.noTracksInAlbum')}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Show standalone tracks if any */}
                  {!loadingPlaylistDetails && selectedPlaylist.tracks?.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <p className="text-sm font-medium text-muted-foreground">
                        {t('playlists.standaloneTracksCount', { count: selectedPlaylist.tracks.length })}
                      </p>
                      {selectedPlaylist.tracks.map((pt: any) => (
                        <div key={pt.id} className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg border">
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                            <Library className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{pt.track?.title || t('playlists.unnamed')}</p>
                            <p className="text-xs text-muted-foreground">{pt.track?.type}</p>
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {pt.track?.duration_minutes || 0} {t('playlists.min')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Empty state */}
                  {(!selectedPlaylist.playlist_albums?.length && !selectedPlaylist.tracks?.length) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Library className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{t('playlists.noContentInPlaylist')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Assignment Rules */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('playlists.assignmentRules')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedPlaylist.type === 'auto' && selectedPlaylist.trigger_rules && (
                    <>
                      <div>
                        <p className="text-sm font-medium mb-2">{t('playlists.autoAssignmentTrigger')}</p>
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-900/30">
                          <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-1">{t('playlists.autoAssignsWhen')}</p>
                          <ul className="text-sm text-orange-800 dark:text-orange-200 space-y-1 ml-4">
                            <li>→ {selectedPlaylist.trigger || t('playlists.noTriggerConditions')}</li>
                          </ul>
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}
                  
                  <div>
                    <p className="text-sm font-medium mb-2">{t('playlists.trainingStart')}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('playlists.trainingStartDesc')}
                    </p>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <p className="text-sm font-medium mb-2">{t('playlists.completionReqs')}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('playlists.completionReqsDesc')}
                    </p>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <p className="text-sm font-medium mb-2">{t('playlists.notificationsEnabled')}</p>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>{t('playlists.notifAtAssignment')}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>{t('playlists.notifWhenTrainingStarts')}</span>
                      </div>
                      {selectedPlaylist.releaseType === 'progressive' && (
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span>{t('playlists.notifStageUnlocks')}</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>{t('playlists.notifDaysBeforeDue')}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>{t('playlists.recentActivity')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium">{t('playlists.playlistCreated')}</p>
                      <p className="text-xs text-muted-foreground">{new Date(selectedPlaylist.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="triggers" className="space-y-6 mt-6">
            {/* Trigger Rules Card */}
            <Card>
              <CardHeader>
                <CardTitle>{t('playlists.assignmentLogic')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedPlaylist.type === 'auto' && (
                  <>
                    <div>
                      <p className="text-sm font-medium mb-2">{t('playlists.autoAssignmentTrigger')}</p>
                      <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-900/30">
                        <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-2">{t('playlists.autoAssignsWhen')}</p>
                        {selectedPlaylist.trigger_rules?.role_ids?.length > 0 ? (
                          <div className="space-y-3">
                            <p className="text-sm text-orange-800 dark:text-orange-200">
                              <span className="font-medium">{t('playlists.roleEquals')}</span>
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {selectedPlaylist.trigger_rules.role_ids.map((role: string, idx: number) => (
                                <Badge key={idx} variant="secondary" className="px-3 py-1">
                                  {role}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-orange-800 dark:text-orange-200">
                            {t('playlists.noTriggerConditions')}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {selectedPlaylist.type === 'manual' && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-900/30">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">{t('playlists.manualAssignment')}</p>
                    <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">{t('playlists.manualAssignmentDesc')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assignment Activity Feed */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{t('playlists.assignmentActivity')}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {t('playlists.totalBadge', { count: selectedPlaylist.active_learners || assignmentHistory.length })}
                    </Badge>
                    {assignmentHistory.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportAssignmentHistoryCSV}
                        className="h-8"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        {t('playlists.exportCsv')}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {assignmentHistoryLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : assignmentHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium">{t('playlists.noAssignmentsYet')}</p>
                    <p className="text-xs mt-1">
                      {selectedPlaylist.type === 'auto'
                        ? t('playlists.noAssignmentsAutoDesc')
                        : t('playlists.noAssignmentsManualDesc')}
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">{t('playlists.tableEmployee')}</th>
                          <th className="text-left px-3 py-2 font-medium">{t('playlists.tableRole')}</th>
                          <th className="text-left px-3 py-2 font-medium">{t('playlists.tableLocation')}</th>
                          <th className="text-left px-3 py-2 font-medium">{t('playlists.tableAssigned')}</th>
                          <th className="text-left px-3 py-2 font-medium">{t('playlists.tableProgress')}</th>
                          <th className="text-left px-3 py-2 font-medium">{t('playlists.tableStatus')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {assignmentHistory.map((entry) => (
                          <tr key={entry.assignment_id} className="hover:bg-muted/50">
                            <td className="px-3 py-2">
                              <div>
                                <p className="font-medium">{entry.first_name} {entry.last_name}</p>
                                <p className="text-xs text-muted-foreground">{entry.email}</p>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {entry.role_name || '—'}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {entry.store_name || '—'}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {entry.assigned_at ? new Date(entry.assigned_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Progress value={entry.progress_percent || 0} className="h-2 w-16" />
                                <span className="text-xs text-muted-foreground">{entry.progress_percent || 0}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant={
                                  entry.status === 'completed' ? 'default' :
                                  entry.status === 'in_progress' ? 'secondary' :
                                  'outline'
                                }
                                className={
                                  entry.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                  entry.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                  ''
                                }
                              >
                                {entry.status === 'in_progress' ? t('playlists.statusInProgress') :
                                 entry.status === 'completed' ? t('playlists.statusCompleted') :
                                 entry.status === 'assigned' ? t('playlists.statusNotStarted') :
                                 entry.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {assignmentHistory.length >= 20 && (
                      <div className="px-3 py-2 bg-muted/50 text-center text-sm text-muted-foreground border-t">
                        {t('playlists.showingRecent')}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stages" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('playlists.stageDelivery')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedPlaylist.release_schedule?.stages?.length > 0 ? (
                  <div className="space-y-4">
                    {/* Progressive stages visualization using new stages array */}
                    {selectedPlaylist.release_schedule.stages.map((stage: any, index: number) => {
                      const stageNum = index + 1;
                      const isFirst = index === 0;

                      // Get albums and tracks for this stage based on release_stage field
                      const stageAlbums = selectedPlaylist.playlist_albums?.filter((pa: any) =>
                        pa.release_stage === stageNum || (isFirst && (!pa.release_stage || pa.release_stage === 1))
                      ) || [];
                      const stageTracks = selectedPlaylist.tracks?.filter((pt: any) =>
                        pt.release_stage === stageNum || (isFirst && (!pt.release_stage || pt.release_stage === 1))
                      ) || [];

                      return (
                        <div key={stage.id || index} className="relative">
                          {/* Connector line */}
                          {index > 0 && (
                            <div className="absolute left-6 -top-4 h-4 w-0.5 bg-border" />
                          )}

                          <div className={`rounded-lg border overflow-hidden ${
                            isFirst ? 'border-green-200 dark:border-green-900/50' : 'border-border'
                          }`}>
                            {/* Stage header */}
                            <div className={`flex items-center space-x-3 p-4 ${
                              isFirst
                                ? 'bg-green-50 dark:bg-green-900/20'
                                : 'bg-muted/50'
                            }`}>
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                isFirst
                                  ? 'bg-green-500 text-white'
                                  : 'bg-muted-foreground/20 text-muted-foreground'
                              }`}>
                                {isFirst ? (
                                  <CheckCircle2 className="h-5 w-5" />
                                ) : (
                                  <Lock className="h-5 w-5" />
                                )}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{stage.name || t('playlists.stageNum', { num: stageNum })}</p>
                                <p className="text-sm text-muted-foreground">
                                  {isFirst || stage.unlockDays === 0
                                    ? t('playlists.availableImmediately')
                                    : t('playlists.unlocksAfterDays', { count: stage.unlockDays })}
                                </p>
                              </div>
                              <div className="text-right text-sm text-muted-foreground">
                                {stageAlbums.length > 0 && <span>{stageAlbums.length} {t('playlists.albums')}</span>}
                                {stageAlbums.length > 0 && stageTracks.length > 0 && <span> • </span>}
                                {stageTracks.length > 0 && <span>{stageTracks.length} {t('playlists.tracks')}</span>}
                              </div>
                            </div>

                            {/* Stage content preview */}
                            {(stageAlbums.length > 0 || stageTracks.length > 0) && (
                              <div className="p-3 space-y-2 bg-background">
                                {stageAlbums.map((pa: any) => (
                                  <div key={pa.id} className="flex items-center space-x-2 text-sm">
                                    <AlbumIcon className="h-4 w-4 text-primary" />
                                    <span>{pa.album?.title}</span>
                                    <span className="text-muted-foreground">({pa.album?.track_count || pa.album?.tracks?.length || 0} {t('playlists.tracks')})</span>
                                  </div>
                                ))}
                                {stageTracks.map((pt: any) => (
                                  <div key={pt.id} className="flex items-center space-x-2 text-sm">
                                    <Library className="h-4 w-4 text-muted-foreground" />
                                    <span>{pt.track?.title}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Empty stage state */}
                            {stageAlbums.length === 0 && stageTracks.length === 0 && (
                              <div className="p-3 bg-background text-sm text-muted-foreground text-center">
                                {t('playlists.noContentInStage')}
                              </div>
                            )}
                          </div>

                          {/* Unlock condition connector */}
                          {index < selectedPlaylist.release_schedule.stages.length - 1 && (
                            <div className="flex items-center justify-center py-2">
                              <div className="flex items-center space-x-2 text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {selectedPlaylist.release_schedule.stages[index + 1]?.unlockDays > 0
                                    ? t('playlists.waitDays', { count: selectedPlaylist.release_schedule.stages[index + 1].unlockDays })
                                    : t('playlists.unlocksImmediately')}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-900/30">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-blue-500 text-white flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-blue-900 dark:text-blue-100">{t('playlists.immediateAccess')}</p>
                        <p className="text-sm text-blue-800 dark:text-blue-200">{t('playlists.immediateAccessDesc')}</p>
                      </div>
                    </div>

                    {/* Show all content in one stage */}
                    {(selectedPlaylist.playlist_albums?.length > 0 || selectedPlaylist.tracks?.length > 0) && (
                      <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-900/30 space-y-2">
                        {selectedPlaylist.playlist_albums?.map((pa: any) => (
                          <div key={pa.id} className="flex items-center space-x-2 text-sm text-blue-800 dark:text-blue-200">
                            <AlbumIcon className="h-4 w-4" />
                            <span>{pa.album?.title}</span>
                            <span className="opacity-75">({pa.album?.track_count || 0} {t('playlists.tracks')})</span>
                          </div>
                        ))}
                        {selectedPlaylist.tracks?.map((pt: any) => (
                          <div key={pt.id} className="flex items-center space-x-2 text-sm text-blue-800 dark:text-blue-200">
                            <Library className="h-4 w-4" />
                            <span>{pt.track?.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completion" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Completion Requirements */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Target className="h-5 w-5 mr-2 text-primary" />
                    {t('playlists.completionRequirements')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">{t('playlists.completionThreshold')}</p>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm">{t('playlists.completionThresholdDesc')} <span className="font-semibold text-primary">100%</span> {t('playlists.completionThresholdOf')}</p>
                      <Progress value={100} className="h-2 mt-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Upon Completion Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Award className="h-5 w-5 mr-2 text-primary" />
                    {t('playlists.uponCompletionActions')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t('playlists.uponCompletionDesc')}
                  </p>
                  <Button variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    {t('playlists.addCompletionAction')}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Main listing view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground mb-2">{t('playlists.pageTitle')}</h1>
          <p className="text-muted-foreground">
            {t('playlists.pageSubtitle')}
          </p>
        </div>
        <Button 
          className="bg-brand-gradient" 
          onClick={mainTab === 'playlists' ? onOpenPlaylistWizard : handleCreateAlbum}
        >
          <Plus className="h-4 w-4 mr-2" />
          {mainTab === 'playlists' ? t('playlists.createPlaylist') : t('playlists.createAlbum')}
        </Button>
      </div>

      {/* Main Tab Navigation */}
      <div className="bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-full p-[3px]">
        <button
          onClick={() => setMainTab('playlists')}
          className={`inline-flex h-[calc(100%-1px)] items-center justify-center gap-1.5 rounded-full border border-transparent px-4 py-1 text-sm font-medium whitespace-nowrap transition-all ${
            mainTab === 'playlists'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('playlists.tabPlaylists')}
        </button>
        <button
          onClick={() => setMainTab('albums')}
          className={`inline-flex h-[calc(100%-1px)] items-center justify-center gap-1.5 rounded-full border border-transparent px-4 py-1 text-sm font-medium whitespace-nowrap transition-all ${
            mainTab === 'albums'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('playlists.tabAlbums')}
        </button>
      </div>

      {/* Conditional content based on mainTab */}
      {mainTab === 'playlists' ? (
        <>

      {/* Hero Stats Header Section */}
      {currentRole === 'admin' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('playlists.totalAssignments')}</p>
                  <p className="text-3xl font-bold mt-2">{playlists.reduce((sum, p) => sum + (p.assignedTo || 0), 0)}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <Library className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('playlists.completed')}</p>
                  <p className="text-3xl font-bold mt-2">
                    {playlists.reduce((sum, p) => {
                      const completed = Math.round((p.completionRate / 100) * (p.assignedTo || 0));
                      return sum + completed;
                    }, 0)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('playlists.inProgress')}</p>
                  <p className="text-3xl font-bold mt-2">
                    {playlists.reduce((sum, p) => {
                      const completed = Math.round((p.completionRate / 100) * (p.assignedTo || 0));
                      const inProgress = (p.assignedTo || 0) - completed;
                      return sum + Math.max(0, inProgress);
                    }, 0)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('playlists.avgCompletion')}</p>
                  <p className="text-3xl font-bold mt-2">
                    {playlists.length > 0
                      ? Math.round(
                          playlists.reduce((sum, p) => sum + (p.completionRate || 0), 0) / playlists.length
                        )
                      : 0}%
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xl font-bold text-primary">
                    {playlists.length > 0
                      ? Math.round(
                          playlists.reduce((sum, p) => sum + (p.completionRate || 0), 0) / playlists.length
                        )
                      : 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('playlists.searchPlaylists')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant={viewFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewFilter('all')}
                className={viewFilter === 'all' ? 'bg-brand-gradient' : ''}
              >
                {t('playlists.allPlaylists')}
              </Button>
              <Button
                variant={viewFilter === 'auto' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewFilter('auto')}
                className={viewFilter === 'auto' ? 'bg-brand-gradient' : ''}
              >
                <Zap className="h-3 w-3 mr-1" />
                {t('playlists.autoAssigned')}
              </Button>
              <Button
                variant={viewFilter === 'manual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewFilter('manual')}
                className={viewFilter === 'manual' ? 'bg-brand-gradient' : ''}
              >
                {t('playlists.manual')}
              </Button>
              <Button
                variant={viewFilter === 'archived' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewFilter('archived')}
                className={viewFilter === 'archived' ? 'bg-brand-gradient' : ''}
              >
                <Archive className="h-3 w-3 mr-1" />
                {t('playlists.archived')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? t('common.loading') : t('playlists.showingPlaylists', { count: filteredPlaylists.length })}
        </p>
        <div className="flex items-center gap-1 border rounded-lg p-1">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="h-8 px-3"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="h-8 px-3"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'space-y-4'}>
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Playlist Cards */}
      {!loading && (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'space-y-4'}>
          {filteredPlaylists.map((playlist) => (
            <Card
              key={playlist.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => fetchAndSelectPlaylist(playlist.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ListChecks className="h-6 w-6 text-foreground dark:text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold mb-1">{playlist.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{playlist.description}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="ml-2">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        fetchAndSelectPlaylist(playlist.id);
                      }}>
                        <Edit className="h-4 w-4 mr-2" />
                        {t('playlists.view')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleDuplicatePlaylist(playlist.id, e)}>
                        <Copy className="h-4 w-4 mr-2" />
                        {t('playlists.duplicate')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                        <Users className="h-4 w-4 mr-2" />
                        {t('playlists.viewLearners')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        {t('playlists.viewAnalytics')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => handleOpenArchiveModal(playlist.id, playlist.title, e)}>
                        <Archive className="h-4 w-4 mr-2" />
                        {t('playlists.archive')}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={(e) => handleDeletePlaylist(playlist.id, e)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('playlists.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge 
                    variant={playlist.type === 'auto' ? 'default' : 'secondary'}
                    className={playlist.type === 'auto' ? 'bg-brand-gradient' : ''}
                  >
                    {playlist.type === 'auto' ? (
                      <>
                        <Zap className="h-3 w-3 mr-1" />
                        {t('playlists.autoAssigned')}
                      </>
                    ) : (
                      t('playlists.manualAssignment')
                    )}
                  </Badge>
                  <Badge variant="outline">
                    {playlist.releaseType === 'progressive' ? (
                      <>
                        <Lock className="h-3 w-3 mr-1" />
                        {t('playlists.progressiveRelease')} • {playlist.stages} {t('playlists.tabStageDelivery').toLowerCase()}
                      </>
                    ) : (
                      t('playlists.immediateAccess')
                    )}
                  </Badge>
                  {playlist.required_form_id && (
                    <Badge variant="secondary" className="gap-1">
                      <FileText className="h-3 w-3" />
                      Includes sign-off form
                    </Badge>
                  )}
                </div>

                {/* Content Summary - Just showing total tracks */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Library className="h-4 w-4" />
                      <span className="font-medium">{playlist.totalTracks} {t('playlists.tracks')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">
                        {playlist.totalDuration >= 60
                          ? `${(playlist.totalDuration / 60).toFixed(1)} ${t('playlists.hours')}`
                          : `${playlist.totalDuration} ${t('playlists.min')}`
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      <span className="font-medium">{playlist.assignedTo} {t('playlists.learners')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={playlist.completionRate} className="h-2 w-20" />
                    <span className="text-sm font-semibold">{playlist.completionRate}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredPlaylists.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <ListMusic className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="font-semibold mb-2">{t('playlists.noPlaylistsFound')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery || viewFilter !== 'all'
                ? t('playlists.noPlaylistsAdjust')
                : t('playlists.noPlaylistsCreate')
              }
            </p>
            <Button variant="outline" onClick={() => {
              setSearchQuery('');
              setViewFilter('all');
            }}>
              {t('playlists.clearFilters')}
            </Button>
          </CardContent>
        </Card>
      )}
        </>
      ) : (
        <>
          {/* ALBUMS TAB CONTENT */}
          
          {/* Albums Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('playlists.searchAlbums')}
                    value={albumSearchQuery}
                    onChange={(e) => setAlbumSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant={albumStatusFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAlbumStatusFilter('all')}
                    className={albumStatusFilter === 'all' ? 'bg-brand-gradient' : ''}
                  >
                    {t('common.all')}
                  </Button>
                  <Button
                    variant={albumStatusFilter === 'published' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAlbumStatusFilter('published')}
                    className={albumStatusFilter === 'published' ? 'bg-brand-gradient' : ''}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {t('playlists.published')}
                  </Button>
                  <Button
                    variant={albumStatusFilter === 'draft' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAlbumStatusFilter('draft')}
                    className={albumStatusFilter === 'draft' ? 'bg-brand-gradient' : ''}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    {t('playlists.drafts')}
                  </Button>
                  <Button
                    variant={albumStatusFilter === 'archived' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAlbumStatusFilter('archived')}
                    className={albumStatusFilter === 'archived' ? 'bg-brand-gradient' : ''}
                  >
                    <Archive className="h-3 w-3 mr-1" />
                    {t('playlists.archived')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Count */}
          <p className="text-sm text-muted-foreground">
            {albumsLoading ? t('common.loading') : t('playlists.showingAlbums', { count: filteredAlbums.length })}
          </p>

          {/* Albums Grid */}
          {albumsLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredAlbums.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <AlbumIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="font-semibold mb-2">{t('playlists.noAlbumsFound')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {albumSearchQuery || albumStatusFilter !== 'all'
                    ? t('playlists.noAlbumsAdjust')
                    : t('playlists.noAlbumsCreate')
                  }
                </p>
                <Button variant="outline" onClick={handleCreateAlbum}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('playlists.createAlbum')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredAlbums.map((album) => (
                <Card 
                  key={album.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={async () => {
                    // Fetch full album with tracks relationship
                    const fullAlbum = await albumsCrud.getAlbumById(album.id);
                    if (fullAlbum) {
                      setSelectedAlbum(fullAlbum);
                    }
                  }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <AlbumIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold mb-1 truncate">{album.title}</h3>
                          {album.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{album.description}</p>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="ml-2">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={async (e) => {
                            e.stopPropagation();
                            // Fetch full album with tracks relationship
                            const fullAlbum = await albumsCrud.getAlbumById(album.id);
                            if (fullAlbum) {
                              setSelectedAlbum(fullAlbum);
                            }
                          }}>
                            <Edit className="h-4 w-4 mr-2" />
                            {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => handleDuplicateAlbum(album.id, e)}>
                            <Copy className="h-4 w-4 mr-2" />
                            {t('playlists.duplicate')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => handleArchiveAlbum(album.id, e)}>
                            <Archive className="h-4 w-4 mr-2" />
                            {t('playlists.archive')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={(e) => handleDeleteAlbum(album.id, e)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('playlists.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Status Badge */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge variant={
                        album.status === 'published' ? 'default' : 
                        album.status === 'draft' ? 'secondary' : 'outline'
                      }>
                        {album.status === 'published' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {album.status}
                      </Badge>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 pt-3 border-t text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <AlbumIcon className="h-4 w-4" />
                        <span className="font-medium">{album.track_count || 0} {t('playlists.tracks')}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">{album.total_duration_minutes || 0} {t('playlists.min')}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      
      <Footer />

      {/* Archive Playlist Modal */}
      <ArchivePlaylistModal
        isOpen={archiveModalOpen}
        onClose={() => {
          setArchiveModalOpen(false);
          setPlaylistToArchive(null);
        }}
        playlistId={playlistToArchive?.id || ''}
        playlistTitle={playlistToArchive?.title || ''}
        onArchive={handleArchivePlaylist}
      />
    </div>
  );
}