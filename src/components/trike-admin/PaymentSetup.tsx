import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Loader2, CheckCircle2, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

const TRIKE_SERVER_URL = import.meta.env.VITE_TRIKE_SERVER_URL ||
  `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/trike-server`;

interface PaymentSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId?: string;
}

function PaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError('');

    const { error: submitError } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message || 'Payment setup failed');
      setLoading(false);
    } else {
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={!stripe || loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Save Payment Method
      </Button>
    </form>
  );
}

export function PaymentSetup({ open, onOpenChange, organizationId }: PaymentSetupProps) {
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !organizationId) return;
    setClientSecret('');
    setSaved(false);
    setError('');
    createSetupIntent();
  }, [open, organizationId]);

  async function createSetupIntent() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${TRIKE_SERVER_URL}/billing/setup-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ organization_id: organizationId }),
      });
      const data = await response.json();
      if (data.client_secret) {
        setClientSecret(data.client_secret);
      } else {
        setError(data.error || 'Failed to initialize payment setup');
      }
    } catch (err) {
      setError('Failed to connect to payment service');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    onOpenChange(false);
    setTimeout(() => {
      setClientSecret('');
      setSaved(false);
      setError('');
    }, 300);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Setup Payment Method
          </DialogTitle>
        </DialogHeader>

        {saved ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <p className="text-lg font-medium">Payment method saved</p>
            <p className="text-sm text-muted-foreground">
              Your card has been securely saved. You won&apos;t be charged
              until your subscription begins.
            </p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        ) : loading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">
              Initializing secure payment form...
            </p>
          </div>
        ) : error ? (
          <div className="py-4 space-y-3">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="outline" onClick={createSetupIntent}>
              Try Again
            </Button>
          </div>
        ) : clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm onSuccess={() => setSaved(true)} />
          </Elements>
        ) : (
          <p className="py-4 text-sm text-muted-foreground">
            Unable to initialize payment setup. Please try again.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
