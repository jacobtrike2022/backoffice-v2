import React, { useState, useEffect } from 'react';
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
  List
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
import { useCurrentUser } from '../lib/hooks/useSupabase';
import { supabase } from '../lib/supabase';
import * as crud from '../lib/crud';
import { toast } from 'sonner@2.0.3';

interface PlaylistsProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
  onOpenPlaylistWizard?: () => void;
  selectedPlaylistId?: string;
}

export function Playlists({ currentRole = 'admin', onOpenPlaylistWizard, selectedPlaylistId }: PlaylistsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewFilter, setViewFilter] = useState<string>('all');
  const [selectedPlaylist, setSelectedPlaylist] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { user } = useCurrentUser();

  useEffect(() => {
    fetchPlaylists();
  }, [user?.organization_id, viewFilter]);

  // Auto-select playlist if selectedPlaylistId is provided
  useEffect(() => {
    if (selectedPlaylistId && playlists.length > 0 && !selectedPlaylist) {
      const playlist = playlists.find(p => p.id === selectedPlaylistId);
      if (playlist) {
        console.log('🎵 Auto-selecting playlist:', playlist.title);
        setSelectedPlaylist(playlist);
      }
    }
  }, [selectedPlaylistId, playlists.length, selectedPlaylist]);

  const fetchPlaylists = async () => {
    if (!user?.organization_id) return;

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

      // Transform data for display
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
        status: playlist.is_active ? 'active' : 'archived'
      }));

      setPlaylists(transformedPlaylists);
    } catch (err) {
      console.error('Error fetching playlists:', err);
      setError(err as Error);
      toast.error('Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  // Action handlers
  const handleDuplicatePlaylist = async (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await crud.duplicatePlaylist(playlistId);
      toast.success('Playlist duplicated successfully');
      fetchPlaylists();
    } catch (err) {
      console.error('Error duplicating playlist:', err);
      toast.error('Failed to duplicate playlist');
    }
  };

  const handleArchivePlaylist = async (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await crud.archivePlaylist(playlistId);
      toast.success('Playlist archived successfully');
      fetchPlaylists();
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylist(null);
      }
    } catch (err) {
      console.error('Error archiving playlist:', err);
      toast.error('Failed to archive playlist');
    }
  };

  const handleDeletePlaylist = async (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this playlist? This action cannot be undone.')) {
      return;
    }
    try {
      await crud.deletePlaylist(playlistId);
      toast.success('Playlist deleted successfully');
      fetchPlaylists();
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylist(null);
      }
    } catch (err) {
      console.error('Error deleting playlist:', err);
      toast.error('Failed to delete playlist');
    }
  };

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

  // If a playlist is selected, show detail view
  if (selectedPlaylist) {
    return (
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => setSelectedPlaylist(null)}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Playlists
            </Button>
            <div>
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-lg bg-brand-gradient flex items-center justify-center">
                  <ListChecks className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-foreground">{selectedPlaylist.title}</h1>
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-1">
                <Badge variant={selectedPlaylist.type === 'auto' ? 'default' : 'secondary'} className={selectedPlaylist.type === 'auto' ? 'bg-brand-gradient' : ''}>
                  {selectedPlaylist.type === 'auto' ? (
                    <>
                      <Zap className="h-3 w-3 mr-1" />
                      Auto-Assigned
                    </>
                  ) : (
                    'Manual Assignment'
                  )}
                </Badge>
                <span>•</span>
                <Badge variant="outline">
                  {selectedPlaylist.releaseType === 'progressive' ? (
                    <>
                      <Lock className="h-3 w-3 mr-1" />
                      Progressive Release
                    </>
                  ) : (
                    'Immediate Access'
                  )}
                </Badge>
                <span>•</span>
                <span>Created {new Date(selectedPlaylist.createdDate).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit Playlist
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
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => handleArchivePlaylist(selectedPlaylist.id, e)}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={(e) => handleDeletePlaylist(selectedPlaylist.id, e)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
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
                  <p className="text-sm text-muted-foreground">Assigned Learners</p>
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
                  <p className="text-sm text-muted-foreground">Completion Rate</p>
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
                  <p className="text-sm text-muted-foreground">Total Content</p>
                  <p className="text-2xl font-bold">{selectedPlaylist.totalTracks}</p>
                  <p className="text-xs text-muted-foreground">tracks</p>
                </div>
                <Library className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Est. Completion</p>
                  <p className="text-2xl font-bold">4.5</p>
                  <p className="text-xs text-muted-foreground">hours</p>
                </div>
                <Clock className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="triggers">Assignment Logic</TabsTrigger>
            <TabsTrigger value="stages">Stage Delivery</TabsTrigger>
            <TabsTrigger value="completion">Completion Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Content Structure */}
              <Card>
                <CardHeader>
                  <CardTitle>Content Structure</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-4">{selectedPlaylist.description}</p>
                  
                  {selectedPlaylist.releaseType === 'progressive' && selectedPlaylist.stages?.length > 0 && (
                    <div className="space-y-3">
                      {selectedPlaylist.stages.map((stage: any, index: number) => (
                        <div key={stage.id} className={`flex items-center space-x-2 p-3 rounded-lg border ${
                          index === 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/30' :
                          index === 1 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/30' :
                          'bg-muted'
                        }`}>
                          {index === 0 ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                          ) : index === 1 ? (
                            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Lock className="h-5 w-5 text-muted-foreground" />
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-sm">{stage.name || `Stage ${index + 1}`} - {stage.unlock_description || `Day ${stage.unlock_days || index + 1}`}</p>
                            <p className="text-xs text-muted-foreground">{stage.content_summary || 'Content details'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {selectedPlaylist.releaseType === 'immediate' && (
                    <div className="space-y-3">
                      {selectedPlaylist.playlist_albums?.map((pa: any) => (
                        <div key={pa.id} className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                          <AlbumIcon className="h-5 w-5 text-primary" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{pa.album?.title || 'Unnamed Album'}</p>
                            <p className="text-xs text-muted-foreground">{pa.album?.tracks?.length || 0} tracks</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Assignment Rules */}
              <Card>
                <CardHeader>
                  <CardTitle>Assignment Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedPlaylist.type === 'auto' && selectedPlaylist.trigger_config && (
                    <>
                      <div>
                        <p className="text-sm font-medium mb-2">Auto-Assignment Trigger</p>
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-900/30">
                          <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-1">This playlist automatically assigns when:</p>
                          <ul className="text-sm text-orange-800 dark:text-orange-200 space-y-1 ml-4">
                            <li>→ {selectedPlaylist.trigger || 'Trigger conditions configured'}</li>
                          </ul>
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}
                  
                  <div>
                    <p className="text-sm font-medium mb-2">Training Start</p>
                    <p className="text-sm text-muted-foreground">
                      Training begins immediately upon assignment
                    </p>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <p className="text-sm font-medium mb-2">Completion Requirements</p>
                    <p className="text-sm text-muted-foreground">
                      Learners must complete 100% of tracks to finish this playlist
                    </p>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <p className="text-sm font-medium mb-2">Notifications Enabled</p>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>At assignment</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>When training starts</span>
                      </div>
                      {selectedPlaylist.releaseType === 'progressive' && (
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span>Stage unlocks (progressive)</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>3 days before due date</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium">Playlist created</p>
                      <p className="text-xs text-muted-foreground">{new Date(selectedPlaylist.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="triggers" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Assignment Logic</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedPlaylist.type === 'auto' && selectedPlaylist.trigger_config && (
                  <>
                    <div>
                      <p className="text-sm font-medium mb-2">Auto-Assignment Trigger</p>
                      <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-900/30">
                        <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-1">This playlist automatically assigns when:</p>
                        <ul className="text-sm text-orange-800 dark:text-orange-200 space-y-1 ml-4">
                          <li>→ {selectedPlaylist.trigger || 'Trigger conditions configured'}</li>
                        </ul>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}
                
                {selectedPlaylist.type === 'manual' && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-900/30">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Manual Assignment</p>
                    <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">This playlist is assigned manually by administrators</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stages" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Stage Delivery</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedPlaylist.releaseType === 'progressive' && selectedPlaylist.stages?.length > 0 ? (
                  <div className="space-y-3">
                    {selectedPlaylist.stages.map((stage: any, index: number) => (
                      <div key={stage.id} className={`flex items-center space-x-2 p-3 rounded-lg border ${
                        index === 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/30' :
                        index === 1 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/30' :
                        'bg-muted'
                      }`}>
                        {index === 0 ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        ) : index === 1 ? (
                          <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Lock className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-sm">{stage.name || `Stage ${index + 1}`} - {stage.unlock_description || `Unlocks: Day ${stage.unlock_days || index + 1}`}</p>
                          <p className="text-xs text-muted-foreground">{stage.content_summary || 'Content details'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-900/30">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Immediate Access</p>
                    <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">All content is available immediately upon assignment</p>
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
                    Completion Requirements
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Completion Threshold</p>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm">Learners must complete <span className="font-semibold text-primary">100%</span> of tracks</p>
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
                    Upon Completion Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Configure actions to automatically trigger when learners complete this playlist
                  </p>
                  <Button variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Completion Action
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
          <h1 className="text-foreground mb-2">Playlists</h1>
          <p className="text-muted-foreground">
            Assign content to your team through curated learning playlists
          </p>
        </div>
        <Button className="bg-brand-gradient" onClick={onOpenPlaylistWizard}>
          <Plus className="h-4 w-4 mr-2" />
          Create Playlist
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search playlists..."
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
                All Playlists
              </Button>
              <Button
                variant={viewFilter === 'auto' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewFilter('auto')}
                className={viewFilter === 'auto' ? 'bg-brand-gradient' : ''}
              >
                <Zap className="h-3 w-3 mr-1" />
                Auto-Assigned
              </Button>
              <Button
                variant={viewFilter === 'manual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewFilter('manual')}
                className={viewFilter === 'manual' ? 'bg-brand-gradient' : ''}
              >
                Manual
              </Button>
              <Button
                variant={viewFilter === 'archived' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewFilter('archived')}
                className={viewFilter === 'archived' ? 'bg-brand-gradient' : ''}
              >
                <Archive className="h-3 w-3 mr-1" />
                Archived
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Loading...' : `Showing ${filteredPlaylists.length} ${filteredPlaylists.length === 1 ? 'playlist' : 'playlists'}`}
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
              onClick={() => setSelectedPlaylist(playlist)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-brand-gradient flex items-center justify-center flex-shrink-0">
                      <ListChecks className="h-6 w-6 text-white" />
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
                        setSelectedPlaylist(playlist);
                      }}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleDuplicatePlaylist(playlist.id, e)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                        <Users className="h-4 w-4 mr-2" />
                        View Learners
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        View Analytics
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => handleArchivePlaylist(playlist.id, e)}>
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={(e) => handleDeletePlaylist(playlist.id, e)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
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
                        Auto-Assigned
                      </>
                    ) : (
                      'Manual Assignment'
                    )}
                  </Badge>
                  <Badge variant="outline">
                    {playlist.releaseType === 'progressive' ? (
                      <>
                        <Lock className="h-3 w-3 mr-1" />
                        Progressive • {playlist.stages} stages
                      </>
                    ) : (
                      'Immediate Access'
                    )}
                  </Badge>
                </div>

                {/* Content Summary - Just showing total tracks */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Library className="h-4 w-4" />
                      <span className="font-medium">{playlist.totalTracks} tracks</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      <span className="font-medium">{playlist.assignedTo} learners</span>
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
            <h3 className="font-semibold mb-2">No playlists found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery || viewFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria'
                : 'Create your first playlist to get started'
              }
            </p>
            <Button variant="outline" onClick={() => {
              setSearchQuery('');
              setViewFilter('all');
            }}>
              Clear filters
            </Button>
          </CardContent>
        </Card>
      )}
      <Footer />
    </div>
  );
}