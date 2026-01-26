import React from 'react';
import { Building2, Users, FileText, Settings, TrendingUp, BarChart3, Home, X } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import trikeLogo from '../../assets/trike-logo.png';

export type TrikeAdminView =
  | 'dashboard'
  | 'pipeline'
  | 'organizations'
  | 'proposals'
  | 'analytics'
  | 'settings';

interface TrikeAdminLayoutProps {
  children: React.ReactNode;
  currentView: TrikeAdminView;
  onViewChange: (view: TrikeAdminView) => void;
  onClose: () => void;
}

const navigationItems: Array<{
  id: TrikeAdminView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    id: 'dashboard',
    label: 'Overview',
    icon: Home,
    description: 'Pipeline summary & metrics',
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    icon: TrendingUp,
    description: 'Deal board & management',
  },
  {
    id: 'organizations',
    label: 'Organizations',
    icon: Building2,
    description: 'All customer accounts',
  },
  {
    id: 'proposals',
    label: 'Proposals',
    icon: FileText,
    description: 'Sales proposals',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    description: 'Sales performance',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    description: 'Admin configuration',
  },
];

export function TrikeAdminLayout({
  children,
  currentView,
  onViewChange,
  onClose,
}: TrikeAdminLayoutProps) {
  return (
    <div className="flex h-full bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <img src={trikeLogo} alt="Trike" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-sm">Trike Admin</h2>
                <p className="text-xs text-muted-foreground">Internal Tools</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">{item.label}</div>
                  {!isActive && (
                    <div className="text-xs text-muted-foreground">
                      {item.description}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Trike Super Admin</span>
            <br />
            Internal use only
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  );
}
