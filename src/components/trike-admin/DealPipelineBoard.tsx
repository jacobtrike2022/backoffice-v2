import React, { useState } from 'react';
import { Plus, Search, Filter, MoreHorizontal, SlidersHorizontal } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../ui/utils';
import { DealCard } from './DealCard';
import {
  type Deal,
  type DealStage,
  PIPELINE_STAGES,
  STAGE_CONFIG,
} from './types';

// Mock data - will be replaced with real API calls
const mockDeals: Partial<Deal>[] = [
  // Lead
  {
    id: 'lead-1',
    name: 'Pilot Flying J - Inbound',
    stage: 'lead',
    value: 15000,
    mrr: 1100,
    probability: 10,
    expected_close_date: '2026-04-15',
    organization: { id: 'org-l1', name: 'Pilot Flying J' } as any,
  },
  {
    id: 'lead-2',
    name: "Love's Travel - Referral",
    stage: 'lead',
    value: 28000,
    mrr: 2000,
    probability: 15,
    expected_close_date: '2026-04-01',
    organization: { id: 'org-l2', name: "Love's Travel Stops" } as any,
  },
  // Prospect
  {
    id: 'prospect-1',
    name: 'Wawa - Pilot Program',
    stage: 'prospect',
    value: 32000,
    mrr: 2300,
    probability: 30,
    expected_close_date: '2026-03-15',
    organization: { id: 'org-p1', name: 'Wawa' } as any,
    next_action: 'Send ROI calculator',
  },
  {
    id: 'prospect-2',
    name: 'RaceTrac - Enterprise',
    stage: 'prospect',
    value: 125000,
    mrr: 8900,
    probability: 35,
    expected_close_date: '2026-04-01',
    organization: { id: 'org-p2', name: 'RaceTrac' } as any,
  },
  {
    id: 'prospect-3',
    name: 'Sheetz - Regional',
    stage: 'prospect',
    value: 67000,
    mrr: 4800,
    probability: 25,
    expected_close_date: '2026-03-20',
    organization: { id: 'org-p3', name: 'Sheetz' } as any,
  },
  // Evaluating
  {
    id: 'eval-1',
    name: "Casey's General - Expansion",
    stage: 'evaluating',
    value: 78000,
    mrr: 5600,
    probability: 60,
    expected_close_date: '2026-03-01',
    organization: { id: 'org-e1', name: "Casey's General Stores" } as any,
    next_action: 'Finalize ROI analysis',
  },
  {
    id: 'eval-2',
    name: 'Kum & Go - Full Deploy',
    stage: 'evaluating',
    value: 89000,
    mrr: 6400,
    probability: 55,
    expected_close_date: '2026-02-28',
    organization: { id: 'org-e2', name: 'Kum & Go' } as any,
  },
  // Closing
  {
    id: 'close-1',
    name: 'QuikTrip - Initial Contract',
    stage: 'closing',
    value: 45000,
    mrr: 3200,
    probability: 85,
    expected_close_date: '2026-02-15',
    organization: { id: 'org-c1', name: 'QuikTrip' } as any,
    next_action: 'Send revised proposal',
  },
  {
    id: 'close-2',
    name: 'Buc-ee\'s - Phase 1',
    stage: 'closing',
    value: 156000,
    mrr: 11200,
    probability: 75,
    expected_close_date: '2026-02-20',
    organization: { id: 'org-c2', name: "Buc-ee's" } as any,
    next_action: 'Legal review',
  },
];

export function DealPipelineBoard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<Partial<Deal> | null>(null);

  // Group deals by stage
  const dealsByStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage] = mockDeals.filter((d) => d.stage === stage);
    return acc;
  }, {} as Record<DealStage, Partial<Deal>[]>);

  // Filter deals based on search
  const filteredDealsByStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage] = dealsByStage[stage].filter(
      (d) =>
        d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.organization?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return acc;
  }, {} as Record<DealStage, Partial<Deal>[]>);

  const getStageTotal = (stage: DealStage): number => {
    return filteredDealsByStage[stage].reduce((sum, d) => sum + (d.value || 0), 0);
  };

  const formatCurrency = (value: number): string => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Pipeline Board</h1>
            <p className="text-sm text-muted-foreground">
              Drag deals between stages or click to view details
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Sort
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Deal
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search deals or organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full min-w-max">
          {PIPELINE_STAGES.map((stage) => {
            const config = STAGE_CONFIG[stage];
            const deals = filteredDealsByStage[stage];
            const stageTotal = getStageTotal(stage);

            return (
              <div
                key={stage}
                className="w-80 flex flex-col bg-muted/30 rounded-lg"
              >
                {/* Stage Header */}
                <div
                  className={cn(
                    'p-3 rounded-t-lg border-b-2',
                    config.bgColor,
                    config.borderColor
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('font-semibold', config.color)}>
                        {config.label}
                      </span>
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {deals.length}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className={cn('text-sm font-medium', config.color)}>
                    {formatCurrency(stageTotal)}
                  </div>
                </div>

                {/* Deals */}
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-2">
                    {deals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        onSelect={setSelectedDeal}
                        onEdit={(d) => console.log('Edit deal:', d)}
                        onStageChange={(d, newStage) =>
                          console.log('Change stage:', d, newStage)
                        }
                      />
                    ))}

                    {deals.length === 0 && (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No deals in this stage
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Add Deal Button */}
                <div className="p-2 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-muted-foreground"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add deal
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Footer */}
      <div className="border-t border-border bg-card px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Total Deals:</span>{' '}
              <span className="font-semibold">
                {mockDeals.filter((d) => PIPELINE_STAGES.includes(d.stage!)).length}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Total Value:</span>{' '}
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(
                  mockDeals
                    .filter((d) => PIPELINE_STAGES.includes(d.stage!))
                    .reduce((sum, d) => sum + (d.value || 0), 0)
                )}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Weighted:</span>{' '}
              <span className="font-semibold">
                {formatCurrency(
                  mockDeals
                    .filter((d) => PIPELINE_STAGES.includes(d.stage!))
                    .reduce(
                      (sum, d) => sum + ((d.value || 0) * (d.probability || 0)) / 100,
                      0
                    )
                )}
              </span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Showing {mockDeals.length} deals
          </div>
        </div>
      </div>
    </div>
  );
}
