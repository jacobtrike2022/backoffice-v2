import React, { useState } from 'react';
import { DealDashboard } from './DealDashboard';
import { DealPipelineBoard } from './DealPipelineBoard';
import {
  Home,
  TrendingUp,
  Building2,
  FileText,
  BarChart3,
  Settings,
  Briefcase,
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

export type TrikeAdminView =
  | 'dashboard'
  | 'pipeline'
  | 'organizations'
  | 'proposals'
  | 'analytics'
  | 'settings';

const tabs: Array<{
  id: TrikeAdminView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Overview', icon: Home },
  { id: 'pipeline', label: 'Pipeline', icon: TrendingUp },
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'proposals', label: 'Proposals', icon: FileText },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

/**
 * Trike Admin Page - Full page view for sales pipeline management
 * Accessible via sidebar navigation for trike-super-admin role only
 */
export function TrikeAdminPage() {
  const [currentView, setCurrentView] = useState<TrikeAdminView>('dashboard');

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <DealDashboard onNavigate={setCurrentView} />;
      case 'pipeline':
        return <DealPipelineBoard />;
      case 'organizations':
        return (
          <PlaceholderView
            title="Organizations"
            description="Manage all customer accounts, demos, and prospects."
          />
        );
      case 'proposals':
        return (
          <PlaceholderView
            title="Proposals"
            description="Create, send, and track sales proposals."
          />
        );
      case 'analytics':
        return (
          <PlaceholderView
            title="Analytics"
            description="Sales performance metrics and reporting."
          />
        );
      case 'settings':
        return (
          <PlaceholderView
            title="Settings"
            description="Configure admin tools and preferences."
          />
        );
      default:
        return <DealDashboard onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="flex flex-col h-full -m-8">
      {/* Tab Navigation */}
      <div className="border-b border-border bg-card px-6">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentView === tab.id;
            return (
              <Button
                key={tab.id}
                variant="ghost"
                size="sm"
                onClick={() => setCurrentView(tab.id)}
                className={cn(
                  'gap-2 rounded-none border-b-2 -mb-px h-12',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
}

/**
 * Placeholder view for sections not yet implemented
 */
function PlaceholderView({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-8 h-full">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Briefcase className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-muted-foreground mb-6">{description}</p>
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          Coming soon
        </div>
      </div>
    </div>
  );
}
