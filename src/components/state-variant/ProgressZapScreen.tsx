// ============================================================================
// PROGRESS ZAP SCREEN
// ============================================================================
// Shows lightning bolt with neon glow during generation
// Displays stepper progress, counts, and research transparency details
// ============================================================================

import React, { useState } from 'react';
import { Zap, Search, Brain, FileText, AlertTriangle, RefreshCcw, Eye, ChevronDown, ChevronUp, Shield, Scale, Info, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';

interface PassMetrics {
  pass1: {
    queryCount: number;
    evidenceCount: number;
    highRelevanceCount: number;
    flaggedCount: number;
    rejectedCount: number;
  };
}

interface ResearchQuery {
  id: string;
  mappedAction: string;
  why: string;
  scopeJustification?: string;
}

interface EvidenceItem {
  url: string;
  title?: string;
  tier: number;
  relevanceStatus?: 'pass' | 'flagged' | 'reject';
  relevanceScore?: number;
  url_verified?: boolean | null;
  pass?: number;
  source?: string;
}

interface ProgressZapScreenProps {
  stage: 'researching' | 'extracting' | 'generating' | 'complete' | 'failed';
  evidenceCount: number;
  rejectedCount: number;
  keyFactsCount: number;
  rejectedFactsCount: number;
  error: string | null;
  failedStage: string | null;
  onRetry: () => void;
  onViewDetails?: () => void;
  // v3 research transparency props
  searchEngine?: 'perplexity' | 'openai_responses';
  pass2Triggered?: boolean;
  pass2Reason?: string[];
  passMetrics?: PassMetrics;
  researchQueries?: ResearchQuery[];
  evidenceItems?: EvidenceItem[];
}

const STAGE_CONFIG = {
  researching: {
    index: 0,
    label: 'Researching sources',
    description: 'Searching for state-specific regulations and guidance...',
    icon: Search,
  },
  extracting: {
    index: 1,
    label: 'Extracting Key Facts',
    description: 'Validating claims against source evidence...',
    icon: Brain,
  },
  generating: {
    index: 2,
    label: 'Generating draft',
    description: 'Creating state-specific variant with minimal changes...',
    icon: FileText,
  },
  complete: {
    index: 3,
    label: 'Complete',
    description: 'Your variant is ready for review!',
    icon: FileText,
  },
  failed: {
    index: -1,
    label: 'Generation blocked',
    description: 'Could not complete the generation',
    icon: AlertTriangle,
  },
};

function TierBadge({ tier }: { tier: number }) {
  if (tier === 1) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500/10 text-green-600 border border-green-500/20">
        <Shield className="w-3 h-3" />
        GOV
      </span>
    );
  }
  if (tier === 2) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
        <Scale className="w-3 h-3" />
        LEGAL
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-500/10 text-gray-500 border border-gray-500/20">
      <Info className="w-3 h-3" />
      WEB
    </span>
  );
}

function VerificationDot({ verified }: { verified: boolean | null | undefined }) {
  if (verified === true) {
    return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
  }
  if (verified === false) {
    return <XCircle className="w-3.5 h-3.5 text-red-400" />;
  }
  return <div className="w-3 h-3 rounded-full bg-gray-300 animate-pulse" />;
}

function RelevanceBadge({ status, score }: { status?: string; score?: number }) {
  if (status === 'flagged') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
        <AlertCircle className="w-3 h-3" />
        Flagged ({score}/10)
      </span>
    );
  }
  if (status === 'pass') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-600">
        {score}/10
      </span>
    );
  }
  return null;
}

export function ProgressZapScreen({
  stage,
  evidenceCount,
  rejectedCount,
  keyFactsCount,
  rejectedFactsCount,
  error,
  failedStage,
  onRetry,
  onViewDetails,
  searchEngine,
  pass2Triggered,
  pass2Reason,
  passMetrics,
  researchQueries,
  evidenceItems,
}: ProgressZapScreenProps) {
  const config = STAGE_CONFIG[stage];
  const isFailed = stage === 'failed';
  const isComplete = stage === 'complete';
  const currentIndex = config.index;
  const [showDetails, setShowDetails] = useState(false);

  const hasResearchData = (researchQueries && researchQueries.length > 0) || (evidenceItems && evidenceItems.length > 0);

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {/* Lightning bolt with neon glow */}
      <div className="relative mb-8">
        {!isFailed && !isComplete && (
          <>
            <div className="absolute inset-0 blur-2xl bg-primary/30 rounded-full animate-pulse" />
            <div className="absolute inset-0 blur-xl bg-primary/40 rounded-full animate-pulse delay-100" />
          </>
        )}
        <div
          className={`
            relative z-10 p-6 rounded-full
            ${isFailed
              ? 'bg-red-500/10'
              : isComplete
                ? 'bg-green-500/10'
                : 'bg-primary/10 animate-pulse'}
          `}
        >
          {isFailed ? (
            <AlertTriangle className="w-16 h-16 text-red-500" />
          ) : isComplete ? (
            <FileText className="w-16 h-16 text-green-500" />
          ) : (
            <Zap
              className={`
                w-16 h-16 text-primary
                ${!isFailed && !isComplete ? 'animate-zap-pulse' : ''}
              `}
              style={{
                filter: !isFailed && !isComplete ? 'drop-shadow(0 0 20px rgb(246, 74, 5))' : undefined,
              }}
            />
          )}
        </div>
      </div>

      {/* Status text */}
      <h3 className={`text-xl font-semibold mb-2 ${isFailed ? 'text-red-500' : ''}`}>
        {config.label}
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-2">
        {isFailed && error ? error : config.description}
      </p>

      {/* Search engine badge */}
      {searchEngine && (
        <div className="text-[11px] text-muted-foreground mb-6">
          Powered by {searchEngine === 'perplexity' ? 'Perplexity Deep Search' : 'OpenAI Web Search'}
        </div>
      )}

      {/* Progress stepper */}
      {!isFailed && (
        <div className="flex items-center gap-2 mb-8">
          {['researching', 'extracting', 'generating'].map((s, index) => {
            const stepConfig = STAGE_CONFIG[s as keyof typeof STAGE_CONFIG];
            const Icon = stepConfig.icon;
            const isActive = currentIndex === index;
            const isStepComplete = currentIndex > index;

            return (
              <React.Fragment key={s}>
                <div
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-full text-sm
                    transition-all duration-300
                    ${isActive ? 'bg-primary text-primary-foreground scale-105' : ''}
                    ${isStepComplete ? 'bg-primary/20 text-primary' : ''}
                    ${!isActive && !isStepComplete ? 'bg-muted text-muted-foreground' : ''}
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{stepConfig.label}</span>
                </div>
                {index < 2 && (
                  <div
                    className={`
                      w-8 h-0.5 transition-colors duration-300
                      ${currentIndex > index ? 'bg-primary' : 'bg-muted'}
                    `}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Counts */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
        <div className="p-4 rounded-xl border border-border bg-card text-center">
          <div className="text-3xl font-bold text-foreground mb-1">
            {evidenceCount}
          </div>
          <div className="text-xs text-muted-foreground">
            Sources found
          </div>
          {passMetrics?.pass1 && (
            <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
              {passMetrics.pass1.highRelevanceCount > 0 && (
                <div className="text-green-500">{passMetrics.pass1.highRelevanceCount} high relevance</div>
              )}
              {passMetrics.pass1.flaggedCount > 0 && (
                <div className="text-amber-500">{passMetrics.pass1.flaggedCount} flagged for review</div>
              )}
            </div>
          )}
          {rejectedCount > 0 && (
            <div className="text-xs text-red-400 mt-1">
              {rejectedCount} rejected (scope drift)
            </div>
          )}
        </div>

        <div className="p-4 rounded-xl border border-border bg-card text-center">
          <div className="text-3xl font-bold text-foreground mb-1">
            {keyFactsCount}
          </div>
          <div className="text-xs text-muted-foreground">
            Key facts validated
          </div>
          {rejectedFactsCount > 0 && (
            <div className="text-xs text-red-500 mt-1">
              {rejectedFactsCount} rejected
            </div>
          )}
        </div>
      </div>

      {/* Pass 2 indicator */}
      {pass2Triggered && (
        <div className="mt-4 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-600 max-w-md text-center">
          <Search className="w-3.5 h-3.5 inline mr-1.5" />
          Targeted follow-up search triggered
          {pass2Reason && pass2Reason.length > 0 && (
            <div className="text-[11px] mt-1 opacity-80">{pass2Reason[0]}</div>
          )}
        </div>
      )}

      {/* Research transparency toggle */}
      {hasResearchData && (
        <div className="w-full max-w-md mt-6">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
          >
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showDetails ? 'Hide' : 'Show'} research details
          </button>

          {showDetails && (
            <div className="mt-4 space-y-4 text-left">
              {/* Research queries */}
              {researchQueries && researchQueries.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                    Search Queries ({researchQueries.length})
                  </div>
                  <div className="space-y-2">
                    {researchQueries.map((q) => (
                      <div key={q.id} className="p-2.5 rounded-lg border border-border bg-card text-xs">
                        <div className="font-medium text-foreground">{q.mappedAction}</div>
                        <div className="text-muted-foreground mt-0.5">{q.why}</div>
                        {q.scopeJustification && (
                          <div className="text-[10px] text-green-500 mt-1">Scope: {q.scopeJustification}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidence items */}
              {evidenceItems && evidenceItems.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                    Sources Found ({evidenceItems.length})
                  </div>
                  <div className="space-y-1.5">
                    {evidenceItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card text-xs">
                        <VerificationDot verified={item.url_verified} />
                        <TierBadge tier={item.tier} />
                        <RelevanceBadge status={item.relevanceStatus} score={item.relevanceScore} />
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-blue-500 hover:underline flex-1 min-w-0"
                          title={item.url}
                        >
                          {item.title || item.url}
                        </a>
                        {item.pass === 2 && (
                          <span className="text-[10px] text-blue-400 whitespace-nowrap">Pass 2</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Failed state actions */}
      {isFailed && (
        <div className="flex items-center gap-3 mt-8">
          <Button onClick={onRetry} variant="default">
            <RefreshCcw className="w-4 h-4 mr-2" />
            Try again
          </Button>
          {onViewDetails && (
            <Button onClick={onViewDetails} variant="outline">
              <Eye className="w-4 h-4 mr-2" />
              View details
            </Button>
          )}
        </div>
      )}

      {/* CSS for zap pulse animation */}
      <style>{`
        @keyframes zap-pulse {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 20px rgb(246, 74, 5));
          }
          50% {
            transform: scale(1.05);
            filter: drop-shadow(0 0 30px rgb(246, 74, 5)) drop-shadow(0 0 60px rgb(246, 74, 5));
          }
        }
        .animate-zap-pulse {
          animation: zap-pulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default ProgressZapScreen;
