import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Check, Plus, X } from 'lucide-react';
import * as tagCrud from '../lib/crud/tags';
import { toast } from 'sonner@2.0.3';

interface TagSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export function TagSelectorDialog({ isOpen, onClose, selectedTags, onTagsChange }: TagSelectorDialogProps) {
  const [availableTags, setAvailableTags] = useState<tagCrud.Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTags();
    }
  }, [isOpen]);

  const loadTags = async () => {
    setIsLoading(true);
    try {
      const tags = await tagCrud.getTags();
      setAvailableTags(tags);
    } catch (error: any) {
      console.error('Error loading tags:', error);
      toast.error('Failed to load tags');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTag = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      onTagsChange(selectedTags.filter(t => t !== tagName));
    } else {
      onTagsChange([...selectedTags, tagName]);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Please enter a tag name');
      return;
    }

    // Check if tag already exists
    if (availableTags.some(t => t.name.toLowerCase() === newTagName.trim().toLowerCase())) {
      toast.error('Tag already exists');
      return;
    }

    setIsCreating(true);
    try {
      const newTag = await tagCrud.createTag(newTagName.trim());
      setAvailableTags([...availableTags, newTag]);
      onTagsChange([...selectedTags, newTag.name]);
      setNewTagName('');
      toast.success('Tag created successfully');
    } catch (error: any) {
      console.error('Error creating tag:', error);
      toast.error('Failed to create tag');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSave = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Tags</DialogTitle>
          <DialogDescription>
            Choose existing tags or create new ones
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Create New Tag */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Create New Tag</label>
            <div className="flex gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Enter tag name..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateTag();
                  }
                }}
              />
              <Button
                onClick={handleCreateTag}
                disabled={isCreating || !newTagName.trim()}
                variant="outline"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Available Tags */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Available Tags</label>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading tags...</p>
            ) : availableTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags available. Create one above!</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-2 border rounded-lg">
                {availableTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant={selectedTags.includes(tag.name) ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handleToggleTag(tag.name)}
                  >
                    {selectedTags.includes(tag.name) && (
                      <Check className="h-3 w-3 mr-1" />
                    )}
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Selected Tags Preview */}
          {selectedTags.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Selected Tags ({selectedTags.length})</label>
              <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-muted/50">
                {selectedTags.map((tag, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => handleToggleTag(tag)}
                  >
                    {tag}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="hero-primary">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
