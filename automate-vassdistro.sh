#!/bin/bash

# Complete VassDistro Automation Script
# This script will ensure VassDistro ALWAYS has articles available

set -e

CRON_SECRET=$(grep "^CRON_SECRET=" .env.local | cut -d'=' -f2)
BASE_URL="https://ownerfi.ai"

echo "🤖 VassDistro Complete Automation"
echo "=================================="
echo ""

# Step 1: Unmark all processed articles (make them available again)
echo "🔓 Step 1: Unmarking processed articles..."
curl -s -X POST "$BASE_URL/api/admin/unmark-vassdistro" -m 30 || echo "Endpoint may not be deployed yet"
echo ""

# Step 2: Fetch fresh RSS articles
echo "📡 Step 2: Fetching RSS articles..."
FETCH_RESULT=$(curl -s -X GET "$BASE_URL/api/cron/fetch-rss" -H "Authorization: Bearer $CRON_SECRET" -m 60)
echo "$FETCH_RESULT" | python3 -m json.tool | grep -A 3 "vassdistro"
echo ""

# Step 3: Rate all articles
echo "🤖 Step 3: Rating articles with AI..."
RATE_RESULT=$(curl -s -X GET "$BASE_URL/api/cron/rate-articles" -H "Authorization: Bearer $CRON_SECRET" -m 180)
echo "$RATE_RESULT" | python3 -m json.tool | grep -A 10 "vassdistro"
echo ""

# Step 4: Test workflow
echo "✅ Step 4: Testing workflow..."
WORKFLOW_RESULT=$(curl -s -X POST "$BASE_URL/api/workflow/complete-viral" \
  -H "Content-Type: application/json" \
  -d '{"brand":"vassdistro","platforms":["instagram","tiktok"],"schedule":"immediate"}' \
  -m 30)

if echo "$WORKFLOW_RESULT" | grep -q "\"success\":true"; then
  echo "✅ WORKFLOW WORKING!"
  echo "$WORKFLOW_RESULT" | python3 -m json.tool | grep -E "(workflow_id|title)" | head -5
else
  echo "❌ WORKFLOW FAILED:"
  echo "$WORKFLOW_RESULT"
fi

echo ""
echo "=================================="
