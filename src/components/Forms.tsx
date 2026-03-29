import React, { useState } from 'react';
import { FormAnalytics } from './forms/FormAnalytics';
import { FormBuilder } from './forms/FormBuilder';
import { FormLibrary } from './forms/FormLibrary';
import { FormAssignments } from './forms/FormAssignments';
import { FormSubmissions } from './forms/FormSubmissions';
import { FormDetail } from './forms/FormDetail';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Footer } from './Footer';

// NOTE: App.tsx currently renders <Forms currentRole={currentRole} /> without passing orgId.
// When App.tsx is updated to pass orgId (e.g. viewingOrgId), this component will
// forward it to child components. Until then, orgId defaults to an empty string and
// getForms will fall back to getCurrentUserOrgId() internally.

interface FormsProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager' | 'trike-super-admin';
  orgId?: string; // Pass demo org or authenticated user's org; defaults to '' until App.tsx wires it
}

// Legacy components (FormDetail, FormAnalytics, FormBuilder, FormAssignments, FormSubmissions)
// don't yet include 'trike-super-admin' in their currentRole union. Cast to the legacy type
// when passing down; these components should be updated when their agents extend the union.
type LegacyRole = 'admin' | 'district-manager' | 'store-manager';

export function Forms({ currentRole = 'admin', orgId = '' }: FormsProps) {
  const legacyRole: LegacyRole =
    currentRole === 'trike-super-admin' ? 'admin' : (currentRole as LegacyRole);

  const [activeTab, setActiveTab] = useState('analytics');

  // Builder routing state — undefined formId means "create new"
  const [builderFormId, setBuilderFormId] = useState<string | undefined>(undefined);
  const [showBuilder, setShowBuilder] = useState(false);

  // Legacy form-detail routing (kept for backwards compat with FormDetail component)
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleNewForm = () => {
    setBuilderFormId(undefined);
    setShowBuilder(true);
    setActiveTab('builder');
  };

  const handleEditForm = (formId: string) => {
    setBuilderFormId(formId);
    setShowBuilder(true);
    setActiveTab('builder');
  };

  const handleBuilderBack = () => {
    setShowBuilder(false);
    setBuilderFormId(undefined);
    setActiveTab('library');
  };

  const handleFormSelect = (formId: string) => {
    setSelectedFormId(formId);
  };

  const handleBackToLibrary = () => {
    setSelectedFormId(null);
  };

  const handleEditFromDetail = () => {
    setSelectedFormId(null);
    setActiveTab('builder');
  };

  const handleViewSubmissions = (formId: string) => {
    setSelectedFormId(formId);
    setActiveTab('submissions');
  };

  // ─── Form Detail override (legacy) ─────────────────────────────────────────

  if (selectedFormId && activeTab === 'library') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-foreground mb-2">Forms Management</h1>
          <p className="text-muted-foreground">
            Create, assign, and track form submissions across your organization
          </p>
        </div>

        <FormDetail
          formId={selectedFormId}
          orgId={orgId}
          onBack={handleBackToLibrary}
          onEdit={handleEditFromDetail}
          currentRole={legacyRole}
        />
        <Footer />
      </div>
    );
  }

  // ─── Main layout ────────────────────────────────────────────────────────────

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
          <FormAnalytics orgId={orgId} currentRole={legacyRole} />
        </TabsContent>

        <TabsContent value="builder" className="space-y-6">
          <FormBuilder
            orgId={orgId}
            formId={builderFormId}
            currentRole={legacyRole}
            onSaveDraft={() => setActiveTab('library')}
            onPublished={() => setActiveTab('library')}
            onCancel={handleBuilderBack}
            onNavigateToAssignments={() => setActiveTab('assignments')}
          />
        </TabsContent>

        <TabsContent value="library" className="space-y-6">
          <FormLibrary
            orgId={orgId}
            currentRole={currentRole}
            onNewForm={handleNewForm}
            onEditForm={handleEditForm}
            onViewSubmissions={handleViewSubmissions}
          />
        </TabsContent>

        <TabsContent value="assignments" className="space-y-6">
          <FormAssignments orgId={orgId} currentRole={legacyRole} />
        </TabsContent>

        <TabsContent value="submissions" className="space-y-6">
          <FormSubmissions orgId={orgId} currentRole={legacyRole} />
        </TabsContent>
      </Tabs>
      <Footer />
    </div>
  );
}
