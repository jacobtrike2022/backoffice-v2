import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import { Footer } from './Footer';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Tag as TagIcon,
  MoreVertical,
  Globe,
  Eye
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  getTagHierarchy,
  deleteTag,
  type Tag
} from '../lib/crud/tags';
import { CreateTagModal } from './CreateTagModal';

interface TagsManagementProps {
  currentRole?: string;
  activeSystem?: string;
  onSystemChange?: (systemId: string) => void;
  onSystemsLoaded?: (systems: Tag[]) => void;
}

export function TagsManagement({ currentRole, activeSystem: externalActiveSystem, onSystemChange, onSystemsLoaded }: TagsManagementProps) {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Tag[]>([]);
  const [internalActiveSystem, setInternalActiveSystem] = useState<string>('');
  
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

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setSelectedTag(null); // Clear selected tag on close
    setPreselectedCategoryId(undefined);
    setPreselectedParentId(undefined);
  };

  const handleOpenModal = (categoryId?: string, parentId?: string) => {
    setSelectedTag(null); // Ensure we are in create mode
    setPreselectedCategoryId(categoryId);
    setPreselectedParentId(parentId);
    setShowCreateModal(true);
  };

  const handleEditTag = (tag: Tag) => {
    setSelectedTag(tag);
    setShowCreateModal(true);
  };

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      setLoading(true);
      const data = await getTagHierarchy();
      setCategories(data);
      
      const systems = data.filter(t => t.type === 'system-category');
      
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
    if (!confirm(`Delete tag "${tag.name}"?`)) return;
    
    try {
      await deleteTag(tag.id);
      toast.success('Tag deleted');
      loadTags();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete tag');
    }
  };

  const getActiveSystemData = () => {
    return categories.find(c => c.id === activeSystem);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const systems = categories.filter(t => t.type === 'system-category');
  const activeSystemData = getActiveSystemData();
  const categoryGroups = activeSystemData?.children || [];
  const isSharedSystem = activeSystemData?.system_category === 'shared';
  
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
              // Scroll to hierarchy view or expand all categories
              // This can be enhanced based on what "View All" should do
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <Eye className="w-4 h-4 mr-2" />
            View All
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
        {categoryGroups.map((category) => {
          const tags = category.children || [];
          const filteredTags = searchQuery
            ? tags.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
            : tags;

          return (
            <Card key={category.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TagIcon className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">{category.name}</CardTitle>
                  </div>
                  {!category.is_system_locked && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleEditTag(category)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteTag(category)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {filteredTags.length} tag{filteredTags.length !== 1 ? 's' : ''}
                </p>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col gap-3">
                {/* Tag Pills */}
                <div className="flex-1">
                  {filteredTags.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No tags yet
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {filteredTags.map((tag) => (
                        <div
                          key={tag.id}
                          onClick={() => handleEditTag(tag)}
                          className="group relative inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full transition-all cursor-pointer bg-gradient-to-r from-[#F74A05] to-[#FF733C] text-white hover:shadow-md hover:scale-[1.02]"
                          style={tag.color ? {
                            background: `linear-gradient(135deg, ${tag.color} 0%, ${tag.color}dd 100%)`,
                          } : {}}
                        >
                          <span className="text-sm">{tag.name}</span>
                          {!tag.is_system_locked && (
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

                {/* Add Tag Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center text-muted-foreground hover:text-foreground hover:bg-orange-50 hover:border-orange-200 dark:hover:bg-orange-950/20 border border-dashed border-muted-foreground/30"
                  onClick={() => handleOpenModal(activeSystem, category.id)}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Tag
                </Button>
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
          categories={categories}
          preselectedCategoryId={preselectedCategoryId}
          preselectedParentId={preselectedParentId}
          tagToEdit={selectedTag}
        />
      )}
      <Footer />
    </div>
  );
}
