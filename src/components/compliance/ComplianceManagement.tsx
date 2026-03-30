import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  ShieldCheck,
  Building2,
  FileText,
  Tag,
  MapPin,
  Users,
  ChevronLeft,
  Settings
} from 'lucide-react';
import { TopicsManager } from './TopicsManager';
import { AuthoritiesManager } from './AuthoritiesManager';
import { RequirementsManager } from './RequirementsManager';

type UserRole = 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';

interface ComplianceManagementProps {
  currentRole: UserRole;
  onNavigate?: (view: string) => void;
}

export function ComplianceManagement({ currentRole, onNavigate }: ComplianceManagementProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('topics');

  // Only Trike Super Admin can access this
  if (currentRole !== 'trike-super-admin') {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('compliance.mgmt.accessRestricted')}</h3>
            <p className="text-muted-foreground">
              {t('compliance.mgmt.accessRestrictedDesc')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate?.('compliance')}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('compliance.mgmt.backToCompliance')}
            </Button>
          </div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            {t('compliance.mgmt.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('compliance.mgmt.subtitle')}
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-semibold mb-1">{t('compliance.mgmt.systemWideConfig')}</p>
              <p className="text-xs text-blue-800 dark:text-blue-200">
                {t('compliance.mgmt.systemWideConfigDesc')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Management Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="topics" className="gap-2">
            <Tag className="h-4 w-4" />
            {t('compliance.topics')}
          </TabsTrigger>
          <TabsTrigger value="authorities" className="gap-2">
            <Building2 className="h-4 w-4" />
            {t('compliance.authorities')}
          </TabsTrigger>
          <TabsTrigger value="requirements" className="gap-2">
            <FileText className="h-4 w-4" />
            {t('compliance.requirements')}
          </TabsTrigger>
        </TabsList>

        {/* Topics Tab */}
        <TabsContent value="topics" className="mt-6">
          <TopicsManager />
        </TabsContent>

        {/* Authorities Tab */}
        <TabsContent value="authorities" className="mt-6">
          <AuthoritiesManager />
        </TabsContent>

        {/* Requirements Tab */}
        <TabsContent value="requirements" className="mt-6">
          <RequirementsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
