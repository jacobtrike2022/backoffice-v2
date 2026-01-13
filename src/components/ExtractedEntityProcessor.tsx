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
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
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
  Sparkles,
  Target,
  ArrowRight,
  Users,
  Edit2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase, supabaseAnonKey, getCurrentUserOrgId } from '../lib/supabase';
import { getServerUrl } from '../utils/supabase/info';
import { rolesApi } from '../lib/api/roles';
import { SmartProfileCard } from './SmartProfileCard';
import type { Role, DuplicateRoleSuggestion } from '../types/roles';

interface ExtractedEntityProcessorProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: string;
  onProcessComplete: () => void;
}

interface ExtractedData {
  role_name?: string;
  department?: string;
  job_summary?: string;
  essential_functions?: string[];
  qualifications?: string[];
  skills?: string[];
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

const STEPS = [
  { id: 1, name: 'Review Extraction', icon: FileText },
  { id: 2, name: 'Duplicate Check', icon: Search },
  { id: 3, name: 'O*NET Matching', icon: Target },
  { id: 4, name: 'Create Role', icon: Plus },
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

  // Step 2: Duplicate check
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [potentialDuplicates, setPotentialDuplicates] = useState<PotentialDuplicate[]>([]);
  const [selectedDuplicate, setSelectedDuplicate] = useState<string | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<'create_new' | 'merge' | null>(null);

  // Step 3: O*NET
  const [selectedOnetCode, setSelectedOnetCode] = useState<string | null>(null);
  const [onetSearching, setOnetSearching] = useState(false);
  const [onetSearchResults, setOnetSearchResults] = useState<OnetSuggestion[]>([]);
  const [manualOnetSearch, setManualOnetSearch] = useState('');

  // Step 4: Creating
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
      setSelectedOnetCode(null);
      setOnetSearchResults([]);
    }
  }, [isOpen, entityId]);

  async function loadEntityDetails() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/extracted-entity/${entityId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load entity');

      setEntityDetails(data.entity);
      setEditedData(data.entity.extracted_data || {});

      // Pre-select first O*NET suggestion if available
      if (data.entity.onet_suggestions?.length > 0) {
        setOnetSearchResults(data.entity.onet_suggestions);
      }
    } catch (error: any) {
      console.error('Error loading entity:', error);
      toast.error('Failed to load entity details', { description: error.message });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  async function checkForDuplicates() {
    setCheckingDuplicates(true);
    try {
      const roleName = editedData.role_name || '';
      if (!roleName) {
        setPotentialDuplicates([]);
        return;
      }

      // Find similar roles using the existing duplicate detection
      const duplicates = await rolesApi.findDuplicates(0.4);

      // Also do a simple name search
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

      // Auto-set action if no duplicates found
      if (matches.length === 0) {
        setDuplicateAction('create_new');
      }
    } catch (error: any) {
      console.error('Error checking duplicates:', error);
      // Don't block progress, just show empty duplicates
      setPotentialDuplicates([]);
    } finally {
      setCheckingDuplicates(false);
    }
  }

  async function searchOnet(query: string) {
    if (!query.trim()) return;

    setOnetSearching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/search-onet-profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          query,
          limit: 10
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Search failed');

      setOnetSearchResults(data.profiles || []);
    } catch (error: any) {
      console.error('O*NET search error:', error);
      toast.error('Search failed', { description: error.message });
    } finally {
      setOnetSearching(false);
    }
  }

  async function createRole() {
    setCreating(true);
    try {
      // Build job description from extracted data
      const jobDescription = [
        editedData.job_summary,
        editedData.essential_functions?.length ?
          `Essential Functions:\n${editedData.essential_functions.map(f => `• ${f}`).join('\n')}` : '',
        editedData.qualifications?.length ?
          `Qualifications:\n${editedData.qualifications.map(q => `• ${q}`).join('\n')}` : '',
        editedData.skills?.length ?
          `Skills:\n${editedData.skills.map(s => `• ${s}`).join('\n')}` : '',
      ].filter(Boolean).join('\n\n');

      const roleInput = {
        name: editedData.role_name || 'Unnamed Role',
        department: editedData.department,
        job_description: jobDescription,
        job_description_source: 'extracted',
        flsa_status: editedData.flsa_status as 'exempt' | 'non_exempt' | undefined,
        onet_soc_code: selectedOnetCode || undefined,
      };

      const newRole = await rolesApi.create(roleInput);

      // Update the entity to link it to the new role
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase
          .from('extracted_entities')
          .update({
            linked_entity_type: 'roles',
            linked_entity_id: newRole.id,
            linked_at: new Date().toISOString(),
            entity_status: 'completed',
            link_action: 'created',
          })
          .eq('id', entityId);

        // Also update the role with source lineage
        await supabase
          .from('roles')
          .update({
            source_entity_id: entityId,
            source_file_id: entityDetails?.source_file_id,
          })
          .eq('id', newRole.id);
      }

      toast.success('Role created successfully', {
        description: `${newRole.name} has been added to your roles.`,
      });

      onProcessComplete();
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

      // Build merged job description
      const newJdParts = [
        editedData.job_summary,
        editedData.essential_functions?.length ?
          `Essential Functions:\n${editedData.essential_functions.map(f => `• ${f}`).join('\n')}` : '',
        editedData.qualifications?.length ?
          `Qualifications:\n${editedData.qualifications.map(q => `• ${q}`).join('\n')}` : '',
      ].filter(Boolean).join('\n\n');

      // Merge: new JD takes priority, existing data supplements
      const mergedDescription = existingRole.job_description
        ? `${newJdParts}\n\n---\nPrevious Description:\n${existingRole.job_description}`
        : newJdParts;

      await rolesApi.update({
        id: selectedDuplicate,
        job_description: mergedDescription,
        job_description_source: 'extracted',
        onet_soc_code: selectedOnetCode || existingRole.onet_soc_code,
      });

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

      toast.success('Role updated successfully', {
        description: `Job description merged with ${existingRole.name}.`,
      });

      onProcessComplete();
      onClose();
    } catch (error: any) {
      console.error('Error merging role:', error);
      toast.error('Failed to merge role', { description: error.message });
    } finally {
      setCreating(false);
    }
  }

  function handleNext() {
    if (currentStep === 2 && !duplicateAction) {
      toast.error('Please select an action');
      return;
    }

    if (currentStep === 1) {
      checkForDuplicates();
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
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-[#F74A05]" />
            Process Job Description
          </DialogTitle>
          <DialogDescription>
            Review and create a role from the extracted job description.
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-1 ${
                  currentStep >= step.id ? 'text-foreground' : ''
                }`}
              >
                <step.icon className="h-3 w-3" />
                {step.name}
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Step Content */}
        <ScrollArea className="flex-1 pr-4" style={{ maxHeight: '400px' }}>
          {/* Step 1: Review Extraction */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground">
                  Review the extracted data below. You can edit any fields before proceeding.
                </p>
                {entityDetails?.source_file && (
                  <p className="mt-1 text-xs">
                    Source: <span className="font-medium">{entityDetails.source_file.file_name}</span>
                  </p>
                )}
              </div>

              <div className="grid gap-4">
                <div>
                  <Label htmlFor="role_name">Role Name *</Label>
                  <Input
                    id="role_name"
                    value={editedData.role_name || ''}
                    onChange={(e) => setEditedData({ ...editedData, role_name: e.target.value })}
                    placeholder="e.g., Software Engineer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={editedData.department || ''}
                      onChange={(e) => setEditedData({ ...editedData, department: e.target.value })}
                      placeholder="e.g., Engineering"
                    />
                  </div>
                  <div>
                    <Label htmlFor="reports_to">Reports To</Label>
                    <Input
                      id="reports_to"
                      value={editedData.reports_to || ''}
                      onChange={(e) => setEditedData({ ...editedData, reports_to: e.target.value })}
                      placeholder="e.g., Engineering Manager"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="job_summary">Job Summary</Label>
                  <Textarea
                    id="job_summary"
                    value={editedData.job_summary || ''}
                    onChange={(e) => setEditedData({ ...editedData, job_summary: e.target.value })}
                    placeholder="Brief description of the role..."
                    rows={3}
                  />
                </div>

                {editedData.essential_functions && editedData.essential_functions.length > 0 && (
                  <div>
                    <Label>Essential Functions</Label>
                    <div className="mt-1 space-y-1">
                      {editedData.essential_functions.map((func, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-muted-foreground">•</span>
                          <span>{func}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {editedData.skills && editedData.skills.length > 0 && (
                  <div>
                    <Label>Skills</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {editedData.skills.map((skill, idx) => (
                        <Badge key={idx} variant="secondary">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Duplicate Check */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground">
                  We found {potentialDuplicates.length} similar role(s).
                  Choose to create a new role or merge with an existing one.
                </p>
              </div>

              {checkingDuplicates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Checking for duplicates...</span>
                </div>
              ) : potentialDuplicates.length === 0 ? (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-800">No duplicates found</p>
                        <p className="text-sm text-green-600">
                          "{editedData.role_name}" appears to be a unique role.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {potentialDuplicates.map((dup) => (
                    <Card
                      key={dup.role_id}
                      className={`cursor-pointer transition-all ${
                        selectedDuplicate === dup.role_id
                          ? 'ring-2 ring-[#F74A05] border-[#F74A05]'
                          : 'hover:border-muted-foreground/50'
                      }`}
                      onClick={() => {
                        setSelectedDuplicate(dup.role_id);
                        setDuplicateAction('merge');
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{dup.role_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {dup.user_count} employee{dup.user_count !== 1 ? 's' : ''} assigned
                            </p>
                          </div>
                          <Badge variant="secondary">
                            {Math.round(dup.similarity_score * 100)}% match
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <Separator />

              <div className="flex gap-3">
                <Button
                  variant={duplicateAction === 'create_new' ? 'default' : 'outline'}
                  className={duplicateAction === 'create_new' ? 'bg-[#F74A05] hover:bg-[#F74A05]/90' : ''}
                  onClick={() => {
                    setDuplicateAction('create_new');
                    setSelectedDuplicate(null);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Role
                </Button>
                {potentialDuplicates.length > 0 && selectedDuplicate && (
                  <Button
                    variant={duplicateAction === 'merge' ? 'default' : 'outline'}
                    className={duplicateAction === 'merge' ? 'bg-[#F74A05] hover:bg-[#F74A05]/90' : ''}
                    onClick={() => setDuplicateAction('merge')}
                  >
                    <Merge className="h-4 w-4 mr-2" />
                    Merge with Selected
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Step 3: O*NET Matching */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground">
                  Select an O*NET profile to enrich the role with standardized skills and tasks.
                </p>
              </div>

              {/* Manual Search */}
              <div className="flex gap-2">
                <Input
                  placeholder="Search O*NET profiles..."
                  value={manualOnetSearch}
                  onChange={(e) => setManualOnetSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      searchOnet(manualOnetSearch);
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => searchOnet(manualOnetSearch)}
                  disabled={onetSearching}
                >
                  {onetSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Results */}
              {onetSearchResults.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {onetSearchResults.map((profile) => (
                    <SmartProfileCard
                      key={profile.onet_code}
                      title={profile.title}
                      matchPercentage={Math.round(profile.confidence * 100)}
                      alternativeTitles={profile.alternate_titles || []}
                      isSelected={selectedOnetCode === profile.onet_code}
                      onPreview={() => setSelectedOnetCode(profile.onet_code)}
                      onSelect={() => setSelectedOnetCode(profile.onet_code)}
                      showSelectButton={true}
                      isApplied={selectedOnetCode === profile.onet_code}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {entityDetails?.onet_suggestions?.length === 0 ? (
                    <>
                      <p>No O*NET suggestions available.</p>
                      <p className="mt-1">Try searching manually above.</p>
                    </>
                  ) : onetSearching ? (
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  ) : (
                    <p>Search for O*NET profiles to enrich this role.</p>
                  )}
                </div>
              )}

              {/* Skip option */}
              <div className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedOnetCode(null)}
                  className="text-muted-foreground"
                >
                  Skip O*NET matching
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground">
                  Review the final details before {duplicateAction === 'merge' ? 'merging' : 'creating'} the role.
                </p>
              </div>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Role Name</p>
                      <p className="font-semibold text-lg">{editedData.role_name}</p>
                    </div>
                    <Badge className="bg-[#F74A05]">
                      {duplicateAction === 'merge' ? 'Merging' : 'Creating New'}
                    </Badge>
                  </div>

                  {editedData.department && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Department</p>
                      <p>{editedData.department}</p>
                    </div>
                  )}

                  {selectedOnetCode && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">O*NET Profile</p>
                      <p>
                        {onetSearchResults.find(p => p.onet_code === selectedOnetCode)?.title || selectedOnetCode}
                      </p>
                    </div>
                  )}

                  {duplicateAction === 'merge' && selectedDuplicate && (
                    <div className="border-t pt-3 mt-3">
                      <p className="text-xs text-muted-foreground uppercase">Merging With</p>
                      <p className="font-medium">
                        {potentialDuplicates.find(d => d.role_id === selectedDuplicate)?.role_name}
                      </p>
                    </div>
                  )}

                  <div className="border-t pt-3">
                    <p className="text-xs text-muted-foreground uppercase">Source Lineage</p>
                    <p className="text-sm">
                      {entityDetails?.source_file?.file_name || 'Unknown source'}
                      {entityDetails?.source_chunk?.title && ` → ${entityDetails.source_chunk.title}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </ScrollArea>

        <Separator />

        {/* Footer */}
        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            {currentStep < STEPS.length ? (
              <Button onClick={handleNext} className="bg-[#F74A05] hover:bg-[#F74A05]/90">
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                disabled={creating}
                className="bg-[#F74A05] hover:bg-[#F74A05]/90"
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
