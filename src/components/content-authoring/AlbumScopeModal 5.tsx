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
  getAlbumScope,
  upsertAlbumScope,
  getUsStates,
  type AlbumScopeLevel,
} from '../../lib/crud/albumScopes';
import { getOrganizationsForScope } from '../../lib/crud/trackScopes';
import { toast } from 'sonner';

const SCOPE_LABELS: Record<AlbumScopeLevel, string> = {
  UNIVERSAL: 'Universal (all organizations)',
  SECTOR: 'Sector',
  INDUSTRY: 'Industry',
  STATE: 'State',
  COMPANY: 'Company',
  PROGRAM: 'Program',
  UNIT: 'Unit (location)',
};

interface AlbumScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  albumId: string;
  albumTitle: string;
  organizationId: string;
  allowAllOrgs?: boolean;
  onSaved: () => void;
}

export function AlbumScopeModal({
  isOpen,
  onClose,
  albumId,
  albumTitle,
  organizationId,
  allowAllOrgs = false,
  onSaved,
}: AlbumScopeModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scopeLevel, setScopeLevel] = useState<AlbumScopeLevel>('UNIVERSAL');
  const [stateId, setStateId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [usStates, setUsStates] = useState<{ id: string; code: string; name: string }[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!isOpen || !albumId) return;
    setLoading(true);
    Promise.all([
      getAlbumScope(albumId),
      getUsStates(),
      getOrganizationsForScope(allowAllOrgs),
    ])
      .then(([scope, states, orgs]) => {
        setUsStates(states as { id: string; code: string; name: string }[]);
        setOrganizations(orgs);
        if (scope) {
          setScopeLevel(scope.scope_level);
          setStateId(scope.state_id || '');
          setCompanyId(scope.company_id || '');
        } else {
          setScopeLevel('UNIVERSAL');
          setStateId('');
          setCompanyId('');
        }
      })
      .catch((e) => {
        toast.error(e?.message || 'Failed to load scope');
      })
      .finally(() => setLoading(false));
  }, [isOpen, albumId, allowAllOrgs]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertAlbumScope({
        album_id: albumId,
        organization_id: organizationId,
        scope_level: scopeLevel,
        state_id: scopeLevel === 'STATE' && stateId ? stateId : null,
        company_id: scopeLevel === 'COMPANY' && companyId ? companyId : null,
      });
      toast.success('Album scope updated');
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
          <DialogTitle>Album scope</DialogTitle>
          <DialogDescription>
            Set who can see this album. Universal = all orgs. State = orgs that operate in that state. Company = one org only.
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
                onValueChange={(v) => {
                  setScopeLevel(v as AlbumScopeLevel);
                  setStateId('');
                  setCompanyId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNIVERSAL">{SCOPE_LABELS.UNIVERSAL}</SelectItem>
                  <SelectItem value="STATE">{SCOPE_LABELS.STATE}</SelectItem>
                  <SelectItem value="COMPANY">{SCOPE_LABELS.COMPANY}</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select organization</SelectItem>
                    {organizations.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
