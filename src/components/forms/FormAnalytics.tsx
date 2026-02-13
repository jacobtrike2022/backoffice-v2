import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Clock,
  BarChart3,
  Loader2,
  AlertCircle
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
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
import { useQuery } from '@tanstack/react-query';
import { getFormAnalytics } from '@/lib/crud/forms';

const FORM_TYPE_MAP: Record<string, string | undefined> = {
  all: undefined,
  ojt: 'ojt-checklist',
  inspection: 'inspection',
  audit: 'audit',
  survey: 'survey',
};

interface FormAnalyticsProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
}

export function FormAnalytics({ currentRole = 'admin' }: FormAnalyticsProps) {
  const [timeRange, setTimeRange] = useState('30');
  const [formType, setFormType] = useState('all');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['formAnalytics', timeRange, formType],
    queryFn: () =>
      getFormAnalytics({
        timeRange,
        formType: FORM_TYPE_MAP[formType] ?? formType,
      }),
  });

  const stats = data?.stats
    ? [
        {
          label: 'Total Submissions',
          value: String(data.stats.totalSubmissions),
          change: '—',
          trend: 'up' as const,
          icon: FileText,
          subtitle: `Last ${timeRange} days`,
        },
        {
          label: 'Active Assignments',
          value: String(data.stats.activeForms),
          change: '—',
          trend: 'up' as const,
          icon: BarChart3,
          subtitle: 'Currently assigned',
        },
        {
          label: 'Approval Rate',
          value: `${data.stats.completionRate}%`,
          change: '—',
          trend: 'up' as const,
          icon: CheckCircle,
          subtitle: 'Across all forms',
        },
        {
          label: 'Approved',
          value: String(data.stats.approvedCount),
          change: '—',
          trend: 'up' as const,
          icon: Clock,
          subtitle: 'Submissions approved',
        },
      ]
    : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="border-red-200">
          <CardContent className="p-6 flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
            <div className="flex-1">
              <p className="font-semibold">Failed to load analytics</p>
              <p className="text-sm text-muted-foreground">
                {(error as Error)?.message || 'An error occurred.'}
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="text-sm text-primary hover:underline"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const submissionVolumeData = data?.submissionVolumeData || [];
  const completionRateData = data?.completionRateData || [];
  const submissionsByUnitData = data?.submissionsByUnitData || [];
  const topPerformingUnits = data?.topPerformingUnits || [];
  const scoresTrendData = data?.scoresTrendData || [];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const isPositive = stat.trend === 'up';
          return (
            <Card key={stat.label}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-bold">{stat.value}</p>
                    <div className="flex items-center space-x-2">
                      {stat.change !== '—' && (
                        <>
                          {isPositive ? (
                            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                          )}
                          <span
                            className={`text-sm ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                          >
                            {stat.change}
                          </span>
                        </>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {stat.subtitle}
                      </span>
                    </div>
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

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last Quarter</SelectItem>
                <SelectItem value="365">Last Year</SelectItem>
              </SelectContent>
            </Select>

            <Select value={formType} onValueChange={setFormType}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Form Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Forms</SelectItem>
                <SelectItem value="ojt">OJT Checklists</SelectItem>
                <SelectItem value="inspection">Inspections</SelectItem>
                <SelectItem value="audit">Audits</SelectItem>
                <SelectItem value="survey">Surveys</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submission Volume Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Submission Volume Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={submissionVolumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af' }}
                  fontSize={12}
                />
                <YAxis
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af' }}
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="submissions"
                  stroke="#F74A05"
                  strokeWidth={3}
                  dot={{ fill: '#F74A05', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
            {submissionVolumeData.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No submissions in this period
              </p>
            )}
          </CardContent>
        </Card>

        {/* Completion Rate by Form */}
        <Card>
          <CardHeader>
            <CardTitle>Approval Rate by Form</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={completionRateData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af' }}
                  fontSize={12}
                  domain={[0, 100]}
                />
                <YAxis
                  type="category"
                  dataKey="form"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af' }}
                  fontSize={12}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar
                  dataKey="rate"
                  fill="#F74A05"
                  radius={[0, 8, 8, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
            {completionRateData.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No form data in this period
              </p>
            )}
          </CardContent>
        </Card>

        {/* Submissions by Unit */}
        <Card>
          <CardHeader>
            <CardTitle>Submissions by Unit</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={submissionsByUnitData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="unit"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af' }}
                  fontSize={12}
                />
                <YAxis
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af' }}
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar
                  dataKey="submissions"
                  fill="#FF733C"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
            {submissionsByUnitData.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No submissions by unit in this period
              </p>
            )}
          </CardContent>
        </Card>

        {/* Average Scores Over Time - placeholder when no score data */}
        <Card>
          <CardHeader>
            <CardTitle>Average Scores Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {scoresTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={scoresTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af' }}
                    fontSize={12}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af' }}
                    fontSize={12}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#22c55e"
                    strokeWidth={3}
                    dot={{ fill: '#22c55e', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Score tracking not yet implemented
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Performers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Units</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topPerformingUnits.map((item, index) => (
              <div
                key={item.unit}
                className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 rounded-full bg-brand-gradient flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold">{item.unit}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.submissions} submissions
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-6 text-sm">
                  <div className="text-right">
                    <p className="text-muted-foreground">Approval Rate</p>
                    <p className="font-semibold">{item.completionRate}%</p>
                  </div>
                </div>
              </div>
            ))}
            {topPerformingUnits.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No unit data in this period
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
