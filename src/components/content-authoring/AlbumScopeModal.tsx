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
  getAlbumScope,
  upsertAlbumScope,
  getUsStates,
  type AlbumScopeLevel,
} from '../../lib/crud/albumScopes';
import { getOrganizationsForScope } from '../../lib/crud/trackScopes';
import { toast } from 'sonner';

// SCOPE_LABELS are now rendered via i18n in the component

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
  const { t } = useTranslation();
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
        toast.error(e?.message || t('contentAuthoring.albumScopeLoadFailed'));
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
      toast.success(t('contentAuthoring.albumScopeUpdated'));
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || t('contentAuthoring.albumScopeSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('contentAuthoring.albumScopeTitle')}</DialogTitle>
          <DialogDescription>
            {t('contentAuthoring.albumScopeDesc')}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-6 text-center text-muted-foreground">{t('common.loading')}</div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('contentAuthoring.albumScopeLevel')}</Label>
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
                  <SelectItem value="UNIVERSAL">{t('contentAuthoring.scopeUniversal')}</SelectItem>
                  <SelectItem value="STATE">{t('contentAuthoring.scopeState')}</SelectItem>
                  <SelectItem value="COMPANY">{t('contentAuthoring.scopeCompany')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scopeLevel === 'STATE' && (
              <div className="space-y-2">
                <Label>{t('contentAuthoring.albumScopeStateLabel')}</Label>
                <Select value={stateId || 'none'} onValueChange={(v) => setStateId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('contentAuthoring.selectStatePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('contentAuthoring.selectStatePlaceholder')}</SelectItem>
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
                <Label>{t('contentAuthoring.albumScopeCompanyLabel')}</Label>
                <Select value={companyId || 'none'} onValueChange={(v) => setCompanyId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('contentAuthoring.selectOrgPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('contentAuthoring.selectOrgPlaceholder')}</SelectItem>
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
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
