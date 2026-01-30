import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  ArrowLeft,
  ShieldCheck,
  Settings,
  Tag,
  Building2,
  FileText,
  Layers,
  Package
} from 'lucide-react';

// Compliance Management components
import { TopicsManager } from '../compliance/TopicsManager';
import { AuthoritiesManager } from '../compliance/AuthoritiesManager';
import { RequirementsManager } from '../compliance/RequirementsManager';

// Programs & Industries components
import { ProgramCategoriesManager } from './ProgramCategoriesManager';
import { ProgramsManager } from './ProgramsManager';
import { IndustryConfigManager } from './IndustryConfigManager';

type UserRole = 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';

interface TrikeAdminFunctionsProps {
  currentRole: UserRole | string;
  onNavigate?: (view: string) => void;
}

export function TrikeAdminFunctions({ currentRole, onNavigate }: TrikeAdminFunctionsProps) {
  const [activeSection, setActiveSection] = useState<'compliance' | 'programs'>('compliance');
  const [complianceTab, setComplianceTab] = useState('topics');
  const [programsTab, setProgramsTab] = useState('industries');

  // Only Trike Super Admin can access this
  if (currentRole !== 'trike-super-admin') {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
            <p className="text-muted-foreground">
              Only Trike Super Admins can access Admin Functions.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate?.('dashboard')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Trike Admin Functions
          </h1>
          <p className="text-muted-foreground mt-1">
            System-wide configuration for compliance and programs
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
                Changes made here affect all organizations. Use Compliance Management to configure
                topics, authorities, and requirements. Use Programs & Industries to manage
                programs, vendors, and industry associations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Section Tabs */}
      <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as 'compliance' | 'programs')}>
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="compliance" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Compliance Management
          </TabsTrigger>
          <TabsTrigger value="programs" className="gap-2">
            <Package className="h-4 w-4" />
            Programs & Industries
          </TabsTrigger>
        </TabsList>

        {/* Compliance Management Section */}
        <TabsContent value="compliance" className="mt-6 space-y-6">
          <Tabs value={complianceTab} onValueChange={setComplianceTab}>
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

            <TabsContent value="topics" className="mt-6">
              <TopicsManager />
            </TabsContent>

            <TabsContent value="authorities" className="mt-6">
              <AuthoritiesManager />
            </TabsContent>

            <TabsContent value="requirements" className="mt-6">
              <RequirementsManager />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Programs & Industries Section */}
        <TabsContent value="programs" className="mt-6 space-y-6">
          <Tabs value={programsTab} onValueChange={setProgramsTab}>
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
              <TabsTrigger value="industries" className="gap-2">
                <Building2 className="h-4 w-4" />
                Industries
              </TabsTrigger>
              <TabsTrigger value="categories" className="gap-2">
                <Layers className="h-4 w-4" />
                Categories
              </TabsTrigger>
              <TabsTrigger value="programs" className="gap-2">
                <Package className="h-4 w-4" />
                Programs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="industries" className="mt-6">
              <IndustryConfigManager />
            </TabsContent>

            <TabsContent value="categories" className="mt-6">
              <ProgramCategoriesManager />
            </TabsContent>

            <TabsContent value="programs" className="mt-6">
              <ProgramsManager />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default TrikeAdminFunctions;
