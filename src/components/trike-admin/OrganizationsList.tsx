import React, { useEffect, useState } from 'react';
import {
  Building2,
  Search,
  ExternalLink,
  Zap,
  Map,
  MoreHorizontal,
  Globe,
  Calendar,
  AlertCircle,
  RefreshCw,
  Trash2,
  MapPin,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { cn } from '../ui/utils';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import type { Organization, OrganizationStatus } from './types';

interface OrganizationsListProps {
  onViewJourney?: (orgId: string, orgName: string, orgStatus?: OrganizationStatus) => void;
  onProvisionDemo?: (orgId: string, orgName: string) => void;
}

const STATUS_CONFIG: Record<
  OrganizationStatus,
  { label: string; color: string; bgColor: string }
> = {
  lead: { label: 'Lead', color: 'text-slate-600 dark:text-slate-400', bgColor: 'bg-slate-100 dark:bg-slate-800' },
  prospect: { label: 'Prospect', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950' },
  evaluating: { label: 'Evaluating', color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-950' },
  closing: { label: 'Closing', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-950' },
  onboarding: { label: 'Onboarding', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-950' },
  live: { label: 'Live', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-950' },
  churned: { label: 'Churned', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950' },
  suspended: { label: 'Suspended', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-950' },
  frozen: { label: 'Frozen', color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-50 dark:bg-cyan-950' },
  renewing: { label: 'Renewing', color: 'text-teal-600 dark:text-teal-400', bgColor: 'bg-teal-50 dark:bg-teal-950' },
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active-pipeline', label: 'Active Pipeline' },
  { value: 'lead', label: 'Lead' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'evaluating', label: 'Evaluating' },
  { value: 'closing', label: 'Closing' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'live', label: 'Live' },
  { value: 'churned', label: 'Churned' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'renewing', label: 'Renewing' },
];

const ACTIVE_PIPELINE_STATUSES: OrganizationStatus[] = [
  'lead', 'prospect', 'evaluating', 'closing', 'onboarding',
];

export function OrganizationsList({ onViewJourney, onProvisionDemo }: OrganizationsListProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteOrgId, setDeleteOrgId] = useState<string | null>(null);
  const [deleteOrgName, setDeleteOrgName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const loadOrganizations = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('organizations')
        .select(`
          id,
          name,
          subdomain,
          website,
          status,
          industry,
          industries(name),
          services_offered,
          operating_states,
          demo_expires_at,
          onboarding_source,
          created_at,
          last_activity_at,
          next_action,
          next_action_date,
          stores(count)
        `)
        .order('created_at', { ascending: false });

      // Apply status filter
      if (statusFilter === 'active-pipeline') {
        query = query.in('status', ACTIVE_PIPELINE_STATUSES);
      } else if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading organizations:', error);
        return;
      }

      setOrganizations((data as Organization[]) || []);
    } catch (err) {
      console.error('Error loading organizations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, [statusFilter]);

  // Client-side search filtering
  const filteredOrgs = organizations.filter((org) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const industryDisplay = (org as { industries?: { name: string } | null }).industries?.name || org.industry || '';
    return (
      org.name.toLowerCase().includes(q) ||
      industryDisplay.toLowerCase().includes(q) ||
      (org.subdomain || '').toLowerCase().includes(q) ||
      (org.website || '').toLowerCase().includes(q)
    );
  });

  // Summary counts
  const statusCounts = organizations.reduce<Record<string, number>>((acc, org) => {
    acc[org.status] = (acc[org.status] || 0) + 1;
    return acc;
  }, {});

  const getDemoStatus = (expiresAt: string | null): { label: string; variant: 'default' | 'destructive' | 'outline' | 'secondary' } | null => {
    if (!expiresAt) return null;
    const expiry = new Date(expiresAt);
    const now = new Date();
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return { label: 'Expired', variant: 'destructive' };
    if (daysLeft <= 3) return { label: `${daysLeft}d left`, variant: 'destructive' };
    if (daysLeft <= 7) return { label: `${daysLeft}d left`, variant: 'secondary' };
    return { label: `${daysLeft}d left`, variant: 'outline' };
  };

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDeleteOrg = async () => {
    if (!deleteOrgId) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', deleteOrgId);

      if (error) throw error;

      toast.success(`"${deleteOrgName}" deleted`);
      setDeleteOrgId(null);
      setDeleteOrgName('');
      loadOrganizations();
    } catch (err: any) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Organizations</h1>
            <p className="text-sm text-muted-foreground">
              Manage all customer accounts, demos, and prospects
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadOrganizations}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-3">
          {(['lead', 'prospect', 'evaluating', 'closing', 'live'] as OrganizationStatus[]).map(
            (status) => {
              const config = STATUS_CONFIG[status];
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
                        {statusCounts[status] || 0}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            }
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search organizations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
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
            {filteredOrgs.length} organization{filteredOrgs.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Locations</TableHead>
                  <TableHead>Demo</TableHead>
                  <TableHead>Demo Link</TableHead>
                  <TableHead>Next Action</TableHead>
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
                ) : filteredOrgs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      No organizations found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrgs.map((org) => {
                    const statusConfig = STATUS_CONFIG[org.status] || { label: org.status || 'Unknown', color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800' };
                    const demoStatus = getDemoStatus(org.demo_expires_at);

                    return (
                      <TableRow key={org.id} className="group">
                        {/* Name + website */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                                statusConfig.bgColor
                              )}
                            >
                              <Building2
                                className={cn('h-4 w-4', statusConfig.color)}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">
                                {org.name}
                              </div>
                              {org.website && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Globe className="h-3 w-3" />
                                  <span className="truncate">{org.website}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Status badge */}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn('text-xs', statusConfig.color)}
                          >
                            {statusConfig.label}
                          </Badge>
                        </TableCell>

                        {/* Industry */}
                        <TableCell className="text-sm text-muted-foreground">
                          {(org as { industries?: { name: string } | null }).industries?.name || org.industry || '-'}
                        </TableCell>

                        {/* Locations & States */}
                        <TableCell>
                          {(() => {
                            const storeCount = (org as any).stores?.[0]?.count || 0;
                            const stateCount = org.operating_states?.length || 0;
                            if (!storeCount && !stateCount) return <span className="text-muted-foreground text-sm">-</span>;
                            return (
                              <Badge variant="outline" className="text-xs font-normal gap-1 whitespace-nowrap">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {storeCount > 0 && `${storeCount} loc${storeCount !== 1 ? 's' : ''}`}
                                {storeCount > 0 && stateCount > 0 && ' · '}
                                {stateCount > 0 && `${stateCount} state${stateCount !== 1 ? 's' : ''}`}
                              </Badge>
                            );
                          })()}
                        </TableCell>

                        {/* Demo status */}
                        <TableCell>
                          {demoStatus ? (
                            <Badge variant={demoStatus.variant} className="text-xs">
                              {demoStatus.label}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>

                        {/* Demo Link */}
                        <TableCell>
                          {org.demo_expires_at ? (
                            <a
                              href={`${window.location.origin}/?demo_org_id=${org.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Open Demo
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>

                        {/* Next action */}
                        <TableCell>
                          {org.next_action ? (
                            <div className="max-w-[180px]">
                              <div className="text-xs bg-primary/5 text-primary rounded px-2 py-1 truncate">
                                {org.next_action}
                              </div>
                              {org.next_action_date && (
                                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(org.next_action_date)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
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
                              {onViewJourney && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    onViewJourney(org.id, org.name, org.status)
                                  }
                                >
                                  <Map className="h-4 w-4 mr-2" />
                                  View journey
                                </DropdownMenuItem>
                              )}
                              {onProvisionDemo &&
                                ['prospect', 'evaluating'].includes(org.status) && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      onProvisionDemo(org.id, org.name)
                                    }
                                  >
                                    <Zap className="h-4 w-4 mr-2" />
                                    Provision demo
                                  </DropdownMenuItem>
                                )}
                              {org.website && (
                                <DropdownMenuItem asChild>
                                  <a
                                    href={
                                      org.website.startsWith('http')
                                        ? org.website
                                        : `https://${org.website}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Visit website
                                  </a>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={() => {
                                  setDeleteOrgId(org.id);
                                  setDeleteOrgName(org.name);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete organization
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteOrgId} onOpenChange={(open) => { if (!open) { setDeleteOrgId(null); setDeleteOrgName(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete organization?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteOrgName}</strong> and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrg}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
