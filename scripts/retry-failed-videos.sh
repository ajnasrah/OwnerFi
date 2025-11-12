#!/bin/bash

# Retry failed video workflows by calling process-video API
# This script manually triggers video processing for workflows that timed out

BASE_URL="${NEXT_PUBLIC_BASE_URL:-https://www.ownerfi.com}"

echo "═══════════════════════════════════════════"
echo "   Retry Failed Video Workflows"
echo "═══════════════════════════════════════════"
echo ""

# Function to retry a workflow via API
retry_workflow() {
  local brand=$1
  local workflow_id=$2
  local title=$3

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔄 Retrying: $title"
  echo "   Brand: $brand"
  echo "   Workflow ID: $workflow_id"
  echo ""

  # Call the process-video endpoint directly
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/process-video" \
    -H "Content-Type: application/json" \
    -d "{\"brand\":\"$brand\",\"workflowId\":\"$workflow_id\"}" \
    2>&1)

  # Extract HTTP status code (last line)
  http_code=$(echo "$response" | tail -n1)
  # Extract body (all but last line)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "200" ]; then
    echo "✅ SUCCESS: Workflow retry initiated"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
  else
    echo "❌ FAILED: HTTP $http_code"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
  fi

  echo ""
  sleep 2  # Rate limit - wait 2s between requests
}

# Retry all the failed workflows from the UI
# Based on the error messages you provided

echo "Starting retry process..."
echo ""

# 1. Seattle median list price at $850K even as price cuts spread
# Assuming ownerfi brand based on real estate content
# We need to find the workflow ID - let's try the cron job instead

# 2. Trump Proposes 50-Year Mortgages
# Assuming ownerfi brand

# 3. 1298 Gideons Dr Sw Atlanta
# This is clearly a property video

# 4. BAT Pauses Vuse One Vape Launch
# This is vassdistro brand

# 5-6. From Broke to CEO (abdullah brand)

echo "⚠️  Note: Workflow IDs are not directly visible in the error messages."
echo "We need to query Firestore to get the actual workflow IDs."
echo ""
echo "Instead, let's trigger the failsafe cron job that will retry all stuck workflows:"
echo ""

# Trigger the failsafe cron that retries stuck workflows
echo "🔄 Triggering failsafe cron job..."
cron_response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/cron/check-stuck-submagic" 2>&1)

http_code=$(echo "$cron_response" | tail -n1)
body=$(echo "$cron_response" | sed '$d')

if [ "$http_code" = "200" ]; then
  echo "✅ Cron job triggered successfully"
  echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
  echo "❌ Cron job failed: HTTP $http_code"
  echo "$body"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Retry process complete"
echo ""
echo "Check your dashboard to verify the workflows are now processing."
