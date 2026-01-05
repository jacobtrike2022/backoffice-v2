import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Switch } from './ui/switch';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Footer } from './Footer';
import {
  CreditCard,
  Building2,
  FileText,
  Download,
  ExternalLink,
  Users,
  Shield,
  Eye,
  Edit,
  Trash2,
  Plus,
  Check,
  X,
  Search,
  Link as LinkIcon,
  Settings as SettingsIcon,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Image,
  Upload,
  ImageIcon,
  Mail
} from 'lucide-react';
import { EmailSettings } from './Settings/EmailSettings';
import { toast } from 'sonner@2.0.3';
import { supabase, getCurrentUserOrgId } from '../lib/supabase';

interface Invoice {
  id: string;
  date: string;
  amount: string;
  status: 'paid' | 'pending';
  downloadUrl: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  userCount: number;
  permissions: string[];
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  customPermissions?: string[];
}

const mockInvoices: Invoice[] = [
  { id: 'INV-2024-001', date: '2024-01-01', amount: '$12,500.00', status: 'paid', downloadUrl: '#' },
  { id: 'INV-2023-012', date: '2023-12-01', amount: '$12,500.00', status: 'paid', downloadUrl: '#' },
  { id: 'INV-2023-011', date: '2023-11-01', amount: '$12,500.00', status: 'paid', downloadUrl: '#' },
  { id: 'INV-2023-010', date: '2023-10-01', amount: '$12,500.00', status: 'paid', downloadUrl: '#' },
];

const defaultRoles: Role[] = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access with all permissions',
    userCount: 3,
    permissions: ['all']
  },
  {
    id: 'district',
    name: 'District Manager',
    description: 'Manage multiple stores within assigned district',
    userCount: 12,
    permissions: ['view_all_stores', 'manage_district', 'view_reports', 'assign_content', 'view_people']
  },
  {
    id: 'store',
    name: 'Store Manager',
    description: 'Manage individual store operations',
    userCount: 48,
    permissions: ['view_own_store', 'manage_employees', 'view_store_reports', 'assign_content']
  }
];

const mockUsers: User[] = [
  { id: '1', name: 'Sarah Johnson', email: 'sarah.j@company.com', role: 'Administrator' },
  { id: '2', name: 'Mike Chen', email: 'mike.c@company.com', role: 'District Manager' },
  { id: '3', name: 'Emily Davis', email: 'emily.d@company.com', role: 'Store Manager' },
  { id: '4', name: 'James Wilson', email: 'james.w@company.com', role: 'Store Manager', customPermissions: ['view_reports'] },
];

const hrisIntegrations = [
  { id: 'workday', name: 'Workday', logo: '💼' },
  { id: 'adp', name: 'ADP Workforce Now', logo: '🔴' },
  { id: 'bamboohr', name: 'BambooHR', logo: '🎋' },
  { id: 'ukg', name: 'UKG', logo: '🏢' },
  { id: 'namely', name: 'Namely', logo: '📊' },
  { id: 'rippling', name: 'Rippling', logo: '💧' },
  { id: 'gusto', name: 'Gusto', logo: '💚' },
  { id: 'paylocity', name: 'Paylocity', logo: '💳' },
  { id: 'paychex', name: 'Paychex', logo: '📈' },
  { id: 'zenefits', name: 'Zenefits', logo: '⚡' },
  { id: 'hibob', name: 'HiBob', logo: '👋' },
  { id: 'personio', name: 'Personio', logo: '🎯' },
];

interface SettingsProps {
  onBackToDashboard?: () => void;
  currentRole?: string;
}

export function Settings({ onBackToDashboard, currentRole }: SettingsProps) {
  const [activeTab, setActiveTab] = useState('billing');
  const [showHRISModal, setShowHRISModal] = useState(false);
  const [showSandboxModal, setShowSandboxModal] = useState(false);
  const [hrisSearchQuery, setHrisSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  
  // Company info state
  const [companyInfo, setCompanyInfo] = useState({
    name: 'Acme Corporation',
    address: '123 Business Ave',
    city: 'San Francisco',
    state: 'CA',
    zip: '94102',
    phone: '(555) 123-4567',
    email: 'info@acme.com',
    website: 'www.acme.com'
  });

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState({
    cardNumber: '**** **** **** 4242',
    expiry: '12/2025',
    cardHolder: 'John Smith'
  });

  // Default password state
  const [useUniquePasswords, setUseUniquePasswords] = useState(true);
  const [companyPassword, setCompanyPassword] = useState('');
  const [isPasswordMasked, setIsPasswordMasked] = useState(true);

  // Logo state
  const [organizationId, setOrganizationId] = useState<string>('');
  const [orgLogoState, setOrgLogoState] = useState<{
    logo_dark_url: string | null;
    logo_light_url: string | null;
  }>({
    logo_dark_url: null,
    logo_light_url: null
  });
  const [logoDarkFile, setLogoDarkFile] = useState<File | null>(null);
  const [logoLightFile, setLogoLightFile] = useState<File | null>(null);
  const [savingLogos, setSavingLogos] = useState(false);

  const filteredHRIS = hrisIntegrations.filter(hris =>
    hris.name.toLowerCase().includes(hrisSearchQuery.toLowerCase())
  );

  const handleHRISClick = (hris: typeof hrisIntegrations[0]) => {
    setShowHRISModal(false);
    setShowSandboxModal(true);
  };

  const handleSaveCompanyInfo = async () => {
    try {
      if (!organizationId) {
        toast.error('Organization not found');
        return;
      }

      const { error } = await supabase
        .from('organizations')
        .update({ 
          name: companyInfo.name,
          street_address: companyInfo.address,
          city: companyInfo.city,
          state: companyInfo.state,
          zip_code: companyInfo.zip,
          phone: companyInfo.phone,
          email: companyInfo.email,
          website: companyInfo.website
        })
        .eq('id', organizationId);

      if (error) throw error;

      toast.success('Company information updated successfully');
      
      // Trigger header update
      window.dispatchEvent(new Event('organization-updated'));
    } catch (error: any) {
      console.error('Error saving company info:', error);
      toast.error('Failed to update company information', { 
        description: error.message 
      });
    }
  };

  const handleUpdatePaymentMethod = () => {
    toast.success('Payment method updated successfully');
  };

  const handleSaveDefaultPassword = () => {
    if (!useUniquePasswords && companyPassword) {
      toast.success('Default password configuration saved', {
        description: `All new users will now be created with the company-wide password. This setting is now live.`
      });
    } else {
      toast.success('Default password configuration saved', {
        description: 'All new users will receive unique random passwords at account creation.'
      });
    }
  };

  const handlePasswordBlur = () => {
    if (companyPassword && !isPasswordMasked) {
      setIsPasswordMasked(true);
    }
  };

  // Fetch organization data (name and logos) on mount
  useEffect(() => {
    const fetchOrgData = async () => {
      try {
        const orgId = await getCurrentUserOrgId();
        if (!orgId) return;

        setOrganizationId(orgId);

        const { data: org } = await supabase
          .from('organizations')
          .select('name, street_address, city, state, zip_code, phone, email, website, logo_dark_url, logo_light_url')
          .eq('id', orgId)
          .single();

        if (org) {
          setOrgLogoState({
            logo_dark_url: org.logo_dark_url,
            logo_light_url: org.logo_light_url
          });
          
          // Update company info state with all org data
          setCompanyInfo({
            name: org.name || '',
            address: org.street_address || '',
            city: org.city || '',
            state: org.state || '',
            zip: org.zip_code || '',
            phone: org.phone || '',
            email: org.email || '',
            website: org.website || ''
          });
        }
      } catch (error) {
        console.error('Error fetching org data:', error);
      }
    };

    fetchOrgData();
  }, []);

  // Logo upload handlers
  const handleDarkLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum file size is 5MB' });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file type', { description: 'Please upload an image file' });
      return;
    }

    setLogoDarkFile(file);
    
    // Create preview
    const url = URL.createObjectURL(file);
    setOrgLogoState(prev => ({ ...prev, logo_dark_url: url }));
  };

  const handleLightLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum file size is 5MB' });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file type', { description: 'Please upload an image file' });
      return;
    }

    setLogoLightFile(file);
    
    // Create preview
    const url = URL.createObjectURL(file);
    setOrgLogoState(prev => ({ ...prev, logo_light_url: url }));
  };

  const handleRemoveLogo = async (mode: 'dark' | 'light') => {
    try {
      const orgId = await getCurrentUserOrgId();
      if (!orgId) throw new Error('Organization not found');

      const column = mode === 'dark' ? 'logo_dark_url' : 'logo_light_url';

      const { error } = await supabase
        .from('organizations')
        .update({ [column]: null })
        .eq('id', orgId);

      if (error) throw error;

      setOrgLogoState(prev => ({ ...prev, [column]: null }));
      if (mode === 'dark') {
        setLogoDarkFile(null);
      } else {
        setLogoLightFile(null);
      }
      toast.success(`${mode === 'dark' ? 'Dark' : 'Light'} mode logo removed`);
    } catch (error: any) {
      toast.error('Failed to remove logo', { description: error.message });
    }
  };

  const handleSaveLogos = async () => {
    try {
      setSavingLogos(true);
      const orgId = await getCurrentUserOrgId();
      if (!orgId) throw new Error('Organization not found');

      let logoDarkUrl = orgLogoState.logo_dark_url;
      let logoLightUrl = orgLogoState.logo_light_url;

      // Upload dark logo if file selected
      if (logoDarkFile) {
        const timestamp = Date.now();
        const ext = logoDarkFile.name.split('.').pop();
        const filename = `${orgId}-dark-${timestamp}.${ext}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('organization-logos')
          .upload(filename, logoDarkFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('organization-logos')
          .getPublicUrl(filename);

        logoDarkUrl = urlData.publicUrl;
      }

      // Upload light logo if file selected
      if (logoLightFile) {
        const timestamp = Date.now();
        const ext = logoLightFile.name.split('.').pop();
        const filename = `${orgId}-light-${timestamp}.${ext}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('organization-logos')
          .upload(filename, logoLightFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('organization-logos')
          .getPublicUrl(filename);

        logoLightUrl = urlData.publicUrl;
      }

      // Update organization record
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          logo_dark_url: logoDarkUrl,
          logo_light_url: logoLightUrl
        })
        .eq('id', orgId);

      if (updateError) throw updateError;

      setLogoDarkFile(null);
      setLogoLightFile(null);
      setOrgLogoState({
        logo_dark_url: logoDarkUrl,
        logo_light_url: logoLightUrl
      });

      toast.success('Logos saved successfully');
    } catch (error: any) {
      console.error('Error saving logos:', error);
      toast.error('Failed to save logos', { description: error.message || 'Please try again' });
    } finally {
      setSavingLogos(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account, billing, integrations, and permissions
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-1">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
        </TabsList>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          {/* Contract Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-primary" />
                <span>Contract Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-muted-foreground">Contract Type</Label>
                  <p className="font-semibold mt-1">Enterprise - Standard</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Contract Term</Label>
                  <p className="font-semibold mt-1">3 Years</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Start Date</Label>
                  <p className="font-semibold mt-1">January 1, 2023</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Renewal Date</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <p className="font-semibold">January 1, 2026</p>
                    <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Frequency</Label>
                  <p className="font-semibold mt-1">Quarterly</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between bg-accent/30 p-4 rounded-lg">
                <div>
                  <p className="font-medium">Need to make changes to your contract?</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Contact your dedicated account representative for assistance
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Contact Rep
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <span>Payment Method</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <Input 
                    id="cardNumber"
                    value={paymentMethod.cardNumber}
                    onChange={(e) => setPaymentMethod({...paymentMethod, cardNumber: e.target.value})}
                    placeholder="**** **** **** 4242"
                  />
                </div>
                <div>
                  <Label htmlFor="expiry">Expiry Date</Label>
                  <Input 
                    id="expiry"
                    value={paymentMethod.expiry}
                    onChange={(e) => setPaymentMethod({...paymentMethod, expiry: e.target.value})}
                    placeholder="MM/YYYY"
                  />
                </div>
                <div>
                  <Label htmlFor="cardHolder">Card Holder Name</Label>
                  <Input 
                    id="cardHolder"
                    value={paymentMethod.cardHolder}
                    onChange={(e) => setPaymentMethod({...paymentMethod, cardHolder: e.target.value})}
                    placeholder="John Smith"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  className="bg-brand-gradient text-white shadow-brand hover:opacity-90 border-0"
                  onClick={handleUpdatePaymentMethod}
                >
                  Update Payment Method
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Invoice History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span>Invoice History</span>
                </div>
                <Badge variant="outline">{mockInvoices.length} invoices</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mockInvoices.map((invoice) => (
                  <div 
                    key={invoice.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-semibold">{invoice.id}</p>
                        <p className="text-sm text-muted-foreground">{invoice.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-semibold">{invoice.amount}</p>
                        <Badge 
                          variant="outline"
                          className={invoice.status === 'paid' 
                            ? 'bg-green-100 text-green-700 border-green-200' 
                            : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                          }
                        >
                          {invoice.status}
                        </Badge>
                      </div>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Company Tab */}
        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-5 w-5 text-primary" />
                <span>Company Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input 
                    id="companyName"
                    value={companyInfo.name}
                    onChange={(e) => setCompanyInfo({...companyInfo, name: e.target.value})}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input 
                    id="address"
                    value={companyInfo.address}
                    onChange={(e) => setCompanyInfo({...companyInfo, address: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input 
                    id="city"
                    value={companyInfo.city}
                    onChange={(e) => setCompanyInfo({...companyInfo, city: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input 
                      id="state"
                      value={companyInfo.state}
                      onChange={(e) => setCompanyInfo({...companyInfo, state: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input 
                      id="zip"
                      value={companyInfo.zip}
                      onChange={(e) => setCompanyInfo({...companyInfo, zip: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input 
                    id="phone"
                    value={companyInfo.phone}
                    onChange={(e) => setCompanyInfo({...companyInfo, phone: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input 
                    id="email"
                    type="email"
                    value={companyInfo.email}
                    onChange={(e) => setCompanyInfo({...companyInfo, email: e.target.value})}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="website">Website</Label>
                  <Input 
                    id="website"
                    value={companyInfo.website}
                    onChange={(e) => setCompanyInfo({...companyInfo, website: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  className="bg-brand-gradient text-white shadow-brand hover:opacity-90 border-0"
                  onClick={handleSaveCompanyInfo}
                >
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Company Logos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Image className="h-5 w-5 text-primary" />
                <span>Company Logos</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Logos used throughout the platform including dashboard, KB viewer, and learner app
              </p>

              {/* Dark Mode Logo Section */}
              <div className="space-y-3">
                <div>
                  <Label>Dark Mode Logo</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Recommended: White or light-colored logo on transparent background
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Logo Preview */}
                  <div className="w-48 h-32 rounded-lg border-2 border-border bg-[#0f172a] flex items-center justify-center p-4">
                    {orgLogoState.logo_dark_url ? (
                      <img 
                        src={orgLogoState.logo_dark_url} 
                        alt="Dark mode logo preview"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="text-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">No logo uploaded</p>
                      </div>
                    )}
                  </div>

                  {/* Upload Button */}
                  <div>
                    <input
                      type="file"
                      id="darkLogoInput"
                      accept="image/*"
                      onChange={handleDarkLogoUpload}
                      className="hidden"
                    />
                    <label htmlFor="darkLogoInput">
                      <Button 
                        variant="outline" 
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById('darkLogoInput')?.click();
                        }}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Dark Logo
                      </Button>
                    </label>
                    {orgLogoState.logo_dark_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 text-red-600 hover:text-red-700"
                        onClick={() => handleRemoveLogo('dark')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Light Mode Logo Section */}
              <div className="space-y-3">
                <div>
                  <Label>Light Mode Logo</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Recommended: Dark-colored logo on transparent background
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Logo Preview */}
                  <div className="w-48 h-32 rounded-lg border-2 border-border bg-white flex items-center justify-center p-4">
                    {orgLogoState.logo_light_url ? (
                      <img 
                        src={orgLogoState.logo_light_url} 
                        alt="Light mode logo preview"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="text-center">
                        <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-xs text-gray-500">No logo uploaded</p>
                      </div>
                    )}
                  </div>

                  {/* Upload Button */}
                  <div>
                    <input
                      type="file"
                      id="lightLogoInput"
                      accept="image/*"
                      onChange={handleLightLogoUpload}
                      className="hidden"
                    />
                    <label htmlFor="lightLogoInput">
                      <Button 
                        variant="outline"
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById('lightLogoInput')?.click();
                        }}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Light Logo
                      </Button>
                    </label>
                    {orgLogoState.logo_light_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 text-red-600 hover:text-red-700"
                        onClick={() => handleRemoveLogo('light')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button 
                  className="bg-brand-gradient text-white shadow-brand hover:opacity-90 border-0"
                  onClick={handleSaveLogos}
                  disabled={savingLogos}
                >
                  {savingLogos ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Default Password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-primary" />
                <span>Default Password</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start space-x-3">
                <Checkbox 
                  id="uniquePasswords"
                  checked={useUniquePasswords}
                  onCheckedChange={(checked) => setUseUniquePasswords(checked as boolean)}
                />
                <Label htmlFor="uniquePasswords" className="cursor-pointer">
                  <p className="font-medium">Issue unique random passwords for all new users at account creation</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Each new user will receive a unique, randomly-generated password when their account is created
                  </p>
                </Label>
              </div>

              {!useUniquePasswords && (
                <div className="space-y-3 pl-7 border-l-2 border-primary/20">
                  <div>
                    <Label htmlFor="companyPassword">Company-Wide Password</Label>
                    <p className="text-xs text-muted-foreground mt-1 mb-2">
                      This password will be assigned to all new users starting from this point forward
                    </p>
                    <div className="relative">
                      <Input 
                        id="companyPassword"
                        type={isPasswordMasked ? 'password' : 'text'}
                        value={companyPassword}
                        onChange={(e) => {
                          setCompanyPassword(e.target.value);
                          setIsPasswordMasked(false);
                        }}
                        onBlur={handlePasswordBlur}
                        onFocus={() => setIsPasswordMasked(false)}
                        placeholder="Enter company-wide password"
                        className="pr-10"
                      />
                      {companyPassword && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setIsPasswordMasked(!isPasswordMasked)}
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex justify-end">
                <Button 
                  className="bg-brand-gradient text-white shadow-brand hover:opacity-90 border-0"
                  onClick={handleSaveDefaultPassword}
                  disabled={!useUniquePasswords && !companyPassword}
                >
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <LinkIcon className="h-5 w-5 text-primary" />
                  <span>HRIS Integrations</span>
                </CardTitle>
                <Button 
                  disabled 
                  variant="outline"
                  className="opacity-50 cursor-not-allowed"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Manual Sync
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-accent/30 p-4 rounded-lg">
                <div className="flex items-start space-x-3">
                  <SettingsIcon className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">Connect Your HRIS System</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Sync employee data automatically from your HR information system. This enables automatic employee onboarding, role updates, and seamless data management.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <LinkIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No HRIS Connected</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect your HRIS to automatically sync employee data
                </p>
                <Button 
                  className="bg-brand-gradient text-white shadow-brand hover:opacity-90 border-0"
                  onClick={() => setShowHRISModal(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Connect HRIS
                </Button>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100">Secure Integration</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      All integrations are powered by Merge.dev with enterprise-grade security and compliance standards. Your data is encrypted in transit and at rest.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sync History Report */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-primary" />
                <span>Sync History</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">BambooHR</p>
                      <p className="text-xs text-muted-foreground">Model: Company • Dec 15, 2024 at 2:30 AM</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-green-200">Complete</Badge>
                </div>

                <div className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">BambooHR</p>
                      <p className="text-xs text-muted-foreground">Model: Employee • Dec 15, 2024 at 2:30 AM</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-green-200">Complete</Badge>
                </div>

                <div className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">BambooHR</p>
                      <p className="text-xs text-muted-foreground">Model: Employment • Dec 15, 2024 at 2:31 AM</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-green-200">Complete</Badge>
                </div>

                <div className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">BambooHR</p>
                      <p className="text-xs text-muted-foreground">Model: Location • Dec 15, 2024 at 2:31 AM</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-green-200">Complete</Badge>
                </div>

                <div className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">BambooHR</p>
                      <p className="text-xs text-muted-foreground">Model: Company • Dec 14, 2024 at 2:30 AM</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-green-200">Complete</Badge>
                </div>

                <div className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">BambooHR</p>
                      <p className="text-xs text-muted-foreground">Model: Employee • Dec 14, 2024 at 2:30 AM</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-green-200">Complete</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <span>Error Logs</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start justify-between p-4 border-2 border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-red-900 dark:text-red-100">HRIS Connection Error</p>
                      <p className="text-sm text-red-800 dark:text-red-200 mt-1">
                        HRIS connection needs to be resynced due to expired API keys
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Error Date: Dec 16, 2024 at 2:30 AM</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200 flex-shrink-0">
                    Pending
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-6">
          {/* Default Roles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-primary" />
                <span>Default Roles & Permissions</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {defaultRoles.map((role) => (
                  <Card key={role.id} className="border-2">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-semibold text-lg">{role.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <Badge variant="outline">{role.userCount} users</Badge>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedRole(role);
                              setShowPermissionsModal(true);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* User Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span>User Permissions</span>
                </div>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mockUsers.map((user) => (
                  <div 
                    key={user.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-semibold text-primary">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <Badge variant="outline" className="bg-primary/10">
                          {user.role}
                        </Badge>
                        {user.customPermissions && user.customPermissions.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            +{user.customPermissions.length} custom permission{user.customPermissions.length > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Permission Groups */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <span>Custom Permission Groups</span>
                </div>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Group
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No custom permission groups created yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create custom groups to assign specific permissions to multiple users
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value="email" className="space-y-6">
          <EmailSettings />
        </TabsContent>
      </Tabs>

      {/* HRIS Selection Modal */}
      <Dialog open={showHRISModal} onOpenChange={setShowHRISModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select integration</DialogTitle>
            <DialogDescription>
              Choose an HRIS system to integrate with your Trike account
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search"
                value={hrisSearchQuery}
                onChange={(e) => setHrisSearchQuery(e.target.value)}
                className="pl-10 bg-accent/50"
              />
            </div>

            {/* HRIS Grid */}
            <div className="grid grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {filteredHRIS.map((hris) => (
                <button
                  key={hris.id}
                  onClick={() => handleHRISClick(hris)}
                  className="flex flex-col items-center justify-center p-4 border-2 border-border rounded-lg hover:border-primary hover:bg-accent/50 transition-all group"
                >
                  <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                    {hris.logo}
                  </div>
                  <span className="text-xs text-center font-medium">{hris.name}</span>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sandbox Environment Modal */}
      <Dialog open={showSandboxModal} onOpenChange={setShowSandboxModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sandbox Environment</DialogTitle>
            <DialogDescription>
              This is a test environment for demonstration purposes
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-6">
            <div className="h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <p className="text-muted-foreground mb-6">
              This is a sandbox environment, please reach out to your dedicated Trike Success Manager to create a live account for your company!
            </p>
            <Button 
              className="bg-brand-gradient text-white shadow-brand hover:opacity-90 border-0 w-full"
              onClick={() => setShowSandboxModal(false)}
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Permissions Modal */}
      <Dialog open={showPermissionsModal} onOpenChange={setShowPermissionsModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedRole?.name} Permissions</DialogTitle>
            <DialogDescription>
              View all permissions assigned to this role
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{selectedRole?.description}</p>
            
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="space-y-2">
                {selectedRole?.permissions.map((permission, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-accent rounded-lg">
                    <span className="text-sm capitalize">{permission.replace(/_/g, ' ')}</span>
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Users with this role</span>
                <Badge variant="outline">{selectedRole?.userCount} users</Badge>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
}