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
import { getLearnerRecords, getReportFilterOptions, type LearnerRecord as LearnerRecordType, type FilterOptions } from '../lib/crud/reports';
import { exportToCSV, exportToExcel, exportToPDF } from '../lib/utils/export';

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

export function Reports({ currentRole, onBackToDashboard, storeFilter }: ReportsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof LearnerRecordType>('employeeName');
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
    const filename = `learner-report-${timestamp}`;

    try {
      switch (format) {
        case 'csv':
          exportToCSV(filteredData, filename);
          break;
        case 'xlsx':
          exportToExcel(filteredData, filename);
          break;
        case 'pdf':
          exportToPDF(filteredData, filename);
          break;
      }
      toast.success(`Exported ${filteredData.length} records as ${format.toUpperCase()}`);
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