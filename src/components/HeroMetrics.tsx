import React from 'react';
import { Card, CardContent } from './ui/card';
import { TrendingUp, TrendingDown, Minus, Users, CheckCircle, AlertTriangle, Building, Target, Activity } from 'lucide-react';

type UserRole = 'admin' | 'district-manager' | 'store-manager';

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
  const getMetricsForRole = (): HeroMetric[] => {
    if (currentRole === 'admin') {
      return [
        {
          id: 'employees',
          title: 'Active Employees',
          value: '142',
          subtitle: 'Across 12 units',
          trend: { value: 8, type: 'increase', period: 'vs last month' },
          status: 'good',
          icon: Users,
          isHero: true
        },
        {
          id: 'compliance',
          title: 'Compliance Rate',
          value: '94%',
          subtitle: 'System-wide',
          trend: { value: 3, type: 'increase', period: 'vs last quarter' },
          status: 'good',
          icon: CheckCircle,
          isHero: true
        },
        {
          id: 'completion',
          title: 'Avg Completion',
          value: '87%',
          subtitle: 'All assignments',
          trend: { value: 5, type: 'increase', period: 'vs last month' },
          status: 'good',
          icon: Target,
          isHero: true
        },
        {
          id: 'at-risk',
          title: 'At-Risk Units',
          value: '2',
          subtitle: 'Need attention',
          trend: { value: 1, type: 'decrease', period: 'vs last week' },
          status: 'warning',
          icon: AlertTriangle,
          isHero: true
        }
      ];
    }

    if (currentRole === 'district-manager') {
      return [
        {
          id: 'employees',
          title: 'District Employees',
          value: '78',
          subtitle: 'Across 5 units',
          trend: { value: 5, type: 'increase', period: 'vs last month' },
          status: 'good',
          icon: Users,
          isHero: true
        },
        {
          id: 'performance',
          title: 'Performance',
          value: '89%',
          subtitle: 'Completion rate',
          trend: { value: 7, type: 'increase', period: 'vs avg' },
          status: 'good',
          icon: Target,
          isHero: true
        },
        {
          id: 'compliance',
          title: 'Compliance',
          value: '92%',
          subtitle: 'District-wide',
          trend: { value: 3, type: 'increase', period: 'vs target' },
          status: 'good',
          icon: CheckCircle,
          isHero: true
        },
        {
          id: 'units',
          title: 'Units Status',
          value: '3/5',
          subtitle: 'Exceeding goals',
          trend: { value: 0, type: 'neutral', period: 'stable' },
          status: 'good',
          icon: Building,
          isHero: true
        }
      ];
    }

    // Store Manager
    return [
      {
        id: 'team',
        title: 'Team Members',
        value: '24',
        subtitle: 'Active today',
        trend: { value: 2, type: 'increase', period: 'vs yesterday' },
        status: 'good',
        icon: Users,
        isHero: true
      },
      {
        id: 'completion',
        title: 'Completion Rate',
        value: '92%',
        subtitle: 'This week',
        trend: { value: 8, type: 'increase', period: 'vs last week' },
        status: 'good',
        icon: CheckCircle,
        isHero: true
      },
      {
        id: 'activity',
        title: 'Activity Score',
        value: '85',
        subtitle: 'Team engagement',
        trend: { value: 12, type: 'increase', period: 'vs average' },
        status: 'good',
        icon: Activity,
        isHero: true
      },
      {
        id: 'pending',
        title: 'Pending Tasks',
        value: '3',
        subtitle: 'Require action',
        trend: { value: 2, type: 'decrease', period: 'vs yesterday' },
        status: 'warning',
        icon: AlertTriangle,
        isHero: true
      }
    ];
  };

  const metrics = getMetricsForRole();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {metrics.map((metric) => {
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
      })}
    </div>
  );
}