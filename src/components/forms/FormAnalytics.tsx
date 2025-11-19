import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { 
  FileText, 
  TrendingUp, 
  TrendingDown,
  CheckCircle,
  Clock,
  BarChart3
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
  Legend
} from 'recharts';

const submissionVolumeData = [
  { date: 'Jan 1', submissions: 45 },
  { date: 'Jan 8', submissions: 52 },
  { date: 'Jan 15', submissions: 49 },
  { date: 'Jan 22', submissions: 63 },
  { date: 'Jan 29', submissions: 58 },
  { date: 'Feb 5', submissions: 71 },
  { date: 'Feb 12', submissions: 68 }
];

const completionRateData = [
  { form: 'Days 1-5 OJT', rate: 94 },
  { form: 'Store Daily Walk', rate: 87 },
  { form: 'Store Inspection', rate: 76 },
  { form: 'Safety Audit', rate: 82 },
  { form: 'Night Closing', rate: 91 }
];

const submissionsByUnitData = [
  { unit: 'Store A', submissions: 45 },
  { unit: 'Store B', submissions: 38 },
  { unit: 'Store C', submissions: 52 },
  { unit: 'Store D', submissions: 41 },
  { unit: 'Store E', submissions: 47 }
];

const scoresTrendData = [
  { date: 'Week 1', score: 82 },
  { date: 'Week 2', score: 85 },
  { date: 'Week 3', score: 83 },
  { date: 'Week 4', score: 88 },
  { date: 'Week 5', score: 87 },
  { date: 'Week 6', score: 90 }
];

interface FormAnalyticsProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
}

export function FormAnalytics({ currentRole = 'admin' }: FormAnalyticsProps) {
  const [timeRange, setTimeRange] = useState('30');
  const [formType, setFormType] = useState('all');

  const stats = [
    {
      label: 'Total Submissions',
      value: '234',
      change: '+12%',
      trend: 'up',
      icon: FileText,
      subtitle: 'This month'
    },
    {
      label: 'Active Forms',
      value: '12',
      change: '+2',
      trend: 'up',
      icon: BarChart3,
      subtitle: 'Currently assigned'
    },
    {
      label: 'Completion Rate',
      value: '86%',
      change: '+4%',
      trend: 'up',
      icon: CheckCircle,
      subtitle: 'Across all forms'
    },
    {
      label: 'Avg Response Time',
      value: '4.2 min',
      change: '-0.8 min',
      trend: 'up',
      icon: Clock,
      subtitle: 'Time to complete'
    }
  ];

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
                      {isPositive ? (
                        <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                      <span className={`text-sm ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {stat.change}
                      </span>
                      <span className="text-sm text-muted-foreground">{stat.subtitle}</span>
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
                <SelectItem value="custom">Custom Range</SelectItem>
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
                    borderRadius: '8px'
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
          </CardContent>
        </Card>

        {/* Completion Rate by Form */}
        <Card>
          <CardHeader>
            <CardTitle>Completion Rate by Form</CardTitle>
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
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="rate" 
                  fill="#F74A05"
                  radius={[0, 8, 8, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
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
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="submissions" 
                  fill="#FF733C"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Average Scores Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Average Scores Over Time</CardTitle>
          </CardHeader>
          <CardContent>
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
                    borderRadius: '8px'
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
                <Line 
                  type="monotone" 
                  y={85}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
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
            {[
              { unit: 'Store C', completionRate: 96, avgScore: 92, submissions: 52 },
              { unit: 'Store E', completionRate: 94, avgScore: 90, submissions: 47 },
              { unit: 'Store A', completionRate: 91, avgScore: 88, submissions: 45 },
              { unit: 'Store D', completionRate: 88, avgScore: 86, submissions: 41 },
              { unit: 'Store B', completionRate: 85, avgScore: 84, submissions: 38 }
            ].map((item, index) => (
              <div key={item.unit} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 rounded-full bg-brand-gradient flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold">{item.unit}</p>
                    <p className="text-sm text-muted-foreground">{item.submissions} submissions</p>
                  </div>
                </div>
                <div className="flex items-center space-x-6 text-sm">
                  <div className="text-right">
                    <p className="text-muted-foreground">Completion</p>
                    <p className="font-semibold">{item.completionRate}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Avg Score</p>
                    <p className="font-semibold">{item.avgScore}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}