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
  Pencil,
  X,
  Save,
  Plus,
  Eye,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '../ui/hover-card';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import type { Organization, OrganizationStatus } from './types';

const TRIKE_CO_ORG_ID = '10000000-0000-0000-0000-000000000001';

interface OrganizationsListProps {
  onViewJourney?: (orgId: string, orgName: string, orgStatus?: OrganizationStatus) => void;
  onProvisionDemo?: (orgId: string, orgName: string) => void;
  onPreviewOrg?: (orgId: string, orgName: string) => void;
}

const STATUS_CONFIG: Record<
  OrganizationStatus,
  { label: string; color: string; bgColor: string }
> = {
  demo: { label: 'Demo', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950' },
  live: { label: 'Live', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-950' },
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'demo', label: 'Demo' },
  { value: 'live', label: 'Live' },
];

export function OrganizationsList({ onViewJourney, onProvisionDemo, onPreviewOrg }: OrganizationsListProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteOrgId, setDeleteOrgId] = useState<string | null>(null);
  const [deleteOrgName, setDeleteOrgName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit sheet state
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    website: '',
    subdomain: '',
    status: 'demo' as OrganizationStatus,
    industry: '',
    operating_states: [] as string[],
    next_action: '',
    next_action_date: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [newStateInput, setNewStateInput] = useState('');

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
          logo_url,
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
          scraped_data,
          stores(count)
        `)
        .order('created_at', { ascending: false });

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading organizations:', error);
        return;
      }

      setOrganizations((data as unknown as Organization[]) || []);
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

  // ── Edit org handlers ──
  const openEditSheet = (org: Organization) => {
    setEditingOrg(org);
    setEditFormData({
      name: org.name || '',
      website: org.website || '',
      subdomain: org.subdomain || '',
      status: org.status || 'demo',
      industry: org.industry || '',
      operating_states: org.operating_states || [],
      next_action: org.next_action || '',
      next_action_date: org.next_action_date || '',
    });
    setNewStateInput('');
  };

  const handleSaveOrg = async () => {
    if (!editingOrg) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: editFormData.name,
          website: editFormData.website || null,
          subdomain: editFormData.subdomain || null,
          status: editFormData.status,
          industry: editFormData.industry || null,
          operating_states: editFormData.operating_states,
          next_action: editFormData.next_action || null,
          next_action_date: editFormData.next_action_date || null,
        })
        .eq('id', editingOrg.id);

      if (error) throw error;

      toast.success(`"${editFormData.name}" updated`);
      setEditingOrg(null);
      loadOrganizations();
    } catch (err: any) {
      console.error('Save failed:', err);
      toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const addOperatingState = () => {
    const state = newStateInput.trim().toUpperCase();
    if (!state) return;
    if (state.length !== 2) {
      toast.error('Use 2-letter state abbreviation (e.g. TX, FL)');
      return;
    }
    if (editFormData.operating_states.includes(state)) {
      toast.error(`${state} already added`);
      return;
    }
    setEditFormData({
      ...editFormData,
      operating_states: [...editFormData.operating_states, state].sort(),
    });
    setNewStateInput('');
  };

  const removeOperatingState = (state: string) => {
    setEditFormData({
      ...editFormData,
      operating_states: editFormData.operating_states.filter((s) => s !== state),
    });
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
        <div className="grid grid-cols-2 gap-3">
          {(['demo', 'live'] as OrganizationStatus[]).map(
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
                  <TableHead># Locations</TableHead>
                  <TableHead>States</TableHead>
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
                                'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden',
                                statusConfig.bgColor
                              )}
                            >
                              {org.logo_url ? (
                                <img
                                  src={org.logo_url}
                                  alt=""
                                  className="h-9 w-9 object-contain"
                                />
                              ) : (
                                <Building2
                                  className={cn('h-4 w-4', statusConfig.color)}
                                />
                              )}
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

                        {/* # Locations */}
                        <TableCell>
                          {(() => {
                            const actualStoreCount = (org as any).stores?.[0]?.count || 0;
                            const estimatedCount = (org as any).scraped_data?.store_count || 0;
                            const storeCount = actualStoreCount || estimatedCount;
                            const isEstimated = actualStoreCount === 0 && estimatedCount > 0;
                            if (!storeCount) return <span className="text-muted-foreground text-sm">-</span>;
                            return (
                              <Badge variant="outline" className="text-xs font-normal gap-1 whitespace-nowrap">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {`${isEstimated ? '~' : ''}${storeCount} loc${storeCount !== 1 ? 's' : ''}`}
                              </Badge>
                            );
                          })()}
                        </TableCell>

                        {/* States - pills with hover popup */}
                        <TableCell>
                          {(() => {
                            const states = org.operating_states || [];
                            const stateCount = states.length;
                            if (stateCount === 0) return <span className="text-muted-foreground text-sm">-</span>;
                            const displayStates = states.slice(0, 3);
                            const overflowCount = stateCount - displayStates.length;
                            return (
                              <HoverCard openDelay={200}>
                                <HoverCardTrigger asChild>
                                  <div className="flex flex-wrap gap-1 cursor-default">
                                    {displayStates.map((s) => (
                                      <Badge key={s} variant="secondary" className="text-xs font-normal">
                                        {s}
                                      </Badge>
                                    ))}
                                    {overflowCount > 0 && (
                                      <Badge variant="outline" className="text-xs font-normal bg-muted">
                                        +{overflowCount}
                                      </Badge>
                                    )}
                                  </div>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-auto p-2" align="start" side="bottom">
                                  <div className="text-xs font-medium text-muted-foreground mb-1">Operating states</div>
                                  <div className="flex flex-wrap gap-1">
                                    {states.map((s) => (
                                      <Badge key={s} variant="outline" className="text-xs">
                                        {s}
                                      </Badge>
                                    ))}
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
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
                              {onPreviewOrg && (
                                <DropdownMenuItem
                                  onClick={() => onPreviewOrg(org.id, org.name)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  {org.id === TRIKE_CO_ORG_ID ? 'Return to main' : 'Preview as this org'}
                                </DropdownMenuItem>
                              )}
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
                                org.status === 'demo' && (
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
                              <DropdownMenuItem onClick={() => openEditSheet(org)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit organization
                              </DropdownMenuItem>
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

      {/* Edit organization sheet */}
      <Sheet open={!!editingOrg} onOpenChange={(open) => { if (!open) setEditingOrg(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Organization</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 mt-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                placeholder="Organization name"
              />
            </div>

            {/* Website */}
            <div className="space-y-2">
              <Label htmlFor="org-website">Website</Label>
              <Input
                id="org-website"
                value={editFormData.website}
                onChange={(e) => setEditFormData({ ...editFormData, website: e.target.value })}
                placeholder="https://example.com"
              />
            </div>

            {/* Subdomain */}
            <div className="space-y-2">
              <Label htmlFor="org-subdomain">Subdomain</Label>
              <Input
                id="org-subdomain"
                value={editFormData.subdomain}
                onChange={(e) => setEditFormData({ ...editFormData, subdomain: e.target.value })}
                placeholder="company-name"
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editFormData.status}
                onValueChange={(value) => setEditFormData({ ...editFormData, status: value as OrganizationStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(STATUS_CONFIG) as [OrganizationStatus, { label: string }][]).map(
                    ([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Industry */}
            <div className="space-y-2">
              <Label htmlFor="org-industry">Industry</Label>
              <Input
                id="org-industry"
                value={editFormData.industry}
                onChange={(e) => setEditFormData({ ...editFormData, industry: e.target.value })}
                placeholder="e.g. Convenience Store, Foodservice"
              />
            </div>

            {/* Operating States */}
            <div className="space-y-2">
              <Label>Operating States</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {editFormData.operating_states.length === 0 && (
                  <span className="text-sm text-muted-foreground italic">No states added</span>
                )}
                {editFormData.operating_states.map((state) => (
                  <Badge key={state} variant="secondary" className="gap-1">
                    {state}
                    <button
                      type="button"
                      onClick={() => removeOperatingState(state)}
                      className="ml-0.5 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newStateInput}
                  onChange={(e) => setNewStateInput(e.target.value)}
                  placeholder="TX"
                  maxLength={2}
                  className="w-20"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addOperatingState();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOperatingState}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            {/* Next Action */}
            <div className="space-y-2">
              <Label htmlFor="org-next-action">Next Action</Label>
              <Textarea
                id="org-next-action"
                value={editFormData.next_action}
                onChange={(e) => setEditFormData({ ...editFormData, next_action: e.target.value })}
                placeholder="What's the next step?"
                rows={2}
              />
            </div>

            {/* Next Action Date */}
            <div className="space-y-2">
              <Label htmlFor="org-next-action-date">Next Action Date</Label>
              <Input
                id="org-next-action-date"
                type="date"
                value={editFormData.next_action_date}
                onChange={(e) => setEditFormData({ ...editFormData, next_action_date: e.target.value })}
              />
            </div>

            {/* Save / Cancel */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={handleSaveOrg}
                disabled={isSaving || !editFormData.name.trim()}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditingOrg(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
