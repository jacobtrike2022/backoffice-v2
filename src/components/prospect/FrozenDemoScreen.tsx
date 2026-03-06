import React, { useEffect, useState } from 'react';
import { Calendar, FileText, CreditCard, Phone, Mail } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { supabase, getCurrentUserOrgId } from '../../lib/supabase';
import trikeLogo from '../../assets/trike-logo.png';

export function FrozenDemoScreen() {
  const [orgData, setOrgData] = useState<{
    name: string;
    logo_url: string | null;
  } | null>(null);
  const [hasProposal, setHasProposal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const orgId = await getCurrentUserOrgId();
        if (!orgId) return;

        const [{ data: org }, { data: proposals }] = await Promise.all([
          supabase
            .from('organizations')
            .select('name, logo_url')
            .eq('id', orgId)
            .single(),
          supabase
            .from('proposals')
            .select('id')
            .eq('organization_id', orgId)
            .in('status', ['sent', 'viewed'])
            .limit(1),
        ]);

        if (org) setOrgData(org);
        setHasProposal((proposals?.length ?? 0) > 0);
      } catch {
        // Silent
      }
    })();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] -m-8 bg-gradient-to-br from-background to-muted/30">
      <div className="max-w-2xl w-full mx-auto px-6 py-12 text-center space-y-8">
        {/* Logos */}
        <div className="flex items-center justify-center gap-6">
          <img src={trikeLogo} alt="Trike" className="h-10 object-contain" />
          {orgData?.logo_url && (
            <>
              <div className="h-8 w-px bg-border" />
              <img src={orgData.logo_url} alt={orgData.name} className="h-10 object-contain" />
            </>
          )}
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Your Demo Has Expired</h1>
          <p className="text-muted-foreground text-lg">
            {orgData?.name
              ? `The demo period for ${orgData.name} has ended.`
              : 'Your demo period has ended.'}
          </p>
          <p className="text-muted-foreground mt-1">
            Ready to unlock the full platform? Choose an option below to continue.
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Schedule a Call */}
          <Card className="border-2 hover:border-primary/40 transition-colors cursor-pointer group">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Schedule a Call
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Talk to your Trike representative to discuss your needs, ask questions,
                or request a demo extension.
              </p>
              <div className="space-y-2">
                <Button className="w-full" variant="outline">
                  <Phone className="h-4 w-4 mr-2" />
                  Request a Call
                </Button>
                <Button className="w-full" variant="ghost" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  sales@trike.co
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Ready to Get Started */}
          <Card className="border-2 border-primary/30 bg-primary/5 hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                {hasProposal ? (
                  <>
                    <FileText className="h-5 w-5 text-primary" />
                    Ready to Get Started?
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5 text-primary" />
                    Activate Your Account
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasProposal ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    You have a proposal ready for review. Accept it and set up billing
                    to unlock the full Trike platform.
                  </p>
                  <Button className="w-full">
                    <FileText className="h-4 w-4 mr-2" />
                    Review & Accept Proposal
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Contact your Trike representative to receive a proposal and
                    get started with the full platform.
                  </p>
                  <Button className="w-full" variant="outline">
                    <Mail className="h-4 w-4 mr-2" />
                    Contact Your Rep
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
