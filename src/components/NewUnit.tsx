import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from './ui/card';
import { Footer } from './Footer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowLeft, Upload, X, Plus } from 'lucide-react';
import { createStore, updateStore } from '../lib/crud/stores';
import { addUnitTags, getUnitTags } from '../lib/crud/unitTags';
import { uploadStorePhoto } from '../lib/storage/uploadStorePhoto';
import { useDistricts, useUsers, useCurrentUser, useEffectiveOrgId } from '../lib/hooks/useSupabase';
import { TagSelectorDialog } from './TagSelectorDialog';
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

interface Store {
  id: string;
  name: string;
  code: string;
  district_id?: string | null;
  address?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  county?: string | null;
  phone?: string | null;
  store_email?: string | null;
  photo_url?: string | null;
  manager_id?: string | null;
  status?: 'active' | 'ignored' | 'deactivated' | null;
}

interface NewUnitProps {
  onBack: () => void;
  onSuccess: () => void;
  editStore?: Store | null;  // If provided, we're in edit mode
}

export function NewUnit({ onBack, onSuccess, editStore }: NewUnitProps) {
  const { t } = useTranslation();
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
  const [selectedTagObjects, setSelectedTagObjects] = useState<any[]>([]);  // Store full tag objects for IDs
  const [showTagSelector, setShowTagSelector] = useState(false);
  
  // Staff
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');

  // Status
  const [status, setStatus] = useState<'active' | 'ignored' | 'deactivated'>(editStore?.status || 'active');

  // UI State
  const [saving, setSaving] = useState(false);

  // Fetch data
  const { user: currentUser } = useCurrentUser();
  const { orgId: effectiveOrgId } = useEffectiveOrgId();
  const { districts, loading: districtsLoading, error: districtsError, refetch: refetchDistricts } = useDistricts(effectiveOrgId ?? undefined);
  const { users } = useUsers();

  // Pre-fill form if in edit mode
  useEffect(() => {
    if (editStore) {
      console.log('📝 Edit mode - Raw store data received:', {
        id: editStore.id,
        name: editStore.name,
        code: editStore.code,
        district_id: editStore.district_id,
        address: editStore.address,
        address_line_2: editStore.address_line_2,
        city: editStore.city,
        state: editStore.state,
        zip: editStore.zip,
        county: editStore.county,
        phone: editStore.phone,
        store_email: editStore.store_email,
        photo_url: editStore.photo_url,
        manager_id: editStore.manager_id
      });

      setUnitName(editStore.name || '');
      setUnitNumber(editStore.code || '');
      
      // Parse address if it's a formatted string
      const addressParts = editStore.address?.split(',') || [];
      setAddressLine1(addressParts[0]?.trim() || '');
      setAddressLine2(editStore.address_line_2 || '');
      setCity(editStore.city || '');
      setState(editStore.state || '');
      setZip(editStore.zip || '');
      setCounty(editStore.county || '');
      
      setPhone(editStore.phone || '');
      setEmail(editStore.store_email || '');
      setSelectedDistrictId(editStore.district_id || '');
      setSelectedManagerId(editStore.manager_id || '');
      setStatus(editStore.status || 'active');
      setPhotoPreview(editStore.photo_url || null);
      
      console.log('✅ Edit mode - State variables set:', {
        addressLine2: editStore.address_line_2,
        county: editStore.county,
        phone: editStore.phone,
        store_email: editStore.store_email,
        photoPreview: editStore.photo_url,
        selectedDistrictId: editStore.district_id
      });
      
      // Load existing tags
      if (editStore.id) {
        getUnitTags(editStore.id).then(unitTags => {
          // Extract tag names from the returned data structure
          const tagNames = unitTags
            .map(ut => ut.tag?.name)
            .filter(name => name != null) as string[];
          setSelectedTags(tagNames);
          setSelectedTagObjects(unitTags.map(ut => ut.tag));
          console.log('✅ Edit mode - Tags loaded:', tagNames);
        }).catch(err => {
          console.error('Error loading unit tags:', err);
        });
      }
    }
  }, [editStore]);

  // Filter managers from live database - use joined role data
  const managers = users.filter(u => {
    const roleName = (u.role as any)?.name || '';
    return roleName === 'Store Manager' ||
           roleName === 'District Manager' ||
           roleName === 'Admin';
  });

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
    if (!effectiveOrgId) {
      toast.error(t('units.orgContextRequired'));
      return;
    }

    if (!unitName.trim()) {
      toast.error(t('units.unitNameRequired'));
      return;
    }

    if (!unitNumber.trim()) {
      toast.error(t('units.unitNumberRequired'));
      return;
    }

    setSaving(true);
    try {
      // Build formatted address
      const addressParts = [
        addressLine1,
        city,
        state,
        zip
      ].filter(Boolean);
      const formattedAddress = addressParts.join(', ');

      console.log('💾 Saving unit with data:', {
        unitName,
        unitNumber,
        addressLine1,
        addressLine2,
        city,
        state,
        zip,
        county,
        phone,
        email,
        selectedDistrictId,
        selectedManagerId,
        photoFile: photoFile?.name,
        photoPreview: photoPreview?.substring(0, 50)
      });

      let storeId: string;

      if (editStore) {
        // UPDATE MODE - Update existing store
        const updateData = {
          store_name: unitName,
          store_code: unitNumber,
          district_id: selectedDistrictId || null,
          address: formattedAddress || null,
          address_line_2: addressLine2 || null,
          city: city || null,
          state: state || null,
          zip_code: zip || null,
        county: county || null,
        phone: phone || null,
        store_email: email || null,
        manager_id: selectedManagerId || null,
        status,
      };

        console.log('📝 Update data being sent:', updateData);
        await updateStore(editStore.id, updateData);
        storeId = editStore.id;
        console.log('✅ Store updated successfully');

        // Upload photo if a new one was selected
        if (photoFile && editStore.id) {
          try {
            console.log('📸 Uploading photo...');
            const photoUrl = await uploadStorePhoto(photoFile, editStore.id);
            console.log('✅ Photo uploaded:', photoUrl);
            await updateStore(editStore.id, { photo_url: photoUrl });
            console.log('✅ Photo URL saved to store');
          } catch (photoError) {
            console.error('Error uploading photo:', photoError);
            toast.error(t('units.updatedButPhotoFailed'));
          }
        }

        // Update tags relationship - use tag IDs instead of tag names
        if (selectedTagObjects.length > 0 && editStore.id) {
          try {
            console.log('🏷️ Saving tags:', selectedTagObjects.map(t => t.name));
            const tagIds = selectedTagObjects.map(t => t.id).filter(Boolean);
            if (tagIds.length > 0) {
              await addUnitTags(editStore.id, tagIds);
              console.log('✅ Tags saved');
            }
          } catch (tagError) {
            console.error('Error updating tags:', tagError);
          }
        }

        toast.success(t('units.unitUpdated'));
      } else {
        // CREATE MODE - Create new store
        const createData = {
          store_name: unitName,
          store_code: unitNumber,
          district_id: selectedDistrictId || null,
          address: formattedAddress || null,
          address_line_2: addressLine2 || null,
          city: city || null,
          state: state || null,
          zip_code: zip || null,
          county: county || null,
          phone: phone || null,
          store_email: email || null,
          manager_id: selectedManagerId || null,
          status,
          photo_url: null // Will update this after photo upload
        };

        console.log('📝 Create data being sent:', createData);
        const newStore = await createStore(createData);
        storeId = newStore.id;
        console.log('✅ Store created with ID:', storeId);

        // Upload photo to Supabase Storage if photoFile exists
        if (photoFile && newStore.id) {
          try {
            console.log('📸 Uploading photo...');
            const photoUrl = await uploadStorePhoto(photoFile, newStore.id);
            console.log('✅ Photo uploaded:', photoUrl);
            await updateStore(newStore.id, { photo_url: photoUrl });
            console.log('✅ Photo URL saved to store');
          } catch (photoError) {
            console.error('Error uploading photo:', photoError);
            toast.error(t('units.createdButPhotoFailed'));
          }
        }

        // Save tags relationship - use tag IDs instead of tag names
        if (selectedTagObjects.length > 0 && newStore.id) {
          try {
            console.log('🏷️ Saving tags:', selectedTagObjects.map(t => t.name));
            const tagIds = selectedTagObjects.map(t => t.id).filter(Boolean);
            if (tagIds.length > 0) {
              await addUnitTags(newStore.id, tagIds);
              console.log('✅ Tags saved');
            }
          } catch (tagError) {
            console.error('Error adding tags:', tagError);
            // Don't fail the entire operation for tag errors
          }
        }

        toast.success(t('units.unitCreated'));
      }

      console.log('✅ ALL DATA SAVED SUCCESSFULLY');
      onSuccess();
    } catch (error) {
      console.error('❌ Save error:', error);
      toast.error(editStore ? t('units.failedUpdateUnit') : t('units.failedCreateUnit'));
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
            {t('common.back')}
          </Button>
          <div>
            <h1 className="text-foreground">{editStore ? t('units.editUnit') : t('units.newUnit')}</h1>
            <p className="text-muted-foreground mt-1">
              {editStore ? t('units.updateStoreLocation') : t('units.createNewStoreLocation')}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={onBack}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-brand-gradient hover:opacity-90 text-white shadow-brand"
          >
{saving ? t('common.saving') : (editStore ? t('units.updateUnit') : t('units.saveUnit'))}
          </Button>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-foreground">{t('units.basicInformation')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="unitName">{t('units.unitName')}</Label>
                <Input
                  id="unitName"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  placeholder="e.g., Southampton 100"
                />
              </div>
              <div>
                <Label htmlFor="unitNumber">{t('units.unitNumber')}</Label>
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
            <h3 className="text-foreground">{t('units.location')}</h3>
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
            <h3 className="text-foreground">{t('units.contactInformation')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">{t('units.storePhoneNumber')}</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <Label htmlFor="email">{t('units.storeEmail')}</Label>
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
            <h3 className="text-foreground">{t('units.storePhotoOptional')}</h3>
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
                <span className="text-sm text-muted-foreground">{t('units.clickToUploadPhoto')}</span>
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
            <h3 className="text-foreground">{t('units.districtAssignment')}</h3>
            <div>
              <Label>{t('units.districtOptional')}</Label>
              <Button
                variant="outline"
                onClick={() => setShowDistrictSelector(true)}
                className="w-full max-w-md justify-start mt-2"
              >
                {selectedDistrict ? (
                  <span>{selectedDistrict.name} ({selectedDistrict.code})</span>
                ) : (
                  <span className="text-muted-foreground">{t('units.selectOrCreateDistrict')}</span>
                )}
              </Button>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground">{t('units.unitTags')}</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTagSelector(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('units.addTags')}
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
                      onClick={() => {
                        setSelectedTags(selectedTags.filter(t => t !== tag));
                        setSelectedTagObjects(selectedTagObjects.filter(obj => obj.name !== tag));
                      }}
                      className="hover:bg-primary/20 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('units.noTagsAssigned')}</p>
            )}
          </div>

          {/* Manager Assignment */}
          <div className="space-y-4">
            <h3 className="text-foreground">{t('units.managerAssignment')}</h3>
            <div>
              <Label htmlFor="manager">{t('units.storeManagerOptional')}</Label>
              <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                <SelectTrigger id="manager" className="w-full max-w-md">
                  <SelectValue placeholder={t('units.selectManager')} />
                </SelectTrigger>
                <SelectContent>
                  {managers.length > 0 ? (
                    managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.first_name} {manager.last_name} - {(manager.role as any)?.name || 'Unknown'}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      {t('units.noManagersFound')}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Unit Status */}
          <div className="space-y-4">
            <h3 className="text-foreground">Unit Status</h3>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as 'active' | 'ignored' | 'deactivated')}
              >
                <SelectTrigger id="status" className="w-full max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active — visible and importable</SelectItem>
                  <SelectItem value="ignored">Ignored — exclude from CSV/HRIS imports</SelectItem>
                  <SelectItem value="deactivated">Deactivated — soft-deleted</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Use <strong>Ignored</strong> for locations like Office or Corporate that shouldn't have their employees imported, but should still exist in the system.
              </p>
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
          onDistrictCreated={() => {
            refetchDistricts();
          }}
        />
      )}

      {showTagSelector && (
        <TagSelectorDialog
          isOpen={showTagSelector}
          selectedTags={selectedTags}
          onTagsChange={(tags, tagObjects) => {
            setSelectedTags(tags);
            setSelectedTagObjects(tagObjects || []);
            // Modal will close itself when user clicks "Apply Tags"
          }}
          onClose={() => setShowTagSelector(false)}
          systemCategory="units"
        />
      )}
    </div>
  );
}