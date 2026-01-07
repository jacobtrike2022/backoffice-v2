// ============================================================================
// PROGRESS ZAP SCREEN
// ============================================================================
// Shows lightning bolt with neon glow during generation
// Displays stepper progress and counts as they become available
// ============================================================================

import React from 'react';
import { Zap, Search, Brain, FileText, AlertTriangle, RefreshCcw, Eye } from 'lucide-react';
import { Button } from '../ui/button';

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
}: ProgressZapScreenProps) {
  const config = STAGE_CONFIG[stage];
  const isFailed = stage === 'failed';
  const isComplete = stage === 'complete';
  const currentIndex = config.index;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {/* Lightning bolt with neon glow */}
      <div className="relative mb-8">
        {/* Glow effect */}
        {!isFailed && !isComplete && (
          <>
            <div className="absolute inset-0 blur-2xl bg-primary/30 rounded-full animate-pulse" />
            <div className="absolute inset-0 blur-xl bg-primary/40 rounded-full animate-pulse delay-100" />
          </>
        )}

        {/* Lightning icon */}
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
      <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
        {isFailed && error ? error : config.description}
      </p>

      {/* Progress stepper */}
      {!isFailed && (
        <div className="flex items-center gap-2 mb-8">
          {['researching', 'extracting', 'generating'].map((s, index) => {
            const stepConfig = STAGE_CONFIG[s as keyof typeof STAGE_CONFIG];
            const Icon = stepConfig.icon;
            const isActive = currentIndex === index;
            const isComplete = currentIndex > index;

            return (
              <React.Fragment key={s}>
                <div
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-full text-sm
                    transition-all duration-300
                    ${isActive ? 'bg-primary text-primary-foreground scale-105' : ''}
                    ${isComplete ? 'bg-primary/20 text-primary' : ''}
                    ${!isActive && !isComplete ? 'bg-muted text-muted-foreground' : ''}
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
        {/* Evidence count */}
        <div className="p-4 rounded-xl border border-border bg-card text-center">
          <div className="text-3xl font-bold text-foreground mb-1">
            {evidenceCount}
          </div>
          <div className="text-xs text-muted-foreground">
            Sources found
          </div>
          {rejectedCount > 0 && (
            <div className="text-xs text-amber-500 mt-1">
              {rejectedCount} filtered out
            </div>
          )}
        </div>

        {/* Key facts count */}
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
