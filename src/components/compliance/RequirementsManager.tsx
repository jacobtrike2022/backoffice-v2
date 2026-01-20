import React, { useState, useEffect } from 'react';
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
  getComplianceRequirements,
  getComplianceTopics,
  getComplianceAuthorities,
  createComplianceRequirement,
  updateComplianceRequirement,
  deleteComplianceRequirement,
  type ComplianceRequirement,
  type ComplianceTopic,
  type ComplianceAuthority
} from '../../lib/crud/compliance';

const REQUIREMENT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'archived', label: 'Archived' }
];

export function RequirementsManager() {
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [topics, setTopics] = useState<ComplianceTopic[]>([]);
  const [authorities, setAuthorities] = useState<ComplianceAuthority[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<ComplianceRequirement | null>(null);
  const [formData, setFormData] = useState({
    topic_id: '',
    authority_id: '',
    requirement_name: '',
    course_name: '',
    state_code: '',
    law_code_reference: '',
    recertification_years: 2,
    days_to_complete: 30,
    status: 'active',
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
      const [reqData, topicData, authData] = await Promise.all([
        getComplianceRequirements(),
        getComplianceTopics(),
        getComplianceAuthorities()
      ]);
      setRequirements(reqData);
      setTopics(topicData);
      setAuthorities(authData);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function fetchRequirements() {
    try {
      const filters: any = {};
      if (topicFilter) filters.topicId = topicFilter;
      if (statusFilter) filters.status = statusFilter;
      const data = await getComplianceRequirements(filters);
      setRequirements(data);
    } catch (err: any) {
      console.error('Error fetching requirements:', err);
      setError(err.message || 'Failed to load requirements');
    }
  }

  useEffect(() => {
    if (!loading) {
      fetchRequirements();
    }
  }, [topicFilter, statusFilter]);

  function openCreateDialog() {
    setEditingRequirement(null);
    setFormData({
      topic_id: '',
      authority_id: '',
      requirement_name: '',
      course_name: '',
      state_code: '',
      law_code_reference: '',
      recertification_years: 2,
      days_to_complete: 30,
      status: 'active',
      cert_details_url: '',
      notes: ''
    });
    setShowDialog(true);
  }

  function openEditDialog(requirement: ComplianceRequirement) {
    setEditingRequirement(requirement);
    setFormData({
      topic_id: requirement.topic_id || '',
      authority_id: requirement.authority_id || '',
      requirement_name: requirement.requirement_name,
      course_name: requirement.course_name || '',
      state_code: requirement.state_code || '',
      law_code_reference: requirement.law_code_reference || '',
      recertification_years: requirement.recertification_years || 2,
      days_to_complete: requirement.days_to_complete || 30,
      status: requirement.status || 'active',
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
      const payload = {
        topic_id: formData.topic_id || null,
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

      if (editingRequirement) {
        await updateComplianceRequirement(editingRequirement.id, payload);
      } else {
        await createComplianceRequirement(payload);
      }
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

  const getTopicName = (topicId: string | null) => {
    if (!topicId) return '-';
    const topic = topics.find(t => t.id === topicId);
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
                placeholder="Search requirements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={topicFilter} onValueChange={setTopicFilter}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by topic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Topics</SelectItem>
                {topics.map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
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
                Compliance Requirements
              </CardTitle>
              <CardDescription>
                Specific compliance requirements linked to topics and authorities
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Requirement
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requirement</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Authority</TableHead>
                <TableHead>Recert</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequirements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No compliance requirements found
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
                            Course: {requirement.course_name}
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
                      <Badge variant="outline">
                        {requirement.state_code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getTopicName(requirement.topic_id)}
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
              {editingRequirement ? 'Edit Requirement' : 'Create Requirement'}
            </DialogTitle>
            <DialogDescription>
              {editingRequirement
                ? 'Update the compliance requirement details'
                : 'Add a new compliance requirement'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="requirement_name">Requirement Name *</Label>
              <Input
                id="requirement_name"
                value={formData.requirement_name}
                onChange={(e) => setFormData({ ...formData, requirement_name: e.target.value })}
                placeholder="e.g., TABC Certification"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course_name">Course Name</Label>
              <Input
                id="course_name"
                value={formData.course_name}
                onChange={(e) => setFormData({ ...formData, course_name: e.target.value })}
                placeholder="e.g., Seller/Server Training"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="state_code">State Code</Label>
                <Input
                  id="state_code"
                  value={formData.state_code}
                  onChange={(e) => setFormData({ ...formData, state_code: e.target.value.toUpperCase() })}
                  placeholder="e.g., TX"
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="topic_id">Topic</Label>
                <Select
                  value={formData.topic_id}
                  onValueChange={(value) => setFormData({ ...formData, topic_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select topic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {topics.map((topic) => (
                      <SelectItem key={topic.id} value={topic.id}>
                        {topic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="authority_id">Authority</Label>
                <Select
                  value={formData.authority_id}
                  onValueChange={(value) => setFormData({ ...formData, authority_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select authority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
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
                <Label htmlFor="recertification_years">Recertification (years)</Label>
                <Input
                  id="recertification_years"
                  type="number"
                  value={formData.recertification_years}
                  onChange={(e) => setFormData({ ...formData, recertification_years: parseInt(e.target.value) || 2 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="days_to_complete">Days to Complete</Label>
                <Input
                  id="days_to_complete"
                  type="number"
                  value={formData.days_to_complete}
                  onChange={(e) => setFormData({ ...formData, days_to_complete: parseInt(e.target.value) || 30 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="law_code_reference">Law/Code Reference</Label>
              <Input
                id="law_code_reference"
                value={formData.law_code_reference}
                onChange={(e) => setFormData({ ...formData, law_code_reference: e.target.value })}
                placeholder="e.g., Tex. Alco. Bev. Code § 106.14"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cert_details_url">Details URL</Label>
              <Input
                id="cert_details_url"
                type="url"
                value={formData.cert_details_url}
                onChange={(e) => setFormData({ ...formData, cert_details_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this requirement"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingRequirement ? 'Update' : 'Create'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingRequirement} onOpenChange={() => setDeletingRequirement(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Requirement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingRequirement?.requirement_name}"? This action cannot be undone
              and may affect stores and roles assigned to this requirement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
