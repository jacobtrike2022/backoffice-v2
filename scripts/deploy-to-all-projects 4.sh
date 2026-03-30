#!/bin/bash
# Deploy trike-server edge function to multiple Supabase projects
# This script helps deploy when CLI only has access to one project

set -e

FUNCTION_DIR="supabase/functions/trike-server"
PROJECTS=(
  "czcpjmfiphffwetxqpjc:demo"
  "xbwvwfqfdzwkdxpauncc:exp-jacob"
)

echo "=========================================="
echo "Deploy Edge Function to Multiple Projects"
echo "=========================================="
echo ""
echo "This script will help you deploy the trike-server function"
echo "to projects that aren't accessible via the default CLI account."
echo ""
echo "Projects to deploy to:"
for project in "${PROJECTS[@]}"; do
  IFS=':' read -r project_id project_name <<< "$project"
  echo "  - $project_name: $project_id"
done
echo ""
echo "Options:"
echo "1. Manual deployment via Supabase Dashboard (recommended)"
echo "2. Use Supabase CLI with re-authentication"
echo "3. Use Supabase Management API (requires access token)"
echo ""
read -p "Choose option (1-3): " option

case $option in
  1)
    echo ""
    echo "=========================================="
    echo "Manual Deployment Instructions"
    echo "=========================================="
    echo ""
    echo "For each project, follow these steps:"
    echo ""
    for project in "${PROJECTS[@]}"; do
      IFS=':' read -r project_id project_name <<< "$project"
      echo "📦 Project: $project_name ($project_id)"
      echo "   1. Go to: https://supabase.com/dashboard/project/$project_id/functions"
      echo "   2. Click on 'trike-server' function"
      echo "   3. Click 'Deploy new version' or 'Edit'"
      echo "   4. Copy contents of: $FUNCTION_DIR/index.ts"
      echo "   5. Copy contents of: $FUNCTION_DIR/deno.json"
      echo "   6. Paste into the editor and click 'Deploy'"
      echo ""
    done
    echo ""
    echo "Files to deploy:"
    echo "  - $FUNCTION_DIR/index.ts"
    echo "  - $FUNCTION_DIR/deno.json"
    ;;
  2)
    echo ""
    echo "=========================================="
    echo "Re-authenticate CLI"
    echo "=========================================="
    echo ""
    echo "1. Log out: npx supabase logout"
    echo "2. Log in with account that has access: npx supabase login"
    echo "3. Deploy to each project:"
    for project in "${PROJECTS[@]}"; do
      IFS=':' read -r project_id project_name <<< "$project"
      echo "   npx supabase functions deploy trike-server --project-ref $project_id"
    done
    ;;
  3)
    if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
      echo ""
      echo "Error: SUPABASE_ACCESS_TOKEN environment variable not set"
      echo ""
      echo "Get your access token from:"
      echo "https://supabase.com/dashboard/account/tokens"
      echo ""
      echo "Then run:"
      echo "export SUPABASE_ACCESS_TOKEN=your_token_here"
      echo "./scripts/deploy-to-all-projects.sh"
      exit 1
    fi
    
    echo ""
    echo "Deploying via Management API..."
    for project in "${PROJECTS[@]}"; do
      IFS=':' read -r project_id project_name <<< "$project"
      echo ""
      echo "Deploying to $project_name ($project_id)..."
      node scripts/deploy-edge-function.js "$project_id"
    done
    ;;
  *)
    echo "Invalid option"
    exit 1
    ;;
esac

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Changes deployed:"
echo "  ✅ Deduplication fix in handleGenerateKeyFacts"
echo "  ✅ State variant extractor reverted to original"
echo ""
