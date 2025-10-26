#!/bin/bash

# Fix VassDistro - Fetch and rate articles on production
# Run this script to initialize VassDistro with articles

echo "🚀 Fixing VassDistro Article System"
echo "===================================="
echo ""

# Get CRON_SECRET from .env.local
CRON_SECRET=$(grep "^CRON_SECRET=" .env.local | cut -d'=' -f2)

if [ -z "$CRON_SECRET" ]; then
  echo "❌ CRON_SECRET not found in .env.local"
  exit 1
fi

BASE_URL="https://ownerfi.ai"

echo "📡 Step 1: Fetching articles from RSS feeds..."
echo "This will take ~10-30 seconds..."
echo ""

FETCH_RESULT=$(curl -s -X GET "$BASE_URL/api/cron/fetch-rss" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -m 60)

echo "$FETCH_RESULT" | python3 -m json.tool 2>/dev/null || echo "$FETCH_RESULT"
echo ""

# Check if fetch was successful
if echo "$FETCH_RESULT" | grep -q "\"success\":true"; then
  echo "✅ RSS fetch completed!"

  # Extract article counts
  NEW_ARTICLES=$(echo "$FETCH_RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('newArticles', 0))" 2>/dev/null || echo "0")

  echo "   New articles fetched: $NEW_ARTICLES"
  echo ""

  if [ "$NEW_ARTICLES" -eq "0" ]; then
    echo "⚠️  No new articles fetched (feeds may have been recently fetched)"
    echo "   Articles might already exist in database"
    echo ""
  fi
else
  echo "❌ RSS fetch failed!"
  echo "Response: $FETCH_RESULT"
  echo ""
  exit 1
fi

echo "🤖 Step 2: Rating articles with AI..."
echo "This will take ~1-3 minutes..."
echo ""

RATE_RESULT=$(curl -s -X GET "$BASE_URL/api/cron/rate-articles" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -m 180)

echo "$RATE_RESULT" | python3 -m json.tool 2>/dev/null || echo "$RATE_RESULT"
echo ""

# Check if rating was successful
if echo "$RATE_RESULT" | grep -q "\"success\":true"; then
  echo "✅ Article rating completed!"

  # Extract VassDistro stats
  VASSDISTRO_STATS=$(echo "$RATE_RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); vd=d.get('results',{}).get('vassdistro',{}); print(f\"Newly rated: {vd.get('newlyRated', 0)}, Total in queue: {vd.get('totalInQueue', 0)}, Top scores: {vd.get('topScores', [])}\")" 2>/dev/null || echo "N/A")

  echo "   VassDistro: $VASSDISTRO_STATS"
  echo ""
else
  echo "❌ Article rating failed!"
  echo "Response: $RATE_RESULT"
  echo ""
  exit 1
fi

echo "✅ VassDistro system initialized!"
echo ""
echo "📊 Testing workflow..."
echo ""

# Test the workflow
WORKFLOW_RESULT=$(curl -s -X POST "$BASE_URL/api/workflow/complete-viral" \
  -H "Content-Type: application/json" \
  -d '{"brand":"vassdistro","platforms":["instagram","tiktok"],"schedule":"immediate"}' \
  -m 30)

if echo "$WORKFLOW_RESULT" | grep -q "\"success\":true"; then
  echo "✅ Workflow test PASSED!"
  echo ""
  WORKFLOW_ID=$(echo "$WORKFLOW_RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('workflow_id', 'N/A'))" 2>/dev/null || echo "N/A")
  ARTICLE_TITLE=$(echo "$WORKFLOW_RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('article',{}).get('title', 'N/A'))" 2>/dev/null || echo "N/A")

  echo "   Workflow ID: $WORKFLOW_ID"
  echo "   Article: $ARTICLE_TITLE"
  echo ""
  echo "🎉 SUCCESS! VassDistro is working perfectly!"
else
  echo "❌ Workflow test FAILED!"
  echo "Response: $WORKFLOW_RESULT"
  echo ""
  echo "This might mean:"
  echo "  - No articles with score >= 70"
  echo "  - All articles are processed"
  echo "  - All articles are too old"
fi

echo ""
echo "===================================="
echo "Done!"
