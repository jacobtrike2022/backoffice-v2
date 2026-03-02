import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import {
  Rocket,
  CheckCircle2,
  Loader2,
  Copy,
  ExternalLink,
  Shield,
  Zap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner@2.0.3';

interface DemoProvisioningModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
}

type ProvisioningStatus = 'idle' | 'preparing' | 'creating' | 'configuring' | 'completed' | 'failed';

/**
 * DemoProvisioningModal - Handles the "One-Click Demo" setup process
 * This clones template content and configures a prospect organization for a live demo.
 */
export function DemoProvisioningModal({
  isOpen,
  onClose,
  organizationId,
  organizationName,
}: DemoProvisioningModalProps) {
  const [status, setStatus] = useState<ProvisioningStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [demoUrl, setDemoUrl] = useState('');

  const steps = [
    { id: 'preparing', label: 'Preparing demo environment' },
    { id: 'creating', label: 'Cloning template content' },
    { id: 'configuring', label: 'Finalizing configuration' },
  ];

  const handleStartProvisioning = async () => {
    try {
      setStatus('preparing');
      setProgress(10);

      // Step 1: Update organization status and set demo expiry
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 14); // 14-day demo

      const { error: orgError } = await supabase
        .from('organizations')
        .update({
          status: 'prospect',
          demo_expires_at: expiryDate.toISOString(),
          onboarding_source: 'sales_demo',
        })
        .eq('id', organizationId);

      if (orgError) throw orgError;

      setStatus('creating');
      setProgress(40);

      // Step 2: Trigger the provisioning edge function
      // In a real environment, this would call a Supabase Edge Function to clone data
      // For this prototype, we'll simulate the delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      setProgress(70);

      setStatus('configuring');
      await new Promise(resolve => setTimeout(resolve, 1500));
      setProgress(100);

      // Final Step: Generate the demo URL
      const url = `${window.location.origin}/?demo_org_id=${organizationId}`;
      setDemoUrl(url);
      setStatus('completed');

      toast.success('Demo environment provisioned successfully!');
    } catch (error: any) {
      console.error('Provisioning failed:', error);
      setStatus('failed');
      toast.error('Failed to provision demo: ' + error.message);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(demoUrl);
    toast.success('Demo URL copied to clipboard');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Provision Demo Environment
          </DialogTitle>
          <DialogDescription>
            Set up a live demo environment for <strong>{organizationName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {status === 'idle' && (
            <div className="space-y-4 text-center">
              <div className="bg-primary/10 p-4 rounded-lg inline-flex items-center justify-center mb-2">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                This will create a dedicated demo instance with pre-loaded compliance content,
                simulated employee data, and localized regulatory tracks.
              </p>
            </div>
          )}

          {(status === 'preparing' || status === 'creating' || status === 'configuring') && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span>Setting up...</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <div className="space-y-3">
                {steps.map((step) => {
                  const isDone = progress >= 100 || (status === 'creating' && step.id === 'preparing') || (status === 'configuring' && (step.id === 'preparing' || step.id === 'creating'));
                  const isActive = status === step.id;

                  return (
                    <div key={step.id} className="flex items-center gap-3">
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : isActive ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
                      )}
                      <span className={cn(
                        "text-sm",
                        isActive ? "font-medium text-foreground" : "text-muted-foreground"
                      )}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {status === 'completed' && (
            <div className="space-y-6">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                <h4 className="font-semibold text-emerald-700 dark:text-emerald-400">Environment Ready</h4>
                <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
                  The demo instance for {organizationName} is now live.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Prospect Access URL
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-muted p-2 rounded border text-xs font-mono truncate items-center flex">
                    {demoUrl}
                  </div>
                  <Button size="sm" variant="outline" onClick={copyUrl}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {status === 'failed' && (
            <div className="text-center py-4">
              <p className="text-red-500 text-sm font-medium">Provisioning failed. Please try again or contact engineering.</p>
              <Button variant="outline" className="mt-4" onClick={() => setStatus('idle')}>
                Retry
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          {status === 'idle' && (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleStartProvisioning} className="gap-2">
                <Zap className="h-4 w-4" />
                Start Provisioning
              </Button>
            </>
          )}
          {status === 'completed' && (
            <>
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={() => window.open(demoUrl, '_blank')} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Open Demo
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
