import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Footer } from './Footer';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Checkbox } from './ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { FilterDialog } from './FilterDialog';
import { 
  ArrowLeft,
  Download,
  Filter,
  Calendar as CalendarIcon,
  X,
  FileText,
  Search,
  SlidersHorizontal,
  RefreshCw,
  Users,
  Building,
  BookOpen,
  Play,
  Award,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Eye,
  Settings,
  CheckCircle,
  Plus,
  Info
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { getLearnerRecords, type LearnerRecord as LearnerRecordType } from '../lib/crud/reports';
import { useEffect, useState } from 'react';

// Mock date formatting function since date-fns is not available
const format = (date: Date, formatStr: string) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (formatStr === 'MMM dd') {
    return `${months[date.getMonth()]} ${date.getDate().toString().padStart(2, '0')}`;
  }
  return date.toLocaleDateString();
};

type UserRole = 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';

interface ReportsProps {
  currentRole: 'admin' | 'district-manager' | 'store-manager';
  onBackToDashboard?: () => void;
  storeFilter?: string;
}

interface FilterState {
  progress: { min: number; max: number };
  albums: string[];
  location: string[];
  districts: string[];
  roles: string[];
  playlists: string[];
  tracks: string[];
  dateRange: { start: Date | null; end: Date | null };
  employees: string[];
  certifications: string[];
  completionStatus: string[];
}

interface LearnerRecord {
  id: string;
  employeeName: string;
  employeeId: string;
  district: string;
  store: string;
  role: string;
  department: string;
  album: string;
  playlist: string;
  track: string;
  progress: number;
  completionDate: string | null;
  score: number;
  timeSpent: number;
  attempts: number;
  certification: string | null;
  certificationDate: string | null;
  status: 'completed' | 'in-progress' | 'not-started' | 'overdue';
  lastActivity: string;
}

// Mock data for learner records
const mockLearnerData: LearnerRecord[] = [
  {
    id: '1',
    employeeName: 'Sarah Johnson',
    employeeId: 'EMP001',
    district: 'North',
    store: 'Store A',
    role: 'Sales Associate',
    department: 'Sales',
    album: 'Safety Training Album',
    playlist: 'Emergency Procedures',
    track: 'Fire Safety Protocol',
    progress: 100,
    completionDate: '2024-06-15',
    score: 95,
    timeSpent: 45,
    attempts: 1,
    certification: 'Fire Safety Certification',
    certificationDate: '2024-06-15',
    status: 'completed',
    lastActivity: '2024-06-15'
  },
  {
    id: '2',
    employeeName: 'Mike Rodriguez',
    employeeId: 'EMP002',
    district: 'South',
    store: 'Store B',
    role: 'Store Manager',
    department: 'Management',
    album: 'Leadership Development',
    playlist: 'Team Management',
    track: 'Conflict Resolution',
    progress: 78,
    completionDate: null,
    score: 82,
    timeSpent: 32,
    attempts: 2,
    certification: null,
    certificationDate: null,
    status: 'in-progress',
    lastActivity: '2024-06-20'
  },
  {
    id: '3',
    employeeName: 'Emily Chen',
    employeeId: 'EMP003',
    district: 'East',
    store: 'Store C',
    role: 'Sales Associate',
    department: 'Sales',
    album: 'Customer Service Excellence',
    playlist: 'Customer Communication',
    track: 'Handling Complaints',
    progress: 96,
    completionDate: '2024-06-28',
    score: 88,
    timeSpent: 38,
    attempts: 1,
    certification: 'Customer Service Pro',
    certificationDate: '2024-06-28',
    status: 'completed',
    lastActivity: '2024-06-28'
  },
  {
    id: '4',
    employeeName: 'David Thompson',
    employeeId: 'EMP004',
    district: 'North',
    store: 'Store D',
    role: 'Team Lead',
    department: 'Operations',
    album: 'Safety Training Album',
    playlist: 'Workplace Safety',
    track: 'Equipment Handling',
    progress: 65,
    completionDate: null,
    score: 75,
    timeSpent: 28,
    attempts: 3,
    certification: null,
    certificationDate: null,
    status: 'in-progress',
    lastActivity: '2024-06-25'
  },
  {
    id: '5',
    employeeName: 'Lisa Park',
    employeeId: 'EMP005',
    district: 'North',
    store: 'Store A',
    role: 'Supervisor',
    department: 'Sales',
    album: 'Product Knowledge',
    playlist: 'Product Features',
    track: 'Advanced Features',
    progress: 100,
    completionDate: '2024-06-22',
    score: 92,
    timeSpent: 42,
    attempts: 1,
    certification: 'Product Expert',
    certificationDate: '2024-06-22',
    status: 'completed',
    lastActivity: '2024-06-22'
  },
  {
    id: '6',
    employeeName: 'James Wilson',
    employeeId: 'EMP006',
    district: 'South',
    store: 'Store E',
    role: 'Sales Associate',
    department: 'Sales',
    album: 'Safety Training Album',
    playlist: 'Emergency Procedures',
    track: 'Evacuation Procedures',
    progress: 95,
    completionDate: '2024-06-30',
    score: 89,
    timeSpent: 35,
    attempts: 1,
    certification: 'Emergency Response',
    certificationDate: '2024-06-30',
    status: 'completed',
    lastActivity: '2024-06-30'
  },
  {
    id: '7',
    employeeName: 'Maria Garcia',
    employeeId: 'EMP007',
    district: 'North',
    store: 'Store A',
    role: 'Sales Associate',
    department: 'Sales',
    album: 'Customer Service Excellence',
    playlist: 'Sales Techniques',
    track: 'Upselling Strategies',
    progress: 82,
    completionDate: null,
    score: 84,
    timeSpent: 29,
    attempts: 2,
    certification: null,
    certificationDate: null,
    status: 'in-progress',
    lastActivity: '2024-06-26'
  },
  {
    id: '8',
    employeeName: 'Robert Brown',
    employeeId: 'EMP008',
    district: 'South',
    store: 'Store B',
    role: 'Team Lead',
    department: 'Operations',
    album: 'Leadership Development',
    playlist: 'Performance Management',
    track: 'Goal Setting',
    progress: 100,
    completionDate: '2024-06-18',
    score: 94,
    timeSpent: 48,
    attempts: 1,
    certification: 'Leadership Certified',
    certificationDate: '2024-06-18',
    status: 'completed',
    lastActivity: '2024-06-18'
  },
  {
    id: '9',
    employeeName: 'Amanda Lee',
    employeeId: 'EMP009',
    district: 'East',
    store: 'Store C',
    role: 'Assistant Manager',
    department: 'Management',
    album: 'Product Knowledge',
    playlist: 'Product Features',
    track: 'Basic Features',
    progress: 55,
    completionDate: null,
    score: 68,
    timeSpent: 22,
    attempts: 2,
    certification: null,
    certificationDate: null,
    status: 'in-progress',
    lastActivity: '2024-06-29'
  },
  {
    id: '10',
    employeeName: 'Kevin Nguyen',
    employeeId: 'EMP010',
    district: 'South',
    store: 'Store B',
    role: 'Sales Associate',
    department: 'Sales',
    album: 'Safety Training Album',
    playlist: 'Workplace Safety',
    track: 'Personal Protective Equipment',
    progress: 100,
    completionDate: '2024-06-21',
    score: 97,
    timeSpent: 41,
    attempts: 1,
    certification: 'Safety Certified',
    certificationDate: '2024-06-21',
    status: 'completed',
    lastActivity: '2024-06-21'
  },
  {
    id: '11',
    employeeName: 'Jessica Martinez',
    employeeId: 'EMP011',
    district: 'North',
    store: 'Store D',
    role: 'Sales Associate',
    department: 'Sales',
    album: 'Customer Service Excellence',
    playlist: 'Customer Communication',
    track: 'Active Listening',
    progress: 0,
    completionDate: null,
    score: 0,
    timeSpent: 0,
    attempts: 0,
    certification: null,
    certificationDate: null,
    status: 'not-started',
    lastActivity: '2024-06-10'
  },
  {
    id: '12',
    employeeName: 'Brandon Taylor',
    employeeId: 'EMP012',
    district: 'South',
    store: 'Store E',
    role: 'Team Lead',
    department: 'Operations',
    album: 'Leadership Development',
    playlist: 'Team Management',
    track: 'Delegation Skills',
    progress: 45,
    completionDate: null,
    score: 52,
    timeSpent: 18,
    attempts: 3,
    certification: null,
    certificationDate: null,
    status: 'overdue',
    lastActivity: '2024-05-28'
  },
  {
    id: '13',
    employeeName: 'Rachel Kim',
    employeeId: 'EMP013',
    district: 'North',
    store: 'Store A',
    role: 'Supervisor',
    department: 'Sales',
    album: 'Product Knowledge',
    playlist: 'Product Features',
    track: 'Advanced Features',
    progress: 89,
    completionDate: null,
    score: 91,
    timeSpent: 36,
    attempts: 1,
    certification: null,
    certificationDate: null,
    status: 'in-progress',
    lastActivity: '2024-06-30'
  },
  {
    id: '14',
    employeeName: 'Christopher Davis',
    employeeId: 'EMP014',
    district: 'East',
    store: 'Store C',
    role: 'Store Manager',
    department: 'Management',
    album: 'Leadership Development',
    playlist: 'Performance Management',
    track: 'Performance Reviews',
    progress: 100,
    completionDate: '2024-06-24',
    score: 96,
    timeSpent: 52,
    attempts: 1,
    certification: 'Leadership Certified',
    certificationDate: '2024-06-24',
    status: 'completed',
    lastActivity: '2024-06-24'
  },
  {
    id: '15',
    employeeName: 'Nicole Anderson',
    employeeId: 'EMP015',
    district: 'South',
    store: 'Store B',
    role: 'Sales Associate',
    department: 'Sales',
    album: 'Customer Service Excellence',
    playlist: 'Sales Techniques',
    track: 'Cross-Selling',
    progress: 72,
    completionDate: null,
    score: 78,
    timeSpent: 26,
    attempts: 2,
    certification: null,
    certificationDate: null,
    status: 'in-progress',
    lastActivity: '2024-06-27'
  },
  {
    id: '16',
    employeeName: 'Joshua White',
    employeeId: 'EMP016',
    district: 'North',
    store: 'Store D',
    role: 'Assistant Manager',
    department: 'Management',
    album: 'Safety Training Album',
    playlist: 'Emergency Procedures',
    track: 'First Aid Basics',
    progress: 100,
    completionDate: '2024-06-19',
    score: 93,
    timeSpent: 44,
    attempts: 1,
    certification: 'First Aid Certification',
    certificationDate: '2024-06-19',
    status: 'completed',
    lastActivity: '2024-06-19'
  },
  {
    id: '17',
    employeeName: 'Samantha Lopez',
    employeeId: 'EMP017',
    district: 'South',
    store: 'Store E',
    role: 'Sales Associate',
    department: 'Sales',
    album: 'Product Knowledge',
    playlist: 'Product Features',
    track: 'Product Specifications',
    progress: 38,
    completionDate: null,
    score: 45,
    timeSpent: 15,
    attempts: 4,
    certification: null,
    certificationDate: null,
    status: 'in-progress',
    lastActivity: '2024-06-23'
  },
  {
    id: '18',
    employeeName: 'Daniel Harris',
    employeeId: 'EMP018',
    district: 'North',
    store: 'Store A',
    role: 'Team Lead',
    department: 'Operations',
    album: 'Leadership Development',
    playlist: 'Team Management',
    track: 'Motivation Techniques',
    progress: 92,
    completionDate: null,
    score: 89,
    timeSpent: 39,
    attempts: 1,
    certification: null,
    certificationDate: null,
    status: 'in-progress',
    lastActivity: '2024-07-01'
  }
];

// Filter options with enhanced structure
const filterProperties = [
  {
    id: 'progress',
    label: 'Progress',
    icon: Clock,
    type: 'range',
    description: 'Filter by completion percentage'
  },
  {
    id: 'albums',
    label: 'Albums',
    icon: BookOpen,
    type: 'multi-select',
    description: 'Select specific training albums',
    options: ['Safety Training Album', 'Customer Service Excellence', 'Product Knowledge', 'Leadership Development']
  },
  {
    id: 'location',
    label: 'Location',
    icon: MapPin,
    type: 'multi-select',
    description: 'Filter by districts and stores',
    options: ['North', 'South', 'East', 'Store A', 'Store B', 'Store C', 'Store D', 'Store E']
  },
  {
    id: 'districts',
    label: 'Districts',
    icon: Building,
    type: 'multi-select',
    description: 'Filter by geographic districts',
    options: ['North', 'South', 'East']
  },
  {
    id: 'roles',
    label: 'Roles',
    icon: Users,
    type: 'multi-select',
    description: 'Filter by job roles',
    options: ['Sales Associate', 'Team Lead', 'Supervisor', 'Store Manager', 'Assistant Manager']
  },
  {
    id: 'playlists',
    label: 'Playlists',
    icon: Play,
    type: 'multi-select',
    description: 'Select specific playlists',
    options: ['Emergency Procedures', 'Customer Communication', 'Product Features', 'Team Management', 'Sales Techniques', 'Performance Management', 'Workplace Safety']
  },
  {
    id: 'tracks',
    label: 'Tracks',
    icon: Play,
    type: 'multi-select',
    description: 'Filter by individual tracks',
    options: ['Fire Safety Protocol', 'Conflict Resolution', 'Handling Complaints', 'Equipment Handling', 'Advanced Features', 'Evacuation Procedures', 'Upselling Strategies', 'Goal Setting']
  },
  {
    id: 'certifications',
    label: 'Certifications',
    icon: Award,
    type: 'multi-select',
    description: 'Filter by earned certifications',
    options: ['Fire Safety Certification', 'Customer Service Pro', 'Product Expert', 'Emergency Response', 'Leadership Certified', 'Safety Certified', 'First Aid Certification']
  },
  {
    id: 'completionStatus',
    label: 'Status',
    icon: CheckCircle,
    type: 'multi-select',
    description: 'Filter by completion status',
    options: ['completed', 'in-progress', 'not-started', 'overdue']
  },
  {
    id: 'dateRange',
    label: 'Date Range',
    icon: CalendarIcon,
    type: 'date-range',
    description: 'Filter by date range'
  }
];

export function Reports({ currentRole, onBackToDashboard, storeFilter }: ReportsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof LearnerRecord>('employeeName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [showFilterPicker, setShowFilterPicker] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [activeFilterProperty, setActiveFilterProperty] = useState<string | null>(null);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [learnerData, setLearnerData] = useState<LearnerRecordType[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filters, setFilters] = useState<FilterState>({
    progress: { min: 0, max: 100 },
    albums: [],
    location: [],
    districts: [],
    roles: [],
    playlists: [],
    tracks: [],
    dateRange: { start: null, end: null },
    employees: [],
    certifications: [],
    completionStatus: []
  });

  // Active filters for display
  const activeFilters = useMemo(() => {
    const active: Array<{ key: string; label: string; value: string }> = [];
    
    if (filters.progress.min > 0 || filters.progress.max < 100) {
      active.push({
        key: 'progress',
        label: 'Progress',
        value: `${filters.progress.min}% - ${filters.progress.max}%`
      });
    }
    
    filters.albums.forEach(album => {
      active.push({ key: 'albums', label: 'Album', value: album });
    });
    
    filters.location.forEach(location => {
      active.push({ key: 'location', label: 'Location', value: location });
    });
    
    filters.districts.forEach(district => {
      active.push({ key: 'districts', label: 'District', value: district });
    });
    
    filters.roles.forEach(role => {
      active.push({ key: 'roles', label: 'Role', value: role });
    });
    
    filters.playlists.forEach(playlist => {
      active.push({ key: 'playlists', label: 'Playlist', value: playlist });
    });
    
    filters.tracks.forEach(track => {
      active.push({ key: 'tracks', label: 'Track', value: track });
    });
    
    filters.certifications.forEach(cert => {
      active.push({ key: 'certifications', label: 'Certification', value: cert });
    });
    
    filters.completionStatus.forEach(status => {
      active.push({ key: 'completionStatus', label: 'Status', value: status });
    });
    
    if (filters.dateRange.start && filters.dateRange.end) {
      active.push({
        key: 'dateRange',
        label: 'Date Range',
        value: `${format(filters.dateRange.start, 'MMM dd')} - ${format(filters.dateRange.end, 'MMM dd')}`
      });
    }
    
    return active;
  }, [filters]);

  // Fetch learner records on mount and when storeFilter changes
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const data = await getLearnerRecords(storeFilter);
        setLearnerData(data);
      } catch (error) {
        console.error('Error fetching learner records:', error);
        toast.error('Failed to load learner records');
        setLearnerData([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [storeFilter]);

  // Filtered and sorted data
  const filteredData = useMemo(() => {
    let filtered = learnerData.filter(record => {
      // Store filter (from StoreDetail component)
      if (storeFilter) {
        if (record.store !== storeFilter) {
          return false;
        }
      }
      
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (!record.employeeName.toLowerCase().includes(searchLower) &&
            !record.employeeId.toLowerCase().includes(searchLower) &&
            !record.album.toLowerCase().includes(searchLower) &&
            !record.playlist.toLowerCase().includes(searchLower) &&
            !record.track.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      
      // Progress filter
      if (record.progress < filters.progress.min || record.progress > filters.progress.max) {
        return false;
      }
      
      // Album filter
      if (filters.albums.length > 0 && !filters.albums.includes(record.album)) {
        return false;
      }
      
      // Location filter (districts and stores)
      if (filters.location.length > 0) {
        const locationMatch = filters.location.some(location => 
          record.district === location || record.store === location
        );
        if (!locationMatch) {
          return false;
        }
      }
      
      // District filter
      if (filters.districts.length > 0 && !filters.districts.includes(record.district)) {
        return false;
      }
      
      // Role filter
      if (filters.roles.length > 0 && !filters.roles.includes(record.role)) {
        return false;
      }
      
      // Playlist filter
      if (filters.playlists.length > 0 && !filters.playlists.includes(record.playlist)) {
        return false;
      }
      
      // Track filter
      if (filters.tracks.length > 0 && !filters.tracks.includes(record.track)) {
        return false;
      }
      
      // Certification filter
      if (filters.certifications.length > 0) {
        if (!record.certification || !filters.certifications.includes(record.certification)) {
          return false;
        }
      }
      
      // Status filter
      if (filters.completionStatus.length > 0 && !filters.completionStatus.includes(record.status)) {
        return false;
      }
      
      // Date range filter
      if (filters.dateRange.start && filters.dateRange.end) {
        const recordDate = record.completionDate ? new Date(record.completionDate) : new Date(record.lastActivity);
        if (recordDate < filters.dateRange.start || recordDate > filters.dateRange.end) {
          return false;
        }
      }
      
      return true;
    });

    // Sort data
    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' 
          ? aValue - bValue
          : bValue - aValue;
      }
      
      return 0;
    });

    return filtered;
  }, [searchTerm, filters, sortField, sortDirection, storeFilter, learnerData]);

  const handleSort = (field: keyof LearnerRecord) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleFilterChange = (filterType: keyof FilterState, value: any) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const removeFilter = (filterKey: string, filterValue: string) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      
      if (filterKey === 'progress') {
        newFilters.progress = { min: 0, max: 100 };
      } else if (filterKey === 'dateRange') {
        newFilters.dateRange = { start: null, end: null };
      } else {
        const currentArray = newFilters[filterKey as keyof FilterState] as string[];
        newFilters[filterKey as keyof FilterState] = currentArray.filter(item => item !== filterValue) as any;
      }
      
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    setFilters({
      progress: { min: 0, max: 100 },
      albums: [],
      location: [],
      districts: [],
      roles: [],
      playlists: [],
      tracks: [],
      dateRange: { start: null, end: null },
      employees: [],
      certifications: [],
      completionStatus: []
    });
    setSearchTerm('');
  };

  const filteredProperties = filterProperties.filter(property =>
    property.label.toLowerCase().includes(filterSearch.toLowerCase()) ||
    property.description.toLowerCase().includes(filterSearch.toLowerCase())
  );

  const handleFilterPropertySelect = (propertyId: string) => {
    setShowFilterPicker(false);
    setFilterSearch('');
    setActiveFilterProperty(propertyId);
    setShowFilterDialog(true);
  };

  const handleFilterOptionSelect = (filterType: keyof FilterState, option: string) => {
    if (filterType === 'progress' || filterType === 'dateRange') return;
    
    setFilters(prev => {
      const currentArray = prev[filterType] as string[];
      const isSelected = currentArray.includes(option);
      
      return {
        ...prev,
        [filterType]: isSelected 
          ? currentArray.filter(item => item !== option)
          : [...currentArray, option]
      };
    });
  };

  const getCurrentFilterProperty = () => {
    return filterProperties.find(prop => prop.id === activeFilterProperty);
  };

  const handleExport = (format: 'csv' | 'xlsx' | 'pdf') => {
    const recordCount = filteredData.length;
    toast.success(`Exporting ${recordCount} records as ${format.toUpperCase()}...`, {
      description: 'Your report will be ready for download shortly.',
      duration: 3000
    });
  };

  const handleSelectAll = () => {
    if (selectedRecords.length === filteredData.length) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(filteredData.map(record => record.id));
    }
  };

  const handleSelectRecord = (recordId: string) => {
    setSelectedRecords(prev => 
      prev.includes(recordId) 
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId]
    );
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'completed': 'bg-green-100 text-green-800',
      'in-progress': 'bg-blue-100 text-blue-800',
      'not-started': 'bg-gray-100 text-gray-800',
      'overdue': 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800'}>
        {status.replace('-', ' ')}
      </Badge>
    );
  };

  const toggleRowExpansion = (recordId: string) => {
    setExpandedRows(prev => 
      prev.includes(recordId) 
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId]
    );
  };

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground">Reports</h1>
          <p className="text-muted-foreground mt-1">
            Learner activity & progress
          </p>
        </div>
        
        {/* Export Actions */}
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('xlsx')}>
            <Download className="h-4 w-4 mr-1" />
            Excel
          </Button>
          <Button size="sm" className="hero-primary shadow-brand" onClick={() => handleExport('pdf')}>
            <FileText className="h-4 w-4 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees, content, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 border-0 bg-accent/50 focus:bg-background transition-colors"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Add Filter Button */}
            <Popover open={showFilterPicker} onOpenChange={setShowFilterPicker}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-8 border-dashed border-primary/50 text-primary hover:bg-primary/5 hover:border-primary"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Filter
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="p-3 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Filter by..."
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      className="pl-10 h-8 border-0 bg-accent/30 text-sm"
                    />
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {filteredProperties.map((property) => {
                    const Icon = property.icon;
                    return (
                      <button
                        key={property.id}
                        onClick={() => handleFilterPropertySelect(property.id)}
                        className="w-full flex items-center space-x-2 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left"
                      >
                        <div className="p-1.5 bg-primary/10 rounded-lg">
                          <Icon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">{property.label}</div>
                          <div className="text-xs text-muted-foreground truncate">{property.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            {/* Results Count */}
            <span className="text-sm text-muted-foreground">
              {filteredData.length} {filteredData.length === 1 ? 'record' : 'records'}
            </span>
          </div>

          {/* Clear All Button */}
          {activeFilters.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-muted-foreground hover:text-foreground h-8">
              <RefreshCw className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeFilters.map((filter, index) => (
              <Badge 
                key={index} 
                variant="secondary" 
                className="flex items-center gap-1.5 pl-2 pr-1.5 py-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors text-xs"
              >
                <span className="opacity-70">{filter.label}:</span>
                <span>{filter.value}</span>
                <button
                  onClick={() => removeFilter(filter.key, filter.value)}
                  className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold">Activity Report</h3>
            {selectedRecords.length > 0 && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {selectedRecords.length} selected
              </Badge>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Info className="h-4 w-4 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Click rows to expand details</p>
            </TooltipContent>
          </Tooltip>
        </div>
        
        <div className="overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="border-b border-border bg-accent/30">
                <TableHead className="w-8 pl-4"></TableHead>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedRecords.length === filteredData.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleSort('employeeName')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Employee</span>
                    {sortField === 'employeeName' && (
                      sortDirection === 'asc' ? 
                      <ChevronUp className="h-3 w-3 text-primary" /> : 
                      <ChevronDown className="h-3 w-3 text-primary" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleSort('district')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Location</span>
                    {sortField === 'district' && (
                      sortDirection === 'asc' ? 
                      <ChevronUp className="h-3 w-3 text-primary" /> : 
                      <ChevronDown className="h-3 w-3 text-primary" />
                    )}
                  </div>
                </TableHead>
                <TableHead><span>Content</span></TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleSort('progress')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Progress</span>
                    {sortField === 'progress' && (
                      sortDirection === 'asc' ? 
                      <ChevronUp className="h-3 w-3 text-primary" /> : 
                      <ChevronDown className="h-3 w-3 text-primary" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleSort('score')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Score</span>
                    {sortField === 'score' && (
                      sortDirection === 'asc' ? 
                      <ChevronUp className="h-3 w-3 text-primary" /> : 
                      <ChevronDown className="h-3 w-3 text-primary" />
                    )}
                  </div>
                </TableHead>
                <TableHead><span>Status</span></TableHead>
                <TableHead className="pr-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
                      <p className="text-sm text-muted-foreground">Loading learner records...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FileText className="h-8 w-8 text-muted-foreground opacity-50" />
                      <p className="text-sm font-medium text-foreground">No records found</p>
                      <p className="text-xs text-muted-foreground">Try adjusting your filters or search terms</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((record, index) => {
                const isExpanded = expandedRows.includes(record.id);
                return (
                  <React.Fragment key={record.id}>
                    <TableRow 
                      className={`border-b border-border hover:bg-accent/20 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-background' : 'bg-accent/10'}`}
                      onClick={() => toggleRowExpansion(record.id)}
                    >
                      <TableCell className="pl-4">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedRecords.includes(record.id)}
                          onCheckedChange={() => handleSelectRecord(record.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{record.employeeName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{record.store}</div>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-sm truncate max-w-[200px]">{record.album}</div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1 text-xs">
                              <div><span className="text-muted-foreground">Album:</span> {record.album}</div>
                              <div><span className="text-muted-foreground">Playlist:</span> {record.playlist}</div>
                              <div><span className="text-muted-foreground">Track:</span> {record.track}</div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Progress value={record.progress} className="h-1.5 w-16" />
                          <span className="text-sm font-medium min-w-[35px]">{record.progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{record.score}</span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(record.status)}
                      </TableCell>
                      <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-accent">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">View details</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded Row Details */}
                    {isExpanded && (
                      <TableRow className={`border-b border-border ${index % 2 === 0 ? 'bg-background' : 'bg-accent/10'}`}>
                        <TableCell colSpan={9} className="px-4 py-4">
                          <div className="grid grid-cols-4 gap-6 pl-8">
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Employee ID</div>
                              <div className="text-sm font-medium">{record.employeeId}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">District</div>
                              <div className="text-sm font-medium">{record.district}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Role</div>
                              <div className="text-sm font-medium">{record.role}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Department</div>
                              <div className="text-sm font-medium">{record.department}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Playlist</div>
                              <div className="text-sm font-medium">{record.playlist}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Track</div>
                              <div className="text-sm font-medium">{record.track}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Time Spent</div>
                              <div className="text-sm font-medium">{record.timeSpent} min</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Attempts</div>
                              <div className="text-sm font-medium">{record.attempts}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Completion Date</div>
                              <div className="text-sm font-medium">{record.completionDate || '—'}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Last Activity</div>
                              <div className="text-sm font-medium">{record.lastActivity}</div>
                            </div>
                            <div className="col-span-2">
                              <div className="text-xs text-muted-foreground mb-1">Certification</div>
                              <div className="text-sm font-medium">{record.certification || '—'}</div>
                              {record.certificationDate && (
                                <div className="text-xs text-muted-foreground mt-0.5">{record.certificationDate}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              }))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Filter Dialog */}
      <FilterDialog
        isOpen={showFilterDialog}
        onClose={() => setShowFilterDialog(false)}
        property={getCurrentFilterProperty()}
        filters={filters}
        onFilterChange={handleFilterChange}
        onOptionSelect={handleFilterOptionSelect}
      />

      <Footer />
    </div>
    </TooltipProvider>
  );
}