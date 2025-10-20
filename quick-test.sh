#!/bin/bash

# Quick test to see which crons are actually working

echo "Quick Cron Test for OwnerFi"
echo "==========================="
echo ""

if [ -z "$CRON_SECRET" ]; then
    echo "ERROR: CRON_SECRET not set"
    echo "Run: export CRON_SECRET=your_secret"
    exit 1
fi

echo "Testing 3 critical failsafe endpoints..."
echo ""

# Test 1: Posting Failsafe (NEW - most important)
echo "1. Testing Posting Failsafe (fixes your stuck workflows)..."
curl -s -o /tmp/posting.json -w "HTTP %{http_code}\n" \
  -X POST https://ownerfi.ai/api/cron/check-stuck-posting \
  -H "Authorization: Bearer $CRON_SECRET"

if [ $? -eq 0 ]; then
    echo "   Response saved to /tmp/posting.json"
    cat /tmp/posting.json | head -c 200
    echo ""
fi
echo ""

# Test 2: Submagic Failsafe
echo "2. Testing Submagic Failsafe..."
curl -s -o /tmp/submagic.json -w "HTTP %{http_code}\n" \
  -X POST https://ownerfi.ai/api/cron/check-stuck-submagic \
  -H "Authorization: Bearer $CRON_SECRET"

if [ $? -eq 0 ]; then
    echo "   Response saved to /tmp/submagic.json"
    cat /tmp/submagic.json | head -c 200
    echo ""
fi
echo ""

# Test 3: HeyGen Failsafe
echo "3. Testing HeyGen Failsafe..."
curl -s -o /tmp/heygen.json -w "HTTP %{http_code}\n" \
  -X POST https://ownerfi.ai/api/cron/check-stuck-heygen \
  -H "Authorization: Bearer $CRON_SECRET"

if [ $? -eq 0 ]; then
    echo "   Response saved to /tmp/heygen.json"
    cat /tmp/heygen.json | head -c 200
    echo ""
fi
echo ""

echo "==========================="
echo "If you got HTTP 200 responses above, the endpoints work!"
echo "Check the full responses in /tmp/*.json"
echo ""
echo "Next: Check Vercel Dashboard → Settings → Crons"
echo "to see which crons are actually scheduled."
