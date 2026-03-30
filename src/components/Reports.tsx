import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  Archive,
  AlertTriangle,
  AlertCircle,
  TrendingDown,
  Zap
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
  type UnitReportRow,
  type RiskLevel
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

function formatTopIssueDetail(row: { topIssue: string; stalledCount: number; overdueCount: number; notStartedCount: number; compliance: number; topIssueDetail: string }, t: (key: string, opts?: Record<string, unknown>) => string): string {
  switch (row.topIssue) {
    case 'high-performer': return t('reports.issueHighPerformer', { compliance: row.compliance });
    case 'stalled-learners': return t('reports.issueStalledLearners', { count: row.stalledCount });
    case 'overdue-spike': return t('reports.issueOverdueSpike', { count: row.overdueCount });
    case 'low-completion': return t('reports.issueLowCompletion', { compliance: row.compliance });
    case 'no-activity': return t('reports.issueNoActivity', { count: row.notStartedCount });
    default: return row.topIssueDetail;
  }
}

export function Reports({ currentRole, onBackToDashboard, storeFilter }: ReportsProps) {
  const { t } = useTranslation();
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
        label: t('reports.filterProgress'),
        value: `${filters.progress.min}% - ${filters.progress.max}%`
      });
    }

    filters.albums.forEach(album => {
      active.push({ key: 'albums', label: t('reports.filterAlbums'), value: album });
    });

    filters.location.forEach(location => {
      active.push({ key: 'location', label: t('reports.filterLocation'), value: location });
    });

    filters.districts.forEach(district => {
      active.push({ key: 'districts', label: t('reports.filterDistricts'), value: district });
    });

    filters.roles.forEach(role => {
      active.push({ key: 'roles', label: t('reports.filterRoles'), value: role });
    });

    filters.playlists.forEach(playlist => {
      active.push({ key: 'playlists', label: t('reports.filterPlaylists'), value: playlist });
    });

    filters.tracks.forEach(track => {
      active.push({ key: 'tracks', label: t('reports.filterTracks'), value: track });
    });

    filters.certifications.forEach(cert => {
      active.push({ key: 'certifications', label: t('reports.filterCertifications'), value: cert });
    });

    filters.completionStatus.forEach(status => {
      active.push({ key: 'completionStatus', label: t('reports.filterStatus'), value: status });
    });

    // Only show playlistStatus filter chip if not default (which is ['active'])
    if (filters.playlistStatus.length !== 1 || filters.playlistStatus[0] !== 'active') {
      filters.playlistStatus.forEach(status => {
        active.push({ key: 'playlistStatus', label: t('reports.filterPlaylistStatus'), value: status });
      });
    }

    if (filters.dateRange.start && filters.dateRange.end) {
      active.push({
        key: 'dateRange',
        label: t('reports.filterDateRange'),
        value: `${format(filters.dateRange.start, 'MMM dd')} - ${format(filters.dateRange.end, 'MMM dd')}`
      });
    }

    return active;
  }, [filters, t]);

  // Dynamic filter properties with options from database
  const filterProperties = useMemo(() => [
    {
      id: 'progress',
      label: t('reports.filterProgress'),
      icon: Clock,
      type: 'range',
      description: t('reports.filterProgressDesc')
    },
    {
      id: 'albums',
      label: t('reports.filterAlbums'),
      icon: BookOpen,
      type: 'multi-select',
      description: t('reports.filterAlbumsDesc'),
      options: filterOptions?.albums.map(a => a.name) || []
    },
    {
      id: 'location',
      label: t('reports.filterLocation'),
      icon: MapPin,
      type: 'multi-select',
      description: t('reports.filterLocationDesc'),
      options: [
        ...(filterOptions?.districts.map(d => d.name) || []),
        ...(filterOptions?.stores.map(s => s.name) || [])
      ]
    },
    {
      id: 'districts',
      label: t('reports.filterDistricts'),
      icon: Building,
      type: 'multi-select',
      description: t('reports.filterDistrictsDesc'),
      options: filterOptions?.districts.map(d => d.name) || []
    },
    {
      id: 'roles',
      label: t('reports.filterRoles'),
      icon: Users,
      type: 'multi-select',
      description: t('reports.filterRolesDesc'),
      options: filterOptions?.roles.map(r => r.name) || []
    },
    {
      id: 'playlists',
      label: t('reports.filterPlaylists'),
      icon: Play,
      type: 'multi-select',
      description: t('reports.filterPlaylistsDesc'),
      options: filterOptions?.playlists.map(p => p.name) || []
    },
    {
      id: 'tracks',
      label: t('reports.filterTracks'),
      icon: Play,
      type: 'multi-select',
      description: t('reports.filterTracksDesc'),
      options: filterOptions?.tracks.map(track => track.name) || []
    },
    {
      id: 'certifications',
      label: t('reports.filterCertifications'),
      icon: Award,
      type: 'multi-select',
      description: t('reports.filterCertificationsDesc'),
      options: filterOptions?.certifications.map(c => c.name) || []
    },
    {
      id: 'completionStatus',
      label: t('reports.filterStatus'),
      icon: CheckCircle,
      type: 'multi-select',
      description: t('reports.filterStatusDesc'),
      options: ['completed', 'in-progress', 'not-started', 'overdue']
    },
    {
      id: 'playlistStatus',
      label: t('reports.filterPlaylistStatus'),
      icon: Archive,
      type: 'multi-select',
      description: t('reports.filterPlaylistStatusDesc'),
      options: ['active', 'archived']
    },
    {
      id: 'dateRange',
      label: t('reports.filterDateRange'),
      icon: CalendarIcon,
      type: 'date-range',
      description: t('reports.filterDateRangeDesc')
    }
  ], [filterOptions, t]);

  // Fetch learner records on mount and when storeFilter changes
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const data = await getLearnerRecords(storeFilter);
        setLearnerData(data);
      } catch (error) {
        console.error('Error fetching learner records:', error);
        toast.error(t('reports.failedToLoad'));
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
      // Only apply when user has assignments; users with no assignments (e.g. demo seed people) pass through
      if (filters.playlistStatus.length > 0 && record.assignments && record.assignments.length > 0) {
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
      setSortDirection('asc');
    } else if (newType === 'assignments') {
      setSortField('playlist'); // Sort by playlist - assignment is the anchor
      setSortDirection('asc');
    } else {
      setSortField('riskScore'); // Sort by risk - highest risk first
      setSortDirection('desc');
    }
  };

  // Transform data based on report type - use filteredData as source so filters apply
  const assignmentRows = useMemo(() => {
    if (reportType !== 'assignments') return [];
    const rows = flattenToAssignmentRows(filteredData);

    // Apply sorting
    rows.sort((a, b) => {
      const aValue = a[sortField as keyof FlattenedAssignmentRow];
      const bValue = b[sortField as keyof FlattenedAssignmentRow];

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

    return rows;
  }, [reportType, filteredData, sortField, sortDirection]);

  const unitRows = useMemo(() => {
    if (reportType !== 'units') return [];
    const rows = aggregateToUnitRows(filteredData);

    // Apply sorting (override the default risk-based sort if user clicked a column)
    rows.sort((a, b) => {
      const aValue = a[sortField as keyof UnitReportRow];
      const bValue = b[sortField as keyof UnitReportRow];

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

    return rows;
  }, [reportType, filteredData, sortField, sortDirection]);

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
      toast.success(t('reports.exportSuccess', { count: recordCount, type: reportType, format: format.toUpperCase() }));
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('reports.exportFailed', { format: format.toUpperCase() }));
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

    const labels: Record<string, string> = {
      'completed': t('reports.statusCompleted'),
      'in-progress': t('reports.statusInProgress'),
      'not-started': t('reports.statusNotStarted'),
      'overdue': t('reports.statusOverdue'),
    };

    return (
      <Badge className={variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800'}>
        {labels[status] ?? status.replace('-', ' ')}
      </Badge>
    );
  };

  const getRiskBadge = (riskLevel: RiskLevel) => {
    const config = {
      'low': { className: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle, label: t('reports.riskLow') },
      'medium': { className: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertCircle, label: t('reports.riskMedium') },
      'high': { className: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertTriangle, label: t('reports.riskHigh') },
      'critical': { className: 'bg-red-100 text-red-800 border-red-200', icon: Zap, label: t('reports.riskCritical') }
    };

    const { className, icon: Icon, label } = config[riskLevel];

    return (
      <Badge className={`${className} border flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {label}
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
          <h1 className="text-foreground">{t('reports.headerTitle')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('reports.headerSubtitle')}
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

      {/* Report Type Pill Toggle - Centered */}
      <div className="flex justify-center">
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
            {t('reports.people')}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="assignments"
            aria-label="Assignments view"
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-3 py-1.5 rounded-md text-sm gap-1.5"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {t('reports.assignments')}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="units"
            aria-label="Units view"
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-3 py-1.5 rounded-md text-sm gap-1.5"
          >
            <Building className="h-4 w-4" />
            {t('reports.units')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('reports.searchPlaceholder')}
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
                  {t('common.filter')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="p-3 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('reports.filterBy')}
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
              {reportType === 'people' && `${filteredData.length} ${filteredData.length === 1 ? t('reports.person') : t('reports.personPlural')}`}
              {reportType === 'assignments' && `${assignmentRows.length} ${assignmentRows.length === 1 ? t('reports.assignment') : t('reports.assignmentPlural')}`}
              {reportType === 'units' && `${unitRows.length} ${unitRows.length === 1 ? t('reports.unit') : t('reports.unitPlural')}`}
            </span>
          </div>

          {/* Clear All Button */}
          {activeFilters.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-muted-foreground hover:text-foreground h-8">
              <RefreshCw className="h-3 w-3 mr-1" />
              {t('reports.clear')}
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
              {reportType === 'people' ? t('reports.learnerReport') :
               reportType === 'assignments' ? t('reports.assignmentReport') :
               t('reports.unitReport')}
            </h3>
            {selectedRecords.length > 0 && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {t('reports.selected', { count: selectedRecords.length })}
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
                <p className="text-xs">{t('reports.clickToExpand')}</p>
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
                      <span>{t('reports.employee')}</span>
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
                      <span>{t('reports.role')}</span>
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
                      <span>{t('reports.district')}</span>
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
                      <span>{t('reports.location')}</span>
                      {sortField === 'store' && (
                        sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3 text-primary" /> :
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead><span>{t('reports.assignmentsCol')}</span></TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => handleSort('progress')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{t('reports.progress')}</span>
                      {sortField === 'progress' && (
                        sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3 text-primary" /> :
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead><span>{t('reports.status')}</span></TableHead>
                  <TableHead className="pr-4"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
                        <p className="text-sm text-muted-foreground">{t('reports.loadingLearners')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <FileText className="h-8 w-8 text-muted-foreground opacity-50" />
                        <p className="text-sm font-medium text-foreground">{t('reports.noRecordsFound')}</p>
                        <p className="text-xs text-muted-foreground">{t('reports.tryAdjusting')}</p>
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
                                  {(record.assignments?.length || 0) === 1 ? t('reports.assignment') : t('reports.assignmentPlural')}
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
                                  <div className="text-muted-foreground">{t('reports.more', { count: (record.assignments?.length || 0) - 5 })}</div>
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
                              <p className="text-xs">{t('reports.viewDetails')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Row - Uses table cells to align with parent columns */}
                      {isExpanded && (record.assignments || []).map((assignment: AssignmentRecord, idx: number) => (
                        <TableRow
                          key={assignment.id}
                          className={`bg-accent/20 ${idx !== (record.assignments?.length || 0) - 1 ? '' : ''}`}
                        >
                          {/* Expand column - empty */}
                          <TableCell className="pl-4 py-2"></TableCell>
                          {/* Checkbox column - empty */}
                          <TableCell className="py-2"></TableCell>
                          {/* Playlist - in Employee column */}
                          <TableCell className="py-2">
                            <div className="text-sm text-muted-foreground">{assignment.playlist}</div>
                          </TableCell>
                          {/* Role column - empty */}
                          <TableCell className="py-2"></TableCell>
                          {/* District column - empty */}
                          <TableCell className="py-2"></TableCell>
                          {/* Location column - Assigned date */}
                          <TableCell className="py-2">
                            <div>
                              <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">{t('reports.assigned')}</div>
                              <div className="text-sm text-muted-foreground">
                                {assignment.dateAssigned
                                  ? new Date(assignment.dateAssigned).toLocaleDateString()
                                  : '—'}
                              </div>
                            </div>
                          </TableCell>
                          {/* Assignments column - Due date */}
                          <TableCell className="py-2">
                            <div>
                              <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">{t('reports.due')}</div>
                              <div className={`text-sm ${assignment.dueDate && new Date(assignment.dueDate) < new Date() && !assignment.completionDate ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                                {assignment.dueDate
                                  ? new Date(assignment.dueDate).toLocaleDateString()
                                  : '—'}
                              </div>
                            </div>
                          </TableCell>
                          {/* Progress column */}
                          <TableCell className="py-2">
                            <div className="flex items-center space-x-2">
                              <Progress value={assignment.progress} className="h-1.5 w-16" />
                              <span className="text-sm font-medium min-w-[35px]">{assignment.progress}%</span>
                            </div>
                          </TableCell>
                          {/* Status column */}
                          <TableCell className="py-2">
                            {getStatusBadge(assignment.status)}
                          </TableCell>
                          {/* Actions column - empty */}
                          <TableCell className="pr-4 py-2"></TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                }))}
              </TableBody>
            </Table>
          )}

          {/* Assignments Mode Table - Assignment is the anchor, person is context */}
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
                      if (sortField === 'playlist') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('playlist');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{t('reports.playlistTrack')}</span>
                      {sortField === 'playlist' && (
                        sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3 text-primary" /> :
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
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
                      <span>{t('reports.assignedTo')}</span>
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
                      if (sortField === 'store') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('store');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{t('reports.location')}</span>
                      {sortField === 'store' && (
                        sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3 text-primary" /> :
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      if (sortField === 'dueDate') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('dueDate');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{t('reports.due')}</span>
                      {sortField === 'dueDate' && (
                        sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3 text-primary" /> :
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </TableHead>
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
                      <span>{t('reports.progress')}</span>
                      {sortField === 'progress' && (
                        sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3 text-primary" /> :
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      if (sortField === 'status') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('status');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{t('reports.status')}</span>
                      {sortField === 'status' && (
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
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
                        <p className="text-sm text-muted-foreground">{t('reports.loadingAssignments')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : assignmentRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <FileSpreadsheet className="h-8 w-8 text-muted-foreground opacity-50" />
                        <p className="text-sm font-medium text-foreground">{t('reports.noAssignmentsFound')}</p>
                        <p className="text-xs text-muted-foreground">{t('reports.tryAdjusting')}</p>
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
                        <div>
                          <div className="font-medium text-foreground">{row.playlist}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{row.track}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">{row.employeeName}</div>
                          <div className="text-xs text-muted-foreground">{row.role}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{row.store}</div>
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

          {/* Units Mode Table - Operational risk focus with diagnostic signals */}
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
                      if (sortField === 'riskScore') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('riskScore');
                        setSortDirection('desc');
                      }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{t('reports.risk')}</span>
                      {sortField === 'riskScore' && (
                        sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3 text-primary" /> :
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
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
                      <span>{t('reports.units')}</span>
                      {sortField === 'unitName' && (
                        sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3 text-primary" /> :
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead><span>{t('reports.topIssue')}</span></TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      if (sortField === 'compliance') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('compliance');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{t('reports.complianceCol')}</span>
                      {sortField === 'compliance' && (
                        sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3 text-primary" /> :
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      if (sortField === 'overdueCount') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('overdueCount');
                        setSortDirection('desc');
                      }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{t('reports.overdue')}</span>
                      {sortField === 'overdueCount' && (
                        sortDirection === 'asc' ?
                        <ChevronUp className="h-3 w-3 text-primary" /> :
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      if (sortField === 'stalledCount') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('stalledCount');
                        setSortDirection('desc');
                      }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{t('reports.stalled')}</span>
                      {sortField === 'stalledCount' && (
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
                      <span>{t('reports.team')}</span>
                      {sortField === 'employeeCount' && (
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
                        <p className="text-sm text-muted-foreground">{t('reports.loadingUnits')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : unitRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Building className="h-8 w-8 text-muted-foreground opacity-50" />
                        <p className="text-sm font-medium text-foreground">{t('reports.noUnitsFound')}</p>
                        <p className="text-xs text-muted-foreground">{t('reports.tryAdjusting')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  unitRows.map((row, index) => (
                    <TableRow
                      key={row.id}
                      className={`border-b border-border hover:bg-accent/20 transition-colors ${
                        row.riskLevel === 'critical' ? 'bg-red-500/10 dark:bg-red-500/20' :
                        row.riskLevel === 'high' ? 'bg-orange-500/10 dark:bg-orange-500/15' :
                        index % 2 === 0 ? 'bg-background' : 'bg-accent/10'
                      }`}
                    >
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={selectedRecords.includes(row.id)}
                          onCheckedChange={() => handleSelectRecord(row.id)}
                        />
                      </TableCell>
                      <TableCell>
                        {getRiskBadge(row.riskLevel)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-foreground">{row.unitName}</div>
                          <div className="text-xs text-muted-foreground">{row.district}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.topIssueDetail ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`text-sm ${
                                row.topIssue === 'high-performer' ? 'text-green-600 dark:text-green-400' :
                                row.topIssue === 'overdue-spike' || row.topIssue === 'low-completion' ? 'text-red-600 dark:text-red-400' :
                                row.topIssue === 'stalled-learners' ? 'text-orange-600 dark:text-orange-400' :
                                'text-muted-foreground'
                              }`}>
                                {formatTopIssueDetail(row, t)}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs space-y-1">
                                <div>{t('reports.tooltipCompleted')}: {row.completedCount} / {row.assignmentCount}</div>
                                <div>{t('reports.tooltipInProgress')}: {row.inProgressCount}</div>
                                <div>{t('reports.tooltipNotStarted')}: {row.notStartedCount}</div>
                                {row.avgDaysOverdue > 0 && (
                                  <div>{t('reports.tooltipAvgDaysOverdue')}: {row.avgDaysOverdue}</div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Progress
                            value={row.compliance}
                            className={`h-1.5 w-16 ${
                              row.compliance >= 80 ? '[&>div]:bg-green-500' :
                              row.compliance >= 50 ? '[&>div]:bg-yellow-500' :
                              '[&>div]:bg-red-500'
                            }`}
                          />
                          <span className={`text-sm font-medium min-w-[35px] ${
                            row.compliance >= 80 ? 'text-green-600' :
                            row.compliance >= 50 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>{row.compliance}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`text-sm font-medium ${row.overdueCount > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {row.overdueCount}
                          {row.avgDaysOverdue > 0 && row.overdueCount > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              (~{row.avgDaysOverdue}d)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`text-sm font-medium ${row.stalledCount > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                              {row.stalledCount}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{t('reports.stalledTooltip')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="font-medium">{row.employeeCount}</span>
                          <span className="text-muted-foreground ml-1">
                            ({t('reports.assignmentsCount', { count: row.assignmentCount })})
                          </span>
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