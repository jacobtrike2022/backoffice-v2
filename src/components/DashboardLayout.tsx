import React, { useState, useEffect } from 'react';
import { signOut } from '../lib/hooks/useAuth';
import { Button } from './ui/button';
import {
  Home,
  FileText,
  BarChart3,
  Users,
  Building,
  Building2,
  Shield,
  ShieldCheck,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  BookOpen,
  FolderOpen,
  ListChecks,
  BookText,
  ClipboardList,
  Settings,
  Edit,
  UserCheck,
  Search,
  Bell,
  Wrench,
  Zap,
  LogOut,
  Briefcase,
  ArrowLeft,
  Eye
} from 'lucide-react';
import trikeLogo from '../assets/trike-logo.png';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { Separator } from './ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { supabase, getCurrentUserOrgId } from '../lib/supabase';
import { APP_CONFIG, getDefaultOrgId } from '../lib/config';
import { trackDemoActivityEvent } from '../lib/analytics/demoTracking';
import { useTranslation } from 'react-i18next';

type UserRole = 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';

interface OrgStatusInfo {
  status: string | null;
  demoExpiresAt: string | null;
  isProspectOrg: boolean;
  isDemoExpired: boolean;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  darkMode: boolean;
  onDarkModeToggle: () => void;
  currentView?: string;
  onNavigate?: (view: string) => void;
  orgStatusInfo?: OrgStatusInfo;
  viewingOrgId?: string | null;
  viewingOrgName?: string | null;
  onExitOrgPreview?: () => void;
}

interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  roles: UserRole[];
  badge?: string;
  isNew?: boolean;
}

const navigationGroups: NavigationGroup[] = [
  {
    label: 'nav.group.overview',
    items: [
      {
        id: 'dashboard',
        label: 'nav.dashboard',
        icon: Home,
        roles: ['admin', 'trike-super-admin', 'district-manager', 'store-manager']
      }
    ]
  },
  {
    label: 'nav.group.peopleOrg',
    items: [
      {
        id: 'people',
        label: 'nav.people',
        icon: Users,
        roles: ['admin', 'trike-super-admin', 'district-manager', 'store-manager']
      },
      {
        id: 'units',
        label: 'nav.units',
        icon: Building,
        roles: ['admin', 'trike-super-admin', 'district-manager']
      },
      {
        id: 'organization',
        label: 'nav.organization',
        icon: Building2,
        roles: ['admin', 'trike-super-admin']
      },
      {
        id: 'my-store',
        label: 'nav.myStore',
        icon: Building,
        roles: ['store-manager']
      }
    ]
  },
  {
    label: 'nav.group.contentTraining',
    items: [
      {
        id: 'content',
        label: 'nav.contentLibrary',
        icon: CheckSquare,
        roles: ['admin', 'trike-super-admin', 'district-manager', 'store-manager']
      },
      {
        id: 'assignments',
        label: 'nav.playlistsAlbums',
        icon: ListChecks,
        roles: ['admin', 'trike-super-admin', 'district-manager', 'store-manager']
      },
      {
        id: 'authoring',
        label: 'nav.contentAuthoring',
        icon: Edit,
        roles: ['admin', 'trike-super-admin']
      },
      {
        id: 'forms',
        label: 'nav.forms',
        icon: ClipboardList,
        roles: ['admin', 'trike-super-admin']
      },
      {
        id: 'knowledge-base',
        label: 'nav.knowledgeBase',
        icon: BookOpen,
        roles: ['admin', 'trike-super-admin', 'district-manager', 'store-manager']
      }
    ]
  },
  {
    label: 'nav.group.analyticsReports',
    items: [
      {
        id: 'analytics',
        label: 'nav.analytics',
        icon: BarChart3,
        roles: ['admin', 'trike-super-admin', 'district-manager']
      },
      {
        id: 'reports',
        label: 'nav.reports',
        icon: FileText,
        roles: ['admin', 'trike-super-admin', 'district-manager']
      }
    ]
  },
  {
    label: 'nav.group.complianceSettings',
    items: [
      {
        id: 'compliance',
        label: 'nav.compliance',
        icon: UserCheck,
        roles: ['admin', 'trike-super-admin', 'district-manager']
      },
      {
        id: 'settings',
        label: 'nav.settings',
        icon: Settings,
        roles: ['admin', 'trike-super-admin']
      },
      {
        id: 'trike-admin-functions',
        label: 'nav.trikeAdminFunctions',
        icon: Wrench,
        roles: ['trike-super-admin']
      },
      {
        id: 'trike-admin',
        label: 'nav.prospectToClient',
        icon: Briefcase,
        roles: ['trike-super-admin']
      }
    ]
  }
];

export function DashboardLayout({ 
  children, 
  currentRole, 
  onRoleChange, 
  darkMode, 
  onDarkModeToggle,
  currentView = 'dashboard',
  onNavigate,
  orgStatusInfo,
  viewingOrgId,
  viewingOrgName,
  onExitOrgPreview,
}: DashboardLayoutProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(currentView);
  const [organizationName, setOrganizationName] = useState<string>('');
  const [organizationLogo, setOrganizationLogo] = useState<string | null>(null);

  // Update activeTab when currentView changes
  React.useEffect(() => {
    setActiveTab(currentView);
  }, [currentView]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isPreviewingOrg = currentRole === 'trike-super-admin' && !!viewingOrgId && viewingOrgId !== APP_CONFIG.TRIKE_CO_ORG_ID;

  // Fetch organization name and logo
  useEffect(() => {
    const fetchOrganizationData = async () => {
      try {
        const orgId = await getCurrentUserOrgId();
        if (!orgId) return;

        const { data: org } = await supabase
          .from('organizations')
          .select('name, logo_dark_url, logo_light_url, status, demo_expires_at')
          .eq('id', orgId)
          .single();

        if (org) {
          if (org.name) {
            setOrganizationName(org.name);
          }

          const logoUrl = darkMode
            ? (org.logo_dark_url || trikeLogo)
            : (org.logo_light_url || trikeLogo);
          setOrganizationLogo(logoUrl);
        }
      } catch (error) {
        console.error('Error fetching organization data:', error);
      }
    };

    fetchOrganizationData();

    const handleOrgUpdate = () => {
      fetchOrganizationData();
    };
    window.addEventListener('organization-updated', handleOrgUpdate);
    
    return () => {
      window.removeEventListener('organization-updated', handleOrgUpdate);
    };
  }, [darkMode, viewingOrgId]);

  const roleLabels = {
    'admin': t('roles.admin'),
    'district-manager': t('roles.districtManager'),
    'store-manager': t('roles.storeManager'),
    'trike-super-admin': t('roles.trikeSuperAdmin')
  };

  const getRoleDescription = () => {
    switch (currentRole) {
      case 'admin':
        return t('roles.desc.admin');
      case 'district-manager':
        return t('roles.desc.districtManager');
      case 'store-manager':
        return t('roles.desc.storeManager');
      default:
        return '';
    }
  };

  const getRoleIcon = () => {
    switch (currentRole) {
      case 'admin':
        return Shield;
      case 'district-manager':
        return Building;
      case 'store-manager':
        return Users;
      default:
        return Shield;
    }
  };

  const isProspectUser = orgStatusInfo?.isProspectOrg && currentRole !== 'trike-super-admin';

  const getFilteredGroups = () => {
    if (isProspectUser) {
      return [
        {
          label: 'nav.group.overview',
          items: [
            { id: 'dashboard', label: 'nav.dashboard', icon: Home, roles: ['admin', 'trike-super-admin', 'district-manager', 'store-manager'] as UserRole[] },
          ],
        },
        {
          label: 'nav.group.content',
          items: [
            { id: 'content', label: 'nav.contentLibrary', icon: CheckSquare, roles: ['admin', 'trike-super-admin', 'district-manager', 'store-manager'] as UserRole[] },
          ],
        },
      ];
    }
    return navigationGroups.map(group => ({
      ...group,
      items: group.items.filter(item => item.roles.includes(currentRole))
    })).filter(group => group.items.length > 0);
  };

  const filteredGroups = getFilteredGroups();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar - Fixed position to extend full viewport height */}
      <div className={`fixed top-0 left-0 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 shadow-lg z-40 ${
        sidebarCollapsed ? 'w-16' : 'w-72'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo and collapse button */}
          <div className="flex items-center justify-between p-6 border-b border-sidebar-border">
            {!sidebarCollapsed && (
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 flex items-center justify-center">
                  <img 
                    src={organizationLogo || trikeLogo} 
                    alt={organizationName || 'Trike Logo'} 
                    className="w-10 h-10 object-contain"
                    onError={(e) => {
                      // Fallback to default logo if custom logo fails to load
                      e.currentTarget.src = trikeLogo;
                    }}
                  />
                </div>
                <div>
                  <h2 className="font-bold text-sidebar-foreground text-lg">
                    {organizationName || 'Trike.co'}
                  </h2>
                  <p className="text-xs text-muted-foreground">{t('layout.backoffice')}</p>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="flex items-center justify-center w-full">
                <img 
                  src={organizationLogo || trikeLogo} 
                  alt={organizationName || 'Trike Logo'} 
                  className="w-8 h-8 object-contain"
                  onError={(e) => {
                    // Fallback to default logo if custom logo fails to load
                    e.currentTarget.src = trikeLogo;
                  }}
                />
              </div>
            )}
            {!sidebarCollapsed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="h-8 w-8 p-0 hover:bg-sidebar-accent"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Expand button when collapsed */}
          {sidebarCollapsed && (
            <div className="p-3 border-b border-sidebar-border flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="h-8 w-8 p-0 hover:bg-sidebar-accent"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Demo Expiry Badge for Prospects */}
          {!sidebarCollapsed && isProspectUser && orgStatusInfo?.demoExpiresAt && (
            <div className="px-6 py-3 border-b border-sidebar-border">
              <div className="flex items-center gap-2 text-sm">
                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-muted-foreground">
                  {t('layout.demoExpiresIn')}{' '}
                  <span className="font-semibold text-sidebar-foreground">
                    {Math.max(0, Math.ceil((new Date(orgStatusInfo.demoExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} {t('layout.days')}
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* Role Switcher */}
          {!sidebarCollapsed && (
            <div className="p-6 border-b border-sidebar-border bg-accent dark:bg-sidebar-accent">
              <div className="space-y-3">
                <label className="text-xs font-bold text-brand-grey dark:text-sidebar-foreground uppercase tracking-wide">
                  {t('layout.currentRole')}
                </label>
                <Select value={currentRole} onValueChange={onRoleChange}>
                  <SelectTrigger className="w-full bg-white dark:bg-sidebar-accent border-2 border-primary/20 hover:border-primary/40 transition-colors">
                    <SelectValue>
                      <div className="flex items-center space-x-2">
                        {React.createElement(getRoleIcon(), { className: "h-4 w-4 text-primary" })}
                        <span>{roleLabels[currentRole]}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex items-center space-x-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <span>{t('roles.admin')}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="district-manager">
                      <div className="flex items-center space-x-2">
                        <Building className="h-4 w-4 text-primary" />
                        <span>{t('roles.districtManager')}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="store-manager">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-primary" />
                        <span>{t('roles.storeManager')}</span>
                      </div>
                    </SelectItem>
                    <Separator className="my-2" />
                    <SelectItem value="trike-super-admin">
                      <div className="flex items-center space-x-2">
                        <Shield className="h-4 w-4 text-orange-500" />
                        <span className="font-semibold">{t('roles.trikeSuperAdmin')}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-brand-grey-light">
                  {getRoleDescription()}
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
            {filteredGroups.map((group, groupIndex) => (
              <div key={groupIndex}>
                {!sidebarCollapsed && (
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3 px-2">
                    {t(group.label)}
                  </h3>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    
                    return (
                      <Button
                        key={item.id}
                        variant={isActive ? "default" : "ghost"}
                        className={`w-full h-11 ${
                          sidebarCollapsed ? 'px-0 justify-center' : 'px-4 justify-start'
                        } ${
                          isActive 
                            ? 'bg-primary text-primary-foreground shadow-brand' 
                            : 'hover:bg-sidebar-accent text-sidebar-foreground'
                        }`}
                        onClick={() => {
                          const params = new URLSearchParams(window.location.search);
                          const demoOrgId = params.get("demo_org_id");
                          void trackDemoActivityEvent(
                            {
                              eventType: "nav_click",
                              path: `/app/${item.id}`,
                              fromPath: `/app/${activeTab}`,
                              metadata: {
                                navGroup: group.label,
                                navItemId: item.id,
                                navItemLabel: item.label,
                              },
                            },
                            {
                              organizationId: viewingOrgId || demoOrgId || getDefaultOrgId(),
                              organizationName: viewingOrgName || null,
                              currentRole,
                            }
                          );

                          setActiveTab(item.id);
                          if (onNavigate) {
                            if (item.id === 'analytics') {
                              onNavigate('analytics');
                            } else if (item.id === 'reports') {
                              onNavigate('reports');
                            } else if (item.id === 'compliance') {
                              onNavigate('compliance');
                            } else if (item.id === 'content') {
                              onNavigate('content');
                            } else if (item.id === 'assignments') {
                              onNavigate('assignments');
                            } else if (item.id === 'authoring') {
                              onNavigate('authoring');
                            } else if (item.id === 'forms') {
                              onNavigate('forms');
                            } else if (item.id === 'knowledge-base') {
                              onNavigate('knowledge-base');
                            } else if (item.id === 'people' || item.id === 'my-store') {
                              onNavigate('people');
                            } else if (item.id === 'units') {
                              onNavigate('units');
                            } else if (item.id === 'organization') {
                              onNavigate('organization');
                            } else if (item.id === 'settings') {
                              onNavigate('settings');
                            } else if (item.id === 'trike-admin-functions') {
                              onNavigate('trike-admin-functions');
                            } else if (item.id === 'trike-admin') {
                              onNavigate('trike-admin');
                            } else {
                              onNavigate('dashboard');
                            }
                          }
                        }}
                      >
                        <Icon className={`h-5 w-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                        {!sidebarCollapsed && (
                          <>
                            <span className="flex-1 text-left font-medium">{t(item.label)}</span>
                            <div className="flex items-center space-x-2">
                              {item.isNew && (
                                <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs px-2 py-0">
                                  {t('layout.new')}
                                </Badge>
                              )}
                              {item.badge && (
                                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs px-2 py-0">
                                  {item.badge}
                                </Badge>
                              )}
                            </div>
                          </>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* User profile */}
          {!sidebarCollapsed && (
            <div className="p-6 border-t border-sidebar-border">
              <div className="flex items-center space-x-3 p-3 bg-sidebar-accent rounded-lg">
                <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                  <AvatarImage src="/placeholder-avatar.jpg" alt="User" />
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                    JD
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sidebar-foreground truncate">
                    John Doe
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {roleLabels[currentRole]}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar spacer - matches sidebar width to push content */}
      <div className={`flex-shrink-0 transition-all duration-300 ${
        sidebarCollapsed ? 'w-16' : 'w-72'
      }`} />

      {/* Main content - min-w-0 + overflow-x-hidden so wide tables scroll inside their container and don't overlap the sidebar */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        {/* Org preview banner for Super Admin */}
        {isPreviewingOrg && (
          <div className="bg-amber-500/90 text-white px-4 py-2 flex items-center justify-between z-50 shadow-md">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Eye className="h-4 w-4" />
              <span>{t('layout.previewing')} <strong>{viewingOrgName || organizationName || t('nav.organization')}</strong></span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 hover:text-white gap-1.5 h-7 text-xs font-semibold"
              onClick={onExitOrgPreview}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t('layout.returnToTrike')}
            </Button>
          </div>
        )}

        {/* Enhanced Top bar */}
        <header className="bg-card border-b border-border px-8 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('layout.searchPlaceholder')}
                  className="pl-10 w-80 bg-input-background border-border focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onDarkModeToggle}
                className="hover:bg-accent"
              >
                {darkMode ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </Button>
              
              {/* Enhanced Notifications Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative hover:bg-accent">
                    <Bell className="h-4 w-4" />
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-xs text-white font-bold">2</span>
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <div className="p-3 border-b">
                    <h4 className="font-semibold">{t('layout.notifications')}</h4>
                  </div>
                  <DropdownMenuItem className="p-3">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{t('layout.safetyTrainingOverdue')}</p>
                      <p className="text-xs text-muted-foreground">{t('layout.employeesInStoreA')}</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="p-3">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{t('layout.newComplianceUpdate')}</p>
                      <p className="text-xs text-muted-foreground">{t('layout.requiresAttention')}</p>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Separator orientation="vertical" className="h-6" />
              
              {/* User Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-full">
                    <Avatar className="h-9 w-9 ring-2 ring-primary/20 cursor-pointer hover:ring-primary/40 transition-all">
                      <AvatarImage src="/placeholder-avatar.jpg" alt="User" />
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                        JD
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center gap-3 p-3 border-b">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src="/placeholder-avatar.jpg" alt="User" />
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                        JD
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">John Doe</p>
                      <p className="text-xs text-muted-foreground truncate">{roleLabels[currentRole]}</p>
                    </div>
                  </div>
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                    onClick={async () => {
                      if (confirm(t('layout.signOutConfirm'))) {
                        await signOut();
                      }
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{t('layout.signOut')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content with enhanced spacing */}
        <main className="flex-1 bg-background">
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}