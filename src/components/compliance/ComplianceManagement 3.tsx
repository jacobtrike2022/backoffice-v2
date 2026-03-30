import React, { useState } from 'react';
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
  const [activeTab, setActiveTab] = useState('topics');

  // Only Trike Super Admin can access this
  if (currentRole !== 'trike-super-admin') {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
            <p className="text-muted-foreground">
              Only Trike Super Admins can access the Compliance Management area.
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
              Back to Compliance
            </Button>
          </div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Compliance Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure compliance topics, authorities, and requirements for all organizations
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-semibold mb-1">System-Wide Configuration</p>
              <p className="text-xs text-blue-800 dark:text-blue-200">
                Changes made here affect the compliance framework for all organizations.
                Topics define categories of compliance, Authorities are regulatory bodies,
                and Requirements link specific compliance needs to topics and authorities.
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
            Topics
          </TabsTrigger>
          <TabsTrigger value="authorities" className="gap-2">
            <Building2 className="h-4 w-4" />
            Authorities
          </TabsTrigger>
          <TabsTrigger value="requirements" className="gap-2">
            <FileText className="h-4 w-4" />
            Requirements
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
