import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Separator } from './ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { ChevronDown, AlertCircle, Upload, Loader2, FileText } from 'lucide-react';
import type { Role, CreateRoleInput, UpdateRoleInput } from '../types/roles';
import { rolesApi } from '../lib/api/roles';
import { toast } from 'sonner@2.0.3';
import { supabase, supabaseAnonKey, getCurrentUserOrgId } from '../lib/supabase';
import { getServerUrl } from '../utils/supabase/info';
import { uploadSourceFileWithRecord } from '../lib/services/uploadService';

interface RoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (input: CreateRoleInput | UpdateRoleInput) => Promise<void>;
  editingRole: Role | null;
}

export function RoleModal({
  isOpen,
  onClose,
  onSave,
  editingRole,
}: RoleModalProps) {
  const { t } = useTranslation();
  const isEditMode = !!editingRole;
  const [loading, setLoading] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploadingJd, setUploadingJd] = useState(false);
  const jdFileInputRef = React.useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState<CreateRoleInput>({
    name: '',
    display_name: '',
    description: '',
    department: '',
    job_family: '',
    is_manager: false,
    is_frontline: true,
    permission_level: 1,
    job_description: '',
    job_description_source: 'manual',
  });

  const [status, setStatus] = useState<
    'active' | 'inactive' | 'archived' | 'pending_review'
  >('active');

  // Load role data when editing
  useEffect(() => {
    if (isEditMode && editingRole) {
      setFormData({
        name: editingRole.name || '',
        display_name: editingRole.display_name || '',
        description: editingRole.description || '',
        department: editingRole.department || '',
        job_family: editingRole.job_family || '',
        is_manager: editingRole.is_manager || false,
        is_frontline: editingRole.is_frontline ?? true,
        permission_level: editingRole.permission_level || 1,
        job_description: editingRole.job_description || '',
        job_description_source:
          editingRole.job_description_source || 'manual',
      });
      setStatus(editingRole.status);
      setUserCount(editingRole.user_count || 0);

      // Load user count if not already loaded
      if (!editingRole.user_count) {
        loadUserCount(editingRole.id);
      }
    } else {
      // Reset form for create mode
      setFormData({
        name: '',
        display_name: '',
        description: '',
        department: '',
        job_family: '',
        is_manager: false,
        is_frontline: true,
        permission_level: 1,
        job_description: '',
        job_description_source: 'manual',
      });
      setStatus('active');
      setUserCount(0);
      setShowAdvanced(false);
    }
  }, [isEditMode, editingRole]);

  async function loadUserCount(roleId: string) {
    try {
      const users = await rolesApi.getUsersForRole(roleId);
      setUserCount(users.length);
    } catch (error) {
      console.error('Error loading user count:', error);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      toast.error('Role name is required');
      return;
    }

    // If is_manager is checked, ensure permission_level >= 3
    if (formData.is_manager && formData.permission_level < 3) {
      toast.error(
        'Manager roles must have a permission level of 3 or higher'
      );
      return;
    }

    setLoading(true);
    try {
      if (isEditMode) {
        await onSave({
          ...formData,
          id: editingRole!.id,
          status,
        } as UpdateRoleInput);
      } else {
        await onSave(formData);
      }
    } catch (error) {
      // Error is handled by parent component
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editingRole) return;

    if (
      !confirm(
        `Are you sure you want to archive "${editingRole.name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await rolesApi.delete(editingRole.id);
      toast.success('Role archived successfully');
      onClose();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      toast.error('Failed to archive role', {
        description: error.message || 'An unexpected error occurred',
      });
    }
  };

  const handlePermissionLevelChange = (value: string) => {
    const level = parseInt(value);
    setFormData({ ...formData, permission_level: level });

    // Auto-check is_manager if level >= 3
    if (level >= 3 && !formData.is_manager) {
      setFormData({ ...formData, permission_level: level, is_manager: true });
    }
  };

  const handleIsManagerChange = (checked: boolean) => {
    setFormData({ ...formData, is_manager: checked });
    // If checking is_manager, ensure permission_level >= 3
    if (checked && formData.permission_level < 3) {
      setFormData({
        ...formData,
        is_manager: checked,
        permission_level: 3,
      });
    }
  };

  // Handle JD file upload
  async function handleJdUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type', {
        description: 'Please upload a PDF, Word document, or text file.',
      });
      return;
    }

    setUploadingJd(true);
    try {
      const orgId = await getCurrentUserOrgId();
      if (!orgId) throw new Error('No organization found');

      // Upload file and create database record
      const uploadResult = await uploadSourceFileWithRecord(file, orgId, 'job_description');

      if (!uploadResult.success || !uploadResult.file) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      const uploadedFile = uploadResult.file;

      // Extract text from the document (use anon key in demo when no session)
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || supabaseAnonKey;

      const serverUrl = getServerUrl();
      const extractResponse = await fetch(`${serverUrl}/extract-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ source_file_id: uploadedFile.id }),
      });

      if (!extractResponse.ok) {
        const errData = await extractResponse.json().catch(() => ({}));
        throw new Error(errData.error || 'Text extraction failed');
      }

      toast.success('File uploaded', { description: 'Extracting job description...' });

      // Now extract JD data using AI
      const jdResponse = await fetch(`${serverUrl}/extract-job-description`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ source_file_id: uploadedFile.id }),
      });

      const jdData = await jdResponse.json();
      if (!jdResponse.ok) {
        throw new Error(jdData.error || 'JD extraction failed');
      }

      // Build job description text from extracted data
      const extractedJd = jdData.extracted_data || {};
      const jdText = [
        extractedJd.job_summary,
        extractedJd.essential_functions?.length ?
          `Essential Functions:\n${extractedJd.essential_functions.map((f: string) => `• ${f}`).join('\n')}` : '',
        extractedJd.qualifications?.length ?
          `Qualifications:\n${extractedJd.qualifications.map((q: string) => `• ${q}`).join('\n')}` : '',
        extractedJd.skills?.length ?
          `Skills:\n${extractedJd.skills.map((s: string) => `• ${s}`).join('\n')}` : '',
      ].filter(Boolean).join('\n\n');

      // Update form with extracted JD
      setFormData(prev => ({
        ...prev,
        job_description: jdText || prev.job_description,
        job_description_source: 'uploaded',
        // If no name set yet and we extracted one, pre-fill it
        name: prev.name || extractedJd.role_name || prev.name,
        department: prev.department || extractedJd.department || prev.department,
      }));

      // Auto-expand advanced section to show the extracted JD
      setShowAdvanced(true);

      toast.success('Job description extracted', {
        description: extractedJd.role_name || 'Review the extracted content below.',
      });
    } catch (error: any) {
      console.error('JD upload error:', error);
      toast.error('Upload failed', { description: error.message });
    } finally {
      setUploadingJd(false);
      // Reset file input
      if (jdFileInputRef.current) {
        jdFileInputRef.current.value = '';
      }
    }
  }

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? t('roles.editRoleTitle', { name: editingRole?.name }) : t('roles.createNewRole')}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? t('roles.updateRoleDetails')
              : t('roles.addNewRoleDesc')}
          </DialogDescription>
        </DialogHeader>

        {isEditMode && userCount > 0 && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">
              {t('roles.usersAssignedToRole', { count: userCount })}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">{t('roles.basicInformation')}</h3>
            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  {t('roles.roleName')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Store Manager"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="display_name">{t('roles.displayNameOptional')}</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) =>
                    setFormData({ ...formData, display_name: e.target.value })
                  }
                  placeholder="Shorter version for display"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('roles.description')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of this role"
                rows={3}
              />
            </div>
          </div>

          {/* Classification */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">{t('roles.classification')}</h3>
            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">{t('roles.department')}</Label>
                <Select
                  value={formData.department || undefined}
                  onValueChange={(value) =>
                    setFormData({ ...formData, department: value || '' })
                  }
                >
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Operations">Operations</SelectItem>
                    <SelectItem value="Kitchen">Kitchen</SelectItem>
                    <SelectItem value="Management">Management</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Corporate">Corporate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="job_family">{t('roles.jobFamily')}</Label>
                <Select
                  value={formData.job_family || undefined}
                  onValueChange={(value) =>
                    setFormData({ ...formData, job_family: value || '' })
                  }
                >
                  <SelectTrigger id="job_family">
                    <SelectValue placeholder="Select job family" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Food Service">Food Service</SelectItem>
                    <SelectItem value="Retail">Retail</SelectItem>
                    <SelectItem value="Management">Management</SelectItem>
                    <SelectItem value="Leadership">Leadership</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_manager"
                  checked={formData.is_manager}
                  onCheckedChange={(checked) =>
                    handleIsManagerChange(checked === true)
                  }
                />
                <Label htmlFor="is_manager" className="cursor-pointer">
                  {t('roles.managerRole')}
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_frontline"
                  checked={formData.is_frontline}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      is_frontline: checked === true,
                    })
                  }
                />
                <Label htmlFor="is_frontline" className="cursor-pointer">
                  {t('roles.frontline')}
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="permission_level">{t('roles.permissionLevel')}</Label>
              <Select
                value={formData.permission_level.toString()}
                onValueChange={handlePermissionLevelChange}
              >
                <SelectTrigger id="permission_level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t('roles.permLevel1')}</SelectItem>
                  <SelectItem value="2">{t('roles.permLevel2')}</SelectItem>
                  <SelectItem value="3">{t('roles.permLevel3')}</SelectItem>
                  <SelectItem value="4">{t('roles.permLevel4')}</SelectItem>
                  <SelectItem value="5">{t('roles.permLevel5')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced Section */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold hover:text-foreground">
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  showAdvanced ? 'transform rotate-180' : ''
                }`}
              />
              {t('roles.advanced')}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              <Separator />

              {/* JD Upload Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t('roles.uploadJobDescriptionOptional')}</Label>
                  <input
                    type="file"
                    ref={jdFileInputRef}
                    onChange={handleJdUpload}
                    accept=".pdf,.doc,.docx,.txt"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => jdFileInputRef.current?.click()}
                    disabled={uploadingJd}
                  >
                    {uploadingJd ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('roles.extracting')}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        {t('roles.uploadJobDescription')}
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload a PDF, Word doc, or text file to auto-extract job description content.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="job_description">{t('roles.jobDescription')}</Label>
                <Textarea
                  id="job_description"
                  value={formData.job_description}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      job_description: e.target.value,
                    })
                  }
                  placeholder="Full job description for RAG indexing and reference"
                  rows={10}
                />
              </div>

              {formData.job_description && (
                <div className="space-y-2">
                  <Label>{t('roles.jobDescriptionSource')}</Label>
                  <RadioGroup
                    value={formData.job_description_source || 'manual'}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        job_description_source: value as
                          | 'manual'
                          | 'hris'
                          | 'uploaded',
                      })
                    }
                    className="flex items-center gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="manual" id="source-manual" />
                      <Label htmlFor="source-manual" className="cursor-pointer">
                        Manual
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="hris" id="source-hris" />
                      <Label htmlFor="source-hris" className="cursor-pointer">
                        HRIS
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="uploaded" id="source-uploaded" />
                      <Label
                        htmlFor="source-uploaded"
                        className="cursor-pointer"
                      >
                        Uploaded
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

            </CollapsibleContent>
          </Collapsible>

          {/* Status (Edit Mode Only) */}
          {isEditMode && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('roles.statusActive')}</SelectItem>
                  <SelectItem value="inactive">{t('roles.statusInactive')}</SelectItem>
                  <SelectItem value="pending_review">{t('roles.statusPendingReview')}</SelectItem>
                  <SelectItem value="archived">{t('roles.statusArchived')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between">
            <div>
              {isEditMode && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  className="mr-auto"
                >
                  {t('roles.deleteRole')}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
              >
                {loading
                  ? t('common.saving')
                  : isEditMode
                  ? t('roles.saveChanges')
                  : t('roles.createRole')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

