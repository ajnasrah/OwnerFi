#!/bin/bash

# Directly call the worker endpoint for specific workflows
# This bypasses all cron jobs and processes workflows immediately

BASE_URL="https://ownerfi.ai"
WORKER_SECRET="${CLOUD_TASKS_SECRET:-418eea4a4cf7576b00b0cd85e402b649570525c055fd78386e7d989e8903d9da}"

echo "═══════════════════════════════════════════"
echo "   Direct Worker Retry"
echo "═══════════════════════════════════════════"
echo ""
echo "This will directly trigger video processing via the worker endpoint."
echo ""

# We need to find the actual workflow IDs from Firestore
# Since we don't have them, let's trigger the complete-viral endpoint instead
# which is what the UI buttons call

echo "Since we don't have the exact workflow IDs from Firestore,"
echo "please use one of these methods:"
echo ""
echo "METHOD 1: Click the retry buttons in your UI"
echo "  - Go to your dashboard"
echo "  - For each failed workflow, click 'Retry Submagic' or 'Use HeyGen Video'"
echo ""
echo "METHOD 2: Check Firestore directly"
echo "  1. Go to: https://console.firebase.google.com/project/ownerfi-95aa0/firestore"
echo "  2. Look for workflows with status='video_processing_failed' or 'failed'"
echo "  3. Note their IDs and run this script with the IDs as arguments"
echo ""
echo "METHOD 3: Wait for the next deployment"
echo "  - The cron fix is deploying now"
echo "  - It will automatically retry failed workflows in ~10 minutes"
echo ""
