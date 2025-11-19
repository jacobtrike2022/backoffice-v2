import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { 
  ArrowLeft,
  Mail,
  Phone,
  Building,
  Calendar,
  Award,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Clock,
  Send,
  Key,
  Edit,
  Save,
  X,
  Activity,
  BarChart3,
  PieChart,
  Shield,
  FileCheck,
  BookOpen,
  Target,
  Zap,
  MessageSquare,
  Bell
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

type UserRole = 'admin' | 'district-manager' | 'store-manager';

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
  status: 'valid' | 'expiring-soon' | 'expired';
  score: number;
}

const mockActivityFeed: ActivityItem[] = [
  {
    id: '1',
    type: 'completion',
    title: 'Completed Safety Training Module',
    description: 'Workplace Safety Fundamentals - Score: 95%',
    timestamp: '2 hours ago',
    icon: CheckCircle,
    iconColor: 'text-green-600'
  },
  {
    id: '2',
    type: 'certification',
    title: 'Earned New Certification',
    description: 'Advanced Customer Service Excellence',
    timestamp: '1 day ago',
    icon: Award,
    iconColor: 'text-blue-600'
  },
  {
    id: '3',
    type: 'login',
    title: 'Logged into Training Portal',
    description: 'Accessed from mobile device',
    timestamp: '2 days ago',
    icon: Activity,
    iconColor: 'text-purple-600'
  },
  {
    id: '4',
    type: 'assignment',
    title: 'New Content Assigned',
    description: 'Product Knowledge Series - 5 modules',
    timestamp: '3 days ago',
    icon: BookOpen,
    iconColor: 'text-orange-600'
  },
  {
    id: '5',
    type: 'completion',
    title: 'Completed Quiz',
    description: 'Sales Techniques Assessment - Score: 88%',
    timestamp: '5 days ago',
    icon: CheckCircle,
    iconColor: 'text-green-600'
  }
];

const mockCertifications: Certification[] = [
  {
    id: '1',
    name: 'Safety & Compliance Level 2',
    issueDate: 'Jan 15, 2024',
    expiryDate: 'Jan 15, 2025',
    status: 'valid',
    score: 95
  },
  {
    id: '2',
    name: 'Customer Service Excellence',
    issueDate: 'Nov 10, 2024',
    expiryDate: 'Nov 10, 2025',
    status: 'valid',
    score: 92
  },
  {
    id: '3',
    name: 'Product Knowledge Expert',
    issueDate: 'Oct 5, 2024',
    expiryDate: 'Dec 20, 2024',
    status: 'expiring-soon',
    score: 88
  },
  {
    id: '4',
    name: 'Leadership Fundamentals',
    issueDate: 'Sep 1, 2024',
    expiryDate: 'Sep 1, 2025',
    status: 'valid',
    score: 90
  },
  {
    id: '5',
    name: 'First Aid & Emergency Response',
    issueDate: 'Mar 20, 2024',
    expiryDate: 'Oct 15, 2024',
    status: 'expired',
    score: 85
  }
];

// Mock data for charts
const performanceData = [
  { month: 'Jun', completed: 3, score: 85 },
  { month: 'Jul', completed: 4, score: 88 },
  { month: 'Aug', completed: 2, score: 82 },
  { month: 'Sep', completed: 5, score: 92 },
  { month: 'Oct', completed: 4, score: 90 },
  { month: 'Nov', completed: 6, score: 95 }
];

const categoryData = [
  { name: 'Safety', value: 8, color: '#F74A05' },
  { name: 'Product', value: 5, color: '#FF733C' },
  { name: 'Customer Service', value: 4, color: '#3B82F6' },
  { name: 'Compliance', value: 3, color: '#10b981' }
];

const complianceData = [
  { category: 'Safety', score: 95, required: 90 },
  { category: 'HR Policies', score: 88, required: 85 },
  { category: 'Data Security', score: 92, required: 90 },
  { category: 'Ethics', score: 100, required: 95 }
];

export function EmployeeProfile({ employee, onBack, currentRole }: EmployeeProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(employee.name);
  const [editedEmail, setEditedEmail] = useState(employee.email);
  const [activeTab, setActiveTab] = useState('overview');
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [reminderSMS, setReminderSMS] = useState(true);
  const [reminderPush, setReminderPush] = useState(true);
  const [reminderEmail, setReminderEmail] = useState(true);

  const handleSave = () => {
    toast.success('Employee information updated successfully', {
      description: `Changes saved for ${editedName}`
    });
    setIsEditing(false);
  };

  const handleResetPassword = () => {
    toast.success('Password reset email sent', {
      description: `Reset link sent to ${employee.email}`
    });
  };

  const handleSendReminder = () => {
    setShowReminderDialog(true);
  };

  const handleConfirmReminder = () => {
    toast.success('Reminder sent successfully', {
      description: `Training reminder sent to ${employee.name}`
    });
    setShowReminderDialog(false);
  };

  const getCertificationStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
        return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400';
      case 'expiring-soon':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'expired':
        return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400';
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
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={editedEmail}
                        onChange={(e) => setEditedEmail(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">{employee.name}</h2>
                      <p className="text-muted-foreground mt-1">{employee.role}</p>
                    </div>

                    <div className="flex items-center space-x-6 text-sm">
                      <div className="flex items-center space-x-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>{employee.email}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-muted-foreground">
                        <Building className="h-4 w-4" />
                        <span>{employee.homeStore}</span>
                      </div>
                      {currentRole === 'admin' && (
                        <div className="flex items-center space-x-2 text-muted-foreground">
                          <Target className="h-4 w-4" />
                          <span>{employee.district} District</span>
                        </div>
                      )}
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
                        {employee.certifications} Certifications
                      </Badge>
                      <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400">
                        Last active {employee.lastActive}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col space-y-2">
              {isEditing ? (
                <>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    className="bg-brand-gradient hover:opacity-90 text-white shadow-brand"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setEditedName(employee.name);
                      setEditedEmail(employee.email);
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  {(currentRole === 'admin' || currentRole === 'district-manager') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  )}
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
                </>
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
              <p className="text-3xl font-bold text-foreground">{employee.completedTracks}<span className="text-lg text-muted-foreground">/{employee.totalTracks}</span></p>
            </div>

            <div className="text-center border-l border-border pl-6">
              <p className="text-sm text-muted-foreground mb-1">Compliance Score</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{employee.complianceScore}%</p>
            </div>

            <div className="text-center border-l border-border pl-6">
              <p className="text-sm text-muted-foreground mb-1">Certifications</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{employee.certifications}</p>
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
          <TabsTrigger value="certifications">
            <Award className="w-4 h-4 mr-2" />
            Certifications
          </TabsTrigger>
          <TabsTrigger value="compliance">
            <Shield className="w-4 h-4 mr-2" />
            Compliance
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Performance Charts */}
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChart className="w-5 h-5 mr-2 text-primary" />
                  Course Distribution by Category
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
                        <p className="text-sm font-medium text-foreground">Completion Rate</p>
                        <p className="text-xs text-muted-foreground">Last 30 days</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">94%</p>
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
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">89%</p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                        <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Time Invested</p>
                        <p className="text-xs text-muted-foreground">Total learning hours</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">42h</p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                        <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Engagement Score</p>
                        <p className="text-xs text-muted-foreground">Platform activity</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">8.5</p>
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
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockActivityFeed.map((activity, index) => (
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
                    {index < mockActivityFeed.length - 1 && (
                      <Separator className="my-4" />
                    )}
                  </div>
                ))}
              </div>
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
                  Certifications & Credentials
                </div>
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                  {mockCertifications.filter(c => c.status === 'valid').length} Active
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockCertifications.map((cert) => (
                  <div key={cert.id} className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-foreground">{cert.name}</h3>
                          <Badge variant="outline" className={getCertificationStatusColor(cert.status)}>
                            {cert.status.replace('-', ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>Issued: {cert.issueDate}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>Expires: {cert.expiryDate}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Award className="h-3 w-3" />
                            <span>Score: {cert.score}%</span>
                          </div>
                        </div>
                      </div>
                      {cert.status === 'expiring-soon' && (
                        <Button size="sm" variant="outline" className="ml-4">
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          Renew
                        </Button>
                      )}
                      {cert.status === 'expired' && (
                        <Button size="sm" className="ml-4 bg-red-600 hover:bg-red-700 text-white">
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          Recertify
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Compliance Score Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-primary" />
                  Compliance Score by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={complianceData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="category" className="text-xs" />
                    <YAxis className="text-xs" domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Legend />
                    <Bar dataKey="score" fill="#F74A05" name="Current Score" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="required" fill="#94a3b8" name="Required Score" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Compliance Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileCheck className="w-5 h-5 mr-2 text-primary" />
                  Compliance Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {complianceData.map((item, index) => (
                    <div key={index} className="p-4 bg-accent/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-foreground">{item.category}</h4>
                        <Badge 
                          variant="outline" 
                          className={item.score >= item.required 
                            ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400' 
                            : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400'}
                        >
                          {item.score >= item.required ? 'Compliant' : 'At Risk'}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Score: {item.score}%</span>
                          <span className="text-muted-foreground">Required: {item.required}%</span>
                        </div>
                        <Progress 
                          value={(item.score / item.required) * 100} 
                          className="h-2"
                          indicatorClassName={item.score >= item.required ? 'bg-green-500' : 'bg-red-500'}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Compliance Requirements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2 text-primary" />
                Upcoming Compliance Requirements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Annual Safety Refresher</p>
                      <p className="text-sm text-muted-foreground">Due in 15 days</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleSendReminder}>
                    <Send className="h-4 w-4 mr-2" />
                    Send Reminder
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <FileCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Data Privacy Training</p>
                      <p className="text-sm text-muted-foreground">Due in 30 days</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleSendReminder}>
                    <Send className="h-4 w-4 mr-2" />
                    Send Reminder
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Ethics & Conduct Review</p>
                      <p className="text-sm text-muted-foreground">Completed</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400">
                    Compliant
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reminder Dialog */}
      <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Send Training Reminder</DialogTitle>
            <DialogDescription>
              Select the channels to send the training reminder to {employee.name}.
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
                <MessageSquare className="h-4 w-4 text-primary" />
                <span>SMS</span>
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="push"
                checked={reminderPush}
                onCheckedChange={(checked) => setReminderPush(checked as boolean)}
              />
              <Label htmlFor="push" className="flex items-center space-x-2 cursor-pointer">
                <Bell className="h-4 w-4 text-primary" />
                <span>Push Notification</span>
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="email"
                checked={reminderEmail}
                onCheckedChange={(checked) => setReminderEmail(checked as boolean)}
              />
              <Label htmlFor="email" className="flex items-center space-x-2 cursor-pointer">
                <Mail className="h-4 w-4 text-primary" />
                <span>Email</span>
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowReminderDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmReminder}
              className="bg-brand-gradient hover:opacity-90 text-white shadow-brand"
              disabled={!reminderSMS && !reminderPush && !reminderEmail}
            >
              <Send className="h-4 w-4 mr-2" />
              Send Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}