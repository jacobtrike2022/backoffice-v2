import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Plus, Search, Filter, MoreHorizontal, SlidersHorizontal, Loader2, X, ArrowUpDown, GripVertical, CheckSquare, Download, UserPlus, ArrowRight } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
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
import { getDealsByStage, updateDealStage, bulkUpdateDealStage, bulkReassignOwner, getDealOwnerCandidates } from '../../lib/crud/deals';

// ─── Droppable Stage Column wrapper ────────────────────────
function DroppableStageColumn({
  stage,
  children,
  isOver,
}: {
  stage: DealStage;
  children: React.ReactNode;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: `stage-${stage}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 min-h-0 flex flex-col overflow-hidden transition-colors duration-200 rounded-b-lg',
        isOver && 'bg-primary/5 ring-2 ring-primary/30 ring-inset'
      )}
    >
      {children}
    </div>
  );
}

// ─── Draggable Deal Card wrapper ───────────────────────────
function DraggableDealCard({
  deal,
  children,
}: {
  deal: Partial<Deal>;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: deal.id!,
    data: { deal },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className={cn(
        'relative group',
        isDragging && 'opacity-30'
      )}
    >
      {/* Drag handle - appears on hover */}
      <div
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center opacity-0 group-hover:opacity-60 hover:!opacity-100 cursor-grab active:cursor-grabbing z-10"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}

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
  { value: 'new', label: 'New Demo' },
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
  const [activeDragDeal, setActiveDragDeal] = useState<Partial<Deal> | null>(null);
  const [overStage, setOverStage] = useState<DealStage | null>(null);
  // Bulk operations
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkStageTarget, setBulkStageTarget] = useState<DealStage | 'none'>('none');
  const [bulkOwnerTarget, setBulkOwnerTarget] = useState<string>('none');
  const [ownerCandidates, setOwnerCandidates] = useState<Array<{ id: string; first_name: string | null; last_name: string | null; email: string }>>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Configure pointer sensor with activation distance to avoid accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const deal = event.active.data.current?.deal as Partial<Deal> | undefined;
    if (deal) setActiveDragDeal(deal);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id;
    if (typeof overId === 'string' && overId.startsWith('stage-')) {
      setOverStage(overId.replace('stage-', '') as DealStage);
    } else {
      setOverStage(null);
    }
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragDeal(null);
    setOverStage(null);

    if (!over) return;

    const overId = String(over.id);
    if (!overId.startsWith('stage-')) return;

    const newStage = overId.replace('stage-', '') as DealStage;
    const deal = active.data.current?.deal as Partial<Deal> | undefined;

    if (!deal || deal.stage === newStage) return;

    // Optimistic update: move the card immediately
    setDealsByStage((prev) => {
      const copy = { ...prev };
      const oldStage = deal.stage as DealStage;
      copy[oldStage] = copy[oldStage].filter((d) => d.id !== deal.id);
      const movedDeal = { ...deal, stage: newStage } as Deal;
      copy[newStage] = [...copy[newStage], movedDeal];
      return copy;
    });

    // Persist to database
    try {
      await updateDealStage(deal.id!, newStage);
      await loadDeals(); // Reload for accurate totals
    } catch (error) {
      console.error('Error updating deal stage:', error);
      await loadDeals(); // Revert on failure
    }
  }, []);

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

  // ─── Bulk operation handlers ────────────────────────────────

  function toggleDealSelection(dealId: string) {
    setSelectedDealIds((prev) => {
      const next = new Set(prev);
      if (next.has(dealId)) next.delete(dealId);
      else next.add(dealId);
      return next;
    });
  }

  function selectAllVisible() {
    const allIds = new Set<string>();
    PIPELINE_STAGES.forEach((stage) => {
      (filteredDealsByStage[stage] || []).forEach((d) => {
        if (d.id) allIds.add(d.id);
      });
    });
    setSelectedDealIds(allIds);
  }

  function clearSelection() {
    setSelectedDealIds(new Set());
    setBulkStageTarget('none');
    setBulkOwnerTarget('none');
  }

  function exitBulkMode() {
    setBulkMode(false);
    clearSelection();
  }

  async function handleBulkStageChange() {
    if (bulkStageTarget === 'none' || selectedDealIds.size === 0) return;
    setBulkLoading(true);
    try {
      await bulkUpdateDealStage(Array.from(selectedDealIds), bulkStageTarget);
      clearSelection();
      await loadDeals();
    } catch (error) {
      console.error('Bulk stage change failed:', error);
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkReassign() {
    if (bulkOwnerTarget === 'none' || selectedDealIds.size === 0) return;
    setBulkLoading(true);
    try {
      await bulkReassignOwner(Array.from(selectedDealIds), bulkOwnerTarget);
      clearSelection();
      await loadDeals();
    } catch (error) {
      console.error('Bulk reassign failed:', error);
    } finally {
      setBulkLoading(false);
    }
  }

  function exportPipelineCSV() {
    const allDeals = PIPELINE_STAGES.flatMap((stage) => filteredDealsByStage[stage] || []);
    if (allDeals.length === 0) return;

    const headers = ['Name', 'Organization', 'Stage', 'Value', 'MRR', 'Probability', 'Deal Type', 'Owner', 'Expected Close', 'Next Action', 'Created'];
    const rows = allDeals.map((d) => [
      d.name || '',
      d.organization?.name || '',
      STAGE_CONFIG[d.stage]?.label || d.stage,
      d.value?.toString() || '0',
      d.mrr?.toString() || '',
      `${d.probability || 0}%`,
      d.deal_type || '',
      d.owner ? `${d.owner.first_name || ''} ${d.owner.last_name || ''}`.trim() || d.owner.email : '',
      d.expected_close_date || '',
      d.next_action || '',
      d.created_at ? new Date(d.created_at).toLocaleDateString() : '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pipeline-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Load owner candidates when bulk mode is activated
  useEffect(() => {
    if (bulkMode && ownerCandidates.length === 0) {
      getDealOwnerCandidates().then(setOwnerCandidates).catch(() => {});
    }
  }, [bulkMode]);

  // Collect unique owners from all deals for the filter dropdown
  const uniqueOwners = useMemo(() => {
    const owners = new Map<string, { id: string; name: string }>();
    Object.values(dealsByStage).flat().forEach((deal) => {
      if (deal.owner_id && deal.owner) {
        const name = `${deal.owner.first_name || ''} ${deal.owner.last_name || ''}`.trim() || deal.owner.email;
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
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Demo Board</h1>
            <p className="text-sm text-muted-foreground">
              Drag demos between stages or click to view details
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

            {/* CSV Export */}
            <Button
              variant="outline"
              size="sm"
              onClick={exportPipelineCSV}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>

            {/* Bulk Mode Toggle */}
            <Button
              variant={bulkMode ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => bulkMode ? exitBulkMode() : setBulkMode(true)}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              {bulkMode ? 'Exit Bulk' : 'Bulk Select'}
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setEditingDeal(null);
                setDefaultStageForNew(undefined);
                setIsFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Demo
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search demos or organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Bulk Action Toolbar - visible when in bulk mode */}
        {bulkMode && (
          <div className="mt-3 flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <CheckSquare className="h-4 w-4 text-primary" />
              <span className="font-medium">{selectedDealIds.size} selected</span>
            </div>

            <div className="h-4 w-px bg-border" />

            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAllVisible}>
              Select all
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearSelection} disabled={selectedDealIds.size === 0}>
              Clear
            </Button>

            <div className="h-4 w-px bg-border" />

            {/* Bulk Stage Change */}
            <div className="flex items-center gap-1.5">
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={bulkStageTarget} onValueChange={(v) => setBulkStageTarget(v as DealStage | 'none')}>
                <SelectTrigger className="h-7 text-xs w-32">
                  <SelectValue placeholder="Move to..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Move to...</SelectItem>
                  {PIPELINE_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{STAGE_CONFIG[s].label}</SelectItem>
                  ))}
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="frozen">Frozen</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={bulkStageTarget === 'none' || selectedDealIds.size === 0 || bulkLoading}
                onClick={handleBulkStageChange}
              >
                Move
              </Button>
            </div>

            <div className="h-4 w-px bg-border" />

            {/* Bulk Reassign */}
            <div className="flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={bulkOwnerTarget} onValueChange={setBulkOwnerTarget}>
                <SelectTrigger className="h-7 text-xs w-36">
                  <SelectValue placeholder="Assign to..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Assign to...</SelectItem>
                  {ownerCandidates.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {`${o.first_name || ''} ${o.last_name || ''}`.trim() || o.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={bulkOwnerTarget === 'none' || selectedDealIds.size === 0 || bulkLoading}
                onClick={handleBulkReassign}
              >
                Assign
              </Button>
            </div>

            {bulkLoading && <Loader2 className="h-4 w-4 animate-spin text-primary ml-2" />}
          </div>
        )}
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-6">
          <div className="flex gap-4 h-full min-h-0 min-w-max">
            {PIPELINE_STAGES.map((stage) => {
              const config = STAGE_CONFIG[stage];
              const deals = filteredDealsByStage[stage];
              const stageTotal = getStageTotal(stage);

              return (
                <div
                  key={stage}
                  className="w-80 flex flex-col min-h-0 bg-muted/30 rounded-lg"
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

                  {/* Droppable deals area */}
                  <DroppableStageColumn stage={stage} isOver={overStage === stage}>
                    <ScrollArea className="flex-1 min-h-0">
                      <div className="p-2 space-y-2 min-h-[80px]">
                        {deals.map((deal) => (
                          <DraggableDealCard key={deal.id} deal={deal}>
                            <DealCard
                              deal={deal}
                              isSelected={!!deal.id && selectedDealIds.has(deal.id)}
                              isBulkMode={bulkMode}
                              onToggleSelect={toggleDealSelection}
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
                          </DraggableDealCard>
                        ))}

                        {loading && deals.length === 0 && (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        )}

                        {!loading && deals.length === 0 && (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            No demos in this stage
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </DroppableStageColumn>

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
                      Add demo
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Drag Overlay - ghost card that follows cursor */}
        <DragOverlay dropAnimation={null}>
          {activeDragDeal ? (
            <div className="w-80 opacity-90 rotate-2 shadow-xl">
              <DealCard deal={activeDragDeal} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
                    <span className="text-muted-foreground">Total Demos:</span>{' '}
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
