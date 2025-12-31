import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Check, Plus, Tag as TagIcon, Folder, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { 
  getTagHierarchy, 
  buildTagHierarchyStructure,
  deleteTag,
  type Tag, 
  type SystemCategory,
  type TagHierarchy
} from '../lib/crud/tags';
import { CreateTagModal } from './CreateTagModal';

interface TagSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTags: string[]; // Storing tag names for now to maintain compatibility
  onTagsChange: (tags: string[], tagObjects?: Tag[]) => void; // Return both
  systemCategory?: SystemCategory; // e.g., 'content', 'people', 'units'
  allowManagement?: boolean; // Allow editing/deleting tags directly from the list
  canManageSystemTags?: boolean; // Allow editing/deleting system-locked tags (e.g. super admin)
  restrictToParentName?: string; // Only show tags under this specific Parent Tag name
}

export function TagSelectorDialog({ 
  isOpen, 
  onClose, 
  selectedTags, 
  onTagsChange,
  systemCategory = 'content',
  allowManagement = false,
  canManageSystemTags = false,
  restrictToParentName
}: TagSelectorDialogProps) {
  const [parentGroups, setParentGroups] = useState<TagHierarchy[number]['parents']>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tagToEdit, setTagToEdit] = useState<Tag | null>(null);
  const [localSelectedTags, setLocalSelectedTags] = useState<string[]>(selectedTags); // Local state for tag selection
  const [rawHierarchy, setRawHierarchy] = useState<Tag[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadTags();
      setLocalSelectedTags(selectedTags); // Reset local state when modal opens
    }
  }, [isOpen, systemCategory, selectedTags]);

  const loadTags = async () => {
    setIsLoading(true);
    try {
      const hierarchy = await getTagHierarchy(systemCategory);
      setRawHierarchy(hierarchy);

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

      const structured = buildTagHierarchyStructure(flatten(hierarchy));
      // Find the system category bucket for the requested system
      const matchingSystem = structured.find(entry => entry.systemCategory.system_category === systemCategory)
        || structured[0];

      setParentGroups(matchingSystem ? matchingSystem.parents : []);
    } catch (error: any) {
      console.error('Error loading tags:', error);
      toast.error('Failed to load tags');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTag = (tag: Tag) => {
    const tagName = tag.name;
    if (localSelectedTags.includes(tagName)) {
      // Remove from local selection only
      setLocalSelectedTags(localSelectedTags.filter(t => t !== tagName));
    } else {
      // Add to local selection only
      setLocalSelectedTags([...localSelectedTags, tagName]);
    }
  };

  const handleToggleSubcategory = (subcategory: Tag, children: Tag[]) => {
    if (!children || children.length === 0) return;
    const childNames = children.map(c => c.name);
    const allSelected = childNames.every(name => localSelectedTags.includes(name));

    if (allSelected) {
      setLocalSelectedTags(prev => prev.filter(name => !childNames.includes(name)));
    } else {
      setLocalSelectedTags(prev => {
        const next = new Set(prev);
        childNames.forEach(name => next.add(name));
        return Array.from(next);
      });
    }
  };

  const handleCreateSuccess = () => {
    loadTags();
    setTagToEdit(null);
    toast.success(tagToEdit ? 'Tag updated' : 'New tag created');
  };

  const handleEditTag = (e: React.MouseEvent, tag: Tag) => {
    e.stopPropagation();
    setTagToEdit(tag);
    setShowCreateModal(true);
  };

  const handleDeleteTag = async (e: React.MouseEvent, tag: Tag) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete tag "${tag.name}"?`)) return;
    
    try {
      await deleteTag(tag.id);
      toast.success('Tag deleted');
      loadTags();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete tag');
    }
  };

  const handleSave = () => {
    // Only call onTagsChange when user clicks "Apply Tags"
    const allTags = parentGroups.flatMap(parentGroup => {
      const tags = [parentGroup.tag, ...parentGroup.directChildren];
      parentGroup.subcategories.forEach(sc => {
        tags.push(sc.tag, ...sc.children);
      });
      return tags;
    });
    const selectedObjects = allTags.filter(t => localSelectedTags.includes(t.name));
    onTagsChange(localSelectedTags, selectedObjects);
    onClose();
  };

  // Prepare categories for display - flatten system categories if present
  // This ensures we show the actual tag categories (e.g. "Department") as headers
  // instead of the top-level system container (e.g. "UNITS")
  const displayCategories = React.useMemo(() => {
    const parents = restrictToParentName
      ? parentGroups.filter(pg => pg.tag.name.toLowerCase().trim() === restrictToParentName.toLowerCase().trim())
      : parentGroups;
    return parents;
  }, [parentGroups, restrictToParentName]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Tags</DialogTitle>
            <DialogDescription>
              Choose tags from the {systemCategory} system to organize your content.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-6">
            {/* Create New Tag Button */}
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowCreateModal(true)}
                className="text-primary hover:text-primary/80"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Tag
              </Button>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && displayCategories.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl bg-muted/30">
                <TagIcon className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
                <p className="text-muted-foreground font-medium">No tags found for this system</p>
                <p className="text-xs text-muted-foreground mt-1">Get started by creating a new tag</p>
                <Button 
                  variant="link" 
                  onClick={() => setShowCreateModal(true)}
                  className="mt-2"
                >
                  Create First Tag
                </Button>
              </div>
            )}

            {/* Tag Categories (Parents) */}
            {!isLoading && displayCategories.map((category) => {
              const parent = category.tag;
              const directChildren = category.directChildren || [];
              const subcategories = category.subcategories || [];

              const hasContent =
                directChildren.length > 0 ||
                subcategories.length > 0 ||
                subcategories.some(sc => (sc.children || []).length > 0);

              if (!hasContent && !restrictToParentName) return null;

              return (
                <div key={parent.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                      {parent.name}
                    </h3>
                  </div>
                  
                  {/* Direct children (no subcategory) */}
                  {directChildren.length > 0 && (
                    <div className="flex flex-wrap gap-2 pl-6">
                      {directChildren.map((tag) => {
                        const isSelected = localSelectedTags.includes(tag.name);
                        const tagColor = tag.color || '#F74A05'; // Default to brand orange

                        return (
                          <div
                            key={tag.id}
                            onClick={() => handleToggleTag(tag)}
                            className={`
                              group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer border
                              ${isSelected 
                                ? 'border-transparent text-white shadow-sm' 
                                : 'hover:opacity-80'
                              }
                            `}
                            style={isSelected ? {
                              background: `linear-gradient(135deg, ${tagColor} 0%, ${tagColor}dd 100%)`,
                            } : {
                              backgroundColor: `${tagColor}15`,
                              borderColor: `${tagColor}40`,
                              color: tagColor
                            }}
                          >
                            {isSelected && <Check className="h-3.5 w-3.5" />}
                            <span className="text-sm font-medium">{tag.name}</span>

                            {allowManagement && (!tag.is_system_locked || canManageSystemTags) && (
                              <div className="flex items-center gap-1 ml-1 pl-1 border-l border-current/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={(e) => handleEditTag(e, tag)}
                                  className="p-0.5 hover:bg-black/10 rounded"
                                >
                                  <Edit className="h-3 w-3" />
                                </button>
                                <button 
                                  onClick={(e) => handleDeleteTag(e, tag)}
                                  className="p-0.5 hover:bg-red-500/20 rounded text-current"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Subcategories */}
                  {subcategories.map(subcategory => {
                    const children = subcategory.children || [];
                    const allSelected = children.length > 0 && children.every(c => localSelectedTags.includes(c.name));
                    const partiallySelected = !allSelected && children.some(c => localSelectedTags.includes(c.name));

                    return (
                      <div key={subcategory.tag.id} className="space-y-2 pl-4">
                        <button
                          type="button"
                          onClick={() => handleToggleSubcategory(subcategory.tag, children)}
                          className="flex items-center gap-2 text-sm font-medium text-left"
                        >
                          <div className={`
                            w-5 h-5 rounded-full border flex items-center justify-center
                            ${allSelected ? 'bg-primary text-white border-primary' : 'border-muted-foreground/40'}
                            ${partiallySelected ? 'bg-primary/10 border-primary/60' : ''}
                          `}>
                            {(allSelected || partiallySelected) && <Check className="h-3 w-3" />}
                          </div>
                          <span>{subcategory.tag.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({children.length} tag{children.length !== 1 ? 's' : ''})
                          </span>
                        </button>

                        <div className="flex flex-wrap gap-2 pl-6">
                          {children.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No tags yet</span>
                          ) : (
                            children.map(tag => {
                              const isSelected = localSelectedTags.includes(tag.name);
                              const tagColor = tag.color || '#F74A05';

                              return (
                                <div
                                  key={tag.id}
                                  onClick={() => handleToggleTag(tag)}
                                  className={`
                                    group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer border
                                    ${isSelected 
                                      ? 'border-transparent text-white shadow-sm' 
                                      : 'hover:opacity-80'
                                    }
                                  `}
                                  style={isSelected ? {
                                    background: `linear-gradient(135deg, ${tagColor} 0%, ${tagColor}dd 100%)`,
                                  } : {
                                    backgroundColor: `${tagColor}15`,
                                    borderColor: `${tagColor}40`,
                                    color: tagColor
                                  }}
                                >
                                  {isSelected && <Check className="h-3.5 w-3.5" />}
                                  <span className="text-sm font-medium">{tag.name}</span>

                                  {allowManagement && (!tag.is_system_locked || canManageSystemTags) && (
                                    <div className="flex items-center gap-1 ml-1 pl-1 border-l border-current/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={(e) => handleEditTag(e, tag)}
                                        className="p-0.5 hover:bg-black/10 rounded"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </button>
                                      <button 
                                        onClick={(e) => handleDeleteTag(e, tag)}
                                        className="p-0.5 hover:bg-red-500/20 rounded text-current"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer with Selected Summary */}
          <div className="pt-4 border-t mt-auto flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {localSelectedTags.length} tag{localSelectedTags.length !== 1 ? 's' : ''} selected
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} className="hero-primary">
                Apply Tags
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Tag Modal - Reusing existing component */}
      {showCreateModal && (
        <CreateTagModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setTagToEdit(null);
          }}
          onSuccess={handleCreateSuccess}
          categories={rawHierarchy} // Pass the full hierarchy for parent selection
          tagToEdit={tagToEdit}
          // If restricted, we preselect the parent
          preselectedParentId={restrictToParentName 
            ? displayCategories.find(c => c.tag.name.toLowerCase().trim() === restrictToParentName.toLowerCase().trim())?.tag.id 
            : undefined}
        />
      )}
    </>
  );
}