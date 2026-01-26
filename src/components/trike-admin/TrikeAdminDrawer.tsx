import React, { useState } from 'react';
import { Briefcase, X, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from '../ui/drawer';
import { cn } from '../ui/utils';
import { TrikeAdminLayout, TrikeAdminView } from './TrikeAdminLayout';
import { DealDashboard } from './DealDashboard';
import { DealPipelineBoard } from './DealPipelineBoard';

interface TrikeAdminDrawerProps {
  /**
   * Whether to show the floating trigger button.
   * Only shown for trike-super-admin role.
   */
  isVisible?: boolean;
}

/**
 * Floating drawer for Trike Admin tools.
 *
 * This provides a slide-out panel with internal Trike tools
 * for managing the sales pipeline, customer accounts, and proposals.
 *
 * Only visible to users with trike-super-admin role.
 */
export function TrikeAdminDrawer({ isVisible = true }: TrikeAdminDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<TrikeAdminView>('dashboard');

  if (!isVisible) {
    return null;
  }

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
    <Drawer direction="right" open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        <Button
          className={cn(
            'fixed bottom-6 right-6 z-50',
            'h-14 w-14 rounded-full shadow-lg',
            'bg-gradient-to-br from-orange-500 to-amber-500',
            'hover:from-orange-600 hover:to-amber-600',
            'text-white',
            'transition-all duration-200',
            'hover:scale-105 active:scale-95',
            'flex items-center justify-center'
          )}
          size="icon"
        >
          <Briefcase className="h-6 w-6" />
          <span className="sr-only">Open Trike Admin</span>
        </Button>
      </DrawerTrigger>

      <DrawerContent
        className={cn(
          'fixed inset-y-0 right-0 z-50',
          'w-[95vw] max-w-6xl',
          'border-l border-border',
          'bg-background',
          'shadow-2xl',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
          'duration-300'
        )}
        data-hide-overlay={false}
      >
        <TrikeAdminLayout
          currentView={currentView}
          onViewChange={setCurrentView}
          onClose={() => setIsOpen(false)}
        >
          {renderContent()}
        </TrikeAdminLayout>
      </DrawerContent>
    </Drawer>
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
    <div className="flex-1 flex items-center justify-center p-8">
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
