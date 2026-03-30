import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Zap,
  Users,
  Lock,
  Album as AlbumIcon,
  Library,
  Award,
  ListChecks,
  Calendar,
  Clock,
  Plus,
  X,
  ChevronDown,
  Target,
  Settings as SettingsIcon,
  CheckCircle2,
  AlertCircle,
  Info,
  Edit,
  FileText,
  Play,
  Trash2,
  Search,
  ArrowDown,
  Download,
  AlertTriangle,
  UserCheck,
  UserMinus
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { Progress } from './ui/progress';
import { useCurrentUser, useEffectiveOrgId } from '../lib/hooks/useSupabase';
import * as crud from '../lib/crud';
import {
  runPlaylistTrigger,
  getMatchingUsersPreview,
  getMatchingUsersForExport,
  compareTriggerRulesImpact,
  archiveOrphanedAssignments,
  type MatchingUser,
  type TriggerRulesImpact
} from '../lib/crud/assignments';
import { toast } from 'sonner@2.0.3';
import { supabase } from '../lib/supabase';
import { TagSelectorDialog } from './TagSelectorDialog';
import { type Tag, assignTags, getEntityTags } from '../lib/crud/tags';

interface PlaylistWizardProps {
  onClose: () => void;
  mode?: 'create' | 'edit';
  existingPlaylistId?: string;
  isFullPage?: boolean;
  registerUnsavedChangesCheck?: (checkFn: (() => boolean) | null) => void; // Register unsaved changes check
}

const WIZARD_STEP_IDS = [
  { id: 'trigger', labelKey: 'playlists.wizard.stepAssignmentLogic', icon: Zap },
  { id: 'details', labelKey: 'playlists.wizard.stepPlaylistDetails', icon: ListChecks },
  { id: 'content-stages', labelKey: 'playlists.wizard.stepContentStages', icon: Library },
  { id: 'stage-config', labelKey: 'playlists.wizard.stepStageDelivery', icon: Lock },
  { id: 'completion', labelKey: 'playlists.wizard.stepCompletionActions', icon: Award },
  { id: 'review', labelKey: 'playlists.wizard.stepReviewPublish', icon: CheckCircle2 },
];

// Fallback data for dropdowns (used if database fetch fails)
const FALLBACK_ROLES = ['Store Manager', 'Sales Associate', 'Assistant Manager', 'Department Lead', 'Cashier', 'Stock Clerk'];
const DEPARTMENTS = ['Front End', 'Grocery', 'Deli', 'Bakery', 'Meat', 'Produce', 'Management'];
const LOCATIONS = ['Store #001 - Downtown', 'Store #002 - Westside', 'Store #003 - Northgate', 'Store #004 - Southpoint'];
const EMPLOYMENT_TYPES = ['Full-Time', 'Part-Time', 'Seasonal', 'Temporary'];

// Mock employee data
const MOCK_EMPLOYEES = [
  { id: 'e1', name: 'Sarah Johnson', role: 'Store Manager', location: 'Store #001 - Downtown', district: 'Central', state: 'CA' },
  { id: 'e2', name: 'Mike Chen', role: 'Sales Associate', location: 'Store #001 - Downtown', district: 'Central', state: 'CA' },
  { id: 'e3', name: 'Emily Rodriguez', role: 'Assistant Manager', location: 'Store #002 - Westside', district: 'West', state: 'CA' },
  { id: 'e4', name: 'James Wilson', role: 'Department Lead', location: 'Store #003 - Northgate', district: 'North', state: 'CA' },
  { id: 'e5', name: 'Amanda Brown', role: 'Cashier', location: 'Store #001 - Downtown', district: 'Central', state: 'CA' },
  { id: 'e6', name: 'David Lee', role: 'Stock Clerk', location: 'Store #002 - Westside', district: 'West', state: 'CA' },
  { id: 'e7', name: 'Lisa Martinez', role: 'Sales Associate', location: 'Store #003 - Northgate', district: 'North', state: 'CA' },
  { id: 'e8', name: 'Robert Taylor', role: 'Assistant Manager', location: 'Store #004 - Southpoint', district: 'South', state: 'CA' },
  { id: 'e9', name: 'Jennifer Davis', role: 'Department Lead', location: 'Store #001 - Downtown', district: 'Central', state: 'CA' },
  { id: 'e10', name: 'Chris Anderson', role: 'Sales Associate', location: 'Store #004 - Southpoint', district: 'South', state: 'CA' },
];

// Mock data for available assignments
const AVAILABLE_ASSIGNMENTS = [
  { id: 'form1', title: 'CSR Day 1 Manager Verification Checklist', type: 'Form' },
  { id: 'form2', title: 'Food Handling Observation Form', type: 'Form' },
  { id: 'form3', title: 'POS System Proficiency Assessment', type: 'Form' },
  { id: 'form4', title: 'Safety Protocol Sign-off', type: 'Form' },
  { id: 'ojt1', title: 'Register Training OJT', type: 'OJT Form' },
  { id: 'ojt2', title: 'Opening Procedures OJT', type: 'OJT Form' }
];

// Mock data for content selection
const AVAILABLE_ALBUMS = [
  { id: 'a1', title: 'Basic Store Safety', trackCount: 6, duration: '45 min', category: 'Safety' },
  { id: 'a2', title: 'POS System Training', trackCount: 8, duration: '60 min', category: 'Technology' },
  { id: 'a3', title: 'Customer Service Excellence', trackCount: 5, duration: '35 min', category: 'Customer Service' },
  { id: 'a4', title: 'Food Handler Certification', trackCount: 12, duration: '90 min', category: 'Compliance' },
  { id: 'a5', title: 'Workplace Standards', trackCount: 8, duration: '60 min', category: 'Policy' },
  { id: 'a6', title: 'Emergency Procedures', trackCount: 4, duration: '30 min', category: 'Safety' },
];

const AVAILABLE_TRACKS = [
  { id: 't1', title: 'Welcome to the Team', duration: '8 min', type: 'Video', category: 'Onboarding' },
  { id: 't2', title: 'Company Culture & Values', duration: '12 min', type: 'Story', category: 'Onboarding' },
  { id: 't3', title: 'Introduction to Store Operations', duration: '15 min', type: 'Form', category: 'Operations' },
  { id: 't4', title: 'Cash Handling Best Practices', duration: '10 min', type: 'Video', category: 'Operations' },
  { id: 't5', title: 'Employee Handbook Overview', duration: '20 min', type: 'Article', category: 'Policy' },
  { id: 't6', title: 'Health & Safety Guidelines', duration: '15 min', type: 'Article', category: 'Safety' },
  { id: 't7', title: 'Customer Service Standards', duration: '18 min', type: 'Article', category: 'Customer Service' },
];

// Tags that match existing patterns
// const AVAILABLE_TAGS = ['onboarding', 'compliance', 'safety', 'customer-service', 'leadership', 'technology', 'operations', 'policy'];

export function PlaylistWizard({ onClose, mode = 'create', existingPlaylistId, isFullPage = false, registerUnsavedChangesCheck }: PlaylistWizardProps) {
  const { t } = useTranslation();
  const WIZARD_STEPS = WIZARD_STEP_IDS.map(s => ({ ...s, label: t(s.labelKey) }));
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);
  
  // Track original state for unsaved changes detection
  const [originalState, setOriginalState] = useState<any>(null);
  
  // Form state
  const [assignmentType, setAssignmentType] = useState<'auto' | 'manual'>('auto');
  const [triggerConditions, setTriggerConditions] = useState<any[]>([
    { field: 'role', operator: 'equals', value: '' }
  ]);
  const [startImmediately, setStartImmediately] = useState(true);
  const [startDelayDays, setStartDelayDays] = useState(14);
  
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const [playlistTags, setPlaylistTags] = useState<string[]>([]);
  const [selectedTagObjects, setSelectedTagObjects] = useState<Tag[]>([]);
  
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [employeeFilterRole, setEmployeeFilterRole] = useState('all');
  const [employeeFilterLocation, setEmployeeFilterLocation] = useState('all');
  
  const [contentSearchTerm, setContentSearchTerm] = useState('');
  
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [stages, setStages] = useState<any[]>([
    { 
      id: 's1',
      name: 'Stage 1', 
      albums: [], 
      tracks: [],
      unlockType: 'immediate',
      unlockDays: 0,
      unlockAfterStage: '',
      unlockAssignment: '',
      unlockAssignmentCompleter: 'learner',
      allowManagerOverride: false,
      allowAdminOverride: true,
      notifyOnUnlock: false
    }
  ]);
  
  const [completionActions, setCompletionActions] = useState<any[]>([]);
  const [completionThreshold, setCompletionThreshold] = useState(100);
  const [minQuizScore, setMinQuizScore] = useState(80);
  const [minFinalScore, setMinFinalScore] = useState(85);
  const [completionDeadlineDays, setCompletionDeadlineDays] = useState(30);

  // Required form state
  const [requiredFormId, setRequiredFormId] = useState<string>('');
  const [formCompletionMode, setFormCompletionMode] = useState<'optional' | 'required' | 'required_before_completion'>('optional');
  const [availableForms, setAvailableForms] = useState<Array<{ id: string; title: string; type: string }>>([]);
  const [loadingForms, setLoadingForms] = useState(false);

  // Matching users preview state
  const [matchingUsers, setMatchingUsers] = useState<MatchingUser[]>([]);
  const [matchingUsersCount, setMatchingUsersCount] = useState(0);
  const [matchingUsersLoading, setMatchingUsersLoading] = useState(false);

  // Edit mode: trigger rules impact state
  const [originalTriggerRules, setOriginalTriggerRules] = useState<any>(null);
  const [triggerRulesImpact, setTriggerRulesImpact] = useState<{
    orphaned: TriggerRulesImpact[];
    newMatches: TriggerRulesImpact[];
  } | null>(null);
  const [keepOrphanedAssignments, setKeepOrphanedAssignments] = useState(true);
  const [loadingImpact, setLoadingImpact] = useState(false);

  // Dynamically loaded roles from database
  const [availableRoles, setAvailableRoles] = useState<string[]>(FALLBACK_ROLES);
  const [rolesLoading, setRolesLoading] = useState(true);

  const isStepComplete = (stepIndex: number) => {
    switch (stepIndex) {
      case 0: // Trigger
        if (assignmentType === 'manual') return selectedEmployees.length > 0;
        return triggerConditions.some(c => c.value !== '');
      case 1: // Details
        return playlistName.trim() !== '';
      case 2: // Content & Stages
        return stages.some(s => s.albums.length > 0 || s.tracks.length > 0);
      case 3: // Stage Config
        return true;
      case 4: // Completion
        return true;
      case 5: // Review
        return true;
      default:
        return false;
    }
  };

  const canProceed = isStepComplete(currentStep);

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const { user } = useCurrentUser();
  const { orgId: effectiveOrgId } = useEffectiveOrgId();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [albums, setAlbums] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);

  // Fetch roles from database - run FIRST before other data loads
  useEffect(() => {
    const fetchRoles = async () => {
      if (!effectiveOrgId) return;

      setRolesLoading(true);
      try {
        const { data: roles, error } = await supabase
          .from('roles')
          .select('id, name')
          .eq('organization_id', effectiveOrgId)
          .order('name');

        if (!error && roles && roles.length > 0) {
          // Use role names for display and matching
          setAvailableRoles(roles.map(r => r.name));
          console.log('🎭 Loaded', roles.length, 'roles from database');
        } else {
          console.log('⚠️ No roles found, using fallback roles');
        }
      } catch (error) {
        console.error('Error fetching roles:', error);
      } finally {
        setRolesLoading(false);
      }
    };

    fetchRoles();
  }, [effectiveOrgId]);

  // Fetch published forms for the required-form selector
  useEffect(() => {
    const fetchForms = async () => {
      if (!effectiveOrgId) return;
      setLoadingForms(true);
      try {
        const data = await crud.getForms({ status: 'published' });
        setAvailableForms((data || []).map((f: any) => ({ id: f.id, title: f.title, type: f.type })));
      } catch (err) {
        console.error('Error fetching forms:', err);
      } finally {
        setLoadingForms(false);
      }
    };
    fetchForms();
  }, [effectiveOrgId]);

  // Fetch real employees from database
  useEffect(() => {
    const fetchEmployees = async () => {
      if (!effectiveOrgId) return;

      setLoadingEmployees(true);
      try {
        const data = await crud.getUsers({ status: 'active' });
        setEmployees(data || []);
      } catch (error) {
        console.error('Error fetching employees:', error);
        toast.error('Failed to load employees');
      } finally {
        setLoadingEmployees(false);
      }
    };

    fetchEmployees();
  }, [effectiveOrgId]);

  // Fetch real albums and tracks from database
  useEffect(() => {
    const fetchContent = async () => {
      if (!effectiveOrgId) return;

      setLoadingContent(true);
      try {
        // Fetch albums (only published)
        const albumsData = await crud.getAlbums({ status: 'published' });
        setAlbums(albumsData || []);

        // Fetch tracks (only published)
        const tracksData = await crud.getTracks({ status: 'published' });
        setTracks(tracksData || []);
      } catch (error) {
        console.error('Error fetching content:', error);
        toast.error('Failed to load content');
      } finally {
        setLoadingContent(false);
      }
    };

    fetchContent();
  }, [effectiveOrgId]);

  // Build trigger rules from conditions (helper function)
  const buildTriggerRules = useCallback(() => {
    const rules: any = {};
    triggerConditions.forEach(condition => {
      if (condition.value) {
        if (condition.field === 'role') {
          rules.role_ids = rules.role_ids || [];
          rules.role_ids.push(condition.value);
        } else if (condition.field === 'hire-date') {
          rules.hire_days = parseInt(condition.value) || 7;
        } else if (condition.field === 'location') {
          rules.store_ids = rules.store_ids || [];
          rules.store_ids.push(condition.value);
        } else if (condition.field === 'department') {
          rules.department_ids = rules.department_ids || [];
          rules.department_ids.push(condition.value);
        }
      }
    });
    return Object.keys(rules).length > 0 ? rules : null;
  }, [triggerConditions]);

  // Fetch matching users when trigger conditions change (for auto-assignment preview)
  useEffect(() => {
    const fetchMatchingUsers = async () => {
      if (assignmentType !== 'auto') {
        setMatchingUsers([]);
        setMatchingUsersCount(0);
        return;
      }

      const triggerRules = buildTriggerRules();
      console.log('🎯 Built trigger rules:', triggerRules);
      console.log('🎯 Current trigger conditions:', triggerConditions);

      if (!triggerRules) {
        setMatchingUsers([]);
        setMatchingUsersCount(0);
        return;
      }

      setMatchingUsersLoading(true);
      try {
        console.log('📡 Calling getMatchingUsersPreview with:', triggerRules);
        const result = await getMatchingUsersPreview(triggerRules, 20);
        console.log('📡 Result:', result);
        setMatchingUsers(result.users);
        setMatchingUsersCount(result.totalCount);
      } catch (error) {
        console.error('Error fetching matching users:', error);
        // Don't show toast for preview errors - just fail silently
      } finally {
        setMatchingUsersLoading(false);
      }
    };

    // Debounce the fetch
    const timeoutId = setTimeout(fetchMatchingUsers, 500);
    return () => clearTimeout(timeoutId);
  }, [assignmentType, triggerConditions, buildTriggerRules]);

  // In edit mode, compare trigger rules impact when they change
  useEffect(() => {
    const checkTriggerRulesImpact = async () => {
      if (mode !== 'edit' || !existingPlaylistId || assignmentType !== 'auto') {
        setTriggerRulesImpact(null);
        return;
      }

      // Only check if we have original rules to compare against
      if (!originalTriggerRules) return;

      const newRules = buildTriggerRules();
      if (!newRules) {
        setTriggerRulesImpact(null);
        return;
      }

      // Check if rules actually changed
      const rulesChanged = JSON.stringify(originalTriggerRules) !== JSON.stringify(newRules);
      if (!rulesChanged) {
        setTriggerRulesImpact(null);
        return;
      }

      setLoadingImpact(true);
      try {
        const impact = await compareTriggerRulesImpact(existingPlaylistId, newRules);
        setTriggerRulesImpact(impact);
      } catch (error) {
        console.error('Error comparing trigger rules impact:', error);
      } finally {
        setLoadingImpact(false);
      }
    };

    const timeoutId = setTimeout(checkTriggerRulesImpact, 500);
    return () => clearTimeout(timeoutId);
  }, [mode, existingPlaylistId, assignmentType, triggerConditions, originalTriggerRules, buildTriggerRules]);

  // CSV export function
  const handleExportMatchingUsersCSV = async () => {
    try {
      const triggerRules = buildTriggerRules();
      if (!triggerRules) return;

      const users = await getMatchingUsersForExport(triggerRules);

      // Build CSV content
      const headers = ['Name', 'Email', 'Role', 'Location', 'Hire Date'];
      const rows = users.map(u => [
        `${u.first_name} ${u.last_name}`,
        u.email,
        u.role_name || '',
        u.store_name || '',
        u.hire_date || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `matching-employees-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      toast.success(t('playlists.wizard.exportedEmployeesCsv', { count: users.length }));
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error(t('playlists.failedExportCsv'));
    }
  };

        // Load existing playlist data when in edit mode
  useEffect(() => {
    const loadPlaylist = async () => {
      if (!existingPlaylistId || mode !== 'edit' || !effectiveOrgId) return;
      
      setIsLoadingPlaylist(true);
      try {
        const playlist = await crud.getPlaylistById(existingPlaylistId);
        if (!playlist) {
          toast.error(t('playlists.failedLoadPlaylistDetails'));
          return;
        }

        console.log('📂 Loading playlist for editing:', playlist);

        // Set basic details
        setPlaylistName(playlist.title || '');
        setPlaylistDescription(playlist.description || '');
        setAssignmentType(playlist.type || 'manual');
        
        // Load tags - store in variable for use in originalState
        let loadedTags: any[] = [];
        try {
          loadedTags = await getEntityTags(existingPlaylistId, 'playlist');
          console.log('🏷️ Loaded playlist tags:', loadedTags);
          setPlaylistTags(loadedTags.map(t => t.name));
          setSelectedTagObjects(loadedTags);
        } catch (error) {
          console.error('Error loading playlist tags:', error);
          // Clear tag state on error to avoid stale data
          setPlaylistTags([]);
          setSelectedTagObjects([]);
        }

        // Set trigger conditions for auto playlists
        let loadedTriggerConditions = [{ field: 'role', operator: 'equals', value: '' }];
        if (playlist.type === 'auto' && playlist.trigger_rules) {
          // Save original trigger rules for impact comparison
          setOriginalTriggerRules(playlist.trigger_rules);

          // Parse role_ids into trigger conditions
          if (playlist.trigger_rules.role_ids && playlist.trigger_rules.role_ids.length > 0) {
            loadedTriggerConditions = playlist.trigger_rules.role_ids.map((roleId: string) => ({
              field: 'role',
              operator: 'equals',
              value: roleId
            }));
            console.log('🎯 Loaded trigger conditions:', loadedTriggerConditions);
          }
        }
        setTriggerConditions(loadedTriggerConditions);

        // Load assigned employees for manual playlists
        let loadedEmployeeIds: string[] = [];
        if (playlist.type === 'manual') {
          const { data: assignments } = await supabase
            .from('assignments')
            .select('user_id')
            .eq('playlist_id', existingPlaylistId)
            .eq('organization_id', effectiveOrgId);

          if (assignments && assignments.length > 0) {
            loadedEmployeeIds = assignments.map(a => a.user_id);
            setSelectedEmployees(loadedEmployeeIds);
            console.log('👥 Loaded', loadedEmployeeIds.length, 'assigned employees');
          }
        }

        // Load stages from release_schedule if available
        let loadedStages: any[] = [];

        if (playlist.release_schedule?.stages && playlist.release_schedule.stages.length > 0) {
          // Load stages from the saved release_schedule
          loadedStages = playlist.release_schedule.stages.map((stage: any) => ({
            id: stage.id || `s${Math.random().toString(36).substr(2, 9)}`,
            name: stage.name || 'Stage',
            albums: stage.albumIds || [],
            tracks: stage.trackIds || [],
            unlockType: stage.unlockDays > 0 ? 'days-after-stage' : 'immediate',
            unlockDays: stage.unlockDays || 0,
            unlockAfterStage: stage.unlockAfterStage || '',
            unlockAssignment: '',
            unlockAssignmentCompleter: 'learner',
            allowManagerOverride: false,
            allowAdminOverride: true,
            notifyOnUnlock: stage.notifyOnUnlock || false,
          }));
          console.log('📊 Loaded', loadedStages.length, 'stages from release_schedule');
        } else {
          // Fallback: create a single stage with all content
          loadedStages = [{
            id: 's1',
            name: 'Stage 1',
            albums: playlist.album_ids || [],
            tracks: playlist.standalone_track_ids || [],
            unlockType: 'immediate',
            unlockDays: 0,
            unlockAfterStage: '',
            unlockAssignment: '',
            unlockAssignmentCompleter: 'learner',
            allowManagerOverride: false,
            allowAdminOverride: true,
          }];
          console.log('📊 Created fallback stage with', playlist.album_ids?.length || 0, 'albums,', playlist.standalone_track_ids?.length || 0, 'tracks');
        }

        setStages(loadedStages);

        // Load required form settings
        setRequiredFormId(playlist.required_form_id || '');
        setFormCompletionMode(playlist.form_completion_mode || 'optional');

        // Save original state for unsaved changes detection
        setOriginalState({
          playlistName: playlist.title || '',
          playlistDescription: playlist.description || '',
          assignmentType: playlist.type || 'manual',
          playlistTags: loadedTags.map(t => t.name),
          triggerConditions: loadedTriggerConditions,
          selectedEmployees: loadedEmployeeIds,
          stages: loadedStages,
          startImmediately,
          startDelayDays,
          completionThreshold,
          minQuizScore,
          minFinalScore,
          completionDeadlineDays,
          completionActions: []
        });
        
        toast.success(t('playlists.wizard.playlistLoadedForEditing'));
      } catch (error) {
        console.error('Error loading playlist:', error);
        toast.error(t('playlists.failedLoadPlaylistDetails'));
      } finally {
        setIsLoadingPlaylist(false);
      }
    };
    
    loadPlaylist();
  }, [existingPlaylistId, mode, effectiveOrgId]);
  
  // Save initial state for create mode
  useEffect(() => {
    if (mode === 'create' && !originalState) {
      setOriginalState({
        playlistName: '',
        playlistDescription: '',
        assignmentType: 'auto',
        playlistTags: [],
        triggerConditions: [{ field: 'role', operator: 'equals', value: '' }],
        selectedEmployees: [],
        stages: [{ 
          id: 's1',
          name: 'Stage 1', 
          albums: [], 
          tracks: [],
          unlockType: 'immediate',
          unlockDays: 0,
          unlockAfterStage: '',
          unlockAssignment: '',
          unlockAssignmentCompleter: 'learner',
          allowManagerOverride: false,
          allowAdminOverride: true,
          notifyOnUnlock: false
        }],
        startImmediately: true,
        startDelayDays: 14,
        completionThreshold: 100,
        minQuizScore: 80,
        minFinalScore: 85,
        completionDeadlineDays: 30,
        completionActions: []
      });
    }
  }, [mode, originalState]);
  
  // Check for unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    if (!originalState) return false;
    
    // Helper to compare arrays
    const arraysEqual = (a: any[], b: any[]) => {
      if (a.length !== b.length) return false;
      const sortedA = [...a].sort();
      const sortedB = [...b].sort();
      return sortedA.every((val, idx) => val === sortedB[idx]);
    };
    
    // Helper to compare stages
    const stagesEqual = (a: any[], b: any[]) => {
      if (a.length !== b.length) return false;
      return a.every((stageA, idx) => {
        const stageB = b[idx];
        return stageA.name === stageB.name &&
               arraysEqual(stageA.albums || [], stageB.albums || []) &&
               arraysEqual(stageA.tracks || [], stageB.tracks || []) &&
               stageA.unlockType === stageB.unlockType &&
               stageA.unlockDays === stageB.unlockDays;
      });
    };
    
    return (
      playlistName !== originalState.playlistName ||
      playlistDescription !== originalState.playlistDescription ||
      assignmentType !== originalState.assignmentType ||
      !arraysEqual(playlistTags, originalState.playlistTags) ||
      !arraysEqual(selectedEmployees, originalState.selectedEmployees) ||
      !stagesEqual(stages, originalState.stages) ||
      startImmediately !== originalState.startImmediately ||
      startDelayDays !== originalState.startDelayDays ||
      completionThreshold !== originalState.completionThreshold ||
      minQuizScore !== originalState.minQuizScore ||
      minFinalScore !== originalState.minFinalScore ||
      completionDeadlineDays !== originalState.completionDeadlineDays ||
      completionActions.length !== originalState.completionActions.length
    );
  }, [originalState, playlistName, playlistDescription, assignmentType, playlistTags, selectedEmployees, stages, startImmediately, startDelayDays, completionThreshold, minQuizScore, minFinalScore, completionDeadlineDays, completionActions.length]);
  
  // Register unsaved changes check with parent
  useEffect(() => {
    if (registerUnsavedChangesCheck) {
      registerUnsavedChangesCheck(hasUnsavedChanges);
    }
    
    // Cleanup on unmount
    return () => {
      if (registerUnsavedChangesCheck) {
        registerUnsavedChangesCheck(null);
      }
    };
  }, [registerUnsavedChangesCheck, hasUnsavedChanges]);

  const addTriggerCondition = () => {
    setTriggerConditions([...triggerConditions, { field: 'role', operator: 'equals', value: '' }]);
  };

  const removeTriggerCondition = (index: number) => {
    setTriggerConditions(triggerConditions.filter((_, i) => i !== index));
  };

  const updateTriggerCondition = (index: number, field: string, value: any) => {
    const updated = [...triggerConditions];
    updated[index] = { ...updated[index], [field]: value };
    setTriggerConditions(updated);
  };

  const handlePublishPlaylist = async () => {
    if (!user || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Debug: log stages state before collecting IDs
      console.log('🔍 Stages before collecting IDs:', JSON.stringify(stages, null, 2));

      // Collect album and track IDs from all stages
      const allAlbumIds: string[] = [];
      const allTrackIds: string[] = [];

      stages.forEach((stage, stageIndex) => {
        console.log(`🔍 Stage ${stageIndex} albums:`, stage.albums);
        console.log(`🔍 Stage ${stageIndex} tracks:`, stage.tracks);

        // Albums can be stored as IDs (strings) or objects with id property
        (stage.albums || []).forEach((album: any) => {
          const albumId = typeof album === 'string' ? album : album?.id;
          if (albumId && !allAlbumIds.includes(albumId)) {
            allAlbumIds.push(albumId);
          }
        });
        // Tracks can be stored as IDs (strings) or objects with id property
        (stage.tracks || []).forEach((track: any) => {
          const trackId = typeof track === 'string' ? track : track?.id;
          if (trackId && !allTrackIds.includes(trackId)) {
            allTrackIds.push(trackId);
          }
        });
      });

      console.log('🔍 Collected allAlbumIds:', allAlbumIds);
      console.log('🔍 Collected allTrackIds:', allTrackIds);

      // Build trigger rules for auto-assignment
      let triggerRules = null;
      if (assignmentType === 'auto') {
        triggerRules = {
          // Store due_days for calculating assignment due dates
          due_days: completionDeadlineDays,
        };
        triggerConditions.forEach(condition => {
          if (condition.value) {
            if (condition.field === 'role') {
              triggerRules.role_ids = triggerRules.role_ids || [];
              // Note: This would need to map role names to role IDs from the database
              // For now, we'll store the role name
              triggerRules.role_ids.push(condition.value);
            } else if (condition.field === 'hire_date') {
              triggerRules.hire_days = parseInt(condition.value) || 7;
            } else if (condition.field === 'location') {
              triggerRules.store_ids = triggerRules.store_ids || [];
              triggerRules.store_ids.push(condition.value);
            } else if (condition.field === 'department') {
              triggerRules.department_ids = triggerRules.department_ids || [];
              triggerRules.department_ids.push(condition.value);
            }
          }
        });
      }

      // Build release schedule for progressive playlists
      // Store full stage data including names and content associations
      let releaseSchedule = null;
      const releaseType = stages.length > 1 && stages.some(s => s.unlockType !== 'immediate')
        ? 'progressive'
        : 'immediate';

      if (releaseType === 'progressive' || stages.length > 0) {
        // Store full stage data for display in view mode
        releaseSchedule = {
          stages: stages.map((stage, index) => ({
            id: stage.id,
            name: stage.name || `Stage ${index + 1}`,
            unlockDays: stage.unlockDays || 0,
            unlockType: stage.unlockType || 'immediate',
            albumIds: stage.albums.map((a: any) => typeof a === 'string' ? a : a.id),
            trackIds: stage.tracks.map((t: any) => typeof t === 'string' ? t : t.id),
          })),
        };
      }

      // 1. Create or update the playlist
      console.log(mode === 'edit' ? '📝 Updating playlist:' : '📝 Creating playlist:', {
        title: playlistName,
        description: playlistDescription,
        type: assignmentType,
        album_count: allAlbumIds.length,
        track_count: allTrackIds.length,
      });

      let playlist;
      if (mode === 'edit' && existingPlaylistId) {
        // Update existing playlist
        playlist = await crud.updatePlaylist(existingPlaylistId, {
          title: playlistName,
          description: playlistDescription,
          type: assignmentType,
          trigger_rules: triggerRules,
          release_type: releaseType,
          release_schedule: releaseSchedule,
          album_ids: allAlbumIds,
          track_ids: allTrackIds,
          required_form_id: requiredFormId || null,
          form_completion_mode: formCompletionMode,
        });
      } else {
        // Create new playlist
        playlist = await crud.createPlaylist({
          title: playlistName,
          description: playlistDescription,
          type: assignmentType,
          trigger_rules: triggerRules,
          release_type: releaseType,
          release_schedule: releaseSchedule,
          album_ids: allAlbumIds,
          track_ids: allTrackIds,
          required_form_id: requiredFormId || null,
          form_completion_mode: formCompletionMode,
        });
      }

      console.log(mode === 'edit' ? '✅ Playlist updated:' : '✅ Playlist created:', playlist.id);

      // 1.5 Assign Tags
      // Always use selectedTagObjects if available (has IDs), otherwise use playlistTags to fetch IDs
      if (selectedTagObjects.length > 0) {
        const tagIds = selectedTagObjects.map(t => t.id);
        console.log('🏷️ Assigning tags to playlist:', tagIds);
        await assignTags(playlist.id, 'playlist', tagIds);
      } else if (playlistTags.length > 0) {
        // Fallback: if we have tag names but not objects, try to find them
        // This shouldn't happen in normal flow, but handle it gracefully
        console.warn('⚠️ Have tag names but no tag objects, skipping tag assignment');
        // Clear tags to avoid stale data
        await assignTags(playlist.id, 'playlist', []);
      } else {
        // Clear tags if none selected
        console.log('🏷️ No tags selected, clearing playlist tags');
        await assignTags(playlist.id, 'playlist', []);
      }

      // 2. Handle assignments based on type
      if (assignmentType === 'manual' && selectedEmployees.length > 0) {
        // Manual assignment: assign to selected employees
        console.log(`📋 ${mode === 'edit' ? 'Updating' : 'Creating'} ${selectedEmployees.length} assignments...`);

        // Calculate due date based on completion deadline
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + completionDeadlineDays);

        if (mode === 'edit' && existingPlaylistId) {
          // In edit mode, delete existing assignments and recreate them
          await supabase
            .from('assignments')
            .delete()
            .eq('playlist_id', existingPlaylistId);
        }

        const assignmentRecords = selectedEmployees.map(userId => ({
          organization_id: effectiveOrgId,
          user_id: userId,
          playlist_id: playlist.id,
          status: 'assigned',
          progress_percent: 0,
          due_date: dueDate.toISOString(),
        }));

        const { error: assignmentError } = await supabase
          .from('assignments')
          .insert(assignmentRecords);

        if (assignmentError) {
          console.error('Assignment error:', assignmentError);
          throw assignmentError;
        }

        console.log('✅ All assignments created');
      } else if (assignmentType === 'auto' && triggerRules) {
        // Handle orphaned assignments in edit mode if user chose to archive them
        if (mode === 'edit' && !keepOrphanedAssignments && triggerRulesImpact?.orphaned.length) {
          console.log('🗄️ Archiving orphaned assignments...');
          try {
            const orphanedUserIds = triggerRulesImpact.orphaned.map(u => u.user_id);
            const archivedCount = await archiveOrphanedAssignments(existingPlaylistId!, orphanedUserIds);
            console.log(`✅ Archived ${archivedCount} orphaned assignments`);
          } catch (archiveError) {
            console.error('⚠️ Failed to archive orphaned assignments:', archiveError);
          }
        }

        // Auto-assignment: run trigger to assign to all current matching users
        console.log('🎯 Running auto-assignment trigger for current matching users...');
        try {
          const assignments = await runPlaylistTrigger(playlist.id);
          console.log(`✅ Auto-assigned to ${assignments.length} matching users`);
        } catch (triggerError) {
          // Log but don't fail - playlist is still created, trigger can be run later
          console.error('⚠️ Auto-assignment trigger failed:', triggerError);
        }
      }

      // Build success message
      let successDescription = '';
      if (assignmentType === 'manual') {
        successDescription = t('playlists.wizard.assignedToEmployees', { count: selectedEmployees.length });
      } else if (assignmentType === 'auto') {
        successDescription = t('playlists.wizard.autoAssignedDesc');
      }

      toast.success(t(mode === 'edit' ? 'playlists.wizard.playlistUpdatedSuccess' : 'playlists.wizard.playlistPublishedSuccess', { name: playlistName }), {
        description: successDescription,
      });

      // Clear unsaved changes check before closing to allow navigation
      if (registerUnsavedChangesCheck) {
        registerUnsavedChangesCheck(null);
      }

      // Close the wizard
      onClose();
    } catch (error) {
      console.error('❌ Error publishing playlist:', error);
      toast.error(t('playlists.wizard.failedPublishPlaylist'), {
        description: error instanceof Error ? error.message : t('playlists.wizard.pleaseTryAgain'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFieldOptions = (field: string) => {
    switch (field) {
      case 'role': return availableRoles;
      case 'department': return DEPARTMENTS;
      case 'location': return LOCATIONS;
      case 'employment-type': return EMPLOYMENT_TYPES;
      default: return [];
    }
  };

  const addStage = () => {
    const newStage = {
      id: `s${stages.length + 1}`,
      name: `Stage ${stages.length + 1}`,
      albums: [],
      tracks: [],
      unlockType: 'days-after-trigger',
      unlockDays: stages.length * 7,
      unlockAfterStage: stages.length > 0 ? stages[stages.length - 1].id : '',
      unlockAssignment: '',
      unlockAssignmentCompleter: 'learner',
      allowManagerOverride: false,
      allowAdminOverride: true,
      notifyOnUnlock: false
    };
    setStages([...stages, newStage]);
    setActiveStageIndex(stages.length);
  };

  const removeStage = (index: number) => {
    if (stages.length > 1) {
      const updated = stages.filter((_, i) => i !== index);
      setStages(updated);
      if (activeStageIndex >= updated.length) {
        setActiveStageIndex(updated.length - 1);
      }
    }
  };

  const updateStage = (index: number, updates: any) => {
    const updated = [...stages];
    updated[index] = { ...updated[index], ...updates };
    setStages(updated);
  };

  const toggleAlbumInStage = (stageIndex: number, albumId: string) => {
    const stage = stages[stageIndex];
    const albums = stage.albums.includes(albumId)
      ? stage.albums.filter((id: string) => id !== albumId)
      : [...stage.albums, albumId];
    console.log(`📀 toggleAlbumInStage: stageIndex=${stageIndex}, albumId=${albumId}, newAlbums=`, albums);
    updateStage(stageIndex, { albums });
  };

  const toggleTrackInStage = (stageIndex: number, trackId: string) => {
    const stage = stages[stageIndex];
    const tracks = stage.tracks.includes(trackId)
      ? stage.tracks.filter((id: string) => id !== trackId)
      : [...stage.tracks, trackId];
    updateStage(stageIndex, { tracks });
  };

  const addCompletionAction = (type: string) => {
    const newAction: any = { type };
    
    if (type === 'credential') {
      newAction.credentialName = '';
      newAction.expirationMonths = 24;
    } else if (type === 'next-playlist') {
      newAction.playlistId = '';
      newAction.delayDays = 7;
    } else if (type === 'notification') {
      newAction.recipient = 'manager';
      newAction.message = '';
    }
    
    setCompletionActions([...completionActions, newAction]);
  };

  const removeCompletionAction = (index: number) => {
    setCompletionActions(completionActions.filter((_, i) => i !== index));
  };

  const handleTagsChange = (newTags: string[], newTagObjects?: Tag[]) => {
    console.log('🏷️ Tags changed:', { newTags, newTagObjects });
    setPlaylistTags(newTags);
    if (newTagObjects && newTagObjects.length > 0) {
      setSelectedTagObjects(newTagObjects);
    } else {
      // If no tag objects provided but we have tag names, clear tag objects
      // This ensures we don't have stale tag objects
      setSelectedTagObjects([]);
    }
  };

  const getTotalContentInStage = (stage: any) => {
    const albumTracks = stage.albums.reduce((acc: number, albumId: string) => {
      // Use real albums state instead of mock data
      const album = albums.find(a => a.id === albumId);
      // Use track_count if available, otherwise count album_tracks array
      const trackCount = album?.track_count ?? album?.album_tracks?.length ?? 0;
      return acc + trackCount;
    }, 0);
    return albumTracks + stage.tracks.length;
  };

  const getTotalContent = () => {
    return stages.reduce((acc, stage) => acc + getTotalContentInStage(stage), 0);
  };

  const getFilteredEmployees = () => {
    return employees.filter(emp => {
      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
      const matchesSearch = fullName.includes(employeeSearchTerm.toLowerCase()) || 
                            emp.email?.toLowerCase().includes(employeeSearchTerm.toLowerCase());
      const matchesRole = employeeFilterRole === 'all' || emp.role?.name === employeeFilterRole;
      const matchesLocation = employeeFilterLocation === 'all' || emp.store?.name === employeeFilterLocation;
      return matchesSearch && matchesRole && matchesLocation;
    });
  };

  const toggleEmployee = (empId: string) => {
    if (selectedEmployees.includes(empId)) {
      setSelectedEmployees(selectedEmployees.filter(id => id !== empId));
    } else {
      setSelectedEmployees([...selectedEmployees, empId]);
    }
  };

  const getFilteredAlbums = () => {
    if (!contentSearchTerm) return albums;
    return albums.filter(album =>
      album.title?.toLowerCase().includes(contentSearchTerm.toLowerCase()) ||
      album.description?.toLowerCase().includes(contentSearchTerm.toLowerCase())
    );
  };

  const getFilteredTracks = () => {
    if (!contentSearchTerm) return tracks;
    return tracks.filter(track =>
      track.title?.toLowerCase().includes(contentSearchTerm.toLowerCase()) ||
      track.type?.toLowerCase().includes(contentSearchTerm.toLowerCase())
    );
  };

  const getTriggerSummary = () => {
    if (assignmentType === 'manual') {
      return t('playlists.wizard.manuallyAssigned', { count: selectedEmployees.length });
    }
    const validConditions = triggerConditions.filter(c => c.value !== '');
    if (validConditions.length === 0) return t('playlists.noTriggerConditions');
    return validConditions.map(c => `${c.field} ${c.operator} "${c.value}"`).join(' AND ');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Trigger
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">{t('playlists.wizard.stepAssignmentLogic')}</h2>
              <p className="text-muted-foreground">
                {t('playlists.wizard.assignmentLogicDesc')}
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('playlists.wizard.assignmentType')}</CardTitle>
                <CardDescription>{t('playlists.wizard.assignmentTypeDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup 
                  value={assignmentType} 
                  onValueChange={(value) => {
                    setAssignmentType(value as 'auto' | 'manual');
                  }}
                >
                  <div 
                    className="flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setAssignmentType('auto')}
                  >
                    <RadioGroupItem value="auto" id="auto-type" className="mt-1 border-2 border-foreground" />
                    <Label htmlFor="auto-type" className="cursor-pointer flex-1">
                      <div className="flex items-center">
                        <Zap className="h-4 w-4 mr-2 text-primary" />
                        <span className="font-semibold">{t('playlists.wizard.autoAssign')}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('playlists.wizard.autoAssignDesc')}
                      </p>
                    </Label>
                  </div>
                  
                  <div 
                    className="flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setAssignmentType('manual')}
                  >
                    <RadioGroupItem value="manual" id="manual-type" className="mt-1 border-2 border-foreground" />
                    <Label htmlFor="manual-type" className="cursor-pointer flex-1">
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2 text-blue-500" />
                        <span className="font-semibold">{t('playlists.manualAssignment')}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('playlists.wizard.manualAssignDesc')}
                      </p>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {assignmentType === 'manual' && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('playlists.wizard.selectEmployees')}</CardTitle>
                  <CardDescription>{t('playlists.wizard.selectEmployeesDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search and Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={t('playlists.wizard.searchByName')}
                        value={employeeSearchTerm}
                        onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={employeeFilterRole} onValueChange={setEmployeeFilterRole}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('playlists.wizard.filterByRole')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('playlists.wizard.allRoles')}</SelectItem>
                        {availableRoles.map(role => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={employeeFilterLocation} onValueChange={setEmployeeFilterLocation}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('playlists.wizard.filterByLocation')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('playlists.wizard.allLocations')}</SelectItem>
                        {LOCATIONS.map(loc => (
                          <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Selected Employees */}
                  {selectedEmployees.length > 0 && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-900/30">
                      <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-2">
                        {t('playlists.wizard.selectedEmployeesCount', { count: selectedEmployees.length })}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedEmployees.map(empId => {
                          const emp = employees.find(e => e.id === empId);
                          return emp ? (
                            <Badge key={empId} variant="secondary" className="bg-brand-gradient text-white pr-1">
                              <span>{emp.first_name} {emp.last_name}</span>
                              <button
                                type="button"
                                className="ml-1 hover:bg-white/20 rounded p-0.5"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleEmployee(empId);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Employee List */}
                  <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                    {loadingEmployees ? (
                      <div className="p-8 text-center text-muted-foreground">
                        {t('playlists.wizard.loadingEmployees')}
                      </div>
                    ) : getFilteredEmployees().length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        {t('playlists.wizard.noEmployeesFound')}
                      </div>
                    ) : (
                      getFilteredEmployees().map(emp => (
                        <div
                          key={emp.id}
                          className="flex items-center space-x-3 p-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer"
                          onClick={() => toggleEmployee(emp.id)}
                        >
                          <Checkbox
                            checked={selectedEmployees.includes(emp.id)}
                            onCheckedChange={() => toggleEmployee(emp.id)}
                          />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{emp.first_name} {emp.last_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {emp.role?.name || 'No role'} • {emp.store?.name || 'No store'}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {assignmentType === 'manual' && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('playlists.wizard.trainingStartTiming')}</CardTitle>
                  <CardDescription>{t('playlists.wizard.trainingStartTimingDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="start-immediately-manual"
                      checked={startImmediately}
                      onCheckedChange={(checked) => setStartImmediately(checked === true)}
                    />
                    <Label htmlFor="start-immediately-manual" className="cursor-pointer">
                      {t('playlists.wizard.immediatelyAtAssignment')}
                    </Label>
                  </div>

                  {!startImmediately && (
                    <div className="flex items-center space-x-4 ml-6">
                      <Label htmlFor="startDelayManual">{t('playlists.wizard.delayDays')}</Label>
                      <Input
                        id="startDelayManual"
                        type="number"
                        value={startDelayDays}
                        onChange={(e) => setStartDelayDays(parseInt(e.target.value) || 14)}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">{t('playlists.wizard.daysAfterAssignment')}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {assignmentType === 'auto' && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('playlists.wizard.assignmentTriggers')}</CardTitle>
                    <CardDescription>{t('playlists.wizard.assignmentTriggersDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(rolesLoading || isLoadingPlaylist) ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mr-2" />
                        <span className="text-sm text-muted-foreground">{t('playlists.wizard.loadingTriggerConditions')}</span>
                      </div>
                    ) : triggerConditions.map((condition, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Select 
                          value={condition.field} 
                          onValueChange={(v) => updateTriggerCondition(index, 'field', v)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder={t('playlists.wizard.fieldLabel')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="role">{t('playlists.wizard.fieldRole')}</SelectItem>
                            <SelectItem value="department">{t('playlists.wizard.fieldDepartment')}</SelectItem>
                            <SelectItem value="location">{t('playlists.wizard.fieldLocation')}</SelectItem>
                            <SelectItem value="hire-date">{t('playlists.wizard.fieldHireDate')}</SelectItem>
                            <SelectItem value="employment-type">{t('playlists.wizard.fieldEmploymentType')}</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select 
                          value={condition.operator} 
                          onValueChange={(v) => updateTriggerCondition(index, 'operator', v)}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder={t('playlists.wizard.operatorLabel')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">{t('playlists.wizard.opEquals')}</SelectItem>
                            <SelectItem value="not-equals">{t('playlists.wizard.opNotEquals')}</SelectItem>
                            <SelectItem value="contains">{t('playlists.wizard.opContains')}</SelectItem>
                            {condition.field === 'hire-date' && (
                              <SelectItem value="within">{t('playlists.wizard.opWithinDays')}</SelectItem>
                            )}
                          </SelectContent>
                        </Select>

                        {condition.field === 'hire-date' ? (
                          <Input
                            type="number"
                            placeholder={t('playlists.wizard.daysPlaceholder')}
                            value={condition.value}
                            onChange={(e) => updateTriggerCondition(index, 'value', e.target.value)}
                            className="flex-1"
                          />
                        ) : (
                          <Select
                            value={condition.value}
                            onValueChange={(v) => updateTriggerCondition(index, 'value', v)}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder={t('playlists.wizard.selectValue')} />
                            </SelectTrigger>
                            <SelectContent>
                              {getFieldOptions(condition.field).map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {triggerConditions.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTriggerCondition(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}

                    {!(rolesLoading || isLoadingPlaylist) && (
                      <>
                        <Button variant="outline" onClick={addTriggerCondition} className="w-full">
                          <Plus className="h-4 w-4 mr-2" />
                          {t('playlists.wizard.addCondition')}
                        </Button>

                        {triggerConditions.some(c => c.value !== '') && (
                          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-900/30">
                            <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-1">
                              {t('playlists.autoAssignsWhen')}
                            </p>
                            <ul className="text-sm text-orange-800 dark:text-orange-200 space-y-1">
                              {triggerConditions.filter(c => c.value !== '').map((c, i) => (
                                <li key={i}>→ {c.field} {c.operator} "{c.value}"</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Matching Employees Preview */}
                {triggerConditions.some(c => c.value !== '') && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-5 w-5 text-green-600" />
                          <CardTitle className="text-base">
                            {mode === 'edit' && triggerRulesImpact ? t('playlists.wizard.newEmployeesToAssign') : t('playlists.wizard.employeesMatchingCriteria')}
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          {matchingUsersLoading ? (
                            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                          ) : (
                            <Badge variant="secondary">
                              {mode === 'edit' && triggerRulesImpact
                                ? triggerRulesImpact.newMatches.length
                                : matchingUsersCount} employees
                            </Badge>
                          )}
                          {matchingUsersCount > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleExportMatchingUsersCSV}
                              className="h-8"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Export CSV
                            </Button>
                          )}
                        </div>
                      </div>
                      <CardDescription>
                        {mode === 'edit' && triggerRulesImpact
                          ? t('playlists.wizard.newlyAssignedOnSave')
                          : t('playlists.wizard.previewAssignedEmployees')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {matchingUsersLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                        </div>
                      ) : matchingUsersCount === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">{t('playlists.wizard.noEmployeesMatchCriteria')}</p>
                        </div>
                      ) : (
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted">
                              <tr>
                                <th className="text-left px-3 py-2 font-medium">{t('playlists.tableEmployee')}</th>
                                <th className="text-left px-3 py-2 font-medium">{t('playlists.tableRole')}</th>
                                <th className="text-left px-3 py-2 font-medium">{t('playlists.tableLocation')}</th>
                                <th className="text-left px-3 py-2 font-medium">{t('playlists.wizard.hireDate')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {(mode === 'edit' && triggerRulesImpact
                                ? triggerRulesImpact.newMatches.slice(0, 20)
                                : matchingUsers
                              ).map((user: any) => (
                                <tr key={user.user_id} className="hover:bg-muted/50">
                                  <td className="px-3 py-2">
                                    {user.first_name} {user.last_name}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {user.role_name || '—'}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {user.store_name || '—'}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {user.hire_date ? new Date(user.hire_date).toLocaleDateString() : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {matchingUsersCount > 20 && (
                            <div className="px-3 py-2 bg-muted/50 text-center text-sm text-muted-foreground border-t">
                              {t('playlists.wizard.showing20ofN', { count: matchingUsersCount })}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Orphaned Assignments Warning (Edit Mode Only) */}
                {mode === 'edit' && triggerRulesImpact && triggerRulesImpact.orphaned.length > 0 && (
                  <Card className="border-amber-200 dark:border-amber-900/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <UserMinus className="h-5 w-5 text-amber-600" />
                          <CardTitle className="text-base text-amber-900 dark:text-amber-100">
                            {t('playlists.wizard.employeesNoLongerMatching')}
                          </CardTitle>
                        </div>
                        <Badge variant="outline" className="border-amber-300 text-amber-700">
                          {triggerRulesImpact.orphaned.length} employees
                        </Badge>
                      </div>
                      <CardDescription>
                        {t('playlists.wizard.orphanedAssignmentsDesc')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-amber-50 dark:bg-amber-900/20">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium">{t('playlists.tableEmployee')}</th>
                              <th className="text-left px-3 py-2 font-medium">{t('playlists.tableRole')}</th>
                              <th className="text-left px-3 py-2 font-medium">{t('playlists.tableStatus')}</th>
                              <th className="text-left px-3 py-2 font-medium">{t('playlists.tableProgress')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {triggerRulesImpact.orphaned.slice(0, 10).map((user) => (
                              <tr key={user.user_id} className="hover:bg-muted/50">
                                <td className="px-3 py-2">
                                  {user.first_name} {user.last_name}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {user.role_name || '—'}
                                </td>
                                <td className="px-3 py-2">
                                  <Badge variant="outline" className="text-xs">
                                    {user.current_status}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {user.progress_percent || 0}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {triggerRulesImpact.orphaned.length > 10 && (
                          <div className="px-3 py-2 bg-amber-50/50 dark:bg-amber-900/10 text-center text-sm text-muted-foreground border-t">
                            +{triggerRulesImpact.orphaned.length - 10} {t('playlists.wizard.moreEmployees')}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{t('playlists.wizard.whatHappenOrphaned')}</p>
                          <p className="text-xs text-muted-foreground">
                            {keepOrphanedAssignments
                              ? t('playlists.wizard.keepActiveDesc')
                              : t('playlists.wizard.archiveDesc')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant={keepOrphanedAssignments ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setKeepOrphanedAssignments(true)}
                          >
                            {t('playlists.wizard.keepActive')}
                          </Button>
                          <Button
                            variant={!keepOrphanedAssignments ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setKeepOrphanedAssignments(false)}
                            className={!keepOrphanedAssignments ? 'bg-amber-600 hover:bg-amber-700' : ''}
                          >
                            {t('common.archive')}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>{t('playlists.wizard.trainingStartTiming')}</CardTitle>
                    <CardDescription>{t('playlists.wizard.trainingStartTimingDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="start-immediately"
                        checked={startImmediately}
                        onCheckedChange={(checked) => setStartImmediately(checked === true)}
                      />
                      <Label htmlFor="start-immediately" className="cursor-pointer">
                        {t('playlists.wizard.immediatelyAtTrigger')}
                      </Label>
                    </div>

                    {!startImmediately && (
                      <div className="flex items-center space-x-4 ml-6">
                        <Label htmlFor="startDelay">{t('playlists.wizard.delayDays')}</Label>
                        <Input
                          id="startDelay"
                          type="number"
                          value={startDelayDays}
                          onChange={(e) => setStartDelayDays(parseInt(e.target.value) || 14)}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">{t('playlists.wizard.daysAfterTrigger')}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        );

      case 1: // Details
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">{t('playlists.wizard.stepPlaylistDetails')}</h2>
              <p className="text-muted-foreground">
                {t('playlists.wizard.playlistDetailsDesc')}
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('playlists.wizard.basicInformation')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('playlists.wizard.playlistName')}</Label>
                  <Input
                    id="name"
                    placeholder={t('playlists.wizard.playlistNamePlaceholder')}
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{t('common.description')}</Label>
                  <Textarea
                    id="description"
                    placeholder={t('playlists.wizard.descriptionPlaceholder')}
                    rows={4}
                    value={playlistDescription}
                    onChange={(e) => setPlaylistDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('playlists.wizard.tagsLabel')}</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedTagObjects.map(tag => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        className="px-3 py-1 rounded-full text-sm font-medium border"
                        style={{
                          backgroundColor: `${tag.color || '#F74A05'}15`,
                          color: tag.color || '#F74A05',
                          borderColor: `${tag.color || '#F74A05'}40`,
                        }}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsTagSelectorOpen(true)}
                      className="h-7 text-xs rounded-full border-dashed border-primary/50 text-primary hover:text-primary hover:bg-primary/5"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {selectedTagObjects.length > 0 ? t('playlists.wizard.editTags') : t('playlists.wizard.addTags')}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('playlists.wizard.tagsHint')}
                  </p>
                </div>
              </CardContent>
            </Card>

            <TagSelectorDialog
              isOpen={isTagSelectorOpen}
              onClose={() => setIsTagSelectorOpen(false)}
              selectedTags={playlistTags}
              onTagsChange={handleTagsChange}
              systemCategory="playlists"
            />
          </div>
        );

      case 2: // Content & Stages
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold mb-2">{t('playlists.wizard.contentStageBuilder')}</h2>
                <p className="text-muted-foreground">
                  {t('playlists.wizard.contentStageBuilderDesc')}
                </p>
              </div>
              <Button onClick={addStage} className="bg-brand-gradient">
                <Plus className="h-4 w-4 mr-2" />
                {t('playlists.wizard.addStage')}
              </Button>
            </div>

            {/* Stage Timeline Tabs */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-2">
              {stages.map((stage, index) => (
                <div key={stage.id} className="flex items-center">
                  <Button
                    variant={activeStageIndex === index ? "default" : "outline"}
                    className={activeStageIndex === index ? 'bg-brand-gradient' : ''}
                    onClick={() => setActiveStageIndex(index)}
                  >
                    {stage.name}
                    {(stage.albums.length > 0 || stage.tracks.length > 0) && (
                      <Badge variant="secondary" className="ml-2 bg-green-500 text-white">
                        {getTotalContentInStage(stage)}
                      </Badge>
                    )}
                  </Button>
                  {index < stages.length - 1 && (
                    <ArrowDown className="h-4 w-4 text-primary mx-1 rotate-[-90deg]" />
                  )}
                </div>
              ))}
            </div>

            {/* Active Stage Editor */}
            {stages[activeStageIndex] && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Input
                        value={stages[activeStageIndex].name}
                        onChange={(e) => updateStage(activeStageIndex, { name: e.target.value })}
                        className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('playlists.wizard.selectContentForStage')}
                      </p>
                    </div>
                    {stages.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeStage(activeStageIndex)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Search Bar */}
                  <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('playlists.wizard.searchAlbumsTracks')}
                      value={contentSearchTerm}
                      onChange={(e) => setContentSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Available Albums */}
                    <div className="space-y-2">
                      <div className="flex items-center mb-3">
                        <AlbumIcon className="h-5 w-5 mr-2 text-primary" />
                        <h3 className="font-semibold">{t('playlists.wizard.availableAlbums')}</h3>
                      </div>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {getFilteredAlbums().map((album) => (
                          <div
                            key={album.id}
                            className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => toggleAlbumInStage(activeStageIndex, album.id)}
                          >
                            <Checkbox
                              checked={stages[activeStageIndex].albums.includes(album.id)}
                              onCheckedChange={() => toggleAlbumInStage(activeStageIndex, album.id)}
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{album.title}</p>
                              <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                                <span>{t('playlists.wizard.trackCount', { count: album.track_count || 0 })}</span>
                                <span>•</span>
                                <span>{t('playlists.wizard.minDuration', { count: album.total_duration_minutes || album.duration_minutes || 0 })}</span>
                                {album.version_number && album.version_number > 1 && (
                                  <>
                                    <span>•</span>
                                    <span>v{album.version_number}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Available Standalone Tracks */}
                    <div className="space-y-2">
                      <div className="flex items-center mb-3">
                        <Play className="h-5 w-5 mr-2 text-primary" />
                        <h3 className="font-semibold">{t('playlists.wizard.standaloneTracks')}</h3>
                      </div>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {getFilteredTracks().map((track) => (
                          <div
                            key={track.id}
                            className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => toggleTrackInStage(activeStageIndex, track.id)}
                          >
                            <Checkbox
                              checked={stages[activeStageIndex].tracks.includes(track.id)}
                              onCheckedChange={() => toggleTrackInStage(activeStageIndex, track.id)}
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{track.title}</p>
                              <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                                <Badge variant="secondary" className="text-xs bg-brand-gradient text-white">{track.type}</Badge>
                                <span>•</span>
                                <span>{t('playlists.wizard.minDuration', { count: track.duration_minutes || 0 })}</span>
                                <span>•</span>
                                <span>{new Date(track.updated_at || track.created_at).toLocaleDateString()}</span>
                                {track.version_number && track.version_number > 1 && (
                                  <>
                                    <span>•</span>
                                    <span>v{track.version_number}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selected Content Summary */}
            {getTotalContent() > 0 && (
              <Card className="border-primary bg-orange-50 dark:bg-orange-900/20">
                <CardHeader>
                  <CardTitle className="flex items-center text-primary">
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    {t('playlists.wizard.selectedContentSummary')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        {stages.reduce((acc, s) => acc + s.albums.length, 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">{t('playlists.wizard.summaryAlbums')}</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        {stages.reduce((acc, s) => acc + s.tracks.length, 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">{t('playlists.wizard.summaryStandaloneTracks')}</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">{getTotalContent()}</p>
                      <p className="text-sm text-muted-foreground">{t('playlists.wizard.summaryTotalTracks')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 3: // Stage Config
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">{t('playlists.wizard.stageDeliveryConfig')}</h2>
              <p className="text-muted-foreground">
                {t('playlists.wizard.stageDeliveryConfigDesc')}
              </p>
            </div>

            {/* Timeline visualization container */}
            <div className="space-y-8">
              {/* Trigger Summary */}
              <div className="flex items-center justify-center relative">
                <Card className="w-full max-w-2xl bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-900/30 relative z-10">
                  <CardHeader>
                    <CardTitle className="flex items-center text-sm">
                      <Zap className="h-4 w-4 mr-2 text-primary" />
                      {t('playlists.wizard.triggerLabel')}: {assignmentType === 'auto' ? t('playlists.wizard.autoAssignLabel') : t('playlists.wizard.manualAssignmentLabel')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{getTriggerSummary()}</p>
                    {assignmentType === 'auto' && !startImmediately && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('playlists.wizard.trainingStartsAfterDays', { count: startDelayDays })}
                      </p>
                    )}
                  </CardContent>
                </Card>
                {/* Connecting line to next stage */}
                {stages.length > 0 && (
                  <div className="absolute left-1/2 bottom-0 w-0.5 h-8 bg-gradient-to-b from-transparent via-primary/20 to-primary/30 transform -translate-x-1/2 translate-y-full -z-10" />
                )}
              </div>

              {/* Stage Configurations */}
              {stages.map((stage, index) => (
                <div key={stage.id} className="flex items-center justify-center relative">
                  <Card className="w-full max-w-2xl bg-background relative z-10">
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Lock className="h-5 w-5 mr-2 text-primary" />
                          {stage.name}
                          <Badge variant="secondary" className="ml-3">
                            {t('playlists.wizard.trackCount', { count: getTotalContentInStage(stage) })}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          {t('playlists.wizard.stageAlbumsAndTracks', { albums: stage.albums.length, tracks: stage.tracks.length })}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor={`unlock-type-${index}`}>{t('playlists.wizard.primaryUnlockCondition')}</Label>
                          <Select
                            value={stage.unlockType}
                            onValueChange={(v) => updateStage(index, { unlockType: v })}
                          >
                            <SelectTrigger id={`unlock-type-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {index === 0 && (
                                <SelectItem value="immediate">{t('playlists.wizard.unlockImmediate')}</SelectItem>
                              )}
                              {index > 0 && (
                                <SelectItem value="stage-complete">{t('playlists.wizard.unlockStageComplete')}</SelectItem>
                              )}
                              <SelectItem value="days-after-trigger">{t('playlists.wizard.unlockDaysAfterTrigger')}</SelectItem>
                              {index > 0 && (
                                <SelectItem value="days-after-stage">{t('playlists.wizard.unlockDaysAfterStage')}</SelectItem>
                              )}
                              <SelectItem value="assignment-complete">{t('playlists.wizard.unlockAssignmentComplete')}</SelectItem>
                              <SelectItem value="calendar-date">{t('playlists.wizard.unlockCalendarDate')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Conditional fields based on unlock type */}
                        {stage.unlockType === 'days-after-trigger' && (
                          <div className="flex items-center space-x-4 ml-6">
                            <Label htmlFor={`days-start-${index}`}>{t('playlists.wizard.daysLabel')}</Label>
                            <Input
                              id={`days-start-${index}`}
                              type="number"
                              min="0"
                              value={stage.unlockDays}
                              onChange={(e) => updateStage(index, { unlockDays: parseInt(e.target.value) || 0 })}
                              className="w-24"
                            />
                            <span className="text-sm text-muted-foreground">{t('playlists.wizard.afterTrigger')}</span>
                          </div>
                        )}

                        {stage.unlockType === 'days-after-stage' && index > 0 && (
                          <div className="space-y-3 ml-6">
                            <div className="flex items-center space-x-4">
                              <Label htmlFor={`after-stage-${index}`}>{t('playlists.wizard.afterStageLabel')}</Label>
                              <Select
                                value={stage.unlockAfterStage}
                                onValueChange={(v) => updateStage(index, { unlockAfterStage: v })}
                              >
                                <SelectTrigger id={`after-stage-${index}`} className="w-[200px]">
                                  <SelectValue placeholder={t('playlists.wizard.selectStagePlaceholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                  {stages.slice(0, index).map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center space-x-4">
                              <Label htmlFor={`days-after-${index}`}>{t('playlists.wizard.waitLabel')}</Label>
                              <Input
                                id={`days-after-${index}`}
                                type="number"
                                min="0"
                                value={stage.unlockDays}
                                onChange={(e) => updateStage(index, { unlockDays: parseInt(e.target.value) || 0 })}
                                className="w-24"
                              />
                              <span className="text-sm text-muted-foreground">{t('playlists.wizard.daysAfterCompletion')}</span>
                            </div>
                          </div>
                        )}

                        {stage.unlockType === 'stage-complete' && index > 0 && (
                          <div className="flex items-center space-x-4 ml-6">
                            <Label htmlFor={`stage-req-${index}`}>{t('playlists.wizard.requiredStageLabel')}</Label>
                            <Select
                              value={stage.unlockAfterStage}
                              onValueChange={(v) => updateStage(index, { unlockAfterStage: v })}
                            >
                              <SelectTrigger id={`stage-req-${index}`} className="w-[200px]">
                                <SelectValue placeholder={t('playlists.wizard.selectStagePlaceholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                {stages.slice(0, index).map(s => (
                                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {stage.unlockType === 'assignment-complete' && (
                          <div className="space-y-3 ml-6">
                            <div className="space-y-2">
                              <Label htmlFor={`assignment-${index}`}>{t('playlists.wizard.selectAssignmentLabel')}</Label>
                              <Select
                                value={stage.unlockAssignment}
                                onValueChange={(v) => updateStage(index, { unlockAssignment: v })}
                              >
                                <SelectTrigger id={`assignment-${index}`}>
                                  <SelectValue placeholder={t('playlists.wizard.selectAssignmentPlaceholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                  {AVAILABLE_ASSIGNMENTS.map(assignment => (
                                    <SelectItem key={assignment.id} value={assignment.id}>
                                      {assignment.title} ({assignment.type})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`completer-${index}`}>{t('playlists.wizard.mustBeCompletedBy')}</Label>
                              <RadioGroup
                                value={stage.unlockAssignmentCompleter}
                                onValueChange={(v) => updateStage(index, { unlockAssignmentCompleter: v })}
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="learner" id={`learner-${index}`} />
                                  <Label htmlFor={`learner-${index}`}>{t('playlists.wizard.completerLearner')}</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="manager" id={`manager-${index}`} />
                                  <Label htmlFor={`manager-${index}`}>{t('playlists.wizard.completerManager')}</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="role" id={`role-${index}`} />
                                  <Label htmlFor={`role-${index}`}>{t('playlists.wizard.completerRole')}</Label>
                                </div>
                              </RadioGroup>
                            </div>
                          </div>
                        )}

                        {stage.unlockType === 'calendar-date' && (
                          <div className="flex items-center space-x-4 ml-6">
                            <Label htmlFor={`date-${index}`}>{t('playlists.wizard.dateLabel')}</Label>
                            <Input
                              id={`date-${index}`}
                              type="date"
                              className="w-[200px]"
                            />
                          </div>
                        )}

                        <Separator />

                        {/* Override Options */}
                        <div className="space-y-3">
                          <Label>{t('playlists.wizard.overrideOptions')}</Label>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`manager-override-${index}`}
                                checked={stage.allowManagerOverride}
                                onCheckedChange={(checked) =>
                                  updateStage(index, { allowManagerOverride: checked === true })
                                }
                              />
                              <Label htmlFor={`manager-override-${index}`} className="cursor-pointer text-sm">
                                {t('playlists.wizard.allowManagerUnlock')}
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`admin-override-${index}`}
                                checked={stage.allowAdminOverride}
                                onCheckedChange={(checked) =>
                                  updateStage(index, { allowAdminOverride: checked === true })
                                }
                              />
                              <Label htmlFor={`admin-override-${index}`} className="cursor-pointer text-sm">
                                {t('playlists.wizard.allowAdminOverride')}
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`notify-unlock-${index}`}
                                checked={stage.notifyOnUnlock}
                                onCheckedChange={(checked) =>
                                  updateStage(index, { notifyOnUnlock: checked === true })
                                }
                              />
                              <Label htmlFor={`notify-unlock-${index}`} className="cursor-pointer text-sm">
                                {t('playlists.wizard.notifyOnUnlock')}
                              </Label>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    {/* Connecting line to next stage */}
                    {index < stages.length - 1 && (
                      <div className="absolute left-1/2 bottom-0 w-0.5 h-8 bg-gradient-to-b from-transparent via-primary/20 to-primary/30 transform -translate-x-1/2 translate-y-full -z-10" />
                    )}
                  </div>
                ))}
            </div>

            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/30">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="text-sm text-blue-900 dark:text-blue-100">
                    <p className="font-medium mb-1">{t('playlists.wizard.assignmentBasedUnlockingTitle')}</p>
                    <p>{t('playlists.wizard.assignmentBasedUnlockingDesc')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 4: // Completion
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">{t('playlists.wizard.completionActions')}</h2>
              <p className="text-muted-foreground">
                {t('playlists.wizard.completionActionsDesc')}
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('playlists.wizard.completionRequirements')}</CardTitle>
                <CardDescription>{t('playlists.wizard.completionRequirementsDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="threshold">{t('playlists.wizard.completionThreshold')}</Label>
                  <div className="flex items-center space-x-4">
                    <Input
                      id="threshold"
                      type="number"
                      min="0"
                      max="100"
                      value={completionThreshold}
                      onChange={(e) => setCompletionThreshold(parseInt(e.target.value) || 100)}
                      className="w-24"
                    />
                    <span className="text-sm">{t('playlists.wizard.percentTracksCompleted')}</span>
                  </div>
                  <Progress value={completionThreshold} className="h-2" />
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>{t('playlists.wizard.minScoreRequirements')}</Label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('playlists.wizard.checkpointQuizzes')}</span>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={minQuizScore}
                        onChange={(e) => setMinQuizScore(parseInt(e.target.value) || 80)}
                        className="w-20"
                      />
                      <span className="text-sm">%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('playlists.wizard.finalAssessment')}</span>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={minFinalScore}
                        onChange={(e) => setMinFinalScore(parseInt(e.target.value) || 85)}
                        className="w-20"
                      />
                      <span className="text-sm">%</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="deadline">{t('playlists.wizard.completionDeadline')}</Label>
                  <div className="flex items-center space-x-4">
                    <Input
                      id="deadline"
                      type="number"
                      min="1"
                      value={completionDeadlineDays}
                      onChange={(e) => setCompletionDeadlineDays(parseInt(e.target.value) || 30)}
                      className="w-24"
                    />
                    <span className="text-sm">{t('playlists.wizard.daysAfterAssignment')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Required Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Required Form
                </CardTitle>
                <CardDescription>
                  Attach a sign-off or OJT form that users must complete when they finish this playlist.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="required-form">Form</Label>
                  <Select
                    value={requiredFormId || 'none'}
                    onValueChange={(v) => setRequiredFormId(v === 'none' ? '' : v)}
                    disabled={loadingForms}
                  >
                    <SelectTrigger id="required-form">
                      <SelectValue placeholder={loadingForms ? 'Loading forms…' : 'No form required'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No form required</SelectItem>
                      {availableForms.map((form) => (
                        <SelectItem key={form.id} value={form.id}>
                          {form.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {requiredFormId && (
                  <div className="space-y-2">
                    <Label htmlFor="form-completion-mode">Completion Mode</Label>
                    <Select
                      value={formCompletionMode}
                      onValueChange={(v) => setFormCompletionMode(v as 'optional' | 'required' | 'required_before_completion')}
                    >
                      <SelectTrigger id="form-completion-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="optional">Optional — users are prompted but not blocked</SelectItem>
                        <SelectItem value="required">Required — must be completed to mark playlist done</SelectItem>
                        <SelectItem value="required_before_completion">Required before completion — blocks playlist completion</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Selecting a required form will prompt users to complete this form when they finish the playlist.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('playlists.wizard.uponCompletionActions')}</CardTitle>
                <CardDescription>{t('playlists.wizard.uponCompletionActionsDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {completionActions.map((action, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="capitalize">
                        {action.type === 'credential' && <Award className="h-3 w-3 mr-1" />}
                        {action.type === 'next-playlist' && <ListChecks className="h-3 w-3 mr-1" />}
                        {action.type === 'notification' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {action.type.replace('-', ' ')}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCompletionAction(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {action.type === 'credential' && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor={`cred-name-${index}`}>{t('playlists.wizard.credentialName')}</Label>
                          <Input
                            id={`cred-name-${index}`}
                            placeholder={t('playlists.wizard.credentialNamePlaceholder')}
                            value={action.credentialName}
                            onChange={(e) => {
                              const updated = [...completionActions];
                              updated[index].credentialName = e.target.value;
                              setCompletionActions(updated);
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`cred-exp-${index}`}>{t('playlists.wizard.expirationPeriod')}</Label>
                          <Input
                            id={`cred-exp-${index}`}
                            type="number"
                            min="1"
                            value={action.expirationMonths}
                            onChange={(e) => {
                              const updated = [...completionActions];
                              updated[index].expirationMonths = parseInt(e.target.value) || 24;
                              setCompletionActions(updated);
                            }}
                            className="w-32"
                          />
                        </div>
                      </div>
                    )}

                    {action.type === 'next-playlist' && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor={`next-playlist-${index}`}>{t('playlists.wizard.nextPlaylist')}</Label>
                          <Select
                            value={action.playlistId}
                            onValueChange={(v) => {
                              const updated = [...completionActions];
                              updated[index].playlistId = v;
                              setCompletionActions(updated);
                            }}
                          >
                            <SelectTrigger id={`next-playlist-${index}`}>
                              <SelectValue placeholder={t('playlists.wizard.selectPlaylistPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="p1">Advanced Food Safety Procedures</SelectItem>
                              <SelectItem value="p2">Manager Leadership Academy</SelectItem>
                              <SelectItem value="p3">District Manager Training Path</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`delay-${index}`}>{t('playlists.wizard.delayBeforeAssignment')}</Label>
                          <Input
                            id={`delay-${index}`}
                            type="number"
                            min="0"
                            value={action.delayDays}
                            onChange={(e) => {
                              const updated = [...completionActions];
                              updated[index].delayDays = parseInt(e.target.value) || 7;
                              setCompletionActions(updated);
                            }}
                            className="w-32"
                          />
                        </div>
                      </div>
                    )}

                    {action.type === 'notification' && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor={`notif-recipient-${index}`}>{t('playlists.wizard.recipient')}</Label>
                          <Select
                            value={action.recipient}
                            onValueChange={(v) => {
                              const updated = [...completionActions];
                              updated[index].recipient = v;
                              setCompletionActions(updated);
                            }}
                          >
                            <SelectTrigger id={`notif-recipient-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manager">{t('playlists.wizard.recipientDirectManager')}</SelectItem>
                              <SelectItem value="hr">{t('playlists.wizard.recipientHR')}</SelectItem>
                              <SelectItem value="learner">{t('playlists.wizard.recipientLearner')}</SelectItem>
                              <SelectItem value="custom">{t('playlists.wizard.recipientCustomEmail')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`notif-msg-${index}`}>{t('playlists.wizard.messageTemplate')}</Label>
                          <Textarea
                            id={`notif-msg-${index}`}
                            placeholder={t('playlists.wizard.messageTemplatePlaceholder')}
                            rows={3}
                            value={action.message}
                            onChange={(e) => {
                              const updated = [...completionActions];
                              updated[index].message = e.target.value;
                              setCompletionActions(updated);
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => addCompletionAction('credential')}
                    className="w-full"
                  >
                    <Award className="h-4 w-4 mr-2" />
                    {t('playlists.wizard.addCredential')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => addCompletionAction('next-playlist')}
                    className="w-full"
                  >
                    <ListChecks className="h-4 w-4 mr-2" />
                    {t('playlists.wizard.autoAssignNext')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => addCompletionAction('notification')}
                    className="w-full"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {t('playlists.wizard.sendNotification')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('playlists.wizard.complianceTitle')}</CardTitle>
                <CardDescription>{t('playlists.wizard.complianceTitleDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    <SettingsIcon className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{t('playlists.wizard.updateComplianceDashboard')}</p>
                      <p className="text-xs text-muted-foreground">{t('playlists.wizard.markRequirementsComplete')}</p>
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 5: // Review
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">{t('playlists.wizard.reviewPublish')}</h2>
              <p className="text-muted-foreground">
                {t('playlists.wizard.reviewPublishDesc')}
              </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-base">
                    <ListChecks className="h-4 w-4 mr-2 text-primary" />
                    {t('playlists.wizard.reviewPlaylistDetails')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t('playlists.wizard.reviewNameLabel')}</p>
                    <p className="font-medium">{playlistName || t('playlists.wizard.notSet')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('playlists.wizard.reviewDescLabel')}</p>
                    <p className="text-xs line-clamp-2">{playlistDescription || t('playlists.wizard.notSet')}</p>
                  </div>
                  {playlistTags.length > 0 && (
                    <div>
                      <p className="text-muted-foreground mb-1">{t('playlists.wizard.reviewTagsLabel')}</p>
                      <div className="flex flex-wrap gap-1">
                        {playlistTags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-base">
                    <Library className="h-4 w-4 mr-2 text-primary" />
                    {t('playlists.wizard.reviewContentSummary')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('playlists.wizard.reviewStages')}</span>
                    <span className="font-medium">{stages.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('playlists.wizard.reviewTotalAlbums')}</span>
                    <span className="font-medium">
                      {stages.reduce((acc, s) => acc + s.albums.length, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('playlists.wizard.reviewTotalTracks')}</span>
                    <span className="font-medium">{getTotalContent()}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Timeline Recap */}
            <Card>
              <CardHeader>
                <CardTitle>{t('playlists.wizard.playlistFlowTimeline')}</CardTitle>
                <CardDescription>{t('playlists.wizard.playlistFlowTimelineDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {/* Vertical timeline line */}
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/30 via-primary/20 to-primary/30" />

                  <div className="space-y-6">
                    {/* Trigger */}
                    <div className="flex items-start space-x-4 relative">
                      <div className="h-12 w-12 rounded-full bg-brand-gradient flex items-center justify-center flex-shrink-0 z-10">
                        <Zap className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 pt-2">
                        <p className="font-semibold">{t('playlists.wizard.triggerLabel')}</p>
                        <p className="text-sm text-muted-foreground">{getTriggerSummary()}</p>
                        {assignmentType === 'auto' && !startImmediately && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('playlists.wizard.startsAfterDays', { count: startDelayDays })}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Stages */}
                    {stages.map((stage, index) => {
                      const unlockDesc = stage.unlockType === 'immediate'
                        ? t('playlists.wizard.reviewUnlockImmediate')
                        : stage.unlockType === 'days-after-trigger'
                        ? t('playlists.wizard.reviewUnlockDaysAfterTrigger', { count: stage.unlockDays })
                        : stage.unlockType === 'days-after-stage'
                        ? t('playlists.wizard.reviewUnlockDaysAfterStage', { count: stage.unlockDays })
                        : stage.unlockType === 'stage-complete'
                        ? t('playlists.wizard.reviewUnlockStageComplete')
                        : stage.unlockType === 'assignment-complete'
                        ? t('playlists.wizard.reviewUnlockAssignmentComplete')
                        : t('playlists.wizard.reviewUnlockSpecificDate');
                      
                      return (
                        <div key={stage.id} className="flex items-start space-x-4 relative">
                          <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0 z-10">
                            <Lock className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 pt-2">
                            <p className="font-semibold">{stage.name}</p>
                            <p className="text-sm text-muted-foreground">{unlockDesc}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t('playlists.wizard.stageAlbumsAndTracks', { albums: stage.albums.length, tracks: stage.tracks.length })} • {t('playlists.wizard.totalTracksCount', { count: getTotalContentInStage(stage) })}
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    {/* Completion */}
                    <div className="flex items-start space-x-4 relative">
                      <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 z-10">
                        <Award className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 pt-2">
                        <p className="font-semibold">{t('playlists.wizard.completionLabel')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('playlists.wizard.completionSummary', { threshold: completionThreshold, deadline: completionDeadlineDays })}
                        </p>
                        {requiredFormId && (
                          <div className="mt-2 flex items-center gap-1">
                            <FileText className="h-3 w-3 text-primary" />
                            <span className="text-xs text-primary font-medium">
                              Includes sign-off form:{' '}
                              {availableForms.find(f => f.id === requiredFormId)?.title || 'Selected form'}
                              {formCompletionMode !== 'optional' && (
                                <span className="ml-1 text-muted-foreground">
                                  ({formCompletionMode === 'required' ? 'required' : 'blocks completion'})
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                        {completionActions.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {completionActions.map((action, i) => (
                              <p key={i} className="text-xs text-muted-foreground">
                                • {action.type.replace('-', ' ')}
                                {action.type === 'credential' && action.credentialName && `: ${action.credentialName}`}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/30">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                  <div className="text-sm text-green-900 dark:text-green-100">
                    <p className="font-medium mb-1">{mode === 'edit' ? t('playlists.wizard.readyToUpdate') : t('playlists.wizard.readyToPublish')}</p>
                    <p>{mode === 'edit' ? t('playlists.wizard.readyToUpdateDesc') : t('playlists.wizard.readyToPublishDesc')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={onClose}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('playlists.wizard.backToPlaylists')}
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <h1>{mode === 'create' ? t('playlists.wizard.createNewPlaylist') : t('playlists.wizard.editPlaylist')}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {WIZARD_STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              const isAccessible = index <= currentStep;

              return (
                <React.Fragment key={step.id}>
                  <div
                    className={`flex items-center space-x-2 cursor-pointer ${
                      isAccessible ? 'opacity-100' : 'opacity-40'
                    }`}
                    onClick={() => isAccessible && setCurrentStep(index)}
                  >
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        isActive
                          ? 'bg-brand-gradient text-white'
                          : isCompleted
                          ? 'bg-green-500 text-white'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="hidden lg:block">
                      <p className={`text-sm font-medium ${isActive ? 'text-primary' : ''}`}>
                        {step.label}
                      </p>
                    </div>
                  </div>
                  {index < WIZARD_STEPS.length - 1 && (
                    <div className="flex-1 h-0.5 bg-muted mx-2" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-8 mb-24">
        {renderStepContent()}
      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {t('playlists.wizard.stepOf', { current: currentStep + 1, total: WIZARD_STEPS.length })}
            </div>
            <div className="flex items-center space-x-3">
              {currentStep > 0 && (
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('playlists.wizard.backButton')}
                </Button>
              )}

              {currentStep < WIZARD_STEPS.length - 1 ? (
                <Button
                  className="bg-brand-gradient"
                  onClick={handleNext}
                  disabled={!canProceed}
                >
                  {t('playlists.wizard.nextButton')}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  className="bg-brand-gradient"
                  onClick={handlePublishPlaylist}
                  disabled={!canProceed || isSubmitting}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {isSubmitting
                    ? (mode === 'edit' ? t('playlists.wizard.updating') : t('playlists.wizard.publishing'))
                    : (mode === 'edit' ? t('playlists.wizard.updatePlaylist') : t('playlists.wizard.publishPlaylist'))
                  }
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}