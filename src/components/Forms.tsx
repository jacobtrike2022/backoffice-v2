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

  // In demo mode App.tsx sets viewingOrgId asynchronously from the URL, so orgId prop
  // may arrive as '' on the first render. Read demo_org_id directly from the URL as
  // an immediate fallback so child components never see an empty orgId.
  const urlDemoOrgId = new URLSearchParams(window.location.search).get('demo_org_id') || '';
  const effectiveOrgId = orgId || urlDemoOrgId;

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
          orgId={effectiveOrgId}
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
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex w-auto min-w-full sm:min-w-0">
            <TabsTrigger value="analytics" className="whitespace-nowrap">Analytics Dashboard</TabsTrigger>
            <TabsTrigger value="builder" className="whitespace-nowrap">Form Builder</TabsTrigger>
            <TabsTrigger value="library" className="whitespace-nowrap">Form Library</TabsTrigger>
            <TabsTrigger value="assignments" className="whitespace-nowrap">Form Assignments</TabsTrigger>
            <TabsTrigger value="submissions" className="whitespace-nowrap">Submissions</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="analytics" className="space-y-6">
          <FormAnalytics orgId={effectiveOrgId} currentRole={legacyRole} />
        </TabsContent>

        <TabsContent value="builder" className="space-y-6">
          <FormBuilder
            orgId={effectiveOrgId}
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
            orgId={effectiveOrgId}
            currentRole={currentRole}
            onNewForm={handleNewForm}
            onEditForm={handleEditForm}
            onViewSubmissions={handleViewSubmissions}
          />
        </TabsContent>

        <TabsContent value="assignments" className="space-y-6">
          <FormAssignments orgId={effectiveOrgId} currentRole={legacyRole} />
        </TabsContent>

        <TabsContent value="submissions" className="space-y-6">
          <FormSubmissions orgId={effectiveOrgId} currentRole={legacyRole} />
        </TabsContent>
      </Tabs>
      <Footer />
    </div>
  );
}
