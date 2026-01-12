import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Tag as TagIcon,
  Globe,
  Zap,
  ChevronDown,
  ChevronRight,
  FolderPlus
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  buildTagHierarchyStructure,
  getTagHierarchy,
  deleteTag,
  type Tag,
  type TagHierarchy,
  type TagType
} from '../lib/crud/tags';
import { CreateTagModal } from './CreateTagModal';
import { supabase, getCurrentUserOrgId } from '../lib/supabase';

interface TagsManagementProps {
  currentRole?: string;
  activeSystem?: string;
  onSystemChange?: (systemId: string) => void;
  onSystemsLoaded?: (systems: Tag[]) => void;
  onNavigateToTagSuggestions?: () => void;
}

export function TagsManagement({ currentRole, activeSystem: externalActiveSystem, onSystemChange, onSystemsLoaded, onNavigateToTagSuggestions }: TagsManagementProps) {
  const [loading, setLoading] = useState(true);
  const [rawCategories, setRawCategories] = useState<Tag[]>([]);
  const [hierarchy, setHierarchy] = useState<TagHierarchy[]>([]);
  const [internalActiveSystem, setInternalActiveSystem] = useState<string>('');
  const [collapsedSubcategories, setCollapsedSubcategories] = useState<Record<string, boolean>>({});
  const [pendingSuggestionsCount, setPendingSuggestionsCount] = useState(0);
  
  // Use external activeSystem if provided, otherwise use internal
  const activeSystem = externalActiveSystem !== undefined ? externalActiveSystem : internalActiveSystem;
  const setActiveSystem = (id: string) => {
    if (onSystemChange) {
      onSystemChange(id);
    } else {
      setInternalActiveSystem(id);
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [preselectedCategoryId, setPreselectedCategoryId] = useState<string | undefined>();
  const [preselectedParentId, setPreselectedParentId] = useState<string | undefined>();
  const [preselectedType, setPreselectedType] = useState<TagType | undefined>();

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setSelectedTag(null); // Clear selected tag on close
    setPreselectedCategoryId(undefined);
    setPreselectedParentId(undefined);
    setPreselectedType(undefined);
  };

  const handleOpenModal = (categoryId?: string, parentId?: string, type?: TagType) => {
    setSelectedTag(null); // Ensure we are in create mode
    setPreselectedCategoryId(categoryId);
    setPreselectedParentId(parentId);
    setPreselectedType(type);
    setShowCreateModal(true);
  };

  const handleEditTag = (tag: Tag) => {
    setSelectedTag(tag);
    setShowCreateModal(true);
  };

  useEffect(() => {
    loadTags();
    fetchPendingSuggestionsCount();
  }, []);

  const fetchPendingSuggestionsCount = async () => {
    try {
      const orgId = await getCurrentUserOrgId();
      if (!orgId) return;

      const { count, error } = await supabase
        .from('ai_tag_suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'pending');

      if (error) throw error;
      setPendingSuggestionsCount(count || 0);
    } catch (error) {
      console.error('Error fetching pending suggestions count:', error);
    }
  };

  const loadTags = async () => {
    try {
      setLoading(true);
      const data = await getTagHierarchy();
      setRawCategories(data);

      const flatten = (nodes: Tag[]): Tag[] => {
        const result: Tag[] = [];
        nodes.forEach(n => {
          result.push({ ...n, children: undefined });
          if (n.children && n.children.length > 0) {
            result.push(...flatten(n.children));
          }
        });
        return result;
      };

      const structured = buildTagHierarchyStructure(flatten(data));
      setHierarchy(structured);
      
      const systems = structured.map(s => s.systemCategory);
      
      // Notify parent of systems data
      if (onSystemsLoaded) {
        onSystemsLoaded(systems);
      }
      
      // Set first system as active if no external system is set
      const firstSystem = systems[0];
      if (firstSystem && !activeSystem) {
        setActiveSystem(firstSystem.id);
      }
    } catch (error: any) {
      console.error('Error loading tags:', error);
      toast.error('Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTag = async (tag: Tag) => {
    const isSystemTag = tag.is_system_locked;
    const warningMessage = isSystemTag
      ? `⚠️ WARNING: "${tag.name}" is a system-wide tag. Deleting it may affect all organizations. Are you sure?`
      : `Delete tag "${tag.name}"?`;

    if (!confirm(warningMessage)) return;

    try {
      // Pass bypass flag for Super Admin deleting system-locked tags
      await deleteTag(tag.id, canEditSystemTags && isSystemTag);
      toast.success('Tag deleted');
      loadTags();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete tag');
    }
  };

  const getActiveSystemData = () => {
    return hierarchy.find(c => c.systemCategory.id === activeSystem);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const systems = hierarchy.map(h => h.systemCategory);
  const activeSystemData = getActiveSystemData();
  const categoryGroups = activeSystemData?.parents || [];
  const isSharedSystem = activeSystemData?.systemCategory.system_category === 'shared';

  // Trike Super Admin can edit system-locked tags
  const isTrikeSuperAdmin = currentRole === 'trike-super-admin';
  const canEditSystemTags = isTrikeSuperAdmin;

  const toggleSubcategory = (id: string) => {
    setCollapsedSubcategories(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  return (
    <div className="space-y-6">
      {/* Action Buttons and Search (rendered below secondary tabs in Organization.tsx) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white shadow-sm hover:opacity-90 border-0"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Tag
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (onNavigateToTagSuggestions) {
                onNavigateToTagSuggestions();
              }
            }}
            className={pendingSuggestionsCount > 0
              ? "bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white border-0 hover:opacity-90"
              : ""
            }
          >
            <Zap className="w-4 h-4 mr-2" />
            Tag Suggestions
            {pendingSuggestionsCount > 0 && (
              <span className="ml-2 bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
                {pendingSuggestionsCount}
              </span>
            )}
          </Button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>


      {/* Shared System Info Banner */}
      {isSharedSystem && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Cross-System Tags
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                These tags can be used across Content, Units, People, and Forms. 
                For example, tag a store with "Texas" and content with "Texas" to auto-assign state-specific training.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Category Cards (Bento Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categoryGroups.map((categoryGroup) => {
          const parentTag = categoryGroup.tag;
          const subcategories = categoryGroup.subcategories || [];
          const directChildren = categoryGroup.directChildren || [];

          const matchesQuery = (name: string) =>
            name.toLowerCase().includes(searchQuery.toLowerCase());

          const filteredDirectChildren = searchQuery
            ? directChildren.filter(t => matchesQuery(t.name))
            : directChildren;

          const filteredSubcategories = subcategories
            .map(sc => {
              const children = sc.children || [];
              if (!searchQuery) return { ...sc, children };

              const matchesSubcategory = matchesQuery(sc.tag.name);
              const filtered = children.filter(c => matchesQuery(c.name));
              return {
                ...sc,
                children: matchesSubcategory ? children : filtered
              };
            })
            .filter(sc => searchQuery ? (sc.children?.length ?? 0) > 0 || matchesQuery(sc.tag.name) : true);

          const totalChildrenCount =
            (categoryGroup.directChildren?.length || 0) +
            subcategories.reduce((sum, sc) => sum + (sc.children?.length || 0), 0);

          return (
            <Card key={parentTag.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TagIcon className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">{parentTag.name}</CardTitle>
                  </div>
                  {(!parentTag.is_system_locked || canEditSystemTags) && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleEditTag(parentTag)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteTag(parentTag)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {subcategories.length} subcategor{subcategories.length === 1 ? 'y' : 'ies'}, {totalChildrenCount} tag{totalChildrenCount !== 1 ? 's' : ''}
                </p>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col gap-3">
                <div className="flex-1 space-y-3">
                  {/* Direct children (no subcategory) */}
                  {filteredDirectChildren.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {filteredDirectChildren.map((tag) => (
                        <div
                          key={tag.id}
                          onClick={() => handleEditTag(tag)}
                          className="group relative inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full transition-all cursor-pointer bg-gradient-to-r from-[#F74A05] to-[#FF733C] text-white hover:shadow-md hover:scale-[1.02]"
                          style={tag.color ? {
                            background: `linear-gradient(135deg, ${tag.color} 0%, ${tag.color}dd 100%)`,
                          } : {}}
                        >
                          <span className="text-sm">{tag.name}</span>
                          {(!tag.is_system_locked || canEditSystemTags) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteTag(tag);
                              }}
                              className="ml-0.5 p-0.5 hover:bg-black/20 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <X className="h-3.5 w-3.5 text-white" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Subcategory groups */}
                  {filteredSubcategories.map(({ tag: subcategory, children }) => {
                    const isCollapsed = collapsedSubcategories[subcategory.id];
                    const childCount = children?.length || 0;

                    return (
                      <div key={subcategory.id} className="border border-muted-foreground/10 rounded-lg">
                        <div className="flex items-center justify-between px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleSubcategory(subcategory.id)}
                            className="flex items-center gap-2 text-sm font-medium"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span>{subcategory.name}</span>
                            <span className="text-xs text-muted-foreground">({childCount} tag{childCount !== 1 ? 's' : ''})</span>
                          </button>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-muted-foreground hover:text-foreground"
                              onClick={() => handleOpenModal(activeSystem, subcategory.id, 'child')}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Tag
                            </Button>
                            {(!subcategory.is_system_locked || canEditSystemTags) && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleEditTag(subcategory)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteTag(subcategory)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {!isCollapsed && (
                          <div className="px-3 pb-3">
                            {childCount === 0 ? (
                              <p className="text-xs text-muted-foreground py-2">No tags yet</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {children?.map((tag) => (
                                  <div
                                    key={tag.id}
                                    onClick={() => handleEditTag(tag)}
                                    className="group relative inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full transition-all cursor-pointer bg-gradient-to-r from-[#F74A05] to-[#FF733C] text-white hover:shadow-md hover:scale-[1.02]"
                                    style={tag.color ? {
                                      background: `linear-gradient(135deg, ${tag.color} 0%, ${tag.color}dd 100%)`,
                                    } : {}}
                                  >
                                    <span className="text-sm">{tag.name}</span>
                                    {(!tag.is_system_locked || canEditSystemTags) && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleDeleteTag(tag);
                                        }}
                                        className="ml-0.5 p-0.5 hover:bg-black/20 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                      >
                                        <X className="h-3.5 w-3.5 text-white" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center text-muted-foreground hover:text-foreground hover:bg-orange-50 hover:border-orange-200 dark:hover:bg-orange-950/20 border border-dashed border-muted-foreground/30"
                    onClick={() => handleOpenModal(activeSystem, parentTag.id, 'child')}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Tag
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => handleOpenModal(activeSystem, parentTag.id, 'subcategory')}
                  >
                    <FolderPlus className="h-4 w-4 mr-1.5" />
                    Add Subcategory
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Add Category Card */}
        <Card className="flex flex-col items-center justify-center p-8 border-dashed border-2 hover:border-orange-200 hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors cursor-pointer"
          onClick={() => handleOpenModal(activeSystem)}
        >
          <Plus className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Add Category</p>
          <p className="text-xs text-muted-foreground">Create a new tag category</p>
        </Card>
      </div>

      {/* Create/Edit Tag Modal */}
      {showCreateModal && (
        <CreateTagModal
          key={selectedTag?.id || 'create-new-tag'}
          isOpen={showCreateModal}
          onClose={handleCloseModal}
          onSuccess={loadTags}
          categories={rawCategories}
          preselectedCategoryId={preselectedCategoryId}
          preselectedParentId={preselectedParentId}
          defaultType={preselectedType}
          tagToEdit={selectedTag}
          canEditSystemTags={canEditSystemTags}
        />
      )}
    </div>
  );
}
