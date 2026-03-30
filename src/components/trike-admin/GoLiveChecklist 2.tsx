import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface GoLiveChecklistProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  dealId?: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  complete: boolean;
  loading: boolean;
}

export function GoLiveChecklist({ open, onOpenChange, organizationId, dealId }: GoLiveChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    if (!open || !organizationId) return;
    evaluateChecklist();
  }, [open, organizationId]);

  async function evaluateChecklist() {
    const checks: ChecklistItem[] = [
      { id: 'proposal', label: 'Proposal accepted', complete: false, loading: true },
      { id: 'contract', label: 'Contract signed', complete: false, loading: true },
      { id: 'payment', label: 'Payment method on file', complete: false, loading: true },
      { id: 'content', label: 'Content library configured', complete: false, loading: true },
      { id: 'store', label: 'At least one store set up', complete: false, loading: true },
      { id: 'users', label: 'At least one non-admin user created', complete: false, loading: true },
    ];
    setItems(checks);

    // Check proposal status
    if (dealId) {
      const { data: deal } = await supabase
        .from('deals')
        .select('stage, contract_status')
        .eq('id', dealId)
        .single();

      checks[0].complete = deal?.stage === 'won' || deal?.stage === 'closing';
      checks[0].loading = false;
      checks[1].complete = deal?.contract_status === 'signed';
      checks[1].loading = false;
    } else {
      checks[0].loading = false;
      checks[1].loading = false;
    }

    // Check payment method
    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', organizationId)
      .single();
    checks[2].complete = !!org?.stripe_customer_id;
    checks[2].loading = false;

    // Check content
    const { count: trackCount } = await supabase
      .from('tracks')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'published');
    checks[3].complete = (trackCount || 0) >= 1;
    checks[3].loading = false;

    // Check stores
    const { count: storeCount } = await supabase
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId);
    checks[4].complete = (storeCount || 0) >= 1;
    checks[4].loading = false;

    // Check non-admin users (join with roles table per CLAUDE.md rules)
    const { data: users } = await supabase
      .from('users')
      .select('id, role:roles(name)')
      .eq('organization_id', organizationId)
      .eq('status', 'active');
    const nonAdmins = users?.filter((u) => {
      const roleName = (u.role as any)?.name?.toLowerCase() || '';
      return !roleName.includes('admin');
    });
    checks[5].complete = (nonAdmins?.length || 0) >= 1;
    checks[5].loading = false;

    setItems([...checks]);
  }

  const allComplete = items.length > 0 && items.every((i) => i.complete);
  const anyLoading = items.some((i) => i.loading);

  async function handleGoLive() {
    if (!allComplete) return;
    setLaunching(true);
    try {
      await supabase
        .from('organizations')
        .update({ status: 'live' })
        .eq('id', organizationId);

      if (dealId) {
        await supabase
          .from('deals')
          .update({ stage: 'won', actual_close_date: new Date().toISOString() })
          .eq('id', dealId);
      }

      onOpenChange(false);
    } catch (err) {
      console.error('Go-live failed:', err);
    } finally {
      setLaunching(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Go-Live Checklist</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              {item.loading ? (
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              ) : item.complete ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
              <span className={item.complete ? 'text-foreground' : 'text-muted-foreground'}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={handleGoLive}
            disabled={!allComplete || anyLoading || launching}
          >
            {launching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Go Live
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
