import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Plus, Eye, Tag, Users, Building2, Edit, Trash2, Globe, FileText } from 'lucide-react';
import { TagsManagement } from './TagsManagement';
import { RolesManagement } from './RolesManagement';
import { RoleDetailPage } from './RoleDetailPage';
import { SourcesManagement } from './SourcesManagement';
import { DocumentIntelligenceEditor } from './DocumentIntelligenceEditor';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner@2.0.3';
import { supabase, getCurrentUserOrgId } from '../lib/supabase';
import type { Tag as TagType } from '../lib/crud/tags';
import { Footer } from './Footer';
type OrganizationTab = 'tags' | 'roles' | 'districts' | 'sources';

interface OrganizationProps {
  currentRole?: string;
  role?: string;
  onBackToDashboard?: () => void;
  onNavigate?: (view: string) => void;
}

export function Organization({ currentRole, role, onBackToDashboard, onNavigate }: OrganizationProps) {
  const [activeTab, setActiveTab] = useState<OrganizationTab>('tags');
  const [tagSystems, setTagSystems] = useState<TagType[]>([]);
  const [activeTagSystem, setActiveTagSystem] = useState<string>('');

  // Districts state
  const [districts, setDistricts] = useState<any[]>([]);
  const [showAddDistrictDialog, setShowAddDistrictDialog] = useState(false);
  const [showEditDistrictDialog, setShowEditDistrictDialog] = useState(false);
  const [showAddStoreDialog, setShowAddStoreDialog] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState<any>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');
  const [draggedStore, setDraggedStore] = useState<{ storeId: string; fromDistrictId: string } | null>(null);
  const [newDistrictName, setNewDistrictName] = useState('');
  const [editDistrictName, setEditDistrictName] = useState('');
  const [unassignedStores, setUnassignedStores] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [editingSourceFileId, setEditingSourceFileId] = useState<string | null>(null);
  const [highlightChunkId, setHighlightChunkId] = useState<string | null>(null);

  const tabs = [
    { id: 'tags' as OrganizationTab, label: 'Tags', icon: Tag },
    { id: 'roles' as OrganizationTab, label: 'Roles', icon: Users },
    { id: 'districts' as OrganizationTab, label: 'Districts', icon: Building2 },
    { id: 'sources' as OrganizationTab, label: 'Sources', icon: FileText },
  ];


  // Handle URL parameters for deep linking to source files
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sourceFileIdParam = urlParams.get('sourceFileId');
    const chunkIdParam = urlParams.get('chunkId');
    const tabParam = urlParams.get('tab');

    // If navigating to sources tab with a specific file
    if (tabParam === 'sources') {
      setActiveTab('sources');
      if (sourceFileIdParam) {
        setEditingSourceFileId(sourceFileIdParam);
        if (chunkIdParam) {
          setHighlightChunkId(chunkIdParam);
        }
        // Clean up URL params after navigation
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  // Fetch districts when tab is active
  useEffect(() => {
    if (activeTab === 'districts') {
      fetchDistricts();
      fetchUnassignedStores();
    }
  }, [activeTab]);

  const fetchDistricts = async () => {
    try {
      const orgId = await getCurrentUserOrgId();
      if (!orgId) return;
      
      const { data: districtsData, error } = await supabase
        .from('districts')
        .select(`
          id,
          name,
          stores (
            id,
            name,
            address,
            city,
            state
          )
        `)
        .eq('organization_id', orgId)
        .order('name');

      if (error) throw error;
      
      setDistricts(districtsData || []);
    } catch (error) {
      console.error('Error fetching districts:', error);
      toast.error('Failed to load districts');
    }
  };

  const fetchUnassignedStores = async () => {
    try {
      const orgId = await getCurrentUserOrgId();
      if (!orgId) return;
      
      const { data: storesData, error } = await supabase
        .from('stores')
        .select('id, name, address, city, state')
        .eq('organization_id', orgId)
        .is('district_id', null)
        .order('name');

      if (error) throw error;
      
      setUnassignedStores(storesData || []);
    } catch (error) {
      console.error('Error fetching unassigned stores:', error);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, storeId: string, districtId: string) => {
    setDraggedStore({ storeId, fromDistrictId: districtId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, toDistrictId: string) => {
    e.preventDefault();
    
    if (!draggedStore) return;
    
    const { storeId, fromDistrictId } = draggedStore;
    
    if (fromDistrictId === toDistrictId) {
      setDraggedStore(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('stores')
        .update({ district_id: toDistrictId })
        .eq('id', storeId);

      if (error) throw error;

      toast.success('Store moved successfully');
      fetchDistricts();
      fetchUnassignedStores();
    } catch (error) {
      console.error('Error moving store:', error);
      toast.error('Failed to move store');
    }

    setDraggedStore(null);
  };

  const handleDeleteDistrict = async (districtId: string) => {
    if (!confirm('Are you sure you want to delete this district? Stores will be unassigned.')) {
      return;
    }

    try {
      // Unassign stores first
      await supabase
        .from('stores')
        .update({ district_id: null })
        .eq('district_id', districtId);

      // Delete district
      const { error } = await supabase
        .from('districts')
        .delete()
        .eq('id', districtId);

      if (error) throw error;

      toast.success('District deleted successfully');
      fetchDistricts();
      fetchUnassignedStores();
    } catch (error) {
      console.error('Error deleting district:', error);
      toast.error('Failed to delete district');
    }
  };

  const handleCreateDistrict = async () => {
    if (!newDistrictName.trim()) {
      toast.error('District name is required');
      return;
    }

    try {
      const orgId = await getCurrentUserOrgId();
      if (!orgId) throw new Error('Organization not found');
      
      const { error } = await supabase
        .from('districts')
        .insert({
          name: newDistrictName.trim(),
          organization_id: orgId
        });

      if (error) throw error;

      toast.success('District created successfully');
      setShowAddDistrictDialog(false);
      setNewDistrictName('');
      fetchDistricts();
    } catch (error: any) {
      console.error('Error creating district:', error);
      toast.error('Failed to create district', { description: error.message });
    }
  };

  const handleUpdateDistrict = async () => {
    if (!editDistrictName.trim()) {
      toast.error('District name is required');
      return;
    }

    if (!editingDistrict) return;

    try {
      const { error } = await supabase
        .from('districts')
        .update({ name: editDistrictName.trim() })
        .eq('id', editingDistrict.id);

      if (error) throw error;

      toast.success('District updated successfully');
      setShowEditDistrictDialog(false);
      setEditingDistrict(null);
      setEditDistrictName('');
      fetchDistricts();
    } catch (error: any) {
      console.error('Error updating district:', error);
      toast.error('Failed to update district', { description: error.message });
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header - Match Dashboard Design */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl">Organization</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage organization-wide settings, tags, and roles
          </p>
        </div>
      </div>

      {/* Navigation Tabs - Match Dashboard Design */}
      <div className="flex flex-col gap-3">
        {/* Main Tabs Row */}
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

        {/* Secondary Tags Tabs (separate row, nested below main tabs) */}
        {activeTab === 'tags' && tagSystems.length > 0 && (
          <div className="bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-full p-[3px]">
            {tagSystems.map((system) => {
              const isShared = system.system_category === 'shared';
              return (
                <button
                  key={system.id}
                  onClick={() => setActiveTagSystem(system.id)}
                  className={`inline-flex h-[calc(100%-1px)] items-center justify-center gap-1.5 rounded-full border border-transparent px-4 py-1 text-sm font-medium whitespace-nowrap transition-all ${
                    activeTagSystem === system.id
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {isShared && <Globe className="h-3.5 w-3.5" />}
                  {system.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
      

      {/* Tab Content */}
      <div>
        {activeTab === 'tags' && (
          <TagsManagement
            currentRole={currentRole || role}
            activeSystem={activeTagSystem}
            onSystemChange={setActiveTagSystem}
            onSystemsLoaded={(systems) => {
              setTagSystems(systems);
              // Set first system as active if none is set
              if (!activeTagSystem && systems.length > 0) {
                setActiveTagSystem(systems[0].id);
              }
            }}
            onNavigateToTagSuggestions={() => {
              if (onNavigate) {
                onNavigate('ai-review');
              }
            }}
          />
        )}
        
        {activeTab === 'roles' && (
          selectedRoleId ? (
            <RoleDetailPage
              roleId={selectedRoleId}
              onBack={() => setSelectedRoleId(null)}
            />
          ) : (
            <RolesManagement 
              onRoleClick={(roleId) => setSelectedRoleId(roleId)}
              onCreateNew={() => setSelectedRoleId('new')}
            />
          )
        )}
        
        {activeTab === 'districts' && (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold">Districts</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Organize stores by district or region
                    </p>
                  </div>
                  <Button
                    className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
                    onClick={() => setShowAddDistrictDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add District
                  </Button>
                </div>

                {/* Districts List */}
                <div className="space-y-4">
                  {districts.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
                      <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-semibold mb-2">No districts yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create districts to organize your stores by region or area
                      </p>
                      <Button
                        className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
                        onClick={() => setShowAddDistrictDialog(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add First District
                      </Button>
                    </div>
                  ) : (
                    districts.map((district) => (
                      <div
                        key={district.id}
                        className="border-2 border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, district.id)}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-[#F64A05] to-[#FF733C] flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{district.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {district.stores?.length || 0} store{district.stores?.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingDistrict(district);
                                setEditDistrictName(district.name);
                                setShowEditDistrictDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDistrict(district.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </div>

                        {/* Store pills (drag-and-drop) */}
                        <div className="flex flex-wrap gap-2">
                          {district.stores && district.stores.length > 0 ? (
                            district.stores.map((store: any) => (
                              <div
                                key={store.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, store.id, district.id)}
                                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white text-sm font-medium cursor-move hover:opacity-90 transition-opacity"
                              >
                                {store.name}
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">No stores assigned</p>
                          )}

                          {/* Add Store button */}
                          <button
                            onClick={() => {
                              setSelectedDistrictId(district.id);
                              setShowAddStoreDialog(true);
                            }}
                            className="px-3 py-1.5 rounded-full border-2 border-dashed border-primary/50 text-primary text-sm font-medium hover:bg-primary/10 transition-colors flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            Add Store
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'sources' && (
          editingSourceFileId ? (
            <DocumentIntelligenceEditor
              sourceFileId={editingSourceFileId}
              onBack={() => {
                setEditingSourceFileId(null);
                setHighlightChunkId(null);
              }}
              onViewRole={(roleId) => {
                setActiveTab('roles');
                setSelectedRoleId(roleId);
              }}
              onCreateRole={(prefillData) => {
                // Store prefill data and navigate to role creation
                setActiveTab('roles');
                setSelectedRoleId('new');
                // TODO: Pass prefill data to RoleDetailPage
              }}
              highlightChunkId={highlightChunkId}
            />
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Source Files</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload and manage source documents for content generation
                </p>
              </div>
              <SourcesManagement
                onOpenEditor={(sourceFileId) => setEditingSourceFileId(sourceFileId)}
              />
            </div>
          )
        )}
      </div>

      {/* Add District Dialog */}
      <Dialog open={showAddDistrictDialog} onOpenChange={setShowAddDistrictDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add District</DialogTitle>
            <DialogDescription>
              Create a new district to organize your stores
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="districtName">District Name</Label>
              <Input
                id="districtName"
                value={newDistrictName}
                onChange={(e) => setNewDistrictName(e.target.value)}
                placeholder="e.g., North Region, Texas District"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newDistrictName.trim()) {
                    handleCreateDistrict();
                  }
                }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setShowAddDistrictDialog(false);
              setNewDistrictName('');
            }}>
              Cancel
            </Button>
            <Button 
              className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
              onClick={handleCreateDistrict}
            >
              Create District
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit District Dialog */}
      <Dialog open={showEditDistrictDialog} onOpenChange={setShowEditDistrictDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit District</DialogTitle>
            <DialogDescription>
              Update the district name
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editDistrictName">District Name</Label>
              <Input
                id="editDistrictName"
                value={editDistrictName}
                onChange={(e) => setEditDistrictName(e.target.value)}
                placeholder="District name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editDistrictName.trim()) {
                    handleUpdateDistrict();
                  }
                }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setShowEditDistrictDialog(false);
              setEditingDistrict(null);
              setEditDistrictName('');
            }}>
              Cancel
            </Button>
            <Button 
              className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
              onClick={handleUpdateDistrict}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Store to District Dialog */}
      <Dialog open={showAddStoreDialog} onOpenChange={setShowAddStoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Store to District</DialogTitle>
            <DialogDescription>
              Select a store to add to this district
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {unassignedStores.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No unassigned stores available
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {unassignedStores.map((store) => (
                  <button
                    key={store.id}
                    onClick={async () => {
                      try {
                        const { error } = await supabase
                          .from('stores')
                          .update({ district_id: selectedDistrictId })
                          .eq('id', store.id);

                        if (error) throw error;

                        toast.success('Store added to district');
                        setShowAddStoreDialog(false);
                        fetchDistricts();
                        fetchUnassignedStores();
                      } catch (error) {
                        console.error('Error adding store:', error);
                        toast.error('Failed to add store');
                      }
                    }}
                    className="w-full p-3 border-2 border-border rounded-lg hover:border-primary hover:bg-accent transition-colors text-left"
                  >
                    <p className="font-medium">{store.name}</p>
                    {store.address && (
                      <p className="text-sm text-muted-foreground">
                        {store.address}{store.city ? `, ${store.city}` : ''}{store.state ? `, ${store.state}` : ''}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setShowAddStoreDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
}