// ============================================================================
// COMPLIANCE DASHBOARD - MAIN COMPLIANCE ENGINE INTERFACE
// ============================================================================
// Central hub for the Trike Compliance Engine. Provides tabbed navigation
// to all compliance management features including assignment queue,
// requirements, playlists, and settings.
// ============================================================================

import React, { useState, useEffect } from 'react';
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
  Loader2
} from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

// Import compliance components
import { AssignmentQueue } from './AssignmentQueue';
import { RequirementsManager } from './RequirementsManager';
import { PlaylistLockingPanel } from './PlaylistLockingPanel';
import { TopicsManager } from './TopicsManager';
import { AuthoritiesManager } from './AuthoritiesManager';

// Import CRUD functions for dashboard stats
import { getComplianceAssignmentStats, type ComplianceAssignmentStats } from '../../lib/crud/complianceAssignments';
import { getComplianceRequirements, type ComplianceRequirement } from '../../lib/crud/compliance';
import { getSystemLockedPlaylists, type SystemLockedAlbum } from '../../lib/crud/albums';

// ============================================================================
// TYPES
// ============================================================================

interface DashboardStats {
  assignments: ComplianceAssignmentStats | null;
  requirementCount: number;
  lockedPlaylistCount: number;
  activeRequirements: number;
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
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickStat
          title="Pending Assignments"
          value={assignmentStats.pending}
          subtitle={assignmentStats.overdue > 0 ? `${assignmentStats.overdue} overdue` : undefined}
          icon={<Clock className="h-6 w-6 text-yellow-600" />}
          iconBgClass="bg-yellow-100 dark:bg-yellow-900/30"
          onClick={() => onNavigate('queue')}
        />
        <QuickStat
          title="In Progress"
          value={assignmentStats.assigned}
          subtitle="Currently assigned"
          icon={<Users className="h-6 w-6 text-blue-600" />}
          iconBgClass="bg-blue-100 dark:bg-blue-900/30"
          onClick={() => onNavigate('queue')}
        />
        <QuickStat
          title="Completed"
          value={assignmentStats.completed}
          subtitle="All time"
          icon={<CheckCircle2 className="h-6 w-6 text-green-600" />}
          iconBgClass="bg-green-100 dark:bg-green-900/30"
        />
        <QuickStat
          title="Compliance Rate"
          value={assignmentStats.total > 0
            ? `${Math.round((assignmentStats.completed / assignmentStats.total) * 100)}%`
            : '—'}
          subtitle={`${assignmentStats.completed} of ${assignmentStats.total}`}
          icon={<TrendingUp className="h-6 w-6 text-primary" />}
          iconBgClass="bg-primary/10"
        />
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Needs Attention
            </CardTitle>
            <CardDescription>
              Items requiring immediate action
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {assignmentStats.pending > 0 ? (
              <div
                className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                onClick={() => onNavigate('queue')}
              >
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-medium">{assignmentStats.pending} pending assignments</p>
                    <p className="text-sm text-muted-foreground">
                      Waiting to be assigned to employees
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm">All caught up! No pending assignments.</p>
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
                    <p className="font-medium">{assignmentStats.overdue} overdue</p>
                    <p className="text-sm text-muted-foreground">
                      Past due date, needs immediate attention
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Compliance Setup
            </CardTitle>
            <CardDescription>
              Configure your compliance requirements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onNavigate('requirements')}
            >
              <div className="flex items-center gap-3">
                <FileCheck className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Requirements</p>
                  <p className="text-sm text-muted-foreground">
                    {stats.activeRequirements} active requirement{stats.activeRequirements !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>

            <div
              className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onNavigate('playlists')}
            >
              <div className="flex items-center gap-3">
                <ListMusic className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Compliance Playlists</p>
                  <p className="text-sm text-muted-foreground">
                    {stats.lockedPlaylistCount} locked playlist{stats.lockedPlaylistCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>

            <div
              className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onNavigate('settings')}
            >
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Topics & Authorities</p>
                  <p className="text-sm text-muted-foreground">
                    Manage compliance categories
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-center gap-4">
          <Shield className="h-8 w-8 text-primary shrink-0" />
          <div>
            <p className="font-medium">Trike Compliance Engine</p>
            <p className="text-sm text-muted-foreground">
              Automate compliance training assignments based on role, location, and certification requirements.
              Configure requirements, link playlists, and let the system handle the rest.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// SETTINGS TAB (Topics + Authorities)
// ============================================================================

function SettingsTab() {
  const [activeSection, setActiveSection] = useState<'topics' | 'authorities'>('topics');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant={activeSection === 'topics' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('topics')}
        >
          Topics
        </Button>
        <Button
          variant={activeSection === 'authorities' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('authorities')}
        >
          Authorities
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
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<DashboardStats>({
    assignments: null,
    requirementCount: 0,
    lockedPlaylistCount: 0,
    activeRequirements: 0
  });
  const [loading, setLoading] = useState(true);

  // Load dashboard stats
  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        const [assignmentStats, requirements, lockedPlaylists] = await Promise.all([
          getComplianceAssignmentStats(),
          getComplianceRequirements(),
          getSystemLockedPlaylists()
        ]);

        setStats({
          assignments: assignmentStats,
          requirementCount: requirements.length,
          lockedPlaylistCount: lockedPlaylists.length,
          activeRequirements: requirements.filter((r: ComplianceRequirement) => r.status === 'active').length
        });
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

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
            <h1 className="text-2xl font-bold">Compliance Engine</h1>
            <p className="text-sm text-muted-foreground">
              Manage compliance requirements and training assignments
            </p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Queue</span>
            {stats.assignments && stats.assignments.pending > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {stats.assignments.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="requirements" className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Requirements</span>
          </TabsTrigger>
          <TabsTrigger value="playlists" className="flex items-center gap-2">
            <ListMusic className="h-4 w-4" />
            <span className="hidden sm:inline">Playlists</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
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
            <RequirementsManager />
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
