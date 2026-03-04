import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../ui/utils';
import {
  MessageSquare,
  Phone,
  Mail,
  Video,
  FileText,
  Rocket,
  ArrowRightLeft,
  DollarSign,
  CheckSquare,
  Settings,
  Loader2,
  Send,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type Deal,
  type DealActivity,
  type ActivityType,
} from './types';
import {
  getDealActivities,
  addDealActivity,
} from '../../lib/crud/deals';
import { getCurrentUserProfile } from '../../lib/supabase';

interface DealActivityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  deal: Partial<Deal> | null;
  /** Which form to focus on open: 'note' for quick note, 'activity' for type selector */
  initialMode?: 'note' | 'activity';
}

const ACTIVITY_TYPE_CONFIG: Record<ActivityType, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  note: { label: 'Note', icon: MessageSquare, color: 'text-blue-500' },
  call: { label: 'Call', icon: Phone, color: 'text-green-500' },
  email: { label: 'Email', icon: Mail, color: 'text-purple-500' },
  meeting: { label: 'Meeting', icon: Video, color: 'text-amber-500' },
  proposal_sent: { label: 'Proposal Sent', icon: FileText, color: 'text-indigo-500' },
  demo: { label: 'Demo', icon: Rocket, color: 'text-orange-500' },
  stage_change: { label: 'Stage Change', icon: ArrowRightLeft, color: 'text-cyan-500' },
  value_change: { label: 'Value Change', icon: DollarSign, color: 'text-emerald-500' },
  task: { label: 'Task', icon: CheckSquare, color: 'text-rose-500' },
  system: { label: 'System', icon: Settings, color: 'text-gray-500' },
};

/** Activity types the user can manually log */
const LOGGABLE_TYPES: ActivityType[] = [
  'note', 'call', 'email', 'meeting', 'proposal_sent', 'demo', 'task',
];

export function DealActivityPanel({
  isOpen,
  onClose,
  deal,
  initialMode = 'note',
}: DealActivityPanelProps) {
  const [activities, setActivities] = useState<DealActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Form state
  const [activityType, setActivityType] = useState<ActivityType>(
    initialMode === 'note' ? 'note' : 'call'
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Load activities and current user when panel opens
  useEffect(() => {
    if (!isOpen || !deal?.id) return;

    setActivityType(initialMode === 'note' ? 'note' : 'call');
    setTitle('');
    setDescription('');

    loadActivities();
    loadCurrentUser();
  }, [isOpen, deal?.id, initialMode]);

  async function loadActivities() {
    if (!deal?.id) return;
    try {
      setLoadingActivities(true);
      const data = await getDealActivities(deal.id);
      setActivities(data);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoadingActivities(false);
    }
  }

  async function loadCurrentUser() {
    try {
      const profile = await getCurrentUserProfile();
      if (profile) {
        setCurrentUserId(profile.id);
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!deal?.id) return;

    const resolvedTitle = title.trim() || getDefaultTitle(activityType);
    if (!resolvedTitle) {
      toast.error('Please enter a title or description');
      return;
    }

    try {
      setSubmitting(true);
      await addDealActivity({
        deal_id: deal.id,
        activity_type: activityType,
        title: resolvedTitle,
        description: description.trim() || null,
        user_id: currentUserId,
      });

      toast.success('Activity logged');
      setTitle('');
      setDescription('');
      await loadActivities();
    } catch (error: any) {
      console.error('Error adding activity:', error);
      toast.error(`Failed to log activity: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  function getDefaultTitle(type: ActivityType): string {
    const defaults: Partial<Record<ActivityType, string>> = {
      call: 'Phone call',
      email: 'Email sent',
      meeting: 'Meeting held',
      demo: 'Demo conducted',
      proposal_sent: 'Proposal sent',
      task: 'Task completed',
    };
    return defaults[type] || '';
  }

  function formatTimestamp(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle className="text-lg">
            {deal?.name || 'Deal Activity'}
          </SheetTitle>
          <SheetDescription>
            {deal?.organization?.name
              ? `Activity timeline for ${deal.organization.name}`
              : 'Log notes, calls, and activities'}
          </SheetDescription>
        </SheetHeader>

        {/* Activity Form */}
        <div className="px-6 pb-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-2">
              <div className="w-36">
                <Select
                  value={activityType}
                  onValueChange={(v) => setActivityType(v as ActivityType)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOGGABLE_TYPES.map((type) => {
                      const config = ACTIVITY_TYPE_CONFIG[type];
                      const Icon = config.icon;
                      return (
                        <SelectItem key={type} value={type}>
                          <span className="flex items-center gap-2">
                            <Icon className={cn('h-3.5 w-3.5', config.color)} />
                            {config.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  activityType === 'note'
                    ? 'Add a note...'
                    : `${ACTIVITY_TYPE_CONFIG[activityType].label} title...`
                }
                className="flex-1 h-9"
              />
            </div>

            {activityType !== 'note' && (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details (optional)..."
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
              />
            )}

            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {activityType === 'note' ? 'Add Note' : 'Log Activity'}
              </Button>
            </div>
          </form>
        </div>

        <Separator />

        {/* Activity Timeline */}
        <ScrollArea className="flex-1 px-6">
          <div className="py-4 space-y-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Timeline
              </h3>
              {!loadingActivities && (
                <Badge variant="secondary" className="text-xs">
                  {activities.length}
                </Badge>
              )}
            </div>

            {loadingActivities ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No activity yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add a note or log an activity above
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

                {activities.map((activity) => {
                  const config = ACTIVITY_TYPE_CONFIG[activity.activity_type] ||
                    ACTIVITY_TYPE_CONFIG.system;
                  const Icon = config.icon;
                  const userName = activity.user
                    ? `${activity.user.first_name || ''} ${activity.user.last_name || ''}`.trim() || 'Unknown'
                    : null;

                  return (
                    <div key={activity.id} className="relative pl-10 pb-4">
                      {/* Timeline dot */}
                      <div className="absolute left-2 top-1 h-5 w-5 rounded-full bg-background border-2 border-border flex items-center justify-center">
                        <Icon className={cn('h-3 w-3', config.color)} />
                      </div>

                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className={cn('text-xs', config.color)}
                              >
                                {config.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatTimestamp(activity.created_at)}
                              </span>
                            </div>
                            <p className="text-sm font-medium mt-1">
                              {activity.title}
                            </p>
                            {activity.description && (
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {activity.description}
                              </p>
                            )}
                            {/* Stage change details */}
                            {activity.activity_type === 'stage_change' &&
                              activity.from_stage &&
                              activity.to_stage && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {activity.from_stage} &rarr; {activity.to_stage}
                                </p>
                              )}
                            {/* Value change details */}
                            {activity.activity_type === 'value_change' &&
                              activity.from_value != null &&
                              activity.to_value != null && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  ${activity.from_value.toLocaleString()} &rarr; $
                                  {activity.to_value.toLocaleString()}
                                </p>
                              )}
                          </div>
                        </div>
                        {userName && (
                          <div className="text-xs text-muted-foreground mt-2">
                            by {userName}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
