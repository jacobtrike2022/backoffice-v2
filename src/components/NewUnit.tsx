import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Footer } from './Footer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowLeft, Upload, X, Plus } from 'lucide-react';
import { createStore } from '../lib/crud/stores';
import { addUnitTags } from '../lib/crud/unitTags';
import { uploadStorePhoto } from '../lib/storage/uploadStorePhoto';
import { useDistricts, useUsers, useCurrentUser } from '../lib/hooks/useSupabase';
import { TagSelector } from './TagSelector';
import { DistrictSelector } from './DistrictSelector';
import { SimpleAddressForm } from './SimpleAddressForm';
import { toast } from 'sonner@2.0.3';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface NewUnitProps {
  onBack: () => void;
  onSuccess: () => void;
}

export function NewUnit({ onBack, onSuccess }: NewUnitProps) {
  // Basic Info
  const [unitName, setUnitName] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  
  // Address fields
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [county, setCounty] = useState('');
  
  // Contact info
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Image
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  // District
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');
  const [showDistrictSelector, setShowDistrictSelector] = useState(false);
  
  // Tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagSelector, setShowTagSelector] = useState(false);
  
  // Staff
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  
  // UI State
  const [saving, setSaving] = useState(false);

  // Fetch data
  const { user: currentUser } = useCurrentUser();
  const { districts } = useDistricts();
  const { users } = useUsers();

  // Filter managers from live database
  const managers = users.filter(u => 
    u.role_name === 'Store Manager' || 
    u.role_name === 'District Manager' || 
    u.role_name === 'Admin'
  );

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleAddressChange = (field: string, value: string) => {
    switch (field) {
      case 'addressLine1':
        setAddressLine1(value);
        break;
      case 'addressLine2':
        setAddressLine2(value);
        break;
      case 'city':
        setCity(value);
        break;
      case 'state':
        setState(value);
        break;
      case 'zip':
        setZip(value);
        break;
      case 'county':
        setCounty(value);
        break;
    }
  };

  const handleSave = async () => {
    if (!currentUser?.organization_id) {
      toast.error('Organization context required');
      return;
    }

    if (!unitName.trim()) {
      toast.error('Unit name is required');
      return;
    }

    if (!unitNumber.trim()) {
      toast.error('Unit number is required');
      return;
    }

    setSaving(true);
    try {
      // Build formatted address
      const addressParts = [
        addressLine1,
        addressLine2,
        city,
        state,
        zip
      ].filter(Boolean);
      const formattedAddress = addressParts.join(', ');

      // Step 1: Create the store/unit first (to get the store ID)
      const newStore = await createStore({
        store_name: unitName,
        store_code: unitNumber,
        district_id: selectedDistrictId || null,
        street_address: addressLine1 || null,
        address_line_2: addressLine2 || null,
        address: formattedAddress || null,
        city: city || null,
        state: state || null,
        zip_code: zip || null,
        county: county || null,
        phone: phone || null,
        email: email || null,
        manager_id: selectedManagerId || null,
        latitude: null,
        longitude: null,
        place_id: null,
        photo_url: null // Will update this after photo upload
      });

      // Step 2: Upload photo to Supabase Storage if photoFile exists
      if (photoFile && newStore.id) {
        try {
          const photoUrl = await uploadStorePhoto(photoFile, newStore.id);
          
          // Update the store with the photo URL
          const { updateStore } = await import('../lib/crud/stores');
          await updateStore(newStore.id, { photo_url: photoUrl });
        } catch (photoError) {
          console.error('Error uploading photo:', photoError);
          toast.error('Unit created but photo upload failed');
        }
      }

      // Step 3: Save tags relationship
      if (selectedTags.length > 0 && newStore.id) {
        try {
          await addUnitTags(newStore.id, selectedTags);
        } catch (tagError) {
          console.error('Error adding tags:', tagError);
          // Don't fail the entire operation for tag errors
        }
      }

      toast.success('Unit created successfully');
      onSuccess();
    } catch (error) {
      console.error('Error creating unit:', error);
      toast.error('Failed to create unit');
    } finally {
      setSaving(false);
    }
  };

  const selectedDistrict = districts.find(d => d.id === selectedDistrictId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-foreground">New Unit</h1>
            <p className="text-muted-foreground mt-1">
              Create a new store location
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={onBack}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-brand-gradient hover:opacity-90 text-white shadow-brand"
          >
            {saving ? 'Saving...' : 'Save Unit'}
          </Button>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-foreground">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="unitName">Unit Name</Label>
                <Input
                  id="unitName"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  placeholder="e.g., Southampton 100"
                />
              </div>
              <div>
                <Label htmlFor="unitNumber">Unit Number</Label>
                <Input
                  id="unitNumber"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  placeholder="e.g., 100"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <h3 className="text-foreground">Location</h3>
            <SimpleAddressForm
              address={{
                addressLine1,
                addressLine2,
                city,
                state,
                zip,
                county
              }}
              onChange={handleAddressChange}
            />
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-foreground">Contact Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Store Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <Label htmlFor="email">Store Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="store@company.com"
                />
              </div>
            </div>
          </div>

          {/* Store Photo */}
          <div className="space-y-4">
            <h3 className="text-foreground">Store Photo (Optional)</h3>
            {photoPreview ? (
              <div className="relative inline-block">
                <img
                  src={photoPreview}
                  alt="Store preview"
                  className="w-64 h-48 object-cover rounded-lg border border-border"
                />
                <button
                  onClick={removePhoto}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-64 h-48 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Click to upload photo</span>
                <span className="text-xs text-muted-foreground mt-1">PNG, JPG up to 5MB</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* District Assignment */}
          <div className="space-y-4">
            <h3 className="text-foreground">District Assignment</h3>
            <div>
              <Label>District (Optional)</Label>
              <Button
                variant="outline"
                onClick={() => setShowDistrictSelector(true)}
                className="w-full max-w-md justify-start mt-2"
              >
                {selectedDistrict ? (
                  <span>{selectedDistrict.name} ({selectedDistrict.code})</span>
                ) : (
                  <span className="text-muted-foreground">Select or create a district</span>
                )}
              </Button>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground">Unit Tags</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTagSelector(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Tags
              </Button>
            </div>
            {selectedTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <div
                    key={tag}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                  >
                    <span>{tag}</span>
                    <button
                      onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))}
                      className="hover:bg-primary/20 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tags assigned yet</p>
            )}
          </div>

          {/* Manager Assignment */}
          <div className="space-y-4">
            <h3 className="text-foreground">Manager Assignment</h3>
            <div>
              <Label htmlFor="manager">Store Manager (Optional)</Label>
              <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                <SelectTrigger id="manager" className="w-full max-w-md">
                  <SelectValue placeholder="Select a manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.length > 0 ? (
                    managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.first_name} {manager.last_name} - {manager.role_name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No managers found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Footer />

      {/* Modals */}
      {showDistrictSelector && (
        <DistrictSelector
          districts={districts}
          selectedId={selectedDistrictId}
          onSelect={(id) => {
            setSelectedDistrictId(id);
            setShowDistrictSelector(false);
          }}
          onClose={() => setShowDistrictSelector(false)}
        />
      )}

      {showTagSelector && (
        <TagSelector
          selectedTags={selectedTags}
          onSave={(tags) => {
            setSelectedTags(tags);
            setShowTagSelector(false);
          }}
          onClose={() => setShowTagSelector(false)}
        />
      )}
    </div>
  );
}