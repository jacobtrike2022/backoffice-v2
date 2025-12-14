import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Skeleton } from './ui/skeleton';
import { TagSelectorDialog } from './TagSelectorDialog';
import * as tagCrud from '../lib/crud/tags';
import { 
  ArrowLeft,
  Mail,
  Phone,
  Building,
  Calendar,
  CalendarX,
  Award,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Clock,
  Send,
  Key,
  Edit,
  Pencil,
  Activity,
  BarChart3,
  PieChart,
  Shield,
  FileCheck,
  BookOpen,
  Target,
  Zap,
  MessageSquare,
  Bell,
  Tag as TagIcon,
  Plus,
  Hash
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  PieChart as RechartsPie, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { toast } from 'sonner@2.0.3';
import { supabase } from '../lib/supabase';
import { useCurrentUser } from '../lib/hooks/useSupabase';
import { resetPassword } from '../lib/hooks/useAuth';
import { createNotification } from '../lib/crud/notifications';
import { getUserCertifications } from '../lib/crud/certifications';
import { ExternalLink } from 'lucide-react';
import { EditPeopleDialog } from './EditPeopleDialog';

type UserRole = 'admin' | 'administrator' | 'district-manager' | 'store-manager' | 'trike-super-admin';

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  homeStore: string;
  district: string;
  avatar?: string;
  progress: number;
  status: 'active' | 'inactive' | 'on-leave';
  completedTracks: number;
  totalTracks: number;
  lastActive: string;
  certifications: number;
  complianceScore: number;
  // Additional fields
  phone?: string;
  employeeId?: string;
  hireDate?: string;
  terminationDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface EmployeeProfileProps {
  employee: Employee;
  onBack: () => void;
  currentRole: UserRole;
}

interface ActivityItem {
  id: string;
  type: 'completion' | 'certification' | 'login' | 'assignment';
  title: string;
  description: string;
  timestamp: string;
  icon: React.ComponentType<any>;
  iconColor: string;
}

interface Certification {
  id: string;
  name: string;
  issueDate: string;
  expiryDate: string;
  status: 'active' | 'expiring-soon' | 'expired' | 'revoked';
  score?: number;
  certificateNumber?: string;
  certificateUrl?: string;
  issuedAt: string;
  expiresAt?: string;
}

export function EmployeeProfile({ employee, onBack, currentRole }: EmployeeProfileProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [reminderSMS, setReminderSMS] = useState(true);
  const [reminderPush, setReminderPush] = useState(true);
  const [reminderEmail, setReminderEmail] = useState(true);
  
  // Real data states
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [userProgress, setUserProgress] = useState<any[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const { user: currentUser } = useCurrentUser();

  useEffect(() => {
    if (employee.id) {
      // Reset userDetails when employee changes to prevent showing stale data
      setUserDetails(null);
      setShowEditDialog(false);
      fetchEmployeeData();
    }
  }, [employee.id]);

  const fetchEmployeeData = async () => {
    try {
      setLoading(true);

      // Fetch full user details with all fields
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', employee.id)
        .single();

      if (userError) throw userError;
      setUserDetails(userData);

      // Fetch tags
      const employeeTags = await tagCrud.getEntityTags(employee.id, 'user');
      setTags(employeeTags.map(t => t.name));

      // Fetch certifications
      try {
        const certsData = await getUserCertifications(employee.id);
        const formattedCerts: Certification[] = (certsData || []).map((cert: any) => {
          // Schema uses issued_at and expires_at
          const expiryDate = cert.expires_at;
          const issueDate = cert.issued_at;
          const now = new Date();
          const expiresAt = expiryDate ? new Date(expiryDate) : null;
          
          let status: 'active' | 'expiring-soon' | 'expired' | 'revoked' = 'active';
          if (cert.status === 'revoked') {
            status = 'revoked';
          } else if (cert.status === 'expired') {
            status = 'expired';
          } else if (expiresAt) {
            const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntilExpiry < 0) {
              status = 'expired';
            } else if (daysUntilExpiry <= 30) {
              status = 'expiring-soon';
            }
          } else {
            // If no expiration date, keep as active
            status = 'active';
          }

          return {
            id: cert.id,
            name: cert.certification?.name || 'Unknown Certification',
            issueDate: issueDate || '',
            expiryDate: expiryDate || '',
            issuedAt: issueDate || '',
            expiresAt: expiryDate || undefined,
            status,
            score: cert.score,
            certificateNumber: cert.certificate_number,
            certificateUrl: cert.certificate_url
          };
        });
        setCertifications(formattedCerts);
      } catch (certError) {
        console.error('Error fetching certifications:', certError);
      }

      // Fetch assignments for this employee
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          *,
          playlist:playlists (
            id,
            title,
            description
          )
        `)
        .eq('user_id', employee.id)
        .order('assigned_at', { ascending: false })
        .limit(10);

      if (assignmentsError) throw assignmentsError;
      setAssignments(assignmentsData || []);

      // Fetch user progress records
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select(`
          *,
          track:tracks (
            id,
            title,
            type
          )
        `)
        .eq('user_id', employee.id)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (progressError) throw progressError;
      setUserProgress(progressData || []);

      // Build activity feed from assignments and progress
      const activities: ActivityItem[] = [];

      // Add completion activities
      progressData?.forEach(progress => {
        if (progress.status === 'completed' && progress.completed_at) {
          activities.push({
            id: progress.id,
            type: 'completion',
            title: `Completed ${progress.track?.title || 'Track'}`,
            description: `Score: ${progress.score || 'N/A'}%`,
            timestamp: formatTimestamp(progress.completed_at),
            icon: CheckCircle,
            iconColor: 'text-green-600'
          });
        }
      });

      // Add assignment activities
      assignmentsData?.forEach(assignment => {
        activities.push({
          id: assignment.id,
          type: 'assignment',
          title: `Assigned ${assignment.playlist?.title || 'Playlist'}`,
          description: assignment.playlist?.description || '',
          timestamp: formatTimestamp(assignment.assigned_at),
          icon: BookOpen,
          iconColor: 'text-orange-600'
        });
      });

      // Sort by timestamp (most recent first)
      activities.sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setActivityFeed(activities.slice(0, 10)); // Keep only 10 most recent

    } catch (err) {
      console.error('Error fetching employee data:', err);
      toast.error('Failed to load employee details');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const handleTagsChange = async (newTags: string[], tagObjects?: any[]) => {
    setTags(newTags);
    
    if (tagObjects) {
      const tagIds = tagObjects.map(t => t.id);
      try {
        await tagCrud.assignTags(employee.id, 'user', tagIds);
        toast.success('Tags updated successfully');
      } catch (error) {
        console.error('Error updating tags:', error);
        toast.error('Failed to update tags');
      }
    }
  };

  const handleEditSuccess = () => {
    // Refresh the page to show updated data
    window.location.reload();
  };

  const handleResetPassword = async () => {
    try {
      await resetPassword(employee.email);
      toast.success('Password reset email sent', {
        description: `Reset link sent to ${employee.email}`
      });
    } catch (err: any) {
      console.error('Error resetting password:', err);
      toast.error('Failed to send password reset email', {
        description: err.message || 'Please try again later'
      });
    }
  };

  const handleSendReminder = () => {
    setShowReminderDialog(true);
  };

  const handleConfirmReminder = async () => {
    try {
      const notificationTypes: string[] = [];
      if (reminderEmail) notificationTypes.push('email');
      if (reminderSMS) notificationTypes.push('SMS');
      if (reminderPush) notificationTypes.push('push notification');

      // Create notification in database
      // Note: The notification system currently only supports in-app notifications.
      // Channel selection (email/SMS/push) is collected for UI feedback but actual
      // multi-channel delivery would require additional integration.
      await createNotification({
        user_id: employee.id,
        type: 'due-date',
        title: 'Training Reminder',
        message: `You have pending training assignments that require your attention.`,
        link_url: '/assignments'
      });

      const channelText = notificationTypes.length > 0 
        ? ` via ${notificationTypes.join(', ')}` 
        : '';
      toast.success('Reminder sent successfully', {
        description: `Training reminder sent to ${employee.name}${channelText}`
      });
      setShowReminderDialog(false);
    } catch (err: any) {
      console.error('Error sending reminder:', err);
      toast.error('Failed to send reminder', {
        description: err.message || 'Please try again later'
      });
    }
  };

  const getCertificationStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'valid':
        return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400';
      case 'expiring-soon':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'expired':
        return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400';
      case 'revoked':
        return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 90) return 'bg-green-500';
    if (progress >= 80) return 'bg-blue-500';
    if (progress >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Calculate statistics from real data
  const completedCount = userProgress.filter(p => p.status === 'completed').length;
  const inProgressCount = userProgress.filter(p => p.status === 'in_progress').length;
  const avgScore = userProgress.filter(p => p.score).reduce((acc, p) => acc + (p.score || 0), 0) / 
                   (userProgress.filter(p => p.score).length || 1);

  // Build performance data from user_progress with dynamic months
  const performanceData = (() => {
    // Get all completion dates and determine date range
    const completionDates = userProgress
      .filter(p => p.completed_at)
      .map(p => new Date(p.completed_at))
      .sort((a, b) => a.getTime() - b.getTime());

    if (completionDates.length === 0) {
      // Return last 6 months if no data
      const months: string[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(date.toLocaleDateString('en-US', { month: 'short' }));
      }
      return months.map(month => ({ month, completed: 0, score: 0 }));
    }

    const startDate = completionDates[0];
    const endDate = completionDates[completionDates.length - 1];
    
    // Generate months between start and end (or last 6 months if range is smaller)
    // Store both the display string and the actual date for accurate matching
    const now = new Date();
    const monthsToShow = Math.max(6, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    const actualMonths = Math.min(monthsToShow, 12); // Cap at 12 months
    
    interface MonthData {
      display: string;
      year: number;
      month: number;
    }
    
    const months: MonthData[] = [];
    for (let i = actualMonths - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        display: date.toLocaleDateString('en-US', { month: 'short' }),
        year: date.getFullYear(),
        month: date.getMonth()
      });
    }

    return months.map(monthData => {
      const monthProgress = userProgress.filter(p => {
        if (!p.completed_at) return false;
        const date = new Date(p.completed_at);
        // Match both month and year to avoid grouping data from different years
        return date.getMonth() === monthData.month && date.getFullYear() === monthData.year;
      });
      const completed = monthProgress.length;
      const score = monthProgress.reduce((acc, p) => acc + (p.score || 0), 0) / (completed || 1);
      return { month: monthData.display, completed, score: Math.round(score) };
    });
  })();

  // Build category distribution (simplified - using track types)
  const categoryData = (() => {
    const categories: { [key: string]: number } = {};
    userProgress.forEach(p => {
      const type = p.track?.type || 'Other';
      categories[type] = (categories[type] || 0) + 1;
    });
    
    const colors = ['#F74A05', '#FF733C', '#3B82F6', '#10b981', '#8B5CF6'];
    return Object.entries(categories).map(([name, value], index) => ({
      name,
      value,
      color: colors[index % colors.length]
    }));
  })();

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
            Back to People
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-foreground">Employee Profile</h1>
            <p className="text-muted-foreground mt-1">
              View and manage employee information and performance
            </p>
          </div>
        </div>
        {/* Edit Button - only show for admins and district managers */}
        {((currentRole === 'admin' || currentRole === 'administrator') || currentRole === 'district-manager' || currentRole === 'trike-super-admin') && (
          <Button
            onClick={() => setShowEditDialog(true)}
            className="bg-brand-gradient hover:opacity-90 text-white shadow-brand"
          >
            <Pencil className="w-4 h-4 mr-2" />
            Edit Employee
          </Button>
        )}
      </div>

      {/* Profile Header Card */}
      <Card className="border-2 border-primary/10">
        <CardContent className="p-8">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-6">
              <Avatar className="h-24 w-24 ring-4 ring-primary/20">
                <AvatarImage src={employee.avatar} alt={employee.name} />
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-2xl">
                  {employee.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-4">
                <>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">{employee.name}</h2>
                      <p className="text-muted-foreground mt-1">{employee.role}</p>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-8 text-muted-foreground">
                        <span>{employee.email}</span>
                        {employee.phone && <span>{employee.phone}</span>}
                        <span>{employee.homeStore}</span>
                        {currentRole === 'admin' && <span>{employee.district} District</span>}
                      </div>
                      <div className="flex items-center gap-8 text-muted-foreground">
                        {employee.employeeId && <span>ID: {employee.employeeId}</span>}
                        {employee.hireDate && (
                          <span>
                            Hired {new Date(employee.hireDate).toLocaleDateString()}
                            {(() => {
                              const hireDate = new Date(employee.hireDate);
                              const now = new Date();
                              const years = Math.floor((now.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
                              return years > 0 ? ` (${years} ${years === 1 ? 'year' : 'years'})` : '';
                            })()}
                          </span>
                        )}
                        {employee.terminationDate && employee.status === 'inactive' && (
                          <span>Terminated {new Date(employee.terminationDate).toLocaleDateString()}</span>
                        )}
                        {employee.createdAt && (
                          <span>Created {new Date(employee.createdAt).toLocaleDateString()}</span>
                        )}
                        {employee.updatedAt && (
                          <span>Updated {new Date(employee.updatedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Badge 
                        variant="outline" 
                        className={employee.status === 'active' 
                          ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-gray-100 text-gray-700 border-gray-200'}
                      >
                        {employee.status.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                        {assignments.length} Assignments
                      </Badge>
                      {employee.lastActive && employee.lastActive !== 'Never' && (
                        <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400">
                          Last active {employee.lastActive}
                        </Badge>
                      )}
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
                      {(currentRole === 'admin' || currentRole === 'district-manager') && (
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
                </>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col space-y-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSendReminder}
              >
                <Send className="w-4 h-4 mr-2" />
                Send Reminder
              </Button>
              {currentRole === 'admin' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResetPassword}
                >
                  <Key className="w-4 h-4 mr-2" />
                  Reset Password
                </Button>
              )}
            </div>
          </div>

          {/* Progress Stats */}
          <Separator className="my-6" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Training Progress</p>
              <div className="flex items-center space-x-3">
                <Progress 
                  value={employee.progress} 
                  className="h-3 flex-1"
                  indicatorClassName={getProgressColor(employee.progress)}
                />
                <span className="text-lg font-bold text-foreground">{employee.progress}%</span>
              </div>
            </div>

            <div className="text-center border-l border-border pl-6">
              <p className="text-sm text-muted-foreground mb-1">Tracks Completed</p>
              <p className="text-3xl font-bold text-foreground">{completedCount}<span className="text-lg text-muted-foreground">/{userProgress.length}</span></p>
            </div>

            <div className="text-center border-l border-border pl-6">
              <p className="text-sm text-muted-foreground mb-1">Average Score</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{Math.round(avgScore)}%</p>
            </div>

            <div className="text-center border-l border-border pl-6">
              <p className="text-sm text-muted-foreground mb-1">Active Assignments</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{assignments.filter(a => a.status !== 'completed').length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="w-4 h-4 mr-2" />
            Activity Feed
          </TabsTrigger>
          <TabsTrigger value="assignments">
            <BookOpen className="w-4 h-4 mr-2" />
            Assignments
          </TabsTrigger>
          <TabsTrigger value="certifications">
            <Award className="w-4 h-4 mr-2" />
            Certifications
            {certifications.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {certifications.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-64" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Performance Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-primary" />
                    Monthly Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={performanceData}>
                      <defs>
                        <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F74A05" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#F74A05" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="completed" 
                        stroke="#F74A05" 
                        fillOpacity={1} 
                        fill="url(#colorCompleted)"
                        name="Courses Completed"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Course Distribution Pie Chart */}
              {categoryData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <PieChart className="w-5 h-5 mr-2 text-primary" />
                      Course Distribution by Type
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPie>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }} 
                        />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Average Score Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2 text-primary" />
                    Average Scores Trend
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
                        dataKey="score" 
                        stroke="#F74A05" 
                        strokeWidth={3}
                        dot={{ fill: '#F74A05', r: 5 }}
                        name="Average Score"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Zap className="w-5 h-5 mr-2 text-primary" />
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
                          <p className="text-sm font-medium text-foreground">Completed</p>
                          <p className="text-xs text-muted-foreground">Total tracks</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedCount}</p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                          <Award className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Average Score</p>
                          <p className="text-xs text-muted-foreground">All assessments</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{Math.round(avgScore)}%</p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                          <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">In Progress</p>
                          <p className="text-xs text-muted-foreground">Active tracks</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{inProgressCount}</p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                          <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Assignments</p>
                          <p className="text-xs text-muted-foreground">Total assigned</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{assignments.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Activity Feed Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="w-5 h-5 mr-2 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : activityFeed.length > 0 ? (
                <div className="space-y-4">
                  {activityFeed.map((activity, index) => (
                    <div key={activity.id}>
                      <div className="flex items-start space-x-4">
                        <div className={`h-10 w-10 rounded-lg bg-${activity.iconColor.split('-')[1]}-100 dark:bg-${activity.iconColor.split('-')[1]}-900/30 flex items-center justify-center flex-shrink-0`}>
                          {React.createElement(activity.icon, { 
                            className: `h-5 w-5 ${activity.iconColor} dark:${activity.iconColor.replace('600', '400')}` 
                          })}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{activity.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                          <p className="text-xs text-muted-foreground mt-2 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {activity.timestamp}
                          </p>
                        </div>
                      </div>
                      {index < activityFeed.length - 1 && (
                        <Separator className="my-4" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <BookOpen className="w-5 h-5 mr-2 text-primary" />
                  Assignments
                </div>
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                  {assignments.filter(a => a.status !== 'completed').length} Active
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : assignments.length > 0 ? (
                <div className="space-y-4">
                  {assignments.map((assignment) => (
                    <div key={assignment.id} className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{assignment.playlist?.title || 'Untitled Playlist'}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{assignment.playlist?.description}</p>
                          <div className="flex items-center space-x-4 mt-3 text-xs text-muted-foreground">
                            <span className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                            </span>
                            {assignment.due_date && (
                              <span className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                Due {new Date(assignment.due_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <Badge 
                            variant="outline"
                            className={
                              assignment.status === 'completed' 
                                ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400'
                                : assignment.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-gray-100 text-gray-700 border-gray-200'
                            }
                          >
                            {assignment.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <div className="flex items-center space-x-2">
                            <Progress value={assignment.progress_percent || 0} className="h-2 w-24" />
                            <span className="text-sm font-semibold">{assignment.progress_percent || 0}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No assignments found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Certifications Tab */}
        <TabsContent value="certifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Award className="w-5 h-5 mr-2 text-primary" />
                  Certifications
                </div>
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                  {certifications.filter(c => c.status === 'active').length} Active
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : certifications.length > 0 ? (
                <div className="space-y-4">
                  {certifications.map((cert) => (
                    <div key={cert.id} className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="font-semibold text-foreground">{cert.name}</h4>
                            <Badge 
                              variant="outline"
                              className={getCertificationStatusColor(cert.status)}
                            >
                              {cert.status === 'expiring-soon' ? 'Expiring Soon' : cert.status.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3">
                            {cert.issueDate && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Issued</p>
                                <p className="font-medium text-foreground">
                                  {new Date(cert.issueDate).toLocaleDateString()}
                                </p>
                              </div>
                            )}
                            {cert.expiryDate && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Expires</p>
                                <p className="font-medium text-foreground">
                                  {new Date(cert.expiryDate).toLocaleDateString()}
                                  {cert.status === 'expiring-soon' && (
                                    <span className="text-yellow-600 dark:text-yellow-400 ml-1">
                                      ({Math.ceil((new Date(cert.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days)
                                    </span>
                                  )}
                                </p>
                              </div>
                            )}
                            {cert.certificateNumber && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Certificate #</p>
                                <p className="font-medium text-foreground">{cert.certificateNumber}</p>
                              </div>
                            )}
                            {cert.score !== undefined && cert.score !== null && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Score</p>
                                <p className="font-medium text-foreground">{cert.score}%</p>
                              </div>
                            )}
                          </div>
                        </div>
                        {cert.certificateUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(cert.certificateUrl, '_blank')}
                            className="ml-4"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Certificate
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No certifications found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reminder Dialog */}
      <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Training Reminder</DialogTitle>
            <DialogDescription>
              Select notification methods to remind {employee.name} about pending training
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="sms"
                checked={reminderSMS}
                onCheckedChange={(checked) => setReminderSMS(checked as boolean)}
              />
              <Label htmlFor="sms" className="flex items-center space-x-2 cursor-pointer">
                <MessageSquare className="h-4 w-4" />
                <span>Send SMS</span>
              </Label>
            </div>
            
            <div className="flex items-center space-x-3">
              <Checkbox
                id="push"
                checked={reminderPush}
                onCheckedChange={(checked) => setReminderPush(checked as boolean)}
              />
              <Label htmlFor="push" className="flex items-center space-x-2 cursor-pointer">
                <Bell className="h-4 w-4" />
                <span>Send Push Notification</span>
              </Label>
            </div>
            
            <div className="flex items-center space-x-3">
              <Checkbox
                id="email-reminder"
                checked={reminderEmail}
                onCheckedChange={(checked) => setReminderEmail(checked as boolean)}
              />
              <Label htmlFor="email-reminder" className="flex items-center space-x-2 cursor-pointer">
                <Mail className="h-4 w-4" />
                <span>Send Email</span>
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReminderDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmReminder}
              className="bg-brand-gradient hover:opacity-90 text-white"
            >
              <Send className="w-4 h-4 mr-2" />
              Send Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Selector Dialog */}
      <TagSelectorDialog
        isOpen={isTagSelectorOpen}
        onClose={() => setIsTagSelectorOpen(false)}
        selectedTags={tags}
        onTagsChange={handleTagsChange}
        systemCategory="people"
      />

      {/* Edit People Dialog */}
      {showEditDialog && (
        <EditPeopleDialog
          isOpen={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          user={userDetails}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}