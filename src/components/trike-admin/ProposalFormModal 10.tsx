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
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import type { Proposal } from './types';
import {
  createProposal,
  updateProposal,
  type CreateProposalInput,
  type UpdateProposalInput,
} from '../../lib/crud/proposals';
import { getDeals } from '../../lib/crud/deals';

// ============================================================================
// TYPES
// ============================================================================

interface ProposalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  proposal?: Partial<Proposal> | null;
}

interface PricingTier {
  name: string;
  price: string;
  interval: 'monthly' | 'annual' | 'one-time';
  features: string;
}

interface ContentSection {
  heading: string;
  body: string;
}

interface DealOption {
  id: string;
  name: string;
  org_id: string;
  org_name: string;
  value: number | null;
}

// ============================================================================
// HELPERS
// ============================================================================

const EMPTY_TIER: PricingTier = { name: '', price: '', interval: 'monthly', features: '' };
const EMPTY_SECTION: ContentSection = { heading: '', body: '' };

function parseTiers(raw: any[]): PricingTier[] {
  if (!Array.isArray(raw) || raw.length === 0) return [{ ...EMPTY_TIER }];
  return raw.map((t) => ({
    name: t.name || '',
    price: t.price != null ? String(t.price) : '',
    interval: t.interval || 'monthly',
    features: Array.isArray(t.features) ? t.features.join('\n') : t.features || '',
  }));
}

function parseSections(raw: Record<string, any>): ContentSection[] {
  if (!raw || typeof raw !== 'object') return [{ ...EMPTY_SECTION }];
  const sections = raw.sections;
  if (Array.isArray(sections) && sections.length > 0) {
    return sections.map((s: any) => ({
      heading: s.heading || '',
      body: s.body || '',
    }));
  }
  return [{ ...EMPTY_SECTION }];
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ProposalFormModal({
  isOpen,
  onClose,
  onSuccess,
  proposal,
}: ProposalFormModalProps) {
  const isEditMode = !!proposal?.id;

  const [saving, setSaving] = useState(false);
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(true);

  // ── Core fields ──
  const [name, setName] = useState('');
  const [dealId, setDealId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');

  // ── Pricing tiers ──
  const [tiers, setTiers] = useState<PricingTier[]>([{ ...EMPTY_TIER }]);

  // ── Content sections ──
  const [sections, setSections] = useState<ContentSection[]>([{ ...EMPTY_SECTION }]);

  // ── Load deals on open ──
  useEffect(() => {
    if (!isOpen) return;
    async function loadDeals() {
      try {
        setLoadingDeals(true);
        const data = await getDeals();
        setDeals(
          data.map((d: any) => ({
            id: d.id,
            name: d.name,
            org_id: d.organization_id,
            org_name: (d.organization as any)?.name || 'Unknown',
            value: d.value,
          }))
        );
      } catch (err) {
        console.error('Error loading deals:', err);
      } finally {
        setLoadingDeals(false);
      }
    }
    loadDeals();
  }, [isOpen]);

  // ── Pre-fill form ──
  useEffect(() => {
    if (!isOpen) return;

    if (proposal?.id) {
      setName(proposal.name || '');
      setDealId(proposal.deal_id || '');
      setOrganizationId(proposal.organization_id || '');
      setOrgName(''); // will be filled from deals list
      setTotalValue(proposal.total_value != null ? String(proposal.total_value) : '');
      setExpiresAt(proposal.expires_at?.split('T')[0] || '');
      setNotes(proposal.notes || '');
      setTiers(parseTiers(proposal.pricing_tiers || []));
      setSections(parseSections(proposal.content_json || {}));
    } else {
      setName('');
      setDealId('');
      setOrganizationId('');
      setOrgName('');
      setTotalValue('');
      setExpiresAt('');
      setNotes('');
      setTiers([{ ...EMPTY_TIER }]);
      setSections([{ ...EMPTY_SECTION }]);
    }
  }, [isOpen, proposal]);

  // ── Auto-fill org from selected deal ──
  const handleDealChange = (selectedDealId: string) => {
    setDealId(selectedDealId === 'none' ? '' : selectedDealId);
    const deal = deals.find((d) => d.id === selectedDealId);
    if (deal) {
      setOrganizationId(deal.org_id);
      setOrgName(deal.org_name);
      if (!totalValue && deal.value) {
        setTotalValue(String(deal.value));
      }
    } else {
      setOrganizationId('');
      setOrgName('');
    }
  };

  // ── Tier management ──
  const updateTier = (index: number, field: keyof PricingTier, value: string) => {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  };
  const addTier = () => setTiers((prev) => [...prev, { ...EMPTY_TIER }]);
  const removeTier = (index: number) => {
    if (tiers.length <= 1) return;
    setTiers((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Section management ──
  const updateSection = (index: number, field: keyof ContentSection, value: string) => {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };
  const addSection = () => setSections((prev) => [...prev, { ...EMPTY_SECTION }]);
  const removeSection = (index: number) => {
    if (sections.length <= 1) return;
    setSections((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Proposal name is required');
      return;
    }
    if (!dealId) {
      toast.error('Please select a deal');
      return;
    }

    // Build pricing_tiers payload (filter out empty tiers)
    const pricingTiers = tiers
      .filter((t) => t.name.trim() || t.price)
      .map((t) => ({
        name: t.name.trim(),
        price: t.price ? Number(t.price) : 0,
        interval: t.interval,
        features: t.features
          .split('\n')
          .map((f) => f.trim())
          .filter(Boolean),
      }));

    // Build content_json payload (filter out empty sections)
    const contentSections = sections
      .filter((s) => s.heading.trim() || s.body.trim())
      .map((s) => ({
        heading: s.heading.trim(),
        body: s.body.trim(),
      }));

    const contentJson = {
      sections: contentSections,
    };

    try {
      setSaving(true);

      if (isEditMode) {
        const updates: UpdateProposalInput = {
          name: name.trim(),
          content_json: contentJson,
          pricing_tiers: pricingTiers,
          total_value: totalValue ? Number(totalValue) : null,
          expires_at: expiresAt || null,
          notes: notes.trim() || null,
        };
        await updateProposal(proposal!.id!, updates);
        toast.success('Proposal updated successfully');
      } else {
        const input: CreateProposalInput = {
          deal_id: dealId,
          organization_id: organizationId,
          name: name.trim(),
          content_json: contentJson,
          pricing_tiers: pricingTiers,
          total_value: totalValue ? Number(totalValue) : null,
          expires_at: expiresAt || null,
          notes: notes.trim() || null,
        };
        await createProposal(input);
        toast.success('Proposal created successfully');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving proposal:', error);
      toast.error(`Failed to save proposal: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Proposal' : 'Create New Proposal'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? `Update "${proposal?.name}"`
              : 'Build a sales proposal with pricing tiers and content sections'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          {/* ─── Cover Info ─── */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Cover Info
            </legend>

            <div className="space-y-1.5">
              <Label htmlFor="proposal-name">Proposal Name *</Label>
              <Input
                id="proposal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corp — Enterprise Training Package"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Deal *</Label>
              {loadingDeals ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading deals...
                </div>
              ) : (
                <Select
                  value={dealId || 'none'}
                  onValueChange={handleDealChange}
                  disabled={isEditMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a deal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select a deal...</SelectItem>
                    {deals.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} — {d.org_name}
                        {d.value ? ` ($${d.value.toLocaleString()})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {orgName && (
                <p className="text-xs text-muted-foreground">
                  Organization: <span className="font-medium">{orgName}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="proposal-value">Total Value ($)</Label>
                <Input
                  id="proposal-value"
                  type="number"
                  min="0"
                  step="100"
                  value={totalValue}
                  onChange={(e) => setTotalValue(e.target.value)}
                  placeholder="50000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proposal-expires">Valid Until</Label>
                <Input
                  id="proposal-expires"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          {/* ─── Pricing Tiers ─── */}
          <fieldset className="space-y-3">
            <div className="flex items-center justify-between">
              <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Pricing Tiers
              </legend>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addTier}
                className="h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Tier
              </Button>
            </div>

            {tiers.map((tier, i) => (
              <div
                key={i}
                className="rounded-lg border border-border p-3 space-y-2 relative"
              >
                {tiers.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeTier(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Tier Name</Label>
                    <Input
                      value={tier.name}
                      onChange={(e) => updateTier(i, 'name', e.target.value)}
                      placeholder="e.g. Starter"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Price ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="50"
                      value={tier.price}
                      onChange={(e) => updateTier(i, 'price', e.target.value)}
                      placeholder="2500"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Interval</Label>
                    <Select
                      value={tier.interval}
                      onValueChange={(v) => updateTier(i, 'interval', v)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                        <SelectItem value="one-time">One-time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Features (one per line)</Label>
                  <textarea
                    className="flex min-h-[56px] w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
                    value={tier.features}
                    onChange={(e) => updateTier(i, 'features', e.target.value)}
                    placeholder="Unlimited users&#10;Priority support&#10;Custom branding"
                  />
                </div>
              </div>
            ))}
          </fieldset>

          {/* ─── Content Sections ─── */}
          <fieldset className="space-y-3">
            <div className="flex items-center justify-between">
              <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Content Sections
              </legend>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addSection}
                className="h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Section
              </Button>
            </div>

            {sections.map((section, i) => (
              <div
                key={i}
                className="rounded-lg border border-border p-3 space-y-2 relative"
              >
                {sections.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSection(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Heading</Label>
                  <Input
                    value={section.heading}
                    onChange={(e) => updateSection(i, 'heading', e.target.value)}
                    placeholder="e.g. Value Proposition"
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Content</Label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
                    value={section.body}
                    onChange={(e) => updateSection(i, 'body', e.target.value)}
                    placeholder="Describe this section of the proposal..."
                  />
                </div>
              </div>
            ))}
          </fieldset>

          {/* ─── Notes ─── */}
          <div className="space-y-1.5">
            <Label htmlFor="proposal-notes">Internal Notes</Label>
            <textarea
              id="proposal-notes"
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes (not visible to the prospect)..."
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditMode ? 'Save Changes' : 'Create Proposal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
