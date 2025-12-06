import { useState, useEffect } from 'react';
import { supabase, getCurrentUserOrgId } from '../lib/supabase';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { 
  Lock, 
  Globe, 
  Users, 
  Eye, 
  EyeOff, 
  Upload, 
  X,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Sun,
  Moon
} from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import trikeLogoDark from 'figma:asset/d284bc7ee411198fb15ff6e1e42fef256815e21f.png';

type PrivacyMode = 'public' | 'password' | 'employee_login';

interface OrgSettings {
  kb_privacy_mode: PrivacyMode;
  kb_shared_password: string;
  kb_logo_dark: string;
  kb_logo_light: string;
}

export function KBSettings() {
  const [settings, setSettings] = useState<OrgSettings>({
    kb_privacy_mode: 'public',
    kb_shared_password: '',
    kb_logo_dark: trikeLogoDark, // Default to Trike logo
    kb_logo_light: trikeLogoDark  // Default to Trike logo
  });
  const [originalSettings, setOriginalSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [logoDarkFile, setLogoDarkFile] = useState<File | null>(null);
  const [logoLightFile, setLogoLightFile] = useState<File | null>(null);
  const [logoDarkPreview, setLogoDarkPreview] = useState<string>(trikeLogoDark);
  const [logoLightPreview, setLogoLightPreview] = useState<string>(trikeLogoDark);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (logoDarkFile) {
      const url = URL.createObjectURL(logoDarkFile);
      setLogoDarkPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [logoDarkFile]);

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
        .select('kb_privacy_mode, kb_shared_password, kb_logo_dark, kb_logo_light')
        .eq('id', orgId)
        .single();

      if (error) {
        console.warn('Error loading KB settings (columns may not exist yet):', error);
        // Set defaults even if columns don't exist
        const defaultSettings = {
          kb_privacy_mode: 'public' as PrivacyMode,
          kb_shared_password: '',
          kb_logo_dark: trikeLogoDark,
          kb_logo_light: trikeLogoDark
        };
        setSettings(defaultSettings);
        setOriginalSettings(defaultSettings);
        setLogoDarkPreview(trikeLogoDark);
        setLogoLightPreview(trikeLogoDark);
        setLoading(false);
        return;
      }

      const loadedSettings = {
        kb_privacy_mode: (data?.kb_privacy_mode || 'public') as PrivacyMode,
        kb_shared_password: data?.kb_shared_password || '',
        kb_logo_dark: data?.kb_logo_dark || trikeLogoDark,
        kb_logo_light: data?.kb_logo_light || trikeLogoDark
      };

      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);
      setLogoDarkPreview(loadedSettings.kb_logo_dark);
      setLogoLightPreview(loadedSettings.kb_logo_light);
    } catch (error) {
      console.error('Error loading KB settings:', error);
      // Don't show error message, just use defaults
      const defaultSettings = {
        kb_privacy_mode: 'public' as PrivacyMode,
        kb_shared_password: '',
        kb_logo_dark: trikeLogoDark,
        kb_logo_light: trikeLogoDark
      };
      setSettings(defaultSettings);
      setOriginalSettings(defaultSettings);
      setLogoDarkPreview(trikeLogoDark);
      setLogoLightPreview(trikeLogoDark);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setMessage(null);
      const orgId = await getCurrentUserOrgId();

      let logoDarkUrl = settings.kb_logo_dark;
      let logoLightUrl = settings.kb_logo_light;

      // Upload dark logo if file selected
      if (logoDarkFile) {
        const fileExt = logoDarkFile.name.split('.').pop();
        const fileName = `kb-logo-dark-${orgId}-${Date.now()}.${fileExt}`;
        const filePath = `org-logos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('public-assets')
          .upload(filePath, logoDarkFile, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          console.error('Upload error for dark logo:', uploadError);
          throw new Error(`Failed to upload dark logo: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('public-assets')
          .getPublicUrl(filePath);

        logoDarkUrl = urlData.publicUrl;
      }

      // Upload light logo if file selected
      if (logoLightFile) {
        const fileExt = logoLightFile.name.split('.').pop();
        const fileName = `kb-logo-light-${orgId}-${Date.now()}.${fileExt}`;
        const filePath = `org-logos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('public-assets')
          .upload(filePath, logoLightFile, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          console.error('Upload error for light logo:', uploadError);
          throw new Error(`Failed to upload light logo: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('public-assets')
          .getPublicUrl(filePath);

        logoLightUrl = urlData.publicUrl;
      }

      // Save settings via backend endpoint (bypasses RLS)
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || publicAnonKey;
      
      console.log('💾 Saving KB settings:', {
        kb_privacy_mode: settings.kb_privacy_mode,
        kb_logo_dark: logoDarkUrl,
        kb_logo_light: logoLightUrl
      });

      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b/organization/kb-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          organizationId: orgId,
          kb_privacy_mode: settings.kb_privacy_mode,
          kb_shared_password: settings.kb_shared_password,
          kb_logo_dark: logoDarkUrl,
          kb_logo_light: logoLightUrl
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend response error:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ KB settings saved successfully:', result);

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      
      const newSettings = { 
        ...settings, 
        kb_logo_dark: logoDarkUrl,
        kb_logo_light: logoLightUrl
      };
      
      setOriginalSettings(newSettings);
      setSettings(newSettings);
      setLogoDarkFile(null);
      setLogoLightFile(null);
      setLogoDarkPreview(logoDarkUrl);
      setLogoLightPreview(logoLightUrl);
    } catch (error: any) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  function handleLogoDarkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setLogoDarkFile(file);
    }
  }

  function handleLogoLightUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setLogoLightFile(file);
    }
  }

  function removeLogoDark() {
    setLogoDarkFile(null);
    setLogoDarkPreview(trikeLogoDark);
    setSettings({ ...settings, kb_logo_dark: trikeLogoDark });
  }

  function removeLogoLight() {
    setLogoLightFile(null);
    setLogoLightPreview(trikeLogoDark);
    setSettings({ ...settings, kb_logo_light: trikeLogoDark });
  }

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings) || logoDarkFile !== null || logoLightFile !== null;

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

      {/* Privacy Mode */}
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base Privacy</CardTitle>
          <CardDescription>
            Control who can access your public Knowledge Base articles via QR codes and links
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {/* Public Option */}
            <label
              className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                settings.kb_privacy_mode === 'public'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <input
                type="radio"
                name="privacy"
                value="public"
                checked={settings.kb_privacy_mode === 'public'}
                onChange={(e) => setSettings({ ...settings, kb_privacy_mode: e.target.value as PrivacyMode })}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="w-4 h-4 text-green-600" />
                  <span className="font-medium">Public Access</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Anyone with the QR code or link can view articles. No login required.
                </p>
              </div>
            </label>

            {/* Password Option */}
            <label
              className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                settings.kb_privacy_mode === 'password'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <input
                type="radio"
                name="privacy"
                value="password"
                checked={settings.kb_privacy_mode === 'password'}
                onChange={(e) => setSettings({ ...settings, kb_privacy_mode: e.target.value as PrivacyMode })}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="w-4 h-4 text-orange-600" />
                  <span className="font-medium">Password Protected</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Viewers must enter a shared password to access articles.
                </p>
              </div>
            </label>

            {/* Employee Login Option */}
            <label
              className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                settings.kb_privacy_mode === 'employee_login'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <input
                type="radio"
                name="privacy"
                value="employee_login"
                checked={settings.kb_privacy_mode === 'employee_login'}
                onChange={(e) => setSettings({ ...settings, kb_privacy_mode: e.target.value as PrivacyMode })}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-red-600" />
                  <span className="font-medium">Employee Login Required</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Only authenticated employees can view articles. Requires login.
                </p>
              </div>
            </label>
          </div>

          {/* Password Input (shown when password mode selected) */}
          {settings.kb_privacy_mode === 'password' && (
            <div className="pt-4 border-t">
              <Label htmlFor="shared-password">Shared Password</Label>
              <div className="relative mt-2">
                <Input
                  id="shared-password"
                  type={showPassword ? 'text' : 'password'}
                  value={settings.kb_shared_password}
                  onChange={(e) => setSettings({ ...settings, kb_shared_password: e.target.value })}
                  placeholder="Enter password..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                This password will be shared with viewers who scan QR codes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logo Upload - Dark Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="w-5 h-5" />
            Dark Mode Logo
          </CardTitle>
          <CardDescription>
            Logo shown when viewers have dark mode enabled
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative inline-block">
            <div className="border rounded-lg p-4 bg-gray-900">
              <img
                src={logoDarkPreview}
                alt="KB Logo Dark Mode Preview"
                className="h-16 object-contain"
              />
            </div>
            {logoDarkPreview !== trikeLogoDark && (
              <button
                onClick={removeLogoDark}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div>
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
            <p className="text-xs text-muted-foreground mt-2">
              Recommended: White or light-colored logo on transparent background
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Logo Upload - Light Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="w-5 h-5" />
            Light Mode Logo
          </CardTitle>
          <CardDescription>
            Logo shown when viewers have light mode enabled
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative inline-block">
            <div className="border rounded-lg p-4 bg-white">
              <img
                src={logoLightPreview}
                alt="KB Logo Light Mode Preview"
                className="h-16 object-contain"
              />
            </div>
            {logoLightPreview !== trikeLogoDark && (
              <button
                onClick={removeLogoLight}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div>
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
            <p className="text-xs text-muted-foreground mt-2">
              Recommended: Dark-colored logo on transparent background
            </p>
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