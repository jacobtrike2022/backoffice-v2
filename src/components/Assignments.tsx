import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Plus, 
  Search, 
  Filter,
  Calendar,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  PlaySquare,
  MoreVertical
} from 'lucide-react';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface Assignment {
  id: string;
  title: string;
  type: 'playlist' | 'album' | 'track';
  assignedTo: string;
  dueDate: string;
  status: 'completed' | 'in-progress' | 'not-started' | 'overdue';
  completionRate: number;
  assignedBy: string;
  createdDate: string;
}

const mockAssignments: Assignment[] = [
  {
    id: '1',
    title: 'Q1 Mandatory Training',
    type: 'playlist',
    assignedTo: 'All Employees',
    dueDate: '2024-03-31',
    status: 'in-progress',
    completionRate: 67,
    assignedBy: 'Sarah Johnson',
    createdDate: '2024-01-15'
  },
  {
    id: '2',
    title: 'Food Safety Certification',
    type: 'album',
    assignedTo: 'Kitchen Staff',
    dueDate: '2024-02-15',
    status: 'completed',
    completionRate: 100,
    assignedBy: 'Mike Chen',
    createdDate: '2024-01-10'
  },
  {
    id: '3',
    title: 'New Manager Onboarding',
    type: 'playlist',
    assignedTo: 'James Wilson',
    dueDate: '2024-02-28',
    status: 'in-progress',
    completionRate: 45,
    assignedBy: 'Sarah Johnson',
    createdDate: '2024-02-01'
  },
  {
    id: '4',
    title: 'Cash Handling Best Practices',
    type: 'track',
    assignedTo: 'Front of House',
    dueDate: '2024-02-10',
    status: 'overdue',
    completionRate: 34,
    assignedBy: 'Sarah Johnson',
    createdDate: '2024-01-20'
  },
  {
    id: '5',
    title: 'Allergen Management Protocol',
    type: 'album',
    assignedTo: 'All Stores - District 5',
    dueDate: '2024-03-15',
    status: 'not-started',
    completionRate: 0,
    assignedBy: 'Regional Manager',
    createdDate: '2024-02-05'
  }
];

interface AssignmentsProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
  onOpenAssignmentWizard?: () => void;
}

export function Assignments({ currentRole = 'admin', onOpenAssignmentWizard }: AssignmentsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredAssignments = mockAssignments.filter(assignment => {
    const matchesSearch = searchQuery === '' || 
      assignment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assignment.assignedTo.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || assignment.status === filterStatus;
    const matchesType = filterType === 'all' || assignment.type === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>;
      case 'in-progress':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0">
          <Clock className="h-3 w-3 mr-1" />
          In Progress
        </Badge>;
      case 'overdue':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-0">
          <AlertCircle className="h-3 w-3 mr-1" />
          Overdue
        </Badge>;
      default:
        return <Badge variant="outline">
          Not Started
        </Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors = {
      playlist: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      album: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      track: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    };
    return <Badge className={`${colors[type as keyof typeof colors]} border-0 capitalize`}>
      {type}
    </Badge>;
  };

  const stats = [
    {
      label: 'Active Assignments',
      value: mockAssignments.filter(a => a.status === 'in-progress').length,
      icon: Clock,
      color: 'text-blue-600 dark:text-blue-400'
    },
    {
      label: 'Completed',
      value: mockAssignments.filter(a => a.status === 'completed').length,
      icon: CheckCircle,
      color: 'text-green-600 dark:text-green-400'
    },
    {
      label: 'Overdue',
      value: mockAssignments.filter(a => a.status === 'overdue').length,
      icon: AlertCircle,
      color: 'text-red-600 dark:text-red-400'
    },
    {
      label: 'Average Completion',
      value: `${Math.round(mockAssignments.reduce((acc, a) => acc + a.completionRate, 0) / mockAssignments.length)}%`,
      icon: Users,
      color: 'text-primary'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground mb-2">Content Assignments</h1>
          <p className="text-muted-foreground">
            Manage and track training assignments across your organization
          </p>
        </div>
        {currentRole === 'admin' && (
          <Button 
            className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
            onClick={onOpenAssignmentWizard}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Assignment
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div className={`h-12 w-12 rounded-full bg-muted flex items-center justify-center ${stat.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assignments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="not-started">Not Started</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="playlist">Playlists</SelectItem>
                <SelectItem value="album">Albums</SelectItem>
                <SelectItem value="track">Tracks</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Assignments List */}
      <div className="space-y-4">
        {filteredAssignments.map((assignment) => (
          <Card key={assignment.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="font-semibold">{assignment.title}</h3>
                    {getTypeBadge(assignment.type)}
                    {getStatusBadge(assignment.status)}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4" />
                      <span>Assigned to: <strong>{assignment.assignedTo}</strong></span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>Due: <strong>{new Date(assignment.dueDate).toLocaleDateString()}</strong></span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <PlaySquare className="h-4 w-4" />
                      <span>Created by: <strong>{assignment.assignedBy}</strong></span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Completion Progress</span>
                      <span className="text-sm font-semibold">{assignment.completionRate}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          assignment.status === 'completed' ? 'bg-green-500' :
                          assignment.status === 'overdue' ? 'bg-red-500' :
                          'bg-brand-gradient'
                        }`}
                        style={{ width: `${assignment.completionRate}%` }}
                      />
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View Details</DropdownMenuItem>
                    <DropdownMenuItem>View Progress</DropdownMenuItem>
                    {currentRole === 'admin' && (
                      <>
                        <DropdownMenuItem>Edit Assignment</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">Remove Assignment</DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAssignments.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="font-semibold mb-2">No assignments found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Try adjusting your search or filter criteria
            </p>
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('all');
                setFilterType('all');
              }}
            >
              Clear all filters
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
