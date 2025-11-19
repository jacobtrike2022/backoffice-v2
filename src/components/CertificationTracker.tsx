import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { 
  Award, 
  Search, 
  Calendar,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Download
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface Certification {
  id: string;
  employeeName: string;
  employeeId: string;
  location: string;
  district: string;
  certificationName: string;
  earnedDate: string;
  expirationDate: string;
  daysUntilExpiration: number;
  autoReassign: boolean;
}

// Mock certification data
const mockCertifications: Certification[] = [
  {
    id: '1',
    employeeName: 'Sarah Johnson',
    employeeId: 'EMP001',
    location: 'Store A',
    district: 'North',
    certificationName: 'Fire Safety Certification',
    earnedDate: '2024-06-15',
    expirationDate: '2025-06-15',
    daysUntilExpiration: 210,
    autoReassign: true
  },
  {
    id: '2',
    employeeName: 'Mike Rodriguez',
    employeeId: 'EMP002',
    location: 'Store B',
    district: 'South',
    certificationName: 'Food Handler Certification',
    earnedDate: '2024-05-10',
    expirationDate: '2025-05-10',
    daysUntilExpiration: 174,
    autoReassign: true
  },
  {
    id: '3',
    employeeName: 'Emily Chen',
    employeeId: 'EMP003',
    location: 'Store C',
    district: 'East',
    certificationName: 'Customer Service Pro',
    earnedDate: '2024-06-28',
    expirationDate: '2025-06-28',
    daysUntilExpiration: 223,
    autoReassign: false
  },
  {
    id: '4',
    employeeName: 'David Thompson',
    employeeId: 'EMP004',
    location: 'Store D',
    district: 'North',
    certificationName: 'Equipment Safety Certification',
    earnedDate: '2024-03-15',
    expirationDate: '2024-12-15',
    daysUntilExpiration: 28,
    autoReassign: true
  },
  {
    id: '5',
    employeeName: 'Lisa Park',
    employeeId: 'EMP005',
    location: 'Store A',
    district: 'North',
    certificationName: 'Product Expert Certification',
    earnedDate: '2024-06-22',
    expirationDate: '2025-06-22',
    daysUntilExpiration: 217,
    autoReassign: true
  },
  {
    id: '6',
    employeeName: 'James Wilson',
    employeeId: 'EMP006',
    location: 'Store E',
    district: 'South',
    certificationName: 'Emergency Response Certification',
    earnedDate: '2024-06-30',
    expirationDate: '2024-12-30',
    daysUntilExpiration: 43,
    autoReassign: true
  },
  {
    id: '7',
    employeeName: 'Maria Garcia',
    employeeId: 'EMP007',
    location: 'Store A',
    district: 'North',
    certificationName: 'Food Handler Certification',
    earnedDate: '2024-02-01',
    expirationDate: '2024-11-20',
    daysUntilExpiration: 3,
    autoReassign: false
  },
  {
    id: '8',
    employeeName: 'Robert Brown',
    employeeId: 'EMP008',
    location: 'Store B',
    district: 'South',
    certificationName: 'Leadership Certification',
    earnedDate: '2024-06-18',
    expirationDate: '2025-06-18',
    daysUntilExpiration: 213,
    autoReassign: true
  },
  {
    id: '9',
    employeeName: 'Amanda Lee',
    employeeId: 'EMP009',
    location: 'Store C',
    district: 'East',
    certificationName: 'Fire Safety Certification',
    earnedDate: '2024-04-10',
    expirationDate: '2024-12-10',
    daysUntilExpiration: 23,
    autoReassign: true
  },
  {
    id: '10',
    employeeName: 'Kevin Nguyen',
    employeeId: 'EMP010',
    location: 'Store B',
    district: 'South',
    certificationName: 'Safety Certification',
    earnedDate: '2024-06-21',
    expirationDate: '2025-06-21',
    daysUntilExpiration: 216,
    autoReassign: true
  },
  {
    id: '11',
    employeeName: 'Jessica Martinez',
    employeeId: 'EMP011',
    location: 'Store D',
    district: 'North',
    certificationName: 'First Aid Certification',
    earnedDate: '2024-01-15',
    expirationDate: '2024-11-25',
    daysUntilExpiration: 8,
    autoReassign: false
  },
  {
    id: '12',
    employeeName: 'Christopher Davis',
    employeeId: 'EMP014',
    location: 'Store C',
    district: 'East',
    certificationName: 'Leadership Certification',
    earnedDate: '2024-06-24',
    expirationDate: '2025-06-24',
    daysUntilExpiration: 219,
    autoReassign: true
  }
];

interface CertificationTrackerProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
}

export function CertificationTracker({ currentRole = 'admin' }: CertificationTrackerProps) {
  const [certifications, setCertifications] = useState<Certification[]>(mockCertifications);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const getExpirationStatus = (days: number): { status: string; color: string; bgColor: string } => {
    if (days < 0) {
      return { 
        status: 'Expired', 
        color: 'text-red-700 dark:text-red-400', 
        bgColor: 'bg-red-100 border-red-200 dark:bg-red-900/30 dark:border-red-800' 
      };
    } else if (days <= 30) {
      return { 
        status: 'Critical', 
        color: 'text-orange-700 dark:text-orange-400', 
        bgColor: 'bg-orange-100 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800' 
      };
    } else if (days <= 60) {
      return { 
        status: 'Warning', 
        color: 'text-yellow-700 dark:text-yellow-400', 
        bgColor: 'bg-yellow-100 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800' 
      };
    } else {
      return { 
        status: 'Active', 
        color: 'text-green-700 dark:text-green-400', 
        bgColor: 'bg-green-100 border-green-200 dark:bg-green-900/30 dark:border-green-800' 
      };
    }
  };

  const toggleAutoReassign = (id: string) => {
    setCertifications(certifications.map(cert => 
      cert.id === id ? { ...cert, autoReassign: !cert.autoReassign } : cert
    ));
  };

  const filteredCertifications = certifications.filter(cert => {
    const matchesSearch = 
      cert.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.certificationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.location.toLowerCase().includes(searchTerm.toLowerCase());

    const status = getExpirationStatus(cert.daysUntilExpiration).status;
    const matchesFilter = 
      filterStatus === 'all' ||
      (filterStatus === 'critical' && (status === 'Critical' || status === 'Expired')) ||
      (filterStatus === 'warning' && status === 'Warning') ||
      (filterStatus === 'active' && status === 'Active');

    return matchesSearch && matchesFilter;
  });

  // Calculate summary stats
  const stats = {
    total: certifications.length,
    expired: certifications.filter(c => c.daysUntilExpiration < 0).length,
    critical: certifications.filter(c => c.daysUntilExpiration >= 0 && c.daysUntilExpiration <= 30).length,
    warning: certifications.filter(c => c.daysUntilExpiration > 30 && c.daysUntilExpiration <= 60).length,
    active: certifications.filter(c => c.daysUntilExpiration > 60).length,
    autoReassignEnabled: certifications.filter(c => c.autoReassign).length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Employee Certifications</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track certification status and auto-renewal settings
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Certifications</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.expired}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">Expired</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{stats.critical}</p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Critical {'(<30d)'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{stats.warning}</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Warning (30-60d)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.active}</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">Active {`(>60d)`}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{stats.autoReassignEnabled}</p>
              <p className="text-xs text-primary mt-1">Auto-Reassign On</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee, certification, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="critical">Critical & Expired</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="active">Active</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Certifications Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Award className="h-5 w-5 mr-2 text-primary" />
            Certification Details ({filteredCertifications.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-accent/50 border-b border-border">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Employee</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Location</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Certification</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Earned Date</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Expiration</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Days Left</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Auto-Reassign</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCertifications.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No certifications found matching your criteria
                    </td>
                  </tr>
                ) : (
                  filteredCertifications.map((cert) => {
                    const expirationStatus = getExpirationStatus(cert.daysUntilExpiration);
                    return (
                      <tr key={cert.id} className="hover:bg-accent/30 transition-colors">
                        {/* Employee */}
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-foreground">{cert.employeeName}</p>
                            <p className="text-xs text-muted-foreground">{cert.employeeId}</p>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm text-foreground">{cert.location}</p>
                              <p className="text-xs text-muted-foreground">{cert.district}</p>
                            </div>
                          </div>
                        </td>

                        {/* Certification */}
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <Award className="h-4 w-4 text-primary" />
                            <span className="text-sm text-foreground">{cert.certificationName}</span>
                          </div>
                        </td>

                        {/* Earned Date */}
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-foreground">
                              {new Date(cert.earnedDate).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </span>
                          </div>
                        </td>

                        {/* Expiration Date */}
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-foreground">
                              {new Date(cert.expirationDate).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </span>
                          </div>
                        </td>

                        {/* Days Left */}
                        <td className="p-4">
                          <Badge 
                            variant="outline"
                            className={`${expirationStatus.bgColor} ${expirationStatus.color} font-semibold`}
                          >
                            {cert.daysUntilExpiration < 0 ? (
                              <>
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Expired
                              </>
                            ) : (
                              <>
                                {cert.daysUntilExpiration <= 30 && (
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                )}
                                {cert.daysUntilExpiration}d
                              </>
                            )}
                          </Badge>
                        </td>

                        {/* Auto-Reassign */}
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`auto-${cert.id}`}
                              checked={cert.autoReassign}
                              onCheckedChange={() => toggleAutoReassign(cert.id)}
                            />
                            <label 
                              htmlFor={`auto-${cert.id}`}
                              className="text-sm text-muted-foreground cursor-pointer"
                            >
                              {cert.autoReassign ? (
                                <span className="text-green-600 dark:text-green-400 flex items-center">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Enabled
                                </span>
                              ) : (
                                <span>Disabled</span>
                              )}
                            </label>
                          </div>
                          {cert.autoReassign && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Reassign at 30 days
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Info Banner */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <Award className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-semibold mb-1">Auto-Reassignment Feature</p>
              <p className="text-xs text-blue-800 dark:text-blue-200">
                When enabled, employees will automatically be reassigned their certification course 30 days before expiration. 
                This ensures continuous compliance and prevents certification lapses.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}