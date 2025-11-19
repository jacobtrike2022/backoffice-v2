import React, { useState } from 'react';
import { Button } from './ui/button';
import { 
  Home,
  FileText,
  BarChart3,
  Users,
  Building,
  Shield,
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
  Bell
} from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { Separator } from './ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import trikeLogo from 'figma:asset/d284bc7ee411198fb15ff6e1e42fef256815e21f.png';

type UserRole = 'admin' | 'district-manager' | 'store-manager';

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  darkMode: boolean;
  onDarkModeToggle: () => void;
  currentView?: string;
  onNavigate?: (view: string) => void;
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
    label: 'Overview',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: Home,
        roles: ['admin', 'district-manager', 'store-manager']
      }
    ]
  },
  {
    label: 'People & Organization',
    items: [
      {
        id: 'people',
        label: 'People',
        icon: Users,
        roles: ['admin', 'district-manager', 'store-manager']
      },
      {
        id: 'units',
        label: 'Units',
        icon: Building,
        roles: ['admin', 'district-manager']
      },
      {
        id: 'my-store',
        label: 'My Store',
        icon: Building,
        roles: ['store-manager']
      }
    ]
  },
  {
    label: 'Content & Training',
    items: [
      {
        id: 'content',
        label: 'Content Library',
        icon: CheckSquare,
        roles: ['admin', 'district-manager', 'store-manager']
      },
      {
        id: 'assignments',
        label: 'Playlists',
        icon: ListChecks,
        roles: ['admin', 'district-manager', 'store-manager']
      },
      {
        id: 'authoring',
        label: 'Content Authoring',
        icon: Edit,
        roles: ['admin']
      },
      {
        id: 'forms',
        label: 'Forms',
        icon: ClipboardList,
        roles: ['admin']
      },
      {
        id: 'knowledge-base',
        label: 'Knowledge Base',
        icon: BookOpen,
        roles: ['admin', 'district-manager', 'store-manager']
      }
    ]
  },
  {
    label: 'Analytics & Reports',
    items: [
      {
        id: 'analytics',
        label: 'Analytics',
        icon: BarChart3,
        roles: ['admin', 'district-manager']
      },
      {
        id: 'reports',
        label: 'Reports',
        icon: FileText,
        roles: ['admin', 'district-manager']
      }
    ]
  },
  {
    label: 'Compliance & Settings',
    items: [
      {
        id: 'compliance',
        label: 'Compliance',
        icon: UserCheck,
        roles: ['admin'],
        badge: '2'
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        roles: ['admin']
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
  onNavigate
}: DashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState(currentView);

  // Update activeTab when currentView changes
  React.useEffect(() => {
    setActiveTab(currentView);
  }, [currentView]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const roleLabels = {
    'admin': 'Administrator',
    'district-manager': 'District Manager',
    'store-manager': 'Store Manager'
  };

  const getRoleDescription = () => {
    switch (currentRole) {
      case 'admin':
        return 'Full system access';
      case 'district-manager':
        return 'Multi-unit oversight';
      case 'store-manager':
        return 'Store operations';
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

  const getFilteredGroups = () => {
    return navigationGroups.map(group => ({
      ...group,
      items: group.items.filter(item => item.roles.includes(currentRole))
    })).filter(group => group.items.length > 0);
  };

  const filteredGroups = getFilteredGroups();

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className={`bg-sidebar border-r border-sidebar-border transition-all duration-300 shadow-lg ${
        sidebarCollapsed ? 'w-16' : 'w-72'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo and collapse button */}
          <div className="flex items-center justify-between p-6 border-b border-sidebar-border">
            {!sidebarCollapsed && (
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 flex items-center justify-center">
                  <img src={trikeLogo} alt="Trike Logo" className="w-10 h-10 object-contain" />
                </div>
                <div>
                  <h2 className="font-bold text-sidebar-foreground text-lg">Trike.co</h2>
                  <p className="text-xs text-muted-foreground">Backoffice</p>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="flex items-center justify-center w-full">
                <img src={trikeLogo} alt="Trike Logo" className="w-8 h-8 object-contain" />
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

          {/* Role Switcher */}
          {!sidebarCollapsed && (
            <div className="p-6 border-b border-sidebar-border bg-accent dark:bg-sidebar-accent">
              <div className="space-y-3">
                <label className="text-xs font-bold text-brand-grey dark:text-sidebar-foreground uppercase tracking-wide">
                  Current Role
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
                        <span>Administrator</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="district-manager">
                      <div className="flex items-center space-x-2">
                        <Building className="h-4 w-4 text-primary" />
                        <span>District Manager</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="store-manager">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-primary" />
                        <span>Store Manager</span>
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
                    {group.label}
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
                            } else if (item.id === 'settings') {
                              onNavigate('settings');
                            } else {
                              onNavigate('dashboard');
                            }
                          }
                        }}
                      >
                        <Icon className={`h-5 w-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                        {!sidebarCollapsed && (
                          <>
                            <span className="flex-1 text-left font-medium">{item.label}</span>
                            <div className="flex items-center space-x-2">
                              {item.isNew && (
                                <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs px-2 py-0">
                                  NEW
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

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Enhanced Top bar */}
        <header className="bg-card border-b border-border px-8 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees, content, reports..."
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
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
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
                    <h4 className="font-semibold">Notifications</h4>
                  </div>
                  <DropdownMenuItem className="p-3">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">Safety Training Overdue</p>
                      <p className="text-xs text-muted-foreground">3 employees in Store A</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="p-3">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">New Compliance Update</p>
                      <p className="text-xs text-muted-foreground">Requires immediate attention</p>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Separator orientation="vertical" className="h-6" />
              
              <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                <AvatarImage src="/placeholder-avatar.jpg" alt="User" />
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                  JD
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Page content with enhanced spacing */}
        <main className="flex-1 overflow-auto bg-background">
          <div className="p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}