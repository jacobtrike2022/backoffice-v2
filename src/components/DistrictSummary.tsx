import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { 
  MapPin,
  TrendingUp,
  Users,
  Building,
  Eye
} from 'lucide-react';

interface DistrictSummaryProps {
  currentRole: 'admin' | 'district-manager' | 'store-manager';
}

// District Summary Data
const districtSummaryData = [
  { 
    id: 1,
    name: 'North District', 
    completion: 88.5, 
    engagement: 92, 
    stores: 2, 
    employees: 42,
    color: '#F74A05',
    status: 'good',
    trend: '+5.2%'
  },
  { 
    id: 2,
    name: 'South District', 
    completion: 75, 
    engagement: 85, 
    stores: 2, 
    employees: 59,
    color: '#FF733C',
    status: 'warning',
    trend: '-2.1%'
  },
  { 
    id: 3,
    name: 'East District', 
    completion: 88, 
    engagement: 88, 
    stores: 1, 
    employees: 23,
    color: '#10b981',
    status: 'good',
    trend: '+1.8%'
  },
  { 
    id: 4,
    name: 'West District', 
    completion: 95, 
    engagement: 90, 
    stores: 1, 
    employees: 16,
    color: '#3B82F6',
    status: 'excellent',
    trend: '+7.3%'
  }
];

export function DistrictSummary({ currentRole }: DistrictSummaryProps) {
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

  const getTrendColor = (trend: string) => {
    return trend.startsWith('+') ? 'text-green-600' : 'text-red-600';
  };

  const handleViewDetails = (districtName: string) => {
    console.log(`View details for ${districtName}`);
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">District Summary</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Performance overview by district
        </p>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="space-y-3">
          {districtSummaryData.map((district) => (
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
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm">{district.completion}%</span>
                    <span className={`text-xs font-medium ${getTrendColor(district.trend)}`}>
                      {district.trend}
                    </span>
                  </div>
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
      </CardContent>
    </Card>
  );
}