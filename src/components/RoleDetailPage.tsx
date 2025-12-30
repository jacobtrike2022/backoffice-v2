import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import {
  ArrowLeft,
  Search,
  Save,
  MoreVertical,
  Loader2,
  ClipboardList,
  Wrench,
  BookOpen,
  Plus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { rolesApi } from '../lib/api/roles';
import { cn } from './ui/utils';
import {
  onetLocal,
  type SmartProfileMatch,
  type ProfileDetails,
  type MergedTask,
  type MergedSkill,
  type MergedKnowledge,
} from '../lib/api/onet-local';
import { getCurrentUserOrgId } from '../lib/supabase';
import type { Role, UpdateRoleInput } from '../types/roles';
import { SmartProfileCard } from './SmartProfileCard';
import { ProfilePreviewDrawer } from './ProfilePreviewDrawer';
import { CompetencyItem } from './CompetencyItem';
import { AddCompetencyModal } from './AddCompetencyModal';
import { EditCompetencyModal } from './EditCompetencyModal';
import { CardHeader, CardTitle, CardDescription } from './ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface RoleDetailPageProps {
  roleId: string | 'new';
  onBack: () => void;
}

export function RoleDetailPage({ roleId, onBack }: RoleDetailPageProps) {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileMatches, setProfileMatches] = useState<SmartProfileMatch[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<SmartProfileMatch | null>(null);
  const [isChangingProfile, setIsChangingProfile] = useState(false);
  const [profileDetails, setProfileDetails] = useState<ProfileDetails | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewProfile, setPreviewProfile] = useState<ProfileDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [mergedTasks, setMergedTasks] = useState<MergedTask[]>([]);
  const [mergedSkills, setMergedSkills] = useState<MergedSkill[]>([]);
  const [mergedKnowledge, setMergedKnowledge] = useState<MergedKnowledge[]>([]);
  const [loadingMerged, setLoadingMerged] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [showAddKnowledge, setShowAddKnowledge] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [showEditSkill, setShowEditSkill] = useState(false);
  const [showEditKnowledge, setShowEditKnowledge] = useState(false);
  const [editingTask, setEditingTask] = useState<MergedTask | null>(null);
  const [editingSkill, setEditingSkill] = useState<MergedSkill | null>(null);
  const [editingKnowledge, setEditingKnowledge] = useState<MergedKnowledge | null>(null);
  const renderDrawer = false; // disable overlay drawer; using inline preview instead

  const getImportanceColor = (importance: number) => {
    if (importance >= 75) return 'bg-red-100 text-red-800 border-red-300';
    if (importance >= 50) return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  };
  const [editingItem, setEditingItem] = useState<{
    type: 'task' | 'skill' | 'knowledge';
    item: MergedTask | MergedSkill | MergedKnowledge;
  } | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [excludedTasksExpanded, setExcludedTasksExpanded] = useState(false);
  const [excludedSkillsExpanded, setExcludedSkillsExpanded] = useState(false);
  const [excludedKnowledgeExpanded, setExcludedKnowledgeExpanded] = useState(false);
  const [isEditingCoreData, setIsEditingCoreData] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    display_name: string;
    description: string;
    department: string;
    job_family: string;
    flsa_status: 'exempt' | 'non_exempt' | null;
    is_manager: boolean;
    is_frontline: boolean;
    permission_level: number;
    job_description: string;
    job_description_source: 'manual' | 'hris' | 'uploaded';
    status: 'active' | 'inactive' | 'archived' | 'pending_review';
  }>({
    name: '',
    display_name: '',
    description: '',
    department: '',
    job_family: '',
    flsa_status: null,
    is_manager: false,
    is_frontline: true,
    permission_level: 1,
    job_description: '',
    job_description_source: 'manual',
    status: 'active',
  });

  // Load role data and organization ID
  useEffect(() => {
    if (roleId === 'new') {
      setLoading(false);
      setIsEditingCoreData(true);
      setRole(null);
    } else {
      loadRole();
    }
    loadOrganizationId();
  }, [roleId]);

  // Load merged data when role has onet_code
  useEffect(() => {
    if (role?.onet_code) {
      loadMergedData();
    }
  }, [role?.onet_code, roleId]);

  // Auto-search profiles when role name changes (only if no profile selected or changing profile)
  useEffect(() => {
    if (roleId === 'new' && formData.name && !selectedProfile) {
      const timer = setTimeout(() => {
        searchProfiles(formData.name);
      }, 500); // Debounce 500ms

      return () => clearTimeout(timer);
    } else if (role?.name && (!role.onet_code || isChangingProfile)) {
      const timer = setTimeout(() => {
        searchProfiles(role.name);
      }, 500); // Debounce 500ms

      return () => clearTimeout(timer);
    }
  }, [role?.name, formData.name, roleId, selectedProfile, isChangingProfile, role?.onet_code]);

  // Load profile details when a profile is selected (for preview only)
  useEffect(() => {
    if (selectedProfile && !role?.onet_code) {
      loadProfileDetails(selectedProfile.onet_code);
    }
  }, [selectedProfile]);

  // Load form data when role is loaded or when creating new
  useEffect(() => {
    if (roleId === 'new') {
      // Reset form for new role
      setFormData({
        name: '',
        display_name: '',
        description: '',
        department: '',
        job_family: '',
        flsa_status: null,
        is_manager: false,
        is_frontline: true,
        permission_level: 1,
        job_description: '',
        job_description_source: 'manual',
        status: 'active',
      });
      setIsEditingCoreData(true);
    } else if (role) {
      // Populate form data from loaded role
      setFormData({
        name: role.name || '',
        display_name: role.display_name || '',
        description: role.description || '',
        department: role.department || '',
        job_family: role.job_family || '',
        flsa_status: role.flsa_status ?? null,
        is_manager: role.is_manager || false,
        is_frontline: role.is_frontline ?? true,
        permission_level: role.permission_level || 1,
        job_description: role.job_description || '',
        job_description_source: role.job_description_source || 'manual',
        status: role.status,
      });
      setEditedName(role.name || '');
    }
  }, [role, roleId]);


  async function loadOrganizationId() {
    const orgId = await getCurrentUserOrgId();
    setOrganizationId(orgId);
  }

  async function loadRole() {
    try {
      setLoading(true);
      const data = await rolesApi.get(roleId);
      setRole(data);
      setEditedName(data.name);
      setIsChangingProfile(false);
      
      // If role already has an onet_code, find matching profile
      if (data.onet_code) {
        const details = await onetLocal.getProfileDetails(data.onet_code);
        if (details) {
          setSelectedProfile({
            onet_code: data.onet_code,
            title: details.title,
            also_called: details.also_called || [],
            description: details.description || '',
            match_percentage: data.onet_match_confidence ?? 0,
          });
        } else {
          // fallback to search-based match
          const matches = await onetLocal.searchProfiles(data.name || '', 4);
          const match = matches.find((m) => m.onet_code === data.onet_code);
          if (match) {
            setSelectedProfile(match);
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading role:', error);
      toast.error('Failed to load role', {
        description: error.message || 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadMergedData() {
    if (!roleId) return;
    
    try {
      setLoadingMerged(true);
      const [tasks, skills, knowledge] = await Promise.all([
        onetLocal.getRoleTasks(roleId),
        onetLocal.getRoleSkills(roleId),
        onetLocal.getRoleKnowledge(roleId),
      ]);
      setMergedTasks(tasks);
      setMergedSkills(skills);
      setMergedKnowledge(knowledge);
    } catch (error: any) {
      console.error('Error loading merged data:', error);
      toast.error('Failed to load role competencies', {
        description: error.message || 'An unexpected error occurred',
      });
    } finally {
      setLoadingMerged(false);
    }
  }

  async function searchProfiles(term: string) {
    if (!term || term.trim().length === 0) {
      setProfileMatches([]);
      return;
    }

    try {
      setIsSearching(true);
      const matches = await onetLocal.searchProfiles(term, 4);
      setProfileMatches(matches);
    } catch (error: any) {
      console.error('Error searching profiles:', error);
      toast.error('Failed to search profiles', {
        description: error.message || 'An unexpected error occurred',
      });
    } finally {
      setIsSearching(false);
    }
  }

  async function loadProfileDetails(onetCode: string): Promise<ProfileDetails | null> {
    try {
      const details = await onetLocal.getProfileDetails(onetCode);
      setProfileDetails(details);
      return details;
    } catch (error: any) {
      console.error('Error loading profile details:', error);
      toast.error('Failed to load profile details', {
        description: error.message || 'An unexpected error occurred',
      });
      return null;
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      
      if (roleId === 'new') {
        // Create new role
        const newRole = await rolesApi.create({
          name: formData.name,
          display_name: formData.display_name,
          description: formData.description,
          department: formData.department,
          job_family: formData.job_family,
        flsa_status: formData.flsa_status,
          is_manager: formData.is_manager,
          is_frontline: formData.is_frontline,
          permission_level: formData.permission_level,
          job_description: formData.job_description,
          job_description_source: formData.job_description_source,
        });
        
        toast.success('Role created successfully');
        // Set the role and exit edit mode, then trigger profile search
        setRole(newRole);
        setIsEditingCoreData(false);
        // If a profile was selected before creation, apply it now
        if (selectedProfile) {
          await onetLocal.applyProfileToRole(newRole.id, selectedProfile.onet_code);
          setRole({ ...newRole, onet_code: selectedProfile.onet_code });
          await loadMergedData();
        }
        // Trigger profile search based on role name
        if (newRole.name) {
          searchProfiles(newRole.name);
        }
        // Update the URL to reflect the new role ID (but stay on same page)
        // The parent component should handle navigation if needed
        return;
      }

      if (!role) return;

      const updates: UpdateRoleInput & { onet_code?: string; onet_match_confidence?: number } = {
        id: role.id,
        name: isEditingCoreData ? formData.name : editedName,
        ...(isEditingCoreData ? {
          display_name: formData.display_name,
          description: formData.description,
          department: formData.department,
          job_family: formData.job_family,
        flsa_status: formData.flsa_status,
          is_manager: formData.is_manager,
          is_frontline: formData.is_frontline,
          permission_level: formData.permission_level,
          job_description: formData.job_description,
          job_description_source: formData.job_description_source,
          status: formData.status,
        } : {}),
      };

      // If a profile is selected, update onet_code and match_confidence
      if (selectedProfile) {
        updates.onet_code = selectedProfile.onet_code;
        updates.onet_match_confidence = selectedProfile.match_percentage;
      }

      await rolesApi.update(updates);
      await loadRole();
      setIsEditingCoreData(false);
      toast.success('Role updated successfully');
    } catch (error: any) {
      console.error('Error saving role:', error);
      toast.error('Failed to save role', {
        description: error.message || 'An unexpected error occurred',
      });
      throw error;
    } finally {
      setSaving(false);
    }
  }

  function handlePermissionLevelChange(value: string) {
    const level = parseInt(value);
    setFormData({ ...formData, permission_level: level });

    // Auto-check is_manager if level >= 3
    if (level >= 3 && !formData.is_manager) {
      setFormData({ ...formData, permission_level: level, is_manager: true });
    }
  }

  function handleIsManagerChange(checked: boolean) {
    setFormData({ ...formData, is_manager: checked });
    // If checking is_manager, ensure permission_level >= 3
    if (checked && formData.permission_level < 3) {
      setFormData({
        ...formData,
        is_manager: checked,
        permission_level: 3,
      });
    }
  }

  async function handleDelete() {
    if (!role) return;

    try {
      await rolesApi.delete(role.id);
      toast.success('Role archived successfully');
      onBack();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      toast.error('Failed to archive role', {
        description: error.message || 'An unexpected error occurred',
      });
    }
  }

  async function handlePreviewProfile(match: SmartProfileMatch) {
    try {
      // Open drawer first with loading state
      setIsPreviewOpen(true);
      // Then load the details
      const details = await loadProfileDetails(match.onet_code);
      if (details) {
        setPreviewProfile(details);
      } else {
        toast.error('Failed to load profile details');
        setIsPreviewOpen(false);
      }
    } catch (error) {
      console.error('Error loading profile details for preview:', error);
      toast.error('Failed to load profile details');
      setIsPreviewOpen(false);
    }
  }

  async function handleSelectProfile(match: SmartProfileMatch) {
    if ((!role && roleId !== 'new') || !organizationId) return;
    
    try {
      if (roleId === 'new') {
        // For new roles, just set the selected profile - will be saved when role is created
        setSelectedProfile(match);
        setIsChangingProfile(false); // Hide suggestions after selection
        toast.success('Profile selected. Create the role to apply it.');
      } else if (role) {
        // Apply profile to existing role
        await onetLocal.applyProfileToRole(role.id, match.onet_code);
        
        // Update role state
        setRole({ ...role, onet_code: match.onet_code });
        setSelectedProfile(match);
        setIsChangingProfile(false); // Hide suggestions after selection
        
        // Load merged data
        await loadMergedData();
        
        toast.success('Profile applied successfully');
      }
    } catch (error: any) {
      console.error('Error applying profile:', error);
      toast.error('Failed to apply profile', {
        description: error.message || 'An unexpected error occurred',
      });
    }
  }

  async function handleToggleTask(task: MergedTask) {
    if (!role || !organizationId) return;
    
    try {
      if (task.is_active) {
        await onetLocal.excludeTask(role.id, organizationId, task.task_id);
      } else {
        await onetLocal.includeTask(role.id, task.task_id);
      }
      await loadMergedData();
    } catch (error: any) {
      console.error('Error toggling task:', error);
      toast.error('Failed to update task', {
        description: error.message || 'An unexpected error occurred',
      });
    }
  }

  async function handleToggleSkill(skill: MergedSkill) {
    if (!role || !organizationId) return;
    
    try {
      if (skill.is_active) {
        await onetLocal.excludeSkill(role.id, organizationId, skill.skill_id);
      } else {
        await onetLocal.includeSkill(role.id, skill.skill_id);
      }
      await loadMergedData();
    } catch (error: any) {
      console.error('Error toggling skill:', error);
      toast.error('Failed to update skill', {
        description: error.message || 'An unexpected error occurred',
      });
    }
  }

  async function handleToggleKnowledge(knowledge: MergedKnowledge) {
    if (!role || !organizationId) return;
    
    try {
      if (knowledge.is_active) {
        await onetLocal.excludeKnowledge(role.id, organizationId, knowledge.knowledge_id);
      } else {
        await onetLocal.includeKnowledge(role.id, knowledge.knowledge_id);
      }
      await loadMergedData();
    } catch (error: any) {
      console.error('Error toggling knowledge:', error);
      toast.error('Failed to update knowledge', {
        description: error.message || 'An unexpected error occurred',
      });
    }
  }

  async function handleAddTask(description: string, importance?: number) {
    if (!role || !organizationId) return;
    
    try {
      await onetLocal.addCustomTask(role.id, organizationId, description, importance);
      await loadMergedData();
      toast.success('Custom task added');
    } catch (error: any) {
      console.error('Error adding task:', error);
      toast.error('Failed to add task', {
        description: error.message || 'An unexpected error occurred',
      });
      throw error;
    }
  }

  async function handleAddSkill(name: string, description?: string, importance?: number) {
    if (!role || !organizationId) return;
    
    try {
      await onetLocal.addCustomSkill(role.id, organizationId, name, description, importance);
      await loadMergedData();
      toast.success('Custom skill added');
    } catch (error: any) {
      console.error('Error adding skill:', error);
      toast.error('Failed to add skill', {
        description: error.message || 'An unexpected error occurred',
      });
      throw error;
    }
  }

  async function handleAddKnowledge(name: string, description?: string, importance?: number) {
    if (!role || !organizationId) return;
    
    try {
      await onetLocal.addCustomKnowledge(role.id, organizationId, name, description, importance);
      await loadMergedData();
      toast.success('Custom knowledge area added');
    } catch (error: any) {
      console.error('Error adding knowledge:', error);
      toast.error('Failed to add knowledge', {
        description: error.message || 'An unexpected error occurred',
      });
      throw error;
    }
  }

  async function handleEditTask(task: MergedTask, customDescription: string, notes?: string) {
    if (!role || !organizationId) return;
    
    try {
      if (task.source === 'custom') {
        // For custom tasks, we'd need a different update function
        // For now, just modify it
        await onetLocal.modifyTask(role.id, organizationId, task.task_id, customDescription, notes);
      } else {
        await onetLocal.modifyTask(role.id, organizationId, task.task_id, customDescription, notes);
      }
      await loadMergedData();
      toast.success('Task updated');
    } catch (error: any) {
      console.error('Error editing task:', error);
      toast.error('Failed to update task', {
        description: error.message || 'An unexpected error occurred',
      });
      throw error;
    }
  }

  async function handleEditSkill(skill: MergedSkill, customName: string, customDescription?: string, notes?: string) {
    if (!role || !organizationId) return;
    
    try {
      await onetLocal.modifySkill(role.id, organizationId, skill.skill_id, customName, customDescription, notes);
      await loadMergedData();
      toast.success('Skill updated');
    } catch (error: any) {
      console.error('Error editing skill:', error);
      toast.error('Failed to update skill', {
        description: error.message || 'An unexpected error occurred',
      });
      throw error;
    }
  }

  async function handleEditKnowledge(knowledge: MergedKnowledge, customName: string, customDescription?: string, notes?: string) {
    if (!role || !organizationId) return;
    
    try {
      await onetLocal.modifyKnowledge(role.id, organizationId, knowledge.knowledge_id, customName, customDescription, notes);
      await loadMergedData();
      toast.success('Knowledge area updated');
    } catch (error: any) {
      console.error('Error editing knowledge:', error);
      toast.error('Failed to update knowledge', {
        description: error.message || 'An unexpected error occurred',
      });
      throw error;
    }
  }

  async function handleDeleteTask(customizationId: string) {
    try {
      await onetLocal.deleteCustomTask(customizationId);
      await loadMergedData();
      toast.success('Task deleted');
    } catch (error: any) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task', {
        description: error.message || 'An unexpected error occurred',
      });
    }
  }

  async function handleDeleteSkill(customizationId: string) {
    try {
      await onetLocal.deleteCustomSkill(customizationId);
      await loadMergedData();
      toast.success('Skill deleted');
    } catch (error: any) {
      console.error('Error deleting skill:', error);
      toast.error('Failed to delete skill', {
        description: error.message || 'An unexpected error occurred',
      });
    }
  }

  async function handleDeleteKnowledge(customizationId: string) {
    try {
      await onetLocal.deleteCustomKnowledge(customizationId);
      await loadMergedData();
      toast.success('Knowledge area deleted');
    } catch (error: any) {
      console.error('Error deleting knowledge:', error);
      toast.error('Failed to delete knowledge', {
        description: error.message || 'An unexpected error occurred',
      });
    }
  }

  async function handleRevertTask(customizationId: string) {
    try {
      await onetLocal.revertTaskModification(customizationId);
      await loadMergedData();
      toast.success('Task reverted to standard');
    } catch (error: any) {
      console.error('Error reverting task:', error);
      toast.error('Failed to revert task', {
        description: error.message || 'An unexpected error occurred',
      });
    }
  }

  async function handleRevertSkill(customizationId: string) {
    try {
      await onetLocal.revertSkillModification(customizationId);
      await loadMergedData();
      toast.success('Skill reverted to standard');
    } catch (error: any) {
      console.error('Error reverting skill:', error);
      toast.error('Failed to revert skill', {
        description: error.message || 'An unexpected error occurred',
      });
    }
  }

  async function handleRevertKnowledge(customizationId: string) {
    try {
      await onetLocal.revertKnowledgeModification(customizationId);
      await loadMergedData();
      toast.success('Knowledge area reverted to standard');
    } catch (error: any) {
      console.error('Error reverting knowledge:', error);
      toast.error('Failed to revert knowledge', {
        description: error.message || 'An unexpected error occurred',
      });
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'archived':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'pending_review':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function getPermissionLevelLabel(level: number): string {
    switch (level) {
      case 1:
        return 'Basic Employee';
      case 2:
        return 'Team Lead';
      case 3:
        return 'Manager';
      case 4:
        return 'District/Regional Manager';
      case 5:
        return 'Corporate/Executive';
      default:
        return 'Unknown';
    }
  }

  function getFlsaStatusLabel(value: 'exempt' | 'non_exempt' | null | undefined) {
    if (value === 'non_exempt') return 'Hourly';
    if (value === 'exempt') return 'Salary';
    return 'Not Set';
  }

  if (loading && roleId !== 'new') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!role && roleId !== 'new') {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Role not found</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Roles
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Roles
          </Button>
          <Separator orientation="vertical" className="h-6" />
          {roleId === 'new' ? (
            <h1 className="text-2xl font-semibold">Create New Role</h1>
          ) : isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsEditingName(false);
                  }
                  if (e.key === 'Escape') {
                    setEditedName(role!.name);
                    setIsEditingName(false);
                  }
                }}
                className="w-64"
                autoFocus
              />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{role!.name}</h1>
              {role && (
                <Badge className={`${getStatusColor(role.status)} border text-xs px-2 py-0.5`}>
                  {role.status.charAt(0).toUpperCase() + role.status.slice(1).replace('_', ' ')}
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save
              </>
            )}
          </Button>
          {roleId !== 'new' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditingCoreData(true)}>
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>
                  Archive Role
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Role Info / Edit Form */}
      {(isEditingCoreData || roleId === 'new') ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>{roleId === 'new' ? 'Create Role' : 'Edit Role Details'}</CardTitle>
            <CardDescription>
              {roleId === 'new' ? 'Enter core role information, then select a Smart Role Profile below' : 'Update core role information'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Basic Information</h3>
                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">
                      Role Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="edit-name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="e.g., Store Manager"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-display_name">Display Name (optional)</Label>
                    <Input
                      id="edit-display_name"
                      value={formData.display_name}
                      onChange={(e) =>
                        setFormData({ ...formData, display_name: e.target.value })
                      }
                      placeholder="Shorter version for display"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
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
                <h3 className="font-semibold text-sm">Classification</h3>
                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-department">Department</Label>
                    <Select
                      value={formData.department || undefined}
                      onValueChange={(value) =>
                        setFormData({ ...formData, department: value || '' })
                      }
                    >
                      <SelectTrigger id="edit-department">
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
                    <Label htmlFor="edit-job_family">Job Family</Label>
                    <Select
                      value={formData.job_family || undefined}
                      onValueChange={(value) =>
                        setFormData({ ...formData, job_family: value || '' })
                      }
                    >
                      <SelectTrigger id="edit-job_family">
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
                      id="edit-is_manager"
                      checked={formData.is_manager}
                      onCheckedChange={(checked) =>
                        handleIsManagerChange(checked === true)
                      }
                    />
                    <Label htmlFor="edit-is_manager" className="cursor-pointer">
                      Manager Role
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="edit-is_frontline"
                      checked={formData.is_frontline}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          is_frontline: checked === true,
                        })
                      }
                    />
                    <Label htmlFor="edit-is_frontline" className="cursor-pointer">
                      Frontline
                    </Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-permission_level">Permission Level</Label>
                  <Select
                    value={formData.permission_level.toString()}
                    onValueChange={handlePermissionLevelChange}
                  >
                    <SelectTrigger id="edit-permission_level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Basic Employee</SelectItem>
                      <SelectItem value="2">2 - Team Lead</SelectItem>
                      <SelectItem value="3">3 - Manager</SelectItem>
                      <SelectItem value="4">4 - District/Regional Manager</SelectItem>
                      <SelectItem value="5">5 - Corporate/Executive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-flsa_status">FLSA Status</Label>
                  <Select
                    value={formData.flsa_status ?? 'not_set'}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        flsa_status: value === 'not_set' ? null : (value as 'exempt' | 'non_exempt'),
                      })
                    }
                  >
                    <SelectTrigger id="edit-flsa_status">
                      <SelectValue placeholder="Select FLSA status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_set">Not Set</SelectItem>
                      <SelectItem value="non_exempt">Hourly</SelectItem>
                      <SelectItem value="exempt">Salary</SelectItem>
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
                  Advanced
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 mt-4">
                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="edit-job_description">Job Description</Label>
                    <Textarea
                      id="edit-job_description"
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
                      <Label>Job Description Source</Label>
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
                          <RadioGroupItem value="manual" id="edit-source-manual" />
                          <Label htmlFor="edit-source-manual" className="cursor-pointer">
                            Manual
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="hris" id="edit-source-hris" />
                          <Label htmlFor="edit-source-hris" className="cursor-pointer">
                            HRIS
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="uploaded" id="edit-source-uploaded" />
                          <Label htmlFor="edit-source-uploaded" className="cursor-pointer">
                            Uploaded
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Status (only for existing roles) */}
              {roleId !== 'new' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger id="edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="pending_review">Pending Review</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (roleId === 'new') {
                      onBack();
                    } else {
                      setIsEditingCoreData(false);
                      // Reset form data to current role values
                      if (role) {
                        setFormData({
                          name: role.name || '',
                          display_name: role.display_name || '',
                          description: role.description || '',
                          department: role.department || '',
                          job_family: role.job_family || '',
                        flsa_status: role.flsa_status ?? null,
                          is_manager: role.is_manager || false,
                          is_frontline: role.is_frontline ?? true,
                          permission_level: role.permission_level || 1,
                          job_description: role.job_description || '',
                          job_description_source: role.job_description_source || 'manual',
                          status: role.status,
                        });
                      }
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
                >
                  {saving ? (roleId === 'new' ? 'Creating...' : 'Saving...') : (roleId === 'new' ? 'Create Role' : 'Save Changes')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Role Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Role Name</Label>
                    <div className="text-sm font-medium">{role?.name || '—'}</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Display Name</Label>
                    <div className="text-sm font-medium">{role?.display_name || '—'}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Description</Label>
                  <div className="text-sm text-muted-foreground">{role?.description || '—'}</div>
                </div>
              </div>

              <div className="space-y-3">
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Department</Label>
                    <div className="text-sm font-medium">{role?.department || '—'}</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Job Family</Label>
                    <div className="text-sm font-medium">{role?.job_family || '—'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Manager Role</Label>
                    <div className="text-sm font-medium">{role?.is_manager ? 'Yes' : 'No'}</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Frontline</Label>
                    <div className="text-sm font-medium">{role?.is_frontline ? 'Yes' : 'No'}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Permission Level</Label>
                  <div className="text-sm font-medium">
                    {role?.permission_level ? `${role.permission_level} - ${getPermissionLevelLabel(role.permission_level)}` : '—'}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">FLSA Status</Label>
                  <div className="text-sm font-medium">
                    {getFlsaStatusLabel(role?.flsa_status)}
                  </div>
                </div>
              </div>

              {/* Advanced Section */}
              {role?.job_description && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold hover:text-foreground">
                    <ChevronDown className="w-4 h-4" />
                    Advanced
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 mt-4">
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Job Description</Label>
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap">{role.job_description}</div>
                    </div>
                    {role.job_description_source && (
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Job Description Source</Label>
                        <div className="text-sm font-medium capitalize">{role.job_description_source}</div>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}

            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Smart Role Profiles Section - Only show if role exists or is being created */}
      {(role || roleId === 'new') && (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Smart Role Profiles</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {role?.onet_code && !isChangingProfile
                ? 'Current role profile match'
                : 'Automatically matched profiles based on role name'}
            </p>
          </div>
          {role?.onet_code && !isChangingProfile ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsChangingProfile(true);
                // Re-search to show suggestions
                if (role?.name) {
                  searchProfiles(role.name);
                }
              }}
            >
              <Search className="w-4 h-4 mr-2" />
              Change Profile
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search profiles..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  const timer = setTimeout(() => {
                    if (e.target.value.trim()) {
                      searchProfiles(e.target.value);
                    } else if (role?.name || formData.name) {
                      searchProfiles(role?.name || formData.name);
                    }
                  }, 500);
                  return () => clearTimeout(timer);
                }}
                className="w-64"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (searchTerm.trim()) {
                    searchProfiles(searchTerm);
                  } else if (role?.name || formData.name) {
                    searchProfiles(role?.name || formData.name);
                  }
                }}
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Show selected profile (centered) when profile is selected and not changing */}
        {role?.onet_code && selectedProfile && !isChangingProfile ? (
          <div className="w-full px-3 md:px-4">
            <SmartProfileCard
              title={selectedProfile.title}
              matchPercentage={selectedProfile.match_percentage}
              alternativeTitles={selectedProfile.also_called}
              isSelected={true}
              showSelectButton={true}
              isApplied={role?.onet_code === selectedProfile.onet_code}
              onPreview={() => {
                // Always allow preview, even if applied
                handlePreviewProfile(selectedProfile);
              }}
              onSelect={async () => {
                // If already applied, just open preview instead
                if (role && role.onet_code === selectedProfile.onet_code) {
                  handlePreviewProfile(selectedProfile);
                  return;
                }
                // Apply the profile (auto-save)
                await handleSelectProfile(selectedProfile);
              }}
            />
          </div>
        ) : (
          /* Profile Cards Grid - Show when searching or changing profile */
          <>
            {isSearching ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4 space-y-3">
                      <div className="h-6 bg-muted rounded w-20" />
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-8 bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : profileMatches.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    No matching profiles found. Try a different search term.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
                {profileMatches.map((match) => (
                  <SmartProfileCard
                    key={match.onet_code}
                    title={match.title}
                    matchPercentage={match.match_percentage}
                    alternativeTitles={match.also_called}
                    isSelected={selectedProfile?.onet_code === match.onet_code}
                    onPreview={() => handlePreviewProfile(match)}
                    onSelect={() => {
                      // Don't auto-apply - just open preview
                      handlePreviewProfile(match);
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      )}

      {/* Inline Profile Preview Panel (replaces drawer) */}
      {previewProfile && (
        <Card className="border-primary/20 shadow-sm">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{previewProfile.title}</CardTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    Code: {previewProfile.onet_code || 'N/A'}
                  </Badge>
                  {previewProfile.job_zone && (
                    <Badge variant="outline" className="text-xs">
                      Job Zone {previewProfile.job_zone}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsPreviewOpen(false);
                    setPreviewProfile(null);
                  }}
                >
                  Close
                </Button>
                <Button
                  className={cn(
                    'bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white border-0'
                  )}
                  onClick={async () => {
                    if (previewProfile) {
                      const match = profileMatches.find(
                        (m) => m.onet_code === previewProfile.onet_code
                      );
                      if (match) {
                        if (role?.onet_code === match.onet_code) {
                          setIsPreviewOpen(false);
                          setPreviewProfile(null);
                          return;
                        }
                        await handleSelectProfile(match);
                        setIsPreviewOpen(false);
                        setPreviewProfile(null);
                      }
                    }
                  }}
                >
                  {role?.onet_code === previewProfile.onet_code
                    ? 'Profile Applied'
                    : 'Apply Profile'}
                </Button>
              </div>
            </div>
            {previewProfile.description && (
              <CardDescription className="mt-2">
                {previewProfile.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Alternative Titles */}
            {previewProfile.also_called && previewProfile.also_called.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-2">Also known as</h3>
                <div className="flex flex-wrap gap-2">
                  {previewProfile.also_called.map((title, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {title}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Tasks */}
            {previewProfile.tasks && previewProfile.tasks.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-3">
                  Key Tasks ({previewProfile.tasks.length})
                </h3>
                <ul className="space-y-2">
                  {previewProfile.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="text-sm text-muted-foreground flex items-start gap-2"
                    >
                      <span className="text-[#F64A05] mt-0.5">•</span>
                      <span>{task.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            {/* Skills */}
            {previewProfile.skills && previewProfile.skills.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-3">
                  Required Skills ({previewProfile.skills.length})
                </h3>
                <div className="space-y-2">
                  {previewProfile.skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{skill.name}</p>
                        {skill.category && (
                          <p className="text-xs text-muted-foreground">
                            {skill.category}
                          </p>
                        )}
                      </div>
                      <Badge
                        className={cn(
                          'text-xs',
                          getImportanceColor(skill.importance)
                        )}
                      >
                        {Math.round(skill.importance)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Knowledge */}
            {previewProfile.knowledge && previewProfile.knowledge.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-3">
                  Required Knowledge ({previewProfile.knowledge.length})
                </h3>
                <div className="space-y-2">
                  {previewProfile.knowledge.map((know) => (
                    <div
                      key={know.id}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{know.name}</p>
                        {know.category && (
                          <p className="text-xs text-muted-foreground">
                            {know.category}
                          </p>
                        )}
                      </div>
                      <Badge
                        className={cn(
                          'text-xs',
                          getImportanceColor(know.importance)
                        )}
                      >
                        {Math.round(know.importance)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Role Competencies Section - Shows when profile is applied */}
      {role && role.onet_code && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Role Competencies
                  {loadingMerged && <Loader2 className="h-4 w-4 animate-spin" />}
                </CardTitle>
                <CardDescription>
                  Customize which tasks, skills, and knowledge apply to this role
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {role.onet_code}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="tasks">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="tasks" className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Tasks ({mergedTasks.filter(t => t.is_active).length}/{mergedTasks.length})
                </TabsTrigger>
                <TabsTrigger value="skills" className="flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Skills ({mergedSkills.filter(s => s.is_active).length}/{mergedSkills.length})
                </TabsTrigger>
                <TabsTrigger value="knowledge" className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Knowledge ({mergedKnowledge.filter(k => k.is_active).length}/{mergedKnowledge.length})
                </TabsTrigger>
              </TabsList>

              {/* Tasks Tab */}
              <TabsContent value="tasks" className="mt-4">
                <div className="space-y-2">
                  {mergedTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No tasks defined for this profile
                    </p>
                  ) : (
                    <>
                      {/* Active Tasks */}
                      {[...mergedTasks]
                        .filter(task => task.is_active)
                        .sort((a, b) => {
                          // Calculate weighted priority for both tasks
                          const priorityA = a.importance && a.relevance
                            ? ((a.importance * a.relevance / 100) / 5) * 100
                            : 0;
                          const priorityB = b.importance && b.relevance
                            ? ((b.importance * b.relevance / 100) / 5) * 100
                            : 0;
                          // Sort in descending order (highest priority first)
                          return priorityB - priorityA;
                        })
                        .map(task => (
                          <CompetencyItem
                            key={task.task_id}
                            id={task.task_id}
                            description={task.description}
                            source={task.source}
                            isActive={task.is_active}
                            dwas={task.dwas}
                            weightedPriority={
                              task.importance && task.relevance
                                ? ((task.importance * task.relevance / 100) / 5) * 100
                                : undefined
                            }
                            onToggle={() => handleToggleTask(task)}
                            onEdit={() => {
                              setEditingTask(task);
                              setEditingItem({ type: 'task', item: task });
                            }}
                            onDelete={
                              task.source === 'custom' && task.customization_id
                                ? () => handleDeleteTask(task.customization_id!)
                                : undefined
                            }
                            onRevert={
                              task.source === 'modified' && task.customization_id
                                ? () => handleRevertTask(task.customization_id!)
                                : undefined
                            }
                          />
                        ))}
                      
                      {/* Excluded Tasks Section */}
                      {mergedTasks.filter(task => !task.is_active).length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between text-muted-foreground hover:text-foreground"
                            onClick={() => setExcludedTasksExpanded(!excludedTasksExpanded)}
                          >
                            <span className="flex items-center gap-2">
                              {excludedTasksExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <span>Excluded Tasks ({mergedTasks.filter(task => !task.is_active).length})</span>
                            </span>
                          </Button>
                          {excludedTasksExpanded && (
                            <div className="mt-2 space-y-2">
                              {mergedTasks
                                .filter(task => !task.is_active)
                                .map(task => (
                                  <CompetencyItem
                                    key={task.task_id}
                                    id={task.task_id}
                                    description={task.description}
                                    source={task.source}
                                    isActive={task.is_active}
                                    dwas={task.dwas}
                                    weightedPriority={
                                      task.importance && task.relevance
                                        ? ((task.importance * task.relevance / 100) / 5) * 100
                                        : undefined
                                    }
                                    onToggle={() => handleToggleTask(task)}
                                    onEdit={() => {
                                      setEditingTask(task);
                                      setEditingItem({ type: 'task', item: task });
                                    }}
                                    onDelete={
                                      task.source === 'custom' && task.customization_id
                                        ? () => handleDeleteTask(task.customization_id!)
                                        : undefined
                                    }
                                    onRevert={
                                      task.source === 'modified' && task.customization_id
                                        ? () => handleRevertTask(task.customization_id!)
                                        : undefined
                                    }
                                  />
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => setShowAddTask(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Custom Task
                  </Button>
                </div>
              </TabsContent>

              {/* Skills Tab */}
              <TabsContent value="skills" className="mt-4">
                <div className="space-y-2">
                  {mergedSkills.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No skills defined for this profile
                    </p>
                  ) : (
                    <>
                      {/* Active Skills */}
                      {mergedSkills
                        .filter(skill => skill.is_active)
                        .map(skill => (
                          <CompetencyItem
                            key={skill.skill_id}
                            id={skill.skill_id}
                            description={`${skill.skill_name}${skill.description ? `: ${skill.description}` : ''}`}
                            source={skill.source}
                            isActive={skill.is_active}
                            importance={skill.importance}
                            onToggle={() => handleToggleSkill(skill)}
                            onEdit={() => {
                              setEditingSkill(skill);
                              setEditingItem({ type: 'skill', item: skill });
                            }}
                            onDelete={
                              skill.source === 'custom' && skill.customization_id
                                ? () => handleDeleteSkill(skill.customization_id!)
                                : undefined
                            }
                            onRevert={
                              skill.source === 'modified' && skill.customization_id
                                ? () => handleRevertSkill(skill.customization_id!)
                                : undefined
                            }
                          />
                        ))}
                      
                      {/* Excluded Skills Section */}
                      {mergedSkills.filter(skill => !skill.is_active).length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between text-muted-foreground hover:text-foreground"
                            onClick={() => setExcludedSkillsExpanded(!excludedSkillsExpanded)}
                          >
                            <span className="flex items-center gap-2">
                              {excludedSkillsExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <span>Excluded Skills ({mergedSkills.filter(skill => !skill.is_active).length})</span>
                            </span>
                          </Button>
                          {excludedSkillsExpanded && (
                            <div className="mt-2 space-y-2">
                              {mergedSkills
                                .filter(skill => !skill.is_active)
                                .map(skill => (
                                  <CompetencyItem
                                    key={skill.skill_id}
                                    id={skill.skill_id}
                                    description={`${skill.skill_name}${skill.description ? `: ${skill.description}` : ''}`}
                                    source={skill.source}
                                    isActive={skill.is_active}
                                    importance={skill.importance}
                                    onToggle={() => handleToggleSkill(skill)}
                                    onEdit={() => {
                                      setEditingSkill(skill);
                                      setEditingItem({ type: 'skill', item: skill });
                                    }}
                                    onDelete={
                                      skill.source === 'custom' && skill.customization_id
                                        ? () => handleDeleteSkill(skill.customization_id!)
                                        : undefined
                                    }
                                    onRevert={
                                      skill.source === 'modified' && skill.customization_id
                                        ? () => handleRevertSkill(skill.customization_id!)
                                        : undefined
                                    }
                                  />
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => setShowAddSkill(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Custom Skill
                  </Button>
                </div>
              </TabsContent>

              {/* Knowledge Tab */}
              <TabsContent value="knowledge" className="mt-4">
                <div className="space-y-2">
                  {mergedKnowledge.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No knowledge areas defined for this profile
                    </p>
                  ) : (
                    <>
                      {/* Active Knowledge */}
                      {mergedKnowledge
                        .filter(know => know.is_active)
                        .map(know => (
                          <CompetencyItem
                            key={know.knowledge_id}
                            id={know.knowledge_id}
                            description={`${know.knowledge_name}${know.description ? `: ${know.description}` : ''}`}
                            source={know.source}
                            isActive={know.is_active}
                            importance={know.importance}
                            onToggle={() => handleToggleKnowledge(know)}
                            onEdit={() => {
                              setEditingKnowledge(know);
                              setEditingItem({ type: 'knowledge', item: know });
                            }}
                            onDelete={
                              know.source === 'custom' && know.customization_id
                                ? () => handleDeleteKnowledge(know.customization_id!)
                                : undefined
                            }
                            onRevert={
                              know.source === 'modified' && know.customization_id
                                ? () => handleRevertKnowledge(know.customization_id!)
                                : undefined
                            }
                          />
                        ))}
                      
                      {/* Excluded Knowledge Section */}
                      {mergedKnowledge.filter(know => !know.is_active).length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between text-muted-foreground hover:text-foreground"
                            onClick={() => setExcludedKnowledgeExpanded(!excludedKnowledgeExpanded)}
                          >
                            <span className="flex items-center gap-2">
                              {excludedKnowledgeExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <span>Excluded Knowledge ({mergedKnowledge.filter(know => !know.is_active).length})</span>
                            </span>
                          </Button>
                          {excludedKnowledgeExpanded && (
                            <div className="mt-2 space-y-2">
                              {mergedKnowledge
                                .filter(know => !know.is_active)
                                .map(know => (
                                  <CompetencyItem
                                    key={know.knowledge_id}
                                    id={know.knowledge_id}
                                    description={`${know.knowledge_name}${know.description ? `: ${know.description}` : ''}`}
                                    source={know.source}
                                    isActive={know.is_active}
                                    importance={know.importance}
                                    onToggle={() => handleToggleKnowledge(know)}
                                    onEdit={() => {
                                      setEditingKnowledge(know);
                                      setEditingItem({ type: 'knowledge', item: know });
                                    }}
                                    onDelete={
                                      know.source === 'custom' && know.customization_id
                                        ? () => handleDeleteKnowledge(know.customization_id!)
                                        : undefined
                                    }
                                    onRevert={
                                      know.source === 'modified' && know.customization_id
                                        ? () => handleRevertKnowledge(know.customization_id!)
                                        : undefined
                                    }
                                  />
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => setShowAddKnowledge(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Custom Knowledge
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {renderDrawer && (
        <ProfilePreviewDrawer
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setPreviewProfile(null);
          }}
          profile={previewProfile}
          isApplied={previewProfile ? role?.onet_code === previewProfile.onet_code : false}
          onSelect={async () => {
            if (previewProfile) {
              const match = profileMatches.find(
                (m) => m.onet_code === previewProfile.onet_code
              );
              if (match) {
                // If already applied, just close the drawer
                if (role?.onet_code === match.onet_code) {
                  setIsPreviewOpen(false);
                  setPreviewProfile(null);
                  return;
                }
                // Apply the profile and close the drawer
                await handleSelectProfile(match);
                setIsPreviewOpen(false);
                setPreviewProfile(null);
              }
            }
          }}
        />
      )}

      {/* Add Competency Modals */}
      <AddCompetencyModal
        isOpen={showAddTask}
        onClose={() => setShowAddTask(false)}
        onSave={handleAddTask}
        type="task"
      />
      <AddCompetencyModal
        isOpen={showAddSkill}
        onClose={() => setShowAddSkill(false)}
        onSave={(name, importance) => handleAddSkill(name, undefined, importance)}
        type="skill"
      />
      <AddCompetencyModal
        isOpen={showAddKnowledge}
        onClose={() => setShowAddKnowledge(false)}
        onSave={(name, importance) => handleAddKnowledge(name, undefined, importance)}
        type="knowledge"
      />

      {/* Edit Competency Modal */}
      {editingItem && (
        <EditCompetencyModal
          isOpen={!!editingItem}
          onClose={() => {
            setEditingItem(null);
            setEditingTask(null);
            setEditingSkill(null);
            setEditingKnowledge(null);
          }}
          onSave={async (customDescription, notes) => {
            if (editingItem.type === 'task') {
              await handleEditTask(editingItem.item as MergedTask, customDescription, notes);
            } else if (editingItem.type === 'skill') {
              const skill = editingItem.item as MergedSkill;
              await handleEditSkill(skill, customDescription, undefined, notes);
            } else {
              const knowledge = editingItem.item as MergedKnowledge;
              await handleEditKnowledge(knowledge, customDescription, undefined, notes);
            }
            setEditingItem(null);
            setEditingTask(null);
            setEditingSkill(null);
            setEditingKnowledge(null);
          }}
          onRevert={
            editingItem.item.customization_id
              ? async () => {
                  if (editingItem.type === 'task') {
                    await handleRevertTask(editingItem.item.customization_id!);
                  } else if (editingItem.type === 'skill') {
                    await handleRevertSkill(editingItem.item.customization_id!);
                  } else {
                    await handleRevertKnowledge(editingItem.item.customization_id!);
                  }
                  setEditingItem(null);
                  setEditingTask(null);
                  setEditingSkill(null);
                  setEditingKnowledge(null);
                }
              : undefined
          }
          originalDescription={
            editingItem.type === 'task'
              ? (editingItem.item as MergedTask).description
              : editingItem.type === 'skill'
              ? (editingItem.item as MergedSkill).skill_name
              : (editingItem.item as MergedKnowledge).knowledge_name
          }
          currentDescription={
            editingItem.type === 'task'
              ? (editingItem.item as MergedTask).description
              : editingItem.type === 'skill'
              ? (editingItem.item as MergedSkill).skill_name
              : (editingItem.item as MergedKnowledge).knowledge_name
          }
          type={editingItem.type}
          source={editingItem.item.source as 'standard' | 'modified' | 'custom'}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive "{role?.name}"? This will mark it as
              archived and hide it from active lists. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

