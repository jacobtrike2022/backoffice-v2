import React, { useState, useEffect } from 'react';
import { useCurrentUser } from '../lib/hooks/useSupabase';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
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
  ArrowDownRight,
  Loader2,
  Upload,
  Award
} from 'lucide-react';
import { CertificationTracker } from './CertificationTracker';
import { CertificationApprovalQueue } from './compliance/CertificationApprovalQueue';
import { ExternalCertificationUpload } from './compliance/ExternalCertificationUpload';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  getComplianceDashboardMetrics,
  getComplianceByCategory,
  getExpiringCertificationsForOrg,
  getStoreRiskAssessment,
  getComplianceTrendData,
  type ComplianceDashboardMetrics,
  type ComplianceByCategory as ComplianceByCategoryType,
  type ExpiringCertification,
  type StoreRiskAssessment
} from '../lib/crud/compliance';
import { getPendingUploadsCount } from '../lib/crud/certifications';

type UserRole = 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';

interface ComplianceDashboardProps {
  currentRole: UserRole;
  onBackToDashboard?: () => void;
  onNavigate?: (view: string) => void;
}

// Custom tick component that properly uses CSS variables
const CustomTick = ({ x, y, payload, axis }: any) => {
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={axis === 'x' ? 16 : 4}
        textAnchor={axis === 'x' ? 'middle' : 'end'}
        className="fill-muted-foreground text-xs"
      >
        {payload.value}
      </text>
    </g>
  );
};

const getRiskColor = (level: string) => {
  switch (level) {
    case 'low':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800';
    case 'high':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
    case 'critical':
      return 'bg-red-200 text-red-900 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700';
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
  // Only admins, district managers, and trike-super-admin see full compliance dashboard
  if (currentRole !== 'admin' && currentRole !== 'trike-super-admin' && currentRole !== 'district-manager') {
    return null;
  }

  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ComplianceDashboardMetrics | null>(null);
  const [categoryData, setCategoryData] = useState<ComplianceByCategoryType[]>([]);
  const [expiringCerts, setExpiringCerts] = useState<ExpiringCertification[]>([]);
  const [riskData, setRiskData] = useState<StoreRiskAssessment[]>([]);
  const [trendData, setTrendData] = useState<Array<{ month: string; company: number; district: number; unit: number }>>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [pendingCount, setPendingCount] = useState(0);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // Check if user can approve (only Admin and Trike Super Admin)
  const canApprove = currentRole === 'admin' || currentRole === 'trike-super-admin';

  // Fetch all compliance data
  useEffect(() => {
    async function fetchComplianceData() {
      if (!user?.organization_id) return;

      setLoading(true);
      try {
        // Fetch all data in parallel
        const [metricsResult, categoryResult, expiringResult, riskResult, trendResult, pendingCountResult] = await Promise.all([
          getComplianceDashboardMetrics().catch(err => {
            console.error('Error fetching metrics:', err);
            return null;
          }),
          getComplianceByCategory().catch(err => {
            console.error('Error fetching category data:', err);
            return [];
          }),
          getExpiringCertificationsForOrg(30).catch(err => {
            console.error('Error fetching expiring certs:', err);
            return [];
          }),
          getStoreRiskAssessment().catch(err => {
            console.error('Error fetching risk data:', err);
            return [];
          }),
          getComplianceTrendData(6).catch(err => {
            console.error('Error fetching trend data:', err);
            return [];
          }),
          getPendingUploadsCount().catch(err => {
            console.error('Error fetching pending count:', err);
            return 0;
          })
        ]);

        setMetrics(metricsResult);
        setCategoryData(categoryResult);
        setExpiringCerts(expiringResult);
        setRiskData(riskResult);
        setTrendData(trendResult);
        setPendingCount(pendingCountResult);
      } catch (error) {
        console.error('Error fetching compliance data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchComplianceData();
  }, [user?.organization_id]);

  // Calculate derived metrics
  const compliantEmployees = metrics?.compliantEmployees ?? 0;
  const totalEmployees = metrics?.totalEmployees ?? 0;
  const complianceRate = metrics?.complianceRate ?? 0;
  const expiringSoonCount = metrics?.expiringSoonCount ?? 0;
  const highRiskCount = riskData.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length;

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
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
            <Button variant="outline" size="sm" onClick={() => setShowUploadDialog(true)}>
              <Upload className="w-4 h-4 mr-1.5" />
              Upload Certification
            </Button>
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

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="certifications" className="gap-2">
            <Award className="h-4 w-4" />
            Certifications
          </TabsTrigger>
          <TabsTrigger value="approvals" className="gap-2 relative">
            <Clock className="h-4 w-4" />
            Pending Approvals
            {pendingCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-1 h-5 min-w-[20px] px-1.5 text-xs"
              >
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Hero Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Overall Compliance - Hero Card */}
        <Card className="border-border/40 shadow-sm hover:shadow-md transition-all duration-200 bg-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <CheckCircle className="h-5 w-5" />
              </div>
              {complianceRate > 0 && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                  <ArrowUpRight className="h-3 w-3" />
                  <span>Live</span>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-foreground leading-none">{complianceRate}%</div>
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
              {compliantEmployees > 0 && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                  <ArrowUpRight className="h-3 w-3" />
                  <span>Live</span>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-foreground leading-none">{compliantEmployees}</div>
              <h3 className="text-sm font-medium text-muted-foreground mt-2">Employees Compliant</h3>
              <p className="text-xs text-muted-foreground/80">of {totalEmployees} total</p>
            </div>
          </CardContent>
        </Card>

        {/* Expiring Soon */}
        <Card className="border-border/40 shadow-sm hover:shadow-md transition-all duration-200 bg-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
                <Clock className="h-5 w-5" />
              </div>
              {expiringSoonCount > 0 && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs dark:bg-yellow-900/10 dark:text-yellow-400">
                  Due Soon
                </Badge>
              )}
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-foreground leading-none">{expiringSoonCount}</div>
              <h3 className="text-sm font-medium text-muted-foreground mt-2">Expiring Soon</h3>
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
              {highRiskCount > 0 && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs dark:bg-red-900/10 dark:text-red-400">
                  Critical
                </Badge>
              )}
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-foreground leading-none">{highRiskCount}</div>
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
              <AreaChart data={trendData}>
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
                  tick={(props) => <CustomTick {...props} axis="x" />}
                  tickLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tick={(props) => <CustomTick {...props} axis="y" />}
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
              {categoryData.length > 0 ? categoryData.map((item, idx) => (
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
              )) : (
                <p className="text-sm text-muted-foreground text-center py-4">No compliance categories found</p>
              )}
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
              {expiringCerts.length > 0 ? expiringCerts.slice(0, 5).map((cert, idx) => (
                <div
                  key={cert.id || idx}
                  className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className={`p-2.5 rounded-lg ${
                    cert.priority === 'high' ? 'bg-red-100 dark:bg-red-900/20' :
                    cert.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                    'bg-green-100 dark:bg-green-900/20'
                  }`}>
                    <Calendar className={`h-4 w-4 ${
                      cert.priority === 'high' ? 'text-red-600 dark:text-red-400' :
                      cert.priority === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm text-foreground line-clamp-1">
                        {cert.certificationName}
                      </h4>
                      <Badge variant="outline" className={`text-xs shrink-0 ${getPriorityColor(cert.priority)}`}>
                        {cert.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {cert.daysUntilExpiration} days
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <UserCheck className="h-3 w-3" />
                        {cert.userName}
                      </p>
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground text-center py-4">No certifications expiring in the next 30 days</p>
              )}
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
                {riskData.length > 0 ? riskData.map((store, idx) => (
                  <tr key={store.storeId || idx} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-medium text-sm text-foreground">{store.storeName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={getRiskColor(store.riskLevel)}>
                        {store.riskLevel.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 max-w-[120px]">
                          <Progress value={store.score} className="h-2" />
                        </div>
                        <span className={`text-sm font-semibold ${
                          store.score >= 95 ? 'text-green-600 dark:text-green-400' :
                          store.score >= 85 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {store.score}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {store.issues > 0 ? (
                        <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 font-medium">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {store.issues}
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
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                      No stores found for risk assessment
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        {/* Certifications Tab */}
        <TabsContent value="certifications" className="mt-6">
          <CertificationTracker currentRole={currentRole} />
        </TabsContent>

        {/* Pending Approvals Tab */}
        <TabsContent value="approvals" className="mt-6">
          <CertificationApprovalQueue
            canApprove={canApprove}
            showAllStatuses={true}
            onCountChange={(count) => setPendingCount(count)}
          />
        </TabsContent>
      </Tabs>

      {/* Upload Certification Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload External Certification</DialogTitle>
          </DialogHeader>
          <ExternalCertificationUpload
            onSuccess={() => {
              setShowUploadDialog(false);
              // Refresh pending count
              getPendingUploadsCount().then(setPendingCount);
            }}
            onCancel={() => setShowUploadDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}