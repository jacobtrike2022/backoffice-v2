import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ComposedChart,
  Area,
  AreaChart,
  LineChart,
  Line
} from 'recharts';
import { TrendingUp, TrendingDown, Users, CheckCircle, AlertTriangle, Eye, Building } from 'lucide-react';

type UserRole = 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';

interface ComparativeAnalyticsProps {
  currentRole: UserRole;
}

// Enhanced mock data for comparative analytics
const unitComparisonData = [
  { 
    unit: 'Store A', 
    completion: 85, 
    employees: 24, 
    assignments: 12, 
    avgScore: 87,
    trend: 'up',
    status: 'good',
    district: 'North'
  },
  { 
    unit: 'Store B', 
    completion: 92, 
    employees: 18, 
    assignments: 15, 
    avgScore: 94,
    trend: 'up',
    status: 'excellent',
    district: 'North'
  },
  { 
    unit: 'Store C', 
    completion: 78, 
    employees: 31, 
    assignments: 8, 
    avgScore: 82,
    trend: 'down',
    status: 'warning',
    district: 'South'
  },
  { 
    unit: 'Store D', 
    completion: 88, 
    employees: 22, 
    assignments: 14, 
    avgScore: 89,
    trend: 'up',
    status: 'good',
    district: 'East'
  },
  { 
    unit: 'Store E', 
    completion: 95, 
    employees: 16, 
    assignments: 18, 
    avgScore: 96,
    trend: 'up',
    status: 'excellent',
    district: 'West'
  },
  { 
    unit: 'Store F', 
    completion: 72, 
    employees: 28, 
    assignments: 6, 
    avgScore: 75,
    trend: 'down',
    status: 'at-risk',
    district: 'South'
  }
];

const districtSummaryData = [
  { district: 'North', avgCompletion: 88.5, units: 2, employees: 42, status: 'good' },
  { district: 'South', avgCompletion: 75, units: 2, employees: 59, status: 'warning' },
  { district: 'East', avgCompletion: 88, units: 1, employees: 22, status: 'good' },
  { district: 'West', avgCompletion: 95, units: 1, employees: 16, status: 'excellent' }
];

const performanceTrendData = [
  { month: 'Jul', company: 85, district: 88, unit: 85 },
  { month: 'Aug', company: 87, district: 89, unit: 88 },
  { month: 'Sep', company: 89, district: 91, unit: 90 },
  { month: 'Oct', company: 91, district: 93, unit: 92 },
  { month: 'Nov', company: 88, district: 89, unit: 89 },
  { month: 'Dec', company: 92, district: 94, unit: 94 }
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'excellent':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'good':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'at-risk':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getTrendIcon = (trend: string) => {
  return trend === 'up' ? 
    <TrendingUp className="h-3 w-3 text-green-500" /> : 
    <TrendingDown className="h-3 w-3 text-red-500" />;
};

export function ComparativeAnalytics({ currentRole }: ComparativeAnalyticsProps) {
  if (currentRole === 'store-manager') {
    return null; // Store managers don't see comparative analytics
  }

  return (
    <div className="space-y-8">
      {/* Performance Comparison Chart */}
      <Card className="chart-container hover-lift">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold">Performance Comparison</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {currentRole === 'admin' ? 'System-wide vs District vs Unit performance' : 'District performance trends'}
            </p>
          </div>
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={performanceTrendData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="month" />
              <YAxis domain={[70, 100]} />
              <Tooltip />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="company" 
                fill="#F74A05" 
                fillOpacity={0.1}
                stroke="#F74A05"
                strokeWidth={2}
                name="Company Avg"
              />
              <Bar 
                dataKey="district" 
                fill="#FF733C" 
                name="District Avg"
                radius={[2, 2, 0, 0]}
              />
              <Line 
                type="monotone" 
                dataKey="unit" 
                stroke="#10b981" 
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 4 }}
                name="Your Performance"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* District Summary (Admin only - shows DISTRICT performance) */}
        {currentRole === 'admin' && (
          <Card className="border-border/50 shadow-sm w-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">District Summary</CardTitle>
              <p className="text-xs text-muted-foreground">
                Performance overview by district
              </p>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-4">
                {districtSummaryData.map((district) => (
                  <div key={district.district} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-semibold text-sm">{district.district} District</h4>
                        <Badge variant="outline" className={getStatusColor(district.status)}>
                          {district.status}
                        </Badge>
                      </div>
                      <span className="text-lg font-bold text-primary">
                        {district.avgCompletion}%
                      </span>
                    </div>
                    
                    <Progress value={district.avgCompletion} className="h-2" />
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center space-x-3">
                        <span className="flex items-center space-x-1">
                          <Building className="h-3 w-3" />
                          <span>{district.units} units</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Users className="h-3 w-3" />
                          <span>{district.employees} employees</span>
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 text-xs">
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Performing Stores (District Manager only - shows STORE performance) */}
        {currentRole === 'district-manager' && (
          <Card className="border-border/50 shadow-sm w-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Top Performing Stores</CardTitle>
              <p className="text-xs text-muted-foreground">
                Leading stores in your district
              </p>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-3">
                {unitComparisonData
                  .filter(unit => ['North', 'South'].includes(unit.district))
                  .sort((a, b) => b.completion - a.completion)
                  .slice(0, 3)
                  .map((unit, index) => (
                    <div key={unit.unit} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-accent/20 rounded-lg border border-border/40">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${
                          index === 0 ? 'bg-yellow-500' :
                          index === 1 ? 'bg-gray-400' :
                          'bg-orange-400'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm">{unit.unit}</h4>
                          <p className="text-xs text-muted-foreground">
                            {unit.employees} employees
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:ml-auto">
                        <div className="text-lg font-bold text-primary">
                          {unit.completion}%
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                          {getTrendIcon(unit.trend)}
                          <span>Trending {unit.trend}</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lowest Performing Stores (District Manager only - shows STORE performance) */}
        {currentRole === 'district-manager' && (
          <Card className="border-border/50 shadow-sm w-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Lowest Performing Stores</CardTitle>
              <p className="text-xs text-muted-foreground">
                Stores needing attention
              </p>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-3">
                {unitComparisonData
                  .filter(unit => ['North', 'South'].includes(unit.district))
                  .sort((a, b) => a.completion - b.completion)
                  .slice(0, 3)
                  .map((unit, index) => (
                    <div key={unit.unit} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-accent/20 rounded-lg border border-border/40">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                          unit.completion < 80 ? 'bg-red-100 text-red-700' :
                          unit.completion < 85 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm">{unit.unit}</h4>
                          <p className="text-xs text-muted-foreground">
                            {unit.employees} employees
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:ml-auto">
                        <div className={`text-lg font-bold ${
                          unit.completion < 80 ? 'text-red-600' :
                          unit.completion < 85 ? 'text-yellow-600' :
                          'text-primary'
                        }`}>
                          {unit.completion}%
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                          {getTrendIcon(unit.trend)}
                          <span>Trending {unit.trend}</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}