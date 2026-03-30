import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
          <DialogTitle>{t('contentAuthoring.trackScopeTitle')}</DialogTitle>
          <DialogDescription>
            {t('contentAuthoring.trackScopeDesc', { title: trackTitle })}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-6 text-center text-muted-foreground">{t('common.loading')}</div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('contentAuthoring.scopeLevel')}</Label>
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
                <Label>{t('contentAuthoring.sector')}</Label>
                <Select value={sector || 'none'} onValueChange={(v) => setSector(v === 'none' ? '' : (v as SectorType))}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('contentAuthoring.selectSector')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('contentAuthoring.selectSector')}</SelectItem>
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
                  <Label>{t('contentAuthoring.sectorOptionalFilter')}</Label>
                  <Select value={sector || 'none'} onValueChange={(v) => { setSector(v === 'none' ? '' : (v as SectorType)); setIndustryId(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('contentAuthoring.allSectors')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('contentAuthoring.allSectors')}</SelectItem>
                      {getSectorOptions().map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('contentAuthoring.industry')}</Label>
                  <Select value={industryId || 'none'} onValueChange={(v) => setIndustryId(v === 'none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('contentAuthoring.selectIndustry')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('contentAuthoring.selectIndustry')}</SelectItem>
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
                <Label>{t('contentAuthoring.state')}</Label>
                <Select value={stateId || 'none'} onValueChange={(v) => setStateId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('contentAuthoring.selectState')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('contentAuthoring.selectState')}</SelectItem>
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
                <Label>{t('contentAuthoring.company')}</Label>
                <Select value={companyId || 'none'} onValueChange={(v) => setCompanyId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('contentAuthoring.selectCompany')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('contentAuthoring.selectCompany')}</SelectItem>
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
                <Label>{t('contentAuthoring.program')}</Label>
                <Select value={programId || 'none'} onValueChange={(v) => setProgramId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('contentAuthoring.selectProgram')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('contentAuthoring.selectProgram')}</SelectItem>
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
                  <Label>{t('contentAuthoring.company')}</Label>
                  <Select value={companyId || 'none'} onValueChange={(v) => setCompanyId(v === 'none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('contentAuthoring.selectCompanyFirst')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('contentAuthoring.selectCompanyFirst')}</SelectItem>
                      {organizations.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('contentAuthoring.unit')}</Label>
                  <Select value={unitId || 'none'} onValueChange={(v) => setUnitId(v === 'none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('contentAuthoring.selectUnit')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('contentAuthoring.selectUnit')}</SelectItem>
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
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? t('contentAuthoring.saving') : t('contentAuthoring.saveScope')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
