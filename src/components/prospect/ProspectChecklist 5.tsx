import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Users,
  Calendar,
  FileText,
  Rocket,
  Loader2,
  ListTodo,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { cn } from '../ui/utils';
import {
  getChecklistItems,
  toggleChecklistItem,
  seedDefaultProspectChecklist,
  type JourneyChecklistItem,
} from '../../lib/crud/journeyChecklist';
import { getCurrentUserOrgId, getCurrentUserProfile } from '../../lib/supabase';

interface ProspectChecklistProps {
  onNavigate?: (view: string) => void;
  onStepClick?: (stepIndex: number) => void;
}

const ITEM_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  task: ListTodo,
  resource: ExternalLink,
  reviewer: Users,
  follow_up: Calendar,
  milestone: Rocket,
  custom: FileText,
};

export function ProspectChecklist({ onNavigate, onStepClick }: ProspectChecklistProps) {
  const [items, setItems] = useState<JourneyChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const loadChecklist = useCallback(async () => {
    try {
      const orgId = await getCurrentUserOrgId();
      if (!orgId) return;

      const profile = await getCurrentUserProfile();
      if (profile?.id) setUserId(profile.id);

      let checklistItems = await getChecklistItems(orgId, 'prospect');

      if (checklistItems.length === 0) {
        checklistItems = await seedDefaultProspectChecklist(orgId, profile?.id);
      }

      setItems(checklistItems);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChecklist();
  }, [loadChecklist]);

  const handleToggle = async (item: JourneyChecklistItem) => {
    setToggling(item.id);
    try {
      const updated = await toggleChecklistItem(item.id, !item.is_completed, userId || undefined);
      setItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    } catch {
      // Silent
    } finally {
      setToggling(null);
    }
  };

  const handleItemAction = (item: JourneyChecklistItem) => {
    if (item.resource_url) {
      window.open(item.resource_url, '_blank');
      return;
    }
    const title = item.title.toLowerCase();
    if (title.includes('content') || title.includes('explore')) {
      onNavigate?.('content');
    } else if (title.includes('invite') || title.includes('colleague')) {
      onStepClick?.(3);
    } else if (title.includes('proposal')) {
      onStepClick?.(4);
    } else if (title.includes('follow-up') || title.includes('schedule')) {
      onStepClick?.(4);
    }
  };

  const completedCount = items.filter(i => i.is_completed).length;
  const progressPct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Your Checklist</CardTitle>
          </div>
          <span className="text-sm text-muted-foreground">
            {completedCount}/{items.length} completed
          </span>
        </div>
        <Progress value={progressPct} className="mt-2 h-2" />
      </CardHeader>
      <CardContent className="pt-0 space-y-1">
        {items.map((item) => {
          const Icon = ITEM_TYPE_ICONS[item.item_type] || ListTodo;
          const isToggling = toggling === item.id;
          const hasAction = item.resource_url || item.resource_label;

          return (
            <div
              key={item.id}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg transition-colors group',
                item.is_completed ? 'opacity-60' : 'hover:bg-muted/50'
              )}
            >
              <button
                onClick={() => handleToggle(item)}
                disabled={isToggling}
                className="shrink-0 mt-0.5"
              >
                {isToggling ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : item.is_completed ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span
                    className={cn(
                      'text-sm font-medium',
                      item.is_completed && 'line-through text-muted-foreground'
                    )}
                  >
                    {item.title}
                  </span>
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 ml-5.5 pl-px">
                    {item.description}
                  </p>
                )}
              </div>

              {!item.is_completed && (hasAction || item.resource_label) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleItemAction(item)}
                >
                  {item.resource_label || 'Open'}
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
