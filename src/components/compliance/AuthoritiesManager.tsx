import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Building2,
  Globe,
  Phone,
  Mail,
  Search,
  Filter,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import {
  getComplianceAuthorities,
  createComplianceAuthority,
  updateComplianceAuthority,
  deleteComplianceAuthority,
  type ComplianceAuthority
} from '../../lib/crud/compliance';

// US States for dropdown
const US_STATES = [
  { value: 'all', label: 'All States' },
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' }
];

const AUTHORITY_TYPES = [
  { value: 'alcohol_tobacco_commission', label: 'Alcohol/Tobacco Commission' },
  { value: 'business_professional_regulation', label: 'Business & Professional Regulation' },
  { value: 'dept_of_agriculture', label: 'Dept. of Agriculture' },
  { value: 'dept_of_health', label: 'Dept. of Health' },
  { value: 'dept_of_labor', label: 'Dept. of Labor' },
  { value: 'environmental', label: 'Environmental Agency' },
  { value: 'other', label: 'Other' }
];

export function AuthoritiesManager() {
  const { t } = useTranslation();
  const [authorities, setAuthorities] = useState<ComplianceAuthority[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('');

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingAuthority, setEditingAuthority] = useState<ComplianceAuthority | null>(null);
  const [formData, setFormData] = useState({
    state_code: '',
    name: '',
    abbreviation: '',
    authority_type: 'other',
    website_url: '',
    contact_email: '',
    contact_phone: ''
  });
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingAuthority, setDeletingAuthority] = useState<ComplianceAuthority | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchAuthorities();
  }, [stateFilter]);

  async function fetchAuthorities() {
    setLoading(true);
    setError(null);
    try {
      // Convert 'all' back to undefined for the API call
      const stateCode = stateFilter === 'all' ? undefined : stateFilter;
      const data = await getComplianceAuthorities(stateCode || undefined);
      setAuthorities(data);
    } catch (err: any) {
      console.error('Error fetching authorities:', err);
      setError(err.message || 'Failed to load authorities');
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingAuthority(null);
    setFormData({
      state_code: '',
      name: '',
      abbreviation: '',
      authority_type: 'other',
      website_url: '',
      contact_email: '',
      contact_phone: ''
    });
    setShowDialog(true);
  }

  function openEditDialog(authority: ComplianceAuthority) {
    setEditingAuthority(authority);
    setFormData({
      state_code: authority.state_code || '',
      name: authority.name,
      abbreviation: authority.abbreviation || '',
      authority_type: authority.authority_type || 'other',
      website_url: authority.website_url || '',
      contact_email: authority.contact_email || '',
      contact_phone: authority.contact_phone || ''
    });
    setShowDialog(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      setError('Authority name is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        state_code: formData.state_code || null,
        name: formData.name.trim(),
        abbreviation: formData.abbreviation.trim() || null,
        authority_type: formData.authority_type,
        website_url: formData.website_url.trim() || null,
        contact_email: formData.contact_email.trim() || null,
        contact_phone: formData.contact_phone.trim() || null
      };

      if (editingAuthority) {
        await updateComplianceAuthority(editingAuthority.id, payload);
      } else {
        await createComplianceAuthority(payload);
      }
      setShowDialog(false);
      await fetchAuthorities();
    } catch (err: any) {
      console.error('Error saving authority:', err);
      setError(err.message || 'Failed to save authority');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingAuthority) return;

    setDeleting(true);
    try {
      await deleteComplianceAuthority(deletingAuthority.id);
      setDeletingAuthority(null);
      await fetchAuthorities();
    } catch (err: any) {
      console.error('Error deleting authority:', err);
      setError(err.message || 'Failed to delete authority');
    } finally {
      setDeleting(false);
    }
  }

  // Filter authorities by search term
  const filteredAuthorities = authorities.filter(authority => {
    const searchLower = searchTerm.toLowerCase();
    return (
      authority.name.toLowerCase().includes(searchLower) ||
      (authority.abbreviation?.toLowerCase() || '').includes(searchLower) ||
      (authority.state_code?.toLowerCase() || '').includes(searchLower)
    );
  });

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'alcohol_tobacco_commission':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'business_professional_regulation':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'dept_of_agriculture':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'dept_of_health':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'dept_of_labor':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'environmental':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'other':
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('compliance.auth.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder={t('compliance.auth.filterByState')} />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state.value} value={state.value}>
                    {state.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {t('compliance.auth.title')}
              </CardTitle>
              <CardDescription>
                {t('compliance.auth.description')}
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t('compliance.auth.addAuthority')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('compliance.auth.colState')}</TableHead>
                <TableHead>{t('compliance.topics.colName')}</TableHead>
                <TableHead>{t('compliance.auth.colType')}</TableHead>
                <TableHead>{t('compliance.auth.colContact')}</TableHead>
                <TableHead className="w-24">{t('compliance.colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAuthorities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {t('compliance.auth.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAuthorities.map((authority) => (
                  <TableRow key={authority.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {authority.state_code || 'National'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{authority.name}</p>
                        {authority.abbreviation && (
                          <p className="text-sm text-muted-foreground">{authority.abbreviation}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getTypeBadgeColor(authority.authority_type || 'other')}>
                        {authority.authority_type || 'state'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {authority.website_url && (
                          <a
                            href={authority.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            <Globe className="h-4 w-4" />
                          </a>
                        )}
                        {authority.contact_email && (
                          <a
                            href={`mailto:${authority.contact_email}`}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Mail className="h-4 w-4" />
                          </a>
                        )}
                        {authority.contact_phone && (
                          <a
                            href={`tel:${authority.contact_phone}`}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(authority)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingAuthority(authority)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAuthority ? t('compliance.auth.editAuthority') : t('compliance.auth.createAuthority')}
            </DialogTitle>
            <DialogDescription>
              {editingAuthority
                ? t('compliance.auth.editAuthorityDesc')
                : t('compliance.auth.createAuthorityDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="state_code">{t('compliance.auth.colState')}</Label>
                <Select
                  value={formData.state_code || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, state_code: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('compliance.auth.selectState')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('compliance.auth.nationalNoState')}</SelectItem>
                    {US_STATES.filter(s => s.value && s.value !== 'all').map((state) => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="authority_type">{t('compliance.auth.colType')}</Label>
                <Select
                  value={formData.authority_type}
                  onValueChange={(value) => setFormData({ ...formData, authority_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTHORITY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t('compliance.topics.labelName')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('compliance.auth.namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="abbreviation">{t('compliance.auth.labelAbbreviation')}</Label>
              <Input
                id="abbreviation"
                value={formData.abbreviation}
                onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                placeholder={t('compliance.auth.abbreviationPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website_url">{t('compliance.auth.labelWebsite')}</Label>
              <Input
                id="website_url"
                type="url"
                value={formData.website_url}
                onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_email">{t('compliance.auth.labelContactEmail')}</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  placeholder="contact@authority.gov"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">{t('compliance.auth.labelContactPhone')}</Label>
                <Input
                  id="contact_phone"
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              {t('compliance.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('compliance.saving')}
                </>
              ) : (
                editingAuthority ? t('compliance.update') : t('compliance.create')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingAuthority} onOpenChange={() => setDeletingAuthority(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('compliance.auth.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('compliance.auth.deleteDesc', { name: deletingAuthority?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('compliance.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('compliance.deleting')}
                </>
              ) : (
                t('compliance.delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
