import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Calendar,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Building2,
  Mail,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';
import {
  getProposals,
  updateProposalStatus,
  type Proposal,
  type ProposalStatus,
} from '../../lib/crud/proposals';
import { getCurrentUserOrgId } from '../../lib/supabase';
import { toast } from 'sonner';

interface ProposalViewProps {
  onAccepted?: () => void;
}

const STATUS_CONFIG: Record<
  ProposalStatus,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Mail },
  viewed: { label: 'Under Review', color: 'bg-amber-100 text-amber-700', icon: Clock },
  accepted: { label: 'Accepted', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  rejected: { label: 'Declined', color: 'bg-red-100 text-red-700', icon: XCircle },
  expired: { label: 'Expired', color: 'bg-gray-100 text-gray-500', icon: AlertTriangle },
  superseded: { label: 'Superseded', color: 'bg-gray-100 text-gray-500', icon: FileText },
};

export function ProposalView({ onAccepted }: ProposalViewProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProposal, setActiveProposal] = useState<Proposal | null>(null);
  const [showDeclineReason, setShowDeclineReason] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    pricing: true,
    terms: false,
    scope: false,
  });
  useEffect(() => {
    loadProposals();
  }, []);

  const loadProposals = async () => {
    try {
      const orgId = await getCurrentUserOrgId();
      if (!orgId) return;

      const data = await getProposals({
        organization_id: orgId,
        status: ['sent', 'viewed', 'accepted', 'rejected'],
      });

      setProposals(data);

      const active = data.find(
        (p) => p.status === 'sent' || p.status === 'viewed'
      );
      if (active) {
        if (active.status === 'sent') {
          const viewed = await updateProposalStatus(active.id, 'viewed');
          setActiveProposal(viewed || { ...active, status: 'viewed' });
        } else {
          setActiveProposal(active);
        }
      } else if (data.length > 0) {
        setActiveProposal(data[0]);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!activeProposal) return;
    setSubmitting(true);
    try {
      const updated = await updateProposalStatus(activeProposal.id, 'accepted');
      if (updated) {
        setActiveProposal(updated);
        setProposals((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        );
        toast.success('Proposal Accepted — your representative will be in touch about next steps.');
        onAccepted?.();
      }
    } catch {
      toast.error('Failed to accept proposal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!activeProposal) return;
    setSubmitting(true);
    try {
      const updated = await updateProposalStatus(activeProposal.id, 'rejected', {
        rejection_reason: declineReason || undefined,
      });
      if (updated) {
        setActiveProposal(updated);
        setProposals((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        );
        setShowDeclineReason(false);
        setDeclineReason('');
        toast.success('Proposal declined — your feedback has been shared with your representative.');
      }
    } catch {
      toast.error('Failed to decline proposal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Review Your Proposal</h2>
        <Card>
          <CardContent className="p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!activeProposal) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Review Your Proposal</h2>
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Proposal Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Your Trike representative is preparing a customized proposal for your
              organization. You'll be notified when it's ready to review.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => {
              window.location.href = 'mailto:sales@trikeapp.com?subject=Proposal%20Request';
            }}>
              <Mail className="h-4 w-4 mr-2" />
              Contact Your Rep
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = STATUS_CONFIG[activeProposal.status] || STATUS_CONFIG.sent;
  const StatusIcon = statusInfo.icon;
  const isActionable =
    activeProposal.status === 'sent' || activeProposal.status === 'viewed';
  const content = activeProposal.content_json || {};
  const pricingTiers = activeProposal.pricing_tiers || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Review Your Proposal</h2>
        <Badge className={cn('gap-1', statusInfo.color)}>
          <StatusIcon className="h-3.5 w-3.5" />
          {statusInfo.label}
        </Badge>
      </div>

      {/* Proposal Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{activeProposal.name}</CardTitle>
              <CardDescription className="mt-1">
                Version {activeProposal.version} &middot; Created{' '}
                {formatDate(activeProposal.created_at)}
              </CardDescription>
            </div>
            {activeProposal.total_value != null && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(activeProposal.total_value)}
                </p>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Pricing Tiers */}
      {pricingTiers.length > 0 && (
        <Card>
          <button
            className="w-full text-left px-6 py-4 flex items-center justify-between"
            onClick={() => toggleSection('pricing')}
          >
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <span className="font-semibold">Pricing</span>
            </div>
            {expandedSections.pricing ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {expandedSections.pricing && (
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {pricingTiers.map((tier: any, idx: number) => (
                  <Card
                    key={idx}
                    className={cn(
                      'relative',
                      tier.recommended && 'border-primary shadow-md',
                      activeProposal.selected_tier === tier.name &&
                        'ring-2 ring-primary'
                    )}
                  >
                    {tier.recommended && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground text-xs">
                          Recommended
                        </Badge>
                      </div>
                    )}
                    <CardContent className="p-5 text-center">
                      <h4 className="font-semibold mb-1">{tier.name || `Tier ${idx + 1}`}</h4>
                      {tier.price != null && (
                        <p className="text-2xl font-bold mb-1">
                          {formatCurrency(tier.price)}
                          {tier.interval && (
                            <span className="text-sm font-normal text-muted-foreground">
                              /{tier.interval}
                            </span>
                          )}
                        </p>
                      )}
                      {tier.description && (
                        <p className="text-xs text-muted-foreground mb-3">
                          {tier.description}
                        </p>
                      )}
                      {tier.features && (
                        <ul className="text-xs text-left space-y-1.5 mt-3">
                          {(tier.features as string[]).map((f: string, fi: number) => (
                            <li key={fi} className="flex items-start gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Proposal Content Sections */}
      {content.scope && (
        <Card>
          <button
            className="w-full text-left px-6 py-4 flex items-center justify-between"
            onClick={() => toggleSection('scope')}
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="font-semibold">Scope & Deliverables</span>
            </div>
            {expandedSections.scope ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {expandedSections.scope && (
            <CardContent className="pt-0">
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: content.scope }}
              />
            </CardContent>
          )}
        </Card>
      )}

      {content.terms && (
        <Card>
          <button
            className="w-full text-left px-6 py-4 flex items-center justify-between"
            onClick={() => toggleSection('terms')}
          >
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-semibold">Terms & Conditions</span>
            </div>
            {expandedSections.terms ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {expandedSections.terms && (
            <CardContent className="pt-0">
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: content.terms }}
              />
            </CardContent>
          )}
        </Card>
      )}

      {activeProposal.notes && (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground italic">
              "{activeProposal.notes}"
            </p>
            {activeProposal.creator && (
              <p className="text-xs text-muted-foreground mt-2">
                — {activeProposal.creator.first_name} {activeProposal.creator.last_name}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Expiry Notice */}
      {activeProposal.expires_at && isActionable && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
          <Calendar className="h-4 w-4 shrink-0" />
          <span>
            This proposal expires on {formatDate(activeProposal.expires_at)}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      {isActionable && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            {!showDeclineReason ? (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-semibold">Ready to move forward?</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Accept this proposal to start the onboarding process.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeclineReason(true)}
                    disabled={submitting}
                  >
                    Decline
                  </Button>
                  <Button
                    onClick={handleAccept}
                    disabled={submitting}
                    className="min-w-[140px]"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Accept Proposal
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-semibold">
                  We'd love to understand your concerns
                </h3>
                <Textarea
                  placeholder="Optional: Let us know why this proposal doesn't work for you..."
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  rows={3}
                />
                <div className="flex items-center gap-3 justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowDeclineReason(false);
                      setDeclineReason('');
                    }}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDecline}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Confirm Decline'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Accepted State */}
      {activeProposal.status === 'accepted' && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
            <h3 className="font-semibold text-lg mb-1">Proposal Accepted</h3>
            <p className="text-sm text-muted-foreground">
              Your Trike representative will be in touch to set up billing and begin
              onboarding.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Rejected State */}
      {activeProposal.status === 'rejected' && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
          <CardContent className="p-6 text-center">
            <XCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <h3 className="font-semibold text-lg mb-1">Proposal Declined</h3>
            <p className="text-sm text-muted-foreground">
              Your feedback has been shared with your representative. Feel free to
              reach out if you'd like to discuss further.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                window.location.href =
                  'mailto:sales@trikeapp.com?subject=Proposal%20Discussion';
              }}
            >
              <Mail className="h-4 w-4 mr-2" />
              Contact Your Rep
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
