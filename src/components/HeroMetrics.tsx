import React, { useEffect, useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Skeleton } from './ui/skeleton';
import { TrendingUp, TrendingDown, Minus, Users, CheckCircle, AlertTriangle, Building, Target, Activity } from 'lucide-react';
import { useEffectiveOrgId } from '../lib/hooks/useSupabase';
import { getOrganizationStats, getOrganizationStatsTrends } from '../lib/crud';

type UserRole = 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';

interface HeroMetric {
  id: string;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
    period: string;
  };
  status?: 'good' | 'warning' | 'danger';
  icon: React.ComponentType<any>;
  isHero?: boolean;
}

interface HeroMetricsProps {
  currentRole: UserRole;
}

const getTrendIcon = (type: 'increase' | 'decrease' | 'neutral') => {
  switch (type) {
    case 'increase':
      return <TrendingUp className="h-3.5 w-3.5" />;
    case 'decrease':
      return <TrendingDown className="h-3.5 w-3.5" />;
    default:
      return <Minus className="h-3.5 w-3.5" />;
  }
};

const getTrendColor = (type: 'increase' | 'decrease' | 'neutral', status?: 'good' | 'warning' | 'danger') => {
  // For metrics where decrease is good (like at-risk units)
  if (status === 'warning' && type === 'decrease') {
    return 'text-green-600 bg-green-50';
  }
  if (status === 'danger' && type === 'decrease') {
    return 'text-green-600 bg-green-50';
  }
  
  switch (type) {
    case 'increase':
      return 'text-green-600 bg-green-50';
    case 'decrease':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-500 bg-gray-50';
  }
};

export function HeroMetrics({ currentRole }: HeroMetricsProps) {
  const { orgId: effectiveOrgId } = useEffectiveOrgId();
  const [metrics, setMetrics] = useState<HeroMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      if (!effectiveOrgId) return;

      try {
        const stats = await getOrganizationStats(effectiveOrgId);
        const trends = await getOrganizationStatsTrends(effectiveOrgId, 30);

        // Calculate trend percentages
        const employeeTrend = trends.newEmployees > 0 ? Math.round((trends.newEmployees / stats.employeeCount) * 100) : 0;
        const completionTrend = stats.completedTracks > 0 ? 5 : 0; // Placeholder

        const metricsData = getMetricsForRole(currentRole, stats, {
          employeeTrend,
          completionTrend
        });
        
        setMetrics(metricsData);
      } catch (error) {
        console.error('Error fetching hero metrics:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, [effectiveOrgId, currentRole]);

  const getMetricsForRole = (
    role: UserRole, 
    stats: any,
    trends: { employeeTrend: number; completionTrend: number }
  ): HeroMetric[] => {
    if (role === 'admin') {
      return [
        {
          id: 'employees',
          title: 'Active Employees',
          value: stats.employeeCount.toString(),
          subtitle: `Across ${stats.storeCount} units`,
          trend: { value: trends.employeeTrend, type: trends.employeeTrend > 0 ? 'increase' : 'neutral', period: 'vs last month' },
          status: 'good',
          icon: Users,
          isHero: true
        },
        {
          id: 'compliance',
          title: 'Compliance Rate',
          value: `${stats.avgCompletion}%`,
          subtitle: 'System-wide',
          trend: { value: trends.completionTrend, type: trends.completionTrend > 0 ? 'increase' : 'neutral', period: 'vs last quarter' },
          status: stats.avgCompletion >= 90 ? 'good' : 'warning',
          icon: CheckCircle,
          isHero: true
        },
        {
          id: 'completion',
          title: 'Avg Completion',
          value: `${stats.avgCompletion}%`,
          subtitle: 'All assignments',
          trend: { value: trends.completionTrend, type: trends.completionTrend > 0 ? 'increase' : 'neutral', period: 'vs last month' },
          status: 'good',
          icon: Target,
          isHero: true
        },
        {
          id: 'at-risk',
          title: 'At-Risk Units',
          value: stats.atRiskStores.toString(),
          subtitle: 'Need attention',
          trend: { value: 0, type: 'neutral', period: 'vs last week' },
          status: stats.atRiskStores > 0 ? 'warning' : 'good',
          icon: AlertTriangle,
          isHero: true
        }
      ];
    } else if (role === 'district-manager') {
      return [
        {
          id: 'units',
          title: 'Units Managed',
          value: stats.storeCount.toString(),
          subtitle: 'Across district',
          trend: { value: 0, type: 'neutral', period: 'vs last month' },
          status: 'good',
          icon: Building,
          isHero: true
        },
        {
          id: 'employees',
          title: 'Team Members',
          value: stats.employeeCount.toString(),
          subtitle: 'Active employees',
          trend: { value: trends.employeeTrend, type: trends.employeeTrend > 0 ? 'increase' : 'neutral', period: 'vs last month' },
          status: 'good',
          icon: Users,
          isHero: true
        },
        {
          id: 'performance',
          title: 'District Performance',
          value: `${stats.avgCompletion}%`,
          subtitle: 'Average completion',
          trend: { value: trends.completionTrend, type: trends.completionTrend > 0 ? 'increase' : 'neutral', period: 'vs last month' },
          status: 'good',
          icon: Target,
          isHero: true
        },
        {
          id: 'at-risk',
          title: 'Needs Attention',
          value: stats.atRiskStores.toString(),
          subtitle: 'Units below target',
          trend: { value: 0, type: 'neutral', period: 'vs last week' },
          status: stats.atRiskStores > 0 ? 'warning' : 'good',
          icon: AlertTriangle,
          isHero: true
        }
      ];
    } else {
      // store-manager
      return [
        {
          id: 'team',
          title: 'Team Size',
          value: stats.employeeCount.toString(),
          subtitle: 'Active employees',
          trend: { value: trends.employeeTrend, type: trends.employeeTrend > 0 ? 'increase' : 'neutral', period: 'vs last month' },
          status: 'good',
          icon: Users,
          isHero: true
        },
        {
          id: 'completion',
          title: 'Store Completion',
          value: `${stats.avgCompletion}%`,
          subtitle: 'All assignments',
          trend: { value: trends.completionTrend, type: trends.completionTrend > 0 ? 'increase' : 'neutral', period: 'vs last week' },
          status: 'good',
          icon: Target,
          isHero: true
        },
        {
          id: 'active',
          title: 'Active Assignments',
          value: stats.activeAssignments.toString(),
          subtitle: 'In progress',
          trend: { value: 0, type: 'neutral', period: 'vs last week' },
          status: 'good',
          icon: Activity,
          isHero: true
        },
        {
          id: 'certifications',
          title: 'Certifications',
          value: stats.certificationCount.toString(),
          subtitle: 'Team certified',
          trend: { value: 0, type: 'neutral', period: 'vs last month' },
          status: 'good',
          icon: CheckCircle,
          isHero: true
        }
      ];
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {loading ? (
        Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="border-border/40 shadow-sm hover:shadow-md transition-all duration-200 bg-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-gray-100 text-gray-700">
                  <Skeleton className="h-5 w-5" />
                </div>
                
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full">
                  <Skeleton className="h-3.5 w-5" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        metrics.map((metric) => {
          const Icon = metric.icon;
          const trendColorClass = metric.trend ? getTrendColor(metric.trend.type, metric.status) : '';
          
          return (
            <Card 
              key={metric.id} 
              className="border-border/40 shadow-sm hover:shadow-md transition-all duration-200 bg-card"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-2.5 rounded-xl ${
                    metric.status === 'good' ? 'bg-primary/10 text-primary' :
                    metric.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                    metric.status === 'danger' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  
                  {metric.trend && (
                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${trendColorClass}`}>
                      {getTrendIcon(metric.trend.type)}
                      <span>
                        {metric.trend.value > 0 ? '+' : ''}{metric.trend.value}%
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-foreground leading-none">
                    {metric.value}
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground mt-2">
                    {metric.title}
                  </h3>
                  {metric.subtitle && (
                    <p className="text-xs text-muted-foreground/80">
                      {metric.subtitle}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}