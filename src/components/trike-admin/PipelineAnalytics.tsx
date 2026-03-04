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
  AreaChart,
  Area,
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
  Repeat,
  AlertTriangle,
  Timer,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { cn } from '../ui/utils';

import {
  getPipelineSummary,
  getPipelineMetrics,
  getDeals,
  getStageTransitions,
  type Deal,
  type PipelineSummary,
  type DealStage,
  type StageTransition,
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
  const [stageTransitions, setStageTransitions] = useState<StageTransition[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const [summaryData, metricsData, dealsData, transitionsData] = await Promise.all([
        getPipelineSummary(),
        getPipelineMetrics(),
        getDeals(),
        getStageTransitions(),
      ]);

      setPipelineSummary(summaryData);
      setAllDeals(dealsData);
      setStageTransitions(transitionsData);

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

  // ── MRR / ARR derived data ──

  const mrrMetrics = useMemo(() => {
    const activeMrr = allDeals
      .filter((d) => !['lost', 'frozen'].includes(d.stage))
      .reduce((sum, d) => sum + (d.mrr || 0), 0);

    const churnMrr = allDeals
      .filter((d) => d.stage === 'lost' && (d.mrr || 0) > 0)
      .reduce((sum, d) => sum + (d.mrr || 0), 0);

    const wonMrr = allDeals
      .filter((d) => d.stage === 'won')
      .reduce((sum, d) => sum + (d.mrr || 0), 0);

    return {
      activeMrr,
      arr: activeMrr * 12,
      churnMrr,
      wonMrr,
      netNewMrr: wonMrr - churnMrr,
      churnedDealCount: allDeals.filter((d) => d.stage === 'lost' && (d.mrr || 0) > 0).length,
    };
  }, [allDeals]);

  const mrrByStageData = useMemo(() => {
    return [...PIPELINE_STAGES, 'won' as DealStage].map((stage) => {
      const stageMrr = allDeals
        .filter((d) => d.stage === stage)
        .reduce((sum, d) => sum + (d.mrr || 0), 0);
      return {
        stage: STAGE_CONFIG[stage].label,
        mrr: stageMrr,
        arr: stageMrr * 12,
        fill: STAGE_CHART_COLORS[stage],
      };
    }).filter((d) => d.mrr > 0);
  }, [allDeals]);

  const mrrTimelineData = useMemo(() => {
    // Build cumulative MRR by month from deal creation dates
    const dealsByMonth: Record<string, { added: number; lost: number }> = {};

    for (const deal of allDeals) {
      if (!deal.mrr || deal.mrr === 0) continue;

      const createdMonth = deal.created_at.slice(0, 7); // YYYY-MM
      if (!dealsByMonth[createdMonth]) dealsByMonth[createdMonth] = { added: 0, lost: 0 };

      if (deal.stage === 'lost') {
        // Use actual_close_date month if available, otherwise created month
        const lostMonth = deal.actual_close_date
          ? deal.actual_close_date.slice(0, 7)
          : createdMonth;
        if (!dealsByMonth[lostMonth]) dealsByMonth[lostMonth] = { added: 0, lost: 0 };
        dealsByMonth[lostMonth].lost += deal.mrr;
      } else {
        dealsByMonth[createdMonth].added += deal.mrr;
      }
    }

    const sortedMonths = Object.keys(dealsByMonth).sort();
    let cumulativeMrr = 0;

    return sortedMonths.map((month) => {
      cumulativeMrr += dealsByMonth[month].added - dealsByMonth[month].lost;
      const [year, mo] = month.split('-');
      const label = new Date(parseInt(year), parseInt(mo) - 1).toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      });
      return {
        month: label,
        mrr: Math.max(cumulativeMrr, 0),
        arr: Math.max(cumulativeMrr * 12, 0),
        added: dealsByMonth[month].added,
        lost: dealsByMonth[month].lost,
      };
    });
  }, [allDeals]);

  // ── Historical conversion rates (from stage transitions) ──

  const historicalConversionRates = useMemo(() => {
    if (stageTransitions.length === 0) return [];

    // Count how many deals entered each stage, and how many moved to the next
    const stageOrder = ['lead', 'prospect', 'evaluating', 'closing', 'won'];
    const enteredStage: Record<string, Set<string>> = {};
    const exitedToNext: Record<string, Set<string>> = {};

    for (const stage of stageOrder) {
      enteredStage[stage] = new Set();
      exitedToNext[stage] = new Set();
    }

    // Every deal that transitions FROM a stage entered it at some point
    // Every deal that transitions TO a stage entered that stage
    for (const t of stageTransitions) {
      if (t.to_stage && stageOrder.includes(t.to_stage)) {
        enteredStage[t.to_stage].add(t.deal_id);
      }
      if (t.from_stage && stageOrder.includes(t.from_stage)) {
        enteredStage[t.from_stage].add(t.deal_id);
      }
    }

    // Also count deals currently sitting in each stage (they entered but haven't transitioned out yet)
    for (const deal of allDeals) {
      if (stageOrder.includes(deal.stage)) {
        enteredStage[deal.stage].add(deal.id);
      }
    }

    // Deals that exited a stage to the next stage in the pipeline
    for (const t of stageTransitions) {
      const fromIdx = stageOrder.indexOf(t.from_stage);
      const toIdx = stageOrder.indexOf(t.to_stage);
      if (fromIdx >= 0 && toIdx > fromIdx) {
        exitedToNext[t.from_stage].add(t.deal_id);
      }
    }

    return stageOrder.slice(0, -1).map((stage, idx) => {
      const entered = enteredStage[stage].size;
      const progressed = exitedToNext[stage].size;
      const nextStage = stageOrder[idx + 1];
      return {
        from: STAGE_CONFIG[stage as DealStage]?.label || stage,
        to: STAGE_CONFIG[nextStage as DealStage]?.label || nextStage,
        entered,
        progressed,
        rate: entered > 0 ? (progressed / entered) * 100 : 0,
        fill: STAGE_CHART_COLORS[stage] || '#64748b',
      };
    });
  }, [stageTransitions, allDeals]);

  // ── Time-in-stage (bottleneck detection) ──

  const timeInStageData = useMemo(() => {
    if (stageTransitions.length === 0) return [];

    // Group transitions by deal, ordered by time
    const byDeal: Record<string, { stage: string; at: number }[]> = {};
    for (const t of stageTransitions) {
      if (!byDeal[t.deal_id]) byDeal[t.deal_id] = [];
      byDeal[t.deal_id].push({
        stage: t.from_stage,
        at: new Date(t.transitioned_at).getTime(),
      });
    }

    // For each deal, compute dwell time per stage from consecutive transitions
    const stageDwell: Record<string, number[]> = {};
    const stageOrder = ['lead', 'prospect', 'evaluating', 'closing'];
    for (const s of stageOrder) stageDwell[s] = [];

    for (const transitions of Object.values(byDeal)) {
      // Sort by time ascending
      transitions.sort((a, b) => a.at - b.at);
      for (let i = 0; i < transitions.length; i++) {
        const stage = transitions[i].stage;
        if (!stageOrder.includes(stage)) continue;
        // Find the next transition (which ends this dwell period)
        const nextTime = transitions[i + 1]?.at;
        if (nextTime) {
          const days = (nextTime - transitions[i].at) / (1000 * 60 * 60 * 24);
          if (days >= 0 && days < 365) { // sanity cap
            stageDwell[stage].push(days);
          }
        }
      }
    }

    const results = stageOrder.map((stage) => {
      const dwells = stageDwell[stage];
      const avg = dwells.length > 0
        ? dwells.reduce((a, b) => a + b, 0) / dwells.length
        : 0;
      const median = dwells.length > 0
        ? [...dwells].sort((a, b) => a - b)[Math.floor(dwells.length / 2)]
        : 0;
      return {
        stage: STAGE_CONFIG[stage as DealStage]?.label || stage,
        avgDays: Math.round(avg * 10) / 10,
        medianDays: Math.round(median * 10) / 10,
        sampleSize: dwells.length,
        fill: STAGE_CHART_COLORS[stage] || '#64748b',
      };
    });

    // Identify bottleneck (longest average dwell)
    const maxAvg = Math.max(...results.map((r) => r.avgDays));
    return results.map((r) => ({
      ...r,
      isBottleneck: r.avgDays === maxAvg && r.avgDays > 0,
    }));
  }, [stageTransitions]);

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

      {/* ── Pipeline Forecasting & Bottleneck Detection ── */}
      {(historicalConversionRates.length > 0 || timeInStageData.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              Pipeline Forecasting &amp; Bottleneck Detection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Historical Conversion Rates */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  Historical Conversion Rates
                </h4>
                {historicalConversionRates.length > 0 ? (
                  <div className="space-y-3">
                    {historicalConversionRates.map((row) => (
                      <div key={row.from} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {row.from} → {row.to}
                          </span>
                          <span className="font-medium">
                            {row.rate.toFixed(0)}%
                            <span className="text-xs text-muted-foreground ml-1">
                              ({row.progressed}/{row.entered})
                            </span>
                          </span>
                        </div>
                        <div className="h-5 bg-muted rounded-md overflow-hidden">
                          <div
                            className="h-full rounded-md transition-all duration-500 flex items-center justify-end pr-1.5"
                            style={{
                              width: `${Math.max(row.rate, 3)}%`,
                              backgroundColor: row.fill,
                              opacity: 0.75,
                            }}
                          >
                            {row.rate >= 15 && (
                              <span className="text-[10px] font-medium text-white">
                                {row.rate.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Overall pipeline throughput */}
                    {historicalConversionRates.length > 0 && (
                      <div className="pt-2 border-t border-border/50">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">Lead → Won (Overall)</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {(historicalConversionRates.reduce(
                              (acc, r) => acc * (r.rate / 100),
                              1
                            ) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyChart message="No stage transitions recorded yet" />
                )}
              </div>

              {/* Time-in-Stage Bottleneck */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                  Avg. Time in Stage
                </h4>
                {timeInStageData.some((d) => d.sampleSize > 0) ? (
                  <div className="space-y-3">
                    {timeInStageData.map((row) => {
                      const maxDays = Math.max(...timeInStageData.map((d) => d.avgDays), 1);
                      const widthPct = (row.avgDays / maxDays) * 100;
                      return (
                        <div key={row.stage} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1.5">
                              {row.stage}
                              {row.isBottleneck && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5"
                                >
                                  Bottleneck
                                </Badge>
                              )}
                            </span>
                            <span className="font-medium">
                              {row.avgDays > 0 ? `${row.avgDays}d avg` : '—'}
                              {row.sampleSize > 0 && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  (n={row.sampleSize})
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="h-5 bg-muted rounded-md overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-md transition-all duration-500',
                                row.isBottleneck && 'ring-1 ring-amber-500/40'
                              )}
                              style={{
                                width: `${Math.max(widthPct, 3)}%`,
                                backgroundColor: row.isBottleneck
                                  ? '#f59e0b'
                                  : row.fill,
                                opacity: 0.75,
                              }}
                            />
                          </div>
                          {row.medianDays > 0 && row.medianDays !== row.avgDays && (
                            <p className="text-[11px] text-muted-foreground">
                              Median: {row.medianDays}d
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyChart message="No stage transitions recorded yet" />
                )}
              </div>
            </div>

            {/* Weighted Forecast Summary */}
            {historicalConversionRates.length > 0 && (
              <div className="rounded-lg bg-muted/30 border border-border p-4">
                <h4 className="text-sm font-medium mb-3">
                  Probability-Weighted Forecast (Historical)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 px-2 font-medium text-muted-foreground text-xs">
                          Stage
                        </th>
                        <th className="text-right py-1.5 px-2 font-medium text-muted-foreground text-xs">
                          Pipeline Value
                        </th>
                        <th className="text-right py-1.5 px-2 font-medium text-muted-foreground text-xs">
                          Hist. Win %
                        </th>
                        <th className="text-right py-1.5 px-2 font-medium text-muted-foreground text-xs">
                          Forecast
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {PIPELINE_STAGES.map((stage) => {
                        const summary = pipelineSummary.find((s) => s.stage === stage);
                        const value = summary?.total_value || 0;
                        // Historical win% = product of conversion rates from this stage onward
                        const stageIdx = ['lead', 'prospect', 'evaluating', 'closing'].indexOf(stage);
                        const ratesFromHere = historicalConversionRates.slice(stageIdx);
                        const historicalWinPct = ratesFromHere.reduce(
                          (acc, r) => acc * (r.rate / 100),
                          1
                        ) * 100;
                        const forecast = value * (historicalWinPct / 100);
                        return (
                          <tr key={stage} className="border-b border-border/50">
                            <td className="py-1.5 px-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  STAGE_CONFIG[stage].bgColor,
                                  STAGE_CONFIG[stage].color,
                                  'border-none text-xs'
                                )}
                              >
                                {STAGE_CONFIG[stage].label}
                              </Badge>
                            </td>
                            <td className="text-right py-1.5 px-2">
                              {formatCurrencyFull(value)}
                            </td>
                            <td className="text-right py-1.5 px-2 font-medium">
                              {historicalWinPct.toFixed(1)}%
                            </td>
                            <td className="text-right py-1.5 px-2 font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatCurrencyFull(forecast)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border font-semibold">
                        <td className="py-1.5 px-2" colSpan={3}>
                          Total Historical Forecast
                        </td>
                        <td className="text-right py-1.5 px-2 text-emerald-600 dark:text-emerald-400">
                          {formatCurrencyFull(
                            PIPELINE_STAGES.reduce((total, stage) => {
                              const summary = pipelineSummary.find((s) => s.stage === stage);
                              const value = summary?.total_value || 0;
                              const stageIdx = ['lead', 'prospect', 'evaluating', 'closing'].indexOf(stage);
                              const ratesFromHere = historicalConversionRates.slice(stageIdx);
                              const historicalWinPct = ratesFromHere.reduce(
                                (acc, r) => acc * (r.rate / 100),
                                1
                              );
                              return total + value * historicalWinPct;
                            }, 0)
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Uses historical stage-to-stage conversion rates instead of fixed probabilities.
                  Compare with weighted forecast ({formatCurrency(metrics.weightedValue)}) above.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── MRR & Revenue Intelligence ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Repeat className="h-4 w-4 text-muted-foreground" />
            MRR &amp; Revenue Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* ARR / Churn KPI Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ForecastCard
              label="Active MRR"
              value={`${formatCurrency(mrrMetrics.activeMrr)}/mo`}
              description="From pipeline + won deals"
            />
            <ForecastCard
              label="ARR Projection"
              value={formatCurrency(mrrMetrics.arr)}
              description="Active MRR × 12"
              highlight
            />
            <ForecastCard
              label="Won MRR"
              value={`${formatCurrency(mrrMetrics.wonMrr)}/mo`}
              description="Revenue from closed-won deals"
            />
            <div
              className={cn(
                'rounded-lg p-4 border',
                mrrMetrics.churnMrr > 0
                  ? 'bg-red-500/5 border-red-500/20'
                  : 'bg-muted/30 border-border'
              )}
            >
              <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Churned MRR
              </p>
              <p
                className={cn(
                  'text-xl font-bold',
                  mrrMetrics.churnMrr > 0 && 'text-red-600 dark:text-red-400'
                )}
              >
                {mrrMetrics.churnMrr > 0 ? '-' : ''}{formatCurrency(mrrMetrics.churnMrr)}/mo
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {mrrMetrics.churnedDealCount} lost deal{mrrMetrics.churnedDealCount !== 1 ? 's' : ''} with MRR
              </p>
            </div>
          </div>

          {/* MRR Growth Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                MRR Growth Over Time
              </h4>
              {mrrTimelineData.length > 1 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={mrrTimelineData}>
                    <defs>
                      <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11 }}
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
                        `${formatCurrencyFull(value)}/mo`,
                        name === 'mrr' ? 'MRR' : name,
                      ]}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="mrr"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#mrrGradient)"
                      name="MRR"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="Need 2+ months of MRR data for timeline" />
              )}
            </div>

            {/* MRR by Stage */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                MRR by Stage
              </h4>
              {mrrByStageData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={mrrByStageData} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="stage"
                      tick={{ fontSize: 11 }}
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
                        `${formatCurrencyFull(value)}${name === 'mrr' ? '/mo' : '/yr'}`,
                        name === 'mrr' ? 'MRR' : 'ARR',
                      ]}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="mrr" name="MRR" radius={[4, 4, 0, 0]}>
                      {mrrByStageData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} opacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="No deals with MRR values" />
              )}
            </div>
          </div>

          {/* Net MRR Summary */}
          {(mrrMetrics.wonMrr > 0 || mrrMetrics.churnMrr > 0) && (
            <div className="rounded-lg bg-muted/30 border border-border p-4">
              <h4 className="text-sm font-medium mb-3">Net Revenue Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Won MRR</p>
                  <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(mrrMetrics.wonMrr)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Churned MRR</p>
                  <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                    -{formatCurrency(mrrMetrics.churnMrr)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Net New MRR</p>
                  <p
                    className={cn(
                      'text-lg font-semibold',
                      mrrMetrics.netNewMrr >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    )}
                  >
                    {mrrMetrics.netNewMrr >= 0 ? '+' : ''}{formatCurrency(mrrMetrics.netNewMrr)}
                  </p>
                </div>
              </div>
            </div>
          )}
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
