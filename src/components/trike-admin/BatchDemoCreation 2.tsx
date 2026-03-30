import React, { useState, useRef } from 'react';
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
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Loader2, Copy, Check, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { publicAnonKey } from '../../utils/supabase/info';

interface BatchDemoCreationProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

interface BatchResult {
  domain: string;
  status: 'pending' | 'creating' | 'success' | 'error';
  orgName?: string;
  magicLink?: string;
  error?: string;
  relayRunId?: string;
}

const TRIKE_SERVER_URL =
  import.meta.env.VITE_TRIKE_SERVER_URL ||
  `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kgzhlvxzdlexsrozbbxs'}.supabase.co/functions/v1/trike-server`;

export function BatchDemoCreation({ isOpen, onClose, onCreated }: BatchDemoCreationProps) {
  const [domainsText, setDomainsText] = useState('');
  const [demoDays, setDemoDays] = useState('14');
  const [contactEmail, setContactEmail] = useState('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const abortRef = useRef(false);

  const resetForm = () => {
    setDomainsText('');
    setDemoDays('14');
    setContactEmail('');
    setResults([]);
    abortRef.current = false;
  };

  const handleClose = () => {
    abortRef.current = true;
    resetForm();
    onClose();
  };

  const handleStart = async () => {
    const lines = domainsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      toast.error('Enter at least one domain');
      return;
    }
    if (!contactEmail.trim()) {
      toast.error('A fallback contact email is required');
      return;
    }

    abortRef.current = false;
    setRunning(true);

    const initialResults: BatchResult[] = lines.map((domain) => ({
      domain,
      status: 'pending',
    }));
    setResults(initialResults);

    for (let i = 0; i < initialResults.length; i++) {
      if (abortRef.current) break;

      setResults((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: 'creating' } : r))
      );

      try {
        const resp = await fetch(`${TRIKE_SERVER_URL}/demo/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey,
          },
          body: JSON.stringify({
            url: initialResults[i].domain,
            contact_email: contactEmail.trim(),
            demo_days: parseInt(demoDays) || 14,
            origin: window.location.origin,
          }),
        });

        const data = await resp.json();
        if (!resp.ok || !data.success) {
          throw new Error(data.error || 'Failed');
        }

        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: 'success',
                  orgName: data.organization.name,
                  magicLink: data.magic_link || (data.organization?.id ? `${window.location.origin}/?demo_org_id=${data.organization.id}` : undefined),
                  relayRunId: data.enriched_data?.relay_run_id,
                }
              : r
          )
        );
      } catch (err: any) {
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: 'error', error: err.message } : r
          )
        );
      }
    }

    setRunning(false);
    onCreated?.();
  };

  const copyLink = (idx: number, link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const copyAllLinks = () => {
    const links = results
      .filter((r) => r.magicLink)
      .map((r) => `${r.orgName}: ${r.magicLink}`)
      .join('\n');
    if (links) {
      navigator.clipboard.writeText(links);
      toast.success('All links copied!');
    }
  };

  const completedCount = results.filter((r) => r.status === 'success').length;
  const errorCount = results.filter((r) => r.status === 'error').length;
  const totalCount = results.length;
  const isComplete = totalCount > 0 && completedCount + errorCount === totalCount;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Batch Create Demos</DialogTitle>
          <DialogDescription>
            Paste one domain per line. Each will be enriched and provisioned automatically.
          </DialogDescription>
        </DialogHeader>

        {results.length === 0 ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Domains (one per line)</Label>
              <textarea
                className="flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y font-mono"
                value={domainsText}
                onChange={(e) => setDomainsText(e.target.value)}
                placeholder={"acmeconvenience.com\nquickstop.com\nfreshmart.com"}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fallback Contact Email *</Label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="sales@trike.co"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Used as admin email for all created demo orgs
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Demo Duration (days)</Label>
                <Input
                  type="number"
                  min="1"
                  max="90"
                  value={demoDays}
                  onChange={(e) => setDemoDays(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleStart}>
                Create All ({domainsText.split('\n').filter((l) => l.trim()).length} demos)
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex-1 min-h-0 space-y-3">
            {/* Progress */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${((completedCount + errorCount) / totalCount) * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium">
                {completedCount + errorCount}/{totalCount}
              </span>
              {running && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </div>

            {/* Results Table */}
            <ScrollArea className="max-h-[340px]">
              <div className="space-y-2">
                {results.map((r, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                  >
                    <div className="shrink-0">
                      {r.status === 'pending' && (
                        <div className="h-5 w-5 rounded-full border-2 border-muted" />
                      )}
                      {r.status === 'creating' && (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      )}
                      {r.status === 'success' && (
                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                      )}
                      {r.status === 'error' && (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {r.orgName || r.domain}
                      </div>
                      {r.error && (
                        <p className="text-xs text-red-500">{r.error}</p>
                      )}
                      {r.relayRunId && r.status === 'success' && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <span className="inline-block h-1 w-1 rounded-full bg-amber-500 animate-pulse" />
                          Location data fetching (2–3 min)
                        </p>
                      )}
                    </div>
                    {r.magicLink && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 h-7"
                        onClick={() => copyLink(idx, r.magicLink!)}
                      >
                        {copiedIdx === idx ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        r.status === 'success'
                          ? 'border-emerald-500/30 text-emerald-600'
                          : r.status === 'error'
                          ? 'border-red-500/30 text-red-600'
                          : ''
                      }
                    >
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter>
              {isComplete && completedCount > 0 && (
                <Button variant="outline" onClick={copyAllLinks}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All Links
                </Button>
              )}
              <Button onClick={handleClose}>
                {isComplete ? 'Done' : 'Cancel'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
