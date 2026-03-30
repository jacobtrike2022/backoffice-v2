import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  Zap,
  HardHat,
  Upload,
  FileText,
  ExternalLink,
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
  type MergedAbility,
  type MergedWorkStyle,
  type WorkContextItem,
} from '../lib/api/onet-local';
import { getCurrentUserOrgId, supabase, supabaseAnonKey } from '../lib/supabase';
import { getServerUrl } from '../utils/supabase/info';
import { uploadSourceFileWithRecord } from '../lib/services/uploadService';
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
import { X } from 'lucide-react';

const MAX_ONET_SEARCH_LEN = 1200;

/**
 * Combine role title + job description for O*NET trigram search so "Acme Corp Sales Associate Role"
 * still matches retail/sales occupations when the JD mentions sales floor, customers, etc.
 * RPC weights st_short (first ~120 chars) heavily — repeat the cleaned title so role words dominate
 * the window, and cap JD snippet so a long blob does not drown the title in similarity().
 */
function buildOnetSearchTerm(roleName: string, jobDescription?: string | null): string {
  let base = (roleName || '').trim();
  base = base
    .replace(/\b(acme|corp|corporation|company|inc|llc|ltd)\b/gi, ' ')
    .replace(/\b(the)\b/gi, ' ')
    .replace(/\b(role|position|opening)\b/gi, ' ')
    // Remove workflow suffixes that pollute retrieval for generated demo role names
    .replace(/\b(job\s*desc(ription)?|jd|extract(ed)?|example|demo)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const jd = (jobDescription || '').trim();
  if (jd.length > 0) {
    const snippet = jd.slice(0, 360).replace(/\s+/g, ' ');
    // Triple title so st_short/st_probe skew to role name (not first 80 chars of JD noise)
    const combined = `${base} ${base} ${base} ${snippet}`.trim();
    return combined.slice(0, MAX_ONET_SEARCH_LEN);
  }
  return base.slice(0, MAX_ONET_SEARCH_LEN);
}

interface RoleDetailPageProps {
  roleId: string | 'new';
  onBack: () => void;
}

export function RoleDetailPage({ roleId, onBack }: RoleDetailPageProps) {
  const { t } = useTranslation();
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
  const searchRequestSeq = useRef(0);
  const lastSearchError = useRef<string>('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [mergedTasks, setMergedTasks] = useState<MergedTask[]>([]);
  const [mergedWorkStyles, setMergedWorkStyles] = useState<MergedWorkStyle[]>([]);
  const [mergedSkills, setMergedSkills] = useState<MergedSkill[]>([]);
  const [mergedKnowledge, setMergedKnowledge] = useState<MergedKnowledge[]>([]);
  const [mergedAbilities, setMergedAbilities] = useState<MergedAbility[]>([]);
  const [workContextItems, setWorkContextItems] = useState<WorkContextItem[]>([]);
  const [loadingMerged, setLoadingMerged] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddWorkStyle, setShowAddWorkStyle] = useState(false);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [showAddKnowledge, setShowAddKnowledge] = useState(false);
  const [showAddAbility, setShowAddAbility] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [showEditWorkStyle, setShowEditWorkStyle] = useState(false);
  const [showEditSkill, setShowEditSkill] = useState(false);
  const [showEditKnowledge, setShowEditKnowledge] = useState(false);
  const [editingAbility, setEditingAbility] = useState<MergedAbility | null>(null);
  const [editingWorkStyle, setEditingWorkStyle] = useState<MergedWorkStyle | null>(null);
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
    type: 'task' | 'skill' | 'knowledge' | 'ability' | 'work_style';
    item: MergedTask | MergedSkill | MergedKnowledge | MergedAbility | MergedWorkStyle;
  } | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [excludedTasksExpanded, setExcludedTasksExpanded] = useState(false);
  const [excludedWorkStylesExpanded, setExcludedWorkStylesExpanded] = useState(false);
  const [excludedSkillsExpanded, setExcludedSkillsExpanded] = useState(false);
  const [excludedKnowledgeExpanded, setExcludedKnowledgeExpanded] = useState(false);
  const [excludedAbilitiesExpanded, setExcludedAbilitiesExpanded] = useState(false);
  const [capabilityExpanded, setCapabilityExpanded] = useState<Record<string, boolean>>({});
  const [workContextExpanded, setWorkContextExpanded] = useState<Record<string, boolean>>({});
  const [capabilityExcludedExpanded, setCapabilityExcludedExpanded] = useState<Record<string, boolean>>({});
  const [directReports, setDirectReports] = useState<{ id: string; name: string }[]>([]);

  // JD Upload state
  const [uploadingJd, setUploadingJd] = useState(false);
  const [extractingJd, setExtractingJd] = useState(false);
  const jdFileInputRef = React.useRef<HTMLInputElement>(null);
  const [sourceFileInfo, setSourceFileInfo] = useState<{
    id: string;
    file_name: string;
  } | null>(null);
  const [sourceChunkInfo, setSourceChunkInfo] = useState<{
    id: string;
    title: string;
    source_file_id: string;
    file_name: string;
  } | null>(null);

  const toPercentFromFive = (value?: number | null) =>
    value === undefined || value === null ? undefined : Number(value) * 20;

  const navigateToRole = (targetRoleId: string) => {
    const { origin, pathname } = window.location;
    const marker = '/roles';
    const idx = pathname.indexOf(marker);
    const base =
      idx !== -1
        ? `${origin}${pathname.slice(0, idx + marker.length)}`
        : `${origin}${marker}`;
    window.location.href = `${base}/${targetRoleId}`;
  };
  const [isEditingCoreData, setIsEditingCoreData] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    job_code: string;
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
    reports_to_role_id: string | null;
  }>({
    name: '',
    job_code: '',
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
    reports_to_role_id: null,
  });
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);

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
    loadAvailableRoles();
  }, [roleId]);

  // Load merged data when role has onet_code
  useEffect(() => {
    if (role?.onet_code) {
      loadMergedData();
      loadWorkContext(role.onet_code);
    }
  }, [role?.onet_code, roleId]);

  // Load source file info when role changes
  useEffect(() => {
    if (role) {
      loadSourceFileInfo();
    }
  }, [role?.source_file_id]);

  // Load source chunk info when role changes (for JD hotlink)
  useEffect(() => {
    if (role) {
      loadSourceChunkInfo();
    }
  }, [role?.source_chunk_id]);

  // Auto-search profiles when role name changes (only if no profile selected or changing profile)
  useEffect(() => {
    // Manual input takes precedence; avoid overlapping auto RPCs that flood toasts.
    if (searchTerm.trim().length > 0) {
      return;
    }

    if (roleId === 'new' && formData.name && !selectedProfile) {
      const timer = setTimeout(() => {
        searchProfiles(buildOnetSearchTerm(formData.name, formData.job_description), { silent: true });
      }, 500); // Debounce 500ms

      return () => clearTimeout(timer);
    } else if (role?.name && (!role.onet_code || isChangingProfile)) {
      const timer = setTimeout(() => {
        searchProfiles(buildOnetSearchTerm(role.name, role.job_description), { silent: true });
      }, 500); // Debounce 500ms

      return () => clearTimeout(timer);
    }
  }, [
    role?.name,
    formData.name,
    formData.job_description,
    role?.job_description,
    roleId,
    selectedProfile,
    isChangingProfile,
    role?.onet_code,
    searchTerm,
  ]);

  // Debounced manual search in the input field.
  useEffect(() => {
    const isSearchInputVisible = !(role?.onet_code && !isChangingProfile);
    if (!isSearchInputVisible) {
      return;
    }

    const timer = setTimeout(() => {
      if (searchTerm.trim()) {
        searchProfiles(searchTerm, { silent: true });
      } else if (role?.name || formData.name) {
        searchProfiles(
          buildOnetSearchTerm(
            role?.name || formData.name,
            role?.job_description ?? formData.job_description,
          ),
          { silent: true },
        );
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [
    searchTerm,
    role?.onet_code,
    isChangingProfile,
    role?.name,
    role?.job_description,
    formData.name,
    formData.job_description,
  ]);

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
        job_code: '',
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
        reports_to_role_id: null,
      });
      setIsEditingCoreData(true);
    } else if (role) {
      // Populate form data from loaded role
      setFormData({
        name: role.name || '',
        job_code: role.job_code || '',
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
        reports_to_role_id: role.reports_to_role_id ?? null,
      });
      setEditedName(role.name || '');
    }
  }, [role, roleId]);


  async function loadOrganizationId() {
    const orgId = await getCurrentUserOrgId();
    setOrganizationId(orgId);
  }

  async function loadAvailableRoles() {
    try {
      const roles = await rolesApi.list(true);
      setAvailableRoles(roles);
    } catch (error: any) {
      console.error('Error loading roles list:', error);
      toast.error(t('roles.detail.toastLoadRolesFailed'), {
        description: error.message || 'An unexpected error occurred',
      });
    }
  }

  async function loadRole() {
    try {
      setLoading(true);
      const data = await rolesApi.get(roleId);
      const reports = await rolesApi.getDirectReports(roleId);
      setDirectReports(reports);
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
          const matches = await onetLocal.searchProfiles(
            buildOnetSearchTerm(data.name || '', data.job_description),
            4,
          );
          const match = matches.find((m) => m.onet_code === data.onet_code);
          if (match) {
            setSelectedProfile(match);
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading role:', error);
      toast.error(t('roles.detail.toastLoadRoleFailed'), {
        description: error.message || 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  }

  // Load source file info if role has source_file_id
  async function loadSourceFileInfo() {
    if (!role?.source_file_id) {
      setSourceFileInfo(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('source_files')
        .select('id, file_name')
        .eq('id', role.source_file_id)
        .single();
      if (!error && data) {
        setSourceFileInfo(data);
      }
    } catch (error) {
      console.error('Error loading source file info:', error);
    }
  }

  // Load source chunk info if role has source_chunk_id (for JD hotlink)
  async function loadSourceChunkInfo() {
    if (!role?.source_chunk_id) {
      setSourceChunkInfo(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('source_chunks')
        .select('id, title, source_file_id, source_files(file_name)')
        .eq('id', role.source_chunk_id)
        .single();
      if (!error && data) {
        setSourceChunkInfo({
          id: data.id,
          // Use role name for a cleaner hotlink display: "Job Description: [Role Name]"
          title: `Job Description: ${role.name}`,
          source_file_id: data.source_file_id,
          file_name: (data.source_files as any)?.file_name || 'Source Document',
        });
      }
    } catch (error) {
      console.error('Error loading source chunk info:', error);
    }
  }

  // Handle JD file upload
  async function handleJdUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!validTypes.includes(file.type)) {
      toast.error(t('roles.detail.toastInvalidFileType'), {
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

      setExtractingJd(true);
      toast.success(t('roles.detail.toastFileUploaded'), { description: t('roles.toastExtractingDesc') });

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

      // Update the role with the extracted JD
      if (roleId !== 'new' && role) {
        const updatedRole = await rolesApi.update({
          id: roleId,
          job_description: jdText || formData.job_description,
          job_description_source: 'uploaded' as const,
          source_file_id: uploadedFile.id,
        });
        setRole(updatedRole);
        setFormData(prev => ({
          ...prev,
          job_description: jdText || prev.job_description,
          job_description_source: 'uploaded',
        }));
        setSourceFileInfo({ id: uploadedFile.id, file_name: uploadedFile.file_name });
        toast.success(t('roles.detail.toastJdUpdated'), {
          description: `Extracted from ${file.name}`,
        });

        // If there are O*NET suggestions, trigger a new search
        if (jdData.onet_suggestions?.length > 0) {
          const keywords = jdData.onet_suggestions.slice(0, 3).map((s: any) => s.keyword).join(' ');
          searchProfiles(keywords);
        }
      } else {
        // For new role, just update the form
        setFormData(prev => ({
          ...prev,
          job_description: jdText,
          job_description_source: 'uploaded',
        }));
        toast.success(t('roles.detail.toastJdExtracted'), {
          description: 'Review and save the role to apply.',
        });
      }
    } catch (error: any) {
      console.error('JD upload error:', error);
      toast.error(t('roles.detail.toastUploadFailed'), { description: error.message });
    } finally {
      setUploadingJd(false);
      setExtractingJd(false);
      // Reset file input
      if (jdFileInputRef.current) {
        jdFileInputRef.current.value = '';
      }
    }
  }

  async function loadMergedData() {
    if (!roleId) return;
    
    try {
      setLoadingMerged(true);
      const [tasks, workStyles, abilities, skills, knowledge] = await Promise.all([
        onetLocal.getRoleTasks(roleId),
        onetLocal.getRoleWorkStyles(roleId),
        onetLocal.getRoleAbilities(roleId),
        onetLocal.getRoleSkills(roleId),
        onetLocal.getRoleKnowledge(roleId),
      ]);
      setMergedTasks(tasks);
      setMergedWorkStyles(workStyles);
      setMergedAbilities(abilities);
      setMergedSkills(skills);
      setMergedKnowledge(knowledge);
      // default expand capability categories
      const capabilityMap: Record<string, boolean> = {};
      abilities.forEach((a) => {
        if (a.category) capabilityMap[a.category] = true;
      });
      setCapabilityExpanded((prev) => ({ ...capabilityMap, ...prev }));
    } catch (error: any) {
      console.error('Error loading merged data:', error);
      toast.error(t('roles.detail.toastLoadRolesFailed'), {
        description: error.message || 'An unexpected error occurred',
      });
    } finally {
      setLoadingMerged(false);
    }
  }

  async function loadWorkContext(onetCode: string) {
    try {
      const context = await onetLocal.getWorkContext(onetCode);
      setWorkContextItems(context);
      const expanded: Record<string, boolean> = {};
      context.forEach((item) => {
        expanded[item.context_category] = expanded[item.context_category] ?? true;
      });
      setWorkContextExpanded((prev) => ({ ...expanded, ...prev }));
    } catch (error: any) {
      console.error('Error loading work context:', error);
      toast.error(t('roles.detail.toastLoadRoleFailed'), {
        description: error.message || 'An unexpected error occurred',
      });
    }
  }

  async function searchProfiles(term: string, options?: { silent?: boolean }) {
    if (!term || term.trim().length === 0) {
      setProfileMatches([]);
      return;
    }

    const requestId = ++searchRequestSeq.current;

    try {
      setIsSearching(true);
      const matches = await onetLocal.searchProfiles(term, 4);
      if (requestId !== searchRequestSeq.current) {
        return;
      }
      lastSearchError.current = '';
      setProfileMatches(matches);
    } catch (error: any) {
      if (requestId !== searchRequestSeq.current) {
        return;
      }
      console.error('Error searching profiles:', error);
      const message = error.message || 'An unexpected error occurred';
      if (!options?.silent || message !== lastSearchError.current) {
        toast.error(t('roles.detail.toastSearchProfilesFailed'), {
          id: 'onet-search-error',
          description: message,
        });
      }
      lastSearchError.current = message;
    } finally {
      if (requestId === searchRequestSeq.current) {
        setIsSearching(false);
      }
    }
  }

  async function loadProfileDetails(onetCode: string): Promise<ProfileDetails | null> {
    try {
      const details = await onetLocal.getProfileDetails(onetCode);
      setProfileDetails(details);
      return details;
    } catch (error: any) {
      console.error('Error loading profile details:', error);
      toast.error(t('roles.detail.toastLoadRoleFailed'), {
        description:
          error?.message ||
          'Could not load O*NET data. In demo mode, O*NET tables must allow read access (see migrations).',
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
          job_code: formData.job_code,
          description: formData.description,
          department: formData.department,
          job_family: formData.job_family,
        flsa_status: formData.flsa_status,
          is_manager: formData.is_manager,
          is_frontline: formData.is_frontline,
          permission_level: formData.permission_level,
          job_description: formData.job_description,
          job_description_source: formData.job_description_source,
          reports_to_role_id: formData.reports_to_role_id,
        });
        
        toast.success(t('roles.detail.toastRoleCreated'));
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
          searchProfiles(buildOnetSearchTerm(newRole.name, newRole.job_description));
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
          job_code: formData.job_code,
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
          reports_to_role_id: formData.reports_to_role_id,
        } : {
          reports_to_role_id: formData.reports_to_role_id,
        }),
      };

      // If a profile is selected, update onet_code and match_confidence
      if (selectedProfile) {
        updates.onet_code = selectedProfile.onet_code;
        updates.onet_match_confidence = selectedProfile.match_percentage;
      }

      await rolesApi.update(updates);
      await loadRole();
      setIsEditingCoreData(false);
      toast.success(t('roles.detail.toastRoleUpdated'));
    } catch (error: any) {
      console.error('Error saving role:', error);
      toast.error(t('roles.detail.toastSaveFailed'), {
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
      toast.success(t('roles.detail.toastRoleArchived'));
      onBack();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      toast.error(t('roles.detail.toastArchiveFailed'), {
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
        toast.error(t('roles.detail.toastSearchProfilesFailed'), {
          description:
            'This match is from search, but full occupation data is missing for this code. If you are in demo mode, ensure database migrations are applied.',
        });
        setIsPreviewOpen(false);
      }
    } catch (error) {
      console.error('Error loading profile details for preview:', error);
      toast.error(t('roles.detail.toastLoadRoleFailed'));
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
        toast.success(t('roles.detail.toastProfileSelectedCreate'));
      } else if (role) {
        // Apply profile to existing role
        await onetLocal.applyProfileToRole(role.id, match.onet_code);
        
        // Update role state
        setRole({ ...role, onet_code: match.onet_code });
        setSelectedProfile(match);
        setIsChangingProfile(false); // Hide suggestions after selection
        
        // Load merged data
        await loadMergedData();
        
        toast.success(t('roles.detail.toastProfileApplied'));
      }
    } catch (error: any) {
      console.error('Error applying profile:', error);
      toast.error(t('roles.detail.toastProfileApplyFailed'), {
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
      toast.error(t('roles.detail.toastSaveFailed'), {
        description: error.message || 'An unexpected error occurred',
      });
    }
  }

  async function handleToggleAbility(ability: MergedAbility) {
    if (!role) return;
    
    try {
      if (ability.is_active) {
        await onetLocal.excludeAbility(role.id, ability.ability_id);
      } else {
        await onetLocal.includeAbility(role.id, ability.ability_id);
      }
      await loadMergedData();
    } catch (error: any) {
      console.error('Error toggling ability:', error);
      toast.error(t('roles.detail.toastSaveFailed'), {
        description: error.message || 'An unexpected error occurred',
      });
    }
  }

  async function handleToggleWorkStyle(workStyle: MergedWorkStyle) {
    if (!role) return;
    
    try {
      if (workStyle.is_active) {
        await onetLocal.excludeWorkStyle(role.id, workStyle.work_style_id);
      } else {
        await onetLocal.includeWorkStyle(role.id, workStyle.work_style_id);
      }
      await loadMergedData();
    } catch (error: any) {
      console.error('Error toggling work style:', error);
      toast.error(t('roles.detail.toastSaveFailed'), {
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
      toast.error(t('roles.detail.toastSaveFailed'), {
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
      toast.error(t('roles.detail.toastSaveFailed'), {
        description: error.message || 'An unexpected error occurred',
      });
    }
  }

  async function handleAddTask(description: string, importance?: number) {
    if (!role || !organizationId) return;
    
    try {
      await onetLocal.addCustomTask(role.id, organizationId, description, importance);
      await loadMergedData();
      toast.success(t('roles.detail.toastRoleCreated'));
    } catch (error: any) {
      console.error('Error adding task:', error);
      toast.error(t('roles.detail.toastSaveFailed'), {
        description: error.message || 'An unexpected error occurred',
      });
      throw error;
    }
  }

  async function handleAddAbility(name: string, _description?: string, importance?: number) {
    if (!role) return;
    
    try {
      await onetLocal.addCustomAbility(role.id, name, importance);
      await loadMergedData();
      toast.success(t('roles.detail.toastRoleCreated'));
    } catch (error: any) {
      console.error('Error adding ability:', error);
      toast.error('Failed to add ability', {
        description: error.message || 'An unexpected error occurred',
      });
      throw error;
    }
  }

  async function handleAddWorkStyle(name: string, _description?: string, impact?: number) {
    if (!role) return;
    
    try {
      await onetLocal.addCustomWorkStyle(role.id, name, impact);
      await loadMergedData();
      toast.success('Custom work style added');
    } catch (error: any) {
      console.error('Error adding work style:', error);
      toast.error('Failed to add work style', {
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
      toast.error(t('roles.detail.toastSaveFailed'), {
        description: error.message || 'An unexpected error occurred',
      });
      throw error;
    }
  }

  async function handleEditAbility(ability: MergedAbility, customName: string, _customDescription?: string, notes?: string) {
    if (!role) return;
    
    try {
      await onetLocal.modifyAbility(role.id, ability.ability_id, customName, undefined, undefined, notes);
      await loadMergedData();
      toast.success('Ability updated');
    } catch (error: any) {
      console.error('Error editing ability:', error);
      toast.error(t('roles.detail.toastSaveFailed'), {
        description: error.message || 'An unexpected error occurred',
      });
      throw error;
    }
  }

  async function handleEditWorkStyle(workStyle: MergedWorkStyle, customName: string, _customDescription?: string, notes?: string) {
    if (!role) return;
    
    try {
      await onetLocal.modifyWorkStyle(role.id, workStyle.work_style_id, customName, undefined, notes);
      await loadMergedData();
      toast.success('Work style updated');
    } catch (error: any) {
      console.error('Error editing work style:', error);
      toast.error(t('roles.detail.toastSaveFailed'), {
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
      toast.error(t('roles.detail.toastSaveFailed'), {
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
      toast.error(t('roles.detail.toastSaveFailed'), {
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

  async function handleDeleteAbility(customizationId: string) {
    try {
      await onetLocal.deleteCustomAbility(customizationId);
      await loadMergedData();
      toast.success('Ability deleted');
    } catch (error: any) {
      console.error('Error deleting ability:', error);
      toast.error('Failed to delete ability', {
        description: error.message || 'An unexpected error occurred',
      });
    }
  }

  async function handleDeleteWorkStyle(customizationId: string) {
    try {
      await onetLocal.deleteCustomWorkStyle(customizationId);
      await loadMergedData();
      toast.success('Work style deleted');
    } catch (error: any) {
      console.error('Error deleting work style:', error);
      toast.error('Failed to delete work style', {
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

  async function handleRevertAbility(customizationId: string) {
    try {
      await onetLocal.revertAbilityModification(customizationId);
      await loadMergedData();
      toast.success('Ability reverted to standard');
    } catch (error: any) {
      console.error('Error reverting ability:', error);
      toast.error('Failed to revert ability', {
        description: error.message || 'An unexpected error occurred',
      });
    }
  }

  async function handleRevertWorkStyle(customizationId: string) {
    try {
      await onetLocal.revertWorkStyleModification(customizationId);
      await loadMergedData();
      toast.success('Work style reverted to standard');
    } catch (error: any) {
      console.error('Error reverting work style:', error);
      toast.error('Failed to revert work style', {
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
        return t('roles.detail.permBasicEmployee');
      case 2:
        return t('roles.detail.permTeamLead');
      case 3:
        return t('roles.detail.permManager');
      case 4:
        return t('roles.detail.permDistrictManager');
      case 5:
        return t('roles.detail.permCorporate');
      default:
        return 'Unknown';
    }
  }

  function getFlsaStatusLabel(value: 'exempt' | 'non_exempt' | null | undefined) {
    if (value === 'non_exempt') return t('roles.detail.flsaHourly');
    if (value === 'exempt') return t('roles.detail.flsaSalary');
    return t('roles.detail.flsaNotSet');
  }

  const reportsToRoleName =
    role?.reports_to_role_id
      ? availableRoles.find((r) => r.id === role.reports_to_role_id)?.name || '—'
      : '—';

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
        <p className="text-muted-foreground">{t('roles.detail.roleNotFound')}</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('roles.detail.backToRoles')}
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
            {t('roles.detail.backToRoles')}
          </Button>
          <Separator orientation="vertical" className="h-6" />
          {roleId === 'new' ? (
            <h1 className="text-2xl font-semibold">{t('roles.detail.createNewRole')}</h1>
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
          {/* Hidden file input for JD upload */}
          <input
            type="file"
            ref={jdFileInputRef}
            onChange={handleJdUpload}
            accept=".pdf,.doc,.docx,.txt"
            className="hidden"
          />
          {/* Show JD chunk hotlink if role has linked source chunk, otherwise show upload button */}
          {sourceChunkInfo ? (
            <Button
              variant="outline"
              onClick={() => {
                // Navigate to Organization > Sources tab with this file open and chunk highlighted
                const url = `/organization?tab=sources&sourceFileId=${sourceChunkInfo.source_file_id}&chunkId=${sourceChunkInfo.id}`;
                window.location.href = url;
              }}
              className="gap-2 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <FileText className="w-4 h-4" />
              <span className="max-w-[200px] truncate">{sourceChunkInfo.title}</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => jdFileInputRef.current?.click()}
              disabled={uploadingJd || extractingJd}
            >
              {uploadingJd ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('roles.uploading')}
                </>
              ) : extractingJd ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('roles.extracting')}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {role?.job_description || formData.job_description ? t('roles.replaceJobDescription') : t('roles.uploadJobDescription')}
                </>
              )}
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('roles.saving')}
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {t('common.save')}
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
                  {t('roles.detail.editRole')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>
                  {t('roles.archiveRole')}
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
            <CardTitle>{roleId === 'new' ? t('roles.detail.createRoleCardTitle') : t('roles.detail.editRoleCardTitle')}</CardTitle>
            <CardDescription>
              {roleId === 'new' ? 'Enter core role information, then select a Smart Role Profile below' : 'Update core role information'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">{t('roles.basicInformation')}</h3>
                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">
                      {t('roles.roleName')} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="edit-name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder={t('roles.roleNamePlaceholder')}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-job_code">{t('roles.detail.jobCode')}</Label>
                    <Input
                      id="edit-job_code"
                      value={formData.job_code}
                      onChange={(e) =>
                        setFormData({ ...formData, job_code: e.target.value })
                      }
                      placeholder={t('roles.detail.jobCodePlaceholder')}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('roles.detail.jobCodeHint')}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">{t('roles.description')}</Label>
                  <Textarea
                    id="edit-description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder={t('roles.descriptionPlaceholder')}
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
                    <Label htmlFor="edit-department">{t('roles.department')}</Label>
                    <Select
                      value={formData.department || undefined}
                      onValueChange={(value) =>
                        setFormData({ ...formData, department: value || '' })
                      }
                    >
                      <SelectTrigger id="edit-department">
                        <SelectValue placeholder={t('roles.departmentPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Operations">{t('roles.deptOperations')}</SelectItem>
                        <SelectItem value="Kitchen">{t('roles.deptKitchen')}</SelectItem>
                        <SelectItem value="Management">{t('roles.deptManagement')}</SelectItem>
                        <SelectItem value="Sales">{t('roles.deptSales')}</SelectItem>
                        <SelectItem value="Corporate">{t('roles.deptCorporate')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-job_family">{t('roles.jobFamily')}</Label>
                    <Select
                      value={formData.job_family || undefined}
                      onValueChange={(value) =>
                        setFormData({ ...formData, job_family: value || '' })
                      }
                    >
                      <SelectTrigger id="edit-job_family">
                        <SelectValue placeholder={t('roles.jobFamilyPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Food Service">{t('roles.jobFamilyFoodService')}</SelectItem>
                        <SelectItem value="Retail">{t('roles.jobFamilyRetail')}</SelectItem>
                        <SelectItem value="Management">{t('roles.deptManagement')}</SelectItem>
                        <SelectItem value="Leadership">{t('roles.jobFamilyLeadership')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-reports_to">{t('roles.detail.reportsTo')}</Label>
                  <Select
                    value={formData.reports_to_role_id ?? 'none'}
                    onValueChange={(value) =>
                      setFormData({ ...formData, reports_to_role_id: value === 'none' ? null : value })
                    }
                  >
                    <SelectTrigger id="edit-reports_to">
                      <SelectValue placeholder={t('roles.detail.reportsToPlaeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('common.none')}</SelectItem>
                      {availableRoles
                        .filter((r) => r.id !== roleId)
                        .map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Direct Reports */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t('roles.detail.directReports')}</Label>
                    {isEditingCoreData && (
                      <Select
                        onValueChange={async (value) => {
                          if (value) {
                            try {
                              await rolesApi.setReportsTo(value, roleId as string);
                              const updated = await rolesApi.getDirectReports(roleId as string);
                              setDirectReports(updated);
                              toast.success(t('roles.detail.toastAddedDirectReport'));
                            } catch (error: any) {
                              console.error('Error adding direct report:', error);
                              toast.error(t('roles.detail.toastAddDirectReportFailed'), {
                                description: error.message || 'An unexpected error occurred',
                              });
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder={t('roles.detail.directReportsPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRoles
                            .filter((r) => r.id !== roleId)
                            .filter((r) => !directReports.some((dr) => dr.id === r.id))
                            .filter((r) => r.id !== formData.reports_to_role_id)
                            .map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {directReports.length > 0 ? (
                    <div className="space-y-1">
                      {directReports.map((report) => (
                        <div
                          key={report.id}
                          className="flex items-center justify-between p-2 rounded-md bg-muted/40"
                        >
                          <Badge className="text-xs font-medium bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white border-0 shadow-sm">
                            {report.name}
                          </Badge>
                          {isEditingCoreData && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await rolesApi.setReportsTo(report.id, null);
                                  setDirectReports(directReports.filter((r) => r.id !== report.id));
                                  toast.success(t('roles.detail.toastRemovedDirectReport', { name: report.name }));
                                } catch (error: any) {
                                  console.error('Error removing direct report:', error);
                                  toast.error(t('roles.detail.toastRemoveDirectReportFailed'), {
                                    description: error.message || 'An unexpected error occurred',
                                  });
                                }
                              }}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('roles.detail.noDirectReports')}</p>
                  )}
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
                      {t('roles.managerRole')}
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
                      {t('roles.frontline')}
                    </Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-permission_level">{t('roles.permissionLevel')}</Label>
                  <Select
                    value={formData.permission_level.toString()}
                    onValueChange={handlePermissionLevelChange}
                  >
                    <SelectTrigger id="edit-permission_level">
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

                <div className="space-y-2">
                  <Label htmlFor="edit-flsa_status">{t('roles.detail.flsaStatus')}</Label>
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
                      <SelectItem value="not_set">{t('roles.detail.flsaNotSet')}</SelectItem>
                      <SelectItem value="non_exempt">{t('roles.detail.flsaHourly')}</SelectItem>
                      <SelectItem value="exempt">{t('roles.detail.flsaSalary')}</SelectItem>
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

                  <div className="space-y-2">
                    <Label htmlFor="edit-job_description">{t('roles.jobDescription')}</Label>
                    <Textarea
                      id="edit-job_description"
                      value={formData.job_description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          job_description: e.target.value,
                        })
                      }
                      placeholder={t('roles.jobDescriptionPlaceholder')}
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
                          <RadioGroupItem value="manual" id="edit-source-manual" />
                          <Label htmlFor="edit-source-manual" className="cursor-pointer">
                            {t('roles.jdSourceManual')}
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="hris" id="edit-source-hris" />
                          <Label htmlFor="edit-source-hris" className="cursor-pointer">
                            {t('roles.jdSourceHRIS')}
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="uploaded" id="edit-source-uploaded" />
                          <Label htmlFor="edit-source-uploaded" className="cursor-pointer">
                            {t('roles.jdSourceUploaded')}
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
                  <Label htmlFor="edit-status">{t('roles.statusLabel')}</Label>
                  <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger id="edit-status">
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
                          job_code: role.job_code || '',
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
                          reports_to_role_id: role.reports_to_role_id ?? null,
                        });
                      }
                    }
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
                >
                  {saving ? (roleId === 'new' ? t('roles.detail.creating') : t('roles.saving')) : (roleId === 'new' ? t('roles.createRole') : t('roles.saveChanges'))}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>{t('roles.detail.roleDetailsCard')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('roles.detail.roleNameLabel')}</Label>
                    <div className="text-sm font-medium">{role?.name || '—'}</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('roles.detail.jobCode')}</Label>
                    <div className="text-sm font-medium">{role?.job_code || '—'}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t('roles.detail.roleDescLabel')}</Label>
                  <div className="text-sm text-muted-foreground">{role?.description || '—'}</div>
                </div>
              </div>

              <div className="space-y-3">
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('roles.detail.roleDeptLabel')}</Label>
                    <div className="text-sm font-medium">{role?.department || '—'}</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('roles.detail.roleJobFamilyLabel')}</Label>
                    <div className="text-sm font-medium">{role?.job_family || '—'}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t('roles.detail.roleReportsToLabel')}</Label>
                {role?.reports_to_role_id ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigateToRole(role.reports_to_role_id!);
                    }}
                    className="h-7 px-2 bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white border-0 shadow-sm"
                  >
                    {reportsToRoleName}
                  </Button>
                ) : (
                  <Badge className="text-xs font-medium bg-muted text-foreground border">
                    —
                  </Badge>
                )}
                </div>
                <div className="flex items-center gap-6">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('roles.detail.roleManagerLabel')}</Label>
                    <div className="text-sm font-medium">{role?.is_manager ? t('roles.detail.yes') : t('roles.detail.no')}</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('roles.detail.roleFrontlineLabel')}</Label>
                    <div className="text-sm font-medium">{role?.is_frontline ? t('roles.detail.yes') : t('roles.detail.no')}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t('roles.detail.rolePermLevelLabel')}</Label>
                  <div className="text-sm font-medium">
                    {role?.permission_level ? `${role.permission_level} - ${getPermissionLevelLabel(role.permission_level)}` : '—'}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t('roles.detail.roleFlsaLabel')}</Label>
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
                    {t('roles.advanced')}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 mt-4">
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">{t('roles.detail.roleJdLabel')}</Label>
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap">{role.job_description}</div>
                    </div>
                    {role.job_description_source && (
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">{t('roles.detail.roleJdSourceLabel')}</Label>
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
            <h2 className="text-xl font-semibold">{t('roles.detail.smartRoleProfiles')}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {role?.onet_code && !isChangingProfile
                ? t('roles.detail.currentProfileMatch')
                : t('roles.detail.autoMatchedDesc')}
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
                  searchProfiles(buildOnetSearchTerm(role.name, role.job_description));
                }
              }}
            >
              <Search className="w-4 h-4 mr-2" />
              {t('roles.detail.changeProfile')}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('roles.detail.searchProfilesPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (searchTerm.trim()) {
                      searchProfiles(searchTerm);
                    } else if (role?.name || formData.name) {
                      searchProfiles(
                        buildOnetSearchTerm(
                          role?.name || formData.name,
                          role?.job_description ?? formData.job_description,
                        ),
                      );
                    }
                  }
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
                    searchProfiles(
                      buildOnetSearchTerm(
                        role?.name || formData.name,
                        role?.job_description ?? formData.job_description,
                      ),
                    );
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
              showMatchBadge={false}
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
                    {t('roles.detail.noMatchingProfiles')}
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
                    {t('roles.detail.profileCode')}{previewProfile.onet_code || 'N/A'}
                  </Badge>
                  {previewProfile.job_zone && (
                    <Badge variant="outline" className="text-xs">
                      {t('roles.detail.profileJobZone')}{previewProfile.job_zone}
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
                  {t('common.close')}
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
                    ? t('roles.detail.profileApplied')
                    : t('roles.detail.profileApply')}
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
                <h3 className="font-semibold text-sm mb-2">{t('roles.detail.profileAlsoKnownAs')}</h3>
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
                  {t('roles.detail.profileKeyTasks', { n: previewProfile.tasks.length })}
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
                  {t('roles.detail.profileRequiredSkills', { n: previewProfile.skills.length })}
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
                  {t('roles.detail.profileRequiredKnowledge', { n: previewProfile.knowledge.length })}
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
                  {t('roles.detail.roleCompetencies')}
                  {loadingMerged && <Loader2 className="h-4 w-4 animate-spin" />}
                </CardTitle>
                <CardDescription>
                  {t('roles.detail.competenciesDesc')}
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
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="tasks" className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  {t('roles.detail.tabTasks', { active: mergedTasks.filter(task => task.is_active).length, total: mergedTasks.length })}
                </TabsTrigger>
                <TabsTrigger value="work_styles" className="flex items-center gap-2">
                  <Zap className="h-4 w-4 fill-current" />
                  {t('roles.detail.tabWorkStyles', { active: mergedWorkStyles.filter(ws => ws.is_active).length, total: mergedWorkStyles.length })}
                </TabsTrigger>
                <TabsTrigger value="skills" className="flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  {t('roles.detail.tabSkills', { active: mergedSkills.filter(s => s.is_active).length, total: mergedSkills.length })}
                </TabsTrigger>
                <TabsTrigger value="knowledge" className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  {t('roles.detail.tabKnowledge', { active: mergedKnowledge.filter(k => k.is_active).length, total: mergedKnowledge.length })}
                </TabsTrigger>
              </TabsList>

              {/* Tasks Tab */}
              <TabsContent value="tasks" className="mt-4">
                <div className="space-y-2">
                  {mergedTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {t('roles.detail.noTasks')}
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
                              <span>{t('roles.detail.excludedTasks', { n: mergedTasks.filter(task => !task.is_active).length })}</span>
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
                    {t('roles.detail.addCustomTask')}
                  </Button>
                </div>
              </TabsContent>

              {/* Work Styles Tab */}
              <TabsContent value="work_styles" className="mt-4">
                <div className="space-y-2">
                  {mergedWorkStyles.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {t('roles.detail.noWorkStyles')}
                    </p>
                  ) : (
                    <>
                      {[...mergedWorkStyles]
                        .filter(ws => ws.is_active)
                        .sort((a, b) => (Number(b.impact ?? 0) - Number(a.impact ?? 0)))
                        .map(ws => (
                          <CompetencyItem
                            key={ws.work_style_id}
                            id={ws.work_style_id}
                            description={ws.name}
                            source={ws.source}
                            isActive={ws.is_active}
                            importance={toPercentFromFive(ws.impact)}
                            onToggle={() => handleToggleWorkStyle(ws)}
                            onEdit={() => {
                              setEditingWorkStyle(ws);
                              setEditingItem({ type: 'work_style', item: ws });
                            }}
                            onDelete={
                              ws.source === 'custom' && ws.customization_id
                                ? () => handleDeleteWorkStyle(ws.customization_id!)
                                : undefined
                            }
                            onRevert={
                              ws.source === 'modified' && ws.customization_id
                                ? () => handleRevertWorkStyle(ws.customization_id!)
                                : undefined
                            }
                          />
                        ))}

                      {/* Excluded Work Styles Section */}
                      {mergedWorkStyles.filter(ws => !ws.is_active).length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between text-muted-foreground hover:text-foreground"
                            onClick={() => setExcludedWorkStylesExpanded(!excludedWorkStylesExpanded)}
                          >
                            <span className="flex items-center gap-2">
                              {excludedWorkStylesExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <span>{t('roles.detail.excludedWorkStyles', { n: mergedWorkStyles.filter(ws => !ws.is_active).length })}</span>
                            </span>
                          </Button>
                          {excludedWorkStylesExpanded && (
                            <div className="mt-2 space-y-2">
                              {[...mergedWorkStyles]
                                .filter(ws => !ws.is_active)
                                .sort((a, b) => (Number(b.impact ?? 0) - Number(a.impact ?? 0)))
                                .map(ws => (
                                  <CompetencyItem
                                    key={ws.work_style_id}
                                    id={ws.work_style_id}
                                    description={ws.name}
                                    source={ws.source}
                                    isActive={ws.is_active}
                                    importance={toPercentFromFive(ws.impact)}
                                    onToggle={() => handleToggleWorkStyle(ws)}
                                    onEdit={() => {
                                      setEditingWorkStyle(ws);
                                      setEditingItem({ type: 'work_style', item: ws });
                                    }}
                                    onDelete={
                                      ws.source === 'custom' && ws.customization_id
                                        ? () => handleDeleteWorkStyle(ws.customization_id!)
                                        : undefined
                                    }
                                    onRevert={
                                      ws.source === 'modified' && ws.customization_id
                                        ? () => handleRevertWorkStyle(ws.customization_id!)
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
                    onClick={() => setShowAddWorkStyle(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('roles.detail.addCustomWorkStyle')}
                  </Button>
                </div>
              </TabsContent>

              {/* Skills Tab */}
              <TabsContent value="skills" className="mt-4">
                <div className="space-y-2">
                  {mergedSkills.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {t('roles.detail.noSkills')}
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
                              <span>{t('roles.detail.excludedSkills', { n: mergedSkills.filter(skill => !skill.is_active).length })}</span>
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
                    {t('roles.detail.addCustomSkill')}
                  </Button>
                </div>
              </TabsContent>

              {/* Knowledge Tab */}
              <TabsContent value="knowledge" className="mt-4">
                <div className="space-y-2">
                  {mergedKnowledge.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {t('roles.detail.noKnowledge')}
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
                              <span>{t('roles.detail.excludedKnowledge', { n: mergedKnowledge.filter(know => !know.is_active).length })}</span>
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
                    {t('roles.detail.addCustomKnowledge')}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('roles.saving')}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {t('common.save')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job Conditions Section */}
      {role && role.onet_code && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {t('roles.detail.jobConditions')}
                  {loadingMerged && <Loader2 className="h-4 w-4 animate-spin" />}
                </CardTitle>
                <CardDescription>
                  {t('roles.detail.jobConditionsDesc')}
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
            <Tabs defaultValue="work_context">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="work_context" className="flex items-center gap-2">
                  <HardHat className="h-4 w-4" />
                  {t('roles.detail.tabWorkContext')}
                </TabsTrigger>
                <TabsTrigger value="capabilities" className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  {t('roles.detail.tabCapabilities', { active: mergedAbilities.filter(a => a.is_active).length, total: mergedAbilities.length })}
                </TabsTrigger>
              </TabsList>

              {/* Work Context Tab */}
              <TabsContent value="work_context" className="mt-4">
                {workContextItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {t('roles.detail.noWorkContext')}
                  </p>
                ) : (
                  Object.entries(
                    workContextItems.reduce<Record<string, WorkContextItem[]>>((acc, item) => {
                      acc[item.context_category] = acc[item.context_category] || [];
                      acc[item.context_category].push(item);
                      return acc;
                    }, {})
                  ).map(([category, items]) => {
                    const expanded = workContextExpanded[category] ?? true;
                    return (
                      <div key={category} className="mb-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            setWorkContextExpanded({
                              ...workContextExpanded,
                              [category]: !expanded,
                            })
                          }
                        >
                          <span className="flex items-center gap-2">
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <span className="font-semibold">{category} ({items.length})</span>
                          </span>
                        </Button>
                        {expanded && (
                          <div className="mt-2 space-y-2">
                            {items
                              .sort((a, b) => Number(b.percentage ?? 0) - Number(a.percentage ?? 0))
                              .map((item, idx) => (
                                <div
                                  key={`${category}-${idx}-${item.context_item}`}
                                  className="flex items-center justify-between p-2 rounded-md bg-muted/40"
                                >
                                  <span className="text-sm text-foreground">{item.context_item}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {Math.round(Number(item.percentage ?? 0) * 20)}%
                                  </Badge>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </TabsContent>

              {/* Capabilities Tab (Abilities grouped by category) */}
              <TabsContent value="capabilities" className="mt-4">
                <div className="space-y-3">
                  {mergedAbilities.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {t('roles.detail.noCapabilities')}
                    </p>
                  ) : (
                    Object.entries(
                      mergedAbilities.reduce<Record<string, MergedAbility[]>>((acc, ability) => {
                        const key = ability.category || 'Other';
                        acc[key] = acc[key] || [];
                        acc[key].push(ability);
                        return acc;
                      }, {})
                    ).map(([category, abilities]) => {
                      const expanded = capabilityExpanded[category] ?? true;
                      const excludedExpanded = capabilityExcludedExpanded[category] ?? false;
                      const activeAbilities = abilities.filter(a => a.is_active);
                      const excludedAbilities = abilities.filter(a => !a.is_active);
                      return (
                        <div key={category} className="border rounded-md p-2 bg-muted/30">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between text-foreground"
                            onClick={() =>
                              setCapabilityExpanded({
                                ...capabilityExpanded,
                                [category]: !expanded,
                              })
                            }
                          >
                            <span className="flex items-center gap-2 font-semibold">
                              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {category} ({abilities.length})
                            </span>
                          </Button>
                          {expanded && (
                            <div className="mt-2 space-y-2">
                              {activeAbilities
                                .sort((a, b) => Number(b.importance ?? 0) - Number(a.importance ?? 0))
                                .map(ability => (
                                  <CompetencyItem
                                    key={ability.ability_id}
                                    id={ability.ability_id}
                                    description={ability.name}
                                    source={ability.source}
                                    isActive={ability.is_active}
                                    importance={toPercentFromFive(ability.importance)}
                                    category={ability.category || undefined}
                                    onToggle={() => handleToggleAbility(ability)}
                                    onEdit={() => {
                                      setEditingAbility(ability);
                                      setEditingItem({ type: 'ability', item: ability });
                                    }}
                                    onDelete={
                                      ability.source === 'custom' && ability.customization_id
                                        ? () => handleDeleteAbility(ability.customization_id!)
                                        : undefined
                                    }
                                    onRevert={
                                      ability.source === 'modified' && ability.customization_id
                                        ? () => handleRevertAbility(ability.customization_id!)
                                        : undefined
                                    }
                                  />
                                ))}

                              {excludedAbilities.length > 0 && (
                                <div className="mt-4 pt-4 border-t">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-between text-muted-foreground hover:text-foreground"
                                    onClick={() =>
                                      setCapabilityExcludedExpanded({
                                        ...capabilityExcludedExpanded,
                                        [category]: !excludedExpanded,
                                      })
                                    }
                                  >
                                    <span className="flex items-center gap-2">
                                      {excludedExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                      <span>
                                        {t('roles.detail.excludedCategory', { category, n: excludedAbilities.length })}
                                      </span>
                                    </span>
                                  </Button>
                                  {excludedExpanded && (
                                    <div className="mt-2 space-y-2">
                                      {excludedAbilities
                                        .sort((a, b) => Number(b.importance ?? 0) - Number(a.importance ?? 0))
                                        .map(ability => (
                                          <CompetencyItem
                                            key={ability.ability_id}
                                            id={ability.ability_id}
                                            description={ability.name}
                                            source={ability.source}
                                            isActive={ability.is_active}
                                            importance={toPercentFromFive(ability.importance)}
                                            category={ability.category || undefined}
                                            onToggle={() => handleToggleAbility(ability)}
                                            onEdit={() => {
                                              setEditingAbility(ability);
                                              setEditingItem({ type: 'ability', item: ability });
                                            }}
                                            onDelete={
                                              ability.source === 'custom' && ability.customization_id
                                                ? () => handleDeleteAbility(ability.customization_id!)
                                                : undefined
                                            }
                                            onRevert={
                                              ability.source === 'modified' && ability.customization_id
                                                ? () => handleRevertAbility(ability.customization_id!)
                                                : undefined
                                            }
                                          />
                                        ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-4"
                  onClick={() => setShowAddAbility(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('roles.detail.addCustomCapability')}
                </Button>
              </TabsContent>
            </Tabs>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('roles.saving')}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {t('common.save')}
                  </>
                )}
              </Button>
            </div>
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
        isOpen={showAddWorkStyle}
        onClose={() => setShowAddWorkStyle(false)}
        onSave={(name, impact) => handleAddWorkStyle(name, undefined, impact)}
        type="work_style"
      />
      <AddCompetencyModal
        isOpen={showAddAbility}
        onClose={() => setShowAddAbility(false)}
        onSave={(name, importance) => handleAddAbility(name, undefined, importance)}
        type="ability"
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
            setEditingAbility(null);
            setEditingSkill(null);
            setEditingKnowledge(null);
          }}
          onSave={async (customDescription, notes) => {
            if (editingItem.type === 'task') {
              await handleEditTask(editingItem.item as MergedTask, customDescription, notes);
            } else if (editingItem.type === 'work_style') {
              const workStyle = editingItem.item as MergedWorkStyle;
              await handleEditWorkStyle(workStyle, customDescription, undefined, notes);
            } else if (editingItem.type === 'ability') {
              const ability = editingItem.item as MergedAbility;
              await handleEditAbility(ability, customDescription, undefined, notes);
            } else if (editingItem.type === 'skill') {
              const skill = editingItem.item as MergedSkill;
              await handleEditSkill(skill, customDescription, undefined, notes);
            } else {
              const knowledge = editingItem.item as MergedKnowledge;
              await handleEditKnowledge(knowledge, customDescription, undefined, notes);
            }
            setEditingItem(null);
            setEditingTask(null);
            setEditingWorkStyle(null);
            setEditingAbility(null);
            setEditingSkill(null);
            setEditingKnowledge(null);
          }}
          onRevert={
            editingItem.item.customization_id
              ? async () => {
                  if (editingItem.type === 'task') {
                    await handleRevertTask(editingItem.item.customization_id!);
                  } else if (editingItem.type === 'work_style') {
                    await handleRevertWorkStyle(editingItem.item.customization_id!);
                  } else if (editingItem.type === 'ability') {
                    await handleRevertAbility(editingItem.item.customization_id!);
                  } else if (editingItem.type === 'skill') {
                    await handleRevertSkill(editingItem.item.customization_id!);
                  } else {
                    await handleRevertKnowledge(editingItem.item.customization_id!);
                  }
                  setEditingItem(null);
                  setEditingTask(null);
                  setEditingWorkStyle(null);
                  setEditingAbility(null);
                  setEditingSkill(null);
                  setEditingKnowledge(null);
                }
              : undefined
          }
          originalDescription={
            editingItem.type === 'task'
              ? (editingItem.item as MergedTask).description
              : editingItem.type === 'work_style'
              ? (editingItem.item as MergedWorkStyle).name
              : editingItem.type === 'ability'
              ? (editingItem.item as MergedAbility).name
              : editingItem.type === 'skill'
              ? (editingItem.item as MergedSkill).skill_name
              : (editingItem.item as MergedKnowledge).knowledge_name
          }
          currentDescription={
            editingItem.type === 'task'
              ? (editingItem.item as MergedTask).description
              : editingItem.type === 'work_style'
              ? (editingItem.item as MergedWorkStyle).name
              : editingItem.type === 'ability'
              ? (editingItem.item as MergedAbility).name
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
            <AlertDialogTitle>{t('roles.detail.archiveDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('roles.detail.archiveDialogDesc', { name: role?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('roles.detail.archiveBtn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

