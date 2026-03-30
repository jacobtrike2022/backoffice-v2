// ============================================================================
// COMPLIANCE DASHBOARD - MAIN COMPLIANCE ENGINE INTERFACE
// ============================================================================
// Central hub for the Trike Compliance Engine. Provides tabbed navigation
// to all compliance management features including assignment queue,
// requirements, playlists, and settings.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Separator } from '../ui/separator';
import {
  Shield,
  ClipboardList,
  FileCheck,
  ListMusic,
  Settings,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Building2,
  Calendar,
  ArrowRight,
  RefreshCw,
  Loader2,
  Upload,
  Download,
  MoreVertical
} from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../ui/dropdown-menu';
import { toast } from 'sonner';

// Import compliance components
import { AssignmentQueue } from './AssignmentQueue';
import { RequirementsManager } from './RequirementsManager';
import { PlaylistLockingPanel } from './PlaylistLockingPanel';
import { TopicsManager } from './TopicsManager';
import { AuthoritiesManager } from './AuthoritiesManager';
import { BulkCertImport } from './BulkCertImport';

// Import CRUD functions for dashboard stats
import {
  getComplianceAssignmentStats,
  getComplianceCoverage,
  getUpcomingExpirations,
  getAssignmentPipelineStats,
  exportComplianceReport,
  recalculateAllAssignments,
  type ComplianceAssignmentStats,
  type ComplianceCoverage,
  type UpcomingExpiration,
  type AssignmentPipelineStats
} from '../../lib/crud/complianceAssignments';
import { getComplianceRequirementsForOrg, type ComplianceRequirement } from '../../lib/crud/compliance';
import { getSystemLockedPlaylists, type SystemLockedAlbum } from '../../lib/crud/albums';
import { formatDate } from '../../lib/utils/dateFormat';

// ============================================================================
// TYPES
// ============================================================================

interface DashboardStats {
  assignments: ComplianceAssignmentStats | null;
  requirementCount: number;
  lockedPlaylistCount: number;
  activeRequirements: number;
  coverage: ComplianceCoverage | null;
  expirations: UpcomingExpiration[];
  pipeline: AssignmentPipelineStats | null;
}

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

interface QuickStatProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgClass: string;
  trend?: { value: number; label: string };
  onClick?: () => void;
}

function QuickStat({ title, value, subtitle, icon, iconBgClass, trend, onClick }: QuickStatProps) {
  return (
    <Card
      className={`${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 text-xs">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-green-600">{trend.value}%</span>
                <span className="text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          <div className={`h-12 w-12 rounded-xl ${iconBgClass} flex items-center justify-center`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// OVERVIEW TAB CONTENT
// ============================================================================

interface OverviewTabProps {
  stats: DashboardStats;
  loading: boolean;
  onNavigate: (tab: string) => void;
}

function OverviewTab({ stats, loading, onNavigate }: OverviewTabProps) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const assignmentStats = stats.assignments || {
    pending: 0,
    assigned: 0,
    completed: 0,
    suppressed: 0,
    overdue: 0,
    total: 0
  };

  const coverage = stats.coverage || {
    totalEmployees: 0,
    fullyCompliant: 0,
    partiallyCompliant: 0,
    nonCompliant: 0,
    coverageRate: 0
  };

  const pipeline = stats.pipeline || {
    pending: 0,
    assigned: 0,
    completed: 0,
    averageCompletionDays: null
  };

  return (
    <div className="space-y-6">
      {/* Quick Stats Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickStat
          title={t('compliance.complianceCoverage')}
          value={`${coverage.coverageRate}%`}
          subtitle={t('compliance.ofEmployees', { compliant: coverage.fullyCompliant, total: coverage.totalEmployees })}
          icon={<Shield className="h-6 w-6 text-primary" />}
          iconBgClass="bg-primary/10"
        />
        <QuickStat
          title={t('compliance.pendingAssignments')}
          value={assignmentStats.pending}
          subtitle={assignmentStats.overdue > 0 ? t('compliance.overdueCount', { count: assignmentStats.overdue }) : undefined}
          icon={<Clock className="h-6 w-6 text-yellow-600" />}
          iconBgClass="bg-yellow-100 dark:bg-yellow-900/30"
          onClick={() => onNavigate('queue')}
        />
        <QuickStat
          title={t('compliance.completed')}
          value={assignmentStats.completed}
          subtitle={pipeline.averageCompletionDays ? t('compliance.avgDays', { days: pipeline.averageCompletionDays }) : t('compliance.allTime')}
          icon={<CheckCircle2 className="h-6 w-6 text-green-600" />}
          iconBgClass="bg-green-100 dark:bg-green-900/30"
        />
        <QuickStat
          title={t('compliance.activeRequirements')}
          value={stats.activeRequirements}
          subtitle={t('compliance.linkedPlaylists', { count: stats.lockedPlaylistCount })}
          icon={<FileCheck className="h-6 w-6 text-blue-600" />}
          iconBgClass="bg-blue-100 dark:bg-blue-900/30"
          onClick={() => onNavigate('requirements')}
        />
      </div>

      {/* Main Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assignment Pipeline Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {t('compliance.assignmentPipeline')}
            </CardTitle>
            <CardDescription>
              {t('compliance.currentWorkflow')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pipeline Visualization */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <span className="text-sm">{t('compliance.pending')}</span>
                </div>
                <span className="font-semibold">{pipeline.pending}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (pipeline.pending / Math.max(1, pipeline.pending + pipeline.assigned + pipeline.completed)) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <span className="text-sm">{t('compliance.inProgress')}</span>
                </div>
                <span className="font-semibold">{pipeline.assigned}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (pipeline.assigned / Math.max(1, pipeline.pending + pipeline.assigned + pipeline.completed)) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-sm">{t('compliance.completed')}</span>
                </div>
                <span className="font-semibold">{pipeline.completed}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (pipeline.completed / Math.max(1, pipeline.pending + pipeline.assigned + pipeline.completed)) * 100)}%` }}
                />
              </div>
            </div>

            {pipeline.averageCompletionDays !== null && (
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('compliance.avgCompletionTime')}</span>
                  <span className="font-medium">{pipeline.averageCompletionDays} {t('compliance.days')}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Needs Attention Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              {t('compliance.needsAttention')}
            </CardTitle>
            <CardDescription>
              {t('compliance.itemsRequiringAction')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {assignmentStats.pending > 0 ? (
              <div
                className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                onClick={() => onNavigate('queue')}
              >
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-sm">{t('compliance.pendingCount', { count: assignmentStats.pending })}</p>
                    <p className="text-xs text-muted-foreground">{t('compliance.needAssignment')}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm">{t('compliance.allCaughtUp')}</p>
              </div>
            )}

            {assignmentStats.overdue > 0 && (
              <div
                className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                onClick={() => onNavigate('queue')}
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium text-sm">{t('compliance.overdueLabel', { count: assignmentStats.overdue })}</p>
                    <p className="text-xs text-muted-foreground">{t('compliance.pastDueDate')}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            )}

            {coverage.nonCompliant > 0 && (
              <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-medium text-sm">{t('compliance.nonCompliant', { count: coverage.nonCompliant })}</p>
                    <p className="text-xs text-muted-foreground">{t('compliance.employeesNeedTraining')}</p>
                  </div>
                </div>
              </div>
            )}

            {stats.expirations.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-medium text-sm">{t('compliance.expiringSoon', { count: stats.expirations.length })}</p>
                    <p className="text-xs text-muted-foreground">{t('compliance.next90Days')}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Expirations Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              {t('compliance.upcomingExpirations')}
            </CardTitle>
            <CardDescription>
              {t('compliance.certsExpiring90')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.expirations.length > 0 ? (
              <div className="space-y-3">
                {stats.expirations.slice(0, 5).map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{exp.employeeName}</p>
                      <p className="text-xs text-muted-foreground truncate">{exp.certificationType}</p>
                    </div>
                    <Badge
                      variant={exp.daysUntilExpiry <= 14 ? 'destructive' : exp.daysUntilExpiry <= 30 ? 'secondary' : 'outline'}
                      className="ml-2 shrink-0"
                    >
                      {exp.daysUntilExpiry}d
                    </Badge>
                  </div>
                ))}
                {stats.expirations.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    {t('compliance.more', { count: stats.expirations.length - 5 })}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mb-2 text-green-500" />
                <p className="text-sm">{t('compliance.noExpirations90')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => onNavigate('requirements')}
        >
          <div className="flex items-center gap-3">
            <FileCheck className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{t('compliance.requirements')}</p>
              <p className="text-sm text-muted-foreground">
                {t('compliance.requirementsActive', { count: stats.activeRequirements })}
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>

        <div
          className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => onNavigate('playlists')}
        >
          <div className="flex items-center gap-3">
            <ListMusic className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{t('compliance.playlists')}</p>
              <p className="text-sm text-muted-foreground">
                {t('compliance.playlistsLocked', { count: stats.lockedPlaylistCount })}
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>

        <div
          className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => onNavigate('settings')}
        >
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{t('compliance.settings')}</p>
              <p className="text-sm text-muted-foreground">
                {t('compliance.topicsAuthorities')}
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SETTINGS TAB (Topics + Authorities)
// ============================================================================

function SettingsTab() {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<'topics' | 'authorities'>('topics');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant={activeSection === 'topics' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('topics')}
        >
          {t('compliance.topics')}
        </Button>
        <Button
          variant={activeSection === 'authorities' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('authorities')}
        >
          {t('compliance.authorities')}
        </Button>
      </div>

      {activeSection === 'topics' ? <TopicsManager /> : <AuthoritiesManager />}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ComplianceDashboard() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<DashboardStats>({
    assignments: null,
    requirementCount: 0,
    lockedPlaylistCount: 0,
    activeRequirements: 0,
    coverage: null,
    expirations: [],
    pipeline: null
  });
  const [loading, setLoading] = useState(true);
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Load dashboard stats on mount and when returning to overview tab
  useEffect(() => {
    if (activeTab !== 'overview') return;

    async function loadStats() {
      setLoading(true);
      try {
        const [assignmentStats, requirements, lockedPlaylists, coverage, expirations, pipeline] = await Promise.all([
          getComplianceAssignmentStats(),
          getComplianceRequirementsForOrg(),
          getSystemLockedPlaylists(),
          getComplianceCoverage(),
          getUpcomingExpirations(90),
          getAssignmentPipelineStats()
        ]);

        setStats({
          assignments: assignmentStats,
          requirementCount: requirements.length,
          lockedPlaylistCount: lockedPlaylists.length,
          activeRequirements: requirements.filter((r: ComplianceRequirement) => r.status === 'active').length,
          coverage,
          expirations,
          pipeline
        });
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [activeTab]);

  // Handle navigation from overview cards
  const handleNavigate = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('compliance.engineTitle')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('compliance.engineSubtitle')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowBulkImport(true)}>
            <Upload className="h-4 w-4 mr-2" />
            {t('compliance.importCertificates')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    toast.loading(t('compliance.exportingReport'));
                    const data = await exportComplianceReport();

                    // Convert to CSV
                    const headers = ['Employee', 'Email', 'Store', 'Requirement', 'Status', 'Due Date', 'Completed Date', 'Certificate Type'];
                    const rows = data.map(row => [
                      row.employeeName,
                      row.employeeEmail,
                      row.storeName,
                      row.requirementName,
                      row.status,
                      row.dueDate || '',
                      row.completedDate || '',
                      row.certificationType || ''
                    ]);

                    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `compliance-report-${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);

                    toast.dismiss();
                    toast.success(t('compliance.exportedRecords', { count: data.length }));
                  } catch (err) {
                    toast.dismiss();
                    toast.error(t('compliance.failedExportReport'));
                    console.error(err);
                  }
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                {t('compliance.exportReportCsv')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    toast.loading(t('compliance.recalculating'));
                    const result = await recalculateAllAssignments();
                    toast.dismiss();
                    toast.success(t('compliance.recalculateSuccess', { processed: result.processed, created: result.created }));

                    // Refresh stats
                    if (activeTab === 'overview') {
                      setLoading(true);
                      Promise.all([
                        getComplianceAssignmentStats(),
                        getComplianceRequirementsForOrg(),
                        getSystemLockedPlaylists(),
                        getComplianceCoverage(),
                        getUpcomingExpirations(90),
                        getAssignmentPipelineStats()
                      ]).then(([assignmentStats, requirements, lockedPlaylists, coverage, expirations, pipeline]) => {
                        setStats({
                          assignments: assignmentStats,
                          requirementCount: requirements.length,
                          lockedPlaylistCount: lockedPlaylists.length,
                          activeRequirements: requirements.filter((r: ComplianceRequirement) => r.status === 'active').length,
                          coverage,
                          expirations,
                          pipeline
                        });
                      }).finally(() => setLoading(false));
                    }
                  } catch (err) {
                    toast.dismiss();
                    toast.error(t('compliance.failedRecalculate'));
                    console.error(err);
                  }
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('compliance.recalculateAll')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bulk Import Modal */}
      <BulkCertImport
        open={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onSuccess={() => {
          // Refresh stats when import succeeds
          if (activeTab === 'overview') {
            setLoading(true);
            Promise.all([
              getComplianceAssignmentStats(),
              getComplianceRequirementsForOrg(),
              getSystemLockedPlaylists(),
              getComplianceCoverage(),
              getUpcomingExpirations(90),
              getAssignmentPipelineStats()
            ]).then(([assignmentStats, requirements, lockedPlaylists, coverage, expirations, pipeline]) => {
              setStats({
                assignments: assignmentStats,
                requirementCount: requirements.length,
                lockedPlaylistCount: lockedPlaylists.length,
                activeRequirements: requirements.filter((r: ComplianceRequirement) => r.status === 'active').length,
                coverage,
                expirations,
                pipeline
              });
            }).finally(() => setLoading(false));
          }
        }}
      />

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">{t('compliance.overview')}</span>
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">{t('compliance.queue')}</span>
            {stats.assignments && stats.assignments.pending > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {stats.assignments.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="requirements" className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            <span className="hidden sm:inline">{t('compliance.requirements')}</span>
          </TabsTrigger>
          <TabsTrigger value="playlists" className="flex items-center gap-2">
            <ListMusic className="h-4 w-4" />
            <span className="hidden sm:inline">{t('compliance.playlists')}</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{t('compliance.settings')}</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview" className="m-0">
            <OverviewTab stats={stats} loading={loading} onNavigate={handleNavigate} />
          </TabsContent>

          <TabsContent value="queue" className="m-0">
            <AssignmentQueue />
          </TabsContent>

          <TabsContent value="requirements" className="m-0">
            <RequirementsManager useOrgScope />
          </TabsContent>

          <TabsContent value="playlists" className="m-0">
            <PlaylistLockingPanel />
          </TabsContent>

          <TabsContent value="settings" className="m-0">
            <SettingsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default ComplianceDashboard;
