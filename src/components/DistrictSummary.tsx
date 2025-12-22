import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Skeleton } from './ui/skeleton';
import { 
  MapPin,
  TrendingUp,
  Users,
  Building,
  Eye
} from 'lucide-react';
import { useCurrentUser } from '../lib/hooks/useSupabase';
import { getDistricts, getStores } from '../lib/crud/stores';
import { supabase } from '../lib/supabase';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface DistrictSummaryProps {
  currentRole: 'admin' | 'district-manager' | 'store-manager';
}

interface DistrictData {
  id: string;
  name: string;
  completion: number;
  stores: number;
  employees: number;
  status: 'excellent' | 'good' | 'warning' | 'danger';
  color: string;
}

const COLORS = ['#F74A05', '#FF733C', '#10b981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4'];

export function DistrictSummary({ currentRole }: DistrictSummaryProps) {
  const { user } = useCurrentUser();
  const [districts, setDistricts] = useState<DistrictData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDistrictData() {
      if (!user?.organization_id) return;

      try {
        setLoading(true);
        
        // Get all districts for the organization
        const allDistricts = await getDistricts(user.organization_id);
        
        // Get all stores with their progress data
        const allStores = await getStores({ organization_id: user.organization_id });
        
        // Calculate district-level metrics
        const districtMetrics = await Promise.all(
          allDistricts.map(async (district, index) => {
            // Get stores in this district
            const districtStores = allStores.filter(store => store.district_id === district.id);
            
            // Get all employees in this district
            const storeIds = districtStores.map(s => s.id);
            const { data: employees } = await supabase
              .from('users')
              .select('id, store_id')
              .in('store_id', storeIds.length > 0 ? storeIds : ['00000000-0000-0000-0000-000000000000'])
              .eq('status', 'active');
            
            const employeeIds = employees?.map(e => e.id) || [];
            
            // Calculate district completion based on track completions
            let avgCompletion = 0;
            if (employeeIds.length > 0) {
              // Get all assignments for district employees
              const { data: assignments } = await supabase
                .from('assignments')
                .select('id, user_id, playlist_id')
                .in('user_id', employeeIds);
              
              // Get all track completions
              const { data: completions } = await supabase
                .from('track_completions')
                .select('track_id, user_id')
                .in('user_id', employeeIds);
              
              if (assignments && assignments.length > 0) {
                // Get all unique tracks from assignments
                const playlistIds = [...new Set(assignments.map(a => a.playlist_id).filter(Boolean))];
                const { data: playlistTracks } = await supabase
                  .from('playlist_tracks')
                  .select('track_id, playlist_id')
                  .in('playlist_id', playlistIds.length > 0 ? playlistIds : ['00000000-0000-0000-0000-000000000000']);
                
                // Build track assignment map per user
                const tracksByUser: Record<string, Set<string>> = {};
                assignments.forEach(assignment => {
                  if (!tracksByUser[assignment.user_id]) {
                    tracksByUser[assignment.user_id] = new Set();
                  }
                  playlistTracks?.forEach(pt => {
                    if (pt.playlist_id === assignment.playlist_id) {
                      tracksByUser[assignment.user_id].add(pt.track_id);
                    }
                  });
                });
                
                // Calculate progress percentage for each employee
                const employeeProgresses: number[] = [];
                employeeIds.forEach(employeeId => {
                  const assignedTracks = tracksByUser[employeeId] || new Set();
                  const userCompletions = completions?.filter(tc => tc.user_id === employeeId) || [];
                  const completedTracks = userCompletions.filter(tc => assignedTracks.has(tc.track_id));
                  
                  if (assignedTracks.size > 0) {
                    const employeeProgress = Math.round((completedTracks.length / assignedTracks.size) * 100);
                    employeeProgresses.push(employeeProgress);
                  } else {
                    employeeProgresses.push(0);
                  }
                });
                
                // Average the individual employee progress percentages
                if (employeeProgresses.length > 0) {
                  const sum = employeeProgresses.reduce((acc, p) => acc + p, 0);
                  avgCompletion = Math.round(sum / employeeProgresses.length);
                }
              }
            }
            
            // Determine status based on completion
            let status: 'excellent' | 'good' | 'warning' | 'danger' = 'warning';
            if (avgCompletion >= 90) status = 'excellent';
            else if (avgCompletion >= 75) status = 'good';
            else if (avgCompletion >= 60) status = 'warning';
            else status = 'danger';
            
            return {
              id: district.id,
              name: district.name,
              completion: avgCompletion,
              stores: districtStores.length,
              employees: employeeIds.length,
              status,
              color: COLORS[index % COLORS.length]
            };
          })
        );
        
        setDistricts(districtMetrics);
      } catch (error) {
        console.error('Error fetching district data:', error);
      } finally {
        setLoading(false);
      }
    }

    if (user?.organization_id) {
      fetchDistrictData();
    }
  }, [user?.organization_id]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'good':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'danger':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleViewDetails = (districtName: string) => {
    console.log(`View details for ${districtName}`);
  };

  // Chart data for visualization
  const chartData = districts.map(d => ({
    name: d.name,
    completion: d.completion,
    stores: d.stores,
    employees: d.employees
  }));

  return (
    <Card className="border-border/50 shadow-sm w-full h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-base">District Summary</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Performance overview by district
        </p>
      </CardHeader>
      <CardContent className="pb-4 flex-1 flex flex-col min-h-0">
        {loading ? (
          <div className="space-y-4 flex-1">
            <Skeleton className="h-full w-full" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </div>
        ) : districts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No districts found</p>
          </div>
        ) : (
          <>
            {/* Full Page Chart - Takes remaining space */}
            <div className="mb-6 w-full flex-1 min-h-[400px]" style={{ height: 'calc(100vh - 350px)' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Completion %', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => `${value}%`}
                  />
                  <Legend />
                  <Bar 
                    dataKey="completion" 
                    fill="#F74A05" 
                    radius={[4, 4, 0, 0]}
                    name="Completion %"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* District List */}
            <div className="space-y-3">
              {districts.map((district) => (
                <div key={district.id} className="p-3.5 bg-accent/20 rounded-lg border border-border/40 hover:bg-accent/30 hover:border-border/60 transition-all">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div 
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: district.color }}
                      />
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">
                          {district.name}
                        </h4>
                        <div className="flex items-center gap-2.5 mt-1">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building className="h-3 w-3" />
                            <span>{district.stores}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span>{district.employees}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`${getStatusBadge(district.status)} text-xs px-2 py-0 h-5`}>
                        {district.status}
                      </Badge>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleViewDetails(district.name)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Completion</span>
                      <span className="font-semibold text-sm">{district.completion}%</span>
                    </div>
                    <Progress 
                      value={district.completion} 
                      className={`h-1.5 ${
                        district.status === 'excellent' ? '[&>div]:bg-green-500' :
                        district.status === 'good' ? '[&>div]:bg-blue-500' :
                        district.status === 'warning' ? '[&>div]:bg-yellow-500' :
                        '[&>div]:bg-red-500'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}