#!/bin/bash

# Retry all stuck workflows by triggering cron jobs
# This will pick up any workflows stuck in video_processing or failed status

BASE_URL="https://ownerfi.ai"
CRON_SECRET="${CRON_SECRET:-418eea4a4cf7576b00b0cd85e402b649570525c055fd78386e7d989e8903d9da}"

echo "═══════════════════════════════════════════"
echo "   Retry All Stuck Workflows"
echo "═══════════════════════════════════════════"
echo ""

# Function to trigger cron job
trigger_cron() {
  local endpoint=$1
  local name=$2

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔄 Triggering: $name"
  echo "   Endpoint: $endpoint"
  echo ""

  response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/cron/$endpoint" \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" \
    2>&1)

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "200" ]; then
    echo "✅ SUCCESS"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
  else
    echo "❌ FAILED: HTTP $http_code"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
  fi

  echo ""
  sleep 3
}

# Trigger all relevant cron jobs
trigger_cron "check-stuck-posting" "Check Stuck in Posting Status"
trigger_cron "check-stuck-heygen" "Check Stuck in HeyGen Processing"
trigger_cron "check-stuck-submagic" "Check Stuck in Submagic Processing"
trigger_cron "check-stuck-workflows" "Check All Stuck Workflows"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ All cron jobs triggered"
echo ""
echo "The workflows should now be processing in the background."
echo "Check your dashboard in a few minutes to verify completion."
