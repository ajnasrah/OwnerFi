#!/bin/bash

# Manually trigger /api/process-video for stuck property video workflows
# Based on the screenshot, these workflow IDs are stuck in "posting" status

echo "🔄 Triggering stuck property video processing..."
echo ""

# You'll need to get the actual workflow IDs from Firestore
# For now, this is a template showing how to trigger them

BASE_URL="https://ownerfi.ai"

# Example workflow - replace with actual IDs from Firestore
# curl -X POST "$BASE_URL/api/process-video" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "brand": "property",
#     "workflowId": "property_15sec_XXXXX",
#     "submagicProjectId": "submagic-project-id-here"
#   }'

echo "❌ Please update this script with actual workflow IDs from Firestore"
echo ""
echo "To get workflow IDs, check the property_videos collection"
echo "Look for documents with status='posting' and created in the last 24 hours"
