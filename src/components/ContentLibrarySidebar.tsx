import React, { useState, useEffect } from 'react';
import { Play, FolderOpen, ChevronDown, ChevronUp, Edit, Filter } from 'lucide-react';
import { getRecentAlbums, type Album } from '../lib/crud/albums';
import { getPlaylists } from '../lib/crud/playlists';
import { cn } from './ui/utils';

interface ContentLibrarySidebarProps {
  onPlaylistClick: (playlistId: string) => void;
  onAlbumClick: (albumId: string) => void;
  onEditPlaylist?: (playlistId: string) => void;  // NEW
  onEditAlbum?: (albumId: string) => void;        // NEW
  activePlaylistFilter?: string | null;
  activeAlbumFilter?: string | null;              // NEW
  className?: string;
}

interface Playlist {
  id: string;
  title: string;
  updated_at?: string;
  created_at?: string;
  [key: string]: any;
}

export function ContentLibrarySidebar({ 
  onPlaylistClick, 
  onAlbumClick,
  onEditPlaylist,
  onEditAlbum,
  activePlaylistFilter,
  activeAlbumFilter,
  className 
}: ContentLibrarySidebarProps) {
  const [playlistsExpanded, setPlaylistsExpanded] = useState(false);
  const [albumsExpanded, setAlbumsExpanded] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [allPlaylists, setAllPlaylists] = useState<Playlist[]>([]);
  const [allAlbums, setAllAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch recent albums (4 by default)
      const recentAlbums = await getRecentAlbums(4);
      setAlbums(recentAlbums);

      // Fetch all playlists and sort by updated_at
      const allPlaylistsData = await getPlaylists({});
      // Sort by updated_at descending, fallback to created_at
      const sortedPlaylists = allPlaylistsData.sort((a: any, b: any) => {
        const aDate = a.updated_at || a.created_at || '';
        const bDate = b.updated_at || b.created_at || '';
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
      setAllPlaylists(sortedPlaylists);
      setPlaylists(sortedPlaylists.slice(0, 4));
    } catch (err: any) {
      console.error('Failed to load sidebar data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleExpandPlaylists = async () => {
    if (!playlistsExpanded) {
      // Already have all playlists, just expand
      setPlaylistsExpanded(true);
    } else {
      setPlaylistsExpanded(false);
    }
  };

  const handleExpandAlbums = async () => {
    if (!albumsExpanded) {
      // Fetch all albums
      try {
        const allAlbumsData = await getRecentAlbums(100);
        setAllAlbums(allAlbumsData);
        setAlbumsExpanded(true);
      } catch (err: any) {
        console.error('Failed to load all albums:', err);
        setError(err.message || 'Failed to load albums');
      }
    } else {
      setAlbumsExpanded(false);
    }
  };

  const displayedPlaylists = playlistsExpanded ? allPlaylists : playlists.slice(0, 4);
  const displayedAlbums = albumsExpanded ? allAlbums : albums.slice(0, 4);

  return (
    <div 
      className={cn(
        "w-full bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-xl",
        className
      )}
    >
      {/* Active Playlists Section */}
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground mb-3">Active Playlists</h3>
        
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-xs text-red-500">
            Failed to load. <button 
              onClick={fetchData} 
              className="underline hover:text-red-400"
            >
              Retry
            </button>
          </div>
        ) : displayedPlaylists.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No playlists yet</p>
        ) : (
          <>
            {playlistsExpanded ? (
              <div className="max-h-64 overflow-y-auto space-y-1">
                {displayedPlaylists.map((playlist) => (
                  <PlaylistItem 
                    key={playlist.id} 
                    playlist={playlist} 
                    onClick={() => onPlaylistClick(playlist.id)} 
                    onEdit={onEditPlaylist ? () => onEditPlaylist(playlist.id) : undefined}
                    isActive={activePlaylistFilter === playlist.id}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {displayedPlaylists.map((playlist) => (
                  <PlaylistItem 
                    key={playlist.id} 
                    playlist={playlist} 
                    onClick={() => onPlaylistClick(playlist.id)} 
                    onEdit={onEditPlaylist ? () => onEditPlaylist(playlist.id) : undefined}
                    isActive={activePlaylistFilter === playlist.id}
                  />
                ))}
              </div>
            )}
            
            {allPlaylists.length > 4 && (
              <button
                onClick={handleExpandPlaylists}
                className="text-xs text-primary hover:text-primary/80 mt-2 flex items-center gap-1"
              >
                {playlistsExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Show more ({allPlaylists.length - 4} more)
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Active Albums Section */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Active Albums</h3>
        
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-xs text-red-500">
            Failed to load. <button 
              onClick={fetchData} 
              className="underline hover:text-red-400"
            >
              Retry
            </button>
          </div>
        ) : displayedAlbums.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No albums yet</p>
        ) : (
          <>
            {albumsExpanded ? (
              <div className="max-h-64 overflow-y-auto space-y-1">
                {displayedAlbums.map((album) => (
                  <AlbumItem 
                    key={album.id} 
                    album={album} 
                    onClick={() => onAlbumClick(album.id)} 
                    onEdit={onEditAlbum ? () => onEditAlbum(album.id) : undefined}
                    isActive={activeAlbumFilter === album.id}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {displayedAlbums.map((album) => (
                  <AlbumItem 
                    key={album.id} 
                    album={album} 
                    onClick={() => onAlbumClick(album.id)} 
                    onEdit={onEditAlbum ? () => onEditAlbum(album.id) : undefined}
                    isActive={activeAlbumFilter === album.id}
                  />
                ))}
              </div>
            )}
            
            {albums.length >= 4 && (
              <button
                onClick={handleExpandAlbums}
                className="text-xs text-primary hover:text-primary/80 mt-2 flex items-center gap-1"
              >
                {albumsExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Show more
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Playlist Item Component
interface PlaylistItemProps {
  playlist: Playlist;
  onClick: () => void;
  onEdit?: () => void;
  isActive?: boolean;
}

function PlaylistItem({ playlist, onClick, onEdit, isActive = false }: PlaylistItemProps) {
  return (
    <div
      className={cn(
        'w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors group',
        isActive
          ? 'bg-primary/20 text-primary border border-primary/30'
          : 'hover:bg-accent/50'
      )}
    >
      <button
        onClick={onClick}
        className="flex items-center gap-3 flex-1 text-left"
        title="Filter by playlist"
      >
        <Play className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm text-foreground truncate flex-1">{playlist.title}</span>
      </button>
      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded"
          title="Edit playlist"
        >
          <Edit className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      )}
    </div>
  );
}

// Album Item Component
interface AlbumItemProps {
  album: Album;
  onClick: () => void;
  onEdit?: () => void;
  isActive?: boolean;
}

function AlbumItem({ album, onClick, onEdit, isActive = false }: AlbumItemProps) {
  const trackCount = album.track_count || 0;
  const duration = album.total_duration_minutes || 0;

  return (
    <div
      className={cn(
        'w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors group',
        isActive
          ? 'bg-primary/20 text-primary border border-primary/30'
          : 'hover:bg-accent/50'
      )}
    >
      <button
        onClick={onClick}
        className="flex items-center gap-3 flex-1 text-left"
        title="Filter by album"
      >
        <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm text-foreground truncate block">{album.title}</span>
          <span className="text-xs text-muted-foreground">
            {trackCount} {trackCount === 1 ? 'track' : 'tracks'} • {duration} min
          </span>
        </div>
      </button>
      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded"
          title="Edit album"
        >
          <Edit className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      )}
    </div>
  );
}

