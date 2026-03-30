import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, FileText, CreditCard, Phone, Mail } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { supabase, getCurrentUserOrgId } from '../../lib/supabase';
import trikeLogo from '../../assets/trike-logo.png';

export function FrozenDemoScreen() {
  const { t } = useTranslation();
  const [orgData, setOrgData] = useState<{
    name: string;
    logo_dark_url: string | null;
    logo_light_url: string | null;
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
            .select('name, logo_dark_url, logo_light_url')
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
          {(orgData?.logo_dark_url || orgData?.logo_light_url) && (
            <>
              <div className="h-8 w-px bg-border" />
              <img src={orgData.logo_dark_url || orgData.logo_light_url || ''} alt={orgData.name} className="h-10 object-contain" />
            </>
          )}
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-3xl font-bold mb-2">{t('frozenDemo.title')}</h1>
          <p className="text-muted-foreground text-lg">
            {orgData?.name
              ? t('frozenDemo.periodEndedOrg', { name: orgData.name })
              : t('frozenDemo.periodEnded')}
          </p>
          <p className="text-muted-foreground mt-1">
            {t('frozenDemo.readyToUnlock')}
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Schedule a Call */}
          <Card className="border-2 hover:border-primary/40 transition-colors cursor-pointer group">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {t('frozenDemo.scheduleCall')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('frozenDemo.talkToRep')}
              </p>
              <div className="space-y-2">
                <Button className="w-full" variant="outline">
                  <Phone className="h-4 w-4 mr-2" />
                  {t('frozenDemo.requestCall')}
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
                    {t('frozenDemo.readyToStart')}
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5 text-primary" />
                    {t('frozenDemo.activateAccount')}
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasProposal ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t('frozenDemo.proposalReady')}
                  </p>
                  <Button className="w-full">
                    <FileText className="h-4 w-4 mr-2" />
                    {t('frozenDemo.reviewProposal')}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t('frozenDemo.contactForProposal')}
                  </p>
                  <Button className="w-full" variant="outline">
                    <Mail className="h-4 w-4 mr-2" />
                    {t('frozenDemo.contactRep')}
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
