#!/bin/bash
# Fix HeyGen Quota Check Issue
# Run this script to bypass the quota check when HeyGen dashboard shows credits but API reports 0

echo "🔧 Fixing HeyGen Quota Check Issue"
echo ""
echo "This will add BYPASS_HEYGEN_QUOTA_CHECK=true to Vercel production environment"
echo "Use this TEMPORARILY when:"
echo "  - HeyGen dashboard shows 500 credits"
echo "  - But API returns 0 credits"
echo "  - Videos are failing with 'Insufficient HeyGen quota' error"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

echo ""
echo "📝 Adding environment variable to Vercel..."
vercel env add BYPASS_HEYGEN_QUOTA_CHECK production <<< "true"

echo ""
echo "🚀 Triggering new deployment to apply changes..."
vercel --prod

echo ""
echo "✅ Done! Your next videos should bypass the quota check."
echo ""
echo "⚠️  IMPORTANT: Monitor your actual HeyGen credit usage!"
echo "   This bypass trusts your dashboard count, not the API."
echo ""
echo "🔍 To debug the root cause:"
echo "   1. Check Vercel logs for 'HeyGen Quota API Response'"
echo "   2. Verify your HeyGen API key matches the dashboard account"
echo "   3. Contact HeyGen support about API/dashboard discrepancy"
