import React, { useState } from 'react';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Edit2, Trash2, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from './ui/utils';

interface DWA {
  dwa_id: string;
  dwa_title: string;
}

interface CompetencyItemProps {
  id: string;
  description: string;
  source: 'standard' | 'modified' | 'custom' | 'excluded';
  isActive: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete?: () => void; // Only provided for custom items
  onRevert?: () => void; // Only provided for modified items
  importance?: number;
  category?: string;
  dwas?: DWA[]; // Detailed Work Activities (only for tasks)
  weightedPriority?: number; // 0-100 scale for bar fill percentage
}

export function CompetencyItem({
  id,
  description,
  source,
  isActive,
  onToggle,
  onEdit,
  onDelete,
  onRevert,
  importance,
  category,
  dwas,
  weightedPriority,
}: CompetencyItemProps) {
  const [expanded, setExpanded] = useState(true);
  const hasDWAs = dwas && dwas.length > 0;
  const getSourceBadge = () => {
    if (source === 'standard') return null;
    
    const variants: Record<string, { variant: 'outline'; className: string }> = {
      modified: { variant: 'outline' as const, className: 'border-blue-300 text-blue-700 bg-blue-50' },
      custom: { variant: 'outline' as const, className: 'border-green-300 text-green-700 bg-green-50' },
      excluded: { variant: 'outline' as const, className: 'border-gray-300 text-gray-500 bg-gray-50' },
    };

    const config = variants[source];
    if (!config) return null; // Safety check for unexpected source values
    
    const labels: Record<string, string> = {
      modified: 'Modified',
      custom: 'Custom',
      excluded: 'Excluded',
    };

    return (
      <Badge {...config} className={cn('text-xs', config.className)}>
        {labels[source] || source}
      </Badge>
    );
  };

  const getBorderColor = () => {
    if (source === 'modified') return 'border-l-blue-500';
    if (source === 'custom') return 'border-l-green-500';
    return '';
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-md transition-colors',
        getBorderColor(),
        isActive
          ? 'hover:bg-muted/50 border-l-4'
          : 'opacity-60 hover:bg-muted/30 border-l-4',
        source === 'excluded' && !isActive && 'line-through'
      )}
    >
      <Checkbox
        id={`competency-${id}`}
        checked={isActive}
        onCheckedChange={onToggle}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {hasDWAs && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
                className="h-6 w-6 p-0 flex-shrink-0 mt-0.5"
                title={expanded ? 'Collapse DWAs' : 'Expand DWAs'}
              >
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
            <Label
              htmlFor={`competency-${id}`}
              className={cn(
                'text-sm cursor-pointer flex-1',
                !isActive && 'text-muted-foreground'
              )}
            >
              {description}
            </Label>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {weightedPriority !== undefined && (
              <div 
                className="w-12 h-1 bg-muted/30 rounded-full overflow-hidden flex-shrink-0" 
                title={`Priority: ${Math.round(weightedPriority)}%`}
              >
                <div 
                  className="h-full bg-gradient-to-r from-[#F64A05] to-[#FF733C] rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, weightedPriority))}%` }}
                />
              </div>
            )}
            {getSourceBadge()}
            {importance !== undefined && (
              <Badge variant="outline" className="text-xs">
                {Math.round(importance)}%
              </Badge>
            )}
          </div>
        </div>
        {category && (
          <p className="text-xs text-muted-foreground mt-1">{category}</p>
        )}
        {/* DWAs (Detailed Work Activities) */}
        {hasDWAs && expanded && (
          <div className="mt-3 ml-8 space-y-1.5">
            {dwas.map((dwa) => (
              <div
                key={dwa.dwa_id}
                className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 dark:bg-white/5 rounded-md px-2 py-1.5 border-l-2 border-l-orange-500/30"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500/60 flex-shrink-0" />
                <span className="flex-1">{dwa.dwa_title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {source === 'modified' && onRevert && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRevert}
            className="h-7 w-7 p-0"
            title="Revert to standard"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-7 w-7 p-0"
          title="Edit"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
        {source === 'custom' && onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

