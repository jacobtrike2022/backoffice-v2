import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  Download,
  Loader2
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { getCertificationsForTracker } from '../lib/crud/certifications';

interface Certification {
  id: string;
  employeeName: string;
  employeeId: string;
  location: string;
  certificationName: string;
  earnedDate: string;
  expirationDate: string;
  daysUntilExpiration: number;
  autoReassign: boolean;
  status: string;
  role?: string;
}

interface CertificationTrackerProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';
}

export function CertificationTracker({ currentRole = 'admin' }: CertificationTrackerProps) {
  const { t } = useTranslation();
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Fetch certifications from database
  useEffect(() => {
    async function fetchCertifications() {
      setLoading(true);
      try {
        const data = await getCertificationsForTracker();
        // Transform to match component interface
        const transformed: Certification[] = data.map((cert: any) => ({
          id: cert.id,
          employeeName: cert.employee,
          employeeId: cert.employeeId,
          location: cert.store,
          certificationName: cert.name,
          earnedDate: cert.issueDate,
          expirationDate: cert.expirationDate,
          daysUntilExpiration: cert.daysUntilExpiration,
          autoReassign: false, // Default, can be wired to database later
          status: cert.status,
          role: cert.role
        }));
        setCertifications(transformed);
      } catch (error) {
        console.error('Error fetching certifications:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCertifications();
  }, []);

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
    expired: certifications.filter(c => c.daysUntilExpiration < 0 || c.status === 'expired').length,
    critical: certifications.filter(c => c.daysUntilExpiration >= 0 && c.daysUntilExpiration <= 30 && c.status !== 'expired').length,
    warning: certifications.filter(c => c.daysUntilExpiration > 30 && c.daysUntilExpiration <= 60).length,
    active: certifications.filter(c => c.daysUntilExpiration > 60).length,
    autoReassignEnabled: certifications.filter(c => c.autoReassign).length
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('compliance.employeeCertifications')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('compliance.trackCertStatus')}
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          {t('compliance.exportReport')}
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('compliance.totalCertifications')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.expired}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{t('compliance.statusExpired')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{stats.critical}</p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">{t('compliance.statusCritical30d')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{stats.warning}</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">{t('compliance.statusWarning3060d')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.active}</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">{t('compliance.statusActive60d')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{stats.autoReassignEnabled}</p>
              <p className="text-xs text-primary mt-1">{t('compliance.autoReassignOn')}</p>
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
                placeholder={t('compliance.searchByEmployee')}
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
                <SelectItem value="all">{t('compliance.allStatuses')}</SelectItem>
                <SelectItem value="critical">{t('compliance.criticalAndExpired')}</SelectItem>
                <SelectItem value="warning">{t('compliance.statusWarningLabel')}</SelectItem>
                <SelectItem value="active">{t('common.active')}</SelectItem>
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
            {t('compliance.certificationDetails', { count: filteredCertifications.length })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-accent/50 border-b border-border">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">{t('compliance.colEmployee')}</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">{t('compliance.colLocation')}</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">{t('compliance.colCertification')}</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">{t('compliance.colEarnedDate')}</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">{t('compliance.colExpiration')}</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">{t('compliance.colDaysLeft')}</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">{t('compliance.colAutoReassign')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCertifications.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      {t('compliance.noCertificationsFound')}
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
                              {cert.role && <p className="text-xs text-muted-foreground">{cert.role}</p>}
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
                                {t('compliance.statusExpired')}
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
                                  {t('compliance.autoReassignEnabled')}
                                </span>
                              ) : (
                                <span>{t('compliance.autoReassignDisabled')}</span>
                              )}
                            </label>
                          </div>
                          {cert.autoReassign && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {t('compliance.reassignAt30Days')}
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
              <p className="font-semibold mb-1">{t('compliance.autoReassignFeatureTitle')}</p>
              <p className="text-xs text-blue-800 dark:text-blue-200">
                {t('compliance.autoReassignFeatureDesc')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}