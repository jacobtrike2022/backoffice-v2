import React, { useState } from 'react';
import { Button } from './ui/button';
import { Plus, Eye, Tag, Users, Settings } from 'lucide-react';
import { TagsManagement } from './TagsManagement';
import { Card, CardContent } from './ui/card';
import { KBSettings } from './KBSettings';

type OrganizationTab = 'tags' | 'roles' | 'settings';

interface OrganizationProps {
  currentRole?: string;
  onBackToDashboard?: () => void;
}

export function Organization({ currentRole, onBackToDashboard }: OrganizationProps) {
  const [activeTab, setActiveTab] = useState<OrganizationTab>('tags');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const tabs = [
    { id: 'tags' as OrganizationTab, label: 'Tags', icon: Tag },
    { id: 'roles' as OrganizationTab, label: 'Roles', icon: Users },
    { id: 'settings' as OrganizationTab, label: 'Settings', icon: Settings },
  ];

  const handleViewAll = () => {
    // Expand all categories in the TagsManagement component
    // This will be handled by scrolling to the hierarchy view
    setActiveTab('tags');
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      {/* Header - Match Dashboard Design */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl">Organization</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage organization-wide settings, tags, and roles
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            size="sm"
            className="hero-primary shadow-brand"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Tag
          </Button>
          <Button variant="outline" size="sm" onClick={handleViewAll}>
            <Eye className="w-4 h-4 mr-1.5" />
            View All
          </Button>
        </div>
      </div>

      {/* Navigation Tabs - Match Dashboard Design */}
      <div className="bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-full p-[3px]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex h-[calc(100%-1px)] items-center justify-center gap-1.5 rounded-full border border-transparent px-4 py-1 text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'tags' && (
          <TagsManagement 
            currentRole={currentRole}
            showCreateModal={showCreateModal}
            onCloseCreateModal={() => setShowCreateModal(false)}
          />
        )}
        
        {activeTab === 'roles' && (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-medium mb-2">Roles Management</h3>
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </CardContent>
          </Card>
        )}
        
        {activeTab === 'settings' && (
          <KBSettings />
        )}
      </div>
    </div>
  );
}