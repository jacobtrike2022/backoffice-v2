import React, { useState } from 'react';
import { FormAnalytics } from './forms/FormAnalytics';
import { FormBuilder } from './forms/FormBuilder';
import { FormLibrary } from './forms/FormLibrary';
import { FormAssignments } from './forms/FormAssignments';
import { FormSubmissions } from './forms/FormSubmissions';
import { FormDetail } from './forms/FormDetail';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Footer } from './Footer';

interface FormsProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
}

export function Forms({ currentRole = 'admin' }: FormsProps) {
  const [activeTab, setActiveTab] = useState('analytics');
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);

  const handleFormSelect = (formId: string) => {
    setSelectedFormId(formId);
  };

  const handleBackToLibrary = () => {
    setSelectedFormId(null);
  };

  const handleEditForm = (formId?: string) => {
    setEditingFormId(formId || selectedFormId);
    setSelectedFormId(null);
    setActiveTab('builder');
  };

  const handleFormSaved = () => {
    setEditingFormId(null);
    setActiveTab('library');
  };

  // If a form is selected, show the detail view instead of the library
  if (selectedFormId && activeTab === 'library') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-foreground mb-2">Forms Management</h1>
          <p className="text-muted-foreground">
            Create, assign, and track form submissions across your organization
          </p>
        </div>

        <FormDetail 
          formId={selectedFormId} 
          onBack={handleBackToLibrary}
          onEdit={handleEditForm}
          currentRole={currentRole}
        />
        <Footer />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-foreground mb-2">Forms Management</h1>
        <p className="text-muted-foreground">
          Create, assign, and track form submissions across your organization
        </p>
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="analytics">Analytics Dashboard</TabsTrigger>
          <TabsTrigger value="builder">Form Builder</TabsTrigger>
          <TabsTrigger value="library">Form Library</TabsTrigger>
          <TabsTrigger value="assignments">Form Assignments</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-6">
          <FormAnalytics currentRole={currentRole} />
        </TabsContent>

        <TabsContent value="builder" className="space-y-6">
          <FormBuilder
            formId={editingFormId || undefined}
            currentRole={currentRole}
            onSaveDraft={handleFormSaved}
            onNavigateToAssignments={() => setActiveTab('assignments')}
          />
        </TabsContent>

        <TabsContent value="library" className="space-y-6">
          <FormLibrary
            currentRole={currentRole}
            onFormSelect={handleFormSelect}
            onEdit={handleEditForm}
            onCreateNew={() => {
              setEditingFormId(null);
              setActiveTab('builder');
            }}
          />
        </TabsContent>

        <TabsContent value="assignments" className="space-y-6">
          <FormAssignments currentRole={currentRole} />
        </TabsContent>

        <TabsContent value="submissions" className="space-y-6">
          <FormSubmissions currentRole={currentRole} />
        </TabsContent>
      </Tabs>
      <Footer />
    </div>
  );
}