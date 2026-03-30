import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  ListChecks,
  Users,
  ExternalLink
} from 'lucide-react';
import * as crud from '../../lib/crud/tracks';

interface AssociatedPlaylistsProps {
  trackId: string;
  onPlaylistClick?: (playlistId: string) => void;
}

export function AssociatedPlaylists({ trackId, onPlaylistClick }: AssociatedPlaylistsProps) {
  const { t } = useTranslation();
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (trackId) {
      loadPlaylists();
    }
  }, [trackId]);

  const loadPlaylists = async () => {
    setIsLoading(true);
    try {
      const playlistData = await crud.getTrackPlaylistAssignments(trackId);
      setPlaylists(playlistData);
    } catch (error: any) {
      console.error('Error loading playlist assignments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <ListChecks className="h-4 w-4 mr-2" />
            {t('contentAuthoring.associatedPlaylists')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">{t('contentAuthoring.loadingPlaylists')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (playlists.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <ListChecks className="h-4 w-4 mr-2" />
            {t('contentAuthoring.associatedPlaylists')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <ListChecks className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t('contentAuthoring.notInAnyPlaylist')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('contentAuthoring.trackCanBeEditedFreely')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center">
          <ListChecks className="h-4 w-4 mr-2" />
          {t('contentAuthoring.associatedPlaylists')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {playlists.map((playlist) => (
          <div 
            key={playlist.playlistId}
            className="p-3 rounded-lg border bg-accent/30 cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => onPlaylistClick?.(playlist.playlistId)}
          >
            {/* Playlist Title and Status */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm truncate font-medium">{playlist.playlistTitle}</h4>
                </div>
                {playlist.playlistDescription && (
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {playlist.playlistDescription}
                  </p>
                )}
              </div>
              <div className="flex items-center">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {/* Activity Stats - Compact Single Line */}
            {playlist.totalAssignments > 0 ? (
              <div className="flex items-center space-x-3 text-xs">
                {/* Pending Count */}
                <div className="flex items-center space-x-1">
                  <Users className="h-3 w-3 text-orange-500" />
                  <span className="text-muted-foreground">{playlist.pendingCount}</span>
                  <span className="text-muted-foreground/60">{t('contentAuthoring.pending')}</span>
                </div>

                {/* Separator */}
                <span className="text-muted-foreground/40">•</span>

                {/* Completed Count */}
                <div className="flex items-center space-x-1">
                  <Users className="h-3 w-3 text-green-500" />
                  <span className="text-muted-foreground">{playlist.completedCount}</span>
                  <span className="text-muted-foreground/60">{t('contentAuthoring.completed')}</span>
                </div>

                {/* Separator */}
                <span className="text-muted-foreground/40">•</span>

                {/* Progress Bar */}
                <div className="flex-1 flex items-center space-x-2">
                  <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${playlist.progressPercent}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground/80 tabular-nums">
                    {playlist.progressPercent}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-xs text-muted-foreground/60">
                <Users className="h-3 w-3" />
                <span>{t('contentAuthoring.noAssignmentsYet')}</span>
              </div>
            )}
          </div>
        ))}

        {/* Summary Footer */}
        {playlists.length > 0 && (
          <div className="pt-3 mt-3 border-t border-border">
            <p className="text-xs text-center text-muted-foreground">
              {t('contentAuthoring.assignedToPlaylists', { count: playlists.length })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}