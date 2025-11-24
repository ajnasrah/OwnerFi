#!/bin/bash

# Schedule Archive Deletion
# Creates a reminder to delete .archive/ after 30-day safety period

set -e

ARCHIVE_DATE="2025-11-10"
DELETION_DATE="2025-12-10"
TODAY=$(date +%Y-%m-%d)

echo "════════════════════════════════════════════════════"
echo "📅 ARCHIVE DELETION SCHEDULER"
echo "════════════════════════════════════════════════════"
echo ""
echo "Archive Information:"
echo "  📁 Location: .archive/"
echo "  📊 Size: 4.0 MB (423 files)"
echo "  📅 Archive Date: $ARCHIVE_DATE"
echo "  🗓️  Safe Deletion Date: $DELETION_DATE"
echo "  📆 Today: $TODAY"
echo ""

# Calculate days until safe deletion
archive_epoch=$(date -j -f "%Y-%m-%d" "$ARCHIVE_DATE" +%s)
deletion_epoch=$(date -j -f "%Y-%m-%d" "$DELETION_DATE" +%s)
today_epoch=$(date +%s)

days_since_archive=$(( (today_epoch - archive_epoch) / 86400 ))
days_until_deletion=$(( (deletion_epoch - today_epoch) / 86400 ))

echo "Timeline:"
echo "  ⏱️  Days since archive: $days_since_archive days"
echo "  ⏰ Days until safe deletion: $days_until_deletion days"
echo ""

if [ $days_until_deletion -le 0 ]; then
  echo "✅ Safe deletion date has passed!"
  echo ""
  echo "Would you like to delete .archive/ now? (y/n)"
  read -r response

  if [ "$response" = "y" ]; then
    echo ""
    echo "🗑️  Deleting .archive/..."
    du -sh .archive
    rm -rf .archive
    echo "✅ Archive deleted successfully!"
  else
    echo "❌ Deletion cancelled"
  fi
else
  echo "⚠️  Archive is only $days_since_archive days old"
  echo "⏳ Wait $days_until_deletion more days for 30-day safety period"
  echo ""
  echo "Creating deletion reminder..."

  # Create a reminder file
  cat > .archive-deletion-reminder.txt << EOF
═══════════════════════════════════════════════════════════
ARCHIVE DELETION REMINDER
═══════════════════════════════════════════════════════════

📁 Archive: .archive/
📊 Size: 4.0 MB (423 files)
📅 Archived: $ARCHIVE_DATE
🗓️  Safe to delete after: $DELETION_DATE

Current Status (as of $TODAY):
  • Days since archive: $days_since_archive
  • Days until safe deletion: $days_until_deletion

To delete the archive after $DELETION_DATE, run:
  rm -rf .archive

Or run this script again:
  ./scripts/schedule-archive-deletion.sh

Files in archive:
  • 241 old scripts
  • 64 old docs
  • 27 root tests
  • 15 old API routes
  • 13 misc files

═══════════════════════════════════════════════════════════
EOF

  echo "✅ Reminder created: .archive-deletion-reminder.txt"
  echo ""
  echo "Run this script again after $DELETION_DATE to safely delete the archive"
fi

echo ""
echo "════════════════════════════════════════════════════"
