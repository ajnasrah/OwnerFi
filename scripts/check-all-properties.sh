#!/bin/bash
# Run the check-all-properties endpoint repeatedly until all properties are checked.
# Usage: CRON_SECRET=xxx ./scripts/check-all-properties.sh [base_url]
#
# Examples:
#   CRON_SECRET=your_secret ./scripts/check-all-properties.sh
#   CRON_SECRET=your_secret ./scripts/check-all-properties.sh https://ownerfi.com

set -e

BASE_URL="${1:-https://ownerfi.com}"
BATCH_SIZE=50
RUN=1

if [ -z "$CRON_SECRET" ]; then
  echo "Error: CRON_SECRET env var required"
  echo "Usage: CRON_SECRET=xxx ./scripts/check-all-properties.sh"
  exit 1
fi

echo "=== Checking ALL properties against Zillow ==="
echo "Base URL: $BASE_URL"
echo "Batch size: $BATCH_SIZE"
echo ""

while true; do
  echo "--- Run #$RUN ---"

  RESPONSE=$(curl -s -X POST \
    "${BASE_URL}/api/admin/check-all-properties?batchSize=${BATCH_SIZE}" \
    -H "Authorization: Bearer ${CRON_SECRET}")

  # Parse response
  SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "false")
  PROCESSED=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('processed', 0))" 2>/dev/null || echo "0")
  UPDATED=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('updated', 0))" 2>/dev/null || echo "0")
  DEACTIVATED=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('deactivated', 0))" 2>/dev/null || echo "0")
  REMAINING=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('remaining', -1))" 2>/dev/null || echo "-1")
  DURATION=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin).get('durationMs',0); print(f'{d/1000:.1f}')" 2>/dev/null || echo "?")

  if [ "$SUCCESS" != "True" ]; then
    echo "ERROR: $RESPONSE"
    echo "Retrying in 30 seconds..."
    sleep 30
    continue
  fi

  echo "  Processed: $PROCESSED | Updated: $UPDATED | Deactivated: $DEACTIVATED | Remaining: $REMAINING | ${DURATION}s"

  if [ "$REMAINING" = "0" ]; then
    echo ""
    echo "=== ALL PROPERTIES CHECKED ==="
    break
  fi

  RUN=$((RUN + 1))
  echo "  Waiting 15 seconds before next batch..."
  sleep 15
done
