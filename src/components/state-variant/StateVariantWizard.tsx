// ============================================================================
// STATE VARIANT WIZARD - Main Entry Point
// ============================================================================
// A 4-step wizard for creating state-specific content variants with AI research
// Step 1: Audience confirmation (role selection if needed)
// Step 2: Research Plan preview
// Step 3: Creating... (research + key facts + draft generation)
// Step 4: Editor view (redline + notes rail + lightning bolt)
// ============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../ui/dialog';
import { Button } from '../ui/button';
import {
  ArrowLeft,
  ArrowRight,
  X,
  MapPin,
  Users,
  Search,
  FileText,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

import { RolePillsSelector } from './RolePillsSelector';
import { ResearchPlanPreview } from './ResearchPlanPreview';
import { ProgressZapScreen } from './ProgressZapScreen';
import { VariantEditorLayout } from './VariantEditorLayout';

import {
  buildScopeContract,
  freezeScopeContractRoles,
  buildResearchPlan,
  retrieveEvidence,
  extractKeyFacts,
  generateDraft,
  type ScopeContractResponse,
  type ResearchPlanResponse,
  type RetrievalResponse,
  type KeyFactsExtractionResponse,
  type VariantDraft,
  type LearnerRole,
  type VariantContext,
  type OrgRoleMatch,
} from '../../lib/crud/trackRelationships';

// US States data
export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
];

export interface StateVariantWizardProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTrack: {
    id: string;
    title: string;
    type: 'article' | 'video' | 'story' | 'checkpoint';
    content_text?: string;
    transcript?: string;
    description?: string;
  };
  onComplete?: (draft: VariantDraft) => void;
  initialState?: { code: string; name: string };
}

type WizardStep = 'state-select' | 'audience' | 'research-plan' | 'creating' | 'editor';

interface WizardState {
  step: WizardStep;
  // State selection
  selectedState: { code: string; name: string } | null;
  // Step 1: Scope contract
  contractId: string | null;
  scopeContract: ScopeContractResponse | null;
  roleSelectionNeeded: boolean;
  selectedRoles: LearnerRole[];
  topRoleMatches: OrgRoleMatch[];
  // Step 2: Research plan
  planId: string | null;
  researchPlan: ResearchPlanResponse | null;
  avoidTopics: string;
  // Step 3: Progress tracking
  progressStage: 'researching' | 'extracting' | 'generating' | 'complete' | 'failed';
  evidenceCount: number;
  rejectedCount: number;
  keyFactsCount: number;
  rejectedFactsCount: number;
  // Step 3 results
  retrievalResponse: RetrievalResponse | null;
  keyFactsResponse: KeyFactsExtractionResponse | null;
  // Step 4: Draft
  draftId: string | null;
  draft: VariantDraft | null;
  // Error state
  error: string | null;
  failedStage: string | null;
}

const STEP_CONFIG = {
  'state-select': { index: 0, title: 'Select State', icon: MapPin },
  'audience': { index: 1, title: 'Confirm Audience', icon: Users },
  'research-plan': { index: 2, title: 'Research Plan', icon: Search },
  'creating': { index: 3, title: 'Creating', icon: FileText },
  'editor': { index: 4, title: 'Review & Edit', icon: FileText },
};

export function StateVariantWizard({
  isOpen,
  onClose,
  sourceTrack,
  onComplete,
  initialState,
}: StateVariantWizardProps) {
  const [state, setState] = useState<WizardState>({
    step: initialState ? 'audience' : 'state-select',
    selectedState: initialState || null,
    contractId: null,
    scopeContract: null,
    roleSelectionNeeded: false,
    selectedRoles: [],
    topRoleMatches: [],
    planId: null,
    researchPlan: null,
    avoidTopics: '',
    progressStage: 'researching',
    evidenceCount: 0,
    rejectedCount: 0,
    keyFactsCount: 0,
    rejectedFactsCount: 0,
    retrievalResponse: null,
    keyFactsResponse: null,
    draftId: null,
    draft: null,
    error: null,
    failedStage: null,
  });

  const [isLoading, setIsLoading] = useState(false);

  // Auto-fetch scope contract when initialState is provided
  useEffect(() => {
    if (isOpen && initialState && !state.contractId && !isLoading) {
      handleStateSelect(initialState);
    }
  }, [isOpen, initialState]);

  // Get source content from track
  const getSourceContent = useCallback(() => {
    if (sourceTrack.content_text) return sourceTrack.content_text;
    if (sourceTrack.transcript) return sourceTrack.transcript;
    if (sourceTrack.description) return sourceTrack.description;
    return '';
  }, [sourceTrack]);

  // Build variant context
  const getVariantContext = useCallback((): VariantContext => {
    return {
      state_code: state.selectedState?.code,
      state_name: state.selectedState?.name,
    };
  }, [state.selectedState]);

  // Step 1: Build scope contract when state is selected
  const handleStateSelect = async (selectedState: { code: string; name: string }) => {
    setState(prev => ({ ...prev, selectedState, isLoading: true, error: null }));
    setIsLoading(true);

    try {
      const response = await buildScopeContract(
        sourceTrack.id,
        'geographic',
        { state_code: selectedState.code, state_name: selectedState.name },
        true
      );

      setState(prev => ({
        ...prev,
        step: 'audience',
        contractId: response.contractId,
        scopeContract: response,
        roleSelectionNeeded: response.roleSelectionNeeded,
        topRoleMatches: response.topRoleMatches || [],
        selectedRoles: response.roleSelectionNeeded && response.topRoleMatches
          ? response.topRoleMatches.slice(0, 3).map(r => r.roleName as LearnerRole)
          : [response.scopeContract.primaryRole],
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to analyze content',
        failedStage: 'scope-contract',
      }));
      toast.error('Failed to analyze content', { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle role toggle
  const handleRoleToggle = (role: LearnerRole) => {
    setState(prev => {
      const isSelected = prev.selectedRoles.includes(role);
      if (isSelected) {
        return { ...prev, selectedRoles: prev.selectedRoles.filter(r => r !== role) };
      } else {
        return { ...prev, selectedRoles: [...prev.selectedRoles, role] };
      }
    });
  };

  // Freeze roles and proceed to research plan
  const handleConfirmRoles = async () => {
    if (!state.contractId || state.selectedRoles.length === 0) return;

    setIsLoading(true);
    try {
      if (state.roleSelectionNeeded) {
        await freezeScopeContractRoles(
          state.contractId,
          state.selectedRoles[0],
          state.selectedRoles.slice(1)
        );
      }

      // Build research plan
      const planResponse = await buildResearchPlan(
        state.contractId,
        state.selectedState!.code,
        state.selectedState!.name,
        true
      );

      setState(prev => ({
        ...prev,
        step: 'research-plan',
        planId: planResponse.planId,
        researchPlan: planResponse,
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to build research plan',
        failedStage: 'research-plan',
      }));
      toast.error('Failed to build research plan', { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Run the full generation pipeline
  const handleConfirmResearch = async () => {
    if (!state.planId || !state.contractId || !state.selectedState) return;

    setState(prev => ({
      ...prev,
      step: 'creating',
      progressStage: 'researching',
      error: null,
      failedStage: null,
    }));

    try {
      // Step 1: Retrieve evidence
      const retrievalResult = await retrieveEvidence(
        state.planId,
        state.contractId,
        getSourceContent()
      );

      setState(prev => ({
        ...prev,
        evidenceCount: retrievalResult.evidenceCount,
        rejectedCount: retrievalResult.rejectedCount,
        retrievalResponse: retrievalResult,
        progressStage: 'extracting',
      }));

      // Step 2: Extract key facts
      const keyFactsResult = await extractKeyFacts(
        state.contractId,
        state.planId,
        retrievalResult.evidence,
        state.selectedState.code,
        state.selectedState.name,
        getSourceContent()
      );

      setState(prev => ({
        ...prev,
        keyFactsCount: keyFactsResult.keyFactsCount,
        rejectedFactsCount: keyFactsResult.rejectedFactsCount,
        keyFactsResponse: keyFactsResult,
        progressStage: 'generating',
      }));

      // Check if we should proceed (FAIL blocks generation)
      if (keyFactsResult.overallStatus === 'FAIL') {
        setState(prev => ({
          ...prev,
          progressStage: 'failed',
          error: 'Quality gate failed - insufficient evidence for state-specific claims',
          failedStage: 'key-facts',
        }));
        return;
      }

      // Step 3: Generate draft
      const draftResult = await generateDraft({
        contractId: state.contractId,
        extractionId: keyFactsResult.extractionId,
        sourceTrackId: sourceTrack.id,
        stateCode: state.selectedState.code,
        stateName: state.selectedState.name,
        sourceContent: getSourceContent(),
        sourceTitle: sourceTrack.title,
        trackType: sourceTrack.type,
      });

      // Check if draft was blocked
      if (draftResult.draft.status === 'blocked') {
        setState(prev => ({
          ...prev,
          progressStage: 'failed',
          error: `Draft blocked: ${draftResult.draft.blockedReasons?.join(', ') || 'Unknown reason'}`,
          failedStage: 'draft',
          draftId: draftResult.draft.draftId,
          draft: draftResult.draft,
        }));
        return;
      }

      // Success - move to editor
      setState(prev => ({
        ...prev,
        progressStage: 'complete',
        draftId: draftResult.draft.draftId,
        draft: draftResult.draft,
        step: 'editor',
      }));

      // Persist draft ID to URL for resilience
      const url = new URL(window.location.href);
      url.searchParams.set('draftId', draftResult.draft.draftId);
      window.history.replaceState({}, '', url.toString());

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        progressStage: 'failed',
        error: error.message || 'Generation failed',
        failedStage: prev.progressStage,
      }));
      toast.error('Generation failed', { description: error.message });
    }
  };

  // Retry failed stage
  const handleRetry = () => {
    if (state.failedStage === 'scope-contract') {
      if (state.selectedState) {
        handleStateSelect(state.selectedState);
      }
    } else if (state.failedStage === 'research-plan') {
      handleConfirmRoles();
    } else {
      handleConfirmResearch();
    }
  };

  // Handle draft update from lightning bolt
  const handleDraftUpdate = (updatedDraft: VariantDraft) => {
    setState(prev => ({ ...prev, draft: updatedDraft }));
  };

  // Handle publish
  const handlePublish = () => {
    if (state.draft && onComplete) {
      onComplete(state.draft);
    }
  };

  // Navigation helpers
  const canGoBack = state.step !== 'state-select' && state.step !== 'creating';

  const handleBack = () => {
    setState(prev => {
      switch (prev.step) {
        case 'audience':
          return { ...prev, step: 'state-select' };
        case 'research-plan':
          return { ...prev, step: 'audience' };
        case 'editor':
          return { ...prev, step: 'research-plan' };
        default:
          return prev;
      }
    });
  };

  // Render step content
  const renderStepContent = () => {
    switch (state.step) {
      case 'state-select':
        return (
          <StateSelector
            selectedState={state.selectedState}
            onSelect={handleStateSelect}
            isLoading={isLoading}
          />
        );

      case 'audience':
        // Show loading state while fetching scope contract
        if (isLoading && !state.scopeContract) {
          return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing content for {state.selectedState?.name}...</p>
            </div>
          );
        }

        // Show error state if there was a failure
        if (state.error && state.failedStage === 'scope-contract') {
          return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="p-3 rounded-full bg-destructive/10">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <p className="text-sm text-destructive text-center">{state.error}</p>
              <Button onClick={handleRetry} variant="outline">
                Try Again
              </Button>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            {state.roleSelectionNeeded ? (
              <RolePillsSelector
                roles={state.topRoleMatches}
                selectedRoles={state.selectedRoles}
                onToggle={handleRoleToggle}
                scopeContract={state.scopeContract?.scopeContract}
              />
            ) : (
              <InferredRoleDisplay
                scopeContract={state.scopeContract?.scopeContract}
              />
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={handleBack} disabled={isLoading}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleConfirmRoles}
                disabled={isLoading || state.selectedRoles.length === 0}
              >
                {isLoading ? 'Building plan...' : 'Continue'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 'research-plan':
        return (
          <ResearchPlanPreview
            researchPlan={state.researchPlan}
            stateName={state.selectedState?.name || ''}
            avoidTopics={state.avoidTopics}
            onAvoidTopicsChange={(value) => setState(prev => ({ ...prev, avoidTopics: value }))}
            onBack={handleBack}
            onConfirm={handleConfirmResearch}
            isLoading={isLoading}
          />
        );

      case 'creating':
        return (
          <ProgressZapScreen
            stage={state.progressStage}
            evidenceCount={state.evidenceCount}
            rejectedCount={state.rejectedCount}
            keyFactsCount={state.keyFactsCount}
            rejectedFactsCount={state.rejectedFactsCount}
            error={state.error}
            failedStage={state.failedStage}
            onRetry={handleRetry}
            onViewDetails={() => {
              // Could open a modal with rejected facts/evidence
            }}
          />
        );

      case 'editor':
        if (!state.draft) return null;
        return (
          <VariantEditorLayout
            draft={state.draft}
            sourceContent={getSourceContent()}
            onDraftUpdate={handleDraftUpdate}
            onPublish={handlePublish}
            onClose={onClose}
            contractId={state.contractId || undefined}
            extractionId={state.keyFactsResponse?.extractionId}
          />
        );

      default:
        return null;
    }
  };

  // Use full-screen for editor step
  const isFullScreen = state.step === 'editor';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={
          isFullScreen
            ? "max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] p-0 rounded-none"
            : "max-w-2xl min-h-[300px]"
        }
        hideCloseButton={isFullScreen}
      >
        {!isFullScreen && (
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <DialogTitle>Create State Variant</DialogTitle>
                  <DialogDescription>
                    {sourceTrack.title}
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Step indicator */}
            {state.step !== 'editor' && (
              <StepIndicator currentStep={state.step} />
            )}
          </DialogHeader>
        )}

        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
}

// Step Indicator Component
function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const steps: WizardStep[] = ['state-select', 'audience', 'research-plan', 'creating'];
  const currentIndex = STEP_CONFIG[currentStep]?.index || 0;

  return (
    <div className="flex items-center gap-2 mt-4">
      {steps.map((step, index) => {
        const config = STEP_CONFIG[step];
        const isActive = index === currentIndex;
        const isComplete = index < currentIndex;
        const Icon = config.icon;

        return (
          <React.Fragment key={step}>
            <div
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors
                ${isActive ? 'bg-primary text-primary-foreground' : ''}
                ${isComplete ? 'bg-primary/20 text-primary' : ''}
                ${!isActive && !isComplete ? 'bg-muted text-muted-foreground' : ''}
              `}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{config.title}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-8 h-0.5 ${index < currentIndex ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// State Selector Component
function StateSelector({
  selectedState,
  onSelect,
  isLoading,
}: {
  selectedState: { code: string; name: string } | null;
  onSelect: (state: { code: string; name: string }) => void;
  isLoading: boolean;
}) {
  const [search, setSearch] = useState('');

  const filteredStates = US_STATES.filter(
    state =>
      state.name.toLowerCase().includes(search.toLowerCase()) ||
      state.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search states..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto pr-1">
        {filteredStates.map((state) => (
          <button
            key={state.code}
            onClick={() => onSelect(state)}
            disabled={isLoading}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all
              ${selectedState?.code === state.code
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-primary/50 hover:bg-accent'}
              ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
              {state.code}
            </span>
            <span className="text-sm truncate">{state.name}</span>
          </button>
        ))}
      </div>

      {filteredStates.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No states found matching "{search}"
        </div>
      )}
    </div>
  );
}

// Inferred Role Display (when roleSelectionNeeded is false)
function InferredRoleDisplay({
  scopeContract,
}: {
  scopeContract?: {
    primaryRole: LearnerRole;
    roleConfidence: 'high' | 'medium' | 'low';
    roleEvidenceQuotes: string[];
    instructionalGoal: string;
  };
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!scopeContract) return null;

  const confidenceColors = {
    high: 'text-green-500',
    medium: 'text-yellow-500',
    low: 'text-red-500',
  };

  const roleLabels: Record<LearnerRole, string> = {
    frontline_store_associate: 'Frontline Store Associate',
    manager_supervisor: 'Manager/Supervisor',
    delivery_driver: 'Delivery Driver',
    owner_executive: 'Owner/Executive',
    back_office_admin: 'Back Office Admin',
    other: 'Other',
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-border bg-card">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Detected audience</p>
            <p className="text-lg font-medium mt-1">
              {roleLabels[scopeContract.primaryRole]}
            </p>
          </div>
          <span className={`text-sm font-medium ${confidenceColors[scopeContract.roleConfidence]}`}>
            {scopeContract.roleConfidence} confidence
          </span>
        </div>

        {scopeContract.instructionalGoal && (
          <p className="text-sm text-muted-foreground mt-3 pt-3 border-t border-border">
            {scopeContract.instructionalGoal}
          </p>
        )}
      </div>

      {scopeContract.roleEvidenceQuotes.length > 0 && (
        <div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            {isExpanded ? 'Hide' : 'Show'} evidence quotes ({scopeContract.roleEvidenceQuotes.length})
          </button>

          {isExpanded && (
            <div className="mt-2 space-y-2">
              {scopeContract.roleEvidenceQuotes.map((quote, index) => (
                <blockquote
                  key={index}
                  className="text-sm italic text-muted-foreground border-l-2 border-primary/50 pl-3"
                >
                  "{quote}"
                </blockquote>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StateVariantWizard;
