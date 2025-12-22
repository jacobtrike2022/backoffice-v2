# Environment Variables Setup

## Overview

Supabase credentials are now configured to use environment variables for security. The credentials are no longer hardcoded in the codebase.

## Setup Instructions

### 1. Create `.env` file

Create a `.env` file in the project root (same directory as `package.json`):

```bash
# Supabase Configuration
VITE_SUPABASE_PROJECT_ID=your-project-id-here
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: Supabase Edge Function name (defaults to 'make-server-2858cc8b')
VITE_SUPABASE_FUNCTION_NAME=make-server-2858cc8b

# Optional: Google Maps API Key (if using maps features)
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
```

### 2. Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** > **API**
4. Copy the following:
   - **Project URL**: Extract the project ID (the part before `.supabase.co`)
   - **anon/public key**: This is your `VITE_SUPABASE_ANON_KEY`

### 3. Fill in Your Values

Replace the placeholder values in your `.env` file with your actual credentials:

```bash
VITE_SUPABASE_PROJECT_ID=kgzhlvxzdlexsrozbbxs
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Restart Your Dev Server

After creating/updating your `.env` file, restart your development server:

```bash
npm run dev
```

## Security Notes

- ✅ The `.env` file is already in `.gitignore` and will **not** be committed to the repository
- ✅ The `VITE_SUPABASE_ANON_KEY` is safe to expose in client-side code (it's public by design)
- ⚠️ **Never commit** your `.env` file to version control
- ⚠️ For production deployments (Vercel), set these as environment variables in your hosting platform

## Backward Compatibility

The code includes fallback values for backward compatibility. However, you should:
1. Create your `.env` file with your actual credentials
2. Remove the hardcoded fallbacks in `src/utils/supabase/info.tsx` once you've confirmed everything works

## Production Deployment (Vercel)

When deploying to Vercel, add these environment variables in your Vercel project settings:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** > **Environment Variables**
3. Add:
   - `VITE_SUPABASE_PROJECT_ID`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_FUNCTION_NAME` (if different from default)
   - `VITE_GOOGLE_MAPS_API_KEY` (if using maps)

## Verification

To verify your environment variables are being used:

1. Check that your `.env` file exists in the project root
2. Restart your dev server
3. The app should connect to your Supabase instance using the credentials from `.env`

If you see errors, check:
- The `.env` file is in the correct location (project root)
- Variable names start with `VITE_` (required for Vite)
- No typos in variable names
- Dev server was restarted after creating/updating `.env`

