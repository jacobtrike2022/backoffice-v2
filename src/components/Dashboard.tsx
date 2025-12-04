import React, { useState, useEffect } from 'react';
import { HeroMetrics } from './HeroMetrics';
import { ComparativeAnalytics } from './ComparativeAnalytics';
import { UnitPerformanceTable } from './UnitPerformanceTable';
import { ActivityFeed } from './ActivityFeed';
import { DistrictSummary } from './DistrictSummary';
import { EmployeePerformance } from './EmployeePerformance';
import { ComplianceDashboard } from './ComplianceDashboard';
import { Footer } from './Footer';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Skeleton } from './ui/skeleton';
import { 
  Plus, 
  Eye, 
  BarChart3, 
  TrendingUp, 
  Users, 
  Calendar, 
  Award, 
  ArrowRight,
  Zap,
  Library,
  Clock
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Line, BarChart, Bar } from 'recharts';
import { useCurrentUser, useAssignments } from '../lib/hooks/useSupabase';
import { getActivityAnalytics, getRecentActivity } from '../lib/crud';
import { getTopPerformingStores } from '../lib/crud/stores';

type UserRole = 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';

interface DashboardProps {
  currentRole: UserRole;
  onOpenAssignmentWizard?: () => void;
  onViewReports?: () => void;
  onNavigateToPlaylists?: () => void;
  onNavigateToUnits?: () => void;
  onNavigateToStore?: (storeId: string) => void;
  onNavigateToPlaylist?: (playlistId: string) => void;
}

export function Dashboard({ currentRole, onOpenAssignmentWizard, onViewReports, onNavigateToPlaylists, onNavigateToUnits, onNavigateToStore, onNavigateToPlaylist }: DashboardProps) {
  const [activeView, setActiveView] = useState('overview');
  const { user, loading: userLoading } = useCurrentUser();
  const { assignments, loading: assignmentsLoading } = useAssignments(); // Shows 5 most recent active assignments with live learner counts
  const [activityTrendData, setActivityTrendData] = useState<any[]>([]);
  const [engagementData, setEngagementData] = useState<any[]>([]);
  const [topPerformers, setTopPerformers] = useState<any[]>([]);
  const [engagementScore, setEngagementScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user?.organization_id) return;
      
      try {
        // Fetch activity analytics for the last 6 weeks
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 42); // 6 weeks

        const analytics = await getActivityAnalytics(user.organization_id, {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        });

        // Process activity trend data (weekly)
        const weeklyData = processWeeklyData(analytics.dailyCounts);
        setActivityTrendData(weeklyData);

        // Process engagement data (last 7 days)
        const dailyEngagement = processEngagementData(analytics.dailyCounts);
        setEngagementData(dailyEngagement);

        // Calculate engagement score (average activity per day)
        const totalDays = Object.keys(analytics.dailyCounts).length || 1;
        const avgDailyActivity = analytics.totalActivities / totalDays;
        const score = Math.min(100, Math.round(avgDailyActivity * 10)); // Scale to 0-100
        setEngagementScore(score);

        // Fetch top performing units
        const topUnits = await getTopPerformingStores(user.organization_id, 3);
        console.log('[Dashboard] Top performing units:', topUnits);
        setTopPerformers(topUnits);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error('Failed to load dashboard data');
        setLoading(false);
      }
    }

    if (user?.organization_id) {
      fetchDashboardData();
    }
  }, [user?.organization_id]);

  const processWeeklyData = (dailyCounts: Record<string, number>) => {
    const weeks = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      let completed = 0;
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        completed += dailyCounts[dateKey] || 0;
      }
      
      weeks.push({
        week: `W${6 - i}`,
        completed,
        target: 50 + (i * 2) // Progressive target
      });
    }
    
    return weeks;
  };

  const processEngagementData = (dailyCounts: Record<string, number>) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    const engagement = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const dayName = days[date.getDay()];
      
      engagement.push({
        day: dayName,
        score: Math.min(100, (dailyCounts[dateKey] || 0) * 10) // Scale to 0-100
      });
    }
    
    return engagement;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'on-track':
        return 'bg-blue-100 text-blue-700';
      case 'at-risk':
        return 'bg-yellow-100 text-yellow-700';
      case 'overdue':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleAssignContent = () => {
    if (onNavigateToPlaylists) {
      onNavigateToPlaylists();
    } else {
      toast.success('Opening Playlists page...');
    }
  };

  const handleViewReports = () => {
    if (onViewReports) {
      onViewReports();
    } else {
      toast.info('Reports view will be available soon');
    }
  };

  // Helper to check if role is admin-level
  const isAdminRole = currentRole === 'admin' || currentRole === 'trike-super-admin';

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdminRole && 'System overview and administration'}
            {currentRole === 'district-manager' && 'District performance and management'}
            {currentRole === 'store-manager' && 'Store operations and team management'}
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {isAdminRole && (
            <Button 
              size="sm"
              className="hero-primary shadow-brand"
              onClick={handleAssignContent}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Assign Content
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleViewReports}>
            <Eye className="w-4 h-4 mr-1.5" />
            Reports
          </Button>
        </div>
      </div>

      {/* Navigation Tabs for Admin */}
      {isAdminRole && (
        <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-3 bg-accent/50">
            <TabsTrigger value="overview" className="text-sm">
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-sm">
              <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="compliance" className="text-sm">
              <Award className="w-3.5 h-3.5 mr-1.5" />
              Compliance
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Hero Metrics */}
            <HeroMetrics currentRole={currentRole} />

            {/* Performance Overview - Full Width */}
            <Card className="border-border/50 shadow-sm w-full">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Performance Overview</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Completion trends vs targets</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs self-start sm:self-auto"
                    onClick={() => setActiveView('analytics')}
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Details
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                {loading ? (
                  <Skeleton className="h-250" />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={activityTrendData}>
                      <defs>
                        <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F74A05" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#F74A05" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" stroke="#e5e7eb" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="completed" 
                        stroke="#F74A05" 
                        strokeWidth={2}
                        fill="url(#completedGradient)" 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="target" 
                        stroke="#94a3b8" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Engagement Score - Full Width */}
            <Card className="border-border/50 shadow-sm w-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Weekly Engagement Score
                </CardTitle>
                <p className="text-xs text-muted-foreground">Last 7 days activity</p>
              </CardHeader>
              <CardContent className="pb-4">
                {loading ? (
                  <Skeleton className="h-120" />
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                      <div className="text-3xl font-bold">{engagementScore.toFixed(0)}<span className="text-lg text-muted-foreground">/100</span></div>
                      <div className="text-sm text-muted-foreground">Team engagement trending upward</div>
                    </div>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={engagementData}>
                        <Bar dataKey="score" fill="#F74A05" radius={[4, 4, 0, 0]} />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Active Playlists - Full Width */}
            <Card className="border-border/50 shadow-sm w-full">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className="text-base">Active Playlists</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs self-start sm:self-auto"
                    onClick={() => {
                      if (onNavigateToPlaylists) {
                        onNavigateToPlaylists();
                      }
                    }}
                  >
                    View All
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                {assignmentsLoading ? (
                  <Skeleton className="h-100" />
                ) : (
                  <div className="space-y-3">
                    {assignments.map((assignment) => (
                      <div 
                        key={assignment.id} 
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-accent/20 rounded-lg border border-border/50 hover:border-primary/50 transition-colors cursor-pointer"
                        onClick={() => {
                          if (onNavigateToPlaylist) {
                            onNavigateToPlaylist(assignment.id);
                          }
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm truncate">{assignment.title}</h4>
                            <Badge className={`${assignment.type === 'auto' ? 'bg-brand-gradient' : 'bg-secondary'} text-xs px-2 py-0 whitespace-nowrap`}>
                              {assignment.type === 'auto' ? 'Auto-Assigned' : 'Manual Assignment'}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              <Library className="h-3 w-3" />
                              {assignment.totalTracks} tracks
                            </span>
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              <Clock className="h-3 w-3" />
                              {assignment.totalDuration >= 60 
                                ? `${(assignment.totalDuration / 60).toFixed(1)} hrs`
                                : `${assignment.totalDuration} min`
                              }
                            </span>
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              <Users className="h-3 w-3" />
                              {assignment.assignedTo} learners
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 self-start sm:self-auto">
                          <div className="text-right min-w-[60px]">
                            <div className="text-sm font-bold">{assignment.completion}%</div>
                            <Progress value={assignment.completion} className="h-1 w-14 mt-1" />
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Performers - Full Width */}
            <Card className="border-border/50 shadow-sm w-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" />
                  Top Performing Units
                </CardTitle>
                <p className="text-xs text-muted-foreground">Stores ranked by average employee progress</p>
              </CardHeader>
              <CardContent className="pb-4">
                {loading ? (
                  <Skeleton className="h-100" />
                ) : (
                  <div className="space-y-3">
                    {topPerformers.map((performer) => (
                      <div key={performer.rank} className="flex items-center justify-between p-3 bg-accent/20 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                            performer.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                            performer.rank === 2 ? 'bg-gray-100 text-gray-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {performer.rank}
                          </div>
                          <span className="text-sm font-medium break-words">{performer.name}</span>
                        </div>
                        <div className="text-sm font-bold text-primary flex-shrink-0 ml-2">{performer.score}%</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Activity Feed - Full Width */}
            <ActivityFeed currentRole={currentRole} onNavigateToUnits={onNavigateToUnits} />

            {/* Unit Performance - Full Width */}
            <UnitPerformanceTable currentRole={currentRole} onNavigateToUnits={onNavigateToUnits} onNavigateToStore={onNavigateToStore} />
          </TabsContent>
          
          <TabsContent value="analytics" className="space-y-6 mt-6">
            <HeroMetrics currentRole={currentRole} />
            <ComparativeAnalytics currentRole={currentRole} />
            <DistrictSummary currentRole={currentRole} />
            <UnitPerformanceTable currentRole={currentRole} />
          </TabsContent>

          <TabsContent value="compliance" className="space-y-6 mt-6">
            <ComplianceDashboard currentRole={currentRole} />
          </TabsContent>
        </Tabs>
      )}

      {/* Standard view for non-admin roles */}
      {!isAdminRole && (
        <div className="space-y-6 w-full">
          {/* Hero Metrics */}
          <HeroMetrics currentRole={currentRole} />

          {/* Comparative Analytics - Full Width */}
          <ComparativeAnalytics currentRole={currentRole} />

          {/* District Summary for District Managers - Full Width */}
          {currentRole === 'district-manager' && (
            <UnitPerformanceTable currentRole={currentRole} />
          )}

          {/* Employee Performance for Store Managers - Full Width */}
          {currentRole === 'store-manager' && (
            <EmployeePerformance />
          )}

          {/* Activity Feed - Full Width */}
          <ActivityFeed currentRole={currentRole} />
        </div>
      )}
      <Footer />
    </div>
  );
}