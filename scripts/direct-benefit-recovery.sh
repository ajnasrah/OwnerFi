#!/bin/bash
# Direct recovery for stuck benefit workflows using actual workflow data

BASE_URL="https://ownerfi.ai"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Direct Benefit Workflow Recovery"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get all stuck benefit workflows
workflows=$(curl -s "$BASE_URL/api/benefit/workflow/logs?limit=50" \
  -H "User-Agent: vercel-cron/1.0" | \
  jq -r '.workflows[] | select(.status == "video_processing") | .id')

if [ -z "$workflows" ]; then
  echo "✅ No stuck workflows found!"
  exit 0
fi

count=$(echo "$workflows" | wc -l | tr -d ' ')
echo "Found $count stuck benefit workflows"
echo ""

# Get CRON_SECRET from production (using vercel env)
CRON_SECRET=$(vercel env pull /tmp/.env.production 2>&1 >/dev/null && grep "^CRON_SECRET=" /tmp/.env.production | cut -d'=' -f2 | tr -d '"')

if [ -z "$CRON_SECRET" ]; then
  echo "❌ Could not retrieve CRON_SECRET from Vercel"
  echo "   Falling back to triggering via cron endpoint..."

  # Trigger the cron which will process these
  echo ""
  echo "🔄 Triggering consolidated cron to process stuck workflows..."
  result=$(curl -s "$BASE_URL/api/cron/check-stuck-workflows" \
    -H "User-Agent: vercel-cron/1.0")

  echo "$result" | jq '.'

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ Cron triggered - workflows should process within 5 minutes"
  echo "   Run 'bash scripts/check-last-24h-workflows.sh' to verify"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  exit 0
fi

# Process each workflow
for workflow_id in $workflows; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔄 Processing: $workflow_id"

  # Get full workflow data
  workflow_data=$(curl -s "$BASE_URL/api/benefit/workflow/logs?limit=100" \
    -H "User-Agent: vercel-cron/1.0" | \
    jq -r --arg id "$workflow_id" '.workflows[] | select(.id == $id)')

  video_url=$(echo "$workflow_data" | jq -r '.submagicDownloadUrl // .finalVideoUrl // empty')
  project_id=$(echo "$workflow_data" | jq -r '.submagicVideoId // .submagicProjectId // empty')

  if [ -z "$video_url" ]; then
    echo "   ❌ Missing video URL - cannot recover"
    continue
  fi

  echo "   Video URL: ${video_url:0:70}..."
  echo "   SubMagic ID: $project_id"
  echo ""
  echo "   Triggering worker endpoint..."

  # Call worker with proper auth
  response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/workers/process-video" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CRON_SECRET" \
    -d "{
      \"brand\": \"benefit\",
      \"workflowId\": \"$workflow_id\",
      \"videoUrl\": \"$video_url\",
      \"submagicProjectId\": \"$project_id\"
    }")

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "200" ]; then
    echo "   ✅ SUCCESS - Worker triggered"
    echo "$body" | jq -r '   "   Post ID: \(.postId // "processing...")"' 2>/dev/null
  else
    echo "   ❌ FAILED (HTTP $http_code)"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
  fi

  echo ""
  sleep 2  # Rate limit protection
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Recovery complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
