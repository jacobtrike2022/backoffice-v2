import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Search, Filter, MoreHorizontal, SlidersHorizontal, Loader2, X, ArrowUpDown } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { cn } from '../ui/utils';
import { DealCard } from './DealCard';
import { DealFormModal } from './DealFormModal';
import { DealActivityPanel } from './DealActivityPanel';
import {
  type Deal,
  type DealStage,
  type DealType,
  type OrganizationStatus,
  PIPELINE_STAGES,
  STAGE_CONFIG,
} from './types';
import { getDealsByStage, updateDealStage } from '../../lib/crud/deals';

type SortOption = 'value_desc' | 'value_asc' | 'close_date' | 'last_activity' | 'name_asc';

interface FilterState {
  dealType: DealType | 'all';
  owner: string; // owner id or 'all'
  minValue: string;
  maxValue: string;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'value_desc', label: 'Value: High → Low' },
  { value: 'value_asc', label: 'Value: Low → High' },
  { value: 'close_date', label: 'Close date (soonest)' },
  { value: 'last_activity', label: 'Last activity (recent)' },
  { value: 'name_asc', label: 'Name: A → Z' },
];

const DEAL_TYPE_OPTIONS: { value: DealType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'new', label: 'New Business' },
  { value: 'upsell', label: 'Upsell' },
  { value: 'renewal', label: 'Renewal' },
  { value: 'expansion', label: 'Expansion' },
];

const DEFAULT_FILTERS: FilterState = {
  dealType: 'all',
  owner: 'all',
  minValue: '',
  maxValue: '',
};

interface DealPipelineBoardProps {
  onViewJourney?: (orgId: string, orgName: string, orgStatus: OrganizationStatus) => void;
}

export function DealPipelineBoard({ onViewJourney }: DealPipelineBoardProps) {
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
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Partial<Deal> | null>(null);
  const [defaultStageForNew, setDefaultStageForNew] = useState<DealStage | undefined>(undefined);
  const [isActivityPanelOpen, setIsActivityPanelOpen] = useState(false);
  const [activityDeal, setActivityDeal] = useState<Partial<Deal> | null>(null);
  const [activityMode, setActivityMode] = useState<'note' | 'activity'>('note');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState<SortOption>('value_desc');

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

  // Collect unique owners from all deals for the filter dropdown
  const uniqueOwners = useMemo(() => {
    const owners = new Map<string, { id: string; name: string }>();
    Object.values(dealsByStage).flat().forEach((deal) => {
      if (deal.owner_id && deal.owner) {
        const name = deal.owner.first_name
          ? `${deal.owner.first_name} ${deal.owner.last_name || ''}`.trim()
          : deal.owner.display_name;
        owners.set(deal.owner_id, { id: deal.owner_id, name });
      }
    });
    return Array.from(owners.values());
  }, [dealsByStage]);

  const hasActiveFilters = filters.dealType !== 'all' || filters.owner !== 'all'
    || filters.minValue !== '' || filters.maxValue !== '';

  // Sort function for deals within a stage
  function sortDeals(deals: Deal[]): Deal[] {
    return [...deals].sort((a, b) => {
      switch (sortBy) {
        case 'value_desc':
          return (b.value || 0) - (a.value || 0);
        case 'value_asc':
          return (a.value || 0) - (b.value || 0);
        case 'close_date':
          if (!a.expected_close_date && !b.expected_close_date) return 0;
          if (!a.expected_close_date) return 1;
          if (!b.expected_close_date) return -1;
          return new Date(a.expected_close_date).getTime() - new Date(b.expected_close_date).getTime();
        case 'last_activity':
          return new Date(b.last_activity_at || b.created_at).getTime() -
            new Date(a.last_activity_at || a.created_at).getTime();
        case 'name_asc':
          return (a.name || '').localeCompare(b.name || '');
        default:
          return 0;
      }
    });
  }

  // Filter and sort deals
  const filteredDealsByStage = PIPELINE_STAGES.reduce((acc, stage) => {
    let deals = (dealsByStage[stage] || []).filter((d) => {
      // Text search
      const q = searchQuery.toLowerCase();
      if (q && !(d.name?.toLowerCase().includes(q) || d.organization?.name?.toLowerCase().includes(q))) {
        return false;
      }
      // Deal type filter
      if (filters.dealType !== 'all' && d.deal_type !== filters.dealType) return false;
      // Owner filter
      if (filters.owner !== 'all' && d.owner_id !== filters.owner) return false;
      // Value range filter
      const minVal = filters.minValue ? parseFloat(filters.minValue) : null;
      const maxVal = filters.maxValue ? parseFloat(filters.maxValue) : null;
      if (minVal !== null && (d.value || 0) < minVal) return false;
      if (maxVal !== null && (d.value || 0) > maxVal) return false;
      return true;
    });
    acc[stage] = sortDeals(deals);
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
            {/* Filter Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn(hasActiveFilters && 'border-primary text-primary')}>
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                      on
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Filters</h4>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setFilters(DEFAULT_FILTERS)}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Deal Type</Label>
                    <Select
                      value={filters.dealType}
                      onValueChange={(v) => setFilters({ ...filters, dealType: v as DealType | 'all' })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEAL_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Owner</Label>
                    <Select
                      value={filters.owner}
                      onValueChange={(v) => setFilters({ ...filters, owner: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Owners</SelectItem>
                        {uniqueOwners.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Value Range</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.minValue}
                        onChange={(e) => setFilters({ ...filters, minValue: e.target.value })}
                        className="h-8 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.maxValue}
                        onChange={(e) => setFilters({ ...filters, maxValue: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Sort Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  {SORT_OPTIONS.find((s) => s.value === sortBy)?.label || 'Sort'}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-1">
                {SORT_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={sortBy === opt.value ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start text-xs h-8"
                    onClick={() => setSortBy(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </PopoverContent>
            </Popover>

            <Button
              size="sm"
              onClick={() => {
                setEditingDeal(null);
                setDefaultStageForNew(undefined);
                setIsFormOpen(true);
              }}
            >
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
                        onSelect={(d) => {
                          setEditingDeal(d);
                          setDefaultStageForNew(undefined);
                          setIsFormOpen(true);
                        }}
                        onEdit={(d) => {
                          setEditingDeal(d);
                          setDefaultStageForNew(undefined);
                          setIsFormOpen(true);
                        }}
                        onStageChange={handleStageChange}
                        onAddNote={(d) => {
                          setActivityDeal(d);
                          setActivityMode('note');
                          setIsActivityPanelOpen(true);
                        }}
                        onLogActivity={(d) => {
                          setActivityDeal(d);
                          setActivityMode('activity');
                          setIsActivityPanelOpen(true);
                        }}
                        onViewJourney={(d) => {
                          if (d.organization_id && onViewJourney) {
                            onViewJourney(
                              d.organization_id,
                              d.organization?.name || d.name || 'Unknown',
                              d.organization?.status
                            );
                          }
                        }}
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
                    onClick={() => {
                      setEditingDeal(null);
                      setDefaultStageForNew(stage);
                      setIsFormOpen(true);
                    }}
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

      <DealFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={loadDeals}
        deal={editingDeal}
        defaultStage={defaultStageForNew}
      />

      <DealActivityPanel
        isOpen={isActivityPanelOpen}
        onClose={() => setIsActivityPanelOpen(false)}
        deal={activityDeal}
        initialMode={activityMode}
      />
    </div>
  );
}
