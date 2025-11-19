import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import { 
  LineChart, 
  Line, 
  ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Building,
  Eye,
  ArrowUpDown,
  Grid,
  List
} from 'lucide-react';

type UserRole = 'admin' | 'district-manager' | 'store-manager';
type ViewMode = 'table' | 'cards';

interface UnitPerformanceTableProps {
  currentRole: UserRole;
  onNavigateToUnits?: () => void;
}

interface UnitData {
  id: string;
  unit: string;
  completion: number;
  employees: number;
  assignments: number;
  avgScore: number;
  trend: 'up' | 'down';
  status: 'excellent' | 'good' | 'warning' | 'at-risk';
  district: string;
  manager: string;
  trendData: { week: number; value: number }[];
}

const unitData: UnitData[] = [
  { 
    id: '1',
    unit: 'Store A', 
    completion: 85, 
    employees: 24, 
    assignments: 12, 
    avgScore: 87,
    trend: 'up',
    status: 'good',
    district: 'North',
    manager: 'Sarah Johnson',
    trendData: [
      { week: 1, value: 78 },
      { week: 2, value: 82 },
      { week: 3, value: 85 },
      { week: 4, value: 87 },
      { week: 5, value: 85 },
      { week: 6, value: 85 }
    ]
  },
  { 
    id: '2',
    unit: 'Store B', 
    completion: 92, 
    employees: 18, 
    assignments: 15, 
    avgScore: 94,
    trend: 'up',
    status: 'excellent',
    district: 'North',
    manager: 'Mike Chen',
    trendData: [
      { week: 1, value: 88 },
      { week: 2, value: 89 },
      { week: 3, value: 90 },
      { week: 4, value: 91 },
      { week: 5, value: 92 },
      { week: 6, value: 92 }
    ]
  },
  { 
    id: '3',
    unit: 'Store C', 
    completion: 78, 
    employees: 31, 
    assignments: 8, 
    avgScore: 82,
    trend: 'down',
    status: 'warning',
    district: 'South',
    manager: 'Emily Davis',
    trendData: [
      { week: 1, value: 85 },
      { week: 2, value: 83 },
      { week: 3, value: 81 },
      { week: 4, value: 79 },
      { week: 5, value: 78 },
      { week: 6, value: 78 }
    ]
  },
  { 
    id: '4',
    unit: 'Store D', 
    completion: 88, 
    employees: 22, 
    assignments: 14, 
    avgScore: 89,
    trend: 'up',
    status: 'good',
    district: 'East',
    manager: 'James Wilson',
    trendData: [
      { week: 1, value: 84 },
      { week: 2, value: 85 },
      { week: 3, value: 86 },
      { week: 4, value: 87 },
      { week: 5, value: 88 },
      { week: 6, value: 88 }
    ]
  },
  { 
    id: '5',
    unit: 'Store E', 
    completion: 95, 
    employees: 16, 
    assignments: 18, 
    avgScore: 96,
    trend: 'up',
    status: 'excellent',
    district: 'West',
    manager: 'Lisa Anderson',
    trendData: [
      { week: 1, value: 93 },
      { week: 2, value: 94 },
      { week: 3, value: 95 },
      { week: 4, value: 95 },
      { week: 5, value: 95 },
      { week: 6, value: 95 }
    ]
  },
  { 
    id: '6',
    unit: 'Store F', 
    completion: 72, 
    employees: 28, 
    assignments: 6, 
    avgScore: 75,
    trend: 'down',
    status: 'at-risk',
    district: 'South',
    manager: 'Robert Taylor',
    trendData: [
      { week: 1, value: 80 },
      { week: 2, value: 78 },
      { week: 3, value: 75 },
      { week: 4, value: 73 },
      { week: 5, value: 72 },
      { week: 6, value: 72 }
    ]
  }
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'excellent':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'good':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'at-risk':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getRowHighlight = (status: string) => {
  switch (status) {
    case 'at-risk':
      return 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500';
    case 'warning':
      return 'hover:bg-yellow-50';
    default:
      return 'hover:bg-accent/50';
  }
};

const getTrendIcon = (trend: string) => {
  return trend === 'up' ? 
    <TrendingUp className="h-3 w-3 text-green-500" /> : 
    <TrendingDown className="h-3 w-3 text-red-500" />;
};

const Sparkline = ({ data }: { data: { week: number; value: number }[] }) => (
  <div className="w-16 h-8">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke="#F74A05" 
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

export function UnitPerformanceTable({ currentRole, onNavigateToUnits }: UnitPerformanceTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [sortField, setSortField] = useState<keyof UnitData>('completion');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  if (currentRole === 'store-manager') {
    return null; // Store managers don't see unit comparisons
  }

  const handleSort = (field: keyof UnitData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = [...unitData].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }
    
    return 0;
  });

  return (
    <Card className="chart-container hover-lift mt-8">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-lg font-bold">Unit Performance</CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Completion rates by unit
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-accent rounded-lg p-1">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="h-7 px-2"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="h-7 px-2"
            >
              <Grid className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onNavigateToUnits}>
            <Eye className="h-3.5 w-3.5 mr-1" />
            Details
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80 transition-colors py-2"
                    onClick={() => handleSort('unit')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Unit</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80 transition-colors py-2"
                    onClick={() => handleSort('employees')}
                  >
                    <div className="flex items-center space-x-1">
                      <Users className="h-3 w-3" />
                      <span>Staff</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80 transition-colors py-2"
                    onClick={() => handleSort('assignments')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Tasks</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80 transition-colors py-2"
                    onClick={() => handleSort('completion')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Progress</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="py-2">Trend</TableHead>
                  <TableHead className="py-2">Status</TableHead>
                  <TableHead className="py-2">Manager</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((unit) => (
                  <TableRow key={unit.id} className={getRowHighlight(unit.status)}>
                    <TableCell className="py-2">
                      <div className="font-medium">{unit.unit}</div>
                      <div className="text-xs text-muted-foreground">{unit.district}</div>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="font-medium">{unit.employees}</span>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="font-medium">{unit.assignments}</span>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center space-x-2">
                        <Progress 
                          value={unit.completion} 
                          className={`h-1.5 w-16 ${
                            unit.status === 'at-risk' ? '[&>div]:bg-red-500' :
                            unit.status === 'warning' ? '[&>div]:bg-yellow-500' :
                            unit.status === 'excellent' ? '[&>div]:bg-green-500' :
                            '[&>div]:bg-blue-500'
                          }`}
                        />
                        <div className="flex items-center space-x-1">
                          <span className="font-medium text-sm min-w-[32px]">{unit.completion}%</span>
                          {getTrendIcon(unit.trend)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <Sparkline data={unit.trendData} />
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge 
                        variant="outline" 
                        className={`${getStatusColor(unit.status)} text-xs`}
                      >
                        {unit.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="text-sm">{unit.manager}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          // Cards view fallback
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedData.map((unit) => (
              <Card key={unit.id} className={`${getRowHighlight(unit.status)} p-4`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{unit.unit}</h4>
                    <Badge variant="outline" className={getStatusColor(unit.status)}>
                      {unit.status}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Completion</span>
                      <span className="font-bold text-primary">{unit.completion}%</span>
                    </div>
                    <Progress value={unit.completion} className="h-2" />
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{unit.employees} employees</span>
                    <span>{unit.assignments} assignments</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}