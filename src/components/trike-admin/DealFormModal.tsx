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
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  type Deal,
  type DealStage,
  type DealType,
  ALL_STAGES,
  STAGE_CONFIG,
} from './types';
import {
  createDeal,
  updateDeal,
  getOrganizationsForDeals,
  getDealOwnerCandidates,
  type CreateDealInput,
  type UpdateDealInput,
} from '../../lib/crud/deals';

interface DealFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  deal?: Partial<Deal> | null;
  defaultStage?: DealStage;
}

interface OrgOption {
  id: string;
  name: string;
  status: string;
}

interface OwnerOption {
  id: string;
  display_name: string;
  email: string;
}

const DEAL_TYPES: { value: DealType; label: string }[] = [
  { value: 'new', label: 'New Business' },
  { value: 'upsell', label: 'Upsell' },
  { value: 'renewal', label: 'Renewal' },
  { value: 'expansion', label: 'Expansion' },
];

const DEFAULT_PROBABILITIES: Record<DealStage, number> = {
  lead: 10,
  prospect: 25,
  evaluating: 50,
  closing: 75,
  won: 100,
  lost: 0,
  frozen: 0,
};

export function DealFormModal({
  isOpen,
  onClose,
  onSuccess,
  deal,
  defaultStage,
}: DealFormModalProps) {
  const isEditMode = !!deal?.id;

  const [saving, setSaving] = useState(false);
  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [stage, setStage] = useState<DealStage>(defaultStage || 'lead');
  const [dealType, setDealType] = useState<DealType>('new');
  const [value, setValue] = useState('');
  const [mrr, setMrr] = useState('');
  const [probability, setProbability] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDate, setNextActionDate] = useState('');
  const [notes, setNotes] = useState('');

  // Load organizations and owners on open
  useEffect(() => {
    if (!isOpen) return;

    async function loadOptions() {
      try {
        setLoadingOptions(true);
        const [orgs, ownerCandidates] = await Promise.all([
          getOrganizationsForDeals(),
          getDealOwnerCandidates(),
        ]);
        setOrganizations(
          orgs.map((o: any) => ({ id: o.id, name: o.name, status: o.status }))
        );
        setOwners(
          ownerCandidates.map((o: any) => ({
            id: o.id,
            display_name: o.display_name || `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.email,
            email: o.email,
          }))
        );
      } catch (error) {
        console.error('Error loading form options:', error);
      } finally {
        setLoadingOptions(false);
      }
    }

    loadOptions();
  }, [isOpen]);

  // Pre-fill form when editing
  useEffect(() => {
    if (!isOpen) return;

    if (deal?.id) {
      setName(deal.name || '');
      setOrganizationId(deal.organization_id || '');
      setStage(deal.stage || 'lead');
      setDealType(deal.deal_type || 'new');
      setValue(deal.value != null ? String(deal.value) : '');
      setMrr(deal.mrr != null ? String(deal.mrr) : '');
      setProbability(deal.probability != null ? String(deal.probability) : '');
      setOwnerId(deal.owner_id || '');
      setExpectedCloseDate(deal.expected_close_date?.split('T')[0] || '');
      setNextAction(deal.next_action || '');
      setNextActionDate(deal.next_action_date?.split('T')[0] || '');
      setNotes(deal.notes || '');
    } else {
      // Reset for create mode
      setName('');
      setOrganizationId('');
      setStage(defaultStage || 'lead');
      setDealType('new');
      setValue('');
      setMrr('');
      setProbability(String(DEFAULT_PROBABILITIES[defaultStage || 'lead']));
      setOwnerId('');
      setExpectedCloseDate('');
      setNextAction('');
      setNextActionDate('');
      setNotes('');
    }
  }, [isOpen, deal, defaultStage]);

  // Auto-adjust probability when stage changes (only if user hasn't manually changed it)
  const handleStageChange = (newStage: DealStage) => {
    setStage(newStage);
    // Only auto-set probability for new deals or if probability matches the old stage default
    const currentProb = Number(probability);
    const oldDefault = DEFAULT_PROBABILITIES[stage];
    if (!isEditMode || currentProb === oldDefault) {
      setProbability(String(DEFAULT_PROBABILITIES[newStage]));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Deal name is required');
      return;
    }
    if (!organizationId) {
      toast.error('Please select an organization');
      return;
    }

    try {
      setSaving(true);

      if (isEditMode) {
        const updates: UpdateDealInput = {
          name: name.trim(),
          deal_type: dealType,
          stage,
          value: value ? Number(value) : null,
          mrr: mrr ? Number(mrr) : null,
          probability: probability ? Number(probability) : DEFAULT_PROBABILITIES[stage],
          owner_id: ownerId || null,
          expected_close_date: expectedCloseDate || null,
          next_action: nextAction.trim() || null,
          next_action_date: nextActionDate || null,
          notes: notes.trim() || null,
        };
        await updateDeal(deal!.id!, updates);
        toast.success('Deal updated successfully');
      } else {
        const input: CreateDealInput = {
          organization_id: organizationId,
          name: name.trim(),
          deal_type: dealType,
          stage,
          value: value ? Number(value) : null,
          mrr: mrr ? Number(mrr) : null,
          probability: probability ? Number(probability) : DEFAULT_PROBABILITIES[stage],
          owner_id: ownerId || null,
          expected_close_date: expectedCloseDate || null,
          next_action: nextAction.trim() || null,
          next_action_date: nextActionDate || null,
          notes: notes.trim() || null,
        };
        await createDeal(input);
        toast.success('Deal created successfully');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving deal:', error);
      toast.error(`Failed to save deal: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Deal' : 'Create New Deal'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? `Update details for "${deal?.name}"`
              : 'Add a new deal to the pipeline'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Deal Name */}
          <div className="space-y-1.5">
            <Label htmlFor="deal-name">Deal Name *</Label>
            <Input
              id="deal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp - Enterprise Plan"
              required
            />
          </div>

          {/* Organization */}
          <div className="space-y-1.5">
            <Label>Organization *</Label>
            {loadingOptions ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading organizations...
              </div>
            ) : (
              <Select
                value={organizationId || 'none'}
                onValueChange={(v) => setOrganizationId(v === 'none' ? '' : v)}
                disabled={isEditMode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select organization...</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Stage + Deal Type row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select value={stage} onValueChange={(v) => handleStageChange(v as DealStage)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STAGE_CONFIG[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Deal Type</Label>
              <Select value={dealType} onValueChange={(v) => setDealType(v as DealType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_TYPES.map((dt) => (
                    <SelectItem key={dt.value} value={dt.value}>
                      {dt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Value + MRR row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="deal-value">Deal Value ($)</Label>
              <Input
                id="deal-value"
                type="number"
                min="0"
                step="100"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="50000"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deal-mrr">Monthly MRR ($)</Label>
              <Input
                id="deal-mrr"
                type="number"
                min="0"
                step="50"
                value={mrr}
                onChange={(e) => setMrr(e.target.value)}
                placeholder="2500"
              />
            </div>
          </div>

          {/* Probability + Close Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="deal-probability">Probability (%)</Label>
              <Input
                id="deal-probability"
                type="number"
                min="0"
                max="100"
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
                placeholder="50"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deal-close-date">Expected Close</Label>
              <Input
                id="deal-close-date"
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
              />
            </div>
          </div>

          {/* Owner */}
          <div className="space-y-1.5">
            <Label>Deal Owner</Label>
            {loadingOptions ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading owners...
              </div>
            ) : (
              <Select
                value={ownerId || 'none'}
                onValueChange={(v) => setOwnerId(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assign an owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {owners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Next Action + Date row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="next-action">Next Action</Label>
              <Input
                id="next-action"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="e.g. Follow-up call"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="next-action-date">Action Date</Label>
              <Input
                id="next-action-date"
                type="date"
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="deal-notes">Notes</Label>
            <textarea
              id="deal-notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional context or notes about this deal..."
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditMode ? 'Save Changes' : 'Create Deal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
