import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { X, Tag as TagIcon, Folder, FolderOpen, AlertCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { createTag, updateTag, type Tag } from '../lib/crud/tags';

interface CreateTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Tag[];
  preselectedCategoryId?: string;
  preselectedParentId?: string;
  tagToEdit?: Tag | null;
}

export function CreateTagModal({
  isOpen,
  onClose,
  onSuccess,
  categories,
  preselectedCategoryId,
  preselectedParentId,
  tagToEdit,
}: CreateTagModalProps) {
  const isEditing = !!tagToEdit;
  
  const [tagType, setTagType] = useState<'parent' | 'child'>(
    tagToEdit ? (tagToEdit.type as 'parent' | 'child') : 
    preselectedParentId ? 'child' : 'parent'
  );
  
  const [selectedCategoryId, setSelectedCategoryId] = useState(preselectedCategoryId || '');
  const [selectedParentId, setSelectedParentId] = useState(preselectedParentId || '');
  const [tagName, setTagName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#F74A05');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form when tagToEdit changes
  useEffect(() => {
    if (tagToEdit) {
      setTagName(tagToEdit.name);
      setDescription(tagToEdit.description || '');
      setColor(tagToEdit.color || '#F74A05');
      setTagType(tagToEdit.type as 'parent' | 'child');

      if (tagToEdit.type === 'parent') {
        // If editing a parent, we need to find its system category ID if possible, 
        // but parent tags are children of system categories.
        // tagToEdit.parent_id should point to the system category.
        setSelectedCategoryId(tagToEdit.parent_id || '');
      } else if (tagToEdit.type === 'child') {
        setSelectedParentId(tagToEdit.parent_id || '');
        
        // We also need to find the category of that parent
        const parentTag = categories
          .flatMap(c => c.children || [])
          .find(p => p.id === tagToEdit.parent_id);
          
        if (parentTag && parentTag.parent_id) {
          setSelectedCategoryId(parentTag.parent_id);
        }
      }
    } else {
      // Reset defaults if not editing
      setTagName('');
      setDescription('');
      setColor('#F74A05');
      setTagType(preselectedParentId ? 'child' : 'parent');
      setSelectedCategoryId(preselectedCategoryId || '');
      setSelectedParentId(preselectedParentId || '');
    }
  }, [tagToEdit, preselectedCategoryId, preselectedParentId, categories, isOpen]);

  const predefinedColors = [
    '#F74A05', // Trike Orange
    '#FF733C', // Light Orange
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#6B7280', // Gray
    '#14B8A6', // Teal
  ];

  const getParentTagsForCategory = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.children || [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tagName.trim()) {
      toast.error('Please enter a tag name');
      return;
    }

    if (tagType === 'parent' && !selectedCategoryId) {
      toast.error('Please select a category');
      return;
    }

    if (tagType === 'child' && !selectedParentId) {
      toast.error('Please select a parent tag');
      return;
    }

    try {
      setIsSubmitting(true);

      if (isEditing && tagToEdit) {
        // UPDATE EXISTING TAG
        await updateTag(tagToEdit.id, {
          name: tagName.trim(),
          description: description.trim() || undefined,
          color: color,
        });
        toast.success('Tag updated successfully');
      } else {
        // CREATE NEW TAG
        const tagData: any = {
          name: tagName.trim(),
          description: description.trim() || undefined,
          color: color,
          type: tagType,
        };

        if (tagType === 'parent') {
          const category = categories.find(c => c.id === selectedCategoryId);
          tagData.parent_id = selectedCategoryId;
          tagData.system_category = category?.system_category;
        } else {
          const parentTag = categories
            .flatMap(c => c.children || [])
            .find(p => p.id === selectedParentId);
          tagData.parent_id = selectedParentId;
          tagData.system_category = parentTag?.system_category;
        }

        await createTag(tagData);
        toast.success(`${tagType === 'parent' ? 'Parent' : 'Child'} tag created successfully`);
      }
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving tag:', error);
      toast.error(error.message || 'Failed to save tag');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[100] animate-in fade-in duration-200"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                <TagIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  {isEditing ? 'Edit Tag' : 'Create New Tag'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isEditing ? 'Update tag details and properties' : 'Add a custom tag to organize your content'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {/* Tag Type Selection - HIDDEN IF EDITING */}
            {!isEditing && (
              <div className="space-y-2">
                <Label>Tag Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTagType('parent')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      tagType === 'parent'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                        : 'border-border hover:border-orange-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Folder className="h-5 w-5 text-orange-500" />
                      <span className="font-medium">Parent Tag</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Creates a group that can contain child tags
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTagType('child')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      tagType === 'child'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                        : 'border-border hover:border-orange-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <TagIcon className="h-5 w-5 text-orange-500" />
                      <span className="font-medium">Child Tag</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Creates a tag within an existing parent
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* Category Selection (for Parent Tags) */}
            {tagType === 'parent' && (
              <div className="space-y-2">
                <Label htmlFor="category">
                  Select Category <span className="text-destructive">*</span>
                </Label>
                <select
                  id="category"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground"
                  required
                  disabled={isEditing}
                >
                  <option value="">Choose a category...</option>
                  {categories
                    .filter(c => c.type === 'system-category')
                    .map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {isEditing 
                    ? 'Parent category cannot be moved after creation' 
                    : 'Parent tags are organized under system categories'}
                </p>
              </div>
            )}

            {/* Parent Tag Selection (for Child Tags) */}
            {tagType === 'child' && (
              <div className="space-y-2">
                <Label htmlFor="parent">
                  Select Parent Tag <span className="text-destructive">*</span>
                </Label>
                
                {/* Category selector first */}
                <select
                  value={selectedCategoryId}
                  onChange={(e) => {
                    setSelectedCategoryId(e.target.value);
                    setSelectedParentId('');
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground mb-3"
                  disabled={isEditing}
                >
                  <option value="">Choose a category first...</option>
                  {categories
                    .filter(c => c.type === 'system-category')
                    .map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>

                {selectedCategoryId && (
                  <select
                    id="parent"
                    value={selectedParentId}
                    onChange={(e) => setSelectedParentId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground"
                    required
                    disabled={isEditing}
                  >
                    <option value="">Choose a parent tag...</option>
                    {getParentTagsForCategory(selectedCategoryId).map(parent => (
                      <option key={parent.id} value={parent.id}>
                        {parent.name}
                      </option>
                    ))}
                  </select>
                )}

                {selectedCategoryId && getParentTagsForCategory(selectedCategoryId).length === 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                      No parent tags in this category yet. Create a parent tag first.
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  {isEditing
                    ? 'Parent relationship cannot be changed after creation'
                    : 'Child tags are specific labels within a parent group'}
                </p>
              </div>
            )}

            {/* Tag Name */}
            <div className="space-y-2">
              <Label htmlFor="tagName">
                Tag Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="tagName"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="e.g., Safety Training, Product Knowledge"
                required
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                {tagName.length}/50 characters
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this tag is used for..."
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                {description.length}/200 characters
              </p>
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <Label>Tag Color</Label>
              <div className="flex items-center gap-3">
                <div className="flex flex-wrap gap-2">
                  {predefinedColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        color === c
                          ? 'border-foreground scale-110'
                          : 'border-border hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-12 h-10 cursor-pointer"
                  />
                  <span className="text-sm text-muted-foreground font-mono">
                    {color}
                  </span>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 rounded-lg border border-border bg-muted/50">
              <Label className="mb-3 block">Preview</Label>
              <div className="flex items-center gap-2">
                {tagType === 'parent' ? (
                  <FolderOpen className="h-4 w-4" style={{ color }} />
                ) : (
                  <TagIcon className="h-4 w-4" style={{ color }} />
                )}
                <Badge
                  variant="secondary"
                  className="font-medium"
                  style={{
                    backgroundColor: `${color}20`,
                    color: color,
                    borderColor: color,
                  }}
                >
                  {tagName || 'Tag Name'}
                </Badge>
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting || !tagName.trim()}
              className="hero-primary shadow-brand"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Tag' : 'Create Tag'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
