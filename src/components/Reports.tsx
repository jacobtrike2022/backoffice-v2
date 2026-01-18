import React, { useState, useMemo, useEffect } from 'react';
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
  FileSpreadsheet,
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
  Info,
  Archive
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  getLearnerRecords,
  getReportFilterOptions,
  flattenToAssignmentRows,
  aggregateToUnitRows,
  type LearnerRecord as LearnerRecordType,
  type FilterOptions,
  type AssignmentRecord,
  type ReportType,
  type FlattenedAssignmentRow,
  type UnitReportRow
} from '../lib/crud/reports';
import { exportToCSV, exportToExcel, exportToPDF } from '../lib/utils/export';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

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
  playlistStatus: string[]; // 'active' | 'archived'
}

export function Reports({ currentRole, onBackToDashboard, storeFilter }: ReportsProps) {
  // Report type controls the "grain" of the data
  const [reportType, setReportType] = useState<ReportType>('people');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('employeeName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [showFilterPicker, setShowFilterPicker] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [activeFilterProperty, setActiveFilterProperty] = useState<string | null>(null);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [learnerData, setLearnerData] = useState<LearnerRecordType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  
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
    completionStatus: [],
    playlistStatus: ['active'] // Default to showing only active playlists
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

    // Only show playlistStatus filter chip if not default (which is ['active'])
    if (filters.playlistStatus.length !== 1 || filters.playlistStatus[0] !== 'active') {
      filters.playlistStatus.forEach(status => {
        active.push({ key: 'playlistStatus', label: 'Playlist Status', value: status });
      });
    }

    if (filters.dateRange.start && filters.dateRange.end) {
      active.push({
        key: 'dateRange',
        label: 'Date Range',
        value: `${format(filters.dateRange.start, 'MMM dd')} - ${format(filters.dateRange.end, 'MMM dd')}`
      });
    }
    
    return active;
  }, [filters]);

  // Dynamic filter properties with options from database
  const filterProperties = useMemo(() => [
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
      options: filterOptions?.albums.map(a => a.name) || []
    },
    {
      id: 'location',
      label: 'Location',
      icon: MapPin,
      type: 'multi-select',
      description: 'Filter by districts and stores',
      options: [
        ...(filterOptions?.districts.map(d => d.name) || []),
        ...(filterOptions?.stores.map(s => s.name) || [])
      ]
    },
    {
      id: 'districts',
      label: 'Districts',
      icon: Building,
      type: 'multi-select',
      description: 'Filter by geographic districts',
      options: filterOptions?.districts.map(d => d.name) || []
    },
    {
      id: 'roles',
      label: 'Roles',
      icon: Users,
      type: 'multi-select',
      description: 'Filter by job roles',
      options: filterOptions?.roles.map(r => r.name) || []
    },
    {
      id: 'playlists',
      label: 'Playlists',
      icon: Play,
      type: 'multi-select',
      description: 'Select specific playlists',
      options: filterOptions?.playlists.map(p => p.name) || []
    },
    {
      id: 'tracks',
      label: 'Tracks',
      icon: Play,
      type: 'multi-select',
      description: 'Filter by individual tracks',
      options: filterOptions?.tracks.map(t => t.name) || []
    },
    {
      id: 'certifications',
      label: 'Certifications',
      icon: Award,
      type: 'multi-select',
      description: 'Filter by earned certifications',
      options: filterOptions?.certifications.map(c => c.name) || []
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
      id: 'playlistStatus',
      label: 'Playlist Status',
      icon: Archive,
      type: 'multi-select',
      description: 'Filter by playlist active/archived status',
      options: ['active', 'archived']
    },
    {
      id: 'dateRange',
      label: 'Date Range',
      icon: CalendarIcon,
      type: 'date-range',
      description: 'Filter by date range'
    }
  ], [filterOptions]);

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

  // Fetch filter options on mount
  useEffect(() => {
    async function fetchFilterOptions() {
      try {
        const options = await getReportFilterOptions();
        setFilterOptions(options);
      } catch (error) {
        console.error('Error fetching filter options:', error);
      }
    }
    fetchFilterOptions();
  }, []);

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

      // Playlist status filter (active/archived)
      // Filter by whether any assignment has a matching playlist status
      if (filters.playlistStatus.length > 0 && record.assignments) {
        const hasMatchingPlaylistStatus = record.assignments.some(
          (a: AssignmentRecord) => filters.playlistStatus.includes(a.playlistStatus)
        );
        if (!hasMatchingPlaylistStatus) {
          return false;
        }
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

  const handleSort = (field: keyof LearnerRecordType) => {
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

  // Handle report type change - reset selection and expansion state
  const handleReportTypeChange = (newType: ReportType) => {
    setReportType(newType);
    setSelectedRecords([]); // Clear selection when changing modes
    setExpandedRows([]); // Clear expansion state
    // Reset sort to appropriate default for the mode
    if (newType === 'people') {
      setSortField('employeeName');
    } else if (newType === 'assignments') {
      setSortField('employeeName');
    } else {
      setSortField('unitName');
    }
    setSortDirection('asc');
  };

  // Transform data based on report type
  const assignmentRows = useMemo(() => {
    if (reportType !== 'assignments') return [];
    return flattenToAssignmentRows(learnerData);
  }, [reportType, learnerData]);

  const unitRows = useMemo(() => {
    if (reportType !== 'units') return [];
    return aggregateToUnitRows(learnerData);
  }, [reportType, learnerData]);

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
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${reportType}-report-${timestamp}`;

    // Get the correct data based on current report type
    let exportData: any[];
    let recordCount: number;
    switch (reportType) {
      case 'people':
        exportData = filteredData;
        recordCount = filteredData.length;
        break;
      case 'assignments':
        exportData = assignmentRows;
        recordCount = assignmentRows.length;
        break;
      case 'units':
        exportData = unitRows;
        recordCount = unitRows.length;
        break;
    }

    try {
      switch (format) {
        case 'csv':
          exportToCSV(exportData, filename, reportType);
          break;
        case 'xlsx':
          exportToExcel(exportData, filename, reportType);
          break;
        case 'pdf':
          exportToPDF(exportData, filename, reportType);
          break;
      }
      toast.success(`Exported ${recordCount} ${reportType} records as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Failed to export as ${format.toUpperCase()}`);
    }
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

        {/* Report Type Toggle + Export Actions */}
        <div className="flex items-center gap-6">
          {/* Report Type Pill Toggle */}
          <ToggleGroup
            type="single"
            value={reportType}
            onValueChange={(value) => value && handleReportTypeChange(value as ReportType)}
            className="bg-accent/50 p-1 rounded-lg"
          >
            <ToggleGroupItem
              value="people"
              aria-label="People view"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-3 py-1.5 rounded-md text-sm gap-1.5"
            >
              <Users className="h-4 w-4" />
              People
            </ToggleGroupItem>
            <ToggleGroupItem
              value="assignments"
              aria-label="Assignments view"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-3 py-1.5 rounded-md text-sm gap-1.5"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Assignments
            </ToggleGroupItem>
            <ToggleGroupItem
              value="units"
              aria-label="Units view"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-3 py-1.5 rounded-md text-sm gap-1.5"
            >
              <Building className="h-4 w-4" />
              Units
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Export Actions */}
          <div className="flex items-center space-x-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground flex items-center mr-2">
                  <Info className="h-3 w-3 mr-1" />
                  Exports match view
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Your export will contain {reportType === 'people' ? 'one row per learner' :
                    reportType === 'assignments' ? 'one row per assignment' :
                    'one row per unit'}.
                </p>
              </TooltipContent>
            </Tooltip>
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
              {reportType === 'people' && `${filteredData.length} ${filteredData.length === 1 ? 'person' : 'people'}`}
              {reportType === 'assignments' && `${assignmentRows.length} ${assignmentRows.length === 1 ? 'assignment' : 'assignments'}`}
              {reportType === 'units' && `${unitRows.length} ${unitRows.length === 1 ? 'unit' : 'units'}`}
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
            <h3 className="font-semibold">
              {reportType === 'people' ? 'Learner Report' :
               reportType === 'assignments' ? 'Assignment Report' :
               'Unit Report'}
            </h3>
            {selectedRecords.length > 0 && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {selectedRecords.length} selected
              </Badge>
            )}
          </div>
          {reportType === 'people' && (
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
          )}
        </div>
        
        <div className="overflow-x-auto">
          {/* People Mode Table */}
          {reportType === 'people' && (
            <Table className="w-full">
              <TableHeader>
                <TableRow className="border-b border-border bg-accent/30">
                  <TableHead className="w-8 pl-4"></TableHead>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedRecords.length === filteredData.length && filteredData.length > 0}
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
                    onClick={() => handleSort('role')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Role</span>
                      {sortField === 'role' && (
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
                      <span>District</span>
                      {sortField === 'district' && (
                        sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3 text-primary" /> :
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => handleSort('store')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Location</span>
                      {sortField === 'store' && (
                        sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3 text-primary" /> :
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead><span>Assignments</span></TableHead>
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
                  <TableHead><span>Status</span></TableHead>
                  <TableHead className="pr-4"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
                        <p className="text-sm text-muted-foreground">Loading learner records...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
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
                          <div className="text-sm">{record.role}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{record.district}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{record.store}</div>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-sm">
                                <span className="font-medium">{record.assignments?.length || 0}</span>
                                <span className="text-muted-foreground ml-1">
                                  {(record.assignments?.length || 0) === 1 ? 'assignment' : 'assignments'}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1 text-xs max-w-[250px]">
                                {(record.assignments || []).slice(0, 5).map((a: AssignmentRecord) => (
                                  <div key={a.id} className="flex justify-between gap-2">
                                    <span className="truncate">{a.playlist}</span>
                                    <span className="text-muted-foreground">{a.progress}%</span>
                                  </div>
                                ))}
                                {(record.assignments?.length || 0) > 5 && (
                                  <div className="text-muted-foreground">+{(record.assignments?.length || 0) - 5} more...</div>
                                )}
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

                      {/* Expanded Row - Full-width detail panel */}
                      {isExpanded && (
                        <TableRow className="bg-accent/20">
                          <TableCell colSpan={10} className="p-0">
                            <div className="p-4 space-y-3">
                              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assignments</div>
                              <div className="grid gap-2">
                                {(record.assignments || []).length === 0 ? (
                                  <div className="text-sm text-muted-foreground py-2">No assignments found</div>
                                ) : (
                                  (record.assignments || []).map((assignment: AssignmentRecord) => (
                                    <div
                                      key={assignment.id}
                                      className="bg-background border border-border rounded-lg p-3 flex items-center justify-between gap-4"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm">{assignment.playlist}</div>
                                        <div className="text-xs text-muted-foreground truncate">{assignment.track}</div>
                                      </div>
                                      <div className="flex items-center gap-4 text-sm">
                                        <div className="text-muted-foreground">
                                          <span className="text-xs">Assigned: </span>
                                          {assignment.dateAssigned
                                            ? new Date(assignment.dateAssigned).toLocaleDateString()
                                            : '—'}
                                        </div>
                                        <div className={assignment.dueDate && new Date(assignment.dueDate) < new Date() && !assignment.completionDate ? 'text-red-500' : 'text-muted-foreground'}>
                                          <span className="text-xs">Due: </span>
                                          {assignment.dueDate
                                            ? new Date(assignment.dueDate).toLocaleDateString()
                                            : '—'}
                                        </div>
                                        <div className="flex items-center gap-2 min-w-[100px]">
                                          <Progress value={assignment.progress} className="h-1.5 w-12" />
                                          <span className="text-xs">{assignment.progress}%</span>
                                        </div>
                                        {getStatusBadge(assignment.status)}
                                      </div>
                                    </div>
                                  ))
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
          )}

          {/* Assignments Mode Table */}
          {reportType === 'assignments' && (
            <Table className="w-full">
              <TableHeader>
                <TableRow className="border-b border-border bg-accent/30">
                  <TableHead className="w-10 pl-4">
                    <Checkbox
                      checked={selectedRecords.length === assignmentRows.length && assignmentRows.length > 0}
                      onCheckedChange={() => {
                        if (selectedRecords.length === assignmentRows.length) {
                          setSelectedRecords([]);
                        } else {
                          setSelectedRecords(assignmentRows.map(r => r.id));
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      if (sortField === 'employeeName') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('employeeName');
                        setSortDirection('asc');
                      }
                    }}
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
                    onClick={() => {
                      if (sortField === 'playlist') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('playlist');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Playlist</span>
                      {sortField === 'playlist' && (
                        sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3 text-primary" /> :
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead><span>Track</span></TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      if (sortField === 'store') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('store');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Location</span>
                      {sortField === 'store' && (
                        sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3 text-primary" /> :
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead><span>Assigned</span></TableHead>
                  <TableHead><span>Due</span></TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      if (sortField === 'progress') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('progress');
                        setSortDirection('asc');
                      }
                    }}
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
                  <TableHead><span>Status</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
                        <p className="text-sm text-muted-foreground">Loading assignments...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : assignmentRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <FileSpreadsheet className="h-8 w-8 text-muted-foreground opacity-50" />
                        <p className="text-sm font-medium text-foreground">No assignments found</p>
                        <p className="text-xs text-muted-foreground">Try adjusting your filters or search terms</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  assignmentRows.map((row, index) => (
                    <TableRow
                      key={row.id}
                      className={`border-b border-border hover:bg-accent/20 transition-colors ${index % 2 === 0 ? 'bg-background' : 'bg-accent/10'}`}
                    >
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={selectedRecords.includes(row.id)}
                          onCheckedChange={() => handleSelectRecord(row.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{row.employeeName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{row.playlist}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground truncate max-w-[150px]">{row.track}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{row.store}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {row.dateAssigned ? new Date(row.dateAssigned).toLocaleDateString() : '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`text-sm ${row.dueDate && new Date(row.dueDate) < new Date() && !row.completionDate ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                          {row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Progress value={row.progress} className="h-1.5 w-16" />
                          <span className="text-sm font-medium min-w-[35px]">{row.progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(row.status)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* Units Mode Table */}
          {reportType === 'units' && (
            <Table className="w-full">
              <TableHeader>
                <TableRow className="border-b border-border bg-accent/30">
                  <TableHead className="w-10 pl-4">
                    <Checkbox
                      checked={selectedRecords.length === unitRows.length && unitRows.length > 0}
                      onCheckedChange={() => {
                        if (selectedRecords.length === unitRows.length) {
                          setSelectedRecords([]);
                        } else {
                          setSelectedRecords(unitRows.map(r => r.id));
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      if (sortField === 'unitName') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('unitName');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Unit</span>
                      {sortField === 'unitName' && (
                        sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3 text-primary" /> :
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      if (sortField === 'district') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('district');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>District</span>
                      {sortField === 'district' && (
                        sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3 text-primary" /> :
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      if (sortField === 'employeeCount') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('employeeCount');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Employees</span>
                      {sortField === 'employeeCount' && (
                        sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3 text-primary" /> :
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead><span>Assignments</span></TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      if (sortField === 'avgProgress') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('avgProgress');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Avg Progress</span>
                      {sortField === 'avgProgress' && (
                        sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3 text-primary" /> :
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead><span>Completed</span></TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      if (sortField === 'overdueCount') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('overdueCount');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Overdue</span>
                      {sortField === 'overdueCount' && (
                        sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3 text-primary" /> :
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
                        <p className="text-sm text-muted-foreground">Loading unit data...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : unitRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Building className="h-8 w-8 text-muted-foreground opacity-50" />
                        <p className="text-sm font-medium text-foreground">No units found</p>
                        <p className="text-xs text-muted-foreground">Try adjusting your filters or search terms</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  unitRows.map((row, index) => (
                    <TableRow
                      key={row.id}
                      className={`border-b border-border hover:bg-accent/20 transition-colors ${index % 2 === 0 ? 'bg-background' : 'bg-accent/10'}`}
                    >
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={selectedRecords.includes(row.id)}
                          onCheckedChange={() => handleSelectRecord(row.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{row.unitName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{row.district}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{row.employeeCount}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{row.assignmentCount}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Progress value={row.avgProgress} className="h-1.5 w-16" />
                          <span className="text-sm font-medium min-w-[35px]">{row.avgProgress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-green-600 font-medium">{row.completedCount}</div>
                      </TableCell>
                      <TableCell>
                        <div className={`text-sm font-medium ${row.overdueCount > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {row.overdueCount}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
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