import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  ArrowLeft,
  Edit,
  Eye,
  Users,
  FileText,
  Calendar,
  Clock,
  TrendingUp,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Share2,
  MoreVertical,
  History,
  ChevronDown,
  ChevronRight,
  Link2,
  Check,
  QrCode,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { getFormVersions, type FormVersion } from '../../lib/crud/formVersions';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface FormDetailProps {
  formId: string;
  orgId?: string;
  onBack: () => void;
  onEdit: () => void;
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
}

// Mock data for submissions
const mockSubmissions = [
  {
    id: '1',
    submittedBy: 'John Smith',
    unit: 'Store A - Downtown',
    date: '2024-02-18',
    time: '09:30 AM',
    status: 'Approved',
    score: 95
  },
  {
    id: '2',
    submittedBy: 'Emma Davis',
    unit: 'Store B - Westside',
    date: '2024-02-18',
    time: '08:15 AM',
    status: 'Pending',
    score: 87
  },
  {
    id: '3',
    submittedBy: 'Michael Chen',
    unit: 'Store C - Northgate',
    date: '2024-02-17',
    time: '02:45 PM',
    status: 'Approved',
    score: 92
  },
  {
    id: '4',
    submittedBy: 'Sarah Wilson',
    unit: 'Store A - Downtown',
    date: '2024-02-17',
    time: '11:20 AM',
    status: 'Needs Review',
    score: 78
  },
  {
    id: '5',
    submittedBy: 'Alex Rodriguez',
    unit: 'Store D - Southpark',
    date: '2024-02-16',
    time: '03:30 PM',
    status: 'Approved',
    score: 98
  }
];

// Mock activity data
const mockActivity = [
  {
    id: '1',
    type: 'submission',
    user: 'John Smith',
    action: 'submitted a form',
    time: '2 hours ago'
  },
  {
    id: '2',
    type: 'assignment',
    user: 'Sarah Johnson',
    action: 'assigned form to New Hires',
    time: '5 hours ago'
  },
  {
    id: '3',
    type: 'edit',
    user: 'Mike Chen',
    action: 'updated form settings',
    time: '1 day ago'
  },
  {
    id: '4',
    type: 'submission',
    user: 'Emma Davis',
    action: 'submitted a form',
    time: '1 day ago'
  },
  {
    id: '5',
    type: 'approval',
    user: 'Sarah Johnson',
    action: 'approved submission',
    time: '2 days ago'
  }
];

// Chart data
const submissionTrendData = [
  { date: 'Feb 12', submissions: 12 },
  { date: 'Feb 13', submissions: 15 },
  { date: 'Feb 14', submissions: 8 },
  { date: 'Feb 15', submissions: 18 },
  { date: 'Feb 16', submissions: 14 },
  { date: 'Feb 17', submissions: 20 },
  { date: 'Feb 18', submissions: 16 }
];

const completionRateData = [
  { name: 'Completed', value: 87, color: '#10b981' },
  { name: 'Pending', value: 8, color: '#f59e0b' },
  { name: 'Incomplete', value: 5, color: '#ef4444' }
];

const scoreDistributionData = [
  { range: '0-50', count: 2 },
  { range: '51-70', count: 8 },
  { range: '71-85', count: 15 },
  { range: '86-95', count: 32 },
  { range: '96-100', count: 27 }
];

export function FormDetail({ formId, orgId, onBack, onEdit, currentRole = 'admin' }: FormDetailProps) {
  const { t } = useTranslation();
  const [selectedView, setSelectedView] = useState<'overview' | 'submissions'>('overview');
  const [versions, setVersions] = useState<FormVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const publicFillUrl = `${window.location.origin}/fill/${formId}`;

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicFillUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = publicFillUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }, [publicFillUrl]);

  const handleDownloadQR = useCallback(() => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `form-${formId}-qrcode.png`;
    link.href = url;
    link.click();
  }, [formId]);

  useEffect(() => {
    if (!versionHistoryOpen) return;
    let cancelled = false;
    setVersionsLoading(true);
    getFormVersions(formId)
      .then((data) => {
        if (!cancelled) setVersions(data);
      })
      .catch((err) => {
        console.error('Failed to load form versions:', err);
      })
      .finally(() => {
        if (!cancelled) setVersionsLoading(false);
      });
    return () => { cancelled = true; };
  }, [formId, versionHistoryOpen]);

  // Mock form data based on formId
  const formData = {
    id: formId,
    title: 'Store Daily Walk',
    type: 'Inspection',
    status: 'Published',
    createdDate: '2024-01-15',
    updatedDate: '2024-02-15',
    createdBy: 'Mike Chen',
    updatedBy: 'Sarah Johnson',
    totalSubmissions: 234,
    activeAssignments: 8,
    tags: ['Daily', 'Recurring', 'Ops'],
    description: 'Daily inspection form for store managers to ensure operational standards are met.'
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {status}
          </Badge>
        );
      case 'Pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-0">
            <Clock className="h-3 w-3 mr-1" />
            {status}
          </Badge>
        );
      case 'Needs Review':
        return (
          <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-0">
            <AlertCircle className="h-3 w-3 mr-1" />
            {status}
          </Badge>
        );
      default:
        return null;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'submission':
        return <FileText className="h-4 w-4" />;
      case 'assignment':
        return <Users className="h-4 w-4" />;
      case 'edit':
        return <Edit className="h-4 w-4" />;
      case 'approval':
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('forms.formDetailBackToLibrary')}
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={shareOpen ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShareOpen((v) => !v)}
            className={shareOpen ? 'bg-brand-gradient text-white' : ''}
          >
            <Share2 className="h-4 w-4 mr-2" />
            {t('forms.formDetailShare')}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            {t('forms.formDetailExport')}
          </Button>
          <Button
            className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
            onClick={onEdit}
          >
            <Edit className="h-4 w-4 mr-2" />
            {t('forms.formDetailEditForm')}
          </Button>
        </div>
      </div>

      {/* Form Title and Status */}
      <div>
        <div className="flex items-center space-x-3 mb-2">
          <h1 className="text-foreground">{formData.title}</h1>
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0">
            {formData.status}
          </Badge>
        </div>
        <p className="text-muted-foreground">{formData.description}</p>
      </div>

      {/* Share Panel */}
      {shareOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <QrCode className="h-5 w-5" />
              <span>{t('forms.shareFormHeading')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* QR Code */}
              <div
                ref={qrRef}
                className="flex-shrink-0 bg-white p-4 rounded-lg border"
              >
                <QRCodeCanvas
                  value={publicFillUrl}
                  size={180}
                  level="H"
                  includeMargin={false}
                />
              </div>

              {/* Link and Actions */}
              <div className="flex-1 space-y-4 w-full">
                <div>
                  <p className="text-sm font-medium mb-1">{t('forms.publicFillLink')}</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {t('forms.publicFillLinkDesc')}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-md px-3 py-2 text-sm font-mono truncate border">
                      {publicFillUrl}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyLink}
                      className="flex-shrink-0"
                    >
                      {linkCopied ? (
                        <>
                          <Check className="h-4 w-4 mr-1 text-green-600" />
                          {t('forms.copied')}
                        </>
                      ) : (
                        <>
                          <Link2 className="h-4 w-4 mr-1" />
                          {t('forms.copyLinkButton')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={handleDownloadQR}>
                    <Download className="h-4 w-4 mr-2" />
                    {t('forms.downloadQrCodeButton')}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {t('forms.downloadQrAsPng')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('forms.totalSubmissionsLabel')}</p>
                <p className="text-3xl font-bold mt-2">{formData.totalSubmissions}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('forms.activeAssignments')}</p>
                <p className="text-3xl font-bold mt-2">{formData.activeAssignments}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('forms.completionRateLabel')}</p>
                <p className="text-3xl font-bold mt-2">87%</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('forms.avgScoreLabel')}</p>
                <p className="text-3xl font-bold mt-2">91.5</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Activity className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>{t('forms.formInformation')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t('forms.createdLabel')}</p>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{new Date(formData.createdDate).toLocaleDateString()}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">by {formData.createdBy}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">{t('forms.lastUpdated')}</p>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{new Date(formData.updatedDate).toLocaleDateString()}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">by {formData.updatedBy}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">{t('forms.formType')}</p>
              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-0">
                {formData.type}
              </Badge>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">{t('forms.tagsLabel')}</p>
              <div className="flex flex-wrap gap-1">
                {formData.tags.map((tag, index) => (
                  <Badge 
                    key={index}
                    className="bg-brand-gradient text-white border-0 text-xs"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Form Preview */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Eye className="h-5 w-5" />
                <span>{t('forms.formPreview')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">Store Cleanliness</Label>
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 rounded-full border-2 border-primary bg-primary" />
                    <span className="text-sm">Excellent</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                    <span className="text-sm">Good</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                    <span className="text-sm">Needs Improvement</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm">
                    Safety Equipment Check
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 rounded border-2 border-primary bg-primary" />
                      <span className="text-sm">Fire extinguishers present</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 rounded border-2 border-primary bg-primary" />
                      <span className="text-sm">First aid kit stocked</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 rounded border-2 border-muted-foreground" />
                      <span className="text-sm">Emergency exits clear</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm">Additional Notes</Label>
                  <Textarea placeholder="Enter any additional observations..." rows={3} className="text-sm" />
                </div>

                <div className="pt-4">
                  <Button className="w-full bg-brand-gradient text-white shadow-brand hover:opacity-90" size="sm">
                    {t('forms.submitForm')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Charts and Data */}
        <div className="lg:col-span-2 space-y-6">
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Submission Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('forms.submissionTrend')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={submissionTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12, fill: '#9ca3af' }}
                      stroke="#9ca3af"
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: '#9ca3af' }}
                      stroke="#9ca3af"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="submissions" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Completion Rate */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('forms.completionStatus')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={completionRateData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {completionRateData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center space-x-4 mt-4">
                  {completionRateData.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div 
                        className="h-3 w-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {item.name} ({item.value}%)
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Score Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('forms.scoreDistribution')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={scoreDistributionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis 
                    dataKey="range" 
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                    stroke="#9ca3af"
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                    stroke="#9ca3af"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Submissions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t('forms.recentSubmissions')}</CardTitle>
                <Button variant="outline" size="sm">
                  {t('forms.viewAll')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockSubmissions.map((submission) => (
                  <div 
                    key={submission.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-brand-gradient text-white">
                          {submission.submittedBy.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{submission.submittedBy}</p>
                        <p className="text-xs text-muted-foreground">{submission.unit}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{submission.date}</p>
                        <p className="text-xs text-muted-foreground">{submission.time}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold">{submission.score}</p>
                        <p className="text-xs text-muted-foreground">{t('forms.scoreLabel')}</p>
                      </div>
                      {getStatusBadge(submission.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle>{t('forms.activityFeed')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockActivity.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{activity.user}</span>{' '}
                    <span className="text-muted-foreground">{activity.action}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Version History */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setVersionHistoryOpen(prev => !prev)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <History className="h-5 w-5" />
              <span>{t('forms.versionHistory')}</span>
            </CardTitle>
            {versionHistoryOpen
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            }
          </div>
        </CardHeader>

        {versionHistoryOpen && (
          <CardContent>
            {versionsLoading ? (
              <p className="text-sm text-muted-foreground">{t('forms.loadingVersions')}</p>
            ) : versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('forms.noPublishedVersions')}</p>
            ) : (
              <div className="space-y-2">
                {versions.map((v) => {
                  const blockCount = v.snapshot?.blocks?.length ?? 0;
                  const publishedDate = new Date(v.published_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const isExpanded = expandedVersionId === v.id;

                  return (
                    <div key={v.id} className="border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                        onClick={() => setExpandedVersionId(isExpanded ? null : v.id)}
                      >
                        <div className="flex items-center space-x-3">
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          }
                          <span className="font-medium text-sm">v{v.version_number}</span>
                          <span className="text-sm text-muted-foreground">{publishedDate}</span>
                        </div>
                        <Badge className="bg-muted text-muted-foreground border-0 text-xs">
                          {blockCount} {blockCount === 1 ? t('forms.blockSingular') : t('forms.blockPlural')}
                        </Badge>
                      </button>

                      {isExpanded && (
                        <div className="border-t px-4 py-3 bg-muted/20">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                            {t('forms.snapshotLabel', { title: v.snapshot.title })}
                          </p>
                          {blockCount === 0 ? (
                            <p className="text-xs text-muted-foreground">{t('forms.noBlocksInVersion')}</p>
                          ) : (
                            <ol className="space-y-1">
                              {v.snapshot.blocks.map((b, idx) => (
                                <li key={b.id} className="flex items-center space-x-2 text-xs">
                                  <span className="text-muted-foreground w-5 text-right flex-shrink-0">
                                    {idx + 1}.
                                  </span>
                                  <span className="font-medium">{b.label || t('forms.unlabeled')}</span>
                                  <Badge className="bg-muted text-muted-foreground border-0 text-xs py-0">
                                    {b.type}
                                  </Badge>
                                  {b.is_required && (
                                    <span className="text-red-500 text-xs">{t('forms.requiredLabel')}</span>
                                  )}
                                </li>
                              ))}
                            </ol>
                          )}
                          {v.change_notes && (
                            <p className="mt-3 text-xs text-muted-foreground italic">
                              {t('forms.changeNote', { note: v.change_notes })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
