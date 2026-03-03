import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  Calendar,
  ChevronRight,
  Building2,
  Clock,
  Zap,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import { STAGE_CONFIG, PIPELINE_STAGES, type DealStage, type Deal, type PipelineSummary } from './types';
import type { TrikeAdminView } from './TrikeAdminPage';
import {
  getPipelineSummary,
  getPipelineMetrics,
  getDeals,
  getUpcomingActions
} from '../../lib/crud/deals';

interface DealDashboardProps {
  onNavigate: (view: TrikeAdminView) => void;
  onProvisionDemo?: (orgId: string, orgName: string) => void;
}

export function DealDashboard({ onNavigate, onProvisionDemo }: DealDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PipelineSummary[]>([]);
  const [metrics, setMetrics] = useState({
    totalValue: 0,
    weightedValue: 0,
    totalDeals: 0,
    avgDealSize: 0,
    totalMrr: 0
  });
  const [recentDeals, setRecentDeals] = useState<Deal[]>([]);
  const [upcomingActions, setUpcomingActions] = useState<Deal[]>([]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [
          summaryData,
          metricsData,
          recentDealsData,
          upcomingActionsData
        ] = await Promise.all([
          getPipelineSummary(),
          getPipelineMetrics(),
          getDeals({ limit: 5 }),
          getUpcomingActions(14)
        ]);

        setSummary(summaryData);
        setMetrics(metricsData);
        setRecentDeals(recentDealsData);
        setUpcomingActions(upcomingActionsData);
      } catch (error) {
        console.error('Error loading sales dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sales Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              Track and manage your prospect-to-client pipeline
            </p>
          </div>
          <Button onClick={() => onNavigate('pipeline')}>
            <TrendingUp className="h-4 w-4 mr-2" />
            View Pipeline Board
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <MetricCard
            title="Total Pipeline"
            value={formatCurrency(metrics.totalValue)}
            icon={DollarSign}
            description="Active deal value"
            loading={loading}
          />
          <MetricCard
            title="Weighted Pipeline"
            value={formatCurrency(metrics.weightedValue)}
            icon={TrendingUp}
            description="Probability-adjusted"
            loading={loading}
          />
          <MetricCard
            title="Active Deals"
            value={metrics.totalDeals.toString()}
            icon={Building2}
            description="In pipeline"
            loading={loading}
          />
          <MetricCard
            title="Avg. Deal Size"
            value={formatCurrency(metrics.avgDealSize)}
            icon={Users}
            description="Per deal"
            loading={loading}
          />
        </div>

        {/* Pipeline Stages */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Pipeline by Stage</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('pipeline')}
              >
                View all
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {PIPELINE_STAGES.map((stage) => {
                const stageData = summary.find(
                  (s) => s.stage === stage
                );
                const config = STAGE_CONFIG[stage];
                return (
                  <div
                    key={stage}
                    className={cn(
                      'p-4 rounded-lg border-2',
                      config.bgColor,
                      config.borderColor,
                      loading && 'animate-pulse opacity-50'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn('text-sm font-medium', config.color)}>
                        {config.label}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {stageData?.deal_count || 0}
                      </Badge>
                    </div>
                    <div className={cn('text-2xl font-bold', config.color)}>
                      {formatCurrency(stageData?.total_value || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatCurrency(stageData?.total_mrr || 0)}/mo MRR
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Two column layout */}
        <div className="grid grid-cols-2 gap-6">
          {/* Recent Deals */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Recent Deals</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate('pipeline')}
                >
                  View all
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loading ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                  ))
                ) : recentDeals.length > 0 ? (
                  recentDeals.map((deal) => {
                    const config = STAGE_CONFIG[deal.stage!];
                    return (
                      <div
                        key={deal.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'h-10 w-10 rounded-lg flex items-center justify-center',
                              config.bgColor
                            )}
                          >
                            <Building2 className={cn('h-5 w-5', config.color)} />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{deal.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {deal.organization?.name}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-4">
                          <div>
                            <div className="font-semibold text-sm">
                              {formatCurrency(deal.value || 0)}
                            </div>
                            <Badge
                              variant="outline"
                              className={cn('text-xs', config.color)}
                            >
                              {config.label}
                            </Badge>
                          </div>
                          {deal.stage === 'evaluating' && onProvisionDemo && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 border-primary/30 hover:border-primary hover:bg-primary/5 text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                onProvisionDemo(deal.organization_id, deal.organization?.name || deal.name);
                              }}
                            >
                              <Zap className="h-3.5 w-3.5" />
                              Demo
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No recent deals
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Actions */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Upcoming Actions</CardTitle>
                <Button variant="ghost" size="sm">
                  View calendar
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loading ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                  ))
                ) : upcomingActions.length > 0 ? (
                  upcomingActions.map((deal) => {
                    const daysUntil = deal.next_action_date ?
                      Math.ceil((new Date(deal.next_action_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

                    return (
                      <div
                        key={deal.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{deal.next_action}</div>
                            <div className="text-xs text-muted-foreground">
                              {deal.name}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {daysUntil === 0
                              ? 'Today'
                              : daysUntil === 1
                              ? 'Tomorrow'
                              : daysUntil < 0
                              ? 'Overdue'
                              : `${daysUntil} days`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {deal.next_action_date ? formatDate(deal.next_action_date) : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No upcoming actions
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Helper components and functions

function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  loading = false,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  loading?: boolean;
}) {
  return (
    <Card className={cn(loading && 'animate-pulse opacity-70')}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xs text-muted-foreground">{title}</span>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
