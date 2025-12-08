import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Link2, ArrowRight, ArrowLeft, ExternalLink } from 'lucide-react';
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
      // Fetch source track (parent)
      const source = await trackRelCrud.getSourceTrack(trackId, 'source');
      setSourceTrack(source);

      // Fetch derived tracks (children)
      const derived = await trackRelCrud.getDerivedTracks(trackId, 'source');
      setDerivedTracks(derived);
    } catch (error) {
      console.error('Error loading track relationships:', error);
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
      article: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      video: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      story: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      checkpoint: 'bg-green-500/10 text-green-600 border-green-500/20',
    };

    return (
      <Badge variant="outline" className={`capitalize ${colors[type] || ''}`}>
        {type}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      published: 'bg-green-500/10 text-green-600 border-green-500/20',
      draft: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
      archived: 'bg-red-500/10 text-red-600 border-red-500/20',
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
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ArrowLeft className="size-4 text-blue-600" />
              <CardTitle className="text-sm font-bold">Sourced From</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              {sourceTrack.source_track.thumbnail_url && (
                <img
                  src={sourceTrack.source_track.thumbnail_url}
                  alt=""
                  className="size-16 rounded object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="truncate">{sourceTrack.source_track.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      {getTrackTypeBadge(sourceTrack.source_track.type)}
                      {getStatusBadge(sourceTrack.source_track.status)}
                    </div>
                  </div>
                  {onNavigateToTrack && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavigateToTrack(sourceTrack.source_track!.id)}
                      className="shrink-0"
                    >
                      <ExternalLink className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Derived Tracks (Children) */}
      {derivedTracks.length > 0 && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ArrowRight className="size-4 text-green-600" />
              <CardTitle className="text-sm font-bold">
                Used as Source For ({derivedTracks.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {derivedTracks.map((rel) => (
              <div
                key={rel.id}
                className="flex items-start gap-3 p-2 rounded border border-green-200/50 bg-white"
              >
                {rel.derived_track?.thumbnail_url && (
                  <img
                    src={rel.derived_track.thumbnail_url}
                    alt=""
                    className="size-12 rounded object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm truncate">{rel.derived_track?.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        {rel.derived_track && getTrackTypeBadge(rel.derived_track.type)}
                        {rel.derived_track && getStatusBadge(rel.derived_track.status)}
                      </div>
                    </div>
                    {onNavigateToTrack && rel.derived_track && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onNavigateToTrack(rel.derived_track!.id)}
                        className="shrink-0"
                      >
                        <ExternalLink className="size-4" />
                      </Button>
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
