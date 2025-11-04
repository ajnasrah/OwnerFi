#!/bin/bash

source .env.local

for id in "wf_1761681720844_dkty8o8sl" "wf_1761681717327_0rqnnwtrz" "wf_1761681713687_w3tqnggmj" "wf_1761681709784_q7ad5hhu9"; do
  echo "Marking $id as failed..."
  curl -s 'https://ownerfi.ai/api/admin/force-complete-workflow' \
    -X POST \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $CRON_SECRET" \
    -d "{\"workflowId\":\"$id\",\"brand\":\"abdullah\",\"action\":\"fail\",\"reason\":\"Submagic virus scan failed\"}" | jq '.success'
  sleep 1
done

echo ""
echo "Checking remaining stuck workflows..."
curl -s 'https://ownerfi.ai/api/workflow/logs' | jq '{
  abdullah_stuck: [.workflows.abdullah[] | select(.status == "submagic_processing")] | length
}'
