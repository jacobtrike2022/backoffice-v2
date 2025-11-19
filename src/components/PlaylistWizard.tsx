import React, { useState } from 'react';
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
  ArrowDown
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

interface PlaylistWizardProps {
  onClose: () => void;
  mode?: 'create' | 'edit';
  existingPlaylist?: any;
  isFullPage?: boolean;
}

const WIZARD_STEPS = [
  { id: 'trigger', label: 'Assignment Logic', icon: Zap },
  { id: 'details', label: 'Playlist Details', icon: ListChecks },
  { id: 'content-stages', label: 'Content & Stages', icon: Library },
  { id: 'stage-config', label: 'Stage Delivery', icon: Lock },
  { id: 'completion', label: 'Completion Actions', icon: Award },
  { id: 'review', label: 'Review & Publish', icon: CheckCircle2 }
];

// Mock data for dropdowns
const ROLES = ['Store Manager', 'Sales Associate', 'Assistant Manager', 'Department Lead', 'Cashier', 'Stock Clerk'];
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
const AVAILABLE_TAGS = ['onboarding', 'compliance', 'safety', 'customer-service', 'leadership', 'technology', 'operations', 'policy'];

export function PlaylistWizard({ onClose, mode = 'create', existingPlaylist, isFullPage = false }: PlaylistWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  
  // Form state
  const [assignmentType, setAssignmentType] = useState<'auto' | 'manual'>('auto');
  const [triggerConditions, setTriggerConditions] = useState<any[]>([
    { field: 'role', operator: 'equals', value: '' }
  ]);
  const [startImmediately, setStartImmediately] = useState(true);
  const [startDelayDays, setStartDelayDays] = useState(14);
  
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [playlistCategory, setPlaylistCategory] = useState('onboarding');
  const [playlistTags, setPlaylistTags] = useState<string[]>([]);
  
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

  const isStepComplete = (stepIndex: number) => {
    switch (stepIndex) {
      case 0: // Trigger
        if (assignmentType === 'manual') return selectedEmployees.length > 0;
        return triggerConditions.some(c => c.value !== '');
      case 1: // Details
        return playlistName.trim() !== '' && playlistDescription.trim() !== '';
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

  const getFieldOptions = (field: string) => {
    switch (field) {
      case 'role': return ROLES;
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

  const toggleTag = (tag: string) => {
    if (playlistTags.includes(tag)) {
      setPlaylistTags(playlistTags.filter(t => t !== tag));
    } else {
      setPlaylistTags([...playlistTags, tag]);
    }
  };

  const getTotalContentInStage = (stage: any) => {
    const albumTracks = stage.albums.reduce((acc: number, albumId: string) => {
      const album = AVAILABLE_ALBUMS.find(a => a.id === albumId);
      return acc + (album?.trackCount || 0);
    }, 0);
    return albumTracks + stage.tracks.length;
  };

  const getTotalContent = () => {
    return stages.reduce((acc, stage) => acc + getTotalContentInStage(stage), 0);
  };

  const getFilteredEmployees = () => {
    return MOCK_EMPLOYEES.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase());
      const matchesRole = employeeFilterRole === 'all' || emp.role === employeeFilterRole;
      const matchesLocation = employeeFilterLocation === 'all' || emp.location === employeeFilterLocation;
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
    if (!contentSearchTerm) return AVAILABLE_ALBUMS;
    return AVAILABLE_ALBUMS.filter(album =>
      album.title.toLowerCase().includes(contentSearchTerm.toLowerCase()) ||
      album.category.toLowerCase().includes(contentSearchTerm.toLowerCase())
    );
  };

  const getFilteredTracks = () => {
    if (!contentSearchTerm) return AVAILABLE_TRACKS;
    return AVAILABLE_TRACKS.filter(track =>
      track.title.toLowerCase().includes(contentSearchTerm.toLowerCase()) ||
      track.type.toLowerCase().includes(contentSearchTerm.toLowerCase())
    );
  };

  const getTriggerSummary = () => {
    if (assignmentType === 'manual') {
      return `Manually assigned to ${selectedEmployees.length} employee${selectedEmployees.length !== 1 ? 's' : ''}`;
    }
    const validConditions = triggerConditions.filter(c => c.value !== '');
    if (validConditions.length === 0) return 'No trigger conditions set';
    return validConditions.map(c => `${c.field} ${c.operator} "${c.value}"`).join(' AND ');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Trigger
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Assignment Logic</h2>
              <p className="text-muted-foreground">
                Define how this playlist will be assigned to learners
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Assignment Type</CardTitle>
                <CardDescription>Choose how learners receive this playlist</CardDescription>
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
                        <span className="font-semibold">Auto-Assign</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Automatically assign this playlist when conditions are met
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
                        <span className="font-semibold">Manual Assignment</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Manually select specific learners or groups
                      </p>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {assignmentType === 'manual' && (
              <Card>
                <CardHeader>
                  <CardTitle>Select Employees</CardTitle>
                  <CardDescription>Choose who will receive this playlist</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search and Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name..."
                        value={employeeSearchTerm}
                        onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={employeeFilterRole} onValueChange={setEmployeeFilterRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        {ROLES.map(role => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={employeeFilterLocation} onValueChange={setEmployeeFilterLocation}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Locations</SelectItem>
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
                        Selected: {selectedEmployees.length} employee{selectedEmployees.length !== 1 ? 's' : ''}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedEmployees.map(empId => {
                          const emp = MOCK_EMPLOYEES.find(e => e.id === empId);
                          return emp ? (
                            <Badge key={empId} variant="secondary" className="bg-brand-gradient text-white">
                              {emp.name}
                              <X 
                                className="h-3 w-3 ml-1 cursor-pointer" 
                                onClick={() => toggleEmployee(empId)}
                              />
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Employee List */}
                  <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                    {getFilteredEmployees().map(emp => (
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
                          <p className="font-medium text-sm">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {emp.role} • {emp.location}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {assignmentType === 'manual' && (
              <Card>
                <CardHeader>
                  <CardTitle>Training Start Timing</CardTitle>
                  <CardDescription>When should training begin after assignment?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="start-immediately-manual" 
                      checked={startImmediately}
                      onCheckedChange={(checked) => setStartImmediately(checked === true)}
                    />
                    <Label htmlFor="start-immediately-manual" className="cursor-pointer">
                      Immediately at the time of assignment
                    </Label>
                  </div>
                  
                  {!startImmediately && (
                    <div className="flex items-center space-x-4 ml-6">
                      <Label htmlFor="startDelayManual">Delay (days)</Label>
                      <Input
                        id="startDelayManual"
                        type="number"
                        value={startDelayDays}
                        onChange={(e) => setStartDelayDays(parseInt(e.target.value) || 14)}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">days after assignment</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {assignmentType === 'auto' && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Assignment Triggers</CardTitle>
                    <CardDescription>Define the conditions that trigger automatic assignment</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {triggerConditions.map((condition, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Select 
                          value={condition.field} 
                          onValueChange={(v) => updateTriggerCondition(index, 'field', v)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="role">Role</SelectItem>
                            <SelectItem value="department">Department</SelectItem>
                            <SelectItem value="location">Location</SelectItem>
                            <SelectItem value="hire-date">Hire Date</SelectItem>
                            <SelectItem value="employment-type">Employment Type</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select 
                          value={condition.operator} 
                          onValueChange={(v) => updateTriggerCondition(index, 'operator', v)}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Operator" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">Equals</SelectItem>
                            <SelectItem value="not-equals">Not Equals</SelectItem>
                            <SelectItem value="contains">Contains</SelectItem>
                            {condition.field === 'hire-date' && (
                              <SelectItem value="within">Within (days)</SelectItem>
                            )}
                          </SelectContent>
                        </Select>

                        {condition.field === 'hire-date' ? (
                          <Input
                            type="number"
                            placeholder="Days"
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
                              <SelectValue placeholder="Select value" />
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

                    <Button variant="outline" onClick={addTriggerCondition} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Condition
                    </Button>

                    {triggerConditions.some(c => c.value !== '') && (
                      <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-900/30">
                        <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-1">
                          This playlist will auto-assign when:
                        </p>
                        <ul className="text-sm text-orange-800 dark:text-orange-200 space-y-1">
                          {triggerConditions.filter(c => c.value !== '').map((c, i) => (
                            <li key={i}>→ {c.field} {c.operator} "{c.value}"</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Training Start Timing</CardTitle>
                    <CardDescription>When should training begin after assignment?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="start-immediately" 
                        checked={startImmediately}
                        onCheckedChange={(checked) => setStartImmediately(checked === true)}
                      />
                      <Label htmlFor="start-immediately" className="cursor-pointer">
                        Immediately at the time of trigger
                      </Label>
                    </div>
                    
                    {!startImmediately && (
                      <div className="flex items-center space-x-4 ml-6">
                        <Label htmlFor="startDelay">Delay (days)</Label>
                        <Input
                          id="startDelay"
                          type="number"
                          value={startDelayDays}
                          onChange={(e) => setStartDelayDays(parseInt(e.target.value) || 14)}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">days after trigger</span>
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
              <h2 className="text-2xl font-semibold mb-2">Playlist Details</h2>
              <p className="text-muted-foreground">
                Provide basic information about this playlist
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Playlist Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., CSR Onboarding Playlist"
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the purpose and goals of this playlist..."
                    rows={4}
                    value={playlistDescription}
                    onChange={(e) => setPlaylistDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={playlistCategory} onValueChange={setPlaylistCategory}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="onboarding">Onboarding</SelectItem>
                      <SelectItem value="compliance">Compliance</SelectItem>
                      <SelectItem value="leadership">Leadership</SelectItem>
                      <SelectItem value="skills">Skills Development</SelectItem>
                      <SelectItem value="safety">Safety</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_TAGS.map(tag => (
                      <Badge
                        key={tag}
                        variant={playlistTags.includes(tag) ? "default" : "outline"}
                        className={`cursor-pointer ${playlistTags.includes(tag) ? 'bg-brand-gradient' : ''}`}
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click tags to add or remove them from this playlist
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 2: // Content & Stages
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold mb-2">Content & Stage Builder</h2>
                <p className="text-muted-foreground">
                  Choose the albums and tracks to include, organized by stage
                </p>
              </div>
              <Button onClick={addStage} className="bg-brand-gradient">
                <Plus className="h-4 w-4 mr-2" />
                Add Stage
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
                        Select content for this stage
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
                      placeholder="Search albums and tracks..."
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
                        <h3 className="font-semibold">Available Albums</h3>
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
                              <div className="flex items-center space-x-3 text-xs text-muted-foreground mt-1">
                                <span>{album.trackCount} tracks</span>
                                <span>•</span>
                                <span>{album.duration}</span>
                                <span>•</span>
                                <Badge variant="secondary" className="text-xs bg-brand-gradient text-white">{album.category}</Badge>
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
                        <h3 className="font-semibold">Standalone Tracks</h3>
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
                              <div className="flex items-center space-x-3 text-xs text-muted-foreground mt-1">
                                <span>{track.duration}</span>
                                <span>•</span>
                                <Badge variant="secondary" className="text-xs bg-brand-gradient text-white">{track.type}</Badge>
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
                    Selected Content Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        {stages.reduce((acc, s) => acc + s.albums.length, 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">Albums</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        {stages.reduce((acc, s) => acc + s.tracks.length, 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">Standalone Tracks</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">{getTotalContent()}</p>
                      <p className="text-sm text-muted-foreground">Total Tracks</p>
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
              <h2 className="text-2xl font-semibold mb-2">Stage Delivery Configuration</h2>
              <p className="text-muted-foreground">
                Configure unlock conditions and timing for each stage
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
                      Trigger: {assignmentType === 'auto' ? 'Auto-Assign' : 'Manual Assignment'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{getTriggerSummary()}</p>
                    {assignmentType === 'auto' && !startImmediately && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Training starts {startDelayDays} days after trigger
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
                            {getTotalContentInStage(stage)} tracks
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          {stage.albums.length} albums, {stage.tracks.length} standalone tracks
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor={`unlock-type-${index}`}>Primary Unlock Condition</Label>
                          <Select
                            value={stage.unlockType}
                            onValueChange={(v) => updateStage(index, { unlockType: v })}
                          >
                            <SelectTrigger id={`unlock-type-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {index === 0 && (
                                <SelectItem value="immediate">Available immediately upon assignment</SelectItem>
                              )}
                              {index > 0 && (
                                <SelectItem value="stage-complete">When previous stage is 100% complete</SelectItem>
                              )}
                              <SelectItem value="days-after-trigger">Wait X days after trigger</SelectItem>
                              {index > 0 && (
                                <SelectItem value="days-after-stage">Wait X days after previous stage completes</SelectItem>
                              )}
                              <SelectItem value="assignment-complete">When assignment is completed</SelectItem>
                              <SelectItem value="calendar-date">On specific calendar date</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Conditional fields based on unlock type */}
                        {stage.unlockType === 'days-after-trigger' && (
                          <div className="flex items-center space-x-4 ml-6">
                            <Label htmlFor={`days-start-${index}`}>Days:</Label>
                            <Input
                              id={`days-start-${index}`}
                              type="number"
                              min="0"
                              value={stage.unlockDays}
                              onChange={(e) => updateStage(index, { unlockDays: parseInt(e.target.value) || 0 })}
                              className="w-24"
                            />
                            <span className="text-sm text-muted-foreground">after trigger</span>
                          </div>
                        )}

                        {stage.unlockType === 'days-after-stage' && index > 0 && (
                          <div className="space-y-3 ml-6">
                            <div className="flex items-center space-x-4">
                              <Label htmlFor={`after-stage-${index}`}>After Stage:</Label>
                              <Select
                                value={stage.unlockAfterStage}
                                onValueChange={(v) => updateStage(index, { unlockAfterStage: v })}
                              >
                                <SelectTrigger id={`after-stage-${index}`} className="w-[200px]">
                                  <SelectValue placeholder="Select stage" />
                                </SelectTrigger>
                                <SelectContent>
                                  {stages.slice(0, index).map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center space-x-4">
                              <Label htmlFor={`days-after-${index}`}>Wait:</Label>
                              <Input
                                id={`days-after-${index}`}
                                type="number"
                                min="0"
                                value={stage.unlockDays}
                                onChange={(e) => updateStage(index, { unlockDays: parseInt(e.target.value) || 0 })}
                                className="w-24"
                              />
                              <span className="text-sm text-muted-foreground">days after completion</span>
                            </div>
                          </div>
                        )}

                        {stage.unlockType === 'stage-complete' && index > 0 && (
                          <div className="flex items-center space-x-4 ml-6">
                            <Label htmlFor={`stage-req-${index}`}>Required Stage:</Label>
                            <Select
                              value={stage.unlockAfterStage}
                              onValueChange={(v) => updateStage(index, { unlockAfterStage: v })}
                            >
                              <SelectTrigger id={`stage-req-${index}`} className="w-[200px]">
                                <SelectValue placeholder="Select stage" />
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
                              <Label htmlFor={`assignment-${index}`}>Select Assignment</Label>
                              <Select
                                value={stage.unlockAssignment}
                                onValueChange={(v) => updateStage(index, { unlockAssignment: v })}
                              >
                                <SelectTrigger id={`assignment-${index}`}>
                                  <SelectValue placeholder="Select assignment" />
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
                              <Label htmlFor={`completer-${index}`}>Must be completed by</Label>
                              <RadioGroup
                                value={stage.unlockAssignmentCompleter}
                                onValueChange={(v) => updateStage(index, { unlockAssignmentCompleter: v })}
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="learner" id={`learner-${index}`} />
                                  <Label htmlFor={`learner-${index}`}>Learner</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="manager" id={`manager-${index}`} />
                                  <Label htmlFor={`manager-${index}`}>Learner's Manager</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="role" id={`role-${index}`} />
                                  <Label htmlFor={`role-${index}`}>Specific Role</Label>
                                </div>
                              </RadioGroup>
                            </div>
                          </div>
                        )}

                        {stage.unlockType === 'calendar-date' && (
                          <div className="flex items-center space-x-4 ml-6">
                            <Label htmlFor={`date-${index}`}>Date:</Label>
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
                          <Label>Override Options</Label>
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
                                Allow managers to manually unlock this stage early
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
                                Allow admins to override unlock conditions for specific learners
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
                                Send notification to manager when unlock conditions are met
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
                    <p className="font-medium mb-1">Assignment-Based Unlocking</p>
                    <p>You can use completed Forms and OJT assignments as unlock conditions. This allows managers to verify competency before learners progress to the next stage, creating approval gates without building separate workflows.</p>
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
              <h2 className="text-2xl font-semibold mb-2">Completion Actions</h2>
              <p className="text-muted-foreground">
                Define what happens when learners complete this playlist
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Completion Requirements</CardTitle>
                <CardDescription>Set the criteria for playlist completion</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="threshold">Completion Threshold</Label>
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
                    <span className="text-sm">% of tracks must be completed</span>
                  </div>
                  <Progress value={completionThreshold} className="h-2" />
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Minimum Score Requirements</Label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Checkpoint quizzes</span>
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
                    <span className="text-sm">Final assessment</span>
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
                  <Label htmlFor="deadline">Completion Deadline</Label>
                  <div className="flex items-center space-x-4">
                    <Input
                      id="deadline"
                      type="number"
                      min="1"
                      value={completionDeadlineDays}
                      onChange={(e) => setCompletionDeadlineDays(parseInt(e.target.value) || 30)}
                      className="w-24"
                    />
                    <span className="text-sm">days after assignment</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upon Completion Actions</CardTitle>
                <CardDescription>What happens when a learner completes this playlist?</CardDescription>
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
                          <Label htmlFor={`cred-name-${index}`}>Credential Name</Label>
                          <Input
                            id={`cred-name-${index}`}
                            placeholder="e.g., Food Handler Certificate"
                            value={action.credentialName}
                            onChange={(e) => {
                              const updated = [...completionActions];
                              updated[index].credentialName = e.target.value;
                              setCompletionActions(updated);
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`cred-exp-${index}`}>Expiration Period (months)</Label>
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
                          <Label htmlFor={`next-playlist-${index}`}>Next Playlist</Label>
                          <Select
                            value={action.playlistId}
                            onValueChange={(v) => {
                              const updated = [...completionActions];
                              updated[index].playlistId = v;
                              setCompletionActions(updated);
                            }}
                          >
                            <SelectTrigger id={`next-playlist-${index}`}>
                              <SelectValue placeholder="Select playlist" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="p1">Advanced Food Safety Procedures</SelectItem>
                              <SelectItem value="p2">Manager Leadership Academy</SelectItem>
                              <SelectItem value="p3">District Manager Training Path</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`delay-${index}`}>Delay Before Assignment (days)</Label>
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
                          <Label htmlFor={`notif-recipient-${index}`}>Recipient</Label>
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
                              <SelectItem value="manager">Direct Manager</SelectItem>
                              <SelectItem value="hr">HR Department</SelectItem>
                              <SelectItem value="learner">Learner</SelectItem>
                              <SelectItem value="custom">Custom Email</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`notif-msg-${index}`}>Message Template</Label>
                          <Textarea
                            id={`notif-msg-${index}`}
                            placeholder="Enter notification message..."
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
                    Add Credential
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => addCompletionAction('next-playlist')}
                    className="w-full"
                  >
                    <ListChecks className="h-4 w-4 mr-2" />
                    Auto-Assign Next
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => addCompletionAction('notification')}
                    className="w-full"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Send Notification
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compliance</CardTitle>
                <CardDescription>Update compliance status when playlist is completed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    <SettingsIcon className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-sm">Update Compliance Dashboard</p>
                      <p className="text-xs text-muted-foreground">Mark requirements as complete</p>
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
              <h2 className="text-2xl font-semibold mb-2">Review & Publish</h2>
              <p className="text-muted-foreground">
                Review your playlist configuration before publishing
              </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-base">
                    <ListChecks className="h-4 w-4 mr-2 text-primary" />
                    Playlist Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name:</p>
                    <p className="font-medium">{playlistName || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Description:</p>
                    <p className="text-xs line-clamp-2">{playlistDescription || 'Not set'}</p>
                  </div>
                  {playlistTags.length > 0 && (
                    <div>
                      <p className="text-muted-foreground mb-1">Tags:</p>
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
                    Content Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stages:</span>
                    <span className="font-medium">{stages.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Albums:</span>
                    <span className="font-medium">
                      {stages.reduce((acc, s) => acc + s.albums.length, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Tracks:</span>
                    <span className="font-medium">{getTotalContent()}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Timeline Recap */}
            <Card>
              <CardHeader>
                <CardTitle>Playlist Flow Timeline</CardTitle>
                <CardDescription>From trigger to completion</CardDescription>
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
                        <p className="font-semibold">Trigger</p>
                        <p className="text-sm text-muted-foreground">{getTriggerSummary()}</p>
                        {assignmentType === 'auto' && !startImmediately && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Starts {startDelayDays} days after trigger
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Stages */}
                    {stages.map((stage, index) => {
                      const unlockDesc = stage.unlockType === 'immediate' 
                        ? 'Available immediately'
                        : stage.unlockType === 'days-after-trigger'
                        ? `Unlocks ${stage.unlockDays} days after trigger`
                        : stage.unlockType === 'days-after-stage'
                        ? `Unlocks ${stage.unlockDays} days after previous stage`
                        : stage.unlockType === 'stage-complete'
                        ? 'Unlocks when previous stage is 100% complete'
                        : stage.unlockType === 'assignment-complete'
                        ? 'Unlocks when assignment is completed'
                        : 'Unlocks on specific date';
                      
                      return (
                        <div key={stage.id} className="flex items-start space-x-4 relative">
                          <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0 z-10">
                            <Lock className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 pt-2">
                            <p className="font-semibold">{stage.name}</p>
                            <p className="text-sm text-muted-foreground">{unlockDesc}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {stage.albums.length} albums, {stage.tracks.length} tracks • {getTotalContentInStage(stage)} total tracks
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
                        <p className="font-semibold">Completion</p>
                        <p className="text-sm text-muted-foreground">
                          {completionThreshold}% threshold • {completionDeadlineDays} day deadline
                        </p>
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
                    <p className="font-medium mb-1">Ready to Publish</p>
                    <p>Your playlist is configured and ready to be published. Click "Publish Playlist" to make it active.</p>
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
                Back to Playlists
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <h1>{mode === 'create' ? 'Create New Playlist' : 'Edit Playlist'}</h1>
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
              Step {currentStep + 1} of {WIZARD_STEPS.length}
            </div>
            <div className="flex items-center space-x-3">
              {currentStep > 0 && (
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
              
              {currentStep < WIZARD_STEPS.length - 1 ? (
                <Button 
                  className="bg-brand-gradient" 
                  onClick={handleNext}
                  disabled={!canProceed}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  className="bg-brand-gradient"
                  onClick={onClose}
                  disabled={!canProceed}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Publish Playlist
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}