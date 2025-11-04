#!/bin/bash

# Trigger the complete-viral endpoint to recover stuck workflows
# This endpoint handles retry logic for stuck workflows

echo "🔧 Triggering stuck workflow recovery..."
echo ""

# Get CRON_SECRET from .env.local
if [ -f .env.local ]; then
  export $(grep "^CRON_SECRET=" .env.local | xargs)
fi

if [ -z "$CRON_SECRET" ]; then
  echo "❌ CRON_SECRET not found in .env.local"
  exit 1
fi

echo "📡 Calling workflow recovery endpoint..."
curl -X POST 'https://ownerfi.ai/api/workflow/complete-viral' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $CRON_SECRET" \
  -d '{
    "action": "recover-all"
  }'

echo ""
echo ""
echo "✅ Recovery triggered! Check the workflow dashboard."
