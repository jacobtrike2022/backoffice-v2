#!/bin/bash
# Script to update .env file with Supabase configuration for O*NET import

ENV_FILE=".env"

# Check if .env exists, if not create it
if [ ! -f "$ENV_FILE" ]; then
    touch "$ENV_FILE"
fi

# Add or update SUPABASE_URL
if grep -q "SUPABASE_URL=" "$ENV_FILE"; then
    # Update existing
    sed -i '' 's|^SUPABASE_URL=.*|SUPABASE_URL=https://kgzhlvxzdlexsrozbbxs.supabase.co|' "$ENV_FILE"
else
    # Add new
    echo "" >> "$ENV_FILE"
    echo "# O*NET Import Configuration" >> "$ENV_FILE"
    echo "SUPABASE_URL=https://kgzhlvxzdlexsrozbbxs.supabase.co" >> "$ENV_FILE"
fi

# Add or update SUPABASE_SERVICE_ROLE_KEY (if provided as argument)
if [ -n "$1" ]; then
    if grep -q "SUPABASE_SERVICE_ROLE_KEY=" "$ENV_FILE"; then
        # Update existing
        sed -i '' "s|^SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=$1|" "$ENV_FILE"
    else
        # Add new
        echo "SUPABASE_SERVICE_ROLE_KEY=$1" >> "$ENV_FILE"
    fi
    echo "✅ Updated .env file with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
else
    echo "✅ Updated .env file with SUPABASE_URL"
    echo "⚠️  SUPABASE_SERVICE_ROLE_KEY not provided. Add it manually or run:"
    echo "   ./scripts/update-env.sh 'your-service-role-key'"
fi

