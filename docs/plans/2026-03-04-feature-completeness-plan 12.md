# Feature Completeness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the prospect portal (6 journey steps), wire notification email delivery, and fix 5 operational polish items.

**Architecture:** Extend the existing `trike-server` Deno edge function with `/contracts/*` and `/billing/*` endpoint groups for eSignatures.io and Stripe integrations. All third-party secrets stay server-side. Frontend components follow existing patterns using Radix UI, Tailwind, and the Supabase client from `src/lib/supabase.ts`.

**Tech Stack:** React 18 + TypeScript + Vite, Supabase (Postgres + Edge Functions + pg_net), eSignatures.io API, Stripe (Setup Intents), Resend (email delivery)

**Design Doc:** `docs/plans/2026-03-04-feature-completeness-design.md`

---

## Phase 1: Quick Wins (~1 hour)

### Task 1.1: Fix Recipe Hardcoded IDs

**Files:**
- Modify: `src/components/recipes/RecipeBuilder.tsx:33-34`
- Modify: `src/components/recipes/RecipeList.tsx:28`
- Modify: `src/components/recipes/IngredientSearch.tsx:23`

**Step 1: Fix RecipeBuilder.tsx**

Replace lines 33-34:
```typescript
// REMOVE:
const organizationId = 'demo-org-id'; // TODO: Get from auth context
const userId = 'demo-user-id'; // TODO: Get from auth context

// ADD:
import { getCurrentUserProfile, getCurrentUserOrgId } from '../../lib/supabase';

// Inside the component, replace the hardcoded values with state:
const [organizationId, setOrganizationId] = useState<string>('');
const [userId, setUserId] = useState<string>('');

useEffect(() => {
  async function loadAuth() {
    const orgId = await getCurrentUserOrgId();
    const profile = await getCurrentUserProfile();
    if (orgId) setOrganizationId(orgId);
    if (profile) setUserId(profile.id);
  }
  loadAuth();
}, []);
```

**Step 2: Fix RecipeList.tsx**

Replace line 28 with the same pattern — import `getCurrentUserOrgId`, call in useEffect, store in state.

**Step 3: Fix IngredientSearch.tsx**

Replace line 23 with the same pattern — import `getCurrentUserOrgId`, call in useEffect, store in state.

**Step 4: Verify no other hardcoded demo IDs remain**

Run: `grep -r "demo-org-id\|demo-user-id" src/`

Expected: No results (or only backup files with " 2" suffix)

**Step 5: Commit**

```bash
git add src/components/recipes/RecipeBuilder.tsx src/components/recipes/RecipeList.tsx src/components/recipes/IngredientSearch.tsx
git commit -m "fix: replace hardcoded demo IDs in recipe components with auth context"
```

---

### Task 1.2: Email From Address — Environment Variable

**Files:**
- Modify: `supabase/functions/trike-server/index.ts:8989`

**Step 1: Replace hardcoded email**

At line 8989, change:
```typescript
// BEFORE:
from: params.from || "Trike <noreply@notifications.trike.co>",

// AFTER:
from: params.from || Deno.env.get("EMAIL_FROM_ADDRESS") || "Trike <noreply@notifications.trike.co>",
```

**Step 2: Commit**

```bash
git add supabase/functions/trike-server/index.ts
git commit -m "fix: make email from address configurable via EMAIL_FROM_ADDRESS env var"
```

**Step 3: Set env var in Supabase**

Run:
```bash
npx supabase secrets set EMAIL_FROM_ADDRESS="Trike <noreply@notifications.trike.co>"
```

---

### Task 1.3: Brain RAG — Include System Templates

**Files:**
- Modify: `supabase/functions/trike-server/index.ts:6863-6871`
- Create: `supabase/migrations/20260304100001_brain_embeddings_include_system.sql`

**Step 1: Create updated RPC migration**

Create `supabase/migrations/20260304100001_brain_embeddings_include_system.sql`:

```sql
-- Update match_brain_embeddings to include system templates in results
CREATE OR REPLACE FUNCTION match_brain_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 10,
  org_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  track_id uuid,
  content_type text,
  content_chunk text,
  similarity float,
  metadata jsonb,
  is_system_template boolean
)
LANGUAGE sql STABLE
AS $$
  SELECT
    be.id,
    be.track_id,
    be.content_type,
    be.content_chunk,
    1 - (be.embedding <=> query_embedding) AS similarity,
    be.metadata,
    be.is_system_template
  FROM brain_embeddings be
  WHERE 1 - (be.embedding <=> query_embedding) > match_threshold
    AND (
      be.organization_id = org_id
      OR be.is_system_template = true
    )
  ORDER BY be.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

**Step 2: Remove the TODO comment in edge function**

At lines 6863-6865, remove:
```typescript
// TODO: Update match_brain_embeddings RPC to also return is_system_template=true rows
// For now, this only searches the user's org content
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260304100001_brain_embeddings_include_system.sql supabase/functions/trike-server/index.ts
git commit -m "feat: include system templates in Brain RAG search results"
```

---

## Phase 2: Wiring (~3-4 hours)

### Task 2.1: Health Endpoint — Real Readiness Probe

**Files:**
- Modify: `supabase/functions/trike-server/index.ts:330-339`

**Step 1: Replace superficial health check**

Replace the health handler (lines 330-339) with:

```typescript
if (method === "GET" && (path === "/health" || path === "")) {
  const checks: Record<string, string> = {};

  // Check database connectivity
  try {
    const { error } = await supabase.from('roles').select('id').limit(1).single();
    checks.database = error ? `error: ${error.message}` : 'ok';
  } catch {
    checks.database = 'unreachable';
  }

  // Check OpenAI API key presence
  checks.openai = OPENAI_API_KEY ? 'configured' : 'missing';

  // Check Resend API key presence
  const resendKey = Deno.env.get("RESEND_API_KEY");
  checks.resend = resendKey ? 'configured' : 'missing';

  // Check eSignatures token presence
  const esigToken = Deno.env.get("ESIGNATURES_API_TOKEN");
  checks.esignatures = esigToken ? 'configured' : 'not_configured';

  // Check Stripe key presence
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  checks.stripe = stripeKey ? 'configured' : 'not_configured';

  const allHealthy = checks.database === 'ok' &&
    checks.openai === 'configured' &&
    checks.resend === 'configured';

  return jsonResponse(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
    allHealthy ? 200 : 503
  );
}
```

**Step 2: Verify**

Run:
```bash
curl https://gscfykjtojbcxxuserhu.supabase.co/functions/v1/trike-server/health
```

Expected: JSON with `status`, `checks` object, and `timestamp`

**Step 3: Commit**

```bash
git add supabase/functions/trike-server/index.ts
git commit -m "feat: real readiness probe for /health endpoint with dependency checks"
```

---

### Task 2.2: Rate Limiting Middleware

**Files:**
- Modify: `supabase/functions/trike-server/index.ts` (add near top, before route handling)

**Step 1: Add rate limiter utility**

Add after the existing imports/constants (around line 20):

```typescript
// ── Rate Limiting ──────────────────────────────────────────
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  '/brain/': { limit: 30, windowMs: 60_000 },
  '/email/send': { limit: 20, windowMs: 60_000 },
  '/contracts/': { limit: 5, windowMs: 60_000 },
  '/billing/': { limit: 10, windowMs: 60_000 },
};

function checkRateLimit(path: string, orgId: string): { allowed: boolean; retryAfterMs?: number } {
  // Find matching rate limit config
  const configKey = Object.keys(RATE_LIMITS).find((prefix) => path.startsWith(prefix));
  if (!configKey) return { allowed: true };

  const config = RATE_LIMITS[configKey];
  const key = `${orgId}:${configKey}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true };
  }

  if (entry.count >= config.limit) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true };
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 300_000);
```

**Step 2: Apply rate limiting in the main handler**

After the CORS and auth checks, before route matching, add:

```typescript
// Rate limiting check
if (orgId) {
  const rateCheck = checkRateLimit(path, orgId);
  if (!rateCheck.allowed) {
    return jsonResponse(
      { error: 'Too many requests. Please try again shortly.' },
      429,
      { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)) }
    );
  }
}
```

Note: `orgId` extraction depends on where in the handler this can be inserted. If `orgId` isn't available yet at the point of rate limiting, use the auth user ID as the rate limit key instead.

**Step 3: Commit**

```bash
git add supabase/functions/trike-server/index.ts
git commit -m "feat: add in-memory rate limiting for expensive edge function endpoints"
```

---

### Task 2.3: Notification Email Delivery via pg_net

**Files:**
- Create: `supabase/migrations/20260304100002_notification_email_trigger.sql`

**Step 1: Create the notification email trigger migration**

```sql
-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to send email notification when a pipeline notification is created
CREATE OR REPLACE FUNCTION send_notification_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
  v_user_first_name TEXT;
  v_pref_channels TEXT[];
  v_email_enabled BOOLEAN := FALSE;
  v_edge_function_url TEXT;
  v_anon_key TEXT;
  v_template_slug TEXT;
BEGIN
  -- Only process high and urgent priority by default
  -- Check if user has explicit email preference
  SELECT delivery_channels INTO v_pref_channels
  FROM notification_preferences
  WHERE user_id = NEW.user_id
    AND notification_type = NEW.type
  LIMIT 1;

  IF v_pref_channels IS NOT NULL THEN
    v_email_enabled := 'email' = ANY(v_pref_channels);
  ELSE
    -- Default: email ON for high/urgent, OFF for normal/low
    v_email_enabled := NEW.priority IN ('high', 'urgent');
  END IF;

  IF NOT v_email_enabled THEN
    RETURN NEW;
  END IF;

  -- Get user email
  SELECT email, first_name INTO v_user_email, v_user_first_name
  FROM users
  WHERE id = NEW.user_id;

  IF v_user_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Map notification type to email template slug
  v_template_slug := 'notification_' || NEW.type;

  -- Get edge function URL from vault or use default
  v_edge_function_url := current_setting('app.settings.edge_function_url', true);
  IF v_edge_function_url IS NULL OR v_edge_function_url = '' THEN
    v_edge_function_url := 'https://gscfykjtojbcxxuserhu.supabase.co/functions/v1/trike-server';
  END IF;

  v_anon_key := current_setting('app.settings.anon_key', true);

  -- Send async HTTP request via pg_net
  PERFORM net.http_post(
    url := v_edge_function_url || '/email/send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_anon_key, '')
    ),
    body := jsonb_build_object(
      'template_slug', v_template_slug,
      'recipient_email', v_user_email,
      'recipient_user_id', NEW.user_id,
      'organization_id', NEW.organization_id,
      'variables', jsonb_build_object(
        'user_name', COALESCE(v_user_first_name, 'there'),
        'notification_title', NEW.title,
        'notification_message', NEW.message,
        'notification_type', NEW.type,
        'notification_priority', NEW.priority
      )
    )
  );

  -- Mark that email delivery was attempted
  UPDATE pipeline_notifications
  SET delivered_via = array_append(COALESCE(delivered_via, ARRAY[]::text[]), 'email')
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Create trigger on pipeline_notifications INSERT
DROP TRIGGER IF EXISTS trigger_notification_email ON pipeline_notifications;
CREATE TRIGGER trigger_notification_email
  AFTER INSERT ON pipeline_notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_notification_email();
```

**Step 2: Create default notification email templates**

Create `supabase/migrations/20260304100003_notification_email_templates.sql`:

```sql
-- Insert system email templates for each notification type
-- These are defaults that orgs can customize

INSERT INTO email_templates (slug, name, subject, body_html, template_type, is_active, available_variables)
VALUES
  ('notification_deal_won', 'Deal Won Notification', 'Deal Won: {{notification_title}}',
   '<h2>Congratulations!</h2><p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]'),

  ('notification_deal_lost', 'Deal Lost Notification', 'Deal Update: {{notification_title}}',
   '<h2>Deal Update</h2><p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]'),

  ('notification_deal_stage_change', 'Deal Stage Change', 'Deal Moved: {{notification_title}}',
   '<p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]'),

  ('notification_proposal_sent', 'Proposal Sent', 'Proposal Sent: {{notification_title}}',
   '<p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]'),

  ('notification_proposal_viewed', 'Proposal Viewed', 'Proposal Viewed: {{notification_title}}',
   '<p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]'),

  ('notification_proposal_accepted', 'Proposal Accepted', 'Proposal Accepted: {{notification_title}}',
   '<h2>Proposal Accepted!</h2><p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]'),

  ('notification_demo_provisioned', 'Demo Provisioned', 'Demo Ready: {{notification_title}}',
   '<p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]'),

  ('notification_demo_expiring', 'Demo Expiring', 'Demo Expiring: {{notification_title}}',
   '<h2>Action Required</h2><p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]'),

  ('notification_deal_assigned', 'Deal Assigned', 'New Deal Assigned: {{notification_title}}',
   '<p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]'),

  ('notification_deal_stale', 'Stale Deal Alert', 'Stale Deal: {{notification_title}}',
   '<h2>Deal Needs Attention</h2><p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]')

ON CONFLICT (slug) WHERE organization_id IS NULL DO NOTHING;
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260304100002_notification_email_trigger.sql supabase/migrations/20260304100003_notification_email_templates.sql
git commit -m "feat: wire notification email delivery via pg_net trigger + default templates"
```

---

## Phase 3: Prospect Portal — Simple Steps (~4-5 hours)

### Task 3.1: Explore — Content Library Preview Mode

**Files:**
- Modify: `src/components/ContentLibrary.tsx`
- Modify: `src/components/trike-admin/ProspectJourneyPanel.tsx:57-70` (explore step handler)

**Step 1: Add preview mode support to ContentLibrary**

At the top of `ContentLibrary.tsx`, add URL param detection:

```typescript
import { useSearchParams } from 'react-router-dom';

// Inside the component:
const [searchParams] = useSearchParams();
const isPreviewMode = searchParams.get('preview') === 'true';
```

Conditionally hide action buttons when in preview mode:

```typescript
{!isPreviewMode && (
  <Button onClick={handleEnroll}>Enroll</Button>
)}
{isPreviewMode && (
  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
    You're previewing the content library. Upgrade to access courses and training.
  </div>
)}
```

**Step 2: Wire explore step in ProspectJourneyPanel**

In `ProspectJourneyPanel.tsx`, update the explore step's `onClick` handler to navigate:

```typescript
// In getJourneySteps(), update the explore step:
{
  id: 'explore',
  title: 'Explore the Platform',
  // ...existing props...
  onClick: () => {
    // Navigate to content library in preview mode
    window.location.href = '/content-library?preview=true';
  }
}
```

**Step 3: Commit**

```bash
git add src/components/ContentLibrary.tsx src/components/trike-admin/ProspectJourneyPanel.tsx
git commit -m "feat: content library preview mode for prospect explore step"
```

---

### Task 3.2: ROI Calculator Component

**Files:**
- Create: `src/components/trike-admin/ROICalculator.tsx`
- Modify: `src/components/trike-admin/ProspectJourneyPanel.tsx` (roi step handler)

**Step 1: Create ROICalculator.tsx**

```typescript
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface ROICalculatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Optional: pre-fill from deal/proposal data
  defaults?: {
    locationCount?: number;
    perLocationRate?: number;
    perHireRate?: number;
  };
}

const TRIKE_TRAINING_HOURS = 1.5;
const DEFAULT_PER_LOCATION_RATE = 99;
const DEFAULT_PER_HIRE_RATE = 22;

export function ROICalculator({ open, onOpenChange, defaults }: ROICalculatorProps) {
  const [inputs, setInputs] = useState({
    locations: defaults?.locationCount || 10,
    employeesPerLocation: 15,
    turnoverRate: 75,
    hourlyWage: 15,
    currentTrainingHours: 40,
    currentPlatformCost: 0,
  });

  const perLocationRate = defaults?.perLocationRate || DEFAULT_PER_LOCATION_RATE;
  const perHireRate = defaults?.perHireRate || DEFAULT_PER_HIRE_RATE;

  const results = useMemo(() => {
    const totalEmployees = inputs.locations * inputs.employeesPerLocation;
    const annualNewHires = Math.round(totalEmployees * (inputs.turnoverRate / 100));

    // Current costs
    const currentTrainingLabor = annualNewHires * inputs.currentTrainingHours * inputs.hourlyWage;
    const currentTotalCost = currentTrainingLabor + inputs.currentPlatformCost;

    // Trike costs
    const trikeSubscription = inputs.locations * perLocationRate * 12;
    const trikePerHireCost = annualNewHires * perHireRate;
    const trikeTrainingLabor = annualNewHires * TRIKE_TRAINING_HOURS * inputs.hourlyWage;
    const trikeTotalCost = trikeSubscription + trikePerHireCost + trikeTrainingLabor;

    // Savings
    const annualSavings = currentTotalCost - trikeTotalCost;
    const roiPercent = trikeTotalCost > 0 ? ((annualSavings / trikeTotalCost) * 100) : 0;
    const hoursRecovered = annualNewHires * (inputs.currentTrainingHours - TRIKE_TRAINING_HOURS);

    return {
      totalEmployees,
      annualNewHires,
      currentTotalCost,
      trikeTotalCost,
      annualSavings,
      roiPercent,
      hoursRecovered,
      trikeSubscription,
      trikePerHireCost,
    };
  }, [inputs, perLocationRate, perHireRate]);

  const updateInput = (field: keyof typeof inputs, value: string) => {
    const num = parseFloat(value) || 0;
    setInputs((prev) => ({ ...prev, [field]: num }));
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  const formatNumber = (n: number) =>
    new Intl.NumberFormat('en-US').format(n);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ROI Calculator</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* Inputs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Organization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Number of Locations</Label>
                <Input type="number" value={inputs.locations} onChange={(e) => updateInput('locations', e.target.value)} min={1} />
              </div>
              <div>
                <Label>Avg Employees per Location</Label>
                <Input type="number" value={inputs.employeesPerLocation} onChange={(e) => updateInput('employeesPerLocation', e.target.value)} min={1} />
              </div>
              <div>
                <Label>Annual Turnover Rate (%)</Label>
                <Input type="number" value={inputs.turnoverRate} onChange={(e) => updateInput('turnoverRate', e.target.value)} min={0} max={300} />
              </div>
              <div>
                <Label>Avg Hourly Wage ($)</Label>
                <Input type="number" value={inputs.hourlyWage} onChange={(e) => updateInput('hourlyWage', e.target.value)} min={0} step={0.5} />
              </div>
              <div>
                <Label>Current Training Hours per New Hire</Label>
                <Input type="number" value={inputs.currentTrainingHours} onChange={(e) => updateInput('currentTrainingHours', e.target.value)} min={0} />
              </div>
              <div>
                <Label>Current Annual Platform Cost ($)</Label>
                <Input type="number" value={inputs.currentPlatformCost} onChange={(e) => updateInput('currentPlatformCost', e.target.value)} min={0} />
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <div className="space-y-4">
            <Card className={results.annualSavings > 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">Projected Annual Savings</p>
                <p className={`text-3xl font-bold ${results.annualSavings > 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatCurrency(results.annualSavings)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {results.roiPercent > 0 ? `${results.roiPercent.toFixed(0)}% ROI` : ''}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Annual New Hires</span>
                  <span className="font-medium">{formatNumber(results.annualNewHires)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hours Recovered / Year</span>
                  <span className="font-medium">{formatNumber(results.hoursRecovered)}</span>
                </div>
                <hr />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Total Cost</span>
                  <span className="font-medium">{formatCurrency(results.currentTotalCost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Trike Subscription</span>
                  <span className="font-medium">{formatCurrency(results.trikeSubscription)}/yr</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Trike Per-Hire Costs</span>
                  <span className="font-medium">{formatCurrency(results.trikePerHireCost)}/yr</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Trike Total Cost</span>
                  <span className="font-medium">{formatCurrency(results.trikeTotalCost)}/yr</span>
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground text-center">
              Trike reduces onboarding from {inputs.currentTrainingHours}hrs to {TRIKE_TRAINING_HOURS}hrs per hire
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Wire ROI step in ProspectJourneyPanel**

Add state and dialog to ProspectJourneyPanel:

```typescript
import { ROICalculator } from './ROICalculator';

// Inside the component:
const [roiOpen, setRoiOpen] = useState(false);

// Update the roi step onClick:
onClick: () => setRoiOpen(true),

// Add dialog to JSX:
<ROICalculator open={roiOpen} onOpenChange={setRoiOpen} />
```

**Step 3: Commit**

```bash
git add src/components/trike-admin/ROICalculator.tsx src/components/trike-admin/ProspectJourneyPanel.tsx
git commit -m "feat: ROI calculator component for prospect portal"
```

---

### Task 3.3: Go-Live Checklist Component

**Files:**
- Create: `src/components/trike-admin/GoLiveChecklist.tsx`
- Modify: `src/components/trike-admin/ProspectJourneyPanel.tsx` (launch step handler)

**Step 1: Create GoLiveChecklist.tsx**

```typescript
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

    // Check non-admin users
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
```

**Step 2: Wire launch step in ProspectJourneyPanel**

```typescript
import { GoLiveChecklist } from './GoLiveChecklist';

// Add state:
const [goLiveOpen, setGoLiveOpen] = useState(false);

// Update launch step onClick:
onClick: () => setGoLiveOpen(true),

// Add to JSX:
<GoLiveChecklist
  open={goLiveOpen}
  onOpenChange={setGoLiveOpen}
  organizationId={organization.id}
  dealId={deal?.id}
/>
```

**Step 3: Commit**

```bash
git add src/components/trike-admin/GoLiveChecklist.tsx src/components/trike-admin/ProspectJourneyPanel.tsx
git commit -m "feat: go-live checklist component for prospect portal launch step"
```

---

## Phase 4: Prospect Portal — Integrations (~6-8 hours)

### Task 4.1: Database Migration for Contract & Payment Fields

**Files:**
- Create: `supabase/migrations/20260304100004_contracts_and_billing_fields.sql`

**Step 1: Create migration**

```sql
-- Add contract tracking fields to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS contract_id TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS contract_status TEXT DEFAULT 'none';
-- contract_status values: none, sent, viewed, signed, declined, withdrawn
ALTER TABLE deals ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS contract_signer_email TEXT;

-- Add payment method field to organizations
-- stripe_customer_id already exists from migration 00017
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'none';
-- billing_status values: none, payment_method_saved, active, past_due, cancelled

-- Index for contract lookups
CREATE INDEX IF NOT EXISTS idx_deals_contract_id ON deals(contract_id) WHERE contract_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_contract_status ON deals(contract_status) WHERE contract_status != 'none';
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260304100004_contracts_and_billing_fields.sql
git commit -m "feat: add contract and billing fields to deals and organizations tables"
```

---

### Task 4.2: eSignatures.io Edge Function Endpoints

**Files:**
- Modify: `supabase/functions/trike-server/index.ts`

**Step 1: Add eSignatures.io handler functions**

Add these handler functions near the other handler functions in the edge function:

```typescript
// ── eSignatures.io Contract Handlers ────────────────────────

async function handleContractSend(body: any, supabase: any) {
  const ESIG_TOKEN = Deno.env.get("ESIGNATURES_API_TOKEN");
  if (!ESIG_TOKEN) {
    return jsonResponse({ error: "eSignatures.io not configured" }, 500);
  }

  const { deal_id, template_id, signer_name, signer_email, metadata } = body;

  if (!deal_id || !template_id || !signer_name || !signer_email) {
    return jsonResponse({ error: "deal_id, template_id, signer_name, and signer_email are required" }, 400);
  }

  // Send contract via eSignatures.io API
  const esigResponse = await fetch(
    `https://esignatures.com/api/contracts?token=${ESIG_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id,
        signers: [{ name: signer_name, email: signer_email }],
        metadata: JSON.stringify({ deal_id, ...metadata }),
        // Optional: customize email
        title: `Agreement for ${signer_name}`,
      }),
    }
  );

  if (!esigResponse.ok) {
    const errText = await esigResponse.text();
    return jsonResponse({ error: "Failed to send contract", details: errText }, 500);
  }

  const esigData = await esigResponse.json();
  const contractId = esigData.data?.contract?.id;

  // Update deal with contract info
  await supabase
    .from("deals")
    .update({
      contract_id: contractId,
      contract_status: "sent",
      contract_signer_email: signer_email,
    })
    .eq("id", deal_id);

  // Log activity
  await supabase.from("deal_activities").insert({
    deal_id,
    activity_type: "system",
    description: `Contract sent to ${signer_email}`,
    metadata: { contract_id: contractId },
  });

  return jsonResponse({ success: true, contract_id: contractId });
}

async function handleContractWebhook(body: any, supabase: any) {
  // eSignatures.io sends webhook events
  const { status, contract } = body;

  if (!contract?.id) {
    return jsonResponse({ error: "Invalid webhook payload" }, 400);
  }

  const contractId = contract.id;
  const signerEmail = contract.signers?.[0]?.email;
  let metadata: any = {};
  try {
    metadata = JSON.parse(contract.metadata || "{}");
  } catch {
    // ignore parse errors
  }

  const dealId = metadata.deal_id;
  if (!dealId) {
    return jsonResponse({ error: "No deal_id in contract metadata" }, 400);
  }

  // Map eSignatures.io event to deal status
  let contractStatus = "sent";
  let activityDesc = "";

  switch (status) {
    case "signer-viewed-the-contract":
      contractStatus = "viewed";
      activityDesc = `Contract viewed by ${signerEmail}`;
      break;
    case "signer-signed":
    case "contract-signed":
      contractStatus = "signed";
      activityDesc = `Contract signed by ${signerEmail}`;
      break;
    case "signer-declined":
      contractStatus = "declined";
      activityDesc = `Contract declined by ${signerEmail}`;
      break;
    case "contract-withdrawn":
      contractStatus = "withdrawn";
      activityDesc = "Contract withdrawn";
      break;
    default:
      // Unknown event, log but don't update status
      activityDesc = `Contract event: ${status}`;
  }

  // Update deal
  const updateFields: Record<string, any> = { contract_status: contractStatus };
  if (contractStatus === "signed") {
    updateFields.contract_signed_at = new Date().toISOString();
  }

  await supabase.from("deals").update(updateFields).eq("id", dealId);

  // Log activity
  if (activityDesc) {
    await supabase.from("deal_activities").insert({
      deal_id: dealId,
      activity_type: "system",
      description: activityDesc,
      metadata: { contract_id: contractId, event: status },
    });
  }

  return jsonResponse({ success: true });
}
```

**Step 2: Add route matching**

In the main route handler, add:

```typescript
if (method === "POST" && path === "/contracts/send") {
  return await handleContractSend(body, supabase);
}
if (method === "POST" && path === "/contracts/webhook") {
  // Webhook from eSignatures.io — no auth required
  return await handleContractWebhook(body, supabase);
}
if (method === "GET" && path.startsWith("/contracts/") && path.endsWith("/status")) {
  const contractId = path.split("/")[2];
  // Proxy status check to eSignatures.io
  const ESIG_TOKEN = Deno.env.get("ESIGNATURES_API_TOKEN");
  const resp = await fetch(`https://esignatures.com/api/contracts/${contractId}?token=${ESIG_TOKEN}`);
  const data = await resp.json();
  return jsonResponse(data);
}
```

**Step 3: Set environment variable**

```bash
npx supabase secrets set ESIGNATURES_API_TOKEN="your-token-here"
```

**Step 4: Commit**

```bash
git add supabase/functions/trike-server/index.ts
git commit -m "feat: eSignatures.io integration — send contracts and handle webhooks"
```

---

### Task 4.3: Stripe Payment Setup Edge Function Endpoints

**Files:**
- Modify: `supabase/functions/trike-server/index.ts`

**Step 1: Add Stripe handler functions**

```typescript
// ── Stripe Billing Handlers ─────────────────────────────────

async function handleBillingSetupIntent(body: any, supabase: any) {
  const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  if (!STRIPE_KEY) {
    return jsonResponse({ error: "Stripe not configured" }, 500);
  }

  const { organization_id } = body;
  if (!organization_id) {
    return jsonResponse({ error: "organization_id is required" }, 400);
  }

  // Get org details
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, stripe_customer_id")
    .eq("id", organization_id)
    .single();

  if (!org) {
    return jsonResponse({ error: "Organization not found" }, 404);
  }

  const stripeHeaders = {
    Authorization: `Bearer ${STRIPE_KEY}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  let customerId = org.stripe_customer_id;

  // Create Stripe customer if needed
  if (!customerId) {
    const custResp = await fetch("https://api.stripe.com/v1/customers", {
      method: "POST",
      headers: stripeHeaders,
      body: new URLSearchParams({
        name: org.name,
        "metadata[organization_id]": organization_id,
      }),
    });
    const custData = await custResp.json();
    customerId = custData.id;

    // Save customer ID
    await supabase
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", organization_id);
  }

  // Create SetupIntent
  const siResp = await fetch("https://api.stripe.com/v1/setup_intents", {
    method: "POST",
    headers: stripeHeaders,
    body: new URLSearchParams({
      customer: customerId,
      "payment_method_types[]": "card",
      "metadata[organization_id]": organization_id,
    }),
  });
  const siData = await siResp.json();

  return jsonResponse({
    client_secret: siData.client_secret,
    customer_id: customerId,
  });
}

async function handleBillingWebhook(req: Request, supabase: any) {
  const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const body = await req.text();

  // Verify webhook signature if secret is configured
  if (STRIPE_WEBHOOK_SECRET) {
    const sig = req.headers.get("stripe-signature");
    // Note: In production, verify signature using Stripe's algorithm
    // For now, proceed with basic validation
    if (!sig) {
      return jsonResponse({ error: "Missing signature" }, 400);
    }
  }

  const event = JSON.parse(body);

  if (event.type === "setup_intent.succeeded") {
    const setupIntent = event.data.object;
    const orgId = setupIntent.metadata?.organization_id;
    const paymentMethodId = setupIntent.payment_method;

    if (orgId && paymentMethodId) {
      await supabase
        .from("organizations")
        .update({
          stripe_payment_method_id: paymentMethodId,
          billing_status: "payment_method_saved",
        })
        .eq("id", orgId);
    }
  }

  return jsonResponse({ received: true });
}
```

**Step 2: Add route matching**

```typescript
if (method === "POST" && path === "/billing/setup-intent") {
  return await handleBillingSetupIntent(body, supabase);
}
if (method === "POST" && path === "/billing/webhook") {
  // Raw body needed for Stripe signature verification
  return await handleBillingWebhook(req, supabase);
}
```

**Step 3: Set environment variables**

```bash
npx supabase secrets set STRIPE_SECRET_KEY="sk_live_..."
npx supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_..."
```

**Step 4: Commit**

```bash
git add supabase/functions/trike-server/index.ts
git commit -m "feat: Stripe Setup Intent integration for prospect payment step"
```

---

### Task 4.4: Frontend — Sign Agreement Step

**Files:**
- Create: `src/lib/crud/contracts.ts`
- Modify: `src/components/trike-admin/ProspectJourneyPanel.tsx`

**Step 1: Create contracts CRUD**

```typescript
import { supabase } from '../supabase';

const TRIKE_SERVER_URL = import.meta.env.VITE_TRIKE_SERVER_URL ||
  `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/trike-server`;

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`,
  };
}

export async function sendContract(params: {
  deal_id: string;
  template_id: string;
  signer_name: string;
  signer_email: string;
}) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${TRIKE_SERVER_URL}/contracts/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to send contract');
  }
  return response.json();
}

export async function getContractStatus(contractId: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${TRIKE_SERVER_URL}/contracts/${contractId}/status`, {
    method: 'GET',
    headers,
  });
  return response.json();
}
```

**Step 2: Update ProspectJourneyPanel sign step**

The sign step should show contract status from the deal record. When the admin clicks "Send Agreement", it opens a dialog to confirm signer details and template, then calls `sendContract()`.

This is a UI integration task — wire the step's `onClick` to open a confirmation dialog that calls `sendContract()`, and display the current `contract_status` from the deal data.

**Step 3: Commit**

```bash
git add src/lib/crud/contracts.ts src/components/trike-admin/ProspectJourneyPanel.tsx
git commit -m "feat: contract signing step with eSignatures.io frontend integration"
```

---

### Task 4.5: Frontend — Payment Setup Step

**Files:**
- Modify: `package.json` (add Stripe dependency)
- Create: `src/components/trike-admin/PaymentSetup.tsx`
- Modify: `src/components/trike-admin/ProspectJourneyPanel.tsx`

**Step 1: Install Stripe Elements**

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

**Step 2: Create PaymentSetup.tsx**

```typescript
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
import { Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

const TRIKE_SERVER_URL = import.meta.env.VITE_TRIKE_SERVER_URL ||
  `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/trike-server`;

interface PaymentSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
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

  useEffect(() => {
    if (!open || !organizationId) return;
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
      }
    } catch (err) {
      console.error('Failed to create setup intent:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Setup Payment Method</DialogTitle>
        </DialogHeader>

        {saved ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <p className="text-lg font-medium">Payment method saved</p>
            <p className="text-sm text-muted-foreground">
              Your card has been securely saved. You won't be charged until your subscription begins.
            </p>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : loading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
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
```

**Step 3: Wire payment step in ProspectJourneyPanel**

```typescript
import { PaymentSetup } from './PaymentSetup';

const [paymentOpen, setPaymentOpen] = useState(false);

// Update payment step onClick:
onClick: () => setPaymentOpen(true),

// Add to JSX:
<PaymentSetup
  open={paymentOpen}
  onOpenChange={setPaymentOpen}
  organizationId={organization.id}
/>
```

**Step 4: Commit**

```bash
git add package.json package-lock.json src/components/trike-admin/PaymentSetup.tsx src/components/trike-admin/ProspectJourneyPanel.tsx
git commit -m "feat: Stripe payment method setup for prospect portal"
```

---

### Task 4.6: Team Invite Step

**Files:**
- Create: `src/components/trike-admin/TeamInvite.tsx`
- Modify: `src/components/trike-admin/ProspectJourneyPanel.tsx`

**Step 1: Create TeamInvite.tsx**

Build a dialog component with:
- Multi-email input (comma or newline separated)
- Role selector (limited to Viewer, Store Manager) using `<Select>` with non-empty values
- Calls existing `createUser()` from `src/lib/crud/users.ts` for each invited email
- Shows success/error state per invite
- Displays count of invites sent vs. limit (configurable, default 10)

Key implementation details:
- Fetch available roles with: `supabase.from('roles').select('id, name').eq('organization_id', orgId)`
- Filter roles to only allow 'Team Member' and 'Store Manager' for prospect invites
- For each email, call `createUser()` with the selected role_id and org context
- The invite flow uses the existing placeholder pattern in `users.ts` — real Supabase auth invites will need a future edge function endpoint

**Step 2: Wire invite step in ProspectJourneyPanel**

```typescript
import { TeamInvite } from './TeamInvite';

const [inviteOpen, setInviteOpen] = useState(false);

onClick: () => setInviteOpen(true),

<TeamInvite
  open={inviteOpen}
  onOpenChange={setInviteOpen}
  organizationId={organization.id}
/>
```

**Step 3: Commit**

```bash
git add src/components/trike-admin/TeamInvite.tsx src/components/trike-admin/ProspectJourneyPanel.tsx
git commit -m "feat: team invite step for prospect portal"
```

---

### Task 4.7: Deploy Edge Function

**Step 1: Deploy**

```bash
cd Trikebackofficedashboardapplicationschemasandbox
npx supabase functions deploy trike-server
```

**Step 2: Verify**

```bash
curl https://gscfykjtojbcxxuserhu.supabase.co/functions/v1/trike-server/health
```

Expected: JSON with `"status": "healthy"` and all checks showing their statuses.

**Step 3: Run migrations**

Apply the new migrations via Supabase dashboard or CLI:
```bash
npx supabase db push
```

**Step 4: Final commit and push**

```bash
git add -A
git commit -m "chore: final integration wiring and deployment verification"
git push origin main
```

---

## Summary

| Phase | Tasks | Commits |
|-------|-------|---------|
| Phase 1 | 1.1, 1.2, 1.3 | 3 |
| Phase 2 | 2.1, 2.2, 2.3 | 3 |
| Phase 3 | 3.1, 3.2, 3.3 | 3 |
| Phase 4 | 4.1-4.7 | 6 |
| **Total** | **15 tasks** | **15 commits** |
