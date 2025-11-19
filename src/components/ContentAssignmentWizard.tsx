import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Progress } from './ui/progress';
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  PlaySquare, 
  Clock, 
  Users, 
  CalendarIcon,
  CheckCircle,
  AlertTriangle,
  Target,
  Filter,
  X,
  Zap
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface Playlist {
  id: string;
  title: string;
  description: string;
  duration: string;
  type: 'safety' | 'product' | 'service' | 'compliance';
  tracks: number;
  thumbnail: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedCompletion: string;
}

interface Employee {
  id: string;
  name: string;
  role: string;
  unit: string;
  email: string;
  avatar?: string;
  isSelected?: boolean;
  alreadyAssigned?: boolean;
  completionRate?: number;
  district: string;
  state: string;
}

interface Unit {
  id: string;
  name: string;
  employeeCount: number;
  district: string;
  manager: string;
  state: string;
}

const mockPlaylists: Playlist[] = [
  {
    id: '1',
    title: 'Q4 Safety Protocol Update',
    description: 'Updated safety procedures and emergency protocols for Q4 2024',
    duration: '45 min',
    type: 'safety',
    tracks: 8,
    thumbnail: 'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?w=300&h=200&fit=crop',
    difficulty: 'intermediate',
    estimatedCompletion: '3 days'
  },
  {
    id: '2',
    title: 'New Product Launch Training',
    description: 'Comprehensive training on our latest product line features and benefits',
    duration: '60 min',
    type: 'product',
    tracks: 12,
    thumbnail: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=300&h=200&fit=crop',
    difficulty: 'beginner',
    estimatedCompletion: '5 days'
  },
  {
    id: '3',
    title: 'Customer Service Excellence',
    description: 'Advanced customer service techniques and best practices for exceptional experiences',
    duration: '30 min',
    type: 'service',
    tracks: 6,
    thumbnail: 'https://images.unsplash.com/photo-1553484771-371a605b060b?w=300&h=200&fit=crop',
    difficulty: 'advanced',
    estimatedCompletion: '2 days'
  },
  {
    id: '4',
    title: 'Compliance Certification',
    description: 'Mandatory compliance training and certification requirements',
    duration: '90 min',
    type: 'compliance',
    tracks: 15,
    thumbnail: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=300&h=200&fit=crop',
    difficulty: 'intermediate',
    estimatedCompletion: '7 days'
  }
];

const mockEmployees: Employee[] = [
  { id: '1', name: 'Sarah Johnson', role: 'Sales Associate', unit: 'Store A', email: 'sarah.j@company.com', completionRate: 95, district: 'North', state: 'CA' },
  { id: '2', name: 'Mike Chen', role: 'Team Lead', unit: 'Store A', email: 'mike.c@company.com', alreadyAssigned: true, completionRate: 88, district: 'North', state: 'CA' },
  { id: '3', name: 'Emily Davis', role: 'Sales Associate', unit: 'Store B', email: 'emily.d@company.com', completionRate: 92, district: 'South', state: 'CA' },
  { id: '4', name: 'James Wilson', role: 'Assistant Manager', unit: 'Store B', email: 'james.w@company.com', completionRate: 97, district: 'South', state: 'CA' },
  { id: '5', name: 'Lisa Anderson', role: 'Sales Associate', unit: 'Store C', email: 'lisa.a@company.com', completionRate: 76, district: 'East', state: 'CA' },
  { id: '6', name: 'Robert Taylor', role: 'Store Manager', unit: 'Store A', email: 'robert.t@company.com', completionRate: 100, district: 'North', state: 'CA' },
  { id: '7', name: 'Jennifer Adams', role: 'Store Manager', unit: 'Store D', email: 'jennifer.a@company.com', completionRate: 94, district: 'West', state: 'TX' },
  { id: '8', name: 'David Kim', role: 'Store Manager', unit: 'Store E', email: 'david.k@company.com', completionRate: 91, district: 'East', state: 'NY' },
  { id: '9', name: 'Maria Garcia', role: 'Sales Associate', unit: 'Store D', email: 'maria.g@company.com', completionRate: 85, district: 'West', state: 'TX' },
  { id: '10', name: 'Kevin Nguyen', role: 'Team Lead', unit: 'Store E', email: 'kevin.n@company.com', completionRate: 89, district: 'East', state: 'NY' },
  { id: '11', name: 'Amanda Lee', role: 'Assistant Manager', unit: 'Store C', email: 'amanda.l@company.com', completionRate: 96, district: 'East', state: 'CA' },
  { id: '12', name: 'Chris Brown', role: 'Sales Associate', unit: 'Store E', email: 'chris.b@company.com', completionRate: 78, district: 'East', state: 'NY' }
];

const mockUnits: Unit[] = [
  { id: '1', name: 'Store A', employeeCount: 24, district: 'North', manager: 'Robert Taylor', state: 'CA' },
  { id: '2', name: 'Store B', employeeCount: 18, district: 'South', manager: 'Jennifer Adams', state: 'CA' },
  { id: '3', name: 'Store C', employeeCount: 31, district: 'East', manager: 'David Kim', state: 'CA' },
  { id: '4', name: 'Store D', employeeCount: 22, district: 'West', manager: 'Jennifer Adams', state: 'TX' },
  { id: '5', name: 'Store E', employeeCount: 19, district: 'East', manager: 'David Kim', state: 'NY' }
];

interface ContentAssignmentWizardProps {
  isOpen?: boolean;
  onClose: () => void;
  isFullPage?: boolean;
}

export function ContentAssignmentWizard({ isOpen, onClose, isFullPage }: ContentAssignmentWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPlaylists, setSelectedPlaylists] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [isMandatory, setIsMandatory] = useState(true);
  const [autoReminders, setAutoReminders] = useState(true);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [allEmployeesSelected, setAllEmployeesSelected] = useState(false);

  const totalSteps = 4;

  // Available options for filters
  const availableRoles = [...new Set(mockEmployees.map(emp => emp.role))];
  const availableStates = [...new Set(mockEmployees.map(emp => emp.state))];
  const availableDistricts = [...new Set(mockEmployees.map(emp => emp.district))];

  const handlePlaylistToggle = (playlistId: string) => {
    setSelectedPlaylists(prev => 
      prev.includes(playlistId) 
        ? prev.filter(id => id !== playlistId)
        : [...prev, playlistId]
    );
  };

  const handleEmployeeToggle = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleUnitToggle = (unitId: string) => {
    setSelectedUnits(prev => 
      prev.includes(unitId) 
        ? prev.filter(id => id !== unitId)
        : [...prev, unitId]
    );
  };

  const handleRoleToggle = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleStateToggle = (state: string) => {
    setSelectedStates(prev => 
      prev.includes(state) 
        ? prev.filter(s => s !== state)
        : [...prev, state]
    );
  };

  const handleAllEmployeesToggle = (checked: boolean) => {
    setAllEmployeesSelected(checked);
    if (checked) {
      const allEmployeeIds = filteredEmployees.map(emp => emp.id);
      setSelectedEmployees(allEmployeeIds);
    } else {
      setSelectedEmployees([]);
    }
  };

  const getSelectedEmployeesFromUnits = () => {
    if (selectedUnits.length === 0) return selectedEmployees;
    
    const unitEmployees = mockEmployees
      .filter(emp => selectedUnits.some(unitId => 
        mockUnits.find(unit => unit.id === unitId)?.name === emp.unit
      ))
      .map(emp => emp.id);
    
    return [...new Set([...selectedEmployees, ...unitEmployees])];
  };

  const getTotalSelectedEmployees = () => {
    return getSelectedEmployeesFromUnits().length;
  };

  const getAlreadyAssignedCount = () => {
    const allSelected = getSelectedEmployeesFromUnits();
    return mockEmployees.filter(emp => 
      allSelected.includes(emp.id) && emp.alreadyAssigned
    ).length;
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    const assignmentData = {
      playlists: selectedPlaylists,
      employees: getSelectedEmployeesFromUnits(),
      startDate,
      endDate,
      isMandatory,
      autoReminders
    };
    
    toast.success(`Successfully assigned ${selectedPlaylists.length} playlist(s) to ${getTotalSelectedEmployees()} employee(s)`, {
      description: 'Assignments will be available immediately in employee dashboards.'
    });
    onClose();
    
    // Reset form
    setCurrentStep(1);
    setSelectedPlaylists([]);
    setSelectedEmployees([]);
    setSelectedUnits([]);
    setStartDate(new Date());
    setEndDate(undefined);
    setIsMandatory(true);
    setAutoReminders(true);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedPlaylists.length > 0;
      case 2:
        return getTotalSelectedEmployees() > 0;
      case 3:
        return startDate !== undefined;
      default:
        return true;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'safety': return 'bg-red-50 text-red-700 border-red-200';
      case 'product': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'service': return 'bg-green-50 text-green-700 border-green-200';
      case 'compliance': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredEmployees = mockEmployees.filter(emp => {
    // Search filter
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.unit.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Role filter
    const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(emp.role);
    
    // State filter
    const matchesState = selectedStates.length === 0 || selectedStates.includes(emp.state);
    
    // District filter
    const matchesDistrict = selectedDistricts.length === 0 || selectedDistricts.includes(emp.district);
    
    return matchesSearch && matchesRole && matchesState && matchesDistrict;
  });

  const stepTitles = [
    'Choose Content',
    'Select Audience',
    'Schedule & Rules',
    'Review & Confirm'
  ];

  // Render the wizard content
  const wizardContent = (
    <>
      {/* Header - only show in full page mode */}
      {isFullPage && (
        <div className="mb-6">
          <h1 className="text-foreground">Assign Content to Employees</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage training assignments across your organization
          </p>
        </div>
      )}

      {/* Enhanced Progress Steps */}
      <div className="py-6 px-2">
        <div className="flex items-center justify-between mb-2">
          {stepTitles.map((title, index) => (
            <div key={index} className="flex flex-col items-center flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                index + 1 <= currentStep 
                  ? 'bg-primary text-primary-foreground shadow-brand' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {index + 1 <= currentStep ? 
                  <CheckCircle className="w-5 h-5" /> : 
                  index + 1
                }
              </div>
              <span className={`text-xs mt-2 font-medium ${
                index + 1 === currentStep ? 'text-primary' : 'text-muted-foreground'
              }`}>
                {title}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center mt-4">
          <Progress value={(currentStep / totalSteps) * 100} className="flex-1" />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-2">
        {/* Step 1: Choose Content */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Choose Training Content</h3>
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                {selectedPlaylists.length} selected
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {mockPlaylists.map((playlist) => (
                <Card 
                  key={playlist.id} 
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedPlaylists.includes(playlist.id) 
                      ? 'ring-2 ring-primary shadow-brand bg-primary/5' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => handlePlaylistToggle(playlist.id)}
                >
                  <CardContent className="p-0">
                    <div className="relative">
                      <img 
                        src={playlist.thumbnail} 
                        alt={playlist.title}
                        className="w-full h-32 object-cover rounded-t-lg"
                      />
                      <div className="absolute top-3 left-3">
                        <Checkbox 
                          checked={selectedPlaylists.includes(playlist.id)}
                          className="bg-white/90 border-white shadow-sm"
                        />
                      </div>
                      <div className="absolute top-3 right-3">
                        <Badge className={getTypeColor(playlist.type)}>
                          {playlist.type}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="p-4 space-y-3">
                      <div>
                        <h4 className="font-semibold text-base mb-1">{playlist.title}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {playlist.description}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-3 text-muted-foreground">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{playlist.duration}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <PlaySquare className="w-3 h-3" />
                            <span>{playlist.tracks} modules</span>
                          </span>
                        </div>
                        <Badge variant="outline" className={getDifficultyColor(playlist.difficulty)}>
                          {playlist.difficulty}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <span className="text-xs text-muted-foreground">
                          Est. completion: {playlist.estimatedCompletion}
                        </span>
                        <Target className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Target Audience */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Select Target Audience</h3>
              <Badge variant="outline" className="bg-green-50 text-green-700">
                {getTotalSelectedEmployees()} employees selected
              </Badge>
            </div>
            
            {/* Search and Filters */}
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees by name, role, or unit..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>

            {/* Select by Role */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Select by Role</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {availableRoles.map((role) => {
                  const employeeCount = mockEmployees.filter(emp => emp.role === role).length;
                  return (
                    <Card 
                      key={role}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedRoles.includes(role) ? 'ring-2 ring-primary bg-primary/5' : ''
                      }`}
                      onClick={() => handleRoleToggle(role)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox checked={selectedRoles.includes(role)} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{role}</p>
                            <p className="text-xs text-muted-foreground">
                              {employeeCount} {employeeCount === 1 ? 'employee' : 'employees'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Select by State */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Select by State</Label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {availableStates.map((state) => {
                  const employeeCount = mockEmployees.filter(emp => emp.state === state).length;
                  const storeCount = mockUnits.filter(unit => unit.state === state).length;
                  return (
                    <Card 
                      key={state}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedStates.includes(state) ? 'ring-2 ring-primary bg-primary/5' : ''
                      }`}
                      onClick={() => handleStateToggle(state)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox checked={selectedStates.includes(state)} />
                          <div className="flex-1">
                            <p className="font-semibold text-base">{state}</p>
                            <p className="text-xs text-muted-foreground">
                              {storeCount} {storeCount === 1 ? 'store' : 'stores'} • {employeeCount} emp
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Units Selection */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Select by Unit</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {mockUnits.map((unit) => (
                  <Card 
                    key={unit.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedUnits.includes(unit.id) ? 'ring-2 ring-primary bg-primary/5' : ''
                    }`}
                    onClick={() => handleUnitToggle(unit.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <Checkbox checked={selectedUnits.includes(unit.id)} />
                        <div className="flex-1">
                          <h4 className="font-semibold">{unit.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {unit.employeeCount} employees • {unit.district} District
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Manager: {unit.manager}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <Separator />

            {/* Individual Employees */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Individual Employees</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="all-employees"
                    checked={allEmployeesSelected}
                    onCheckedChange={handleAllEmployeesToggle}
                  />
                  <label 
                    htmlFor="all-employees"
                    className="text-sm font-medium cursor-pointer text-primary"
                  >
                    All Employees ({filteredEmployees.length})
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                {filteredEmployees.map((employee) => (
                  <Card
                    key={employee.id}
                    className={`cursor-pointer transition-all hover:shadow-sm ${
                      selectedEmployees.includes(employee.id) ? 'bg-accent border-primary' : 'hover:bg-accent/50'
                    }`}
                    onClick={() => handleEmployeeToggle(employee.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center space-x-3">
                        <Checkbox checked={selectedEmployees.includes(employee.id)} />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={employee.avatar} />
                          <AvatarFallback className="text-xs">
                            {employee.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{employee.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {employee.role} • {employee.unit}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500 transition-all"
                                style={{ width: `${employee.completionRate}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {employee.completionRate}%
                            </span>
                          </div>
                        </div>
                        {employee.alreadyAssigned && (
                          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Assigned
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Selection Summary */}
            <Card className="bg-accent/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Users className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-semibold">
                        {getTotalSelectedEmployees()} employees selected
                      </p>
                      {getAlreadyAssignedCount() > 0 && (
                        <p className="text-sm text-orange-600">
                          {getAlreadyAssignedCount()} already have similar assignments
                        </p>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => {
                    setSelectedEmployees([]);
                    setSelectedUnits([]);
                  }}>
                    Clear All
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Schedule & Rules */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Schedule & Assignment Rules</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                {/* Date Selection */}
                <div>
                  <Label className="text-base font-semibold mb-3 block">Assignment Schedule</Label>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm mb-2 block">Start Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate ? startDate.toLocaleDateString() : 'Select start date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    <div>
                      <Label className="text-sm mb-2 block">End Date (Optional)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? endDate.toLocaleDateString() : 'No end date set'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Assignment Rules */}
                <div>
                  <Label className="text-base font-semibold mb-3 block">Assignment Rules</Label>
                  <div className="space-y-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-red-50 rounded-lg">
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                            </div>
                            <div>
                              <Label className="font-medium">Mandatory Assignment</Label>
                              <p className="text-sm text-muted-foreground">
                                Employees must complete this training
                              </p>
                            </div>
                          </div>
                          <Switch checked={isMandatory} onCheckedChange={setIsMandatory} />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-blue-50 rounded-lg">
                              <Zap className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <Label className="font-medium">Auto Reminders</Label>
                              <p className="text-sm text-muted-foreground">
                                Send weekly reminder notifications
                              </p>
                            </div>
                          </div>
                          <Switch checked={autoReminders} onCheckedChange={setAutoReminders} />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review & Confirm */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Review Assignment Details</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Selected Content */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Selected Content</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedPlaylists.map(id => {
                    const playlist = mockPlaylists.find(p => p.id === id);
                    return playlist ? (
                      <div key={id} className="flex items-center space-x-3 p-3 bg-accent/50 rounded-lg">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <PlaySquare className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{playlist.title}</h4>
                          <p className="text-xs text-muted-foreground">
                            {playlist.duration} • {playlist.tracks} modules
                          </p>
                        </div>
                        <Badge className={getTypeColor(playlist.type)}>
                          {playlist.type}
                        </Badge>
                      </div>
                    ) : null;
                  })}
                </CardContent>
              </Card>

              {/* Assignment Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Assignment Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="font-medium">Target Audience</span>
                    </div>
                    <span className="font-bold text-primary">
                      {getTotalSelectedEmployees()} employees
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Start Date:</span>
                      <span className="font-medium">{startDate?.toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>End Date:</span>
                      <span className="font-medium">{endDate?.toLocaleDateString() || 'No end date'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Assignment Type:</span>
                      <Badge variant={isMandatory ? "default" : "outline"}>
                        {isMandatory ? 'Mandatory' : 'Optional'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Reminders:</span>
                      <span className="font-medium">{autoReminders ? 'Weekly' : 'Disabled'}</span>
                    </div>
                  </div>

                  {getAlreadyAssignedCount() > 0 && (
                    <Card className="bg-yellow-50 border-yellow-200">
                      <CardContent className="p-3">
                        <div className="flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-yellow-800">
                              Duplicate Assignment Warning
                            </p>
                            <p className="text-xs text-yellow-700">
                              {getAlreadyAssignedCount()} employee(s) already have similar assignments
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Navigation */}
      <div className="flex items-center justify-between pt-6 border-t border-border">
        <Button 
          variant="outline" 
          onClick={handleBack}
          disabled={currentStep === 1}
          className="flex items-center space-x-2"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back</span>
        </Button>
        
        <div className="flex items-center space-x-4">
          <span className="text-sm text-muted-foreground">
            Step {currentStep} of {totalSteps}
          </span>
          {!canProceed() && (
            <span className="text-xs text-red-600">
              Please complete required fields
            </span>
          )}
        </div>
        
        {currentStep < totalSteps ? (
          <Button 
            onClick={handleNext}
            disabled={!canProceed()}
            className="bg-primary hover:bg-primary/90 flex items-center space-x-2"
          >
            <span>Continue</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button 
            onClick={handleComplete}
            disabled={!canProceed()}
            className="bg-brand-gradient hover:opacity-90 text-white shadow-brand flex items-center space-x-2"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Assign Content</span>
          </Button>
        )}
      </div>
    </>
  );

  // Render as full page or dialog
  if (isFullPage) {
    return (
      <div className="space-y-6">
        {wizardContent}
      </div>
    );
  }

  // Render as dialog
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-xl font-bold">Assign Content to Employees</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Create and manage training assignments across your organization
          </DialogDescription>
        </DialogHeader>
        
        {wizardContent}
      </DialogContent>
    </Dialog>
  );
}