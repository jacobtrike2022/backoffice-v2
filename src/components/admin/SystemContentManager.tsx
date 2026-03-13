import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Checkbox } from '../ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Search,
  Plus,
  FileText,
  Video,
  BookOpen,
  CheckSquare,
  ExternalLink,
  MoreVertical,
  Globe,
  Lock,
  Loader2,
  Layers,
  FolderOpen,
  X,
  Archive,
  Trash2,
  Play,
} from 'lucide-react';
import { getAllPublishedSystemTracksForContentManagement, bulkAssignTracksToAlbum, bulkUpdateTrackSystemContent, archiveTrack, deleteTrack } from '../../lib/crud/tracks';
import { getAlbums, addTracksToAlbum, removeTrackFromAlbum } from '../../lib/crud/albums';
import * as trackRelCrud from '../../lib/crud/trackRelationships';
import {
  bulkUpdateTrackScope,
  getScopeLevels,
  getSectorOptions,
  getUsStates,
  getIndustriesForScope,
  getProgramsForScope,
  getOrganizationsForScope,
  getStoresForScope,
  type TrackScopeLevel,
  type SectorType,
} from '../../lib/crud/trackScopes';
import { TrackScopeModal } from '../content-authoring/TrackScopeModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
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
import { supabase, getCurrentUserProfile } from '../../lib/supabase';
import { toast } from 'sonner@2.0.3';

export function SystemContentManager() {
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState<string>('all');
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [albumNamesByTrackId, setAlbumNamesByTrackId] = useState<Record<string, string[]>>({});
  const [albums, setAlbums] = useState<{ id: string; title: string }[]>([]);
  const [bulkScopeOpen, setBulkScopeOpen] = useState(false);
  const [bulkAlbumOpen, setBulkAlbumOpen] = useState(false);
  const [bulkAlbumId, setBulkAlbumId] = useState<string>('');
  /** Org whose albums are shown in bulk-assign dropdown (Trike Super Admin can pick any org). */
  const [bulkAlbumOrgId, setBulkAlbumOrgId] = useState<string | null>(null);
  const [bulkAssignAlbums, setBulkAssignAlbums] = useState<{ id: string; title: string }[]>([]);
  const [bulkAssignOrgs, setBulkAssignOrgs] = useState<{ id: string; name: string }[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [scopeModalTrack, setScopeModalTrack] = useState<any | null>(null);
  const [bulkSystemContentOpen, setBulkSystemContentOpen] = useState(false);
  /** Pending inline edits: apply on "Save changes" */
  const [pendingSystemContent, setPendingSystemContent] = useState<Record<string, boolean>>({});
  const [pendingAlbums, setPendingAlbums] = useState<Record<string, { add: string[]; remove: string[] }>>({});
  const [albumIdsByTrackId, setAlbumIdsByTrackId] = useState<Record<string, string[]>>({});
  const [albumIdToTitle, setAlbumIdToTitle] = useState<Record<string, string>>({});
  const [trackIdForAlbumPopover, setTrackIdForAlbumPopover] = useState<string | null>(null);
  const [inlineAlbumOrgId, setInlineAlbumOrgId] = useState<string | null>(null);
  const [inlineAlbumOptions, setInlineAlbumOptions] = useState<{ id: string; title: string }[]>([]);
  const [inlineOrgs, setInlineOrgs] = useState<{ id: string; name: string }[]>([]);
  const [inlineAddAlbumId, setInlineAddAlbumId] = useState<string>('none');
  const [previewTrack, setPreviewTrack] = useState<any | null>(null);
  const [archiveConfirmTrack, setArchiveConfirmTrack] = useState<any | null>(null);
  const [deleteConfirmTrack, setDeleteConfirmTrack] = useState<any | null>(null);
  const [archiveDeleting, setArchiveDeleting] = useState(false);
  const [filterScopeLevel, setFilterScopeLevel] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const [filterSector, setFilterSector] = useState<string>('all');
  const [filterIndustry, setFilterIndustry] = useState<string>('all');
  const [filterCompany, setFilterCompany] = useState<string>('all');

  useEffect(() => {
    fetchSystemTracks();
  }, []);

  async function fetchSystemTracks() {
    try {
      setLoading(true);
      const data = await getAllPublishedSystemTracksForContentManagement();
      setTracks(data || []);
    } catch (error) {
      console.error('Error fetching system tracks:', error);
      toast.error('Failed to load tracks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tracks.length === 0) {
      setAlbumNamesByTrackId({});
      return;
    }
    const trackIds = tracks.map((t) => t.id);
    (async () => {
      const { data: at } = await supabase
        .from('album_tracks')
        .select('track_id, album_id')
        .in('track_id', trackIds);
      if (!at?.length) {
        setAlbumNamesByTrackId({});
        return;
      }
      const albumIds = [...new Set(at.map((r: any) => r.album_id))];
      const { data: albumsData } = await supabase
        .from('albums')
        .select('id, title')
        .in('id', albumIds);
      const albumTitleById: Record<string, string> = {};
      const byTrackIds: Record<string, string[]> = {};
      (albumsData || []).forEach((a: any) => {
        albumTitleById[a.id] = a.title;
      });
      const byTrack: Record<string, string[]> = {};
      at.forEach((r: any) => {
        if (!byTrack[r.track_id]) byTrack[r.track_id] = [];
        const title = albumTitleById[r.album_id];
        if (title) byTrack[r.track_id].push(title);
        if (!byTrackIds[r.track_id]) byTrackIds[r.track_id] = [];
        byTrackIds[r.track_id].push(r.album_id);
      });
      setAlbumNamesByTrackId(byTrack);
      setAlbumIdsByTrackId(byTrackIds);
      setAlbumIdToTitle(albumTitleById);
    })();
  }, [tracks]);

  useEffect(() => {
    getAlbums({}).then((list: any) => {
      setAlbums((list || []).map((a: any) => ({ id: a.id, title: a.title })));
    });
  }, []);

  // When bulk-assign album modal opens: load orgs (for Super Admin) and albums for selected org
  useEffect(() => {
    if (!bulkAlbumOpen) return;
    (async () => {
      const orgs = await getOrganizationsForScope(true);
      setBulkAssignOrgs(orgs || []);
      const profile = await getCurrentUserProfile();
      const currentOrgId = profile?.organization_id || (orgs?.[0]?.id ?? null);
      setBulkAlbumOrgId(currentOrgId);
      setBulkAlbumId('');
    })();
  }, [bulkAlbumOpen]);

  useEffect(() => {
    if (!bulkAlbumOpen || !bulkAlbumOrgId) {
      setBulkAssignAlbums([]);
      return;
    }
    getAlbums({ organizationId: bulkAlbumOrgId })
      .then((list: any) => setBulkAssignAlbums((list || []).map((a: any) => ({ id: a.id, title: a.title }))))
      .catch(() => setBulkAssignAlbums([]));
  }, [bulkAlbumOpen, bulkAlbumOrgId]);

  // When inline album popover opens, load orgs and albums for "Add to album"
  useEffect(() => {
    if (!trackIdForAlbumPopover) return;
    getOrganizationsForScope(true).then((orgs) => {
      setInlineOrgs(orgs || []);
      setInlineAlbumOrgId(orgs?.[0]?.id ?? null);
    });
  }, [trackIdForAlbumPopover]);

  useEffect(() => {
    if (!inlineAlbumOrgId) {
      setInlineAlbumOptions([]);
      return;
    }
    getAlbums({ organizationId: inlineAlbumOrgId })
      .then((list: any) => setInlineAlbumOptions((list || []).map((a: any) => ({ id: a.id, title: a.title }))))
      .catch(() => setInlineAlbumOptions([]));
  }, [inlineAlbumOrgId]);

  const scopeFilterOptions = useMemo(() => {
    const levels = new Set<string>();
    const states = new Set<string>();
    const sectors = new Set<string>();
    const industries = new Set<string>();
    const companies = new Set<string>();
    tracks.forEach((t) => {
      const s = t.scope;
      if (s?.scope_level) levels.add(s.scope_level);
      if (s?.state_code) states.add(s.state_code);
      if (s?.sector) sectors.add(s.sector);
      if (s?.industry_name) industries.add(s.industry_name);
      if (s?.company_name) companies.add(s.company_name);
    });
    return {
      scopeLevels: [...levels].sort(),
      states: [...states].sort(),
      sectors: [...sectors].sort(),
      industries: [...industries].sort(),
      companies: [...companies].sort(),
    };
  }, [tracks]);

  const filteredTracks = useMemo(() => {
    return tracks.filter((track) => {
      const matchesSearch =
        track.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        track.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = activeType === 'all' || track.type === activeType;
      const s = track.scope;
      const matchesScopeLevel = filterScopeLevel === 'all' || s?.scope_level === filterScopeLevel;
      const matchesState = filterState === 'all' || s?.state_code === filterState;
      const matchesSector = filterSector === 'all' || s?.sector === filterSector;
      const matchesIndustry = filterIndustry === 'all' || s?.industry_name === filterIndustry;
      const matchesCompany = filterCompany === 'all' || s?.company_name === filterCompany;
      return (
        matchesSearch &&
        matchesType &&
        matchesScopeLevel &&
        matchesState &&
        matchesSector &&
        matchesIndustry &&
        matchesCompany
      );
    });
  }, [tracks, searchQuery, activeType, filterScopeLevel, filterState, filterSector, filterIndustry, filterCompany]);

  const allSelected =
    filteredTracks.length > 0 &&
    filteredTracks.every((t) => selectedTrackIds.has(t.id));
  const someSelected = selectedTrackIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedTrackIds(new Set());
    } else {
      setSelectedTrackIds(new Set(filteredTracks.map((t) => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedTrackIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTrackIds(next);
  };

  const handleBulkScope = async (payload: {
    scope_level: TrackScopeLevel;
    sector?: SectorType | null;
    industry_id?: string | null;
    state_id?: string | null;
    company_id?: string | null;
    program_id?: string | null;
    unit_id?: string | null;
  }) => {
    const ids = Array.from(selectedTrackIds);
    if (ids.length === 0) return;
    setBulkSaving(true);
    try {
      const { updated, errors } = await bulkUpdateTrackScope(ids, {
        ...payload,
        syncToTags: true,
      });
      toast.success(`Scope updated for ${updated} track(s).`);
      if (errors.length) toast.error(errors.slice(0, 3).join('; '));
      setBulkScopeOpen(false);
      setSelectedTrackIds(new Set());
      fetchSystemTracks();
    } catch (e: any) {
      toast.error(e?.message || 'Bulk scope update failed');
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkAssignAlbum = async () => {
    if (!bulkAlbumId || selectedTrackIds.size === 0) return;
    setBulkSaving(true);
    try {
      const result = await bulkAssignTracksToAlbum(
        bulkAlbumId,
        Array.from(selectedTrackIds)
      );
      toast.success(`Added ${result.added} track(s) to album.`);
      setBulkAlbumOpen(false);
      setBulkAlbumId('');
      setSelectedTrackIds(new Set());
      fetchSystemTracks();
    } catch (e: any) {
      toast.error(e?.message || 'Assign to album failed');
    } finally {
      setBulkSaving(false);
    }
  };

  const hasPendingChanges =
    Object.keys(pendingSystemContent).length > 0 ||
    Object.keys(pendingAlbums).some(
      (tid) => (pendingAlbums[tid]?.add?.length || 0) + (pendingAlbums[tid]?.remove?.length || 0) > 0
    );

  const handleSavePendingChanges = async () => {
    if (!hasPendingChanges) return;
    setBulkSaving(true);
    try {
      const trueIds = Object.entries(pendingSystemContent).filter(([, v]) => v).map(([id]) => id);
      const falseIds = Object.entries(pendingSystemContent).filter(([, v]) => !v).map(([id]) => id);
      if (trueIds.length) await bulkUpdateTrackSystemContent(trueIds, true);
      if (falseIds.length) await bulkUpdateTrackSystemContent(falseIds, false);
      for (const [trackId, { add, remove }] of Object.entries(pendingAlbums)) {
        for (const albumId of remove || []) {
          await removeTrackFromAlbum(albumId, trackId);
        }
        for (const albumId of add || []) {
          await addTracksToAlbum(albumId, [trackId]);
        }
      }
      setPendingSystemContent({});
      setPendingAlbums({});
      setTrackIdForAlbumPopover(null);
      toast.success('Changes saved.');
      fetchSystemTracks();
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setBulkSaving(false);
    }
  };

  const clearPendingForTrack = (trackId: string) => {
    setPendingSystemContent((prev) => {
      const next = { ...prev };
      delete next[trackId];
      return next;
    });
    setPendingAlbums((prev) => {
      const next = { ...prev };
      delete next[trackId];
      return next;
    });
  };

  const handleArchiveTrack = async (track: any) => {
    setArchiveDeleting(true);
    try {
      await archiveTrack(track.id);
      toast.success(`"${track.title}" archived`);
      clearPendingForTrack(track.id);
      setArchiveConfirmTrack(null);
      fetchSystemTracks();
    } catch (e: any) {
      toast.error(e?.message || 'Archive failed');
    } finally {
      setArchiveDeleting(false);
    }
  };

  const handleDeleteTrack = async (track: any) => {
    try {
      const stats = await trackRelCrud.getTrackRelationshipStats(track.id);
      if (stats.derivedCount > 0) {
        const derived = await trackRelCrud.getDerivedTracks(track.id, 'source');
        const titles = derived.map((r: any) => r.derived_track?.title || 'Untitled').join(', ');
        setDeleteConfirmTrack(null);
        toast.error(`Cannot delete: used as source for ${stats.derivedCount} other track(s). ${titles}`);
        return;
      }
    } catch (_) {}
    setArchiveDeleting(true);
    try {
      await deleteTrack(track.id);
      toast.success(`"${track.title}" deleted`);
      clearPendingForTrack(track.id);
      setDeleteConfirmTrack(null);
      fetchSystemTracks();
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    } finally {
      setArchiveDeleting(false);
    }
  };

  const getScopeDisplayLabel = (scope: any) => {
    if (!scope?.scope_level) return null;
    if (scope.scope_level === 'UNIVERSAL') return 'Universal';
    const second =
      scope.state_code ??
      scope.sector ??
      scope.industry_name ??
      scope.company_name ??
      scope.program_name ??
      scope.unit_name ??
      null;
    return second ? `${scope.scope_level}: ${second}` : scope.scope_level;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'article':
        return <BookOpen className="h-4 w-4" />;
      case 'story':
        return <FileText className="h-4 w-4" />;
      case 'checkpoint':
        return <CheckSquare className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search system library..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchSystemTracks}>
            Refresh
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create System Track
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground whitespace-nowrap">Filters:</span>
        <Select value={filterScopeLevel} onValueChange={setFilterScopeLevel}>
          <SelectTrigger className="w-[140px] h-8">
            <SelectValue placeholder="Scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All scopes</SelectItem>
            {scopeFilterOptions.scopeLevels.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterState} onValueChange={setFilterState}>
          <SelectTrigger className="w-[120px] h-8">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            {scopeFilterOptions.states.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSector} onValueChange={setFilterSector}>
          <SelectTrigger className="w-[130px] h-8">
            <SelectValue placeholder="Sector" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sectors</SelectItem>
            {scopeFilterOptions.sectors.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterIndustry} onValueChange={setFilterIndustry}>
          <SelectTrigger className="w-[140px] h-8">
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All industries</SelectItem>
            {scopeFilterOptions.industries.map((n) => (
              <SelectItem key={n} value={n}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCompany} onValueChange={setFilterCompany}>
          <SelectTrigger className="w-[160px] h-8">
            <SelectValue placeholder="Company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {scopeFilterOptions.companies.map((n) => (
              <SelectItem key={n} value={n}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterScopeLevel !== 'all' || filterState !== 'all' || filterSector !== 'all' || filterIndustry !== 'all' || filterCompany !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            onClick={() => {
              setFilterScopeLevel('all');
              setFilterState('all');
              setFilterSector('all');
              setFilterIndustry('all');
              setFilterCompany('all');
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {hasPendingChanges && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="py-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">You have unsaved changes</span>
            <Button size="sm" onClick={handleSavePendingChanges} disabled={bulkSaving}>
              {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save changes
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPendingSystemContent({});
                setPendingAlbums({});
                setTrackIdForAlbumPopover(null);
              }}
            >
              Discard
            </Button>
          </CardContent>
        </Card>
      )}

      {someSelected && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">
              {selectedTrackIds.size} selected
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkScopeOpen(true)}
              disabled={bulkSaving}
            >
              <Layers className="h-4 w-4 mr-1" />
              Set scope
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkAlbumOpen(true)}
              disabled={bulkSaving}
            >
              <FolderOpen className="h-4 w-4 mr-1" />
              Assign to album
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkSystemContentOpen(true)}
              disabled={bulkSaving}
            >
              <Globe className="h-4 w-4 mr-1" />
              Set system content
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedTrackIds(new Set())}
            >
              Clear selection
            </Button>
          </CardContent>
        </Card>
      )}

      {bulkScopeOpen && (
        <BulkScopeForm
          onSave={handleBulkScope}
          onCancel={() => setBulkScopeOpen(false)}
          saving={bulkSaving}
        />
      )}

      {bulkSystemContentOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Set system content</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Template for new orgs (Trike content library). Scope (e.g. Universal) is separate.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={async () => {
                const ids = Array.from(selectedTrackIds);
                if (ids.length === 0) return;
                setBulkSaving(true);
                try {
                  const { updated } = await bulkUpdateTrackSystemContent(ids, true);
                  toast.success(`${updated} track(s) set as system content (template for new orgs).`);
                  setBulkSystemContentOpen(false);
                  setSelectedTrackIds(new Set());
                  fetchSystemTracks();
                } catch (e: any) {
                  toast.error(e?.message || 'Update failed');
                } finally {
                  setBulkSaving(false);
                }
              }}
              disabled={bulkSaving}
            >
              {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Yes (template for new orgs)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const ids = Array.from(selectedTrackIds);
                if (ids.length === 0) return;
                setBulkSaving(true);
                try {
                  const { updated } = await bulkUpdateTrackSystemContent(ids, false);
                  toast.success(`${updated} track(s) unset from system content.`);
                  setBulkSystemContentOpen(false);
                  setSelectedTrackIds(new Set());
                  fetchSystemTracks();
                } catch (e: any) {
                  toast.error(e?.message || 'Update failed');
                } finally {
                  setBulkSaving(false);
                }
              }}
              disabled={bulkSaving}
            >
              No
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setBulkSystemContentOpen(false)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {bulkAlbumOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Assign to album</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            {bulkAssignOrgs.length > 1 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Organization</label>
                <Select
                  value={bulkAlbumOrgId || 'none'}
                  onValueChange={(v) => setBulkAlbumOrgId(v === 'none' ? null : v)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Org" />
                  </SelectTrigger>
                  <SelectContent>
                    {bulkAssignOrgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Album</label>
              <Select value={bulkAlbumId || 'none'} onValueChange={(v) => setBulkAlbumId(v === 'none' ? '' : v)}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select album" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select album</SelectItem>
                  {bulkAssignAlbums.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleBulkAssignAlbum} disabled={!bulkAlbumId || bulkSaving}>
              {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assign'}
            </Button>
            <Button variant="outline" onClick={() => setBulkAlbumOpen(false)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeType} onValueChange={setActiveType}>
        <TabsList>
          <TabsTrigger value="all">All Content</TabsTrigger>
          <TabsTrigger value="video">Videos</TabsTrigger>
          <TabsTrigger value="article">Articles</TabsTrigger>
          <TabsTrigger value="story">Stories</TabsTrigger>
          <TabsTrigger value="checkpoint">Checkpoints</TabsTrigger>
        </TabsList>

        <TabsContent value={activeType} className="mt-6">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="whitespace-nowrap">System</TableHead>
                  <TableHead>Albums</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredTracks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No published system tracks found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTracks.map((track) => (
                    <TableRow key={track.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedTrackIds.has(track.id)}
                          onCheckedChange={() => toggleSelect(track.id)}
                          aria-label={`Select ${track.title}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-[240px]">
                        <button
                          type="button"
                          className="truncate block w-full text-left hover:underline focus:outline-none focus:underline"
                          onClick={() => setPreviewTrack(track)}
                        >
                          {track.title}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          {getTypeIcon(track.type)}
                          <span className="capitalize">{track.type}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getScopeDisplayLabel(track.scope) ? (
                          <Badge variant="outline" className="font-normal">
                            {getScopeDisplayLabel(track.scope)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="cursor-pointer" onClick={() => setPendingSystemContent((prev) => ({ ...prev, [track.id]: (prev[track.id] ?? track.is_system_content) ? false : true }))}>
                        {(pendingSystemContent[track.id] ?? track.is_system_content) ? (
                          <Badge variant="secondary" className="text-xs cursor-pointer hover:opacity-80">Template</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs cursor-pointer hover:underline">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px]">
                        <Popover open={trackIdForAlbumPopover === track.id} onOpenChange={(open) => setTrackIdForAlbumPopover(open ? track.id : null)}>
                          <PopoverTrigger asChild>
                            <button type="button" className="text-left w-full truncate block hover:underline focus:outline-none">
                              {(() => {
                                const current = albumIdsByTrackId[track.id] || [];
                                const pending = pendingAlbums[track.id];
                                const removeSet = new Set(pending?.remove || []);
                                const addSet = new Set(pending?.add || []);
                                const shown = [...current.filter((id) => !removeSet.has(id)), ...(addSet.size ? Array.from(addSet) : [])];
                                const titles = shown.map((id) => albumIdToTitle[id] || id).filter(Boolean);
                                if (titles.length === 0) return '—';
                                return titles.join(', ');
                              })()}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80" align="start">
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">Albums for this track</p>
                              {(() => {
                                const current = albumIdsByTrackId[track.id] || [];
                                const pending = pendingAlbums[track.id];
                                const removeSet = new Set(pending?.remove || []);
                                const addSet = new Set(pending?.add || []);
                                const shown = current.filter((id) => !removeSet.has(id));
                                const added = Array.from(addSet);
                                return (
                                  <>
                                    {shown.length === 0 && added.length === 0 ? (
                                      <p className="text-xs text-muted-foreground">No albums</p>
                                    ) : (
                                      <ul className="space-y-1">
                                        {shown.map((aid) => (
                                          <li key={aid} className="flex items-center justify-between gap-2 text-xs">
                                            <span>{albumIdToTitle[aid] || aid}</span>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6"
                                              onClick={() => setPendingAlbums((prev) => ({
                                                ...prev,
                                                [track.id]: {
                                                  add: prev[track.id]?.add || [],
                                                  remove: [...(prev[track.id]?.remove || []), aid],
                                                },
                                              }))}
                                            >
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </li>
                                        ))}
                                        {added.map((aid) => (
                                          <li key={aid} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                            <span>{albumIdToTitle[aid] || aid} (add)</span>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6"
                                              onClick={() => setPendingAlbums((prev) => ({
                                                ...prev,
                                                [track.id]: {
                                                  add: (prev[track.id]?.add || []).filter((id) => id !== aid),
                                                  remove: prev[track.id]?.remove || [],
                                                },
                                              }))}
                                            >
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    <div className="pt-2 border-t space-y-1">
                                      <p className="text-xs font-medium text-muted-foreground">Add to album</p>
                                      <div className="flex gap-1">
                                        <Select value={inlineAlbumOrgId || 'none'} onValueChange={(v) => setInlineAlbumOrgId(v === 'none' ? null : v)}>
                                          <SelectTrigger className="h-8 text-xs flex-1">
                                            <SelectValue placeholder="Org" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {inlineOrgs.map((o) => (
                                              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Select
                                          value={inlineAddAlbumId}
                                          onValueChange={(albumId) => {
                                            if (!albumId || albumId === 'none') return;
                                            setPendingAlbums((prev) => ({
                                              ...prev,
                                              [track.id]: {
                                                add: [...(prev[track.id]?.add || []), albumId],
                                                remove: prev[track.id]?.remove || [],
                                              },
                                            }));
                                            setInlineAddAlbumId('none');
                                          }}
                                        >
                                          <SelectTrigger className="h-8 text-xs flex-1">
                                            <SelectValue placeholder="Album" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">Select album</SelectItem>
                                            {inlineAlbumOptions.filter((a) => {
                                              const current = albumIdsByTrackId[track.id] || [];
                                              const removeSet = new Set(pendingAlbums[track.id]?.remove || []);
                                              const addSet = new Set(pendingAlbums[track.id]?.add || []);
                                              const shownIds = new Set([...current.filter((id) => !removeSet.has(id)), ...addSet]);
                                              return !shownIds.has(a.id);
                                            }).map((a) => (
                                              <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {track.updated_at
                          ? new Date(track.updated_at).toLocaleDateString()
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => setScopeModalTrack(track)}
                            >
                              <Layers className="h-4 w-4" />
                              Edit scope
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2" onClick={() => setPreviewTrack(track)}>
                              <Play className="h-4 w-4" />
                              Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2">
                              <ExternalLink className="h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2">
                              <Lock className="h-4 w-4" />
                              Edit (Super Admin)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 text-amber-600 focus:text-amber-600"
                              onClick={() => setArchiveConfirmTrack(track)}
                            >
                              <Archive className="h-4 w-4" />
                              Archive
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 text-destructive focus:text-destructive"
                              onClick={() => setDeleteConfirmTrack(track)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {scopeModalTrack && (
        <TrackScopeModal
          isOpen={!!scopeModalTrack}
          onClose={() => setScopeModalTrack(null)}
          trackId={scopeModalTrack.id}
          trackTitle={scopeModalTrack.title}
          organizationId={scopeModalTrack.organization_id}
          allowAllOrgs={true}
          onSaved={() => {
            fetchSystemTracks();
            setScopeModalTrack(null);
          }}
        />
      )}

      <Dialog open={!!previewTrack} onOpenChange={(open) => !open && setPreviewTrack(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="pr-8">{previewTrack?.title ?? 'Preview'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-0">
            {previewTrack && (
              <>
                {previewTrack.type === 'video' && previewTrack.content_url && (
                  <video
                    src={previewTrack.content_url}
                    controls
                    className="w-full rounded-md"
                    poster={previewTrack.thumbnail_url}
                  />
                )}
                {(previewTrack.type === 'article' || previewTrack.type === 'story') && (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-left">
                    {previewTrack.description && (
                      <p className="text-muted-foreground">{previewTrack.description}</p>
                    )}
                    {previewTrack.content_text && (
                      <div className="mt-2 whitespace-pre-wrap border rounded p-3 bg-muted/30 max-h-[50vh] overflow-auto">
                        {previewTrack.content_text}
                      </div>
                    )}
                    {!previewTrack.content_text && !previewTrack.description && (
                      <p className="text-muted-foreground text-sm">No preview content. Open in editor for full view.</p>
                    )}
                  </div>
                )}
                {previewTrack.type === 'checkpoint' && (
                  <div className="text-sm">
                    {previewTrack.description && <p className="text-muted-foreground">{previewTrack.description}</p>}
                    {!previewTrack.description && (
                      <p className="text-muted-foreground">Checkpoint. Open in editor for full preview.</p>
                    )}
                  </div>
                )}
                {previewTrack && !['video', 'article', 'story', 'checkpoint'].includes(previewTrack.type) && (
                  <p className="text-muted-foreground text-sm">Preview not available for this type. Open in editor.</p>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!archiveConfirmTrack} onOpenChange={(open) => !open && setArchiveConfirmTrack(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive track</AlertDialogTitle>
            <AlertDialogDescription>
              Archive &quot;{archiveConfirmTrack?.title}&quot;? You can restore it later from the content library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (archiveConfirmTrack) handleArchiveTrack(archiveConfirmTrack);
              }}
              disabled={archiveDeleting}
            >
              {archiveDeleting ? 'Archiving…' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteConfirmTrack} onOpenChange={(open) => !open && setDeleteConfirmTrack(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete track permanently</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete &quot;{deleteConfirmTrack?.title}&quot;? This cannot be undone. If this track is used as a source for others, deletion will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (deleteConfirmTrack) handleDeleteTrack(deleteConfirmTrack);
              }}
              disabled={archiveDeleting}
            >
              {archiveDeleting ? 'Deleting…' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BulkScopeForm({
  onSave,
  onCancel,
  saving,
}: {
  onSave: (payload: {
    scope_level: TrackScopeLevel;
    sector?: SectorType | null;
    industry_id?: string | null;
    state_id?: string | null;
    company_id?: string | null;
    program_id?: string | null;
    unit_id?: string | null;
  }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [scopeLevel, setScopeLevel] = useState<TrackScopeLevel>('UNIVERSAL');
  const [sector, setSector] = useState<SectorType | ''>('');
  const [industryId, setIndustryId] = useState('');
  const [stateId, setStateId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [programId, setProgramId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [industries, setIndustries] = useState<{ id: string; name: string }[]>([]);
  const [states, setStates] = useState<{ id: string; code: string; name: string }[]>([]);
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    getUsStates().then(setStates as any);
    getProgramsForScope().then((p) => setPrograms(p as { id: string; name: string }[]));
    getOrganizationsForScope(true).then(setOrgs);
  }, []);

  useEffect(() => {
    if (scopeLevel !== 'INDUSTRY') return;
    getIndustriesForScope(sector || null).then((list) =>
      setIndustries(list as { id: string; name: string }[])
    );
  }, [scopeLevel, sector]);

  useEffect(() => {
    if (scopeLevel !== 'UNIT' || !companyId) {
      setStores([]);
      return;
    }
    getStoresForScope(companyId).then((s) => setStores(s as { id: string; name: string }[]));
  }, [scopeLevel, companyId]);

  const handleSubmit = () => {
    onSave({
      scope_level: scopeLevel,
      sector: scopeLevel === 'SECTOR' && sector ? (sector as SectorType) : null,
      industry_id: scopeLevel === 'INDUSTRY' && industryId ? industryId : null,
      state_id: scopeLevel === 'STATE' && stateId ? stateId : null,
      company_id: scopeLevel === 'COMPANY' && companyId ? companyId : null,
      program_id: scopeLevel === 'PROGRAM' && programId ? programId : null,
      unit_id: scopeLevel === 'UNIT' && unitId ? unitId : null,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Bulk set scope</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium">Scope level</label>
            <Select value={scopeLevel} onValueChange={(v) => setScopeLevel(v as TrackScopeLevel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getScopeLevels().map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {scopeLevel === 'SECTOR' && (
            <div>
              <label className="text-xs font-medium">Sector</label>
              <Select value={sector || 'none'} onValueChange={(v) => setSector(v === 'none' ? '' : (v as SectorType))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select</SelectItem>
                  {getSectorOptions().map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {scopeLevel === 'INDUSTRY' && (
            <div>
              <label className="text-xs font-medium">Industry</label>
              <Select value={industryId || 'none'} onValueChange={(v) => setIndustryId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select</SelectItem>
                  {industries.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {scopeLevel === 'STATE' && (
            <div>
              <label className="text-xs font-medium">State</label>
              <Select value={stateId || 'none'} onValueChange={(v) => setStateId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select</SelectItem>
                  {states.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.code} – {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {scopeLevel === 'COMPANY' && (
            <div>
              <label className="text-xs font-medium">Company</label>
              <Select value={companyId || 'none'} onValueChange={(v) => setCompanyId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select</SelectItem>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {scopeLevel === 'PROGRAM' && (
            <div>
              <label className="text-xs font-medium">Program</label>
              <Select value={programId || 'none'} onValueChange={(v) => setProgramId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select</SelectItem>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {scopeLevel === 'UNIT' && (
            <>
              <div>
                <label className="text-xs font-medium">Company</label>
                <Select value={companyId || 'none'} onValueChange={(v) => setCompanyId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select</SelectItem>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Unit</label>
                <Select value={unitId || 'none'} onValueChange={(v) => setUnitId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select</SelectItem>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply to selected'}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
