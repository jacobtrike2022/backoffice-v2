import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ArrowRight, ArrowLeft, ExternalLink, GitBranch, MapPin, Building2, Store } from 'lucide-react';
import * as trackRelCrud from '../../lib/crud/trackRelationships';
import { getEffectiveThumbnailUrl } from '../../lib/crud/tracks';
import type { TrackRelationship, VariantType } from '../../lib/crud/trackRelationships';

interface TrackRelationshipsProps {
  trackId: string;
  trackType: string;
  onNavigateToTrack?: (trackId: string) => void;
}

export function TrackRelationships({ trackId, trackType, onNavigateToTrack }: TrackRelationshipsProps) {
  const { t } = useTranslation();
  const [sourceTracks, setSourceTracks] = useState<TrackRelationship[]>([]);
  const [derivedTracks, setDerivedTracks] = useState<TrackRelationship[]>([]);
  const [variants, setVariants] = useState<TrackRelationship[]>([]);
  const [baseTrack, setBaseTrack] = useState<TrackRelationship | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const navigateToTrackPage = (id: string, type?: string | null) => {
    if (onNavigateToTrack) {
      onNavigateToTrack(id);
      return;
    }

    const resolvedType = (type || '').toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const demoOrgId = params.get('demo_org_id');
    const withDemo = (path: string) => {
      if (!demoOrgId) return path;
      const next = new URLSearchParams();
      next.set('demo_org_id', demoOrgId);
      return `${path}?${next.toString()}`;
    };
    // Keep routes consistent with the rest of the app (see VersionHistory fallbacks).
    switch (resolvedType) {
      case 'article':
        window.location.href = withDemo(`/article/${id}`);
        return;
      case 'video':
        window.location.href = withDemo(`/video/${id}`);
        return;
      case 'story':
        window.location.href = withDemo(`/story/${id}`);
        return;
      case 'checkpoint':
        window.location.href = withDemo(`/checkpoint/${id}`);
        return;
      default:
        // Best-effort fallback; most variant source tracks are articles.
        window.location.href = withDemo(`/article/${id}`);
    }
  };

  useEffect(() => {
    loadRelationships();
  }, [trackId]);

  async function loadRelationships() {
    setIsLoading(true);
    try {
      console.log(`[TrackRelationships] Loading relationships for trackId: ${trackId}`);

      // Fetch source tracks (parents) - supports multiple sources
      const sources = await trackRelCrud.getSourceTracks(trackId, 'source');
      console.log(`[TrackRelationships] Source tracks:`, sources, `(count: ${sources?.length || 0})`);
      setSourceTracks(sources || []);

      // Fetch derived tracks (children)
      const derived = await trackRelCrud.getDerivedTracks(trackId, 'source');
      console.log(`[TrackRelationships] Derived tracks:`, derived, `(count: ${derived?.length || 0})`);
      setDerivedTracks(derived || []);

      // Fetch variants (where this track is source, relationship_type = 'variant')
      try {
        const variantsData = await trackRelCrud.getTrackVariants(trackId);
        console.log(`[TrackRelationships] Variants:`, variantsData, `(count: ${variantsData?.length || 0})`);
        setVariants(variantsData || []);
      } catch (variantError) {
        console.log('[TrackRelationships] Variants endpoint not available yet');
        setVariants([]);
      }

      // Fetch base track (if this track is a variant)
      try {
        const baseData = await trackRelCrud.getBaseTrackForVariant(trackId);
        console.log(`[TrackRelationships] Base track:`, baseData);
        setBaseTrack(baseData);
      } catch (baseError) {
        console.log('[TrackRelationships] Base track endpoint not available yet');
        setBaseTrack(null);
      }
    } catch (error) {
      console.error('[TrackRelationships] Error loading track relationships:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Keep a stable wrapper when there is nothing to show (do not return null — unmounting this
  // sibling while VersionHistory finishes loading caused React/Radix removeChild errors in production).
  const hasAnyRelationships =
    sourceTracks.length > 0 ||
    derivedTracks.length > 0 ||
    variants.length > 0 ||
    !!baseTrack;
  if (!isLoading && !hasAnyRelationships) {
    return <div className="space-y-4" aria-hidden />;
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

  const getVariantTypeBadge = (variantType?: VariantType | null) => {
    if (!variantType) return null;

    const config: Record<VariantType, { Icon: React.ElementType; label: string; className: string }> = {
      geographic: {
        Icon: MapPin,
        label: t('contentAuthoring.variantTypeGeographic'),
        className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      },
      company: {
        Icon: Building2,
        label: t('contentAuthoring.variantTypeCompany'),
        className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      },
      unit: {
        Icon: Store,
        label: t('contentAuthoring.variantTypeUnit'),
        className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
      },
    };

    const typeConfig = config[variantType];
    if (!typeConfig) return null;

    const { Icon, label, className } = typeConfig;

    return (
      <Badge variant="outline" className={className}>
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    );
  };

  const getVariantContextBadge = (rel: TrackRelationship) => {
    if (!rel.variant_type || !rel.variant_context) return null;

    switch (rel.variant_type) {
      case 'geographic':
        return rel.variant_context.state_name || rel.variant_context.state_code ? (
          <Badge variant="outline" className="text-xs">
            {rel.variant_context.state_name || rel.variant_context.state_code}
          </Badge>
        ) : null;
      case 'company':
        return rel.variant_context.org_name ? (
          <Badge variant="outline" className="text-xs">
            {rel.variant_context.org_name}
          </Badge>
        ) : null;
      case 'unit':
        return rel.variant_context.store_name ? (
          <Badge variant="outline" className="text-xs">
            {rel.variant_context.store_name}
          </Badge>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Source Tracks (Parents) - supports multiple sources */}
      {sourceTracks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {sourceTracks.length > 1
                ? t('contentAuthoring.sourcedFromCount', { count: sourceTracks.length })
                : t('contentAuthoring.sourcedFrom')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sourceTracks.map((sourceRel) => (
              sourceRel.source_track && (
                <div
                  key={sourceRel.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${sourceTracks.length === 1 ? 'bg-accent/30' : 'bg-white dark:bg-accent/20'} hover:bg-accent/50 transition-all cursor-pointer`}
                  onClick={() => onNavigateToTrack && onNavigateToTrack(sourceRel.source_track!.id)}
                >
                  <img
                    src={getEffectiveThumbnailUrl(sourceRel.source_track.thumbnail_url)}
                    alt=""
                    className={`${sourceTracks.length === 1 ? 'size-16' : 'size-12'} rounded object-cover shrink-0`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className={`truncate font-medium ${sourceTracks.length > 1 ? 'text-sm' : ''}`}>{sourceRel.source_track.title}</h4>
                        <div className="flex items-center gap-2 mt-2">
                          {getTrackTypeBadge(sourceRel.source_track.type)}
                          {getStatusBadge(sourceRel.source_track.status)}
                        </div>
                      </div>
                      {onNavigateToTrack && (
                        <ExternalLink className="size-4 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              )
            ))}
          </CardContent>
        </Card>
      )}

      {/* Derived Tracks (Children) */}
      {derivedTracks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <ArrowRight className="h-4 w-4 mr-2" />
              {t('contentAuthoring.usedAsSourceFor', { count: derivedTracks.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {derivedTracks.map((rel) => (
              <div
                key={rel.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-white dark:bg-accent/20 hover:bg-accent/50 transition-all cursor-pointer"
                onClick={() => onNavigateToTrack && rel.derived_track && onNavigateToTrack(rel.derived_track.id)}
              >
                <img
                  src={getEffectiveThumbnailUrl(rel.derived_track?.thumbnail_url)}
                  alt=""
                  className="size-12 rounded object-cover shrink-0"
                />
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

      {/* Variants Section */}
      {variants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <GitBranch className="h-4 w-4 mr-2" />
              {t('contentAuthoring.variantsCount', { count: variants.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {variants.map((rel) => (
              <div
                key={rel.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-white dark:bg-accent/20 hover:bg-accent/50 transition-all cursor-pointer"
                onClick={() => onNavigateToTrack && rel.derived_track && onNavigateToTrack(rel.derived_track.id)}
              >
                <img
                  src={getEffectiveThumbnailUrl(rel.derived_track?.thumbnail_url)}
                  alt=""
                  className="size-12 rounded object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm truncate font-medium">{rel.derived_track?.title}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {getVariantTypeBadge(rel.variant_type)}
                        {getVariantContextBadge(rel)}
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

      {/* Base Track Section (if this is a variant) */}
      {baseTrack?.source_track && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('contentAuthoring.variantOf')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('contentAuthoring.thisIsA')}</span>
              {getVariantTypeBadge(baseTrack.variant_type)}
              <span className="text-sm text-muted-foreground">{t('contentAuthoring.variantLabel')}</span>
              {getVariantContextBadge(baseTrack)}
            </div>
            <div
              className="flex items-start gap-3 p-3 rounded-lg border bg-accent/30 hover:bg-accent/50 transition-all cursor-pointer"
              onClick={() => {
                if (!baseTrack.source_track) return;
                navigateToTrackPage(baseTrack.source_track.id, baseTrack.source_track.type);
              }}
            >
              <img
                src={getEffectiveThumbnailUrl(baseTrack.source_track.thumbnail_url)}
                alt=""
                className="size-16 rounded object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="truncate font-medium">{baseTrack.source_track.title}</h4>
                    <div className="flex items-center gap-2 mt-2">
                      {getTrackTypeBadge(baseTrack.source_track.type)}
                      {getStatusBadge(baseTrack.source_track.status)}
                    </div>
                  </div>
                  {(baseTrack.source_track?.id || onNavigateToTrack) && (
                    <ExternalLink className="size-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}