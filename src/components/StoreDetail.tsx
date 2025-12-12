import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  ArrowLeft,
  Building,
  Users,
  TrendingUp,
  Target,
  CheckCircle,
  Award,
  Activity,
  BarChart3,
  Clock,
  AlertTriangle,
  MapPin,
  Mail,
  Phone,
  Pencil
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Reports } from './Reports';
import { Info, Tag as TagIcon, Plus } from 'lucide-react';
import { TagSelectorDialog } from './TagSelectorDialog';
import * as tagCrud from '../lib/crud/tags';
import { toast } from 'sonner@2.0.3';

type UserRole = 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';

interface Store {
  id: string;
  name: string;
  storeNumber: string;
  district: string;
  manager: string;
  employees: number;
  avgProgress: number;
  compliance: number;
  performance: 'excellent' | 'good' | 'needs-improvement';
  city: string;
  state: string;
}

interface StoreDetailProps {
  store: Store;
  onBack: () => void;
  currentRole: UserRole;
  onEdit?: () => void;  // NEW: Callback to trigger edit mode
}

interface ActivityItem {
  id: string;
  type: 'completion' | 'certification' | 'assignment' | 'alert';
  employee: string;
  title: string;
  description: string;
  timestamp: string;
  icon: React.ComponentType<any>;
  iconColor: string;
}

const mockStoreActivity: ActivityItem[] = [
  {
    id: '1',
    type: 'completion',
    employee: 'Sarah Johnson',
    title: 'Training Module Completed',
    description: 'Advanced Customer Service Excellence - Score: 95%',
    timestamp: '1 hour ago',
    icon: CheckCircle,
    iconColor: 'text-green-600'
  },
  {
    id: '2',
    type: 'certification',
    employee: 'Michael Chen',
    title: 'New Certification Earned',
    description: 'Safety & Compliance Level 2',
    timestamp: '3 hours ago',
    icon: Award,
    iconColor: 'text-blue-600'
  },
  {
    id: '3',
    type: 'alert',
    employee: 'Christopher Lee',
    title: 'Compliance Alert',
    description: 'Annual Safety Refresher due in 5 days',
    timestamp: '5 hours ago',
    icon: AlertTriangle,
    iconColor: 'text-orange-600'
  },
  {
    id: '4',
    type: 'assignment',
    employee: 'Store Team',
    title: 'New Content Assigned',
    description: 'Product Knowledge Update Series - 3 modules',
    timestamp: '1 day ago',
    icon: Activity,
    iconColor: 'text-purple-600'
  },
  {
    id: '5',
    type: 'completion',
    employee: 'Jessica Park',
    title: 'Quiz Completed',
    description: 'Sales Techniques Assessment - Score: 92%',
    timestamp: '1 day ago',
    icon: CheckCircle,
    iconColor: 'text-green-600'
  }
];

// Mock performance data
const performanceData = [
  { month: 'Jun', progress: 75, compliance: 88, engagement: 82 },
  { month: 'Jul', progress: 78, compliance: 90, engagement: 85 },
  { month: 'Aug', progress: 80, compliance: 89, engagement: 83 },
  { month: 'Sep', progress: 82, compliance: 91, engagement: 87 },
  { month: 'Oct', progress: 84, compliance: 92, engagement: 89 },
  { month: 'Nov', progress: 85, compliance: 92, engagement: 90 }
];

const employeeProgressData = [
  { name: 'Sarah Johnson', progress: 95 },
  { name: 'Michael Chen', progress: 92 },
  { name: 'Jessica Park', progress: 88 },
  { name: 'David Thompson', progress: 78 },
  { name: 'Christopher Lee', progress: 65 }
];

export function StoreDetail({ store, onBack, currentRole, onEdit }: StoreDetailProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [tags, setTags] = useState<string[]>([]);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);

  React.useEffect(() => {
    if (store.id) {
      loadTags();
    }
  }, [store.id]);

  const loadTags = async () => {
    try {
      const storeTags = await tagCrud.getEntityTags(store.id, 'store');
      setTags(storeTags.map(t => t.name));
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const handleTagsChange = async (newTags: string[], tagObjects?: any[]) => {
    setTags(newTags);
    
    if (tagObjects) {
      const tagIds = tagObjects.map(t => t.id);
      try {
        await tagCrud.assignTags(store.id, 'store', tagIds);
        toast.success('Tags updated successfully');
      } catch (error) {
        console.error('Error updating tags:', error);
        toast.error('Failed to update tags');
      }
    }
  };

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'excellent':
        return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400';
      case 'good':
        return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400';
      case 'needs-improvement':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 60) return 'bg-blue-500';
    if (progress >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="hover:bg-accent"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Units
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-foreground">Unit Details</h1>
            <p className="text-muted-foreground mt-1">
              Performance and training metrics for {store.name}
            </p>
          </div>
        </div>
        {/* Edit Button - only show for admins */}
        {currentRole === 'admin' && onEdit && (
          <Button
            onClick={onEdit}
            className="bg-brand-gradient hover:opacity-90 text-white shadow-brand"
          >
            <Pencil className="w-4 h-4 mr-2" />
            Edit Unit
          </Button>
        )}
      </div>

      {/* Store Header Card */}
      <Card className="border-2 border-primary/10">
        <CardContent className="p-8">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-6">
              <div className="h-20 w-20 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building className="h-10 w-10 text-primary" />
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center space-x-3">
                    <h2 className="text-2xl font-bold text-foreground">{store.name}</h2>
                    <span className="text-muted-foreground">{store.storeNumber}</span>
                    <Badge variant="outline" className={getPerformanceColor(store.performance)}>
                      {store.performance.replace('-', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1">Store Manager: {store.manager}</p>
                </div>

                <div className="flex items-center space-x-6 text-sm">
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{store.city}, {store.state}</span>
                  </div>
                  {currentRole === 'admin' && (
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      <Target className="h-4 w-4" />
                      <span>{store.district} District</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{store.employees} Employees</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                    <Mail className="h-3 w-3 mr-1" />
                    {store.manager.toLowerCase().replace(' ', '.')}@trike.com
                  </Badge>
                  <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400">
                    <Phone className="h-3 w-3 mr-1" />
                    (555) 123-4567
                  </Badge>
                </div>

                {/* Tags Section */}
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  {tags.map((tag, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary"
                      className="bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 transition-colors"
                    >
                      <TagIcon className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                  {currentRole === 'admin' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsTagSelectorOpen(true)}
                      className="h-6 px-2 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Manage Tags
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <Separator className="my-6" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Avg. Training Progress</p>
              <div className="flex items-center space-x-3">
                <Progress 
                  value={store.avgProgress} 
                  className="h-3 flex-1"
                  indicatorClassName={getProgressColor(store.avgProgress)}
                />
                <span className="text-lg font-bold text-foreground">{store.avgProgress}%</span>
              </div>
            </div>

            <div className="text-center border-l border-border pl-6">
              <p className="text-sm text-muted-foreground mb-1">Compliance Score</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{store.compliance}%</p>
            </div>

            <div className="text-center border-l border-border pl-6">
              <p className="text-sm text-muted-foreground mb-1">Active Employees</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{store.employees}</p>
            </div>

            <div className="text-center border-l border-border pl-6">
              <p className="text-sm text-muted-foreground mb-1">Engagement Score</p>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">8.5</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="w-4 h-4 mr-2" />
            Activity Feed
          </TabsTrigger>
          <TabsTrigger value="reports">
            <BarChart3 className="w-4 h-4 mr-2" />
            Reports
          </TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Performance Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-primary" />
                  Performance Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={performanceData}>
                    <defs>
                      <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F74A05" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#F74A05" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCompliance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="progress" 
                      stroke="#F74A05" 
                      fillOpacity={1} 
                      fill="url(#colorProgress)"
                      name="Training Progress"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="compliance" 
                      stroke="#10b981" 
                      fillOpacity={1} 
                      fill="url(#colorCompliance)"
                      name="Compliance"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Employee Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2 text-primary" />
                  Employee Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={employeeProgressData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" domain={[0, 100]} className="text-xs" />
                    <YAxis dataKey="name" type="category" className="text-xs" width={100} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="progress" fill="#F74A05" name="Progress %" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Monthly Engagement */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-primary" />
                  Engagement Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="engagement" 
                      stroke="#8B5CF6" 
                      strokeWidth={3}
                      dot={{ fill: '#8B5CF6', r: 5 }}
                      name="Engagement %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="w-5 h-5 mr-2 text-primary" />
                  Quick Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Completion Rate</p>
                        <p className="text-xs text-muted-foreground">Last 30 days</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">91%</p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <Award className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Certifications</p>
                        <p className="text-xs text-muted-foreground">Active certifications</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">32</p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                        <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Learning Hours</p>
                        <p className="text-xs text-muted-foreground">Total this month</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">156h</p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Overdue Items</p>
                        <p className="text-xs text-muted-foreground">Requires attention</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">2</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Activity Feed Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="w-5 h-5 mr-2 text-primary" />
                Recent Store Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockStoreActivity.map((activity, index) => (
                  <div key={activity.id}>
                    <div className="flex items-start space-x-4">
                      <div className={`h-10 w-10 rounded-lg bg-${activity.iconColor.split('-')[1]}-100 dark:bg-${activity.iconColor.split('-')[1]}-900/30 flex items-center justify-center flex-shrink-0`}>
                        {React.createElement(activity.icon, { 
                          className: `h-5 w-5 ${activity.iconColor} dark:${activity.iconColor.replace('600', '400')}` 
                        })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="font-medium text-foreground">{activity.title}</p>
                          <Badge variant="outline" className="text-xs">
                            {activity.employee}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-2 flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {activity.timestamp}
                        </p>
                      </div>
                    </div>
                    {index < mockStoreActivity.length - 1 && (
                      <Separator className="my-4" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-primary" />
                Store Reports - {store.name} {store.storeNumber}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                <div className="flex items-start space-x-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">Auto-Filtered Report</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                      This report is automatically filtered to show data for <span className="font-semibold">{store.name}</span> only. 
                      You can add additional filters below.
                    </p>
                  </div>
                </div>
              </div>
              <Reports currentRole={currentRole} storeFilter={store.name} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Tag Selector Dialog */}
      <TagSelectorDialog
        isOpen={isTagSelectorOpen}
        onClose={() => setIsTagSelectorOpen(false)}
        selectedTags={tags}
        onTagsChange={handleTagsChange}
        systemCategory="units"
      />
    </div>
  );
}