import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { X, Tag as TagIcon, Folder, FolderOpen, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { createTag, updateTag, type Tag, type TagType } from '../lib/crud/tags';

const RECENT_COLORS_KEY = 'trike-tag-recent-colors';
const MAX_RECENT_COLORS = 10;

function getRecentColors(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_COLORS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentColor(color: string, predefinedColors: string[]): void {
  // Don't save predefined colors to recent colors
  if (predefinedColors.includes(color.toUpperCase()) || predefinedColors.includes(color.toLowerCase())) {
    return;
  }

  const normalizedColor = color.toUpperCase();
  const recent = getRecentColors();

  // Remove if already exists (will re-add at front)
  const filtered = recent.filter(c => c.toUpperCase() !== normalizedColor);

  // Add to front, limit to max
  const updated = [normalizedColor, ...filtered].slice(0, MAX_RECENT_COLORS);

  try {
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(updated));
  } catch {
    // localStorage might be full or unavailable
  }
}

function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

interface CreateTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Tag[];
  preselectedCategoryId?: string;
  preselectedParentId?: string;
  defaultType?: TagType;
  tagToEdit?: Tag | null;
  initialTagName?: string;
  initialDescription?: string;
  canEditSystemTags?: boolean; // Trike Super Admin can edit system-locked tags
}

export function CreateTagModal({
  isOpen,
  onClose,
  onSuccess,
  categories,
  preselectedCategoryId,
  preselectedParentId,
  defaultType,
  tagToEdit,
  initialTagName,
  initialDescription,
  canEditSystemTags = false,
}: CreateTagModalProps) {
  const isEditing = !!tagToEdit;
  
  const [tagType, setTagType] = useState<TagType>(
    tagToEdit
      ? (tagToEdit.type as TagType)
      : defaultType && defaultType !== 'system-category'
        ? defaultType
        : preselectedParentId
          ? 'child'
          : 'parent'
  );
  
  const [selectedCategoryId, setSelectedCategoryId] = useState(preselectedCategoryId || '');
  const [selectedParentId, setSelectedParentId] = useState(preselectedParentId || '');
  const [tagName, setTagName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#F74A05');
  const [customHexInput, setCustomHexInput] = useState('');
  const [hexInputError, setHexInputError] = useState('');
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load recent colors on mount
  useEffect(() => {
    setRecentColors(getRecentColors());
  }, [isOpen]);

  const findTagById = (id?: string): Tag | undefined => {
    if (!id) return undefined;
    const stack = [...categories];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      if (current.id === id) return current;
      if (current.children) stack.push(...current.children);
    }
    return undefined;
  };

  const getSystemCategories = () => categories.filter(c => c.type === 'system-category');

  const getParentTagsForCategory = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.children?.filter(c => c.type === 'parent') || [];
  };

  const getSubcategoriesForParent = (parentId: string) => {
    const parent = findTagById(parentId);
    return parent?.children?.filter(c => c.type === 'subcategory') || [];
  };

  const getChildContainersForCategory = (categoryId: string) => {
    const parents = getParentTagsForCategory(categoryId);
    const subcategories = parents.flatMap(parent => getSubcategoriesForParent(parent.id));
    return [...parents, ...subcategories];
  };

  // Initialize form when tagToEdit changes
  useEffect(() => {
    if (tagToEdit) {
      setTagName(tagToEdit.name);
      setDescription(tagToEdit.description || '');
      setColor(tagToEdit.color || '#F74A05');
      setTagType(tagToEdit.type as TagType);

      if (tagToEdit.type === 'parent') {
        setSelectedCategoryId(tagToEdit.parent_id || '');
      } else if (tagToEdit.type === 'subcategory') {
        setSelectedParentId(tagToEdit.parent_id || '');
        const parentTag = findTagById(tagToEdit.parent_id);
        if (parentTag?.parent_id) {
          setSelectedCategoryId(parentTag.parent_id);
        }
      } else if (tagToEdit.type === 'child') {
        setSelectedParentId(tagToEdit.parent_id || '');
        const parentTag = findTagById(tagToEdit.parent_id);
        if (parentTag?.type === 'subcategory') {
          const grandParent = findTagById(parentTag.parent_id);
          if (grandParent?.parent_id) {
            setSelectedCategoryId(grandParent.parent_id);
          }
        } else if (parentTag?.parent_id) {
          setSelectedCategoryId(parentTag.parent_id);
        }
      } else {
        setSelectedCategoryId(preselectedCategoryId || '');
      }
    } else {
      // Reset defaults if not editing
      setTagName(initialTagName || '');
      setDescription(initialDescription || '');
      setColor('#F74A05');
      const parentTag = findTagById(preselectedParentId);
      const derivedCategoryId =
        parentTag?.type === 'system-category'
          ? parentTag.id
          : parentTag?.parent_id || preselectedCategoryId || '';

      setTagType(
        defaultType && defaultType !== 'system-category'
          ? defaultType
          : preselectedParentId
            ? 'child'
            : 'parent'
      );
      setSelectedCategoryId(derivedCategoryId);
      setSelectedParentId(preselectedParentId || '');
    }
  }, [tagToEdit, preselectedCategoryId, preselectedParentId, categories, isOpen, defaultType]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tagName.trim()) {
      toast.error('Please enter a tag name');
      return;
    }

    if (tagType === 'parent' && !selectedCategoryId) {
      toast.error('Please select a system category');
      return;
    }

    if ((tagType === 'subcategory' || tagType === 'child') && !selectedParentId) {
      toast.error(`Please select a ${tagType === 'child' ? 'parent or subcategory' : 'parent'} tag`);
      return;
    }

    try {
      setIsSubmitting(true);

      // Save custom color to recent colors before creating/updating
      saveRecentColor(color, predefinedColors);
      setRecentColors(getRecentColors());

      if (isEditing && tagToEdit) {
        // UPDATE EXISTING TAG
        // Pass bypass flag for Super Admin editing system-locked tags
        const bypassSystemLock = canEditSystemTags && tagToEdit.is_system_locked;
        await updateTag(tagToEdit.id, {
          name: tagName.trim(),
          description: description.trim() || undefined,
          color: color,
        }, bypassSystemLock);
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
          const category = getSystemCategories().find(c => c.id === selectedCategoryId);
          tagData.parent_id = selectedCategoryId;
          tagData.system_category = category?.system_category;
        } else if (tagType === 'subcategory') {
          const parentTag = findTagById(selectedParentId);
          tagData.parent_id = selectedParentId;
          tagData.system_category = parentTag?.system_category;
        } else if (tagType === 'child') {
          const container = findTagById(selectedParentId);
          tagData.parent_id = selectedParentId;
          tagData.system_category = container?.system_category;
        }

        await createTag(tagData);
        const label = tagType === 'parent' ? 'Parent' : tagType === 'subcategory' ? 'Subcategory' : 'Child';
        toast.success(`${label} tag created successfully`);
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
                <div className="grid grid-cols-3 gap-3">
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
                      <span className="font-medium">Parent</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Groups subcategories or child tags
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTagType('subcategory')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      tagType === 'subcategory'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                        : 'border-border hover:border-orange-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <FolderOpen className="h-5 w-5 text-orange-500" />
                      <span className="font-medium">Subcategory</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Nested under a parent and holds child tags
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
                      <span className="font-medium">Child</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Assignable tag under a parent or subcategory
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* Category Selection (for Parent/Subcategory/Child) */}
            {(tagType === 'parent' || tagType === 'subcategory' || tagType === 'child') && (
              <div className="space-y-2">
                <Label htmlFor="category">
                  Select System Category <span className="text-destructive">*</span>
                </Label>
                <select
                  id="category"
                  value={selectedCategoryId}
                  onChange={(e) => {
                    setSelectedCategoryId(e.target.value);
                    setSelectedParentId('');
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground"
                  required
                  disabled={isEditing && tagType === 'parent'}
                >
                  <option value="">Choose a category...</option>
                  {getSystemCategories()
                    .map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {isEditing 
                    ? 'System category cannot be changed after creation' 
                    : 'System categories define the top-level tag system'}
                </p>
              </div>
            )}

            {/* Parent Tag Selection (for Subcategory Tags) */}
            {tagType === 'subcategory' && (
              <div className="space-y-2">
                <Label htmlFor="subcategory-parent">
                  Select Parent <span className="text-destructive">*</span>
                </Label>

                {selectedCategoryId ? (
                  <select
                    id="subcategory-parent"
                    value={selectedParentId}
                    onChange={(e) => setSelectedParentId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground"
                    required
                    disabled={isEditing}
                  >
                    <option value="">Choose a parent...</option>
                    {getParentTagsForCategory(selectedCategoryId).map(parent => (
                      <option key={parent.id} value={parent.id}>
                        {parent.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-xs text-muted-foreground">Select a system category first</div>
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
                  Subcategories sit under a parent and contain child tags.
                </p>
              </div>
            )}

            {/* Parent/Subcategory Selection (for Child Tags) */}
            {tagType === 'child' && (
              <div className="space-y-2">
                <Label htmlFor="parent">
                  Select Parent or Subcategory <span className="text-destructive">*</span>
                </Label>
                
                {selectedCategoryId ? (
                  <select
                    id="parent"
                    value={selectedParentId}
                    onChange={(e) => setSelectedParentId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground"
                    required
                    disabled={isEditing}
                  >
                    <option value="">Choose a parent or subcategory...</option>
                    {getChildContainersForCategory(selectedCategoryId).map(parent => (
                      <option key={parent.id} value={parent.id}>
                        {parent.name} {parent.type === 'subcategory' ? '(Subcategory)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-xs text-muted-foreground">Select a system category first</div>
                )}

                {selectedCategoryId && getChildContainersForCategory(selectedCategoryId).length === 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                      No parents or subcategories in this category yet. Create a parent first.
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Child tags can live directly under a parent or within a subcategory.
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
            <div className="space-y-3">
              <Label>Tag Color</Label>

              {/* Predefined Colors */}
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Preset colors</span>
                <div className="flex flex-wrap gap-2">
                  {predefinedColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setColor(c);
                        setCustomHexInput('');
                        setHexInputError('');
                      }}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        color.toUpperCase() === c.toUpperCase()
                          ? 'border-foreground scale-110'
                          : 'border-border hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* Recent Colors */}
              {recentColors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Recent custom colors</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentColors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setColor(c);
                          setCustomHexInput('');
                          setHexInputError('');
                        }}
                        className={`w-8 h-8 rounded-lg border-2 transition-all ${
                          color.toUpperCase() === c.toUpperCase()
                            ? 'border-foreground scale-110'
                            : 'border-border hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Color Input */}
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Custom color (hex)</span>
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      const hexColor = e.target.value.toUpperCase();
                      setColor(hexColor);
                      setCustomHexInput(hexColor);
                      setHexInputError('');
                    }}
                    className="w-12 h-10 cursor-pointer p-1"
                    title="Click to open color picker"
                  />
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      type="text"
                      value={customHexInput || color.toUpperCase()}
                      onChange={(e) => {
                        let val = e.target.value;
                        // Add # if user pastes without it
                        if (val && !val.startsWith('#')) {
                          val = '#' + val;
                        }
                        setCustomHexInput(val);
                        setHexInputError('');

                        // Auto-apply if valid
                        if (isValidHexColor(val)) {
                          setColor(val.toUpperCase());
                        }
                      }}
                      onFocus={(e) => {
                        // Select all text on focus for easy replacement
                        e.target.select();
                      }}
                      onBlur={() => {
                        if (customHexInput && !isValidHexColor(customHexInput)) {
                          setHexInputError('Invalid hex color (e.g., #FF5733)');
                        }
                      }}
                      placeholder="#FF5733"
                      className={`font-mono text-sm w-32 ${hexInputError ? 'border-destructive' : ''}`}
                    />
                  </div>
                  <div
                    className="w-10 h-10 rounded-lg border-2 border-foreground shadow-sm"
                    style={{ backgroundColor: color }}
                    title={`Current: ${color.toUpperCase()}`}
                  />
                </div>
                {hexInputError && (
                  <p className="text-xs text-destructive">{hexInputError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Paste or type a hex color code, or use the picker. Current: <span className="font-mono font-medium">{color.toUpperCase()}</span>
                </p>
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 rounded-lg border border-border bg-muted/50">
              <Label className="mb-3 block">Preview</Label>
              <div className="flex items-center gap-2">
                {tagType === 'parent' ? (
                  <FolderOpen className="h-4 w-4" style={{ color }} />
                ) : tagType === 'subcategory' ? (
                  <Folder className="h-4 w-4" style={{ color }} />
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
