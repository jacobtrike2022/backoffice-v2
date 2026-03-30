# Deploy Edge Function to Demo and Exp-Jacob Projects

Since the CLI only has access to one project, you'll need to deploy manually to the other two projects.

## Projects to Deploy To:
- **demo**: `czcpjmfiphffwetxqpjc`
- **exp-jacob**: `xbwvwfqfdzwkdxpauncc`

## Manual Deployment Steps:

### Option 1: Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard
2. Select the project (demo or exp-jacob)
3. Navigate to **Edge Functions** → **trike-server**
4. Click **"Deploy new version"** or **"Edit"**
5. Upload or paste the contents of:
   - `supabase/functions/trike-server/index.ts`
   - `supabase/functions/trike-server/deno.json`
6. Click **Deploy**

### Option 2: Using Supabase CLI with Access Token

1. Get your Supabase access token:
   - Go to https://supabase.com/dashboard/account/tokens
   - Create a new access token if needed

2. Set the access token:
   ```bash
   export SUPABASE_ACCESS_TOKEN=your_access_token_here
   ```

3. Deploy using the script:
   ```bash
   node scripts/deploy-edge-function.js czcpjmfiphffwetxqpjc  # for demo
   node scripts/deploy-edge-function.js xbwvwfqfdzwkdxpauncc  # for exp-jacob
   ```

### Option 3: Re-authenticate CLI

If the projects are under a different account:

1. Log out: `npx supabase logout`
2. Log in: `npx supabase login`
3. Use the account that has access to demo and exp-jacob projects
4. Deploy: `npx supabase functions deploy trike-server --project-ref <project-id>`

## What Was Changed:

The deployment includes:
- ✅ **Deduplication fix** in `handleGenerateKeyFacts` - checks existing facts before inserting to prevent duplicates
- ✅ **State variant extractor** reverted to original

## Verify Deployment:

After deploying, test the function:
```bash
curl https://<project-id>.supabase.co/functions/v1/trike-server/health
```

You should get a 401 (expected - requires auth) or 200 response.
