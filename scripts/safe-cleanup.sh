#!/bin/bash

# Safe Cleanup Script
# Deletes only 100% safe items: empty directories and backup files

set -e

echo "════════════════════════════════════════════════════"
echo "🧹 SAFE CLEANUP SCRIPT"
echo "════════════════════════════════════════════════════"
echo ""
echo "This will delete:"
echo "  ✅ 4 empty test directories"
echo "  ✅ 3 code backup files (keeping .env.local backup)"
echo ""
echo "Starting cleanup in 3 seconds..."
sleep 3

# Counter
deleted=0

# Delete empty test directories
echo ""
echo "📁 Removing empty test directories..."
for dir in src/app/api/test-all-feeds src/app/api/test-cities src/app/api/test-env src/app/api/test-rss; do
  if [ -d "$dir" ]; then
    echo "  🗑️  Deleting: $dir"
    rm -rf "$dir"
    deleted=$((deleted + 1))
  fi
done

# Delete code backup files (keep .env.local backup)
echo ""
echo "📄 Removing code backup files..."
backups=(
  "src/app/globals.css.backup"
  "src/config/feed-sources.ts.backup-1761433071661"
  "src/lib/owner-financing-filter.ts.backup"
)

for file in "${backups[@]}"; do
  if [ -f "$file" ]; then
    echo "  🗑️  Deleting: $file"
    rm "$file"
    deleted=$((deleted + 1))
  fi
done

echo ""
echo "════════════════════════════════════════════════════"
echo "✅ CLEANUP COMPLETE"
echo "════════════════════════════════════════════════════"
echo "Total items deleted: $deleted"
echo ""
echo "✅ Kept: .env.local.backup.20251123_113555 (recent env backup)"
echo ""
