import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Calendar,
  Building2,
  Award,
  MapPin
} from 'lucide-react';
import { uploadCertificationDocument } from '../../lib/services/uploadService';
import { createExternalCertificationUpload } from '../../lib/crud/certifications';
import { getCurrentUserOrgId, supabase } from '../../lib/supabase';

// Common certification types
const CERTIFICATE_TYPES = [
  { value: 'TABC', label: 'TABC (Texas Alcoholic Beverage Commission)' },
  { value: 'ServSafe Food Handler', label: 'ServSafe Food Handler' },
  { value: 'ServSafe Manager', label: 'ServSafe Manager' },
  { value: 'ServSafe Alcohol', label: 'ServSafe Alcohol' },
  { value: 'Food Handler', label: 'Food Handler Certificate' },
  { value: 'Food Manager', label: 'Food Manager Certificate' },
  { value: 'Allergen Awareness', label: 'Allergen Awareness' },
  { value: 'CPR/First Aid', label: 'CPR/First Aid' },
  { value: 'OSHA 10', label: 'OSHA 10-Hour' },
  { value: 'OSHA 30', label: 'OSHA 30-Hour' },
  { value: 'Other', label: 'Other' }
];

// US States
const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' }
];

interface ExternalCertificationUploadProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ExternalCertificationUpload({
  onSuccess,
  onCancel
}: ExternalCertificationUploadProps) {
  const { t } = useTranslation();
  // Form state
  const [certificateType, setCertificateType] = useState('');
  const [customType, setCustomType] = useState('');
  const [certificateNumber, setCertificateNumber] = useState('');
  const [nameOnCertificate, setNameOnCertificate] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [trainingProvider, setTrainingProvider] = useState('');
  const [stateIssued, setStateIssued] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  }, []);

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);

    // Check file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Please upload a PDF or image file (JPEG, PNG, WebP)');
      return;
    }

    // Check file size (10MB max)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    const finalCertType = certificateType === 'Other' ? customType : certificateType;
    if (!finalCertType) {
      setError('Please select or enter a certificate type');
      return;
    }
    if (!nameOnCertificate) {
      setError('Please enter the name on the certificate');
      return;
    }
    if (!issuingAuthority) {
      setError('Please enter the issuing authority');
      return;
    }
    if (!issueDate) {
      setError('Please enter the issue date');
      return;
    }
    if (!file) {
      setError('Please upload a certificate document');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Get org ID and user ID
      const orgId = await getCurrentUserOrgId();
      if (!orgId) throw new Error('Not authenticated');

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');

      const { data: currentUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', authUser.id)
        .single();

      if (!currentUser) throw new Error('User profile not found');

      // Upload the document
      const uploadResult = await uploadCertificationDocument(
        file,
        orgId,
        currentUser.id,
        (progress) => setUploadProgress(progress)
      );

      if (!uploadResult.success || !uploadResult.path || !uploadResult.signedUrl) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      // Create the upload record
      await createExternalCertificationUpload({
        certificate_type: finalCertType,
        certificate_number: certificateNumber || undefined,
        name_on_certificate: nameOnCertificate,
        issuing_authority: issuingAuthority,
        training_provider: trainingProvider || undefined,
        state_issued: stateIssued || undefined,
        issue_date: issueDate,
        expiry_date: expiryDate || undefined,
        document_url: uploadResult.signedUrl,
        document_storage_path: uploadResult.path
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
      }, 1500);

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload certification');
    } finally {
      setUploading(false);
    }
  };

  if (success) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {t('compliance.upload.successTitle')}
            </h3>
            <p className="text-muted-foreground">
              {t('compliance.upload.successDesc')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          {t('compliance.upload.title')}
        </CardTitle>
        <CardDescription>
          {t('compliance.upload.subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Certificate Type */}
          <div className="space-y-2">
            <Label htmlFor="certificateType">Certificate Type *</Label>
            <Select value={certificateType} onValueChange={setCertificateType}>
              <SelectTrigger>
                <SelectValue placeholder="Select certificate type" />
              </SelectTrigger>
              <SelectContent>
                {CERTIFICATE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {certificateType === 'Other' && (
              <Input
                placeholder="Enter certificate type"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {/* Certificate Number */}
          <div className="space-y-2">
            <Label htmlFor="certificateNumber">Certificate Number</Label>
            <Input
              id="certificateNumber"
              placeholder="e.g., ABC123456"
              value={certificateNumber}
              onChange={(e) => setCertificateNumber(e.target.value)}
            />
          </div>

          {/* Name on Certificate */}
          <div className="space-y-2">
            <Label htmlFor="nameOnCertificate">Name on Certificate *</Label>
            <Input
              id="nameOnCertificate"
              placeholder="Name as it appears on the certificate"
              value={nameOnCertificate}
              onChange={(e) => setNameOnCertificate(e.target.value)}
              required
            />
          </div>

          {/* Issuing Authority */}
          <div className="space-y-2">
            <Label htmlFor="issuingAuthority">
              <Building2 className="h-4 w-4 inline mr-1" />
              Issuing Authority *
            </Label>
            <Input
              id="issuingAuthority"
              placeholder="e.g., TABC, ServSafe, State Health Department"
              value={issuingAuthority}
              onChange={(e) => setIssuingAuthority(e.target.value)}
              required
            />
          </div>

          {/* Training Provider */}
          <div className="space-y-2">
            <Label htmlFor="trainingProvider">Training Provider</Label>
            <Input
              id="trainingProvider"
              placeholder="Organization that provided the training"
              value={trainingProvider}
              onChange={(e) => setTrainingProvider(e.target.value)}
            />
          </div>

          {/* State */}
          <div className="space-y-2">
            <Label htmlFor="stateIssued">
              <MapPin className="h-4 w-4 inline mr-1" />
              State Issued
            </Label>
            <Select value={stateIssued} onValueChange={setStateIssued}>
              <SelectTrigger>
                <SelectValue placeholder="Select state (if applicable)" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state.value} value={state.value}>
                    {state.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issueDate">
                <Calendar className="h-4 w-4 inline mr-1" />
                Issue Date *
              </Label>
              <Input
                id="issueDate"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiryDate">
                <Calendar className="h-4 w-4 inline mr-1" />
                Expiry Date
              </Label>
              <Input
                id="expiryDate"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Certificate Document *</Label>
            <div
              className={`
                border-2 border-dashed rounded-lg p-6 text-center transition-colors
                ${dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
                }
                ${file ? 'bg-green-50 dark:bg-green-900/20 border-green-300' : ''}
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-green-600" />
                  <div className="text-left">
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                    className="ml-4"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag and drop your certificate here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: PDF, JPEG, PNG, WebP (max 10MB)
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={handleFileInput}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </>
              )}
            </div>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} />
              <p className="text-sm text-muted-foreground text-center">
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={uploading}
                className="flex-1"
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={uploading || !file}
              className="flex-1"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Submit for Review
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
