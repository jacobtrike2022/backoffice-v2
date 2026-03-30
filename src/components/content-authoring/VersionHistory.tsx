import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  History, 
  ChevronRight, 
  Calendar, 
  FileText,
  Eye,
  CheckCircle
} from 'lucide-react';
import * as crud from '../../lib/crud/tracks';

interface VersionHistoryProps {
  trackId: string;
  currentVersion?: number;
  onVersionClick?: (versionTrackId: string) => void;
}

export function VersionHistory({
  trackId,
  currentVersion,
  onVersionClick
}: VersionHistoryProps) {
  const { t } = useTranslation();
  const [versions, setVersions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (trackId) {
      loadVersions();
    }
  }, [trackId]);

  const loadVersions = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const versionsData = await crud.getTrackVersions(trackId);
      setVersions(versionsData);
    } catch (error: any) {
      console.error('VersionHistory: Error loading versions:', error);
      setHasError(true);
      setVersions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Single stable Card shell — avoids replacing the whole subtree when loading finishes (reduces
  // removeChild conflicts with sibling TrackRelationships and portaled dialogs).
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center">
          <History className="h-4 w-4 mr-2" />
          {t('contentAuthoring.versionHistory')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t('contentAuthoring.loadingVersions')}</p>
          </div>
        ) : hasError ? (
          <div className="text-center py-6">
            <History className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t('contentAuthoring.errorLoadingVersions')}</p>
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-6">
            <History className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t('contentAuthoring.noVersionHistory')}</p>
          </div>
        ) : (
          <>
        {versions.map((version, index) => {
          const isLatest = version.is_latest_version;
          const isCurrent = version.version_number === currentVersion;
          const isOld = !isLatest && !isCurrent;

          return (
            <div key={version.id}>
              <div 
                className={`p-3 rounded-lg border transition-all ${
                  isLatest 
                    ? 'bg-primary/5 border-primary/20' 
                    : 'bg-accent/30 border-border hover:bg-accent/50'
                } ${onVersionClick ? 'cursor-pointer' : ''}`}
                onClick={() => onVersionClick && onVersionClick(version.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant={isLatest ? 'default' : 'outline'}
                      className={isLatest ? 'bg-primary' : ''}
                    >
                      V{version.version_number}
                    </Badge>
                    {isLatest && (
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {t('contentAuthoring.versionCurrent')}
                      </Badge>
                    )}
                  </div>
                  {onVersionClick && !isLatest && (
                    <Button variant="ghost" size="sm" className="h-6 px-2">
                      <Eye className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-start space-x-2">
                    <Calendar className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      {new Date(version.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  {version.version_notes && (
                    <div className="flex items-start space-x-2">
                      <FileText className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground leading-relaxed">
                        {version.version_notes}
                      </span>
                    </div>
                  )}

                  {isOld && versions[index + 1] && (
                    <div className="pt-1 mt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground italic">
                        Replaced by V{versions[index + 1].version_number} on{' '}
                        {new Date(versions[index + 1].created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {index < versions.length - 1 && (
                <div className="flex justify-center py-1">
                  <ChevronRight className="h-4 w-4 text-muted-foreground transform rotate-90" />
                </div>
              )}
            </div>
          );
        })}

        {versions.length > 1 && (
          <div className="pt-3 mt-3 border-t border-border">
            <p className="text-xs text-center text-muted-foreground">
              {t('contentAuthoring.versionTotal', { count: versions.length })}
            </p>
          </div>
        )}
          </>
        )}
      </CardContent>
    </Card>
  );
}