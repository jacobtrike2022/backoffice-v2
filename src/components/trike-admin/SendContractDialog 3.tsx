import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Loader2, CheckCircle2, FileSignature } from 'lucide-react';
import { sendContract } from '../../lib/crud/contracts';

interface SendContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId?: string;
  organizationName?: string;
}

export function SendContractDialog({
  open,
  onOpenChange,
  dealId,
  organizationName,
}: SendContractDialogProps) {
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // Default template ID (can be made configurable later)
  const templateId = 'trike-service-agreement';

  async function handleSend() {
    if (!dealId || !signerName || !signerEmail) return;

    setSending(true);
    setError('');

    try {
      await sendContract({
        deal_id: dealId,
        template_id: templateId,
        signer_name: signerName,
        signer_email: signerEmail,
      });
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send contract');
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    onOpenChange(false);
    // Reset state after close animation
    setTimeout(() => {
      setSignerName('');
      setSignerEmail('');
      setSent(false);
      setError('');
    }, 300);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Send Agreement
          </DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <p className="text-lg font-medium">Contract sent!</p>
            <p className="text-sm text-muted-foreground">
              An e-signature request has been sent to {signerEmail}.
              You&apos;ll be notified when they sign.
            </p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              {organizationName && (
                <div className="text-sm text-muted-foreground">
                  Sending service agreement for <strong>{organizationName}</strong>
                </div>
              )}

              <div>
                <Label htmlFor="signer-name">Signer Name</Label>
                <Input
                  id="signer-name"
                  placeholder="Jane Smith"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="signer-email">Signer Email</Label>
                <Input
                  id="signer-email"
                  type="email"
                  placeholder="jane@company.com"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                />
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={!signerName || !signerEmail || !dealId || sending}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send for Signature
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
