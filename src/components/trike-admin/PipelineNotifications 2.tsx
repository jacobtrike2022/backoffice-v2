import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Trophy,
  XCircle,
  ArrowRightLeft,
  DollarSign,
  UserPlus,
  FileText,
  Eye,
  ThumbsUp,
  Monitor,
  Clock,
  Info,
  Trash2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import {
  getPipelineNotifications,
  getPipelineUnreadCount,
  markPipelineNotificationRead,
  markAllPipelineNotificationsRead,
  deletePipelineNotification,
  type PipelineNotification,
  type PipelineNotificationType,
} from '../../lib/crud/pipeline-notifications';

// ---------------------------------------------------------------------------
// Notification icon / color mapping
// ---------------------------------------------------------------------------

const NOTIFICATION_STYLE: Record<
  PipelineNotificationType,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  deal_won: { icon: Trophy, color: 'text-emerald-500' },
  deal_lost: { icon: XCircle, color: 'text-red-500' },
  deal_stage_change: { icon: ArrowRightLeft, color: 'text-blue-500' },
  deal_value_change: { icon: DollarSign, color: 'text-amber-500' },
  deal_stale: { icon: Clock, color: 'text-orange-500' },
  deal_assigned: { icon: UserPlus, color: 'text-violet-500' },
  proposal_sent: { icon: FileText, color: 'text-blue-500' },
  proposal_viewed: { icon: Eye, color: 'text-sky-500' },
  proposal_accepted: { icon: ThumbsUp, color: 'text-emerald-500' },
  demo_provisioned: { icon: Monitor, color: 'text-indigo-500' },
  demo_expiring: { icon: Clock, color: 'text-orange-500' },
  system: { icon: Info, color: 'text-muted-foreground' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PipelineNotificationsBellProps {
  /** Current user ID (from auth context) */
  userId: string | null;
  /** Callback when a deal-linked notification is clicked */
  onNavigateToDeal?: (dealId: string) => void;
}

export function PipelineNotificationsBell({
  userId,
  onNavigateToDeal,
}: PipelineNotificationsBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<PipelineNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unread count on mount + interval
  const refreshUnreadCount = useCallback(async () => {
    if (!userId) return;
    const count = await getPipelineUnreadCount(userId);
    setUnreadCount(count);
  }, [userId]);

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 30_000); // poll every 30s
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  // Fetch full list when dropdown opens
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await getPipelineNotifications(userId, { limit: 20 });
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Handlers
  const handleMarkRead = async (id: string) => {
    await markPipelineNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    if (!userId) return;
    await markAllPipelineNotificationsRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleDelete = async (id: string, wasUnread: boolean) => {
    await deletePipelineNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleNotificationClick = (n: PipelineNotification) => {
    if (!n.is_read) handleMarkRead(n.id);
    if (n.deal_id && onNavigateToDeal) {
      onNavigateToDeal(n.deal_id);
      setIsOpen(false);
    }
  };

  const formatTimeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (!userId) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => setIsOpen((o) => !o)}
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[480px] bg-popover border border-border rounded-lg shadow-lg z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={handleMarkAllRead}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => {
                const style = NOTIFICATION_STYLE[n.type] || NOTIFICATION_STYLE.system;
                const Icon = style.icon;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors',
                      !n.is_read && 'bg-primary/5'
                    )}
                    onClick={() => handleNotificationClick(n)}
                  >
                    {/* Icon */}
                    <div className={cn('mt-0.5 shrink-0', style.color)}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm leading-snug', !n.is_read && 'font-medium')}>
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-muted-foreground">
                          {formatTimeAgo(n.created_at)}
                        </span>
                        {n.priority === 'high' || n.priority === 'urgent' ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 border-amber-500/50 text-amber-600 dark:text-amber-400"
                          >
                            {n.priority}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {!n.is_read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkRead(n.id);
                          }}
                          title="Mark as read"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(n.id, !n.is_read);
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
