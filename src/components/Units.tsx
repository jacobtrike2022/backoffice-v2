import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Footer } from './Footer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  Search, 
  Filter, 
  Download,
  Building,
  TrendingUp,
  X,
  ChevronDown,
  MapPin,
  Users,
  Plus
} from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { StoreDetail } from './StoreDetail';
import { NewUnit } from './NewUnit';
import { useStores, useCurrentUser } from '../lib/hooks/useSupabase';

type UserRole = 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';

interface Store {
  id: string;
  name: string;
  storeNumber: string;
  district: string;
  manager: string;
  employees: number;
  avgProgress: number;
  compliance: number;
  performance: 'excellent' | 'good' | 'needs-improvement';
  city: string;
  state: string;
  // Additional fields for StoreDetail
  address?: string;
  address_line_2?: string;
  zip?: string;
  county?: string;
  phone?: string;
  email?: string;
  photo_url?: string;
  timezone?: string;
  created_at?: string;
  updated_at?: string;
  managerEmail?: string;
  managerId?: string;
}

interface UnitsProps {
  role: UserRole;
  selectedStoreId?: string;
  onStoreSelect?: (storeId: string) => void;
  onNavigate?: (view: string) => void;
}

export function Units({ role: currentRole, selectedStoreId: initialStoreId, onStoreSelect, onNavigate }: UnitsProps) {
  console.log('🏪 Units component rendered! Current role:', currentRole);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [editingStore, setEditingStore] = useState<any | null>(null);  // NEW: Store being edited
  
  // Filter states
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [selectedPerformance, setSelectedPerformance] = useState<string[]>([]);

  // Fetch current user to get their organization/district/store
  const { user, loading: userLoading } = useCurrentUser();
  
  console.log('🏪 Units - User data:', { user, userLoading });
  
  // Fetch stores from Supabase
  const { stores: rawStores, loading: storesLoading, error: storesError } = useStores(
    user?.organization_id ? {
      organization_id: user.organization_id,
      is_active: true
    } : undefined
  );

  console.log('🏪 Units - Stores data:', { rawStores, storesLoading, storesError });

  // Map database stores to UI format
  const allStores: Store[] = rawStores.map((store: any) => ({
    id: store.id,
    name: store.name,
    storeNumber: store.code ? `#${store.code}` : '#N/A',
    district: store.district?.name || 'Unassigned',
    manager: store.manager 
      ? `${store.manager.first_name} ${store.manager.last_name}`
      : 'No Manager',
    employees: store.employeeCount || 0,
    avgProgress: store.avgProgress || 0,
    compliance: store.compliance || 0,
    performance: store.performance || 'needs-improvement',
    city: store.city || '',
    state: store.state || '',
    // Additional fields for StoreDetail
    address: store.address,
    address_line_2: store.address_line_2,
    zip: store.zip,
    county: store.county,
    phone: store.phone,
    store_email: store.store_email,
    photo_url: store.photo_url,
    timezone: store.timezone,
    created_at: store.created_at,
    updated_at: store.updated_at,
    managerEmail: store.manager?.email,
    managerId: store.manager_id
  }));

  // Get stores based on role
  const getStoresForRole = () => {
    if (!user) return [];
    
    switch (currentRole) {
      case 'admin':
        return allStores;
      case 'district-manager':
        // District manager sees stores in their district
        return allStores.filter(store => 
          store.district === allStores.find(s => s.id === user.store_id)?.district
        );
      case 'store-manager':
        // Store manager sees only their store
        return allStores.filter(store => store.id === user.store_id);
      default:
        return allStores;
    }
  };

  const baseStores = getStoresForRole();

  // Apply filters
  const filteredStores = baseStores.filter(store => {
    const matchesSearch = 
      store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.storeNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.manager.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.city.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDistrict = selectedDistricts.length === 0 || selectedDistricts.includes(store.district);
    const matchesPerformance = selectedPerformance.length === 0 || selectedPerformance.includes(store.performance);

    return matchesSearch && matchesDistrict && matchesPerformance;
  });

  // Get unique values for filters
  const uniqueDistricts = Array.from(new Set(baseStores.map(store => store.district)));

  const toggleFilter = (value: string, selected: string[], setter: (val: string[]) => void) => {
    if (selected.includes(value)) {
      setter(selected.filter(v => v !== value));
    } else {
      setter([...selected, value]);
    }
  };

  const clearAllFilters = () => {
    setSelectedDistricts([]);
    setSelectedPerformance([]);
  };

  // Auto-select store if initialStoreId is provided
  useEffect(() => {
    if (initialStoreId && allStores.length > 0 && !selectedStore) {
      const store = allStores.find(s => s.id === initialStoreId);
      if (store) {
        console.log('🏪 Auto-selecting store:', store.name);
        setSelectedStore(store);
      }
    }
  }, [initialStoreId, allStores.length, selectedStore]);

  const activeFiltersCount = selectedDistricts.length + selectedPerformance.length;

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'excellent':
        return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400';
      case 'good':
        return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400';
      case 'needs-improvement':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 60) return 'bg-blue-500';
    if (progress >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // If editing a store, show edit form
  if (editingStore) {
    const rawStore = rawStores.find(s => s.id === editingStore.id);
    return (
      <NewUnit
        editStore={rawStore}
        onBack={() => setEditingStore(null)}
        onSuccess={() => {
          setEditingStore(null);
          window.location.reload(); // Refresh to show updated data
        }}
      />
    );
  }

  // If store is selected, show detail view
  if (selectedStore) {
    return (
      <StoreDetail 
        store={selectedStore}
        onBack={() => setSelectedStore(null)}
        currentRole={currentRole}
        onEdit={() => setEditingStore(selectedStore)}
      />
    );
  }

  // Calculate stats
  const totalStores = baseStores.length;
  const totalEmployees = baseStores.reduce((sum, store) => sum + store.employees, 0);
  
  // WEIGHTED average: We need to get total completed/assigned across all stores
  // Since avgProgress is already calculated per store from user_progress,
  // we need to recalculate from raw data for accurate company-wide metric
  // For now, using store avgProgress weighted by employee count is closer to accurate
  const totalProgressWeighted = baseStores.reduce((sum, store) => 
    sum + (store.avgProgress * store.employees), 0
  );
  const avgProgress = totalEmployees > 0 
    ? Math.round(totalProgressWeighted / totalEmployees)
    : 0;

  // Show loading state
  if (userLoading || storesLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground">Units Management</h1>
            <p className="text-muted-foreground mt-1">
              Monitor and manage store performance and training metrics
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="border-2 border-primary/10">
              <CardContent className="p-6">
                <div className="h-20 animate-pulse bg-accent rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="h-64 animate-pulse bg-accent rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground">Units Management</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage store performance and training metrics
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button 
            variant="default" 
            size="sm"
            onClick={() => onNavigate?.('new-unit')}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Unit
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 border-primary/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Units</p>
                <p className="text-3xl font-bold text-foreground mt-1">{totalStores}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <Building className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-500/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Employees</p>
                <p className="text-3xl font-bold text-foreground mt-1">{totalEmployees}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-orange-500/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Progress</p>
                <p className="text-3xl font-bold text-foreground mt-1">{avgProgress}%</p>
              </div>
              <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search units by name, number, manager, or city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant={showFilters ? "default" : "outline"}
                onClick={() => setShowFilters(!showFilters)}
                className="relative"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge className="ml-2 bg-white text-primary border-0 px-1.5 py-0 h-5 min-w-5">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="border rounded-lg p-4 bg-accent/50 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Filter Options</h3>
                  {activeFiltersCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear All
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* District Filter - Only for Admin */}
                  {currentRole === 'admin' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">District</label>
                      <div className="space-y-2">
                        {uniqueDistricts.map(district => (
                          <div key={district} className="flex items-center space-x-2">
                            <Checkbox
                              id={`district-${district}`}
                              checked={selectedDistricts.includes(district)}
                              onCheckedChange={() => toggleFilter(district, selectedDistricts, setSelectedDistricts)}
                            />
                            <label
                              htmlFor={`district-${district}`}
                              className="text-sm text-foreground cursor-pointer"
                            >
                              {district}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Performance Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Performance</label>
                    <div className="space-y-2">
                      {['excellent', 'good', 'needs-improvement'].map(perf => (
                        <div key={perf} className="flex items-center space-x-2">
                          <Checkbox
                            id={`perf-${perf}`}
                            checked={selectedPerformance.includes(perf)}
                            onCheckedChange={() => toggleFilter(perf, selectedPerformance, setSelectedPerformance)}
                          />
                          <label
                            htmlFor={`perf-${perf}`}
                            className="text-sm text-foreground cursor-pointer capitalize"
                          >
                            {perf.replace('-', ' ')}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Units List */}
      <Card>
        <CardHeader className="border-b bg-accent/50">
          <CardTitle className="text-lg">
            Units ({filteredStores.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Table Header */}
          <div
            className="grid gap-4 px-4 py-3 border-b bg-muted/30 text-xs font-medium text-muted-foreground"
            style={{ gridTemplateColumns: 'auto 1fr 150px 120px 140px 100px 32px' }}
          >
            <div className="w-12"></div>
            <div>Unit</div>
            <div>District</div>
            <div>Employees</div>
            <div>Avg. Progress</div>
            <div className="text-center">Compliance</div>
            <div></div>
          </div>
          <div className="divide-y divide-border">
            {filteredStores.length === 0 ? (
              <div className="p-12 text-center">
                <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No units found matching your criteria</p>
              </div>
            ) : (
              filteredStores.map((store) => (
                <div
                  key={store.id}
                  className="grid gap-4 px-4 py-4 hover:bg-accent/50 cursor-pointer transition-colors items-center"
                  style={{ gridTemplateColumns: 'auto 1fr 150px 120px 140px 100px 32px' }}
                  onClick={() => setSelectedStore(store)}
                >
                  <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building className="h-6 w-6 text-primary" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center space-x-2 mb-0.5">
                      <h3 className="font-semibold text-foreground text-sm truncate">{store.name}</h3>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{store.storeNumber}</span>
                      <Badge variant="outline" className={`${getPerformanceColor(store.performance)} text-xs py-0 h-5 flex-shrink-0`}>
                        {store.performance.replace('-', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                      <span className="truncate">Manager: {store.manager}</span>
                      <span>•</span>
                      <span className="flex items-center flex-shrink-0">
                        <MapPin className="h-3 w-3 mr-1" />
                        {store.city}, {store.state}
                      </span>
                    </div>
                  </div>

                  <div className="text-sm text-foreground truncate">
                    {store.district}
                  </div>

                  <div className="text-sm text-foreground">
                    {store.employees}
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="w-16">
                      <Progress
                        value={store.avgProgress}
                        className="h-1.5"
                        indicatorClassName={getProgressColor(store.avgProgress)}
                      />
                    </div>
                    <span className="text-xs font-semibold text-foreground w-10 text-right">
                      {store.avgProgress}%
                    </span>
                  </div>

                  <div className="text-center">
                    <p className="text-lg font-bold text-foreground">{store.compliance}%</p>
                  </div>

                  <ChevronDown className="h-4 w-4 text-muted-foreground -rotate-90" />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
      <Footer />
    </div>
  );
}