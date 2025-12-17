import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ArrowRight, ArrowLeft, ExternalLink } from 'lucide-react';
import * as trackRelCrud from '../../lib/crud/trackRelationships';
import type { TrackRelationship } from '../../lib/crud/trackRelationships';

interface TrackRelationshipsProps {
  trackId: string;
  trackType: string;
  onNavigateToTrack?: (trackId: string) => void;
}

export function TrackRelationships({ trackId, trackType, onNavigateToTrack }: TrackRelationshipsProps) {
  const [sourceTrack, setSourceTrack] = useState<TrackRelationship | null>(null);
  const [derivedTracks, setDerivedTracks] = useState<TrackRelationship[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRelationships();
  }, [trackId]);

  async function loadRelationships() {
    setIsLoading(true);
    try {
      console.log(`🔍 [TrackRelationships] Loading relationships for trackId: ${trackId}`);
      
      // Fetch source track (parent)
      const source = await trackRelCrud.getSourceTrack(trackId, 'source');
      console.log(`📊 [TrackRelationships] Source track:`, source);
      setSourceTrack(source);

      // Fetch derived tracks (children)
      const derived = await trackRelCrud.getDerivedTracks(trackId, 'source');
      console.log(`📊 [TrackRelationships] Derived tracks:`, derived, `(count: ${derived?.length || 0})`);
      setDerivedTracks(derived || []);
    } catch (error) {
      console.error('❌ [TrackRelationships] Error loading track relationships:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Don't render if no relationships
  if (!isLoading && !sourceTrack && derivedTracks.length === 0) {
    return null;
  }

  const getTrackTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      article: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
      video: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400',
      story: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400',
      checkpoint: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400',
    };

    return (
      <Badge variant="outline" className={`capitalize ${colors[type] || ''}`}>
        {type}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      published: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400',
      draft: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400',
      archived: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400',
    };

    return (
      <Badge variant="outline" className={`capitalize ${colors[status] || ''}`}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Source Track (Parent) */}
      {sourceTrack?.source_track && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Sourced From
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="flex items-start gap-3 p-3 rounded-lg border bg-accent/30 hover:bg-accent/50 transition-all cursor-pointer"
              onClick={() => onNavigateToTrack && onNavigateToTrack(sourceTrack.source_track!.id)}
            >
              {sourceTrack.source_track.thumbnail_url && (
                <img
                  src={sourceTrack.source_track.thumbnail_url}
                  alt=""
                  className="size-16 rounded object-cover shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="truncate font-medium">{sourceTrack.source_track.title}</h4>
                    <div className="flex items-center gap-2 mt-2">
                      {getTrackTypeBadge(sourceTrack.source_track.type)}
                      {getStatusBadge(sourceTrack.source_track.status)}
                    </div>
                  </div>
                  {onNavigateToTrack && (
                    <ExternalLink className="size-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Derived Tracks (Children) */}
      {derivedTracks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <ArrowRight className="h-4 w-4 mr-2" />
              Used as Source For ({derivedTracks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {derivedTracks.map((rel) => (
              <div
                key={rel.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-white dark:bg-accent/20 hover:bg-accent/50 transition-all cursor-pointer"
                onClick={() => onNavigateToTrack && rel.derived_track && onNavigateToTrack(rel.derived_track.id)}
              >
                {rel.derived_track?.thumbnail_url && (
                  <img
                    src={rel.derived_track.thumbnail_url}
                    alt=""
                    className="size-12 rounded object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm truncate font-medium">{rel.derived_track?.title}</h4>
                      <div className="flex items-center gap-2 mt-2">
                        {rel.derived_track && getTrackTypeBadge(rel.derived_track.type)}
                        {rel.derived_track && getStatusBadge(rel.derived_track.status)}
                      </div>
                    </div>
                    {onNavigateToTrack && rel.derived_track && (
                      <ExternalLink className="size-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}