import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Loader2, Copy, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface CreateDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const TRIKE_SERVER_URL =
  import.meta.env.VITE_TRIKE_SERVER_URL ||
  `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kgzhlvxzdlexsrozbbxs'}.supabase.co/functions/v1/trike-server`;

export function CreateDemoModal({ isOpen, onClose, onCreated }: CreateDemoModalProps) {
  const [domainUrl, setDomainUrl] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactName, setContactName] = useState('');
  const [demoDays, setDemoDays] = useState('14');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{
    orgId: string;
    orgName: string;
    magicLink: string | null;
    enrichedData?: any;
  } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const resetForm = () => {
    setDomainUrl('');
    setCompanyName('');
    setContactEmail('');
    setContactName('');
    setDemoDays('14');
    setResult(null);
    setLinkCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactEmail.trim()) {
      toast.error('Contact email is required');
      return;
    }
    if (!domainUrl.trim() && !companyName.trim()) {
      toast.error('Provide either a domain URL or company name');
      return;
    }

    try {
      setCreating(true);
      const resp = await fetch(`${TRIKE_SERVER_URL}/demo/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: domainUrl.trim() || undefined,
          organization_name: companyName.trim() || undefined,
          contact_email: contactEmail.trim(),
          contact_name: contactName.trim() || undefined,
          demo_days: parseInt(demoDays) || 14,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to create demo');
      }

      setResult({
        orgId: data.organization.id,
        orgName: data.organization.name,
        magicLink: data.magic_link,
        enrichedData: data.enriched_data,
      });

      toast.success(`Demo created for ${data.organization.name}`);
      onCreated?.();
    } catch (error: any) {
      console.error('Error creating demo:', error);
      toast.error(error.message || 'Failed to create demo');
    } finally {
      setCreating(false);
    }
  };

  const copyLink = () => {
    if (result?.magicLink) {
      navigator.clipboard.writeText(result.magicLink);
      setLinkCopied(true);
      toast.success('Magic link copied!');
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Demo</DialogTitle>
          <DialogDescription>
            Create a new demo environment for a prospect. Optionally provide a website to auto-enrich company data.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="domain-url">Domain URL (optional)</Label>
              <Input
                id="domain-url"
                value={domainUrl}
                onChange={(e) => setDomainUrl(e.target.value)}
                placeholder="e.g. acmeconvenience.com"
              />
              <p className="text-xs text-muted-foreground">
                If provided, we'll scrape the website for logo, states, and industry
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="company-name">
                Company Name {domainUrl ? '(auto-detected from domain)' : '*'}
              </Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Convenience Stores"
                required={!domainUrl}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="contact-email">Contact Email *</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="john@acme.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-name">Contact Name</Label>
                <Input
                  id="contact-name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="John Smith"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="demo-days">Demo Duration (days)</Label>
              <Input
                id="demo-days"
                type="number"
                min="1"
                max="90"
                value={demoDays}
                onChange={(e) => setDemoDays(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Demo
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-4">
              <h3 className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                Demo Created Successfully
              </h3>
              <p className="text-sm text-emerald-600 dark:text-emerald-500">
                {result.orgName}
              </p>
              {result.enrichedData && (
                <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                  {result.enrichedData.industry && (
                    <p>Industry: {result.enrichedData.industry}</p>
                  )}
                  {result.enrichedData.operating_states?.length > 0 && (
                    <p>States: {result.enrichedData.operating_states.join(', ')}</p>
                  )}
                </div>
              )}
            </div>

            {result.magicLink && (
              <div className="space-y-2">
                <Label>Magic Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={result.magicLink}
                    readOnly
                    className="text-xs font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyLink}
                    className="shrink-0"
                  >
                    {linkCopied ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                }}
              >
                Create Another
              </Button>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
