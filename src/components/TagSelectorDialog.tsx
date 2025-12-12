import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Check, Plus, X, Tag as TagIcon, Folder, AlertCircle, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { 
  getTagHierarchy, 
  getSystemCategories,
  deleteTag,
  type Tag, 
  type SystemCategory 
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
  const [categories, setCategories] = useState<Tag[]>([]); // These are the parent tags/categories
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tagToEdit, setTagToEdit] = useState<Tag | null>(null);
  const [localSelectedTags, setLocalSelectedTags] = useState<string[]>(selectedTags); // Local state for tag selection

  useEffect(() => {
    if (isOpen) {
      loadTags();
      setLocalSelectedTags(selectedTags); // Reset local state when modal opens
    }
  }, [isOpen, systemCategory, selectedTags]);

  const loadTags = async () => {
    setIsLoading(true);
    try {
      const [hierarchy, systemCats] = await Promise.all([
        getTagHierarchy(systemCategory),
        getSystemCategories()
      ]);
      
      // We need to construct a structure where:
      // 1. System Categories contain their Parent Tags (roots of hierarchy)
      // 2. Parent Tags contain their Child Tags
      
      // Create a clean map of system categories
      const combined = systemCats.map(sc => ({...sc, children: [] as Tag[]}));
      
      // Helper to find matching system category
      const findSystemCat = (tag: Tag) => {
        // 1. Try by parent_id if exists
        if (tag.parent_id) {
          const found = combined.find(sc => sc.id === tag.parent_id);
          if (found) return found;
        }
        // 2. Try by name matching the system_category string (e.g. "knowledge-base" -> "Knowledge Base")
        if (tag.system_category === systemCategory) {
          const normalizedSysCatName = systemCategory.replace(/-/g, ' ').toLowerCase();
          const found = combined.find(sc => sc.name.toLowerCase() === normalizedSysCatName);
          if (found) return found;
        }
        return null;
      };

      // Distribute hierarchy roots to their system categories
      hierarchy.forEach(rootTag => {
        // Special handling: If the root itself IS a system category tag (type='system-category'),
        // we want to extract its children (the actual Parent Tags) and put them into the
        // combined structure's matching bucket. This prevents "System Cat -> System Cat -> Content" nesting.
        if (rootTag.type === 'system-category') {
          const sysCat = findSystemCat(rootTag);
          // If matched (it should match itself), push its children
          if (sysCat && rootTag.children) {
            sysCat.children.push(...rootTag.children);
          }
          return;
        }

        // Original logic for loose roots (e.g. Parent Tags that are roots)
        const sysCat = findSystemCat(rootTag);
        if (sysCat) {
          sysCat.children!.push(rootTag);
        } else {
          // If no system category found (orphaned root?), 
          // we might want to add it to a "Other" bucket or just keep it if we can't place it.
          // For now, if we can't place it in a System Category container, 
          // CreateTagModal might struggle, but we should at least let it be displayed if possible.
          
          // IMPORTANT: If we are in restricted mode, we MUST ensure the target parent is available.
          // If 'rootTag' is the target parent (e.g. "KB Category"), we should include it even if orphaned.
          combined.push(rootTag);
        }
      });
      
      setCategories(combined);
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
    const allTags = categories.flatMap(c => c.children || []).flatMap(parent => {
      const tags = [parent];
      if (parent.children) {
        tags.push(...parent.children);
      }
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
    const result: Tag[] = [];
    
    // Helper to recursively find relevant tags if nested unexpectedly
    // But for now, rely on the flat structure 'combined' produced
    categories.forEach(cat => {
      if (cat.type === 'system-category') {
        if (cat.children) {
          result.push(...cat.children);
        }
      } else {
        result.push(cat);
      }
    });

    // Filter by restrictToParentName if provided
    if (restrictToParentName) {
      const normalizedName = restrictToParentName.toLowerCase().trim();
      return result.filter(cat => cat.name.toLowerCase().trim() === normalizedName);
    }

    return result;
  }, [categories, restrictToParentName]);

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
              // Get child tags for this category
              const childTags = category.children || [];
              
              // In restricted mode, we might want to show the category even if empty so users can add tags
              if (childTags.length === 0 && !restrictToParentName) return null; 

              return (
                <div key={category.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                      {category.name}
                    </h3>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 pl-6">
                    {childTags.map((tag) => {
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
          categories={categories} // Pass the current system categories
          tagToEdit={tagToEdit}
          // If restricted, we preselect the parent
          preselectedParentId={restrictToParentName 
            ? displayCategories.find(c => c.name.toLowerCase().trim() === restrictToParentName.toLowerCase().trim())?.id 
            : undefined}
        />
      )}
    </>
  );
}