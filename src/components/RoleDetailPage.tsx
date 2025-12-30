import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import {
  ArrowLeft,
  Search,
  Save,
  MoreVertical,
  Edit2,
  Loader2,
  ClipboardList,
  Wrench,
  BookOpen,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { rolesApi } from '../lib/api/roles';
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
  roleId: string;
  onBack: () => void;
}

export function RoleDetailPage({ roleId, onBack }: RoleDetailPageProps) {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileMatches, setProfileMatches] = useState<SmartProfileMatch[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<SmartProfileMatch | null>(null);
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
  const [editingItem, setEditingItem] = useState<{
    type: 'task' | 'skill' | 'knowledge';
    item: MergedTask | MergedSkill | MergedKnowledge;
  } | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Load role data and organization ID
  useEffect(() => {
    loadRole();
    loadOrganizationId();
  }, [roleId]);

  // Load merged data when role has onet_code
  useEffect(() => {
    if (role?.onet_code) {
      loadMergedData();
    }
  }, [role?.onet_code, roleId]);

  // Auto-search profiles when role name changes
  useEffect(() => {
    if (role?.name) {
      const timer = setTimeout(() => {
        searchProfiles(role.name);
      }, 500); // Debounce 500ms

      return () => clearTimeout(timer);
    }
  }, [role?.name]);

  // Load profile details when a profile is selected (for preview only)
  useEffect(() => {
    if (selectedProfile && !role?.onet_code) {
      loadProfileDetails(selectedProfile.onet_code);
    }
  }, [selectedProfile]);

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
      
      // If role already has an onet_code, find matching profile
      if (data.onet_code) {
        const matches = await onetLocal.searchProfiles(data.name || '', 4);
        const match = matches.find((m) => m.onet_code === data.onet_code);
        if (match) {
          setSelectedProfile(match);
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

  async function loadProfileDetails(onetCode: string) {
    try {
      const details = await onetLocal.getProfileDetails(onetCode);
      setProfileDetails(details);
    } catch (error: any) {
      console.error('Error loading profile details:', error);
      toast.error('Failed to load profile details', {
        description: error.message || 'An unexpected error occurred',
      });
    }
  }

  async function handleSave() {
    if (!role) return;

    try {
      setSaving(true);
      const updates: UpdateRoleInput = {
        id: role.id,
        name: editedName,
      };

      // If a profile is selected, update onet_code and match_confidence
      if (selectedProfile) {
        updates.onet_code = selectedProfile.onet_code;
        updates.onet_match_confidence = selectedProfile.match_percentage;
      }

      await rolesApi.update(updates);
      await loadRole();
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

  function handlePreviewProfile(match: SmartProfileMatch) {
    loadProfileDetails(match.onet_code).then((details) => {
      if (details) {
        setPreviewProfile(details);
        setIsPreviewOpen(true);
      }
    });
  }

  async function handleSelectProfile(match: SmartProfileMatch) {
    if (!role || !organizationId) return;
    
    try {
      // Apply profile to role
      await onetLocal.applyProfileToRole(role.id, match.onet_code);
      
      // Update role state
      setRole({ ...role, onet_code: match.onet_code });
      setSelectedProfile(match);
      
      // Load merged data
      await loadMergedData();
      
      toast.success('Profile applied successfully');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!role) {
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
          {isEditingName ? (
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
                    setEditedName(role.name);
                    setIsEditingName(false);
                  }
                }}
                className="w-64"
                autoFocus
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{role.name}</h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingName(true)}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>
                Archive Role
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Role Info */}
      <div className="flex items-center gap-4 flex-wrap">
        {role.department && (
          <Badge variant="outline" className="text-sm">
            {role.department}
          </Badge>
        )}
        {role.job_family && (
          <Badge variant="outline" className="text-sm">
            {role.job_family}
          </Badge>
        )}
        <Badge className={`${getStatusColor(role.status)} border text-sm`}>
          {role.status.charAt(0).toUpperCase() + role.status.slice(1).replace('_', ' ')}
        </Badge>
      </div>

      <Separator />

      {/* Smart Role Profiles Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Smart Role Profiles</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Automatically matched profiles based on role name
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search profiles..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                const timer = setTimeout(() => {
                  if (e.target.value.trim()) {
                    searchProfiles(e.target.value);
                  } else if (role.name) {
                    searchProfiles(role.name);
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
                } else if (role.name) {
                  searchProfiles(role.name);
                }
              }}
            >
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Profile Cards Grid */}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profileMatches.map((match) => (
              <SmartProfileCard
                key={match.onet_code}
                title={match.title}
                matchPercentage={match.match_percentage}
                alternativeTitles={match.also_called}
                isSelected={selectedProfile?.onet_code === match.onet_code}
                onPreview={() => handlePreviewProfile(match)}
                onSelect={() => handleSelectProfile(match)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Role Competencies Section - Shows when profile is applied */}
      {role?.onet_code && (
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
                {selectedProfile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedProfile(null);
                    }}
                  >
                    Change Profile
                  </Button>
                )}
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
                    [...mergedTasks]
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
                      ))
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
                    mergedSkills.map(skill => (
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
                    ))
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
                    mergedKnowledge.map(know => (
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
                    ))
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

      {/* Profile Preview Drawer */}
      <ProfilePreviewDrawer
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewProfile(null);
        }}
        profile={previewProfile}
        onSelect={() => {
          if (previewProfile) {
            const match = profileMatches.find(
              (m) => m.onet_code === previewProfile.onet_code
            );
            if (match) {
              handleSelectProfile(match);
            }
          }
          setIsPreviewOpen(false);
          setPreviewProfile(null);
        }}
      />

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
          source={editingItem.item.source}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive "{role.name}"? This will mark it as
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

