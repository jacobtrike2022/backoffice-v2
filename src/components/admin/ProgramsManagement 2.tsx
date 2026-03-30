import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  ArrowLeft,
  Layers,
  Package,
  Building2,
  ShieldCheck,
  Info
} from 'lucide-react';
import { ProgramCategoriesManager } from './ProgramCategoriesManager';
import { ProgramsManager } from './ProgramsManager';
import { IndustryConfigManager } from './IndustryConfigManager';

interface ProgramsManagementProps {
  currentRole: string;
  onNavigate: (view: string) => void;
}

export function ProgramsManagement({ currentRole, onNavigate }: ProgramsManagementProps) {
  const [activeTab, setActiveTab] = useState('industries');

  // Access control
  if (currentRole !== 'trike-super-admin') {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
            <p className="text-muted-foreground">
              Only Trike Super Admins can access Programs Management.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate('dashboard')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Programs & Industries</h1>
          <p className="text-muted-foreground">
            Manage programs, vendors, and industry configurations
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">System-Wide Configuration</p>
              <p>
                Programs and industry associations defined here apply across all organizations.
                Use the Industries tab to configure which compliance topics and programs
                are typically associated with each industry.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
    </div>
  );
}
