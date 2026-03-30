import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import type {
  KeyFactsExtractionResponse,
  RetrievalResponse,
} from '../../lib/crud/trackRelationships';
import type { VariantDraft } from '../../lib/crud/trackRelationships';

export interface VariantPipelineFailureDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  failedStage: string | null;
  error: string | null;
  keyFactsResponse: KeyFactsExtractionResponse | null;
  retrievalResponse: RetrievalResponse | null;
  draft: VariantDraft | null;
}

function gateLabel(code: string): string {
  switch (code) {
    case 'A':
      return 'Scope / learner action';
    case 'B':
      return 'Strong claim needs primary source';
    case 'C':
      return 'Date / freshness';
    case 'D':
      return 'Duplicate fact';
    case 'E':
      return 'Batch size';
    case 'F':
      return 'State-specific (not generic)';
    case 'CITATION_VALIDATION':
      return 'Citation link';
    default:
      return code;
  }
}

function guidanceForGates(failedGates: string[]): string[] {
  const out: string[] = [];
  const set = new Set(failedGates);
  if (set.has('CITATION_VALIDATION')) {
    out.push(
      'Facts must cite retrieved sources by ID or URL. Repeated failures often mean research returned pages the model did not reference correctly—try regenerating, or refine the research plan / queries for more official state resources.',
    );
  }
  if (set.has('A')) {
    out.push(
      'Wording did not align with an allowed learner action in the scope contract. Confirm audience roles, or adjust the contract / source so claims match those actions.',
    );
  }
  if (set.has('B')) {
    out.push(
      'A “strong” regulatory claim (must, shall, illegal, etc.) needs Tier 1 or Tier 2 evidence. Prefer state ABC / statute / rule links, or soften language in the source before adapting.',
    );
  }
  if (set.has('D')) {
    out.push('Two candidate facts were too similar; retrying often clears this.');
  }
  if (set.has('F')) {
    out.push(
      'Fact sounded like generic US retail training, not a state-specific statute or agency rule. Ask for ABC/SLA sections or named provisions in the research/evidence.',
    );
  }
  return out;
}

export function VariantPipelineFailureDetails({
  open,
  onOpenChange,
  failedStage,
  error,
  keyFactsResponse,
  retrievalResponse,
  draft,
}: VariantPipelineFailureDetailsProps) {
  const rejectedGateCodes = useMemo(() => {
    const codes = new Set<string>();
    (keyFactsResponse?.rejectedFacts || []).forEach((r) => {
      (r.failedGates || []).forEach((g) => codes.add(g));
    });
    return Array.from(codes);
  }, [keyFactsResponse?.rejectedFacts]);

  const guidance = useMemo(
    () => guidanceForGates(rejectedGateCodes),
    [rejectedGateCodes],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-2 pr-14">
          <DialogTitle>What went wrong</DialogTitle>
          <DialogDescription className="text-left">
            {failedStage === 'key-facts' &&
              'Key facts could not be validated against the retrieved evidence under current quality rules.'}
            {failedStage === 'draft' &&
              'Draft generation was blocked after key facts were accepted.'}
            {!['key-facts', 'draft'].includes(failedStage || '') &&
              'Generation stopped during the pipeline.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[min(60vh,480px)] px-6">
          <div className="space-y-4 pb-6 text-sm">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
                {error}
              </div>
            )}

            {failedStage === 'draft' &&
              draft?.blockedReasons &&
              draft.blockedReasons.length > 0 && (
                <div>
                  <h4 className="font-medium text-foreground mb-2">Draft block reasons</h4>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    {draft.blockedReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

            {keyFactsResponse && (
              <>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-muted-foreground">Extraction status:</span>
                  <Badge
                    variant={
                      keyFactsResponse.overallStatus === 'FAIL'
                        ? 'destructive'
                        : keyFactsResponse.overallStatus === 'PASS_WITH_REVIEW'
                          ? 'secondary'
                          : 'default'
                    }
                  >
                    {keyFactsResponse.overallStatus}
                  </Badge>
                  {keyFactsResponse.extractionMethod && (
                    <Badge variant="outline">{keyFactsResponse.extractionMethod}</Badge>
                  )}
                </div>

                {keyFactsResponse.gateResults && keyFactsResponse.gateResults.length > 0 && (
                  <div>
                    <h4 className="font-medium text-foreground mb-2">Batch checks</h4>
                    <ul className="space-y-2">
                      {keyFactsResponse.gateResults.map((g, i) => (
                        <li
                          key={i}
                          className="rounded-md border border-border bg-muted/30 px-3 py-2"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{g.gateName}</span>
                            <Badge
                              variant={
                                g.status === 'FAIL'
                                  ? 'destructive'
                                  : g.status === 'PASS_WITH_REVIEW'
                                    ? 'secondary'
                                    : 'default'
                              }
                              className="text-xs"
                            >
                              {g.status}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground text-xs">{g.reason}</p>
                          {g.details && Object.keys(g.details).length > 0 && (
                            <pre className="mt-2 text-[10px] overflow-x-auto bg-background/50 p-2 rounded">
                              {JSON.stringify(g.details, null, 2)}
                            </pre>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {keyFactsResponse.keyFacts && keyFactsResponse.keyFacts.length > 0 && (
                  <div>
                    <h4 className="font-medium text-foreground mb-2">
                      Accepted facts ({keyFactsResponse.keyFacts.length})
                    </h4>
                    <ul className="space-y-2">
                      {keyFactsResponse.keyFacts.map((kf) => (
                        <li
                          key={kf.id}
                          className="rounded-md border border-border px-3 py-2 text-xs"
                        >
                          <p className="text-foreground">{kf.factText}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <Badge variant="outline" className="text-[10px]">
                              {kf.qaStatus}
                            </Badge>
                            {(kf.qaFlags || []).map((f, j) => (
                              <Badge key={j} variant="secondary" className="text-[10px]">
                                {f}
                              </Badge>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {keyFactsResponse.rejectedFacts && keyFactsResponse.rejectedFacts.length > 0 && (
                  <div>
                    <h4 className="font-medium text-foreground mb-2">
                      Rejected candidate facts ({keyFactsResponse.rejectedFacts.length})
                    </h4>
                    <ul className="space-y-3">
                      {keyFactsResponse.rejectedFacts.map((r, idx) => (
                        <li
                          key={idx}
                          className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2"
                        >
                          <p className="text-foreground text-xs mb-1">{r.factText}</p>
                          <p className="text-muted-foreground text-xs mb-2">{r.reason}</p>
                          <div className="flex flex-wrap gap-1">
                            {(r.failedGates || []).map((g) => (
                              <Badge key={g} variant="outline" className="text-[10px]">
                                {gateLabel(g)}
                              </Badge>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {retrievalResponse &&
              retrievalResponse.rejected &&
              retrievalResponse.rejected.length > 0 && (
                <div>
                  <h4 className="font-medium text-foreground mb-2">
                    Sources filtered during retrieval ({retrievalResponse.rejected.length})
                  </h4>
                  <ul className="space-y-2">
                    {retrievalResponse.rejected.map((rej, i) => (
                      <li key={i} className="text-xs border border-border rounded-md px-2 py-1.5">
                        <p className="truncate text-primary underline-offset-2" title={rej.url}>
                          {rej.url}
                        </p>
                        <p className="text-muted-foreground mt-0.5">{rej.reason}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {guidance.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-3">
                <h4 className="font-medium text-foreground mb-2">How to improve success</h4>
                <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground text-xs">
                  {guidance.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Product / engineering levers</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong className="text-foreground">Meet standards:</strong> richer official
                  sources, clearer scope contract actions, and research queries that target state
                  regulators (not blogs).
                </li>
                <li>
                  <strong className="text-foreground">Adjust guards:</strong> Gate E can allow a
                  review-only path when evidence exists but no fact survives QA; Gate B can treat
                  some strong claims as review instead of hard-fail (policy choice).
                </li>
                <li>
                  <strong className="text-foreground">Prompt / model:</strong> tighten key-fact JSON
                  so <code className="text-[10px]">evidenceId</code> always matches a retrieved
                  block ID.
                </li>
              </ul>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
