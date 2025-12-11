import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { X, Plus, Check } from 'lucide-react';
import { createDistrict } from '../lib/crud/stores';

interface District {
  id: string;
  name: string;
  code: string;
}

interface DistrictSelectorProps {
  districts: District[];
  selectedId: string;
  onSelect: (districtId: string) => void;
  onClose: () => void;
  onDistrictCreated?: () => void;
}

export function DistrictSelector({ districts, selectedId, onSelect, onClose, onDistrictCreated }: DistrictSelectorProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDistrictName, setNewDistrictName] = useState('');
  const [newDistrictCode, setNewDistrictCode] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateDistrict = async () => {
    if (!newDistrictName.trim() || !newDistrictCode.trim()) {
      alert('Please fill in all fields');
      return;
    }

    setCreating(true);
    try {
      const newDistrict = await createDistrict({
        district_name: newDistrictName,
        district_code: newDistrictCode.toUpperCase(),
      });
      
      // Select the newly created district
      onSelect(newDistrict.id);
      if (onDistrictCreated) {
        onDistrictCreated();
      }
    } catch (error) {
      console.error('Error creating district:', error);
      alert('Failed to create district');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-gray-900">Select District</h2>
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
                <Label htmlFor="districtName">District Name</Label>
                <Input
                  id="districtName"
                  value={newDistrictName}
                  onChange={(e) => setNewDistrictName(e.target.value)}
                  placeholder="e.g., Northeast District"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="districtCode">District Code</Label>
                <Input
                  id="districtCode"
                  value={newDistrictCode}
                  onChange={(e) => setNewDistrictCode(e.target.value.toUpperCase())}
                  placeholder="e.g., NE"
                  maxLength={10}
                  className="mt-2"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewDistrictName('');
                    setNewDistrictCode('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateDistrict}
                  disabled={creating}
                  className="flex-1"
                >
                  {creating ? 'Creating...' : 'Create District'}
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
                  <p className="font-medium text-gray-900">Create New District</p>
                  <p className="text-sm text-gray-500">Add a new district to your organization</p>
                </div>
              </button>

              {/* Existing Districts */}
              {districts.length > 0 && (
                <>
                  <div className="pt-2">
                    <p className="text-sm font-medium text-gray-700 mb-2">Existing Districts</p>
                  </div>
                  {districts.map((district) => (
                    <button
                      key={district.id}
                      onClick={() => onSelect(district.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left ${
                        selectedId === district.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{district.name}</p>
                        <p className="text-sm text-gray-500">Code: {district.code}</p>
                      </div>
                      {selectedId === district.id && (
                        <Check className="w-5 h-5 text-blue-600" />
                      )}
                    </button>
                  ))}
                </>
              )}

              {districts.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">
                  No districts yet. Create one above to get started.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}