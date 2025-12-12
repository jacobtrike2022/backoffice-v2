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
import * as unitTagCrud from '../lib/crud/unitTags';
import * as storeCrud from '../lib/crud/stores';
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
  // Additional fields from database
  address?: string;
  address_line_2?: string;
  zip?: string;
  county?: string;
  phone?: string;
  store_email?: string;
  photo_url?: string;
  timezone?: string;
  created_at?: string;
  updated_at?: string;
  managerEmail?: string;
  managerId?: string;
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

// Helper function to get activity icon and color
const getActivityIcon = (type: string) => {
  switch (type) {
    case 'completion':
      return { icon: CheckCircle, color: 'text-green-600' };
    case 'certification':
      return { icon: Award, color: 'text-blue-600' };
    case 'alert':
      return { icon: AlertTriangle, color: 'text-orange-600' };
    case 'assignment':
      return { icon: Activity, color: 'text-purple-600' };
    default:
      return { icon: Activity, color: 'text-gray-600' };
  }
};

export function StoreDetail({ store, onBack, currentRole, onEdit }: StoreDetailProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [tags, setTags] = useState<string[]>([]);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  
  // Data state
  const [performanceData, setPerformanceData] = useState<Array<{ month: string; progress: number; compliance: number; engagement: number }>>([]);
  const [employeeProgressData, setEmployeeProgressData] = useState<Array<{ name: string; progress: number }>>([]);
  const [storeActivity, setStoreActivity] = useState<Array<{ id: string; type: string; employee: string; title: string; description: string; timestamp: string; created_at: string }>>([]);
  const [quickStats, setQuickStats] = useState<{ completionRate: number; certifications: number; learningHours: number; overdueItems: number } | null>(null);
  const [engagementScore, setEngagementScore] = useState<number>(0);
  
  // Loading states
  const [loadingPerformance, setLoadingPerformance] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [photoError, setPhotoError] = useState(false);

  React.useEffect(() => {
    if (store.id) {
      loadTags();
      loadStoreData();
    }
  }, [store.id]);

  const loadStoreData = async () => {
    try {
      // Load all data in parallel
      await Promise.all([
        loadPerformanceTrends(),
        loadEmployeeProgress(),
        loadActivity(),
        loadQuickStats()
      ]);
    } catch (error) {
      console.error('Error loading store data:', error);
      toast.error('Failed to load some store data');
    }
  };

  const loadPerformanceTrends = async () => {
    try {
      setLoadingPerformance(true);
      const data = await storeCrud.getStorePerformanceTrends(store.id);
      setPerformanceData(data);
      
      // Calculate engagement score from latest month's engagement
      if (data.length > 0) {
        const latestEngagement = data[data.length - 1].engagement;
        setEngagementScore(latestEngagement);
      }
    } catch (error) {
      console.error('Error loading performance trends:', error);
    } finally {
      setLoadingPerformance(false);
    }
  };

  const loadEmployeeProgress = async () => {
    try {
      setLoadingEmployees(true);
      const data = await storeCrud.getStoreEmployeeProgress(store.id, 10);
      setEmployeeProgressData(data);
    } catch (error) {
      console.error('Error loading employee progress:', error);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const loadActivity = async () => {
    try {
      setLoadingActivity(true);
      const data = await storeCrud.getStoreActivity(store.id, 20);
      setStoreActivity(data);
    } catch (error) {
      console.error('Error loading activity:', error);
    } finally {
      setLoadingActivity(false);
    }
  };

  const loadQuickStats = async () => {
    try {
      setLoadingStats(true);
      const data = await storeCrud.getStoreQuickStats(store.id);
      setQuickStats(data);
    } catch (error) {
      console.error('Error loading quick stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadTags = async () => {
    try {
      const unitTags = await unitTagCrud.getUnitTags(store.id);
      setTags(unitTags.map((ut: any) => ut.tag?.name).filter(Boolean));
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const handleTagsChange = async (newTags: string[], tagObjects?: any[]) => {
    setTags(newTags);
    
    if (tagObjects) {
      const tagIds = tagObjects.map(t => t.id);
      try {
        await unitTagCrud.replaceUnitTags(store.id, tagIds);
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
              {store.photo_url && !photoError ? (
                <div className="h-20 w-20 rounded-xl overflow-hidden flex-shrink-0 border-2 border-primary/10">
                  <img 
                    src={store.photo_url} 
                    alt={store.name}
                    className="h-full w-full object-cover"
                    onError={() => setPhotoError(true)}
                  />
                </div>
              ) : (
                <div className="h-20 w-20 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building className="h-10 w-10 text-primary" />
                </div>
              )}

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
                  {store.timezone && currentRole === 'admin' && (
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{store.timezone}</span>
                    </div>
                  )}
                </div>
                
                {/* Audit Info for Admin */}
                {currentRole === 'admin' && (store.created_at || store.updated_at) && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {store.created_at && (
                      <span>Created: {new Date(store.created_at).toLocaleDateString()}</span>
                    )}
                    {store.created_at && store.updated_at && <span className="mx-2">•</span>}
                    {store.updated_at && (
                      <span>Updated: {new Date(store.updated_at).toLocaleDateString()}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-3 flex-wrap">
                  {store.store_email && (
                    <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                      <Mail className="h-3 w-3 mr-1" />
                      {store.store_email}
                    </Badge>
                  )}
                  {store.phone && (
                    <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400">
                      <Phone className="h-3 w-3 mr-1" />
                      {store.phone}
                    </Badge>
                  )}
                </div>
                
                {/* Full Address */}
                {(store.address || store.city || store.state || store.zip) && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div>
                        {store.address && <div>{store.address}</div>}
                        {store.address_line_2 && <div>{store.address_line_2}</div>}
                        <div>
                          {[store.city, store.state, store.zip].filter(Boolean).join(', ')}
                          {store.county && ` (${store.county} County)`}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{engagementScore}</p>
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
                {loadingPerformance ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Loading performance data...
                  </div>
                ) : performanceData.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No performance data available
                  </div>
                ) : (
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
                )}
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
                {loadingEmployees ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Loading employee data...
                  </div>
                ) : employeeProgressData.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No employee progress data available
                  </div>
                ) : (
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
                )}
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
                {loadingPerformance ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Loading engagement data...
                  </div>
                ) : performanceData.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No engagement data available
                  </div>
                ) : (
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
                )}
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
                    {loadingStats ? (
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">...</p>
                    ) : (
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">{quickStats?.completionRate || 0}%</p>
                    )}
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
                    {loadingStats ? (
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">...</p>
                    ) : (
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{quickStats?.certifications || 0}</p>
                    )}
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
                    {loadingStats ? (
                      <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">...</p>
                    ) : (
                      <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{quickStats?.learningHours || 0}h</p>
                    )}
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
                    {loadingStats ? (
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">...</p>
                    ) : (
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">{quickStats?.overdueItems || 0}</p>
                    )}
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
              {loadingActivity ? (
                <div className="py-8 text-center text-muted-foreground">
                  Loading activity feed...
                </div>
              ) : storeActivity.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No recent activity
                </div>
              ) : (
                <div className="space-y-4">
                  {storeActivity.map((activity, index) => {
                    const { icon: IconComponent, color } = getActivityIcon(activity.type);
                    const colorName = color.split('-')[1]; // 'green', 'blue', etc.
                    const bgColorClass = {
                      'green': 'bg-green-100 dark:bg-green-900/30',
                      'blue': 'bg-blue-100 dark:bg-blue-900/30',
                      'orange': 'bg-orange-100 dark:bg-orange-900/30',
                      'purple': 'bg-purple-100 dark:bg-purple-900/30',
                      'gray': 'bg-gray-100 dark:bg-gray-900/30'
                    }[colorName] || 'bg-gray-100 dark:bg-gray-900/30';
                    
                    return (
                      <div key={activity.id}>
                        <div className="flex items-start space-x-4">
                          <div className={`h-10 w-10 rounded-lg ${bgColorClass} flex items-center justify-center flex-shrink-0`}>
                            <IconComponent className={`h-5 w-5 ${color} dark:${color.replace('600', '400')}`} />
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
                        {index < storeActivity.length - 1 && (
                          <Separator className="my-4" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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