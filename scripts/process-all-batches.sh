#!/bin/bash

echo "🚀 Processing ALL pending cash deals properties..."
echo ""

BATCH=1
while true; do
  echo "=== Batch $BATCH ==="

  # Run processing
  OUTPUT=$(npx tsx scripts/process-cash-queue-manual.ts 2>&1)

  # Check if there are no more pending
  if echo "$OUTPUT" | grep -q "No pending items"; then
    echo "✅ All batches complete!"
    break
  fi

  # Show summary
  echo "$OUTPUT" | grep -E "Processing|CASH DEAL|Saved|Filtered out|Missing data" | head -15
  echo ""

  ((BATCH++))

  # Small delay between batches
  sleep 2
done

echo ""
echo "📊 Final Results:"
npx tsx scripts/check-cash-queue.ts 2>&1 | grep -A 20 "Cash Houses"
