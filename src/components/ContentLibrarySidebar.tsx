import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, FolderOpen, ChevronDown, ChevronUp, Edit, Filter } from 'lucide-react';
import { useItemTranslations } from '../hooks/useItemTranslations';
import { getRecentAlbums, type Album } from '../lib/crud/albums';
import { getPlaylists } from '../lib/crud/playlists';
import { getCurrentUserOrgId } from '../lib/supabase';
import { publicAnonKey } from '../utils/supabase/info';
import { supabase } from '../lib/supabase';
import { cn } from './ui/utils';

const SEED_PLAYLIST_STORAGE_KEY = 'trike_seed_playlist_tried_';

interface ContentLibrarySidebarProps {
  onPlaylistClick: (playlistId: string) => void;
  onAlbumClick: (albumId: string) => void;
  onEditPlaylist?: (playlistId: string) => void;  // NEW
  onEditAlbum?: (albumId: string) => void;        // NEW
  onPlaylistsHeaderClick?: () => void;            // Navigate to playlists tab
  onAlbumsHeaderClick?: () => void;               // Navigate to albums tab
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
  onPlaylistsHeaderClick,
  onAlbumsHeaderClick,
  activePlaylistFilter,
  activeAlbumFilter,
  className
}: ContentLibrarySidebarProps) {
  const { t, i18n } = useTranslation();
  const [playlistsExpanded, setPlaylistsExpanded] = useState(true);
  const [albumsExpanded, setAlbumsExpanded] = useState(true);
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

      // Fetch all albums (expanded by default, sorted by updated_at)
      const allAlbumsData = await getRecentAlbums(100);
      setAlbums(allAlbumsData.slice(0, 4));
      setAllAlbums(allAlbumsData);

      // Fetch all playlists and sort by updated_at
      let allPlaylistsData = await getPlaylists({});
      // If demo org has no playlists, try to create seed playlist once per session
      if (allPlaylistsData.length === 0 && typeof sessionStorage !== 'undefined') {
        const orgId = await getCurrentUserOrgId();
        if (orgId && !sessionStorage.getItem(SEED_PLAYLIST_STORAGE_KEY + orgId)) {
          sessionStorage.setItem(SEED_PLAYLIST_STORAGE_KEY + orgId, '1');
          try {
            const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kgzhlvxzdlexsrozbbxs';
            const url = `https://${projectId}.supabase.co/functions/v1/trike-server/demo/seed-playlist`;
            const { data: { session } } = await supabase.auth.getSession();
            const authToken = session?.access_token || publicAnonKey;
            const resp = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'apikey': publicAnonKey,
              },
              body: JSON.stringify({ organization_id: orgId }),
            });
            const data = await resp.json();
            if (resp.ok && (data.created || data.playlist_id)) {
              allPlaylistsData = await getPlaylists({});
            }
          } catch {
            // Ignore; we already marked as tried
          }
        }
      }
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
    // Already have all albums loaded, just toggle expansion
    setAlbumsExpanded(!albumsExpanded);
  };

  const displayedPlaylists = playlistsExpanded ? allPlaylists : playlists.slice(0, 4);
  const displayedAlbums = albumsExpanded ? allAlbums : albums.slice(0, 4);

  // Combine all items for batch translation
  const allItemsForTranslation = [
    ...allPlaylists.map((p) => ({ id: p.id, title: p.title })),
    ...allAlbums.map((a) => ({ id: a.id, title: a.title })),
  ];
  const { translateTitle } = useItemTranslations(allItemsForTranslation, i18n.language);

  return (
    <div 
      className={cn(
        "w-full bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-xl",
        className
      )}
    >
      {/* Active Playlists Section */}
      <div className="p-4 border-b border-border overflow-hidden">
        <h3
          className={cn(
            "text-sm font-semibold text-foreground mb-3",
            onPlaylistsHeaderClick && "cursor-pointer hover:text-primary transition-colors"
          )}
          onClick={onPlaylistsHeaderClick}
        >
          {t('dashboard.activePlaylists')}
        </h3>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-xs text-red-500">
            {t('content.sidebarFailedToLoad')} <button
              onClick={fetchData}
              className="underline hover:text-red-400"
            >
              {t('content.retry')}
            </button>
          </div>
        ) : displayedPlaylists.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">{t('content.noPlaylistsYet')}</p>
        ) : (
          <>
            <div className="space-y-1">
              {displayedPlaylists.map((playlist) => (
                <PlaylistItem
                  key={playlist.id}
                  playlist={{ ...playlist, title: translateTitle(playlist.id, playlist.title) }}
                  onClick={() => onPlaylistClick(playlist.id)}
                  onEdit={onEditPlaylist ? () => onEditPlaylist(playlist.id) : undefined}
                  isActive={activePlaylistFilter === playlist.id}
                />
              ))}
            </div>

            {allPlaylists.length > 4 && (
              <button
                onClick={handleExpandPlaylists}
                className="mt-2 flex items-center justify-center w-full hover:bg-accent/50 rounded py-1 transition-colors"
                title={playlistsExpanded ? "Show less" : "Show more"}
              >
                {playlistsExpanded ? (
                  <ChevronUp className="h-4 w-4 text-foreground font-bold" strokeWidth={2.5} />
                ) : (
                  <ChevronDown className="h-4 w-4 text-foreground font-bold" strokeWidth={2.5} />
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Active Albums Section */}
      <div className="p-4 overflow-hidden">
        <h3
          className={cn(
            "text-sm font-semibold text-foreground mb-3",
            onAlbumsHeaderClick && "cursor-pointer hover:text-primary transition-colors"
          )}
          onClick={onAlbumsHeaderClick}
        >
          {t('dashboard.activeAlbums')}
        </h3>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-xs text-red-500">
            {t('content.sidebarFailedToLoad')} <button
              onClick={fetchData}
              className="underline hover:text-red-400"
            >
              {t('content.retry')}
            </button>
          </div>
        ) : displayedAlbums.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">{t('content.noAlbumsYet')}</p>
        ) : (
          <>
            <div className="space-y-1">
              {displayedAlbums.map((album) => (
                <AlbumItem
                  key={album.id}
                  album={{ ...album, title: translateTitle(album.id, album.title) }}
                  onClick={() => onAlbumClick(album.id)}
                  onEdit={onEditAlbum ? () => onEditAlbum(album.id) : undefined}
                  isActive={activeAlbumFilter === album.id}
                />
              ))}
            </div>

            {albums.length >= 4 && (
              <button
                onClick={handleExpandAlbums}
                className="mt-2 flex items-center justify-center w-full hover:bg-accent/50 rounded py-1 transition-colors"
                title={albumsExpanded ? "Show less" : "Show more"}
              >
                {albumsExpanded ? (
                  <ChevronUp className="h-4 w-4 text-foreground font-bold" strokeWidth={2.5} />
                ) : (
                  <ChevronDown className="h-4 w-4 text-foreground font-bold" strokeWidth={2.5} />
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
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors group cursor-pointer overflow-hidden',
        isActive
          ? 'bg-primary/20 text-primary border border-primary/30'
          : 'hover:bg-accent/50'
      )}
      title={playlist.title}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0 text-left overflow-hidden">
        <Play className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm text-foreground truncate flex-1 min-w-0">{playlist.title}</span>
      </div>
      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded flex-shrink-0"
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
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors group cursor-pointer overflow-hidden',
        isActive
          ? 'bg-primary/20 text-primary border border-primary/30'
          : 'hover:bg-accent/50'
      )}
      title={album.title}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0 text-left overflow-hidden">
        <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0 overflow-hidden">
          <span className="text-sm text-foreground truncate block">{album.title}</span>
          <span className="text-xs text-muted-foreground">
            {trackCount} {trackCount === 1 ? 'track' : 'tracks'} • {duration} min
          </span>
        </div>
      </div>
      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded flex-shrink-0"
          title="Edit album"
        >
          <Edit className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      )}
    </div>
  );
}

