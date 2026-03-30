import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
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
  FileText,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink
} from 'lucide-react';
import {
  getComplianceRequirementsWithTopics,
  getComplianceRequirementsForOrg,
  getOrgStates,
  getAllComplianceStates,
  getComplianceTopics,
  getComplianceAuthorities,
  createComplianceRequirement,
  updateComplianceRequirement,
  deleteComplianceRequirement,
  setRequirementTopics,
  getRequirementTopics,
  type ComplianceRequirement,
  type ComplianceTopic,
  type ComplianceAuthority
} from '../../lib/crud/compliance';
import { Checkbox } from '../ui/checkbox';

const REQUIREMENT_STATUSES = [
  { value: 'recon_not_started', label: 'Recon Not Started' },
  { value: 'recon_started', label: 'Recon Started' },
  { value: 'recon_done', label: 'Recon Done' },
  { value: 'scope_done', label: 'Scope Done' },
  { value: 'production', label: 'Production' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'done_no_approval_needed', label: 'Done (No Approval Needed)' },
  { value: 'approved', label: 'Approved' }
];

export interface RequirementsManagerProps {
  /** When true, show only requirements for the org's operating states (Compliance tab). When false, show all (Trike Admin). */
  useOrgScope?: boolean;
}

export function RequirementsManager({ useOrgScope = false }: RequirementsManagerProps) {
  const { t } = useTranslation();
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [topics, setTopics] = useState<ComplianceTopic[]>([]);
  const [authorities, setAuthorities] = useState<ComplianceAuthority[]>([]);
  const [orgStates, setOrgStates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state - use 'all' instead of '' for Radix UI Select compatibility
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<ComplianceRequirement | null>(null);
  const [formData, setFormData] = useState({
    topic_ids: [] as string[],  // Multiple topics
    authority_id: '',
    requirement_name: '',
    course_name: '',
    state_code: '',
    law_code_reference: '',
    recertification_years: 2,
    days_to_complete: 30,
    status: 'recon_not_started',
    cert_details_url: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingRequirement, setDeletingRequirement] = useState<ComplianceRequirement | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      if (useOrgScope) {
        const [reqData, topicData, authData, states] = await Promise.all([
          getComplianceRequirementsForOrg(),
          getComplianceTopics(),
          getComplianceAuthorities(),
          getOrgStates()
        ]);
        setRequirements(reqData);
        setTopics(topicData);
        setAuthorities(authData);
        setOrgStates(states);
      } else {
        const [reqData, topicData, authData, states] = await Promise.all([
          getComplianceRequirementsWithTopics(),
          getComplianceTopics(),
          getComplianceAuthorities(),
          getAllComplianceStates()
        ]);
        setRequirements(reqData);
        setTopics(topicData);
        setAuthorities(authData);
        setOrgStates(states);
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function fetchRequirements() {
    try {
      const filters: { topicId?: string; status?: string; stateCode?: string; stateCodes?: string[] } = {};
      if (topicFilter && topicFilter !== 'all') filters.topicId = topicFilter;
      if (statusFilter && statusFilter !== 'all') filters.status = statusFilter;
      if (stateFilter && stateFilter !== 'all') filters.stateCode = stateFilter;

      if (useOrgScope) {
        if (stateFilter === 'all') {
          const data = await getComplianceRequirementsForOrg(filters);
          setRequirements(data);
        } else {
          const data = await getComplianceRequirementsWithTopics(filters);
          setRequirements(data);
        }
      } else {
        const data = await getComplianceRequirementsWithTopics(filters);
        setRequirements(data);
      }
    } catch (err: any) {
      console.error('Error fetching requirements:', err);
      setError(err.message || 'Failed to load requirements');
    }
  }

  useEffect(() => {
    if (!loading) {
      fetchRequirements();
    }
  }, [topicFilter, statusFilter, stateFilter]);

  function openCreateDialog() {
    setEditingRequirement(null);
    setFormData({
      topic_ids: [],
      authority_id: '',
      requirement_name: '',
      course_name: '',
      state_code: '',
      law_code_reference: '',
      recertification_years: 2,
      days_to_complete: 30,
      status: 'recon_not_started',
      cert_details_url: '',
      notes: ''
    });
    setShowDialog(true);
  }

  function openEditDialog(requirement: ComplianceRequirement) {
    setEditingRequirement(requirement);
    // Get topic IDs from the topics array, fallback to legacy topic_id
    const topicIds = requirement.topics?.map(t => t.id) ||
      (requirement.topic_id ? [requirement.topic_id] : []);
    setFormData({
      topic_ids: topicIds,
      authority_id: requirement.authority_id || '',
      requirement_name: requirement.requirement_name,
      course_name: requirement.course_name || '',
      state_code: requirement.state_code || '',
      law_code_reference: requirement.law_code_reference || '',
      recertification_years: requirement.recertification_years || 2,
      days_to_complete: requirement.days_to_complete || 30,
      status: requirement.status || 'recon_not_started',
      cert_details_url: requirement.cert_details_url || '',
      notes: requirement.notes || ''
    });
    setShowDialog(true);
  }

  async function handleSave() {
    if (!formData.requirement_name.trim()) {
      setError('Requirement name is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Use first topic as legacy topic_id for backwards compatibility
      const payload = {
        topic_id: formData.topic_ids[0] || null,
        authority_id: formData.authority_id || null,
        requirement_name: formData.requirement_name.trim(),
        course_name: formData.course_name.trim() || null,
        state_code: formData.state_code || 'TX', // Default to TX if not specified
        law_code_reference: formData.law_code_reference.trim() || null,
        recertification_years: formData.recertification_years,
        days_to_complete: formData.days_to_complete,
        status: formData.status,
        cert_details_url: formData.cert_details_url.trim() || null,
        notes: formData.notes.trim() || null
      };

      let requirementId: string;
      if (editingRequirement) {
        await updateComplianceRequirement(editingRequirement.id, payload);
        requirementId = editingRequirement.id;
      } else {
        const created = await createComplianceRequirement(payload);
        requirementId = created.id;
      }

      // Set multiple topics via junction table
      await setRequirementTopics(requirementId, formData.topic_ids);

      setShowDialog(false);
      await fetchRequirements();
    } catch (err: any) {
      console.error('Error saving requirement:', err);
      setError(err.message || 'Failed to save requirement');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingRequirement) return;

    setDeleting(true);
    try {
      await deleteComplianceRequirement(deletingRequirement.id);
      setDeletingRequirement(null);
      await fetchRequirements();
    } catch (err: any) {
      console.error('Error deleting requirement:', err);
      setError(err.message || 'Failed to delete requirement');
    } finally {
      setDeleting(false);
    }
  }

  // Filter requirements by search term
  const filteredRequirements = requirements.filter(req => {
    const searchLower = searchTerm.toLowerCase();
    return (
      req.requirement_name.toLowerCase().includes(searchLower) ||
      (req.course_name?.toLowerCase() || '').includes(searchLower) ||
      (req.law_code_reference?.toLowerCase() || '').includes(searchLower)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'archived':
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
            Archived
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTopicNames = (requirement: ComplianceRequirement) => {
    // Use topics array if available, otherwise fall back to legacy topic_id
    if (requirement.topics && requirement.topics.length > 0) {
      return requirement.topics.map(t => t.name).join(', ');
    }
    if (!requirement.topic_id) return '-';
    const topic = topics.find(t => t.id === requirement.topic_id);
    return topic?.name || 'Unknown';
  };

  const getAuthorityName = (authorityId: string | null) => {
    if (!authorityId) return '-';
    const authority = authorities.find(a => a.id === authorityId);
    return authority?.abbreviation || authority?.name || 'Unknown';
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
                placeholder={t('compliance.req.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={topicFilter} onValueChange={setTopicFilter}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder={t('compliance.req.filterByTopic')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('compliance.req.allTopics')}</SelectItem>
                {topics.map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {orgStates.length > 0 && (
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder={t('compliance.req.states')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('compliance.req.allStates', { count: orgStates.length })}</SelectItem>
                  {orgStates.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder={t('compliance.req.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('compliance.req.allStatuses')}</SelectItem>
                {REQUIREMENT_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
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
                <FileText className="h-5 w-5 text-primary" />
                {t('compliance.req.title')}
              </CardTitle>
              <CardDescription>
                {useOrgScope
                  ? t('compliance.req.descOrgScope')
                  : t('compliance.req.descAdmin')}
              </CardDescription>
            </div>
            {!useOrgScope && (
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                {t('compliance.req.addRequirement')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('compliance.req.colRequirement')}</TableHead>
                <TableHead>{t('compliance.auth.colState')}</TableHead>
                <TableHead>{t('compliance.topics.title')}</TableHead>
                <TableHead>{t('compliance.authorities')}</TableHead>
                <TableHead>{t('compliance.req.colRecert')}</TableHead>
                <TableHead>{t('compliance.req.status')}</TableHead>
                <TableHead className="w-24">{t('compliance.colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequirements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t('compliance.req.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequirements.map((requirement) => (
                  <TableRow key={requirement.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{requirement.requirement_name}</p>
                        {requirement.course_name && (
                          <p className="text-xs text-muted-foreground">
                            {t('compliance.req.course')}: {requirement.course_name}
                          </p>
                        )}
                        {requirement.law_code_reference && (
                          <p className="text-xs text-muted-foreground">
                            {requirement.law_code_reference}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white border-0 font-medium">
                        {requirement.state_code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getTopicNames(requirement)}
                    </TableCell>
                    <TableCell>
                      {getAuthorityName(requirement.authority_id)}
                    </TableCell>
                    <TableCell>
                      {requirement.recertification_years
                        ? `${requirement.recertification_years} yr${requirement.recertification_years > 1 ? 's' : ''}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(requirement.status || 'active')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {requirement.cert_details_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <a
                              href={requirement.cert_details_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {!useOrgScope && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(requirement)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingRequirement(requirement)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
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
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {editingRequirement ? t('compliance.req.editRequirement') : t('compliance.req.createRequirement')}
            </DialogTitle>
            <DialogDescription>
              {editingRequirement
                ? t('compliance.req.editRequirementDesc')
                : t('compliance.req.createRequirementDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label htmlFor="requirement_name">{t('compliance.req.labelRequirementName')}</Label>
              <Input
                id="requirement_name"
                value={formData.requirement_name}
                onChange={(e) => setFormData({ ...formData, requirement_name: e.target.value })}
                placeholder={t('compliance.req.requirementNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course_name">{t('compliance.req.labelCourseName')}</Label>
              <Input
                id="course_name"
                value={formData.course_name}
                onChange={(e) => setFormData({ ...formData, course_name: e.target.value })}
                placeholder={t('compliance.req.courseNamePlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="state_code">{t('compliance.req.labelStateCode')}</Label>
                <Input
                  id="state_code"
                  value={formData.state_code}
                  onChange={(e) => setFormData({ ...formData, state_code: e.target.value.toUpperCase() })}
                  placeholder="e.g., TX"
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{t('compliance.req.status')}</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUIREMENT_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('compliance.req.labelTopics')}</Label>
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                {topics.map((topic) => (
                  <div key={topic.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`topic-${topic.id}`}
                      checked={formData.topic_ids.includes(topic.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({ ...formData, topic_ids: [...formData.topic_ids, topic.id] });
                        } else {
                          setFormData({ ...formData, topic_ids: formData.topic_ids.filter(id => id !== topic.id) });
                        }
                      }}
                    />
                    <label
                      htmlFor={`topic-${topic.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {topic.name}
                    </label>
                  </div>
                ))}
              </div>
              {formData.topic_ids.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('compliance.req.topicsSelected', { count: formData.topic_ids.length })}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="authority_id">{t('compliance.authorities')}</Label>
                <Select
                  value={formData.authority_id || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, authority_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('compliance.req.selectAuthority')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('compliance.req.none')}</SelectItem>
                    {authorities.map((authority) => (
                      <SelectItem key={authority.id} value={authority.id}>
                        {authority.abbreviation || authority.name}
                        {authority.state_code && ` (${authority.state_code})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recertification_years">{t('compliance.req.labelRecertYears')}</Label>
                <Input
                  id="recertification_years"
                  type="number"
                  value={formData.recertification_years}
                  onChange={(e) => setFormData({ ...formData, recertification_years: parseInt(e.target.value) || 2 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="days_to_complete">{t('compliance.req.labelDaysToComplete')}</Label>
                <Input
                  id="days_to_complete"
                  type="number"
                  value={formData.days_to_complete}
                  onChange={(e) => setFormData({ ...formData, days_to_complete: parseInt(e.target.value) || 30 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="law_code_reference">{t('compliance.req.labelLawCode')}</Label>
              <Input
                id="law_code_reference"
                value={formData.law_code_reference}
                onChange={(e) => setFormData({ ...formData, law_code_reference: e.target.value })}
                placeholder="e.g., Tex. Alco. Bev. Code § 106.14"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cert_details_url">{t('compliance.req.labelDetailsUrl')}</Label>
              <Input
                id="cert_details_url"
                type="url"
                value={formData.cert_details_url}
                onChange={(e) => setFormData({ ...formData, cert_details_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{t('compliance.req.labelNotes')}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('compliance.req.notesPlaceholder')}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 border-t pt-4">
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
                editingRequirement ? t('compliance.update') : t('compliance.create')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingRequirement} onOpenChange={() => setDeletingRequirement(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('compliance.req.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('compliance.req.deleteDesc', { name: deletingRequirement?.requirement_name })}
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
