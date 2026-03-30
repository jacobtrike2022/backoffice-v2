import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { 
  CheckCircle, 
  Play, 
  Star,
  Activity
} from 'lucide-react';
import { getRecentActivity } from '../lib/crud';
import { useEffectiveOrgId } from '../lib/hooks/useSupabase';

interface ActivityFeedProps {
  currentRole: 'admin' | 'district-manager' | 'store-manager';
  onNavigateToUnits?: (storeId?: string) => void;
}

export function ActivityFeed({ currentRole, onNavigateToUnits }: ActivityFeedProps) {
  const { t } = useTranslation();
  const { orgId: effectiveOrgId } = useEffectiveOrgId();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivities() {
      if (!effectiveOrgId) return;
      
      try {
        const data = await getRecentActivity(effectiveOrgId, 10);
        setActivities(data || []);
      } catch (error) {
        console.error('Error fetching activities:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchActivities();
  }, [effectiveOrgId]);

  const getJobTitleColor = (jobTitle: string) => {
    switch (jobTitle?.toLowerCase()) {
      case 'store manager':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'assistant manager':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'sales associate':
        return 'bg-green-50 text-green-700 border-green-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getActivityIcon = (action: string) => {
    if (action?.includes('completed') || action?.includes('completion')) {
      return <CheckCircle className="h-4 w-4" />;
    }
    if (action?.includes('started') || action?.includes('assigned')) {
      return <Play className="h-4 w-4" />;
    }
    if (action?.includes('certification') || action?.includes('achievement')) {
      return <Star className="h-4 w-4" />;
    }
    return <CheckCircle className="h-4 w-4" />;
  };

  const getBorderColor = (action: string) => {
    if (action?.includes('completed') || action?.includes('completion')) {
      return 'border-l-green-500';
    }
    if (action?.includes('started') || action?.includes('assigned')) {
      return 'border-l-blue-500';
    }
    if (action?.includes('certification') || action?.includes('achievement')) {
      return 'border-l-yellow-500';
    }
    return 'border-l-gray-300';
  };

  const getInitials = (firstName: string, lastName: string) => {
    if (!firstName && !lastName) return '??';
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return `${first}${last}`.toUpperCase() || '??';
  };

  const getFullName = (firstName: string, lastName: string) => {
    return `${firstName || ''} ${lastName || ''}`.trim() || 'Unknown User';
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const getAvatarColor = (index: number) => {
    const colors = [
      'bg-orange-100 text-orange-700',
      'bg-red-100 text-red-700',
      'bg-blue-100 text-blue-700',
      'bg-green-100 text-green-700',
      'bg-purple-100 text-purple-700'
    ];
    return colors[index % colors.length];
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{t('dashboard.activityFeed')}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {currentRole === 'admin' ? t('dashboard.recentActivityOrg') : currentRole === 'district-manager' ? t('dashboard.recentActivityDistrict') : t('dashboard.recentActivityStore')}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-xs"
            onClick={() => {
              if (onNavigateToUnits) {
                onNavigateToUnits();
              }
            }}
          >
            <Activity className="h-3.5 w-3.5 mr-1.5" />
            {t('common.viewAll')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {t('dashboard.noRecentActivity')}
          </div>
        ) : (
          <div className="space-y-0">
            {activities.map((activity, index) => (
              <div 
                key={activity.id} 
                className={`flex items-start gap-3 py-4 border-l-4 pl-3 ${getBorderColor(activity.action)} ${
                  index !== activities.length - 1 ? 'border-b border-border/30' : ''
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getActivityIcon(activity.action)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2.5 mb-1.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${getAvatarColor(index)}`}>
                          <span className="text-xs font-semibold">
                            {getInitials(activity.user?.first_name || '', activity.user?.last_name || '')}
                          </span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug">
                            <span className="font-semibold text-foreground">{getFullName(activity.user?.first_name || '', activity.user?.last_name || '')}</span>
                            {' '}
                            <span className="text-muted-foreground">{activity.action}</span>
                            {activity.entity_type && (
                              <>
                                {' '}
                                <span className="text-muted-foreground">({activity.entity_type})</span>
                              </>
                            )}
                          </p>
                          
                          <div className="flex items-center gap-2 mt-1.5">
                            {activity.user?.store?.name && (
                              <Badge variant="outline" className="text-xs px-2 py-0 h-5 bg-background">
                                {activity.user.store.name}
                              </Badge>
                            )}
                            {activity.user?.role?.name && (
                              <Badge variant="outline" className={`text-xs px-2 py-0 h-5 ${getJobTitleColor(activity.user.role.name)}`}>
                                {activity.user.role.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0 text-xs text-muted-foreground">
                      {getTimeAgo(activity.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}