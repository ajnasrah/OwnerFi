#!/bin/bash

# Load environment
source .env.local 2>/dev/null || true

CRON_SECRET="418eea4a4cf7576b00b0cd85e402b649570525c055fd78386e7d989e8903d9da"

echo "🎬 Triggering Test Videos for All 7 Brands"
echo "=========================================="
echo ""

# Abdullah - Manual generation
echo "📹 Triggering Abdullah video..."
curl -s -X POST "https://ownerfi.ai/api/workflow/complete-abdullah" \
  -H "Content-Type: application/json" \
  -d "{\"count\": 1}" | jq -r '.workflowIds[0] // .error'

echo ""

# Podcast - Manual generation
echo "📹 Triggering Podcast episode..."
curl -s -X POST "https://ownerfi.ai/api/podcast/generate" \
  -H "Content-Type: application/json" \
  -d "{\"guestType\": \"financial_advisor\"}" | jq -r '.workflowId // .error'

echo ""

# Property - Skip validations and try next property
echo "📹 Triggering Property video (trying multiple)..."
for i in {1..5}; do
  result=$(curl -s -X POST "https://ownerfi.ai/api/property/video-cron" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CRON_SECRET")

  success=$(echo "$result" | jq -r '.success')
  if [ "$success" = "true" ]; then
    echo "$result" | jq -r '.property.workflowId // "Generated successfully"'
    break
  else
    error=$(echo "$result" | jq -r '.error')
    echo "  Attempt $i failed: $error"
    if [ $i -lt 5 ]; then
      echo "  Trying next property..."
    fi
  fi
done

echo ""
echo "✅ All triggers sent!"
