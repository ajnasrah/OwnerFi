#!/bin/bash

# Load environment
source .env.local

# Run the stuck workflows check
echo "🔧 Checking for stuck property video workflows..."

# Call the cron endpoint
curl -X POST "https://ownerfi.ai/api/cron/check-stuck-submagic" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -s | jq .
