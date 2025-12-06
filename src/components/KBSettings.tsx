import React, { useState, useEffect } from 'react';
import { supabase, getCurrentUserOrgId } from '../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
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
  Image as ImageIcon
} from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

type PrivacyMode = 'public' | 'password' | 'employee_login';

interface OrgSettings {
  kb_privacy_mode: PrivacyMode;
  kb_shared_password: string;
  kb_logo_url: string;
}

export function KBSettings() {
  const [settings, setSettings] = useState<OrgSettings>({
    kb_privacy_mode: 'public',
    kb_shared_password: '',
    kb_logo_url: ''
  });
  const [originalSettings, setOriginalSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (logoFile) {
      const url = URL.createObjectURL(logoFile);
      setLogoPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [logoFile]);

  async function loadSettings() {
    try {
      setLoading(true);
      const orgId = await getCurrentUserOrgId();

      const { data, error } = await supabase
        .from('organizations')
        .select('kb_privacy_mode, kb_shared_password, kb_logo_url')
        .eq('id', orgId)
        .single();

      if (error) throw error;

      const loadedSettings = {
        kb_privacy_mode: (data?.kb_privacy_mode || 'public') as PrivacyMode,
        kb_shared_password: data?.kb_shared_password || '',
        kb_logo_url: data?.kb_logo_url || ''
      };

      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);
      setLogoPreview(loadedSettings.kb_logo_url);
    } catch (error) {
      console.error('Error loading KB settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setMessage(null);
      const orgId = await getCurrentUserOrgId();

      let logoUrl = settings.kb_logo_url;

      // Upload logo if file selected
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `kb-logo-${orgId}-${Date.now()}.${fileExt}`;
        const filePath = `org-logos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('public-assets')
          .upload(filePath, logoFile, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('public-assets')
          .getPublicUrl(filePath);

        logoUrl = urlData.publicUrl;
      }

      // Save settings
      const { error } = await supabase
        .from('organizations')
        .update({
          kb_privacy_mode: settings.kb_privacy_mode,
          kb_shared_password: settings.kb_shared_password,
          kb_logo_url: logoUrl
        })
        .eq('id', orgId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setOriginalSettings({ ...settings, kb_logo_url: logoUrl });
      setSettings({ ...settings, kb_logo_url: logoUrl });
      setLogoFile(null);
      setLogoPreview(logoUrl);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setLogoFile(file);
    }
  }

  function removeLogo() {
    setLogoFile(null);
    setLogoPreview('');
    setSettings({ ...settings, kb_logo_url: '' });
  }

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings) || logoFile !== null;

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

      {/* Logo Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base Logo</CardTitle>
          <CardDescription>
            Display your organization logo on public KB article pages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {logoPreview ? (
            <div className="relative inline-block">
              <img
                src={logoPreview}
                alt="KB Logo Preview"
                className="h-16 object-contain border rounded-lg p-2 bg-white"
              />
              <button
                onClick={removeLogo}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <ImageIcon className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">No logo uploaded</p>
            </div>
          )}

          <div>
            <Label htmlFor="logo-upload" className="cursor-pointer">
              <div className="inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent transition-colors">
                <Upload className="w-4 h-4" />
                <span className="text-sm">{logoPreview ? 'Change Logo' : 'Upload Logo'}</span>
              </div>
            </Label>
            <Input
              id="logo-upload"
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Recommended: PNG or SVG with transparent background, max 2MB
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