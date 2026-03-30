import React, { useEffect, useState } from 'react';
import {
  FileText,
  Search,
  MoreHorizontal,
  RefreshCw,
  Eye,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Building2,
  Calendar,
  Plus,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { cn } from '../ui/utils';
import {
  getProposals,
  getProposalStats,
  updateProposalStatus,
  deleteProposal,
  type Proposal,
  type ProposalStatus,
} from '../../lib/crud/proposals';
import { toast } from 'sonner';
import { ProposalFormModal } from './ProposalFormModal';

// ============================================================================
// STATUS CONFIG
// ============================================================================

const STATUS_CONFIG: Record<
  ProposalStatus,
  { label: string; color: string; bgColor: string; icon: React.ComponentType<{ className?: string }> }
> = {
  draft: {
    label: 'Draft',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    icon: FileText,
  },
  sent: {
    label: 'Sent',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    icon: Send,
  },
  viewed: {
    label: 'Viewed',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950',
    icon: Eye,
  },
  accepted: {
    label: 'Accepted',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950',
    icon: XCircle,
  },
  expired: {
    label: 'Expired',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950',
    icon: Clock,
  },
  superseded: {
    label: 'Superseded',
    color: 'text-gray-500 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    icon: FileText,
  },
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active (Draft/Sent/Viewed)' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
  { value: 'superseded', label: 'Superseded' },
];

const ACTIVE_STATUSES: ProposalStatus[] = ['draft', 'sent', 'viewed'];

// ============================================================================
// COMPONENT
// ============================================================================

export function ProposalsList() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState<{
    total: number;
    byStatus: Record<ProposalStatus, number>;
    totalValue: number;
    acceptanceRate: number;
  } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);

  const loadProposals = async () => {
    try {
      setLoading(true);

      // Build status filter
      let statusArg: ProposalStatus | ProposalStatus[] | undefined;
      if (statusFilter === 'active') {
        statusArg = ACTIVE_STATUSES;
      } else if (statusFilter !== 'all') {
        statusArg = statusFilter as ProposalStatus;
      }

      const [proposalsData, statsData] = await Promise.all([
        getProposals({ status: statusArg }),
        getProposalStats(),
      ]);

      setProposals(proposalsData);
      setStats(statsData);
    } catch (err) {
      console.error('Error loading proposals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProposals();
  }, [statusFilter]);

  // Client-side search filtering
  const filteredProposals = proposals.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.deal as any)?.name?.toLowerCase().includes(q) ||
      (p.organization as any)?.name?.toLowerCase().includes(q) ||
      (p.notes || '').toLowerCase().includes(q)
    );
  });

  // Helpers
  const formatCurrency = (value: number | null | undefined): string => {
    if (!value) return '-';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getExpiryStatus = (
    expiresAt: string | null
  ): { label: string; variant: 'default' | 'destructive' | 'outline' | 'secondary' } | null => {
    if (!expiresAt) return null;
    const expiry = new Date(expiresAt);
    const now = new Date();
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return { label: 'Expired', variant: 'destructive' };
    if (daysLeft <= 3) return { label: `${daysLeft}d left`, variant: 'destructive' };
    if (daysLeft <= 7) return { label: `${daysLeft}d left`, variant: 'secondary' };
    return { label: `${daysLeft}d`, variant: 'outline' };
  };

  // Action handlers
  const handleStatusChange = async (proposalId: string, newStatus: ProposalStatus) => {
    const result = await updateProposalStatus(proposalId, newStatus);
    if (result) {
      toast.success(`Proposal marked as ${STATUS_CONFIG[newStatus].label.toLowerCase()}`);
      loadProposals();
    } else {
      toast.error('Failed to update proposal status');
    }
  };

  const handleDelete = async (proposalId: string, name: string) => {
    if (!confirm(`Delete proposal "${name}"? This cannot be undone.`)) return;
    const success = await deleteProposal(proposalId);
    if (success) {
      toast.success('Proposal deleted');
      loadProposals();
    } else {
      toast.error('Failed to delete proposal');
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Proposals</h1>
            <p className="text-sm text-muted-foreground">
              Create, send, and track sales proposals
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadProposals}
              disabled={loading}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => { setEditingProposal(null); setShowForm(true); }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Proposal
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-3">
          {/* Total Value */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">Total Value</span>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
              <span className="text-2xl font-bold">
                {formatCurrency(stats?.totalValue)}
              </span>
            </CardContent>
          </Card>

          {/* Key status counts as clickable cards */}
          {(['draft', 'sent', 'accepted', 'rejected'] as ProposalStatus[]).map((status) => {
            const config = STATUS_CONFIG[status];
            const Icon = config.icon;
            return (
              <Card
                key={status}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md',
                  statusFilter === status && 'ring-2 ring-primary'
                )}
                onClick={() =>
                  setStatusFilter(statusFilter === status ? 'all' : status)
                }
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn('text-xs font-medium', config.color)}>
                      {config.label}
                    </span>
                    <span className="text-2xl font-bold">
                      {stats?.byStatus[status] || 0}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Acceptance Rate Banner */}
        {stats && stats.acceptanceRate > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <span className="text-sm font-medium">
              Acceptance rate: {stats.acceptanceRate.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">
              ({stats.byStatus.accepted || 0} accepted out of{' '}
              {(stats.byStatus.accepted || 0) + (stats.byStatus.rejected || 0)} responded)
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search proposals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filter status..." />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground ml-auto">
            {filteredProposals.length} proposal{filteredProposals.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Proposal</TableHead>
                  <TableHead>Deal / Org</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(5)
                    .fill(0)
                    .map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={8}>
                          <div className="h-10 bg-muted animate-pulse rounded" />
                        </TableCell>
                      </TableRow>
                    ))
                ) : filteredProposals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <FileText className="h-8 w-8" />
                        <span>No proposals found</span>
                        {searchQuery && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSearchQuery('')}
                          >
                            Clear search
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProposals.map((proposal) => {
                    const config = STATUS_CONFIG[proposal.status];
                    const StatusIcon = config.icon;
                    const expiry = getExpiryStatus(proposal.expires_at);
                    const dealName = (proposal.deal as any)?.name || '-';
                    const orgName = (proposal.organization as any)?.name || '-';
                    const creatorName = (proposal.creator as any)
                      ? `${(proposal.creator as any).first_name || ''} ${(proposal.creator as any).last_name || ''}`.trim() || null
                      : null;

                    return (
                      <TableRow key={proposal.id} className="group">
                        {/* Proposal Name & Version */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{proposal.name}</span>
                            <span className="text-xs text-muted-foreground">
                              v{proposal.version}
                              {creatorName && ` · by ${creatorName}`}
                            </span>
                          </div>
                        </TableCell>

                        {/* Deal / Org */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{dealName}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {orgName}
                            </span>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'gap-1 font-medium',
                              config.color,
                              config.bgColor
                            )}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        </TableCell>

                        {/* Value */}
                        <TableCell className="text-right font-medium">
                          {formatCurrency(proposal.total_value)}
                        </TableCell>

                        {/* Sent Date */}
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(proposal.sent_at)}
                        </TableCell>

                        {/* Expires */}
                        <TableCell>
                          {expiry ? (
                            <Badge variant={expiry.variant} className="text-xs">
                              {expiry.label}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Views */}
                        <TableCell>
                          {proposal.view_count > 0 ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Eye className="h-3 w-3 text-muted-foreground" />
                              {proposal.view_count}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {/* Edit */}
                              <DropdownMenuItem
                                onClick={() => { setEditingProposal(proposal); setShowForm(true); }}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Edit Proposal
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {/* Status transitions based on current status */}
                              {proposal.status === 'draft' && (
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(proposal.id, 'sent')}
                                >
                                  <Send className="h-4 w-4 mr-2" />
                                  Mark as Sent
                                </DropdownMenuItem>
                              )}
                              {(proposal.status === 'sent' || proposal.status === 'viewed') && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleStatusChange(proposal.id, 'accepted')}
                                    className="text-emerald-600 dark:text-emerald-400"
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Mark as Accepted
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleStatusChange(proposal.id, 'rejected')}
                                    className="text-red-600 dark:text-red-400"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Mark as Rejected
                                  </DropdownMenuItem>
                                </>
                              )}

                              {proposal.status !== 'superseded' && proposal.status !== 'expired' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleStatusChange(proposal.id, 'expired')}
                                  >
                                    <Clock className="h-4 w-4 mr-2" />
                                    Mark as Expired
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleStatusChange(proposal.id, 'superseded')}
                                  >
                                    <FileText className="h-4 w-4 mr-2" />
                                    Mark as Superseded
                                  </DropdownMenuItem>
                                </>
                              )}

                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(proposal.id, proposal.name)}
                                className="text-red-600 dark:text-red-400"
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Proposal Form Modal */}
      <ProposalFormModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingProposal(null); }}
        onSuccess={loadProposals}
        proposal={editingProposal}
      />
    </div>
  );
}
