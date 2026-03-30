import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  getScopeLevels,
  getSectorOptions,
  getUsStates,
  getIndustriesForScope,
  getProgramsForScope,
  getOrganizationsForScope,
  getStoresForScope,
  getTrackScope,
  upsertTrackScope,
  type TrackScopeLevel,
  type SectorType,
} from '../../lib/crud/trackScopes';
import { toast } from 'sonner@2.0.3';

interface TrackScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackId: string;
  trackTitle: string;
  organizationId: string;
  allowAllOrgs?: boolean; // Trike Super Admin: pick any org for COMPANY scope
  onSaved: () => void;
}

const SCOPE_LABELS: Record<TrackScopeLevel, string> = {
  UNIVERSAL: 'Universal (all sectors)',
  SECTOR: 'Sector',
  INDUSTRY: 'Industry',
  STATE: 'State',
  COMPANY: 'Company',
  PROGRAM: 'Program',
  UNIT: 'Unit (location)',
};

export function TrackScopeModal({
  isOpen,
  onClose,
  trackId,
  trackTitle,
  organizationId,
  allowAllOrgs = false,
  onSaved,
}: TrackScopeModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scopeLevel, setScopeLevel] = useState<TrackScopeLevel>('UNIVERSAL');
  const [sector, setSector] = useState<SectorType | ''>('');
  const [industryId, setIndustryId] = useState<string>('');
  const [stateId, setStateId] = useState<string>('');
  const [companyId, setCompanyId] = useState<string>('');
  const [programId, setProgramId] = useState<string>('');
  const [unitId, setUnitId] = useState<string>('');

  const [usStates, setUsStates] = useState<{ id: string; code: string; name: string }[]>([]);
  const [industries, setIndustries] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [programs, setPrograms] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string; code: string | null }[]>([]);

  useEffect(() => {
    if (!isOpen || !trackId) return;
    setLoading(true);
    Promise.all([
      getTrackScope(trackId),
      getUsStates(),
      getIndustriesForScope(null),
      getProgramsForScope(),
      getOrganizationsForScope(allowAllOrgs),
    ])
      .then(([scope, states, ind, prog, orgs]) => {
        setUsStates(states as { id: string; code: string; name: string }[]);
        setIndustries(ind as { id: string; name: string; code: string | null }[]);
        setPrograms(prog);
        setOrganizations(orgs);
        if (scope) {
          setScopeLevel(scope.scope_level);
          setSector((scope.sector as SectorType) || '');
          setIndustryId(scope.industry_id || '');
          setStateId(scope.state_id || '');
          setCompanyId(scope.company_id || '');
          setProgramId(scope.program_id || '');
          setUnitId(scope.unit_id || '');
        } else {
          setScopeLevel('UNIVERSAL');
          setSector('');
          setIndustryId('');
          setStateId('');
          setCompanyId('');
          setProgramId('');
          setUnitId('');
        }
      })
      .catch((e) => {
        toast.error(e?.message || 'Failed to load scope');
      })
      .finally(() => setLoading(false));
  }, [isOpen, trackId, allowAllOrgs]);

  useEffect(() => {
    if (scopeLevel !== 'INDUSTRY') return;
    const sectorFilter = sector ? (sector as SectorType) : null;
    getIndustriesForScope(sectorFilter).then((list) => setIndustries(list as { id: string; name: string; code: string | null }[]));
  }, [scopeLevel, sector]);

  useEffect(() => {
    if (scopeLevel !== 'UNIT' || !companyId) {
      setStores([]);
      setUnitId('');
      return;
    }
    getStoresForScope(companyId).then((s) => {
      setStores(s as { id: string; name: string; code: string | null }[]);
      setUnitId('');
    });
  }, [scopeLevel, companyId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertTrackScope({
        track_id: trackId,
        organization_id: organizationId,
        scope_level: scopeLevel,
        sector: scopeLevel === 'SECTOR' && sector ? (sector as SectorType) : null,
        industry_id: scopeLevel === 'INDUSTRY' && industryId ? industryId : null,
        state_id: scopeLevel === 'STATE' && stateId ? stateId : null,
        company_id: scopeLevel === 'COMPANY' && companyId ? companyId : null,
        program_id: scopeLevel === 'PROGRAM' && programId ? programId : null,
        unit_id: scopeLevel === 'UNIT' && unitId ? unitId : null,
        syncToTags: true,
      });
      toast.success('Scope updated');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save scope');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Track scope</DialogTitle>
          <DialogDescription>
            Set content scope for “{trackTitle}”. Scope controls who can see and use this content.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-6 text-center text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Scope level</Label>
              <Select
                value={scopeLevel}
                onValueChange={(v) => setScopeLevel(v as TrackScopeLevel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getScopeLevels().map((level) => (
                    <SelectItem key={level} value={level}>
                      {SCOPE_LABELS[level]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {scopeLevel === 'SECTOR' && (
              <div className="space-y-2">
                <Label>Sector</Label>
                <Select value={sector || 'none'} onValueChange={(v) => setSector(v === 'none' ? '' : (v as SectorType))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sector" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select sector</SelectItem>
                    {getSectorOptions().map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scopeLevel === 'INDUSTRY' && (
              <>
                <div className="space-y-2">
                  <Label>Sector (optional filter)</Label>
                  <Select value={sector || 'none'} onValueChange={(v) => { setSector(v === 'none' ? '' : (v as SectorType)); setIndustryId(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="All sectors" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All sectors</SelectItem>
                      {getSectorOptions().map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Select value={industryId || 'none'} onValueChange={(v) => setIndustryId(v === 'none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select industry</SelectItem>
                      {industries.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {scopeLevel === 'STATE' && (
              <div className="space-y-2">
                <Label>State</Label>
                <Select value={stateId || 'none'} onValueChange={(v) => setStateId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select state</SelectItem>
                    {usStates.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.code} – {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scopeLevel === 'COMPANY' && (
              <div className="space-y-2">
                <Label>Company (organization)</Label>
                <Select value={companyId || 'none'} onValueChange={(v) => setCompanyId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select company</SelectItem>
                    {organizations.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scopeLevel === 'PROGRAM' && (
              <div className="space-y-2">
                <Label>Program</Label>
                <Select value={programId || 'none'} onValueChange={(v) => setProgramId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select program</SelectItem>
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scopeLevel === 'UNIT' && (
              <>
                <div className="space-y-2">
                  <Label>Company (organization)</Label>
                  <Select value={companyId || 'none'} onValueChange={(v) => setCompanyId(v === 'none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select company first" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select company first</SelectItem>
                      {organizations.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unit (location)</Label>
                  <Select value={unitId || 'none'} onValueChange={(v) => setUnitId(v === 'none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select location</SelectItem>
                      {stores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          {s.code ? ` (${s.code})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save scope'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
