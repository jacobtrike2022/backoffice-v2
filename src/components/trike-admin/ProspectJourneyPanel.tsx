import React from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '../ui/drawer';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { cn } from '../ui/utils';
import {
  CheckCircle2,
  Circle,
  Play,
  Calculator,
  Users,
  FileText,
  CreditCard,
  Settings,
  Rocket,
  ChevronRight,
  X,
} from 'lucide-react';
import type { OrganizationStatus } from './types';

/**
 * Journey step definition
 */
interface JourneyStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'completed' | 'current' | 'upcoming' | 'locked';
  stage: OrganizationStatus; // Which org status this step belongs to
}

/**
 * Props for the ProspectJourneyPanel
 */
interface ProspectJourneyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentStatus?: OrganizationStatus;
  organizationName?: string;
  organizationId?: string;
  onStepClick?: (stepId: string, step: JourneyStep) => void;
}

/**
 * Define the journey steps - this maps to the prospect-to-client flow
 * These will eventually be dynamic based on org status and completion state
 */
const getJourneySteps = (currentStatus: OrganizationStatus): JourneyStep[] => {
  const statusOrder: OrganizationStatus[] = [
    'prospect',
    'evaluating',
    'closing',
    'onboarding',
    'live',
  ];

  const currentIndex = statusOrder.indexOf(currentStatus);

  const steps: JourneyStep[] = [
    {
      id: 'explore',
      title: 'Explore the Platform',
      description: 'Watch demo videos and explore sales content',
      icon: Play,
      stage: 'prospect',
      status: 'upcoming',
    },
    {
      id: 'roi',
      title: 'Calculate Your ROI',
      description: 'Input your data to see projected savings',
      icon: Calculator,
      stage: 'prospect',
      status: 'upcoming',
    },
    {
      id: 'invite',
      title: 'Invite Your Team',
      description: 'Share with decision makers and stakeholders',
      icon: Users,
      stage: 'evaluating',
      status: 'upcoming',
    },
    {
      id: 'proposal',
      title: 'Review Proposal',
      description: 'Review pricing and terms',
      icon: FileText,
      stage: 'closing',
      status: 'upcoming',
    },
    {
      id: 'sign',
      title: 'Sign Agreement',
      description: 'E-sign your service agreement',
      icon: FileText,
      stage: 'closing',
      status: 'upcoming',
    },
    {
      id: 'payment',
      title: 'Setup Payment',
      description: 'Configure billing and payment method',
      icon: CreditCard,
      stage: 'closing',
      status: 'upcoming',
    },
    {
      id: 'configure',
      title: 'Configure Account',
      description: 'Set up locations, users, and integrations',
      icon: Settings,
      stage: 'onboarding',
      status: 'upcoming',
    },
    {
      id: 'launch',
      title: 'Launch',
      description: 'Go live with your team',
      icon: Rocket,
      stage: 'onboarding',
      status: 'upcoming',
    },
  ];

  // Update status based on current org status
  return steps.map((step) => {
    const stepStageIndex = statusOrder.indexOf(step.stage);

    if (stepStageIndex < currentIndex) {
      return { ...step, status: 'completed' as const };
    } else if (stepStageIndex === currentIndex) {
      // First incomplete step in current stage is "current"
      // For now, mark first one as current
      return { ...step, status: 'current' as const };
    } else {
      return { ...step, status: 'upcoming' as const };
    }
  });
};

/**
 * ProspectJourneyPanel - A right-side drawer showing the prospect's journey
 * through evaluation, closing, and onboarding.
 *
 * This floats above the dashboard without blocking it, allowing the prospect
 * to see and interact with the actual product while being guided through their journey.
 *
 * Pattern: Copied from ProfilePreviewDrawer which is a working production component.
 */
export function ProspectJourneyPanel({
  isOpen,
  onClose,
  currentStatus = 'prospect',
  organizationName = 'Demo Company',
  organizationId,
  onStepClick,
}: ProspectJourneyPanelProps) {
  const steps = getJourneySteps(currentStatus);

  const firstIncompleteStep = steps.find(
    (s) => s.status === 'current' || s.status === 'upcoming'
  );

  // Group steps by stage for visual separation
  const prospectSteps = steps.filter(s => s.stage === 'prospect');
  const evaluatingSteps = steps.filter(s => s.stage === 'evaluating');
  const closingSteps = steps.filter(s => s.stage === 'closing');
  const onboardingSteps = steps.filter(s => s.stage === 'onboarding');

  const getStepIcon = (step: JourneyStep) => {
    const Icon = step.icon;

    if (step.status === 'completed') {
      return (
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        </div>
      );
    }

    if (step.status === 'current') {
      return (
        <div className="w-8 h-8 rounded-full bg-[#F64A05]/20 flex items-center justify-center ring-2 ring-[#F64A05] ring-offset-2 ring-offset-background">
          <Icon className="w-4 h-4 text-[#F64A05]" />
        </div>
      );
    }

    return (
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
    );
  };

  const renderStepGroup = (title: string, groupSteps: JourneyStep[], stageBadge: string) => {
    if (groupSteps.length === 0) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </span>
          <Badge variant="outline" className="text-xs">
            {stageBadge}
          </Badge>
        </div>
        <div className="space-y-1">
          {groupSteps.map((step, index) => (
            <button
              key={step.id}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                step.status === 'current' && 'bg-[#F64A05]/5 border border-[#F64A05]/20',
                step.status === 'completed' && 'bg-emerald-500/5',
                step.status === 'upcoming' && 'hover:bg-muted/50',
                step.status === 'locked' && 'opacity-50 cursor-not-allowed'
              )}
              disabled={step.status === 'locked'}
              onClick={() => onStepClick?.(step.id, step)}
            >
              {getStepIcon(step)}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm font-medium',
                  step.status === 'completed' && 'text-emerald-600 dark:text-emerald-400',
                  step.status === 'current' && 'text-[#F64A05]'
                )}>
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {step.description}
                </p>
              </div>
              {step.status === 'current' && (
                <ChevronRight className="w-4 h-4 text-[#F64A05]" />
              )}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Drawer
      open={isOpen}
      onOpenChange={() => {}}
      direction="right"
      modal={true}
      dismissible={false}
      shouldScaleBackground={false}
    >
      <DrawerContent
        className="flex flex-col fixed inset-y-0 right-0 w-full sm:w-[420px] max-w-[420px] h-screen z-[9999] bg-background border-l shadow-xl data-[vaul-drawer-direction=right]:!w-full data-[vaul-drawer-direction=right]:!h-screen"
        data-hide-overlay
      >
        {/* Header */}
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="text-lg">Your Journey</DrawerTitle>
              <DrawerDescription className="text-sm">
                {organizationName}
              </DrawerDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress indicator */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Progress</span>
              <span>{steps.filter(s => s.status === 'completed').length} of {steps.length} complete</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#F64A05] to-emerald-500 transition-all duration-500"
                style={{
                  width: `${(steps.filter(s => s.status === 'completed').length / steps.length) * 100}%`
                }}
              />
            </div>
          </div>
        </DrawerHeader>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {renderStepGroup('Getting Started', prospectSteps, 'Explore')}

          <Separator />

          {renderStepGroup('Evaluation', evaluatingSteps, 'Evaluate')}

          <Separator />

          {renderStepGroup('Close the Deal', closingSteps, 'Close')}

          <Separator />

          {renderStepGroup('Get Live', onboardingSteps, 'Onboard')}
        </div>

        {/* Footer */}
        <DrawerFooter className="border-t">
          <Button
            className="w-full bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
            onClick={() => {
              if (firstIncompleteStep && onStepClick) {
                onStepClick(firstIncompleteStep.id, firstIncompleteStep);
              }
            }}
            disabled={!firstIncompleteStep}
          >
            {firstIncompleteStep
              ? `Continue: ${firstIncompleteStep.title}`
              : 'Journey Complete!'}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full"
          >
            Minimize
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
