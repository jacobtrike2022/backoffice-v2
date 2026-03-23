import React, { useState, useCallback } from 'react';
import { DealDashboard } from './DealDashboard';
import { DealPipelineBoard } from './DealPipelineBoard';
import { OrganizationsList } from './OrganizationsList';
import { ProposalsList } from './ProposalsList';
import { PipelineAnalytics } from './PipelineAnalytics';
import { ProspectJourneyPanel } from './ProspectJourneyPanel';
import { DemoProvisioningModal } from './DemoProvisioningModal';
import { ROICalculator } from './ROICalculator';
import { GoLiveChecklist } from './GoLiveChecklist';
import { SendContractDialog } from './SendContractDialog';
import { PaymentSetup } from './PaymentSetup';
import { TeamInvite } from './TeamInvite';
import { PipelineNotificationsBell } from './PipelineNotifications';
import { CreateDemoModal } from './CreateDemoModal';
import { BatchDemoCreation } from './BatchDemoCreation';
import {
  Home,
  TrendingUp,
  Building2,
  FileText,
  BarChart3,
  Settings,
  Briefcase,
  UserCircle,
  Plus,
  Layers,
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { useCurrentUser } from '../../lib/hooks/useSupabase';
import type { OrganizationStatus } from './types';

export type TrikeAdminView =
  | 'dashboard'
  | 'pipeline'
  | 'organizations'
  | 'proposals'
  | 'analytics'
  | 'settings'
  | 'prospect-portal';

const tabs: Array<{
  id: TrikeAdminView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Overview', icon: Home },
  { id: 'pipeline', label: 'Demos', icon: TrendingUp },
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'proposals', label: 'Proposals', icon: FileText },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

/**
 * Trike Admin Page - Full page view for sales pipeline management
 * Accessible via sidebar navigation for trike-super-admin role only
 */
interface TrikeAdminPageProps {
  onPreviewOrg?: (orgId: string, orgName: string) => void;
  darkMode?: boolean;
}

export function TrikeAdminPage({ onPreviewOrg, darkMode }: TrikeAdminPageProps) {
  const { user } = useCurrentUser();
  const [currentView, setCurrentView] = useState<TrikeAdminView>('dashboard');
  const [isJourneyPanelOpen, setIsJourneyPanelOpen] = useState(false);
  const [isProvisioningModalOpen, setIsProvisioningModalOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedOrgName, setSelectedOrgName] = useState<string | null>(null);
  const [isROIOpen, setIsROIOpen] = useState(false);
  const [isGoLiveOpen, setIsGoLiveOpen] = useState(false);
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [isPaymentSetupOpen, setIsPaymentSetupOpen] = useState(false);
  const [isTeamInviteOpen, setIsTeamInviteOpen] = useState(false);
  const [orgListKey, setOrgListKey] = useState(0);
  const [isCreateDemoOpen, setIsCreateDemoOpen] = useState(false);
  const [isBatchDemoOpen, setIsBatchDemoOpen] = useState(false);

  // Journey panel state — tracks which org's journey to display
  const [journeyOrgId, setJourneyOrgId] = useState<string | null>(null);
  const [journeyOrgName, setJourneyOrgName] = useState<string>('Demo Company');
  const [journeyOrgStatus, setJourneyOrgStatus] = useState<OrganizationStatus>('demo');

  // Open journey panel for a specific org
  const handleOpenJourney = useCallback(
    (orgId: string, orgName: string, orgStatus?: OrganizationStatus) => {
      setJourneyOrgId(orgId);
      setJourneyOrgName(orgName);
      setJourneyOrgStatus(orgStatus || 'demo');
      setIsJourneyPanelOpen(true);
    },
    []
  );

  // Handle journey step clicks — navigate to the relevant section
  const handleJourneyStepClick = useCallback(
    (stepId: string) => {
      switch (stepId) {
        case 'explore':
          // In the real prospect flow, the App-level navigateTo('content') is called
          // and ContentLibrary detects ?preview=true from the URL.
          // From admin test, we append the param so it's visible when prospects view content.
          {
            const url = new URL(window.location.href);
            url.searchParams.set('preview', 'true');
            window.history.replaceState({}, '', url.toString());
          }
          break;
        case 'roi':
          setIsROIOpen(true);
          break;
        case 'invite':
          setIsTeamInviteOpen(true);
          break;
        case 'proposal':
          setCurrentView('proposals');
          break;
        case 'sign':
          setIsContractDialogOpen(true);
          break;
        case 'payment':
          setIsPaymentSetupOpen(true);
          break;
        case 'configure':
          setCurrentView('organizations');
          break;
        case 'launch':
          setIsGoLiveOpen(true);
          break;
      }
    },
    []
  );

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <DealDashboard
            onNavigate={setCurrentView}
            onProvisionDemo={(orgId, orgName) => {
              setSelectedOrgId(orgId);
              setSelectedOrgName(orgName);
              setIsProvisioningModalOpen(true);
            }}
          />
        );
      case 'pipeline':
        return <DealPipelineBoard onViewJourney={handleOpenJourney} />;
      case 'organizations':
        return (
          <OrganizationsList
            key={orgListKey}
            onViewJourney={handleOpenJourney}
            onProvisionDemo={(orgId, orgName) => {
              setSelectedOrgId(orgId);
              setSelectedOrgName(orgName);
              setIsProvisioningModalOpen(true);
            }}
            onPreviewOrg={onPreviewOrg}
            darkMode={darkMode}
          />
        );
      case 'proposals':
        return <ProposalsList />;
      case 'analytics':
        return <PipelineAnalytics />;
      case 'prospect-portal':
        return null;
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
    <>
      <div className="flex flex-col h-full -m-8">
        {/* Tab Navigation */}
        <div className="border-b border-border bg-card px-6">
          <div className="flex items-center justify-between">
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
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsBatchDemoOpen(true)}
              >
                <Layers className="h-4 w-4 mr-1.5" />
                Batch
              </Button>
              <Button
                size="sm"
                onClick={() => setIsCreateDemoOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Create Demo
              </Button>
              <PipelineNotificationsBell
                userId={user?.id || null}
                onNavigateToDeal={(dealId) => {
                  setCurrentView('pipeline');
                }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {renderContent()}
        </div>
      </div>

      {/* Prospect Journey Panel - rendered outside the main layout flow */}
      <ProspectJourneyPanel
        isOpen={isJourneyPanelOpen}
        onClose={() => setIsJourneyPanelOpen(false)}
        currentStatus={journeyOrgStatus}
        organizationName={journeyOrgName}
        organizationId={journeyOrgId || undefined}
        onStepClick={handleJourneyStepClick}
      />

      {selectedOrgId && selectedOrgName && (
        <DemoProvisioningModal
          isOpen={isProvisioningModalOpen}
          onClose={() => {
            setIsProvisioningModalOpen(false);
            setSelectedOrgId(null);
            setSelectedOrgName(null);
          }}
          organizationId={selectedOrgId}
          organizationName={selectedOrgName}
          onProvisioned={() => setOrgListKey((k) => k + 1)}
        />
      )}

      {/* ROI Calculator Dialog */}
      <ROICalculator
        open={isROIOpen}
        onOpenChange={setIsROIOpen}
      />

      {/* Go-Live Checklist Dialog */}
      {journeyOrgId && (
        <GoLiveChecklist
          open={isGoLiveOpen}
          onOpenChange={setIsGoLiveOpen}
          organizationId={journeyOrgId}
        />
      )}

      {/* Send Contract Dialog */}
      <SendContractDialog
        open={isContractDialogOpen}
        onOpenChange={setIsContractDialogOpen}
        organizationName={journeyOrgName}
      />

      {/* Payment Setup Dialog */}
      {journeyOrgId && (
        <PaymentSetup
          open={isPaymentSetupOpen}
          onOpenChange={setIsPaymentSetupOpen}
          organizationId={journeyOrgId}
        />
      )}

      {/* Team Invite Dialog */}
      {journeyOrgId && (
        <TeamInvite
          open={isTeamInviteOpen}
          onOpenChange={setIsTeamInviteOpen}
          organizationId={journeyOrgId}
        />
      )}

      {/* Create Demo Modal */}
      <CreateDemoModal
        isOpen={isCreateDemoOpen}
        onClose={() => setIsCreateDemoOpen(false)}
        onCreated={() => setOrgListKey((k) => k + 1)}
      />

      {/* Batch Demo Creation */}
      <BatchDemoCreation
        isOpen={isBatchDemoOpen}
        onClose={() => setIsBatchDemoOpen(false)}
        onCreated={() => setOrgListKey((k) => k + 1)}
      />
    </>
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
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          Coming soon
        </div>
      </div>
    </div>
  );
}

/**
 * Test view for the Prospect Portal / Journey Panel
 * This simulates what a prospect would see with the panel overlaid
 */
function ProspectPortalTestView({ onOpenPanel }: { onOpenPanel: () => void }) {
  return (
    <div className="flex-1 p-8 h-full overflow-auto">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Prospect Portal Preview</h1>
            <p className="text-muted-foreground mt-1">
              Test the journey panel that floats above the dashboard
            </p>
          </div>
          <Button
            onClick={onOpenPanel}
            className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white"
          >
            <UserCircle className="h-4 w-4 mr-2" />
            Open Journey Panel
          </Button>
        </div>

        {/* Simulated dashboard content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Mock dashboard cards to show the panel floats above real content */}
          <div className="bg-card border rounded-lg p-6">
            <h3 className="font-semibold mb-2">Content Library</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Browse training videos and compliance content
            </p>
            <div className="h-24 bg-muted rounded flex items-center justify-center text-muted-foreground text-sm">
              [Preview Content]
            </div>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <h3 className="font-semibold mb-2">Compliance Dashboard</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Track compliance status across locations
            </p>
            <div className="h-24 bg-muted rounded flex items-center justify-center text-muted-foreground text-sm">
              [Preview Charts]
            </div>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <h3 className="font-semibold mb-2">Team Management</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Manage users and assignments
            </p>
            <div className="h-24 bg-muted rounded flex items-center justify-center text-muted-foreground text-sm">
              [Preview Users]
            </div>
          </div>

          <div className="bg-card border rounded-lg p-6 md:col-span-2">
            <h3 className="font-semibold mb-2">Recent Activity</h3>
            <p className="text-sm text-muted-foreground mb-4">
              See what's happening across your organization
            </p>
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse" />
              ))}
            </div>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <h3 className="font-semibold mb-2">Quick Actions</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                Assign Training
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Run Report
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Add Location
              </Button>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <h3 className="font-semibold text-amber-600 dark:text-amber-400 mb-2">
            Testing Notes
          </h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Click "Open Journey Panel" to see the drawer slide in from the right</li>
            <li>• The dashboard content remains visible and interactive behind the panel</li>
            <li>• No overlay/backdrop blocks the dashboard (data-hide-overlay pattern)</li>
            <li>• Panel can be closed via the X button or "Minimize" button</li>
            <li>• This is what a prospect will see when logged into their demo account</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
