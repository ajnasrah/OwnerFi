#!/bin/bash

# Manual workflow recovery script
# Processes stuck workflows by checking Submagic status and posting completed videos

source .env.local

STUCK_WORKFLOWS=$(curl -s 'https://ownerfi.ai/api/workflow/logs' | jq -r '.workflows.abdullah[] | select(.status == "submagic_processing") | "\(.id),\(.submagicVideoId)"')

echo "Found stuck workflows:"
echo "$STUCK_WORKFLOWS"
echo ""

while IFS=',' read -r WORKFLOW_ID SUBMAGIC_ID; do
  echo "Processing workflow: $WORKFLOW_ID (Submagic: $SUBMAGIC_ID)"

  curl -s "https://ownerfi.ai/api/process-video" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"workflowId\":\"$WORKFLOW_ID\",\"brand\":\"abdullah\",\"submagicProjectId\":\"$SUBMAGIC_ID\"}" \
    --max-time 300

  echo ""
  echo "---"
  sleep 2
done <<< "$STUCK_WORKFLOWS"

echo "Done! Checking results..."
sleep 5
curl -s 'https://ownerfi.ai/api/workflow/logs' | jq '{abdullah_stuck: [.workflows.abdullah[] | select(.status == "submagic_processing")] | length}'
