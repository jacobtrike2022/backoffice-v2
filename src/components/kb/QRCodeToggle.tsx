/**
 * QR Code Toggle Popover
 * Allows admins to enable/disable QR codes for KB articles
 * Shows QR preview and download options
 */

import { useState, useEffect, useRef } from 'react';
import { QrCode, Download, Plus, MapPin, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';
import { toast } from 'sonner@2.0.3';
import { supabase } from '../../lib/supabase';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import {
  generateKBSlug,
  generateKBPublicUrl,
  createQRCode,
  generateFramedQRCanvas,
  downloadCanvasAsPNG,
  downloadQRCodeAsSVG,
  createQRFilename
} from '../../lib/qr-code-utils';

interface QRCodeToggleProps {
  track: any;
  onUpdate?: () => void;
}

export function QRCodeToggle({ track, onUpdate }: QRCodeToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [qrEnabled, setQrEnabled] = useState(track.kb_qr_enabled || false);
  const [qrLocation, setQrLocation] = useState(track.kb_qr_location || '');
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const qrPreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadOrganizationSettings();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && qrEnabled && qrPreviewRef.current) {
      renderQRPreview();
    }
  }, [isOpen, qrEnabled, orgLogoUrl]);

  async function loadOrganizationSettings() {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('kb_logo_url')
        .eq('id', track.organization_id)
        .single();

      if (!error && data) {
        setOrgLogoUrl(data.kb_logo_url);
      }
    } catch (err) {
      console.error('Failed to load org settings:', err);
    }
  }

  async function renderQRPreview() {
    if (!qrPreviewRef.current || !track.kb_slug) return;

    try {
      const url = generateKBPublicUrl(track.kb_slug);
      const qrCode = createQRCode({
        url,
        logoUrl: orgLogoUrl || undefined,
        size: 200
      });

      // Clear previous preview
      qrPreviewRef.current.innerHTML = '';

      // Append QR code
      qrCode.append(qrPreviewRef.current);
    } catch (err) {
      console.error('Failed to render QR preview:', err);
    }
  }

  async function handleQRToggle(enabled: boolean) {
    try {
      setIsGenerating(true);

      if (enabled) {
        // Generate slug if doesn't exist
        let slug = track.kb_slug;
        if (!slug) {
          slug = generateKBSlug(track.title);

          // Check for collision
          const { data: existing } = await supabase
            .from('tracks')
            .select('id')
            .eq('kb_slug', slug)
            .single();

          // If collision, retry with longer ID
          if (existing) {
            slug = generateKBSlug(track.title, 1);
          }
        }

        // Update database - MUST set show_in_knowledge_base for public endpoint to work
        const { error } = await supabase
          .from('tracks')
          .update({
            kb_qr_enabled: true,
            kb_slug: slug,
            show_in_knowledge_base: true,  // ← FIX: Required by /kb/public/:slug endpoint
            status: 'published'             // ← FIX: Also required by endpoint
          })
          .eq('id', track.id);

        if (error) throw error;

        setQrEnabled(true);
        toast.success('QR code enabled! Track is now visible in Knowledge Base.');
        
        // Trigger re-render
        onUpdate?.();
      } else {
        // Toggle OFF
        const { error } = await supabase
          .from('tracks')
          .update({ kb_qr_enabled: false })
          .eq('id', track.id);

        if (error) throw error;

        setQrEnabled(false);
        toast.info('QR code disabled. The link will still work but won\'t be visible.');
        
        onUpdate?.();
      }
    } catch (err: any) {
      console.error('Failed to toggle QR code:', err);
      toast.error(err.message || 'Failed to update QR code settings');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleLocationChange(value: string) {
    setQrLocation(value);

    try {
      const { error } = await supabase
        .from('tracks')
        .update({ kb_qr_location: value })
        .eq('id', track.id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update location:', err);
    }
  }

  async function handleDownloadPNG() {
    if (!track.kb_slug) return;

    try {
      setIsGenerating(true);

      const url = generateKBPublicUrl(track.kb_slug);
      const canvas = await generateFramedQRCanvas({
        url,
        logoUrl: orgLogoUrl || undefined,
        title: track.title,
        location: qrLocation
      });

      const filename = createQRFilename(track.kb_slug, 'png');
      downloadCanvasAsPNG(canvas, filename);

      // Increment download count
      await supabase
        .from('tracks')
        .update({
          kb_qr_downloaded_count: (track.kb_qr_downloaded_count || 0) + 1
        })
        .eq('id', track.id);

      toast.success('QR code downloaded as PNG!');
      onUpdate?.();
    } catch (err: any) {
      console.error('Failed to download PNG:', err);
      toast.error('Failed to download QR code');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDownloadSVG() {
    if (!track.kb_slug) return;

    try {
      setIsGenerating(true);

      const url = generateKBPublicUrl(track.kb_slug);
      const qrCode = createQRCode({
        url,
        logoUrl: orgLogoUrl || undefined
      });

      const filename = createQRFilename(track.kb_slug, 'svg');
      await downloadQRCodeAsSVG(qrCode, filename);

      // Increment download count
      await supabase
        .from('tracks')
        .update({
          kb_qr_downloaded_count: (track.kb_qr_downloaded_count || 0) + 1
        })
        .eq('id', track.id);

      toast.success('QR code downloaded as SVG!');
      onUpdate?.();
    } catch (err: any) {
      console.error('Failed to download SVG:', err);
      toast.error('Failed to download QR code');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={qrEnabled ? "default" : "outline"}
          size="sm"
          className={qrEnabled ? "bg-[#F64A05] hover:bg-[#F64A05]/90" : ""}
        >
          <QrCode className="h-4 w-4 mr-2" />
          {qrEnabled ? "QR Active" : "Enable QR"}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96" align="end">
        <div className="space-y-4">
          {/* Toggle Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="qr-toggle" className="text-base font-semibold">
                QR Code
              </Label>
              <Switch
                id="qr-toggle"
                checked={qrEnabled}
                onCheckedChange={handleQRToggle}
                disabled={isGenerating}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Generate a scannable QR code for this article
            </p>
          </div>

          {/* Location Field - Only shown when QR is enabled */}
          {qrEnabled && track.kb_slug && (
            <>
              <div>
                <Label htmlFor="qr-location" className="text-sm font-medium">
                  Where will this QR code be posted?
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="qr-location"
                    placeholder="e.g., Break Room, Back Office, Near Equipment"
                    value={qrLocation}
                    onChange={(e) => handleLocationChange(e.target.value)}
                  />
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  This location reference appears on the QR code and helps you manage printed codes
                </p>
              </div>

              <Separator />

              {/* QR Preview */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Preview</Label>
                <div className="flex justify-center">
                  <div className="border-4 border-black rounded-lg overflow-hidden bg-white" style={{ width: '240px' }}>
                    {/* Header */}
                    <div className="text-center font-bold py-2 bg-white text-black text-xs">
                      SCAN FOR REFERENCE
                    </div>

                    {/* QR Code */}
                    <div className="p-4 bg-white flex items-center justify-center">
                      <div ref={qrPreviewRef} />
                    </div>

                    {/* Title */}
                    <div className="text-center font-bold py-2 bg-white text-black text-xs leading-tight px-2">
                      {track.title.length > 40
                        ? track.title.substring(0, 40) + '...'
                        : track.title}
                    </div>

                    {/* Location */}
                    {qrLocation && (
                      <div className="text-center text-[10px] text-gray-500 pb-2 px-2">
                        {qrLocation}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Download Buttons */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleDownloadPNG}
                  disabled={isGenerating}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download PNG
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={handleDownloadSVG}
                  disabled={isGenerating}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download SVG
                </Button>
              </div>

              {/* Preview Link - Opens in new window */}
              <div className="text-center">
                <a
                  href={generateKBPublicUrl(track.kb_slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Preview as employee/viewer
                </a>
                <p className="text-xs text-muted-foreground mt-1">
                  See how this article appears when scanned
                </p>
              </div>

              {/* Download Stats */}
              {(track.kb_qr_downloaded_count || 0) > 0 && (
                <p className="text-xs text-center text-muted-foreground pt-2 border-t">
                  Downloaded {track.kb_qr_downloaded_count} time
                  {track.kb_qr_downloaded_count !== 1 ? 's' : ''}
                </p>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}