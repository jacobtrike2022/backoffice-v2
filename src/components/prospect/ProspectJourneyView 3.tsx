import React, { useState, useEffect } from 'react';
import {
  Play,
  Calculator,
  Users,
  FileText,
  CreditCard,
  Rocket,
  CheckCircle2,
  Circle,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { cn } from '../ui/utils';
import { supabase, getCurrentUserOrgId } from '../../lib/supabase';
import { ProspectChecklist } from './ProspectChecklist';
import { ProposalView } from './ProposalView';
import { TeamInvite } from '../trike-admin/TeamInvite';

interface ProspectJourneyViewProps {
  onNavigate?: (view: string) => void;
}

interface JourneyStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'completed' | 'current' | 'upcoming';
}

const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Your Demo',
    description: 'Get started with your personalized demo environment',
    icon: Rocket,
    status: 'current',
  },
  {
    id: 'explore',
    title: 'Explore the Platform',
    description: 'Browse the content library and see what Trike can do for your team',
    icon: Play,
    status: 'upcoming',
  },
  {
    id: 'roi',
    title: 'Calculate Your ROI',
    description: 'See projected savings based on your operation',
    icon: Calculator,
    status: 'upcoming',
  },
  {
    id: 'invite',
    title: 'Invite Your Team',
    description: 'Share the demo with decision makers and stakeholders',
    icon: Users,
    status: 'upcoming',
  },
  {
    id: 'proposal',
    title: 'Review Your Proposal',
    description: 'Review pricing, terms, and sign when ready',
    icon: FileText,
    status: 'upcoming',
  },
  {
    id: 'billing',
    title: 'Set Up Billing',
    description: 'Add a payment method to get started',
    icon: CreditCard,
    status: 'upcoming',
  },
  {
    id: 'launch',
    title: 'Go Live',
    description: 'Complete your checklist and launch Trike for your team',
    icon: Rocket,
    status: 'upcoming',
  },
];

export function ProspectJourneyView({ onNavigate }: ProspectJourneyViewProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [orgData, setOrgData] = useState<{
    name: string;
    logo_url: string | null;
    demo_expires_at: string | null;
  } | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [showTeamInvite, setShowTeamInvite] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const id = await getCurrentUserOrgId();
        if (!id) return;
        setOrgId(id);
        const { data } = await supabase
          .from('organizations')
          .select('name, logo_url, demo_expires_at')
          .eq('id', id)
          .single();
        if (data) setOrgData(data);
      } catch {
        // Silent
      }
    })();
  }, []);

  const daysRemaining = orgData?.demo_expires_at
    ? Math.max(0, Math.ceil((new Date(orgData.demo_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const handleStepAction = (stepId: string) => {
    switch (stepId) {
      case 'explore':
        onNavigate?.('content');
        break;
      case 'roi':
      case 'invite':
      case 'proposal':
      case 'billing':
      case 'launch':
        // These will be wired to inline components in future phases
        break;
    }
  };

  const renderStepContent = () => {
    const step = JOURNEY_STEPS[activeStep];

    switch (step.id) {
      case 'welcome':
        return (
          <div className="space-y-6">
            <div className="text-center py-8">
              {orgData?.logo_url && (
                <img
                  src={orgData.logo_url}
                  alt={orgData.name}
                  className="h-16 w-auto mx-auto mb-4 object-contain"
                />
              )}
              <h2 className="text-2xl font-bold mb-2">
                Welcome to Your Trike Demo
                {orgData?.name && `, ${orgData.name}`}
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                This is your personalized demo environment. Follow the steps on the left
                to explore what Trike can do for your team.
              </p>
              {daysRemaining !== null && (
                <div className="mt-4 inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                    Demo expires in {daysRemaining} days
                  </span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveStep(1)}>
                <CardContent className="p-5 text-center">
                  <Play className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">Explore Content</h3>
                  <p className="text-xs text-muted-foreground">Browse training content</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveStep(2)}>
                <CardContent className="p-5 text-center">
                  <Calculator className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">ROI Calculator</h3>
                  <p className="text-xs text-muted-foreground">See projected savings</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveStep(3)}>
                <CardContent className="p-5 text-center">
                  <Users className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">Invite Team</h3>
                  <p className="text-xs text-muted-foreground">Share with stakeholders</p>
                </CardContent>
              </Card>
            </div>

            <ProspectChecklist
              onNavigate={onNavigate}
              onStepClick={setActiveStep}
            />
          </div>
        );

      case 'explore':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Explore the Platform</h2>
            <p className="text-muted-foreground">
              Browse our content library to see the training materials, compliance courses,
              and resources available for your team.
            </p>
            <Button onClick={() => onNavigate?.('content')}>
              <Play className="h-4 w-4 mr-2" />
              Open Content Library
            </Button>
          </div>
        );

      case 'roi':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Calculate Your ROI</h2>
            <p className="text-muted-foreground">
              Input your operational data to see the projected savings and efficiency
              gains from implementing Trike across your locations.
            </p>
            <div className="rounded-lg border bg-muted/30 p-8 text-center">
              <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">ROI Calculator will be displayed inline here</p>
            </div>
          </div>
        );

      case 'invite':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Invite Your Team</h2>
            <p className="text-muted-foreground">
              Invite decision makers and stakeholders to explore the demo with you.
              They'll receive an email invitation to join your demo environment.
            </p>
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-6 text-center">
                <Users className="h-10 w-10 text-primary mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Add Team Members</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                  Invite colleagues to explore the platform alongside you. They'll be able
                  to browse the content library and experience the demo firsthand.
                </p>
                <Button onClick={() => setShowTeamInvite(true)}>
                  <Users className="h-4 w-4 mr-2" />
                  Invite Team Members
                </Button>
              </CardContent>
            </Card>
            {orgId && (
              <TeamInvite
                open={showTeamInvite}
                onOpenChange={setShowTeamInvite}
                organizationId={orgId}
              />
            )}
          </div>
        );

      case 'proposal':
        return <ProposalView onAccepted={() => setActiveStep(5)} />;

      case 'billing':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Set Up Billing</h2>
            <p className="text-muted-foreground">
              Add a payment method to activate your account and proceed to onboarding.
            </p>
            <div className="rounded-lg border bg-muted/30 p-8 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Payment setup will be displayed inline here</p>
            </div>
          </div>
        );

      case 'launch':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Go Live</h2>
            <p className="text-muted-foreground">
              You're almost there! Complete your proposal review, set up billing,
              and your Trike representative will transition you to full onboarding.
            </p>
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-6 text-center">
                <Rocket className="h-10 w-10 text-primary mx-auto mb-3" />
                <h3 className="font-semibold text-lg mb-2">Ready to Go Live?</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                  Once you've accepted your proposal and set up billing, your account
                  will be activated and you'll be guided through client onboarding.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button variant="outline" onClick={() => setActiveStep(4)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Review Proposal
                  </Button>
                  <Button variant="outline" onClick={() => setActiveStep(5)}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Set Up Billing
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-full -m-8">
      {/* Step Sidebar */}
      <div className="w-80 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-lg">Your Journey</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Follow these steps to get started
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {JOURNEY_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === activeStep;
            const isCompleted = index < activeStep;

            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(index)}
                className={cn(
                  'w-full text-left rounded-lg p-3 transition-colors flex items-start gap-3',
                  isActive
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-muted/50'
                )}
              >
                <div className="shrink-0 mt-0.5">
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : isActive ? (
                    <div className="h-5 w-5 rounded-full border-2 border-primary flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    </div>
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    'text-sm font-medium',
                    isActive ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {step.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {step.description}
                  </div>
                </div>
                {isActive && (
                  <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}
