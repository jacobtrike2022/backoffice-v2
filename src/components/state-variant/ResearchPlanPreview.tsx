// ============================================================================
// RESEARCH PLAN PREVIEW
// ============================================================================
// Shows the research plan with queries, anchors, negatives, and confidence guardrails
// ============================================================================

import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Shield,
  BookOpen,
  Scale,
  FileCheck,
  HelpCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import type {
  ResearchPlanResponse,
  ResearchQuery,
  EvidenceTargetType
} from '../../lib/crud/trackRelationships';

interface ResearchPlanPreviewProps {
  researchPlan: ResearchPlanResponse | null;
  stateName: string;
  avoidTopics: string;
  onAvoidTopicsChange: (value: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

const targetTypeIcons: Record<EvidenceTargetType, React.ElementType> = {
  statute: Scale,
  regulation: FileCheck,
  agency_guidance: BookOpen,
  enforcement_policy: Shield,
  forms_or_signage: FileText,
  unknown: HelpCircle,
};

const targetTypeLabels: Record<EvidenceTargetType, string> = {
  statute: 'Statute',
  regulation: 'Regulation',
  agency_guidance: 'Agency Guidance',
  enforcement_policy: 'Enforcement',
  forms_or_signage: 'Forms/Signage',
  unknown: 'Unknown',
};

const targetTypeColors: Record<EvidenceTargetType, string> = {
  statute: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  regulation: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
  agency_guidance: 'bg-green-500/10 text-green-500 border-green-500/30',
  enforcement_policy: 'bg-red-500/10 text-red-500 border-red-500/30',
  forms_or_signage: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  unknown: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
};

export function ResearchPlanPreview({
  researchPlan,
  stateName,
  avoidTopics,
  onAvoidTopicsChange,
  onBack,
  onConfirm,
  isLoading,
}: ResearchPlanPreviewProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedQueries, setExpandedQueries] = useState<Set<string>>(new Set());

  const toggleQuery = (queryId: string) => {
    setExpandedQueries(prev => {
      const next = new Set(prev);
      if (next.has(queryId)) {
        next.delete(queryId);
      } else {
        next.add(queryId);
      }
      return next;
    });
  };

  if (!researchPlan) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const queries = researchPlan.researchPlan.queries || [];
  const globalNegatives = researchPlan.researchPlan.globalNegativeTerms || [];
  const sourcePolicy = researchPlan.researchPlan.sourcePolicy;

  return (
    <div className="flex flex-col max-h-[calc(80vh-120px)]">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-1">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Search className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Research Plan for {stateName}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              We'll search for state-specific regulations and guidance using these {queries.length} queries.
            </p>
          </div>
        </div>

        {/* Queries list */}
        <div className="space-y-2">
          {queries.map((query, index) => (
            <QueryCard
              key={query.id}
              query={query}
              index={index}
              isExpanded={expandedQueries.has(query.id)}
              onToggle={() => toggleQuery(query.id)}
            />
          ))}
        </div>

        {/* Confidence guardrails */}
        <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Confidence Guardrails</p>
              <p className="text-sm text-muted-foreground mt-1">
                We will only use evidence that matches the source's anchors & role authority.
                {sourcePolicy?.forbidTier3ForStrongClaims && (
                  <span className="block mt-1">
                    Strong claims require Tier 1 (official government) sources.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Advanced options */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Advanced options
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4">
            {/* Avoid topics input */}
            <div>
              <label className="text-sm font-medium block mb-2">
                Topics to avoid (optional)
              </label>
              <textarea
                value={avoidTopics}
                onChange={(e) => onAvoidTopicsChange(e.target.value)}
                placeholder="Enter topics to exclude from research, separated by commas..."
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                These will be added as negative terms to filter out irrelevant results.
              </p>
            </div>

            {/* Global negatives */}
            {globalNegatives.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Built-in exclusions</p>
                <div className="flex flex-wrap gap-1.5">
                  {globalNegatives.map((term, index) => (
                    <span
                      key={index}
                      className="text-xs px-2 py-1 rounded-md bg-red-500/10 text-red-500 border border-red-500/20"
                    >
                      -{term}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Source policy */}
            <div className="text-sm space-y-1 text-muted-foreground">
              <p className="font-medium text-foreground">Source Policy</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                {sourcePolicy?.preferTier1 && <li>Prefer official government sources (Tier 1)</li>}
                {sourcePolicy?.allowTier2Justia && <li>Allow legal databases like Justia (Tier 2)</li>}
                {sourcePolicy?.forbidTier3ForStrongClaims && <li>Require Tier 1/2 for strong claims</li>}
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Actions - fixed at bottom */}
      <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-border shrink-0">
        <Button variant="outline" onClick={onBack} disabled={isLoading}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onConfirm} disabled={isLoading}>
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              Starting research...
            </>
          ) : (
            <>
              Confirm & Research
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Query Card Component
function QueryCard({
  query,
  index,
  isExpanded,
  onToggle,
}: {
  query: ResearchQuery;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const TargetIcon = targetTypeIcons[query.targetType] || HelpCircle;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-accent/50 transition-colors"
      >
        <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className={`text-xs ${targetTypeColors[query.targetType]}`}
            >
              <TargetIcon className="w-3 h-3 mr-1" />
              {targetTypeLabels[query.targetType]}
            </Badge>
            <span className="text-xs text-muted-foreground truncate">
              {query.mappedAction}
            </span>
          </div>
          <p className="text-sm font-medium truncate">{query.query}</p>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-border bg-muted/30 space-y-3">
          {/* Anchor terms */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Anchor terms</p>
            <div className="flex flex-wrap gap-1">
              {query.anchorTerms.map((term, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                >
                  {term}
                </span>
              ))}
            </div>
          </div>

          {/* Negative terms */}
          {query.negativeTerms.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Excluded terms</p>
              <div className="flex flex-wrap gap-1">
                {query.negativeTerms.map((term, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500"
                  >
                    -{term}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Why */}
          {query.why && (
            <p className="text-xs text-muted-foreground italic">
              {query.why}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default ResearchPlanPreview;
