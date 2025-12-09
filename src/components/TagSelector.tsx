import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X, Plus, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TagSelectorProps {
  selectedTags: string[];
  onSave: (tags: string[]) => void;
  onClose: () => void;
}

export function TagSelector({ selectedTags, onSave, onClose }: TagSelectorProps) {
  const [availableTags, setAvailableTags] = useState<Array<{ id: string; name: string }>>([]);
  const [localSelectedTags, setLocalSelectedTags] = useState<string[]>(selectedTags);
  const [newTagName, setNewTagName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tags')
        .select('id, name')
        .eq('system_category', 'units')
        .eq('type', 'child')
        .order('name');

      if (error) throw error;
      setAvailableTags(data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      alert('Please enter a tag name');
      return;
    }

    setCreating(true);
    try {
      // First, find or create a parent tag for custom unit tags
      const { data: parentTags, error: parentError } = await supabase
        .from('tags')
        .select('id')
        .eq('system_category', 'units')
        .eq('type', 'parent')
        .eq('name', 'Custom Unit Tags')
        .limit(1);

      if (parentError) throw parentError;

      let parentId = parentTags?.[0]?.id;

      // If no parent exists, create one
      if (!parentId) {
        const { data: newParent, error: createParentError } = await supabase
          .from('tags')
          .insert([{
            name: 'Custom Unit Tags',
            system_category: 'units',
            type: 'parent',
            organization_id: null,
            is_system_locked: false,
            description: 'User-created tags for unit categorization'
          }])
          .select()
          .single();

        if (createParentError) throw createParentError;
        parentId = newParent.id;
      }

      // Create the child tag
      const { data, error } = await supabase
        .from('tags')
        .insert([{
          name: newTagName.trim(),
          system_category: 'units',
          type: 'child',
          parent_id: parentId,
          organization_id: null,
          is_system_locked: false
        }])
        .select()
        .single();

      if (error) throw error;

      // Add to available tags and select it
      setAvailableTags([...availableTags, data]);
      setLocalSelectedTags([...localSelectedTags, data.name]);
      setNewTagName('');
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating tag:', error);
      alert('Failed to create tag');
    } finally {
      setCreating(false);
    }
  };

  const toggleTag = (tagName: string) => {
    if (localSelectedTags.includes(tagName)) {
      setLocalSelectedTags(localSelectedTags.filter(t => t !== tagName));
    } else {
      setLocalSelectedTags([...localSelectedTags, tagName]);
    }
  };

  const handleSave = () => {
    onSave(localSelectedTags);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-gray-900">Select Tags</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {showCreateForm ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Tag Name
                </label>
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="e.g., High Traffic, Flagship, Drive-Thru"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateTag();
                    }
                  }}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewTagName('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTag}
                  disabled={creating}
                  className="flex-1"
                >
                  {creating ? 'Creating...' : 'Create Tag'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Create New Button */}
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Plus className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Create New Tag</p>
                  <p className="text-sm text-gray-500">Add a new tag to categorize units</p>
                </div>
              </button>

              {/* Existing Tags */}
              {loading ? (
                <p className="text-sm text-gray-500 text-center py-8">Loading tags...</p>
              ) : availableTags.length > 0 ? (
                <>
                  <div className="pt-2">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Available Tags ({localSelectedTags.length} selected)
                    </p>
                  </div>
                  <div className="space-y-2">
                    {availableTags.map((tag) => (
                      <label
                        key={tag.id}
                        className={`flex items-center gap-3 px-4 py-3 border rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors ${
                          localSelectedTags.includes(tag.name)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={localSelectedTags.includes(tag.name)}
                          onChange={() => toggleTag(tag.name)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <Tag className="w-4 h-4 text-gray-400" />
                        <span className="flex-1 text-gray-900">{tag.name}</span>
                      </label>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">
                  No tags yet. Create one above to get started.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!showCreateForm && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save ({localSelectedTags.length} selected)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}