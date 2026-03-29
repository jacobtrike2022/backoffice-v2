import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import {
  FileText,
  CheckCircle,
  Clock,
  BarChart3,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  getFormSummaryStats,
  getSubmissionVolume,
  getCompletionRates,
  getScoreSummary,
} from '../../lib/crud/formAnalytics';

interface FormAnalyticsProps {
  orgId?: string;
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
}

interface SummaryStats {
  totalForms: number;
  totalSubmissions: number;
  pendingReview: number;
  avgScore: number | null;
}

interface VolumePoint {
  date: string;
  count: number;
}

interface CompletionRate {
  formTitle: string;
  submitted: number;
  assigned: number;
  rate: number;
}

interface ScoreEntry {
  formTitle: string;
  avgScore: number;
  count: number;
}

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
  },
};

const AXIS_PROPS = {
  stroke: '#9ca3af',
  tick: { fill: '#9ca3af' },
  fontSize: 12,
};

function ChartSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-6 w-40 bg-muted rounded mb-4" />
      <div className="h-[300px] bg-muted rounded" />
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-8 w-16 bg-muted rounded" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

export function FormAnalytics({ orgId, currentRole = 'admin' }: FormAnalyticsProps) {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [volumeData, setVolumeData] = useState<VolumePoint[]>([]);
  const [completionData, setCompletionData] = useState<CompletionRate[]>([]);
  const [scoreData, setScoreData] = useState<ScoreEntry[]>([]);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    Promise.all([
      getFormSummaryStats(orgId),
      getSubmissionVolume(orgId, days),
      getCompletionRates(orgId),
      getScoreSummary(orgId),
    ])
      .then(([summaryStats, volume, completion, scores]) => {
        setStats(summaryStats);
        setVolumeData(volume);
        setCompletionData(completion);
        setScoreData(scores);
      })
      .catch((err) => {
        console.error('FormAnalytics fetch error:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [orgId, days]);

  // Filter volume data to show every 7th label on X axis
  const volumeTickFormatter = (value: string, index: number) =>
    index % 7 === 0 ? value : '';

  const statCards = stats
    ? [
        {
          label: 'Total Published Forms',
          value: stats.totalForms.toString(),
          icon: BarChart3,
        },
        {
          label: 'Total Submissions',
          value: stats.totalSubmissions.toString(),
          icon: FileText,
        },
        {
          label: 'Pending Review',
          value: stats.pendingReview.toString(),
          icon: Clock,
        },
        {
          label: 'Avg Score',
          value: stats.avgScore !== null ? `${stats.avgScore}%` : '—',
          icon: CheckCircle,
        },
      ]
    : null;

  return (
    <div className="space-y-6">
      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading || !statCards
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="text-3xl font-bold">{stat.value}</p>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-brand-gradient flex items-center justify-center">
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* Date Range Filter */}
      <div className="flex items-center gap-2">
        {([7, 30, 90] as const).map((d) => (
          <Button
            key={d}
            variant={days === d ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDays(d)}
          >
            {d} days
          </Button>
        ))}
      </div>

      {/* Submission Volume — full width */}
      <Card>
        <CardHeader>
          <CardTitle>Submission Volume</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse h-[300px] bg-muted rounded" />
          ) : volumeData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  {...AXIS_PROPS}
                  tickFormatter={volumeTickFormatter}
                />
                <YAxis {...AXIS_PROPS} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Submissions"
                  stroke="#F74A05"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Two-column chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completion Rate by Form */}
        <Card>
          <CardHeader>
            <CardTitle>Completion Rate by Form</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse h-[300px] bg-muted rounded" />
            ) : completionData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={completionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    {...AXIS_PROPS}
                    domain={[0, 100]}
                  />
                  <YAxis
                    type="category"
                    dataKey="formTitle"
                    {...AXIS_PROPS}
                    width={130}
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(value: number) => [`${value}%`, 'Completion Rate']}
                  />
                  <Bar
                    dataKey="rate"
                    fill="#FF6B35"
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Average Score by Form */}
        <Card>
          <CardHeader>
            <CardTitle>Average Score by Form</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse h-[300px] bg-muted rounded" />
            ) : scoreData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No scoring data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={scoreData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    {...AXIS_PROPS}
                    domain={[0, 100]}
                  />
                  <YAxis
                    type="category"
                    dataKey="formTitle"
                    {...AXIS_PROPS}
                    width={130}
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(value: number) => [`${value}%`, 'Avg Score']}
                  />
                  <Bar
                    dataKey="avgScore"
                    fill="#FF6B35"
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
