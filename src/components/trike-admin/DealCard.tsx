import React from 'react';
import { Building2, Calendar, Check, DollarSign, Map, MoreHorizontal, User } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { cn } from '../ui/utils';
import { type Deal, STAGE_CONFIG } from './types';

interface DealCardProps {
  deal: Partial<Deal>;
  isSelected?: boolean;
  isBulkMode?: boolean;
  onToggleSelect?: (dealId: string) => void;
  onSelect?: (deal: Partial<Deal>) => void;
  onEdit?: (deal: Partial<Deal>) => void;
  onStageChange?: (deal: Partial<Deal>, newStage: string) => void;
  onAddNote?: (deal: Partial<Deal>) => void;
  onLogActivity?: (deal: Partial<Deal>) => void;
  onViewJourney?: (deal: Partial<Deal>) => void;
}

export function DealCard({
  deal,
  isSelected,
  isBulkMode,
  onToggleSelect,
  onSelect,
  onEdit,
  onStageChange,
  onAddNote,
  onLogActivity,
  onViewJourney,
}: DealCardProps) {
  const config = STAGE_CONFIG[deal.stage!];

  const formatCurrency = (value: number | null | undefined): string => {
    if (!value) return '$0';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDaysUntilClose = (): number | null => {
    if (!deal.expected_close_date) return null;
    const closeDate = new Date(deal.expected_close_date);
    const today = new Date();
    const diffTime = closeDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysUntilClose = getDaysUntilClose();

  return (
    <Card
      className={cn(
        'cursor-pointer hover:shadow-md transition-all border-l-4',
        config.borderColor,
        isSelected && 'ring-2 ring-primary bg-primary/5'
      )}
      onClick={() => {
        if (isBulkMode && deal.id) {
          onToggleSelect?.(deal.id);
        } else {
          onSelect?.(deal);
        }
      }}
    >
      <CardContent className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {/* Bulk-select checkbox */}
            {isBulkMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (deal.id) onToggleSelect?.(deal.id);
                }}
                className={cn(
                  'mt-0.5 shrink-0 h-4 w-4 rounded border flex items-center justify-center transition-colors',
                  isSelected
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground/50 hover:border-primary'
                )}
              >
                {isSelected && <Check className="h-3 w-3" />}
              </button>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{deal.name}</h4>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{deal.organization?.name || 'Unknown'}</span>
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onEdit?.(deal)}>
                Edit deal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddNote?.(deal)}>Add note</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onLogActivity?.(deal)}>Log activity</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewJourney?.(deal)}>
                <Map className="h-4 w-4 mr-2" />
                View journey
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onStageChange?.(deal, 'won')}
                className="text-emerald-600 dark:text-emerald-400"
              >
                Mark as won
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onStageChange?.(deal, 'lost')}
                className="text-red-600 dark:text-red-400"
              >
                Mark as lost
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onStageChange?.(deal, 'frozen')}
              >
                Mark as frozen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Value and MRR */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold text-sm">
              {formatCurrency(deal.value)}
            </span>
          </div>
          {deal.mrr && (
            <span className="text-xs text-muted-foreground">
              {formatCurrency(deal.mrr)}/mo
            </span>
          )}
        </div>

        {/* Probability bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Probability</span>
            <span className="font-medium">{deal.probability || 0}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                deal.probability! >= 75
                  ? 'bg-emerald-500'
                  : deal.probability! >= 50
                  ? 'bg-amber-500'
                  : 'bg-slate-400 dark:bg-slate-500'
              )}
              style={{ width: `${deal.probability || 0}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          {deal.expected_close_date && (
            <div className="flex items-center gap-1 text-xs">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span
                className={cn(
                  daysUntilClose !== null && daysUntilClose < 7
                    ? 'text-amber-600 dark:text-amber-400 font-medium'
                    : 'text-muted-foreground'
                )}
              >
                {formatDate(deal.expected_close_date)}
                {daysUntilClose !== null && daysUntilClose >= 0 && (
                  <span className="ml-1">({daysUntilClose}d)</span>
                )}
              </span>
            </div>
          )}
          {deal.owner && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {`${deal.owner.first_name || ''} ${deal.owner.last_name || ''}`.trim() || deal.owner.email}
              </span>
            </div>
          )}
        </div>

        {/* Next action if present */}
        {deal.next_action && (
          <div className="pt-2 border-t border-border">
            <div className="text-xs bg-primary/5 text-primary rounded px-2 py-1.5">
              <span className="font-medium">Next:</span> {deal.next_action}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
