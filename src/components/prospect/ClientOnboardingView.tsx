import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2,
  Circle,
  Loader2,
  ExternalLink,
  PartyPopper,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { cn } from '../ui/utils';
import { supabase, getCurrentUserOrgId, getCurrentUserProfile } from '../../lib/supabase';
import {
  getChecklistItems,
  toggleChecklistItem,
  seedDefaultOnboardingChecklist,
  type JourneyChecklistItem,
} from '../../lib/crud/journeyChecklist';

interface ClientOnboardingViewProps {
  onNavigate?: (view: string) => void;
}

export function ClientOnboardingView({ onNavigate }: ClientOnboardingViewProps) {
  const [items, setItems] = useState<JourneyChecklistItem[]>([]);
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const orgId = await getCurrentUserOrgId();
      if (!orgId) return;

      const profile = await getCurrentUserProfile();
      if (profile?.id) setUserId(profile.id);

      const [{ data: org }] = await Promise.all([
        supabase.from('organizations').select('name').eq('id', orgId).single(),
      ]);
      if (org) setOrgName(org.name);

      let checklistItems = await getChecklistItems(orgId, 'onboarding');

      if (checklistItems.length === 0) {
        checklistItems = await seedDefaultOnboardingChecklist(orgId, profile?.id);
      }

      setItems(checklistItems);
    } catch {
      // Use empty list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const completedCount = items.filter((i) => i.is_completed).length;
  const progressPct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
  const allComplete = items.length > 0 && completedCount === items.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          Welcome aboard{orgName ? `, ${orgName}` : ''}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Complete these onboarding steps to launch Trike for your organization.
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Onboarding Progress</span>
            <Badge variant="outline">
              {completedCount}/{items.length} complete
            </Badge>
          </div>
          <Progress value={progressPct} className="h-2" />
        </CardContent>
      </Card>

      {/* All-complete celebration */}
      {allComplete && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
          <CardContent className="p-6 text-center">
            <PartyPopper className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
            <h3 className="font-semibold text-lg mb-1">Onboarding Complete!</h3>
            <p className="text-sm text-muted-foreground">
              Your organization is fully set up. Trike is ready for your team.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Onboarding Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {items.map((item) => {
            const isToggling = toggling === item.id;

            return (
              <div
                key={item.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg p-3 transition-colors group',
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
                    <Circle className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    'text-sm font-medium',
                    item.is_completed && 'line-through text-muted-foreground'
                  )}>
                    {item.title}
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  )}
                </div>

                {!item.is_completed && item.resource_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => window.open(item.resource_url!, '_blank')}
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
    </div>
  );
}
