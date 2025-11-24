#!/bin/bash

# Remove One-Time Migration Scripts
# Deletes completed migration, cleanup, and emergency fix scripts

set -e

echo "════════════════════════════════════════════════════"
echo "🗑️  ONE-TIME MIGRATION SCRIPT REMOVAL"
echo "════════════════════════════════════════════════════"
echo ""
echo "This will PERMANENTLY DELETE one-time migration scripts:"
echo ""
echo "Categories to remove:"
echo "  • cleanup-* (duplicate users, old systems, etc.)"
echo "  • migrate-* (database migrations)"
echo "  • fix-* (one-time bug fixes)"
echo "  • populate-* (initial data population)"
echo "  • emergency-* (emergency incident fixes)"
echo "  • test-migration-* (migration test scripts)"
echo ""
echo "⚠️  WARNING: These scripts will be DELETED, not archived"
echo ""
echo "Starting in 5 seconds... (Ctrl+C to cancel)"
sleep 5

deleted=0

echo ""
echo "🗑️  Removing migration scripts..."
echo ""

# CLEANUP SCRIPTS - One-time cleanup operations
echo "📦 Cleanup scripts:"
cleanup_scripts=(
  "cleanup-duplicate-users.ts"
  "cleanup-duplicate-property-videos.ts"
  "cleanup-empty-articles.ts"
  "cleanup-empty-zillow-imports.ts"
  "cleanup-heygen-webhooks.mjs"
  "cleanup-no-owner-financing-properties.ts"
  "cleanup-old-property-system.ts"
  "cleanup-old-search-properties.ts"
  "cleanup-orphaned-profiles.ts"
  "cleanup-orphaned-queue-entries.ts"
  "cleanup-property-queue.ts"
  "cleanup-test-buyers.ts"
)

for script in "${cleanup_scripts[@]}"; do
  if [ -f "scripts/$script" ]; then
    echo "  🗑️  $script"
    rm "scripts/$script"
    deleted=$((deleted + 1))
  fi
done

# MIGRATION SCRIPTS - Database schema/data migrations
echo ""
echo "🔄 Migration scripts:"
migration_scripts=(
  "migrate-add-source-field.ts"
  "migrate-all-realtors.ts"
  "migrate-existing-properties.ts"
  "test-migration-comprehensive.sh"
  "test-old-account-migration.ts"
)

for script in "${migration_scripts[@]}"; do
  if [ -f "scripts/$script" ]; then
    echo "  🗑️  $script"
    rm "scripts/$script"
    deleted=$((deleted + 1))
  fi
done

# POPULATE SCRIPTS - Initial data population
echo ""
echo "📥 Populate scripts:"
populate_scripts=(
  "populate-missing-nearby-cities.ts"
  "populate-new-property-queue.ts"
  "populate-property-queue.ts"
  "populate-property-rotation-queue.ts"
  "populate-with-geocoding.ts"
)

for script in "${populate_scripts[@]}"; do
  if [ -f "scripts/$script" ]; then
    echo "  🗑️  $script"
    rm "scripts/$script"
    deleted=$((deleted + 1))
  fi
done

# EMERGENCY FIX SCRIPTS - One-time incident responses
echo ""
echo "🚨 Emergency fix scripts:"
emergency_scripts=(
  "emergency-fix-abdullah.ts"
  "emergency-recover-all-stuck.ts"
  "fix-stuck-pending-workflows.ts"
  "fix-stuck-podcast-workflows.ts"
  "fix-stuck-script-generation.ts"
  "fix-heygen-quota.sh"
)

for script in "${emergency_scripts[@]}"; do
  if [ -f "scripts/$script" ]; then
    echo "  🗑️  $script"
    rm "scripts/$script"
    deleted=$((deleted + 1))
  fi
done

# ONE-TIME FIX SCRIPTS - Specific bug fixes
echo ""
echo "🔧 One-time fix scripts:"
fix_scripts=(
  "fix-abdullah-account.ts"
  "fix-abdullah-phone.ts"
  "fix-address-duplication.ts"
  "fix-all-missing-profiles.ts"
  "fix-all-property-addresses.ts"
  "fix-and-fill-zipcodes.ts"
  "fix-buyer-availability.ts"
  "fix-buyer-profile-userid.ts"
  "fix-csv-import-data.ts"
  "fix-existing-properties-with-calculations.ts"
  "fix-realtor-profile.ts"
  "fix-realtor-profiles.ts"
)

for script in "${fix_scripts[@]}"; do
  if [ -f "scripts/$script" ]; then
    echo "  🗑️  $script"
    rm "scripts/$script"
    deleted=$((deleted + 1))
  fi
done

# CHECK/VERIFY CLEANUP STATS
echo ""
echo "📊 Cleanup stats scripts:"
stats_scripts=(
  "check-zillow-cleanup-stats.ts"
)

for script in "${stats_scripts[@]}"; do
  if [ -f "scripts/$script" ]; then
    echo "  🗑️  $script"
    rm "scripts/$script"
    deleted=$((deleted + 1))
  fi
done

echo ""
echo "════════════════════════════════════════════════════"
echo "✅ ONE-TIME MIGRATION REMOVAL COMPLETE"
echo "════════════════════════════════════════════════════"
echo "Total scripts deleted: $deleted"
echo ""
echo "Remaining scripts: Diagnostic and operational tools"
echo ""
