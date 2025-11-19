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
  Target
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
}

export function Playlists({ currentRole = 'admin', onOpenPlaylistWizard }: PlaylistsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'auto' | 'manual'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'archived'>('active');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPlaylist, setSelectedPlaylist] = useState<any | null>(null);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { user } = useCurrentUser();

  useEffect(() => {
    fetchPlaylists();
  }, [user?.organization_id, selectedType, selectedStatus]);

  const fetchPlaylists = async () => {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      let query = supabase
        .from('playlists')
        .select(`
          *,
          playlist_albums (
            id,
            display_order,
            album:albums (
              id,
              title,
              description,
              album_tracks (
                id,
                track:tracks (
                  id,
                  title,
                  type,
                  duration_minutes
                )
              )
            )
          )
        `)
        .eq('organization_id', user.organization_id)
        .order('created_at', { ascending: false });

      if (selectedType !== 'all') {
        query = query.eq('type', selectedType);
      }

      if (selectedStatus !== 'all') {
        query = query.eq('is_active', selectedStatus === 'active');
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Process data to add calculated fields
      const processedPlaylists = (data || []).map((playlist: any) => {
        const albums = playlist.playlist_albums || [];
        const albumCount = albums.length;
        
        // Count total tracks across all albums
        let totalTracks = 0;
        albums.forEach((pa: any) => {
          if (pa.album?.album_tracks) {
            totalTracks += pa.album.album_tracks.length;
          }
        });

        return {
          ...playlist,
          albumCount,
          totalTracks
        };
      });

      setPlaylists(processedPlaylists);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching playlists:', err);
      setError(err);
      toast.error('Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  const handleRunTrigger = async (playlistId: string) => {
    try {
      toast.info('Running playlist trigger...');
      const assignments = await crud.runPlaylistTrigger(playlistId);
      toast.success(`Created ${assignments.length} new assignments!`);
      fetchPlaylists();
    } catch (error: any) {
      console.error('Error running trigger:', error);
      toast.error(error.message || 'Failed to run trigger');
    }
  };

  const handleArchivePlaylist = async (playlistId: string) => {
    try {
      await supabase
        .from('playlists')
        .update({ is_active: false })
        .eq('id', playlistId);
      
      toast.success('Playlist archived');
      fetchPlaylists();
    } catch (error) {
      console.error('Error archiving playlist:', error);
      toast.error('Failed to archive playlist');
    }
  };

  const filteredPlaylists = playlists.filter(playlist =>
    searchQuery === '' ||
    playlist.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    playlist.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-xl font-semibold text-red-700 mb-2">Error Loading Playlists</h2>
        <p className="text-red-600 mb-4">{error.message}</p>
        <Button onClick={fetchPlaylists}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground">Playlists</h1>
          <p className="text-muted-foreground mt-1">
            Manage training playlists and auto-assignment rules
          </p>
        </div>
        {currentRole === 'admin' && (
          <Button 
            className="hero-primary"
            onClick={onOpenPlaylistWizard}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Playlist
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Library className="h-4 w-4" />
              Total Playlists
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{playlists.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Auto Playlists
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {playlists.filter(p => p.type === 'auto').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ListMusic className="h-4 w-4" />
              Manual Playlists
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {playlists.filter(p => p.type === 'manual').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {playlists.filter(p => p.is_active).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search playlists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedType} onValueChange={(val: any) => setSelectedType(val)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="auto">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Auto Playlists
                  </div>
                </SelectItem>
                <SelectItem value="manual">
                  <div className="flex items-center gap-2">
                    <ListMusic className="h-4 w-4" />
                    Manual Playlists
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={(val: any) => setSelectedStatus(val)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        {filteredPlaylists.length} {filteredPlaylists.length === 1 ? 'playlist' : 'playlists'} found
      </div>

      {/* Playlists Grid */}
      {filteredPlaylists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Library className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No playlists found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery
                ? 'Try adjusting your search'
                : 'Get started by creating your first playlist'}
            </p>
            {currentRole === 'admin' && (
              <Button onClick={onOpenPlaylistWizard}>
                <Plus className="h-4 w-4 mr-2" />
                Create Playlist
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlaylists.map((playlist) => (
            <Card key={playlist.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-brand-gradient flex items-center justify-center text-white flex-shrink-0">
                      {playlist.type === 'auto' ? (
                        <Zap className="h-5 w-5" />
                      ) : (
                        <ListMusic className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{playlist.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={playlist.type === 'auto' ? 'default' : 'secondary'} className="text-xs">
                          {playlist.type === 'auto' ? 'Auto' : 'Manual'}
                        </Badge>
                        {playlist.is_active ? (
                          <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Archived</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {currentRole === 'admin' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedPlaylist(playlist)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {playlist.type === 'auto' && (
                          <DropdownMenuItem onClick={() => handleRunTrigger(playlist.id)}>
                            <Zap className="h-4 w-4 mr-2" />
                            Run Trigger
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleArchivePlaylist(playlist.id)}
                          className="text-red-600"
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {playlist.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {playlist.description}
                  </p>
                )}

                {/* Auto Playlist Trigger */}
                {playlist.type === 'auto' && playlist.trigger_rules && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Target className="h-3 w-3" />
                      Auto-Assignment Rules
                    </div>
                    <div className="text-xs">
                      {playlist.trigger_rules.role_ids?.length > 0 && (
                        <div>Roles: {playlist.trigger_rules.role_ids.length}</div>
                      )}
                      {playlist.trigger_rules.hire_days && (
                        <div>Within {playlist.trigger_rules.hire_days} days of hire</div>
                      )}
                      {playlist.trigger_rules.store_ids?.length > 0 && (
                        <div>Stores: {playlist.trigger_rules.store_ids.length}</div>
                      )}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Albums</div>
                    <div className="font-semibold flex items-center gap-1 mt-1">
                      <AlbumIcon className="h-3 w-3" />
                      {playlist.albumCount || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Tracks</div>
                    <div className="font-semibold flex items-center gap-1 mt-1">
                      <Music className="h-3 w-3" />
                      {playlist.totalTracks || 0}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Created {new Date(playlist.created_at).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Footer />
    </div>
  );
}
