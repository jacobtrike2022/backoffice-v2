import { useState, useEffect } from 'react';
import { supabase, getCurrentUserOrgId } from '../lib/supabase';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { 
  Upload, 
  X,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Sun,
  Moon,
  Info
} from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { toast } from 'sonner@2.0.3';
import trikeLogoDark from 'figma:asset/d284bc7ee411198fb15ff6e1e42fef256815e21f.png';

interface OrgSettings {
  logo_dark_url: string | null;
  logo_light_url: string | null;
  kb_allow_guest_access: boolean;
}

export function KBSettings() {
  const [settings, setSettings] = useState<OrgSettings>({
    logo_dark_url: null,
    logo_light_url: null,
    kb_allow_guest_access: true
  });
  const [originalSettings, setOriginalSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoDarkFile, setLogoDarkFile] = useState<File | null>(null);
  const [logoLightFile, setLogoLightFile] = useState<File | null>(null);
  const [logoDarkPreview, setLogoDarkPreview] = useState<string | null>(null);
  const [logoLightPreview, setLogoLightPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  // Update dark logo preview when settings change from database
  useEffect(() => {
    if (!logoDarkFile) {
      setLogoDarkPreview(settings.logo_dark_url || null);
    }
  }, [settings.logo_dark_url, logoDarkFile]);

  // Update light logo preview when settings change from database
  useEffect(() => {
    if (!logoLightFile) {
      setLogoLightPreview(settings.logo_light_url || null);
    }
  }, [settings.logo_light_url, logoLightFile]);

  // Update dark logo preview when file is selected
  useEffect(() => {
    if (logoDarkFile) {
      const url = URL.createObjectURL(logoDarkFile);
      setLogoDarkPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [logoDarkFile]);

  // Update light logo preview when file is selected
  useEffect(() => {
    if (logoLightFile) {
      const url = URL.createObjectURL(logoLightFile);
      setLogoLightPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [logoLightFile]);

  async function loadSettings() {
    try {
      setLoading(true);
      const orgId = await getCurrentUserOrgId();

      const { data, error } = await supabase
        .from('organizations')
        .select('logo_dark_url, logo_light_url, kb_allow_guest_access')
        .eq('id', orgId)
        .single();

      if (error) {
        console.warn('Error loading KB settings (columns may not exist yet):', error);
        // Set defaults even if columns don't exist
        const defaultSettings = {
          logo_dark_url: null,
          logo_light_url: null,
          kb_allow_guest_access: true
        };
        setSettings(defaultSettings);
        setOriginalSettings(defaultSettings);
        setLogoDarkPreview(null);
        setLogoLightPreview(null);
        setLoading(false);
        return;
      }

      const loadedSettings = {
        logo_dark_url: data?.logo_dark_url || null,
        logo_light_url: data?.logo_light_url || null,
        kb_allow_guest_access: data?.kb_allow_guest_access ?? true
      };

      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);
      setLogoDarkPreview(loadedSettings.logo_dark_url);
      setLogoLightPreview(loadedSettings.logo_light_url);
    } catch (error) {
      console.error('Error loading KB settings:', error);
      // Don't show error message, just use defaults
      const defaultSettings = {
        logo_dark_url: null,
        logo_light_url: null,
        kb_allow_guest_access: true
      };
      setSettings(defaultSettings);
      setOriginalSettings(defaultSettings);
      setLogoDarkPreview(null);
      setLogoLightPreview(null);
    } finally {
      setLoading(false);
    }
  }

  async function uploadLogo(file: File, orgId: string, logoType: 'dark' | 'light'): Promise<string> {
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('File size must be less than 5MB');
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const fileName = `${orgId}-${logoType}-${timestamp}.${fileExt}`;
    const filePath = fileName;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('organization-logos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('organization-logos')
      .getPublicUrl(filePath);

    return publicUrl;
  }

  async function handleSave() {
    try {
      setSaving(true);
      setMessage(null);
      
      const orgId = await getCurrentUserOrgId();
      if (!orgId) {
        throw new Error('Organization ID not found');
      }

      let logoDarkUrl = settings.logo_dark_url;
      let logoLightUrl = settings.logo_light_url;

      // Upload dark logo if file selected
      if (logoDarkFile) {
        try {
          logoDarkUrl = await uploadLogo(logoDarkFile, orgId, 'dark');
          toast.success('Dark mode logo uploaded successfully');
        } catch (error: any) {
          toast.error(`Failed to upload dark logo: ${error.message}`);
          throw error;
        }
      }

      // Upload light logo if file selected
      if (logoLightFile) {
        try {
          logoLightUrl = await uploadLogo(logoLightFile, orgId, 'light');
          toast.success('Light mode logo uploaded successfully');
        } catch (error: any) {
          toast.error(`Failed to upload light logo: ${error.message}`);
          throw error;
        }
      }

      // Save settings to database
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          logo_dark_url: logoDarkUrl,
          logo_light_url: logoLightUrl,
          kb_allow_guest_access: settings.kb_allow_guest_access
        })
        .eq('id', orgId);

      if (updateError) {
        throw new Error(`Failed to save settings: ${updateError.message}`);
      }

      // Update state with new values
      const newSettings = { 
        ...settings, 
        logo_dark_url: logoDarkUrl,
        logo_light_url: logoLightUrl
      };
      
      setOriginalSettings(newSettings);
      setSettings(newSettings);
      setLogoDarkFile(null);
      setLogoLightFile(null);
      setLogoDarkPreview(logoDarkUrl);
      setLogoLightPreview(logoLightUrl);
      
      toast.success('Settings saved successfully!');
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
      
    } catch (error: any) {
      console.error('Error in handleSave:', error);
      toast.error(error.message || 'Failed to save settings');
      setMessage({ type: 'error', text: error.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  function handleLogoDarkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('File must be an image');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setLogoDarkFile(file);
  }

  function handleLogoLightUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('File must be an image');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setLogoLightFile(file);
  }

  function removeLogoDark() {
    setLogoDarkFile(null);
    setLogoDarkPreview(null);
    setSettings({ ...settings, logo_dark_url: null });
  }

  function removeLogoLight() {
    setLogoLightFile(null);
    setLogoLightPreview(null);
    setSettings({ ...settings, logo_light_url: null });
  }

  const hasChanges = 
    JSON.stringify(settings) !== JSON.stringify(originalSettings) || 
    logoDarkFile !== null || 
    logoLightFile !== null;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-4">Loading settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Company Logos Section */}
      <Card>
        <CardHeader>
          <CardTitle>Company Logos</CardTitle>
          <CardDescription>
            Logos used throughout the platform including dashboard, KB viewer, and learner app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Dark Mode Logo */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="logo-dark-upload">Dark Mode Logo</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Recommended: White or light-colored logo on transparent background
              </p>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="relative">
                <div className="border rounded-lg p-4 bg-gray-900 min-w-[200px] flex items-center justify-center">
                  {logoDarkPreview ? (
                    <img
                      src={logoDarkPreview}
                      alt="Dark Mode Logo Preview"
                      className="max-w-[200px] max-h-[100px] object-contain"
                      onError={() => {
                        console.error('Dark logo failed to load');
                        setLogoDarkPreview(null);
                      }}
                    />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No logo uploaded</p>
                    </div>
                  )}
                </div>
                {logoDarkPreview && (
                  <button
                    onClick={removeLogoDark}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex-1">
                <Label htmlFor="logo-dark-upload" className="cursor-pointer">
                  <div className="inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent transition-colors">
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">Upload Dark Logo</span>
                  </div>
                </Label>
                <Input
                  id="logo-dark-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoDarkUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Light Mode Logo */}
          <div className="space-y-4 pt-4 border-t">
            <div>
              <Label htmlFor="logo-light-upload">Light Mode Logo</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Recommended: Dark-colored logo on transparent background
              </p>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="relative">
                <div className="border rounded-lg p-4 bg-white min-w-[200px] flex items-center justify-center">
                  {logoLightPreview ? (
                    <img
                      src={logoLightPreview}
                      alt="Light Mode Logo Preview"
                      className="max-w-[200px] max-h-[100px] object-contain"
                      onError={() => {
                        console.error('Light logo failed to load');
                        setLogoLightPreview(null);
                      }}
                    />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No logo uploaded</p>
                    </div>
                  )}
                </div>
                {logoLightPreview && (
                  <button
                    onClick={removeLogoLight}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex-1">
                <Label htmlFor="logo-light-upload" className="cursor-pointer">
                  <div className="inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent transition-colors">
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">Upload Light Logo</span>
                  </div>
                </Label>
                <Input
                  id="logo-light-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoLightUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KB Privacy Section */}
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base Privacy</CardTitle>
          <CardDescription>
            Control how employees access KB articles via QR codes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              All KB articles require employee PIN authentication for activity tracking
            </AlertDescription>
          </Alert>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <Label htmlFor="guest-access" className="text-base font-medium cursor-pointer">
                Allow Guest Access
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                If enabled, viewers can skip PIN and browse as guest (no activity tracking). If disabled, PIN is required.
              </p>
            </div>
            <Switch
              id="guest-access"
              checked={settings.kb_allow_guest_access}
              onCheckedChange={(checked) => 
                setSettings({ ...settings, kb_allow_guest_access: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={loadSettings}
          disabled={!hasChanges || saving}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="hero-primary"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
