import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
    } catch (error: any) {
      console.error('Error creating district:', error);
      const errorMessage = error?.message || 'Failed to create district';
      
      // Show user-friendly error message
      if (errorMessage.includes('User profile not found')) {
        alert('Your account is not fully set up. Please contact your administrator to complete your profile setup.');
      } else if (errorMessage.includes('Insufficient permissions')) {
        alert('You do not have permission to create districts. Please contact your administrator.');
      } else {
        alert(`Failed to create district: ${errorMessage}`);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col border border-border">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-foreground">{t('units.selectDistrict')}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {showCreateForm ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="districtName">{t('units.districtName')}</Label>
                <Input
                  id="districtName"
                  value={newDistrictName}
                  onChange={(e) => setNewDistrictName(e.target.value)}
                  placeholder="e.g., Northeast District"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="districtCode">{t('units.districtCode')}</Label>
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
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleCreateDistrict}
                  disabled={creating}
                  className="flex-1"
                >
                  {creating ? t('units.creating') : t('units.createDistrict')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Create New Button */}
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full flex items-center gap-3 px-4 py-3 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-accent transition-colors text-left"
              >
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{t('units.createNewDistrict')}</p>
                  <p className="text-sm text-muted-foreground">{t('units.addNewDistrictDesc')}</p>
                </div>
              </button>

              {/* Existing Districts */}
              {districts.length > 0 && (
                <>
                  <div className="pt-2">
                    <p className="text-sm font-medium text-foreground mb-2">{t('units.existingDistricts')}</p>
                  </div>
                  {districts.map((district) => (
                    <button
                      key={district.id}
                      onClick={() => onSelect(district.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 border rounded-lg hover:border-primary hover:bg-accent transition-colors text-left ${
                        selectedId === district.id
                          ? 'border-primary bg-accent'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{district.name}</p>
                        <p className="text-sm text-muted-foreground">{t('units.districtCodeLabel', { code: district.code })}</p>
                      </div>
                      {selectedId === district.id && (
                        <Check className="w-5 h-5 text-primary" />
                      )}
                    </button>
                  ))}
                </>
              )}

              {districts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t('units.noDistrictsYet')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}