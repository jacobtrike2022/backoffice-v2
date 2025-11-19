import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { 
  LineChart, 
  Line, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  BarChart,
  Bar,
  ComposedChart,
  Area,
  AreaChart
} from 'recharts';
import { 
  UserCheck, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  FileText, 
  Calendar,
  TrendingUp,
  TrendingDown,
  Eye,
  Download,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { CertificationTracker } from './CertificationTracker';

type UserRole = 'admin' | 'district-manager' | 'store-manager';

interface ComplianceDashboardProps {
  currentRole: UserRole;
  onBackToDashboard?: () => void;
  onNavigate?: (view: string) => void;
}

// Mock compliance data
const complianceOverviewData = [
  { month: 'Jul', company: 88, district: 85, unit: 82 },
  { month: 'Aug', company: 90, district: 87, unit: 85 },
  { month: 'Sep', company: 92, district: 89, unit: 88 },
  { month: 'Oct', company: 89, district: 91, unit: 90 },
  { month: 'Nov', company: 91, district: 88, unit: 85 },
  { month: 'Dec', company: 94, district: 92, unit: 89 }
];

const complianceByCategory = [
  { category: 'Safety Training', required: 142, completed: 138, overdue: 4, rate: 97.2 },
  { category: 'Data Protection', required: 142, completed: 125, overdue: 17, rate: 88.0 },
  { category: 'Harassment Prevention', required: 142, completed: 142, overdue: 0, rate: 100.0 },
  { category: 'Fire Safety', required: 142, completed: 134, overdue: 8, rate: 94.4 },
  { category: 'First Aid', required: 95, completed: 89, overdue: 6, rate: 93.7 }
];

const upcomingDeadlines = [
  { training: 'Annual Safety Certification', dueDate: 'Jan 15, 2025', affected: 24, priority: 'high' },
  { training: 'Data Protection Refresh', dueDate: 'Jan 20, 2025', affected: 17, priority: 'medium' },
  { training: 'Emergency Procedures', dueDate: 'Feb 01, 2025', affected: 8, priority: 'low' },
  { training: 'Code of Conduct', dueDate: 'Feb 15, 2025', affected: 12, priority: 'medium' }
];

const riskAssessment = [
  { unit: 'Store A', riskLevel: 'low', score: 95, issues: 1 },
  { unit: 'Store B', riskLevel: 'low', score: 98, issues: 0 },
  { unit: 'Store C', riskLevel: 'high', score: 78, issues: 4 },
  { unit: 'Store D', riskLevel: 'medium', score: 88, issues: 2 },
  { unit: 'Store E', riskLevel: 'low', score: 96, issues: 1 },
  { unit: 'Store F', riskLevel: 'high', score: 72, issues: 6 }
];

const getRiskColor = (level: string) => {
  switch (level) {
    case 'low':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800';
    case 'high':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800';
    case 'low':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800';
  }
};

export function ComplianceDashboard({ currentRole, onBackToDashboard, onNavigate }: ComplianceDashboardProps) {
  // Only admins see full compliance dashboard
  if (currentRole !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Page Header - Only show on standalone page */}
      {onBackToDashboard && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground">Compliance Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Monitor training compliance and risk assessment across the organization
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-1.5" />
              Export Report
            </Button>
            <Button 
              size="sm" 
              className="hero-primary shadow-brand"
              onClick={() => onNavigate?.('compliance-audit')}
            >
              <FileText className="w-4 h-4 mr-1.5" />
              Generate Audit
            </Button>
          </div>
        </div>
      )}

      {/* Hero Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Overall Compliance - Hero Card */}
        <Card className="border-border/40 shadow-sm hover:shadow-md transition-all duration-200 bg-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                <ArrowUpRight className="h-3 w-3" />
                <span>+3%</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-foreground leading-none">94%</div>
              <h3 className="text-sm font-medium text-muted-foreground mt-2">Overall Compliance</h3>
              <p className="text-xs text-muted-foreground/80">System-wide</p>
            </div>
          </CardContent>
        </Card>

        {/* Employees Compliant */}
        <Card className="border-border/40 shadow-sm hover:shadow-md transition-all duration-200 bg-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <UserCheck className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                <ArrowUpRight className="h-3 w-3" />
                <span>+8%</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-foreground leading-none">134</div>
              <h3 className="text-sm font-medium text-muted-foreground mt-2">Employees Compliant</h3>
              <p className="text-xs text-muted-foreground/80">of 142 total</p>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Deadlines */}
        <Card className="border-border/40 shadow-sm hover:shadow-md transition-all duration-200 bg-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
                <Clock className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs dark:bg-yellow-900/10 dark:text-yellow-400">
                Due Soon
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-foreground leading-none">4</div>
              <h3 className="text-sm font-medium text-muted-foreground mt-2">Upcoming Deadlines</h3>
              <p className="text-xs text-muted-foreground/80">Next 30 days</p>
            </div>
          </CardContent>
        </Card>

        {/* High-Risk Units */}
        <Card className="border-border/40 shadow-sm hover:shadow-md transition-all duration-200 bg-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs dark:bg-red-900/10 dark:text-red-400">
                Critical
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-foreground leading-none">2</div>
              <h3 className="text-sm font-medium text-muted-foreground mt-2">High-Risk Units</h3>
              <p className="text-xs text-muted-foreground/80">Require attention</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Trend Chart */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Compliance Trends</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">6-month compliance rate comparison</p>
            </div>
            <Button variant="ghost" size="sm">
              <Eye className="w-4 h-4 mr-1.5" />
              Details
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={complianceOverviewData}>
                <defs>
                  <linearGradient id="companyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F74A05" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#F74A05" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="districtGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF733C" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FF733C" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="unitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="month" 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  fontSize={12}
                  tickLine={false}
                  domain={[70, 100]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '13px' }}
                  iconType="circle"
                />
                <Area 
                  type="monotone" 
                  dataKey="company" 
                  stroke="#F74A05" 
                  strokeWidth={2.5}
                  fill="url(#companyGradient)" 
                  name="Company-wide"
                />
                <Area 
                  type="monotone" 
                  dataKey="district" 
                  stroke="#FF733C" 
                  strokeWidth={2.5}
                  fill="url(#districtGradient)" 
                  name="District Average"
                />
                <Area 
                  type="monotone" 
                  dataKey="unit" 
                  stroke="#94a3b8" 
                  strokeWidth={2.5}
                  fill="url(#unitGradient)" 
                  name="Unit Average"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance by Category */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <CardTitle>Compliance by Category</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Training completion rates</p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-5">
              {complianceByCategory.map((item, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        item.rate >= 95 ? 'bg-green-500' : 
                        item.rate >= 85 ? 'bg-yellow-500' : 
                        'bg-red-500'
                      }`} />
                      <span className="font-medium text-sm text-foreground">{item.category}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-semibold ${
                        item.rate >= 95 ? 'text-green-600 dark:text-green-400' : 
                        item.rate >= 85 ? 'text-yellow-600 dark:text-yellow-400' : 
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {item.rate.toFixed(1)}%
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.completed}/{item.required}
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={item.rate} 
                    className="h-2"
                  />
                  {item.overdue > 0 && (
                    <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {item.overdue} overdue
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Deadlines */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <CardTitle>Upcoming Deadlines</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Action required items</p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {upcomingDeadlines.map((item, idx) => (
                <div 
                  key={idx} 
                  className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className={`p-2.5 rounded-lg ${
                    item.priority === 'high' ? 'bg-red-100 dark:bg-red-900/20' :
                    item.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                    'bg-green-100 dark:bg-green-900/20'
                  }`}>
                    <Calendar className={`h-4 w-4 ${
                      item.priority === 'high' ? 'text-red-600 dark:text-red-400' :
                      item.priority === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm text-foreground line-clamp-1">
                        {item.training}
                      </h4>
                      <Badge variant="outline" className={`text-xs shrink-0 ${getPriorityColor(item.priority)}`}>
                        {item.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.dueDate}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <UserCheck className="h-3 w-3" />
                        {item.affected} employees
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Assessment Table */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Unit Risk Assessment</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Compliance risk levels by location</p>
            </div>
            <Button variant="outline" size="sm">
              <FileText className="w-4 h-4 mr-1.5" />
              Full Report
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Unit
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Risk Level
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Compliance Score
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Open Issues
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {riskAssessment.map((unit, idx) => (
                  <tr key={idx} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-medium text-sm text-foreground">{unit.unit}</span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={getRiskColor(unit.riskLevel)}>
                        {unit.riskLevel.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 max-w-[120px]">
                          <Progress value={unit.score} className="h-2" />
                        </div>
                        <span className={`text-sm font-semibold ${
                          unit.score >= 95 ? 'text-green-600 dark:text-green-400' :
                          unit.score >= 85 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {unit.score}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {unit.issues > 0 ? (
                        <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 font-medium">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {unit.issues}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 font-medium">
                          <CheckCircle className="h-3.5 w-3.5" />
                          None
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4 mr-1.5" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Employee Certifications Tracker */}
      <CertificationTracker currentRole={currentRole} />
    </div>
  );
}