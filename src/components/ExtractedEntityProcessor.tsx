import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Briefcase,
  FileText,
  Search,
  Check,
  AlertCircle,
  Merge,
  Plus,
  ArrowRight,
  Users,
  Shield,
  UserCheck,
  HardHat,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase, supabaseAnonKey, getCurrentUserOrgId } from '../lib/supabase';
import { getServerUrl } from '../utils/supabase/info';
import { rolesApi } from '../lib/api/roles';
import type { Role, DuplicateRoleSuggestion } from '../types/roles';

interface ExtractedEntityProcessorProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: string;
  onProcessComplete: (createdRoleId?: string) => void;
}

// Match the AI extraction schema exactly
interface ExtractedData {
  role_name?: string;
  department?: string | null;
  job_family?: string | null;
  is_manager?: boolean;
  is_frontline?: boolean;
  permission_level?: number;
  responsibilities?: string[];
  skills?: string[];
  knowledge?: string[];
  onet_search_keywords?: string[];
  job_description?: string;
  // Legacy fields from old schema (for backward compatibility)
  job_summary?: string;
  essential_functions?: string[];
  qualifications?: string[];
  reports_to?: string;
  flsa_status?: string;
  [key: string]: any;
}

interface OnetSuggestion {
  onet_code: string;
  title: string;
  confidence: number;
  alternate_titles?: string[];
}

interface EntityDetails {
  id: string;
  entity_type: string;
  entity_status: string;
  extracted_data: ExtractedData;
  extraction_confidence: number | null;
  source_file_id: string;
  source_chunk_id: string | null;
  onet_suggestions: OnetSuggestion[];
  source_file?: {
    file_name: string;
  };
  source_chunk?: {
    title: string;
    content: string;
  };
}

interface PotentialDuplicate {
  role_id: string;
  role_name: string;
  similarity_score: number;
  user_count: number;
}

// Simplified to 2 steps - O*NET matching moved to Role Edit page
const STEPS = [
  { id: 1, name: 'Review & Confirm', icon: FileText },
  { id: 2, name: 'Create Role', icon: Plus },
];

export function ExtractedEntityProcessor({
  isOpen,
  onClose,
  entityId,
  onProcessComplete,
}: ExtractedEntityProcessorProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [entityDetails, setEntityDetails] = useState<EntityDetails | null>(null);
  const [editedData, setEditedData] = useState<ExtractedData>({});

  // Duplicate check (now part of step 1)
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicatesChecked, setDuplicatesChecked] = useState(false);
  const [potentialDuplicates, setPotentialDuplicates] = useState<PotentialDuplicate[]>([]);
  const [selectedDuplicate, setSelectedDuplicate] = useState<string | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<'create_new' | 'merge' | null>(null);

  // Creating
  const [creating, setCreating] = useState(false);

  // Load entity details when modal opens
  useEffect(() => {
    if (isOpen && entityId) {
      loadEntityDetails();
    } else {
      // Reset state when closed
      setCurrentStep(1);
      setEntityDetails(null);
      setEditedData({});
      setPotentialDuplicates([]);
      setSelectedDuplicate(null);
      setDuplicateAction(null);
      setDuplicatesChecked(false);
    }
  }, [isOpen, entityId]);

  async function loadEntityDetails() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || supabaseAnonKey;

      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/extracted-entity/${entityId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'apikey': supabaseAnonKey,
        },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load entity');

      setEntityDetails(data.entity);
      setEditedData(data.entity.extracted_data || {});

      // Auto-check for duplicates after loading
      if (data.entity.extracted_data?.role_name) {
        checkForDuplicates(data.entity.extracted_data.role_name);
      }
    } catch (error: any) {
      console.error('Error loading entity:', error);
      toast.error('Failed to load entity details', { description: error.message });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  async function checkForDuplicates(roleNameOverride?: string) {
    setCheckingDuplicates(true);
    try {
      const roleName = roleNameOverride || editedData.role_name || '';
      if (!roleName) {
        setPotentialDuplicates([]);
        setDuplicatesChecked(true);
        setDuplicateAction('create_new');
        return;
      }

      // Do a simple name search for similar roles
      const orgId = await getCurrentUserOrgId();
      const { data: similarRoles } = await supabase
        .from('roles')
        .select('id, name, user_count:users(count)')
        .eq('organization_id', orgId)
        .ilike('name', `%${roleName.split(' ')[0]}%`)
        .limit(5);

      const matches: PotentialDuplicate[] = (similarRoles || []).map((r: any) => ({
        role_id: r.id,
        role_name: r.name,
        similarity_score: 0.5, // Default score for name matches
        user_count: r.user_count?.[0]?.count || 0,
      }));

      setPotentialDuplicates(matches);
      setDuplicatesChecked(true);

      // Auto-set action if no duplicates found
      if (matches.length === 0) {
        setDuplicateAction('create_new');
      }
    } catch (error: any) {
      console.error('Error checking duplicates:', error);
      // Don't block progress, just show empty duplicates
      setPotentialDuplicates([]);
      setDuplicatesChecked(true);
      setDuplicateAction('create_new');
    } finally {
      setCheckingDuplicates(false);
    }
  }

  async function createRole() {
    setCreating(true);
    try {
      // Use the full job_description from extraction, or build from legacy fields
      const jobDescription = editedData.job_description || [
        editedData.job_summary,
        editedData.responsibilities?.length ?
          `Responsibilities:\n${editedData.responsibilities.map(r => `• ${r}`).join('\n')}` : '',
        editedData.essential_functions?.length ?
          `Essential Functions:\n${editedData.essential_functions.map(f => `• ${f}`).join('\n')}` : '',
        editedData.qualifications?.length ?
          `Qualifications:\n${editedData.qualifications.map(q => `• ${q}`).join('\n')}` : '',
        editedData.skills?.length ?
          `Skills:\n${editedData.skills.map(s => `• ${s}`).join('\n')}` : '',
        editedData.knowledge?.length ?
          `Knowledge:\n${editedData.knowledge.map(k => `• ${k}`).join('\n')}` : '',
      ].filter(Boolean).join('\n\n');

      // Pass ALL extracted fields to the role - no data loss!
      const roleInput = {
        name: editedData.role_name || 'Unnamed Role',
        department: editedData.department || undefined,
        job_family: editedData.job_family || undefined,
        is_manager: editedData.is_manager ?? false,
        is_frontline: editedData.is_frontline ?? true,
        permission_level: editedData.permission_level ?? 1,
        job_description: jobDescription,
        job_description_source: 'uploaded' as const,
        flsa_status: editedData.flsa_status as 'exempt' | 'non_exempt' | undefined,
      };

      const newRole = await rolesApi.create(roleInput);

      // Update the entity to link it to the new role (works in demo via anon RLS)
      await supabase
        .from('extracted_entities')
        .update({
          linked_entity_type: 'roles',
          linked_entity_id: newRole.id,
          linked_at: new Date().toISOString(),
          entity_status: 'completed',
          link_action: 'created'
        })
        .eq('id', entityId);

      // Also update the role with source lineage AND extracted JD data
      await supabase
        .from('roles')
        .update({
          source_entity_id: entityId,
          source_file_id: entityDetails?.source_file_id,
          source_chunk_id: entityDetails?.source_chunk_id,
          // Store the raw extracted data for future enrichment workflows
          extracted_jd_data: {
            role_name: editedData.role_name,
            department: editedData.department,
            job_family: editedData.job_family,
            is_manager: editedData.is_manager,
            is_frontline: editedData.is_frontline,
            permission_level: editedData.permission_level,
            responsibilities: editedData.responsibilities,
            skills: editedData.skills,
            knowledge: editedData.knowledge,
            onet_search_keywords: editedData.onet_search_keywords,
            job_description: editedData.job_description,
          },
        })
        .eq('id', newRole.id);

      toast.success('Role created! Opening editor...', {
        description: `Complete the setup for ${newRole.name} by selecting an O*NET profile.`,
      });

      // Navigate to role edit page so user can complete O*NET matching
      onProcessComplete(newRole.id);
      onClose();
    } catch (error: any) {
      console.error('Error creating role:', error);
      toast.error('Failed to create role', { description: error.message });
    } finally {
      setCreating(false);
    }
  }

  async function mergeWithExisting() {
    if (!selectedDuplicate) return;

    setCreating(true);
    try {
      // Get the existing role
      const existingRole = await rolesApi.get(selectedDuplicate);

      // Use the full job_description from extraction, or build from legacy fields
      const newJdContent = editedData.job_description || [
        editedData.job_summary,
        editedData.responsibilities?.length ?
          `Responsibilities:\n${editedData.responsibilities.map(r => `• ${r}`).join('\n')}` : '',
        editedData.essential_functions?.length ?
          `Essential Functions:\n${editedData.essential_functions.map(f => `• ${f}`).join('\n')}` : '',
        editedData.qualifications?.length ?
          `Qualifications:\n${editedData.qualifications.map(q => `• ${q}`).join('\n')}` : '',
        editedData.skills?.length ?
          `Skills:\n${editedData.skills.map(s => `• ${s}`).join('\n')}` : '',
        editedData.knowledge?.length ?
          `Knowledge:\n${editedData.knowledge.map(k => `• ${k}`).join('\n')}` : '',
      ].filter(Boolean).join('\n\n');

      // Merge: new JD takes priority, existing data supplements
      const mergedDescription = existingRole.job_description
        ? `${newJdContent}\n\n---\nPrevious Description:\n${existingRole.job_description}`
        : newJdContent;

      // Update with all extracted fields (only override if extracted values exist)
      const updateData: Record<string, any> = {
        id: selectedDuplicate,
        job_description: mergedDescription,
        job_description_source: 'uploaded' as const,
      };

      // Only update these fields if they have values and existing role doesn't
      if (editedData.department && !existingRole.department) {
        updateData.department = editedData.department;
      }
      if (editedData.job_family && !existingRole.job_family) {
        updateData.job_family = editedData.job_family;
      }

      await rolesApi.update(updateData);

      // Update the entity to link it to the existing role
      await supabase
        .from('extracted_entities')
        .update({
          linked_entity_type: 'roles',
          linked_entity_id: selectedDuplicate,
          linked_at: new Date().toISOString(),
          entity_status: 'completed',
          link_action: 'enriched',
        })
        .eq('id', entityId);

      // Also store extracted JD data and source chunk on the role
      await supabase
        .from('roles')
        .update({
          source_entity_id: entityId,
          source_file_id: entityDetails?.source_file_id,
          source_chunk_id: entityDetails?.source_chunk_id,
          // Store the raw extracted data for future enrichment workflows
          extracted_jd_data: {
            role_name: editedData.role_name,
            department: editedData.department,
            job_family: editedData.job_family,
            is_manager: editedData.is_manager,
            is_frontline: editedData.is_frontline,
            permission_level: editedData.permission_level,
            responsibilities: editedData.responsibilities,
            skills: editedData.skills,
            knowledge: editedData.knowledge,
            onet_search_keywords: editedData.onet_search_keywords,
            job_description: editedData.job_description,
          },
        })
        .eq('id', selectedDuplicate);

      toast.success('Role updated! Opening editor...', {
        description: `Job description merged with ${existingRole.name}.`,
      });

      // Navigate to role edit page
      onProcessComplete(selectedDuplicate);
      onClose();
    } catch (error: any) {
      console.error('Error merging role:', error);
      toast.error('Failed to merge role', { description: error.message });
    } finally {
      setCreating(false);
    }
  }

  function handleNext() {
    // Validate step 1 - must have role name and duplicate decision if duplicates exist
    if (currentStep === 1) {
      if (!editedData.role_name?.trim()) {
        toast.error('Role name is required');
        return;
      }
      if (potentialDuplicates.length > 0 && !duplicateAction) {
        toast.error('Please choose to create new or merge with existing');
        return;
      }
    }

    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
  }

  function handleBack() {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }

  function handleFinish() {
    if (duplicateAction === 'merge' && selectedDuplicate) {
      mergeWithExisting();
    } else {
      createRole();
    }
  }

  const progress = (currentStep / STEPS.length) * 100;

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl w-[90vw]">
          <DialogTitle className="sr-only">Loading job description</DialogTitle>
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
              <div className="absolute -inset-2 rounded-full border-2 border-orange-500/30 animate-pulse" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Loading job description data...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-5xl w-[90vw] p-0"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '85vh',
          maxHeight: '85vh',
          gap: 0,
          overflow: 'hidden'
        }}
      >
        {/* Header - fixed */}
        <div style={{ flexShrink: 0 }} className="px-8 pt-6 pb-4 border-b bg-gradient-to-b from-muted/50 to-background">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              Process Job Description
            </DialogTitle>
            <DialogDescription className="text-base mt-1">
              Review and create a role from the extracted job description.
            </DialogDescription>
          </DialogHeader>

          {/* Progress */}
          <div className="mt-4 space-y-3">
            <Progress value={progress} className="h-1.5" />
            <div className="flex justify-between">
              {STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-2 text-sm ${
                    currentStep >= step.id
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    currentStep > step.id
                      ? 'bg-green-500 text-white'
                      : currentStep === step.id
                        ? 'bg-orange-500 text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {currentStep > step.id ? <Check className="h-3 w-3" /> : step.id}
                  </div>
                  <span className="hidden sm:inline">{step.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Step Content - scrollable */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="px-8 py-6">
          {/* Step 1: Review & Confirm (combined extraction review + duplicate check) */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Source info */}
              <div className="bg-muted/50 rounded-xl p-5">
                <p className="text-muted-foreground">
                  Review the extracted data below. Edit any fields as needed, then proceed to create the role.
                </p>
                {entityDetails?.source_file && (
                  <p className="mt-3 text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Source: <span className="font-medium">{entityDetails.source_file.file_name}</span>
                  </p>
                )}
              </div>

              {/* Core Fields */}
              <div className="grid gap-5">
                <div>
                  <Label htmlFor="role_name" className="text-base font-medium">Role Name *</Label>
                  <Input
                    id="role_name"
                    value={editedData.role_name || ''}
                    onChange={(e) => {
                      setEditedData({ ...editedData, role_name: e.target.value });
                      // Re-check duplicates when name changes
                      if (e.target.value.trim()) {
                        checkForDuplicates(e.target.value);
                      }
                    }}
                    placeholder="e.g., Store Manager"
                    className="mt-2 h-11 text-base"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="department" className="text-base font-medium">Department</Label>
                    <Input
                      id="department"
                      value={editedData.department || ''}
                      onChange={(e) => setEditedData({ ...editedData, department: e.target.value })}
                      placeholder="e.g., Operations"
                      className="mt-2 h-11"
                    />
                  </div>
                  <div>
                    <Label htmlFor="job_family" className="text-base font-medium">Job Family</Label>
                    <Input
                      id="job_family"
                      value={editedData.job_family || ''}
                      onChange={(e) => setEditedData({ ...editedData, job_family: e.target.value })}
                      placeholder="e.g., Management"
                      className="mt-2 h-11"
                    />
                  </div>
                </div>

                {/* Classification badges - show extracted values */}
                <div className="flex flex-wrap gap-3">
                  {editedData.is_manager && (
                    <Badge variant="outline" className="px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200">
                      <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                      Manager Role
                    </Badge>
                  )}
                  {editedData.is_frontline && (
                    <Badge variant="outline" className="px-3 py-1.5 text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200">
                      <HardHat className="h-3.5 w-3.5 mr-1.5" />
                      Frontline
                    </Badge>
                  )}
                  {editedData.permission_level && (
                    <Badge variant="outline" className="px-3 py-1.5 text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200">
                      <Shield className="h-3.5 w-3.5 mr-1.5" />
                      Level {editedData.permission_level}
                    </Badge>
                  )}
                </div>

                {/* Skills preview */}
                {editedData.skills && editedData.skills.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Extracted Skills</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {editedData.skills.slice(0, 8).map((skill, idx) => (
                        <Badge key={idx} variant="secondary" className="px-2 py-0.5 text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {editedData.skills.length > 8 && (
                        <Badge variant="outline" className="px-2 py-0.5 text-xs text-muted-foreground">
                          +{editedData.skills.length - 8} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Duplicate Check Section */}
              <Separator />
              <div className="space-y-3">
                <Label className="text-base font-medium flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Duplicate Check
                </Label>

                {checkingDuplicates ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking for similar roles...
                  </div>
                ) : potentialDuplicates.length === 0 ? (
                  <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <p className="text-sm text-green-700 dark:text-green-400">
                          No similar roles found - this will be created as a new role.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Found {potentialDuplicates.length} similar role{potentialDuplicates.length > 1 ? 's' : ''}
                    </p>

                    {potentialDuplicates.map((dup) => (
                      <Card
                        key={dup.role_id}
                        className={`cursor-pointer transition-all ${
                          selectedDuplicate === dup.role_id
                            ? 'ring-2 ring-orange-500 border-orange-500'
                            : 'hover:border-muted-foreground/50'
                        }`}
                        onClick={() => {
                          setSelectedDuplicate(dup.role_id);
                          setDuplicateAction('merge');
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                selectedDuplicate === dup.role_id
                                  ? 'border-orange-500 bg-orange-500'
                                  : 'border-muted-foreground/30'
                              }`}>
                                {selectedDuplicate === dup.role_id && (
                                  <Check className="h-3 w-3 text-white" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{dup.role_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {dup.user_count} employee{dup.user_count !== 1 ? 's' : ''} assigned
                                </p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-sm px-3 py-1">
                              {Math.round(dup.similarity_score * 100)}% match
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    <div className="flex gap-3 pt-2">
                      <Button
                        variant={duplicateAction === 'create_new' ? 'default' : 'outline'}
                        size="sm"
                        className={duplicateAction === 'create_new' ? 'bg-orange-500 hover:bg-orange-600' : ''}
                        onClick={() => {
                          setDuplicateAction('create_new');
                          setSelectedDuplicate(null);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Create New
                      </Button>
                      {selectedDuplicate && (
                        <Button
                          variant={duplicateAction === 'merge' ? 'default' : 'outline'}
                          size="sm"
                          className={duplicateAction === 'merge' ? 'bg-orange-500 hover:bg-orange-600' : ''}
                          onClick={() => setDuplicateAction('merge')}
                        >
                          <Merge className="h-3.5 w-3.5 mr-1.5" />
                          Merge with Selected
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Confirmation & Create */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="bg-muted/50 rounded-xl p-5">
                <p className="text-muted-foreground">
                  {duplicateAction === 'merge'
                    ? 'Confirm merging this job description with the existing role.'
                    : 'Confirm creating a new role with the extracted data.'
                  }
                </p>
                <p className="text-sm text-muted-foreground mt-3">
                  After creation, you'll be taken to the role editor to complete O*NET profile matching and fine-tune competencies.
                </p>
              </div>

              <Card>
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Role Name</p>
                      <p className="font-semibold text-lg mt-1">{editedData.role_name}</p>
                    </div>
                    <Badge className={duplicateAction === 'merge' ? 'bg-blue-500' : 'bg-orange-500'}>
                      {duplicateAction === 'merge' ? 'Merging' : 'Creating New'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {editedData.department && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Department</p>
                        <p className="text-sm mt-1">{editedData.department}</p>
                      </div>
                    )}
                    {editedData.job_family && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Job Family</p>
                        <p className="text-sm mt-1">{editedData.job_family}</p>
                      </div>
                    )}
                  </div>

                  {/* Classification summary */}
                  <div className="flex flex-wrap gap-2">
                    {editedData.is_manager && (
                      <Badge variant="outline" className="text-xs">Manager</Badge>
                    )}
                    {editedData.is_frontline && (
                      <Badge variant="outline" className="text-xs">Frontline</Badge>
                    )}
                    {editedData.permission_level && (
                      <Badge variant="outline" className="text-xs">Level {editedData.permission_level}</Badge>
                    )}
                  </div>

                  {duplicateAction === 'merge' && selectedDuplicate && (
                    <div className="border-t pt-5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Merging With</p>
                      <p className="font-medium flex items-center gap-2 mt-1">
                        <Merge className="h-4 w-4 text-blue-500" />
                        {potentialDuplicates.find(d => d.role_id === selectedDuplicate)?.role_name}
                      </p>
                    </div>
                  )}

                  <div className="border-t pt-5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Source</p>
                    <p className="text-sm flex items-center gap-2 mt-1">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {entityDetails?.source_file?.file_name || 'Unknown source'}
                    </p>
                  </div>

                  {/* What happens next */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-5 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300 flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" />
                      Next: Complete Role Setup
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                      You'll be taken to the role editor to select an O*NET profile and customize tasks, skills, and competencies.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Footer - fixed at bottom */}
        <div style={{ flexShrink: 0 }} className="px-8 py-4 border-t bg-muted/30 flex items-center justify-between">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex gap-3">
            {currentStep > 1 && (
              <Button variant="outline" onClick={handleBack} size="lg">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            {currentStep < STEPS.length ? (
              <Button onClick={handleNext} size="lg" className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6">
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                disabled={creating}
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {duplicateAction === 'merge' ? 'Merging...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {duplicateAction === 'merge' ? 'Merge Role' : 'Create Role'}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
