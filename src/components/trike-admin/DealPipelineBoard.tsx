import React, { useEffect, useState } from 'react';
import { Plus, Search, Filter, MoreHorizontal, SlidersHorizontal, Loader2 } from 'lucide-react';
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
import { getDealsByStage, updateDealStage } from '../../lib/crud/deals';

export function DealPipelineBoard() {
  const [loading, setLoading] = useState(true);
  const [dealsByStage, setDealsByStage] = useState<Record<DealStage, Deal[]>>({
    lead: [],
    prospect: [],
    evaluating: [],
    closing: [],
    won: [],
    lost: [],
    frozen: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<Partial<Deal> | null>(null);

  useEffect(() => {
    loadDeals();
  }, []);

  async function loadDeals() {
    try {
      setLoading(true);
      const data = await getDealsByStage();
      setDealsByStage(data);
    } catch (error) {
      console.error('Error loading deals by stage:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleStageChange(deal: Partial<Deal>, newStage: string) {
    if (!deal.id) return;
    try {
      await updateDealStage(deal.id, newStage as DealStage);
      await loadDeals(); // Reload to get updated totals and sorting
    } catch (error) {
      console.error('Error updating deal stage:', error);
    }
  }

  // Filter deals based on search
  const filteredDealsByStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage] = (dealsByStage[stage] || []).filter(
      (d) =>
        d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.organization?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return acc;
  }, {} as Record<DealStage, Deal[]>);

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
                        onStageChange={handleStageChange}
                      />
                    ))}

                    {loading && deals.length === 0 && (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    )}

                    {!loading && deals.length === 0 && (
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
            {(() => {
              const allDeals = Object.values(dealsByStage).flat();
              const activeDeals = allDeals.filter(d => PIPELINE_STAGES.includes(d.stage));
              const totalValue = activeDeals.reduce((sum, d) => sum + (d.value || 0), 0);
              const weightedValue = activeDeals.reduce((sum, d) => sum + ((d.value || 0) * (d.probability || 0) / 100), 0);

              return (
                <>
                  <div>
                    <span className="text-muted-foreground">Total Deals:</span>{' '}
                    <span className="font-semibold">{activeDeals.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Value:</span>{' '}
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(totalValue)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Weighted:</span>{' '}
                    <span className="font-semibold">
                      {formatCurrency(weightedValue)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground ml-4">
                    Showing {allDeals.length} total records
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
