#!/bin/bash
# Manually trigger recovery for stuck benefit workflows

CRON_SECRET="418eea4a4cf7576b00b0cd85e402b649570525c055fd78386e7d989e8903d9da"
BASE_URL="https://ownerfi.ai"

# The 5 stuck workflows from last 24h
WORKFLOWS=(
  "benefit_1763068844464_hqrcgnums"
  "benefit_1763058044883_j2zpafivz"
  "benefit_1763047203623_noav4vjt4"
  "benefit_1763036403617_nx9qflpjt"
  "benefit_1763025604074_fmjykq12a"
)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Recovering 5 Stuck Benefit Workflows"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

for workflow in "${WORKFLOWS[@]}"; do
  echo "🔄 Triggering worker for: $workflow"

  # Get workflow data
  workflow_data=$(curl -s "$BASE_URL/api/benefit/workflow/logs?limit=100" \
    -H "User-Agent: vercel-cron/1.0" | \
    jq -r --arg id "$workflow" '.workflows[] | select(.id == $id)')

  if [ -z "$workflow_data" ] || [ "$workflow_data" == "null" ]; then
    echo "   ❌ Workflow not found"
    continue
  fi

  # Extract data
  submagic_download_url=$(echo "$workflow_data" | jq -r '.submagicDownloadUrl // empty')
  submagic_project_id=$(echo "$workflow_data" | jq -r '.submagicVideoId // .submagicProjectId // empty')
  status=$(echo "$workflow_data" | jq -r '.status')

  echo "   Status: $status"
  echo "   SubMagic Project ID: ${submagic_project_id:-MISSING}"
  echo "   SubMagic URL: ${submagic_download_url:0:60}..."

  if [ "$status" != "video_processing" ]; then
    echo "   ⚠️  Status is not video_processing, skipping"
    continue
  fi

  if [ -z "$submagic_download_url" ] && [ -z "$submagic_project_id" ]; then
    echo "   ❌ Missing both download URL and project ID"
    continue
  fi

  # Trigger worker endpoint
  result=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/workers/process-video" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "X-Cloud-Tasks-Worker: $CRON_SECRET" \
    -d "{
      \"brand\": \"benefit\",
      \"workflowId\": \"$workflow\",
      \"videoUrl\": \"$submagic_download_url\",
      \"submagicProjectId\": \"$submagic_project_id\"
    }")

  http_code=$(echo "$result" | tail -1)
  response=$(echo "$result" | head -1)

  if [ "$http_code" == "200" ]; then
    echo "   ✅ Worker triggered successfully"
    echo "   Response: $response" | jq '.' 2>/dev/null || echo "$response"
  else
    echo "   ❌ Worker failed (HTTP $http_code)"
    echo "   Response: $response"
  fi

  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Recovery complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
