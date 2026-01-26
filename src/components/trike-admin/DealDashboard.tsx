import React from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Building2,
  Clock,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import { TrikeAdminView } from './TrikeAdminLayout';
import { STAGE_CONFIG, PIPELINE_STAGES, type DealStage, type Deal } from './types';

interface DealDashboardProps {
  onNavigate: (view: TrikeAdminView) => void;
}

// Mock data for development - will be replaced with real API calls
const mockPipelineSummary = [
  { stage: 'lead' as DealStage, count: 8, value: 45000, mrr: 3200 },
  { stage: 'prospect' as DealStage, count: 12, value: 156000, mrr: 11200 },
  { stage: 'evaluating' as DealStage, count: 6, value: 234000, mrr: 16800 },
  { stage: 'closing' as DealStage, count: 3, value: 89000, mrr: 6400 },
];

const mockRecentDeals: Partial<Deal>[] = [
  {
    id: '1',
    name: 'QuikTrip - Initial Contract',
    stage: 'closing',
    value: 45000,
    mrr: 3200,
    probability: 80,
    expected_close_date: '2026-02-15',
    organization: {
      id: 'org-1',
      name: 'QuikTrip',
      industry: 'convenience_retail',
    } as any,
  },
  {
    id: '2',
    name: "Casey's General - Expansion",
    stage: 'evaluating',
    value: 78000,
    mrr: 5600,
    probability: 60,
    expected_close_date: '2026-03-01',
    organization: {
      id: 'org-2',
      name: "Casey's General Stores",
      industry: 'convenience_retail',
    } as any,
  },
  {
    id: '3',
    name: 'Wawa - Pilot Program',
    stage: 'prospect',
    value: 32000,
    mrr: 2300,
    probability: 40,
    expected_close_date: '2026-03-15',
    organization: {
      id: 'org-3',
      name: 'Wawa',
      industry: 'convenience_retail',
    } as any,
  },
  {
    id: '4',
    name: 'RaceTrac - Enterprise',
    stage: 'prospect',
    value: 125000,
    mrr: 8900,
    probability: 35,
    expected_close_date: '2026-04-01',
    organization: {
      id: 'org-4',
      name: 'RaceTrac',
      industry: 'convenience_retail',
    } as any,
  },
];

const mockUpcomingActions = [
  {
    id: '1',
    deal: 'QuikTrip',
    action: 'Send revised proposal',
    date: '2026-01-28',
    daysUntil: 2,
  },
  {
    id: '2',
    deal: "Casey's General",
    action: 'Schedule demo call',
    date: '2026-01-29',
    daysUntil: 3,
  },
  {
    id: '3',
    deal: 'Wawa',
    action: 'Follow up on ROI analysis',
    date: '2026-01-30',
    daysUntil: 4,
  },
];

export function DealDashboard({ onNavigate }: DealDashboardProps) {
  const totalPipelineValue = mockPipelineSummary.reduce(
    (sum, s) => sum + s.value,
    0
  );
  const totalDeals = mockPipelineSummary.reduce((sum, s) => sum + s.count, 0);
  const weightedValue = mockPipelineSummary.reduce(
    (sum, s) => sum + s.value * (getDefaultProbability(s.stage) / 100),
    0
  );

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
            value={formatCurrency(totalPipelineValue)}
            change={12}
            icon={DollarSign}
            description="Active deal value"
          />
          <MetricCard
            title="Weighted Pipeline"
            value={formatCurrency(weightedValue)}
            change={8}
            icon={TrendingUp}
            description="Probability-adjusted"
          />
          <MetricCard
            title="Active Deals"
            value={totalDeals.toString()}
            change={3}
            icon={Building2}
            description="In pipeline"
          />
          <MetricCard
            title="Avg. Deal Size"
            value={formatCurrency(totalPipelineValue / totalDeals)}
            change={-2}
            icon={Users}
            description="Per deal"
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
                const stageData = mockPipelineSummary.find(
                  (s) => s.stage === stage
                );
                const config = STAGE_CONFIG[stage];
                return (
                  <div
                    key={stage}
                    className={cn(
                      'p-4 rounded-lg border-2',
                      config.bgColor,
                      config.borderColor
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn('text-sm font-medium', config.color)}>
                        {config.label}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {stageData?.count || 0}
                      </Badge>
                    </div>
                    <div className={cn('text-2xl font-bold', config.color)}>
                      {formatCurrency(stageData?.value || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatCurrency(stageData?.mrr || 0)}/mo MRR
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
                {mockRecentDeals.map((deal) => {
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
                      <div className="text-right">
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
                    </div>
                  );
                })}
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
                {mockUpcomingActions.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{action.action}</div>
                        <div className="text-xs text-muted-foreground">
                          {action.deal}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {action.daysUntil === 0
                          ? 'Today'
                          : action.daysUntil === 1
                          ? 'Tomorrow'
                          : `${action.daysUntil} days`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(action.date)}
                      </div>
                    </div>
                  </div>
                ))}
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
  change,
  icon: Icon,
  description,
}: {
  title: string;
  value: string;
  change: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}) {
  const isPositive = change >= 0;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div
            className={cn(
              'flex items-center text-xs font-medium',
              isPositive ? 'text-green-600' : 'text-red-600'
            )}
          >
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(change)}%
          </div>
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

function getDefaultProbability(stage: DealStage): number {
  const probabilities: Record<DealStage, number> = {
    lead: 10,
    prospect: 25,
    evaluating: 50,
    closing: 75,
    won: 100,
    lost: 0,
    frozen: 0,
  };
  return probabilities[stage];
}
