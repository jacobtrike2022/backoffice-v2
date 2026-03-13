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
} from 'lucide-react';
import { getAllPublishedSystemTracksForContentManagement, bulkAssignTracksToAlbum } from '../../lib/crud/tracks';
import { getAlbums } from '../../lib/crud/albums';
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
      (albumsData || []).forEach((a: any) => {
        albumTitleById[a.id] = a.title;
      });
      const byTrack: Record<string, string[]> = {};
      at.forEach((r: any) => {
        if (!byTrack[r.track_id]) byTrack[r.track_id] = [];
        const title = albumTitleById[r.album_id];
        if (title) byTrack[r.track_id].push(title);
      });
      setAlbumNamesByTrackId(byTrack);
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

  const filteredTracks = useMemo(() => {
    return tracks.filter((track) => {
      const matchesSearch =
        track.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        track.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = activeType === 'all' || track.type === activeType;
      return matchesSearch && matchesType;
    });
  }, [tracks, searchQuery, activeType]);

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
                  <TableHead>Albums</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredTracks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
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
                      <TableCell className="font-medium max-w-[240px] truncate">
                        {track.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          {getTypeIcon(track.type)}
                          <span className="capitalize">{track.type}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {track.scope?.scope_level ? (
                          <Badge variant="outline">{track.scope.scope_level}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px]">
                        {(albumNamesByTrackId[track.id] || []).length > 0
                          ? (albumNamesByTrackId[track.id] || []).join(', ')
                          : '—'}
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
                            <DropdownMenuItem className="gap-2">
                              <ExternalLink className="h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2">
                              <Lock className="h-4 w-4" />
                              Edit (Super Admin)
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
