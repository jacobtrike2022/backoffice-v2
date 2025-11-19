import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { 
  BarChart, 
  LineChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
  Scatter,
  ScatterChart
} from 'recharts';
import { 
  ArrowLeft,
  Download,
  Filter,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  Users,
  BookOpen,
  Award,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Zap,
  MapPin,
  Building,
  Eye,
  RefreshCw,
  FileText,
  Mail,
  Share
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

type UserRole = 'admin' | 'district-manager' | 'store-manager';
type ReportType = 'performance' | 'training' | 'compliance' | 'custom';
type TimeRange = '7d' | '30d' | '90d' | '1y' | 'custom';

interface AnalyticsProps {
  currentRole: UserRole;
  onBackToDashboard: () => void;
}

// Enhanced mock data for comprehensive reporting
const performanceData = [
  { month: 'Oct', completion: 85, engagement: 92, efficiency: 78, satisfaction: 88 },
  { month: 'Nov', completion: 88, engagement: 89, efficiency: 82, satisfaction: 91 },
  { month: 'Dec', completion: 92, engagement: 94, efficiency: 85, satisfaction: 93 },
  { month: 'Jan', completion: 89, engagement: 87, efficiency: 88, satisfaction: 89 },
  { month: 'Feb', completion: 94, engagement: 96, efficiency: 91, satisfaction: 95 },
  { month: 'Mar', completion: 91, engagement: 93, efficiency: 89, satisfaction: 92 }
];

const trainingEffectivenessData = [
  { category: 'Safety Training', preScore: 65, postScore: 89, improvement: 24, participants: 145 },
  { category: 'Customer Service', preScore: 72, postScore: 91, improvement: 19, participants: 128 },
  { category: 'Product Knowledge', preScore: 68, postScore: 85, improvement: 17, participants: 156 },
  { category: 'Leadership Skills', preScore: 58, postScore: 82, improvement: 24, participants: 89 },
  { category: 'Compliance', preScore: 79, postScore: 95, improvement: 16, participants: 167 }
];

const regionalPerformanceData = [
  { region: 'North District', stores: 12, employees: 284, completion: 94, avgScore: 88, trend: 'up' },
  { region: 'South District', stores: 15, employees: 356, completion: 89, avgScore: 85, trend: 'up' },
  { region: 'East District', stores: 8, employees: 198, completion: 92, avgScore: 89, trend: 'stable' },
  { region: 'West District', stores: 11, employees: 267, completion: 87, avgScore: 83, trend: 'down' },
  { region: 'Central District', stores: 9, employees: 221, completion: 96, avgScore: 91, trend: 'up' }
];

const learningPathData = [
  { path: 'New Employee Onboarding', enrolled: 45, completed: 38, inProgress: 6, avgTime: '2.3 weeks' },
  { path: 'Management Development', enrolled: 23, completed: 18, inProgress: 4, avgTime: '6.2 weeks' },
  { path: 'Safety Certification', enrolled: 178, completed: 145, inProgress: 28, avgTime: '1.8 weeks' },
  { path: 'Customer Excellence', enrolled: 156, completed: 134, inProgress: 19, avgTime: '3.1 weeks' },
  { path: 'Technical Skills', enrolled: 89, completed: 72, inProgress: 15, avgTime: '4.5 weeks' }
];

const complianceData = [
  { category: 'Safety Protocols', required: 189, completed: 184, overdue: 5, upcoming: 0, score: 97 },
  { category: 'Data Protection', required: 156, completed: 148, overdue: 3, upcoming: 5, score: 95 },
  { category: 'HR Policies', required: 203, completed: 195, overdue: 2, upcoming: 6, score: 96 },
  { category: 'Quality Standards', required: 167, completed: 159, overdue: 4, upcoming: 4, score: 95 },
  { category: 'Financial Procedures', required: 134, completed: 128, overdue: 6, upcoming: 0, score: 96 }
];

const engagementTrendData = [
  { week: 'W1', videoCompletion: 78, interactionRate: 65, averageScore: 82, timeSpent: 45 },
  { week: 'W2', videoCompletion: 82, interactionRate: 71, averageScore: 85, timeSpent: 48 },
  { week: 'W3', videoCompletion: 85, interactionRate: 74, averageScore: 87, timeSpent: 52 },
  { week: 'W4', videoCompletion: 89, interactionRate: 78, averageScore: 89, timeSpent: 55 },
  { week: 'W5', videoCompletion: 91, interactionRate: 82, averageScore: 91, timeSpent: 58 },
  { week: 'W6', videoCompletion: 88, interactionRate: 79, averageScore: 88, timeSpent: 54 }
];

export function Analytics({ currentRole, onBackToDashboard }: AnalyticsProps) {
  const [activeReport, setActiveReport] = useState<ReportType>('performance');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    toast.success(`Exporting analytics as ${format.toUpperCase()}...`, {
      description: 'Your analytics report will be ready for download shortly.',
      duration: 3000
    });
  };

  const handleScheduleReport = () => {
    toast.success('Analytics report scheduled successfully!', {
      description: 'You will receive this analytics report weekly via email.',
      duration: 3000
    });
  };

  const getTimeRangeLabel = (range: TimeRange) => {
    switch (range) {
      case '7d': return 'Last 7 days';
      case '30d': return 'Last 30 days';
      case '90d': return 'Last 90 days';
      case '1y': return 'Last year';
      case 'custom': return 'Custom range';
      default: return 'Last 30 days';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground">Advanced Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive analytics and insights for {currentRole === 'admin' ? 'system-wide' : currentRole === 'district-manager' ? 'district' : 'store'} performance
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
          <Button variant="outline" onClick={handleScheduleReport}>
            <Mail className="h-4 w-4 mr-2" />
            Schedule
          </Button>
          <Button variant="outline" onClick={() => handleExport('pdf')}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button className="hero-primary shadow-brand">
            <Share className="h-4 w-4 mr-2" />
            Share Analytics
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="hover-lift">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="h-5 w-5 mr-2" />
              Analytics Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Time Range</label>
                <Select value={timeRange} onValueChange={(value: TimeRange) => setTimeRange(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="1y">Last year</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {(currentRole === 'admin' || currentRole === 'district-manager') && (
                <div>
                  <label className="text-sm font-medium">Region/District</label>
                  <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Regions</SelectItem>
                      <SelectItem value="north">North District</SelectItem>
                      <SelectItem value="south">South District</SelectItem>
                      <SelectItem value="east">East District</SelectItem>
                      <SelectItem value="west">West District</SelectItem>
                      <SelectItem value="central">Central District</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium">Department</label>
                <Select defaultValue="all">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="management">Management</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="customer-service">Customer Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium">Job Role</label>
                <Select defaultValue="all">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="associates">Sales Associates</SelectItem>
                    <SelectItem value="supervisors">Supervisors</SelectItem>
                    <SelectItem value="managers">Managers</SelectItem>
                    <SelectItem value="leads">Team Leads</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analytics Navigation Tabs */}
      <Tabs value={activeReport} onValueChange={(value: ReportType) => setActiveReport(value)} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-accent">
          <TabsTrigger value="performance" className="font-medium">
            <BarChart3 className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="training" className="font-medium">
            <BookOpen className="w-4 h-4 mr-2" />
            Training
          </TabsTrigger>
          <TabsTrigger value="compliance" className="font-medium">
            <CheckCircle className="w-4 h-4 mr-2" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="custom" className="font-medium">
            <Target className="w-4 h-4 mr-2" />
            Custom
          </TabsTrigger>
        </TabsList>

        {/* Performance Analytics */}
        <TabsContent value="performance" className="space-y-6 mt-6">
          {/* KPI Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="hover-lift">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Overall Completion</p>
                    <p className="text-2xl font-bold text-foreground">94.2%</p>
                    <div className="flex items-center mt-1">
                      <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                      <span className="text-sm text-green-600">+2.4%</span>
                    </div>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-lift">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg. Score</p>
                    <p className="text-2xl font-bold text-foreground">88.7</p>
                    <div className="flex items-center mt-1">
                      <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                      <span className="text-sm text-green-600">+1.8</span>
                    </div>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <Award className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-lift">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Learners</p>
                    <p className="text-2xl font-bold text-foreground">1,247</p>
                    <div className="flex items-center mt-1">
                      <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                      <span className="text-sm text-green-600">+156</span>
                    </div>
                  </div>
                  <div className="p-3 bg-orange-100 rounded-full">
                    <Users className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-lift">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Overdue Tasks</p>
                    <p className="text-2xl font-bold text-foreground">23</p>
                    <div className="flex items-center mt-1">
                      <TrendingDown className="h-4 w-4 text-green-500 mr-1" />
                      <span className="text-sm text-green-600">-8</span>
                    </div>
                  </div>
                  <div className="p-3 bg-red-100 rounded-full">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Trends Chart */}
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Performance Trends Over Time</span>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">{getTimeRangeLabel(timeRange)}</Badge>
                  <Button variant="ghost" size="sm">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="completion" 
                    fill="#F74A05" 
                    fillOpacity={0.3}
                    stroke="#F74A05"
                    name="Completion Rate"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="engagement" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    name="Engagement Score"
                  />
                  <Bar 
                    dataKey="satisfaction" 
                    fill="#3B82F6" 
                    name="Satisfaction"
                    opacity={0.8}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Regional Performance */}
          {(currentRole === 'admin' || currentRole === 'district-manager') && (
            <Card className="hover-lift">
              <CardHeader>
                <CardTitle>Regional Performance Breakdown</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Performance metrics across all districts and regions
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {regionalPerformanceData.map((region, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-accent/30 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Building className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{region.region}</h4>
                          <p className="text-sm text-muted-foreground">
                            {region.stores} stores • {region.employees} employees
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Completion</p>
                          <p className="font-bold text-primary">{region.completion}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Avg Score</p>
                          <p className="font-bold">{region.avgScore}</p>
                        </div>
                        <div className="flex items-center">
                          {getTrendIcon(region.trend)}
                        </div>
                        <div className="w-32">
                          <Progress value={region.completion} className="h-2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Engagement Analytics */}
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle>Learner Engagement Analytics</CardTitle>
              <p className="text-sm text-muted-foreground">
                Detailed analysis of learning engagement patterns
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={engagementTrendData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="videoCompletion" 
                    stackId="1"
                    stroke="#F74A05" 
                    fill="#F74A05" 
                    fillOpacity={0.6}
                    name="Video Completion %"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="interactionRate" 
                    stackId="2"
                    stroke="#10b981" 
                    fill="#10b981" 
                    fillOpacity={0.6}
                    name="Interaction Rate %"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="averageScore" 
                    stackId="3"
                    stroke="#3B82F6" 
                    fill="#3B82F6" 
                    fillOpacity={0.6}
                    name="Average Score"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Training Analytics */}
        <TabsContent value="training" className="space-y-6 mt-6">
          {/* Training Effectiveness */}
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle>Training Effectiveness Analysis</CardTitle>
              <p className="text-sm text-muted-foreground">
                Pre/post assessment comparison showing learning impact
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={trainingEffectivenessData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="preScore" fill="#e2e8f0" name="Pre-Training Score" />
                  <Bar dataKey="postScore" fill="#F74A05" name="Post-Training Score" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Learning Paths Performance */}
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle>Learning Path Performance</CardTitle>
              <p className="text-sm text-muted-foreground">
                Enrollment and completion statistics for each learning path
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {learningPathData.map((path, index) => (
                  <div key={index} className="p-4 bg-accent/30 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">{path.path}</h4>
                      <Badge variant="outline">{path.avgTime} avg completion</Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 mb-3">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Enrolled</p>
                        <p className="font-bold text-blue-600">{path.enrolled}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Completed</p>
                        <p className="font-bold text-green-600">{path.completed}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">In Progress</p>
                        <p className="font-bold text-orange-600">{path.inProgress}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Completion Rate</p>
                        <p className="font-bold text-primary">
                          {Math.round((path.completed / path.enrolled) * 100)}%
                        </p>
                      </div>
                    </div>
                    <Progress 
                      value={(path.completed / path.enrolled) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Training ROI Calculator */}
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle>Training ROI & Impact Analysis</CardTitle>
              <p className="text-sm text-muted-foreground">
                Calculate return on investment and business impact of training programs
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6 bg-green-50 rounded-lg">
                  <div className="p-3 bg-green-100 rounded-full w-fit mx-auto mb-3">
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="font-bold text-2xl text-green-700">324%</h3>
                  <p className="text-sm text-green-600">Average ROI</p>
                  <p className="text-xs text-muted-foreground mt-1">Based on productivity gains</p>
                </div>
                
                <div className="text-center p-6 bg-blue-50 rounded-lg">
                  <div className="p-3 bg-blue-100 rounded-full w-fit mx-auto mb-3">
                    <Users className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-2xl text-blue-700">89%</h3>
                  <p className="text-sm text-blue-600">Employee Satisfaction</p>
                  <p className="text-xs text-muted-foreground mt-1">Post-training surveys</p>
                </div>
                
                <div className="text-center p-6 bg-orange-50 rounded-lg">
                  <div className="p-3 bg-orange-100 rounded-full w-fit mx-auto mb-3">
                    <Clock className="h-8 w-8 text-orange-600" />
                  </div>
                  <h3 className="font-bold text-2xl text-orange-700">2.3x</h3>
                  <p className="text-sm text-orange-600">Faster Task Completion</p>
                  <p className="text-xs text-muted-foreground mt-1">Average improvement</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Analytics */}
        <TabsContent value="compliance" className="space-y-6 mt-6">
          {/* Compliance Overview */}
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle>Compliance Status Overview</CardTitle>
              <p className="text-sm text-muted-foreground">
                Current compliance status across all categories and requirements
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {complianceData.map((item, index) => (
                  <div key={index} className="p-4 bg-accent/30 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">{item.category}</h4>
                      <Badge 
                        variant={item.score >= 95 ? "default" : item.score >= 90 ? "secondary" : "destructive"}
                        className={
                          item.score >= 95 ? "bg-green-100 text-green-800" :
                          item.score >= 90 ? "bg-blue-100 text-blue-800" :
                          "bg-red-100 text-red-800"
                        }
                      >
                        {item.score}% Compliant
                      </Badge>
                    </div>
                    <div className="grid grid-cols-5 gap-4 mb-3 text-center">
                      <div>
                        <p className="text-sm text-muted-foreground">Required</p>
                        <p className="font-bold">{item.required}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Completed</p>
                        <p className="font-bold text-green-600">{item.completed}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Overdue</p>
                        <p className="font-bold text-red-600">{item.overdue}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Upcoming</p>
                        <p className="font-bold text-orange-600">{item.upcoming}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Score</p>
                        <p className="font-bold text-primary">{item.score}%</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>Completed</span>
                          <span>{Math.round((item.completed / item.required) * 100)}%</span>
                        </div>
                        <Progress value={(item.completed / item.required) * 100} className="h-2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Compliance Risk Heat Map */}
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle>Compliance Risk Assessment</CardTitle>
              <p className="text-sm text-muted-foreground">
                Visual representation of compliance risks across different areas
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                {complianceData.map((item, index) => (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg text-center ${
                      item.overdue === 0 ? 'bg-green-100' :
                      item.overdue <= 3 ? 'bg-yellow-100' :
                      'bg-red-100'
                    }`}
                  >
                    <h4 className="font-semibold text-sm mb-2">{item.category}</h4>
                    <p className={`text-2xl font-bold ${
                      item.overdue === 0 ? 'text-green-700' :
                      item.overdue <= 3 ? 'text-yellow-700' :
                      'text-red-700'
                    }`}>
                      {item.overdue}
                    </p>
                    <p className="text-xs text-muted-foreground">overdue items</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Audit Trail */}
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle>Recent Compliance Activities</CardTitle>
              <p className="text-sm text-muted-foreground">
                Audit trail of recent compliance-related activities and updates
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { action: 'Safety Protocol Update', user: 'John Admin', date: '2 hours ago', type: 'update' },
                  { action: 'HR Policy Completion', user: 'Sarah Manager', date: '4 hours ago', type: 'completion' },
                  { action: 'Quality Standards Review', user: 'Mike Supervisor', date: '1 day ago', type: 'review' },
                  { action: 'Data Protection Training', user: 'Lisa Associate', date: '2 days ago', type: 'training' },
                  { action: 'Financial Procedure Audit', user: 'System Admin', date: '3 days ago', type: 'audit' }
                ].map((activity, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-accent/30 rounded-lg">
                    <div className={`p-2 rounded-full ${
                      activity.type === 'completion' ? 'bg-green-100' :
                      activity.type === 'update' ? 'bg-blue-100' :
                      activity.type === 'audit' ? 'bg-red-100' :
                      'bg-gray-100'
                    }`}>
                      {activity.type === 'completion' && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {activity.type === 'update' && <RefreshCw className="h-4 w-4 text-blue-600" />}
                      {activity.type === 'audit' && <Eye className="h-4 w-4 text-red-600" />}
                      {activity.type === 'training' && <BookOpen className="h-4 w-4 text-orange-600" />}
                      {activity.type === 'review' && <FileText className="h-4 w-4 text-purple-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{activity.action}</p>
                      <p className="text-sm text-muted-foreground">by {activity.user}</p>
                    </div>
                    <span className="text-sm text-muted-foreground">{activity.date}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Analytics */}
        <TabsContent value="custom" className="space-y-6 mt-6">
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle>Custom Analytics Builder</CardTitle>
              <p className="text-sm text-muted-foreground">
                Create tailored analytics with specific metrics and visualizations
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Available Data Sources</h4>
                  <div className="space-y-2">
                    {[
                      'Employee Performance Metrics',
                      'Training Completion Data',
                      'Engagement Analytics',
                      'Compliance Records',
                      'Assessment Scores',
                      'Time Tracking Data',
                      'Regional Performance',
                      'Learning Path Progress'
                    ].map((source, index) => (
                      <div key={index} className="flex items-center space-x-2 p-2 bg-accent/30 rounded">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm">{source}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3">Visualization Options</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                      <BarChart3 className="h-6 w-6 mb-1" />
                      <span className="text-xs">Bar Chart</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                      <Activity className="h-6 w-6 mb-1" />
                      <span className="text-xs">Line Chart</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                      <PieChartIcon className="h-6 w-6 mb-1" />
                      <span className="text-xs">Pie Chart</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                      <Target className="h-6 w-6 mb-1" />
                      <span className="text-xs">Gauge</span>
                    </Button>
                  </div>
                  
                  <div className="mt-6">
                    <Button className="w-full hero-primary shadow-brand">
                      <Zap className="h-4 w-4 mr-2" />
                      Generate Custom Analytics
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Saved Analytics */}
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle>Saved Custom Analytics</CardTitle>
              <p className="text-sm text-muted-foreground">
                Your previously created and saved custom analytics
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: 'Monthly Performance Summary', created: '2024-01-10', lastRun: '2024-01-15' },
                  { name: 'Training ROI Analysis', created: '2024-01-08', lastRun: '2024-01-14' },
                  { name: 'Regional Compliance Analysis', created: '2024-01-05', lastRun: '2024-01-12' },
                  { name: 'Employee Engagement Trends', created: '2024-01-03', lastRun: '2024-01-11' }
                ].map((report, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-accent/30 rounded-lg">
                    <div>
                      <h4 className="font-medium">{report.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Created: {report.created} • Last run: {report.lastRun}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}