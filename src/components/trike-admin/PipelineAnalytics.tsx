import React, { useEffect, useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  FunnelChart,
  Funnel,
  LabelList,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  Target,
  Clock,
  Award,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { cn } from '../ui/utils';

import {
  getPipelineSummary,
  getPipelineMetrics,
  getDeals,
  type Deal,
  type PipelineSummary,
  type DealStage,
} from '../../lib/crud/deals';
import { STAGE_CONFIG, PIPELINE_STAGES } from './types';

// ============================================================================
// TYPES
// ============================================================================

interface AnalyticsMetrics {
  totalPipelineValue: number;
  weightedValue: number;
  totalDeals: number;
  avgDealSize: number;
  totalMrr: number;
  winRate: number;
  lossRate: number;
  avgCycleTimeDays: number;
  wonDeals: number;
  lostDeals: number;
  frozenDeals: number;
}

// ============================================================================
// STAGE COLORS for charts
// ============================================================================

const STAGE_CHART_COLORS: Record<string, string> = {
  lead: '#64748b',
  prospect: '#f97316',
  evaluating: '#f59e0b',
  closing: '#10b981',
  won: '#059669',
  lost: '#ef4444',
  frozen: '#94a3b8',
};

const WIN_LOSS_COLORS = ['#10b981', '#ef4444', '#94a3b8'];

// ============================================================================
// COMPONENT
// ============================================================================

export function PipelineAnalytics() {
  const [loading, setLoading] = useState(true);
  const [pipelineSummary, setPipelineSummary] = useState<PipelineSummary[]>([]);
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [allDeals, setAllDeals] = useState<Deal[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const [summaryData, metricsData, dealsData] = await Promise.all([
        getPipelineSummary(),
        getPipelineMetrics(),
        getDeals(),
      ]);

      setPipelineSummary(summaryData);
      setAllDeals(dealsData);

      // Calculate win/loss/frozen stats from all deals
      const wonDeals = dealsData.filter((d) => d.stage === 'won');
      const lostDeals = dealsData.filter((d) => d.stage === 'lost');
      const frozenDeals = dealsData.filter((d) => d.stage === 'frozen');
      const closedDeals = wonDeals.length + lostDeals.length;
      const winRate = closedDeals > 0 ? (wonDeals.length / closedDeals) * 100 : 0;
      const lossRate = closedDeals > 0 ? (lostDeals.length / closedDeals) * 100 : 0;

      // Calculate average cycle time from won deals (created_at → actual_close_date)
      const cycleTimeDays = wonDeals
        .filter((d) => d.actual_close_date)
        .map((d) => {
          const created = new Date(d.created_at).getTime();
          const closed = new Date(d.actual_close_date!).getTime();
          return (closed - created) / (1000 * 60 * 60 * 24);
        });

      const avgCycleTimeDays =
        cycleTimeDays.length > 0
          ? cycleTimeDays.reduce((a, b) => a + b, 0) / cycleTimeDays.length
          : 0;

      setMetrics({
        totalPipelineValue: metricsData.totalValue,
        weightedValue: metricsData.weightedValue,
        totalDeals: metricsData.totalDeals,
        avgDealSize: metricsData.avgDealSize,
        totalMrr: metricsData.totalMrr,
        winRate,
        lossRate,
        avgCycleTimeDays,
        wonDeals: wonDeals.length,
        lostDeals: lostDeals.length,
        frozenDeals: frozenDeals.length,
      });
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  }

  // ── Derived chart data ──

  const funnelData = useMemo(() => {
    return PIPELINE_STAGES.map((stage) => {
      const summary = pipelineSummary.find((s) => s.stage === stage);
      return {
        name: STAGE_CONFIG[stage].label,
        value: summary?.deal_count || 0,
        totalValue: summary?.total_value || 0,
        fill: STAGE_CHART_COLORS[stage],
      };
    });
  }, [pipelineSummary]);

  const stageValueData = useMemo(() => {
    return PIPELINE_STAGES.map((stage) => {
      const summary = pipelineSummary.find((s) => s.stage === stage);
      return {
        stage: STAGE_CONFIG[stage].label,
        value: summary?.total_value || 0,
        weighted: summary?.weighted_value || 0,
      };
    });
  }, [pipelineSummary]);

  const winLossData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: 'Won', value: metrics.wonDeals, fill: WIN_LOSS_COLORS[0] },
      { name: 'Lost', value: metrics.lostDeals, fill: WIN_LOSS_COLORS[1] },
      { name: 'Frozen', value: metrics.frozenDeals, fill: WIN_LOSS_COLORS[2] },
    ].filter((d) => d.value > 0);
  }, [metrics]);

  const dealsByTypeData = useMemo(() => {
    const typeCounts: Record<string, { count: number; value: number }> = {};
    for (const d of allDeals) {
      const t = d.deal_type || 'new';
      if (!typeCounts[t]) typeCounts[t] = { count: 0, value: 0 };
      typeCounts[t].count++;
      typeCounts[t].value += d.value || 0;
    }
    return Object.entries(typeCounts).map(([type, data]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      count: data.count,
      value: data.value,
    }));
  }, [allDeals]);

  // ── Helpers ──

  const formatCurrency = (value: number): string => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatCurrencyFull = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // ── Loading State ──

  if (loading) {
    return (
      <div className="p-6 space-y-6 overflow-auto h-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4)
            .fill(0)
            .map((_, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="h-4 bg-muted rounded animate-pulse w-24 mb-3" />
                  <div className="h-7 bg-muted rounded animate-pulse w-32" />
                </CardContent>
              </Card>
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array(4)
            .fill(0)
            .map((_, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="h-4 bg-muted rounded animate-pulse w-40 mb-4" />
                  <div className="h-48 bg-muted rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 h-full">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold mb-1">No Data Available</h3>
          <p className="text-sm text-muted-foreground">
            Pipeline analytics will appear once deals are created.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Pipeline Value"
          value={formatCurrency(metrics.totalPipelineValue)}
          subtitle={`Weighted: ${formatCurrency(metrics.weightedValue)}`}
          icon={DollarSign}
          color="text-emerald-600 dark:text-emerald-400"
        />
        <KPICard
          title="Active Deals"
          value={metrics.totalDeals.toString()}
          subtitle={`Avg size: ${formatCurrency(metrics.avgDealSize)}`}
          icon={TrendingUp}
          color="text-blue-600 dark:text-blue-400"
        />
        <KPICard
          title="Win Rate"
          value={`${metrics.winRate.toFixed(0)}%`}
          subtitle={`${metrics.wonDeals} won / ${metrics.wonDeals + metrics.lostDeals} closed`}
          icon={Target}
          color={
            metrics.winRate >= 50
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-600 dark:text-amber-400'
          }
        />
        <KPICard
          title="Avg Cycle Time"
          value={
            metrics.avgCycleTimeDays > 0
              ? `${Math.round(metrics.avgCycleTimeDays)}d`
              : 'N/A'
          }
          subtitle={
            metrics.avgCycleTimeDays > 0
              ? `~${(metrics.avgCycleTimeDays / 7).toFixed(1)} weeks`
              : 'No closed deals yet'
          }
          icon={Clock}
          color="text-purple-600 dark:text-purple-400"
        />
      </div>

      {/* ── Charts Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Pipeline Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {funnelData.some((d) => d.value > 0) ? (
              <div className="space-y-3">
                {funnelData.map((stage, index) => {
                  const maxCount = Math.max(...funnelData.map((d) => d.value), 1);
                  const widthPct = (stage.value / maxCount) * 100;
                  return (
                    <div key={stage.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{stage.name}</span>
                        <span className="text-muted-foreground">
                          {stage.value} deal{stage.value !== 1 ? 's' : ''} &middot;{' '}
                          {formatCurrency(stage.totalValue)}
                        </span>
                      </div>
                      <div className="h-7 bg-muted rounded-md overflow-hidden">
                        <div
                          className="h-full rounded-md transition-all duration-500"
                          style={{
                            width: `${Math.max(widthPct, 4)}%`,
                            backgroundColor: stage.fill,
                            opacity: 0.8,
                          }}
                        />
                      </div>
                      {/* Conversion rate between stages */}
                      {index < funnelData.length - 1 && funnelData[index].value > 0 && (
                        <div className="flex justify-center py-0.5">
                          <span className="text-xs text-muted-foreground">
                            {funnelData[index + 1].value > 0
                              ? `${((funnelData[index + 1].value / funnelData[index].value) * 100).toFixed(0)}% conversion`
                              : '0% conversion'}
                            {' → '}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyChart message="No active pipeline deals" />
            )}
          </CardContent>
        </Card>

        {/* Value by Stage (Bar Chart) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Value by Stage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stageValueData.some((d) => d.value > 0 || d.weighted > 0) ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stageValueData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="stage"
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrency(v)}
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    width={60}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrencyFull(value),
                      name === 'value' ? 'Total Value' : 'Weighted Value',
                    ]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="value"
                    name="Total Value"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                  <Bar
                    dataKey="weighted"
                    name="Weighted Value"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    opacity={0.7}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No deal values to display" />
            )}
          </CardContent>
        </Card>

        {/* Win / Loss / Frozen (Pie Chart) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-muted-foreground" />
              Deal Outcomes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {winLossData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={winLossData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {winLossData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        `${value} deal${value !== 1 ? 's' : ''}`,
                        name,
                      ]}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {winLossData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.fill }}
                        />
                        <span className="text-sm">{item.name}</span>
                      </div>
                      <span className="font-semibold text-sm">{item.value}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Win Rate</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        metrics.winRate >= 50
                          ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                          : 'border-amber-500/30 text-amber-600 dark:text-amber-400'
                      )}
                    >
                      {metrics.winRate.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyChart message="No closed deals yet" />
            )}
          </CardContent>
        </Card>

        {/* Deals by Type (Bar Chart) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4 text-muted-foreground" />
              Deals by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dealsByTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dealsByTypeData} layout="vertical" barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    type="category"
                    dataKey="type"
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                    width={80}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === 'count'
                        ? `${value} deal${value !== 1 ? 's' : ''}`
                        : formatCurrencyFull(value),
                      name === 'count' ? 'Count' : 'Total Value',
                    ]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name="Count"
                    fill="#8b5cf6"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No deals to categorize" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Revenue Forecast ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Revenue Forecast (Weighted Pipeline)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ForecastCard
              label="Total Pipeline"
              value={formatCurrency(metrics.totalPipelineValue)}
              description="Sum of all active deal values"
            />
            <ForecastCard
              label="Weighted Forecast"
              value={formatCurrency(metrics.weightedValue)}
              description="Adjusted by probability"
              highlight
            />
            <ForecastCard
              label="Monthly Recurring"
              value={`${formatCurrency(metrics.totalMrr)}/mo`}
              description="Total MRR from active deals"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Stage Conversion Table ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Stage Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                    Stage
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                    Deals
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                    Total Value
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                    Avg Probability
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                    Weighted Value
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                    MRR
                  </th>
                </tr>
              </thead>
              <tbody>
                {PIPELINE_STAGES.map((stage) => {
                  const summary = pipelineSummary.find((s) => s.stage === stage);
                  const config = STAGE_CONFIG[stage];
                  return (
                    <tr
                      key={stage}
                      className="border-b border-border/50 hover:bg-muted/50"
                    >
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="outline"
                          className={cn(config.bgColor, config.color, 'border-none')}
                        >
                          {config.label}
                        </Badge>
                      </td>
                      <td className="text-right py-2.5 px-3 font-medium">
                        {summary?.deal_count || 0}
                      </td>
                      <td className="text-right py-2.5 px-3">
                        {formatCurrencyFull(summary?.total_value || 0)}
                      </td>
                      <td className="text-right py-2.5 px-3">
                        {(summary?.avg_probability || 0).toFixed(0)}%
                      </td>
                      <td className="text-right py-2.5 px-3 font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCurrencyFull(summary?.weighted_value || 0)}
                      </td>
                      <td className="text-right py-2.5 px-3 text-muted-foreground">
                        {formatCurrency(summary?.total_mrr || 0)}/mo
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="py-2.5 px-3">Total</td>
                  <td className="text-right py-2.5 px-3">{metrics.totalDeals}</td>
                  <td className="text-right py-2.5 px-3">
                    {formatCurrencyFull(metrics.totalPipelineValue)}
                  </td>
                  <td className="text-right py-2.5 px-3">—</td>
                  <td className="text-right py-2.5 px-3 text-emerald-600 dark:text-emerald-400">
                    {formatCurrencyFull(metrics.weightedValue)}
                  </td>
                  <td className="text-right py-2.5 px-3 text-muted-foreground">
                    {formatCurrency(metrics.totalMrr)}/mo
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <Icon className={cn('h-4 w-4', color)} />
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function ForecastCard({
  label,
  value,
  description,
  highlight,
}: {
  label: string;
  value: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg p-4 border',
        highlight
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : 'bg-muted/30 border-border'
      )}
    >
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p
        className={cn(
          'text-xl font-bold',
          highlight && 'text-emerald-600 dark:text-emerald-400'
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-48 flex items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
