#!/bin/bash

# PHASE 2: ARCHIVE OLD SCRIPTS
# Moves one-off migration, emergency fix, and diagnostic scripts to .archive/
# Created: 2025-10-30
# Risk Level: LOW - Scripts are moved, not deleted (can be restored)

# set -e  # Disabled to continue through missing files

echo "=========================================="
echo "OWNERFI CLEANUP - PHASE 2: ARCHIVE SCRIPTS"
echo "=========================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

archived_count=0

# Function to move script to archive
archive_script() {
    local script=$1
    local category=$2

    if [ -f "$script" ]; then
        mkdir -p ".archive/scripts/$category"
        mv "$script" ".archive/scripts/$category/"
        echo -e "${GREEN}✓ Archived:${NC} $script → .archive/scripts/$category/"
        ((archived_count++))
    fi
}

echo "Creating archive directory structure..."
mkdir -p .archive/scripts/{emergency-fixes,diagnostics,migrations,one-off,cleanup,sync}
echo -e "${BLUE}Created .archive/scripts/ structure${NC}"
echo ""

echo "Step 1: Archiving Emergency Fix Scripts..."
echo "-------------------------------------------"

archive_script "scripts/emergency-fix-stuck-workflows.ts" "emergency-fixes"
archive_script "scripts/fix-stuck-properties.ts" "emergency-fixes"
archive_script "scripts/fix-stuck-posting-now.ts" "emergency-fixes"
archive_script "scripts/fix-property-queue.ts" "emergency-fixes"
archive_script "scripts/recover-abdullah-stuck-workflows.ts" "emergency-fixes"
archive_script "scripts/recover-stuck-properties.ts" "emergency-fixes"
archive_script "scripts/complete-stuck-workflows.ts" "emergency-fixes"
archive_script "scripts/fix-pending-properties.ts" "emergency-fixes"
archive_script "scripts/force-complete-stuck.ts" "emergency-fixes"

echo ""
echo "Step 2: Archiving Diagnostic/Check Scripts..."
echo "-------------------------------------------"

archive_script "scripts/check-property-stuck.ts" "diagnostics"
archive_script "scripts/check-queue-vs-properties.ts" "diagnostics"
archive_script "scripts/check-late-data.ts" "diagnostics"
archive_script "scripts/check-property-details.js" "diagnostics"
archive_script "scripts/check-property-financials.js" "diagnostics"
archive_script "scripts/check-property-image.js" "diagnostics"
archive_script "scripts/check-random-properties.js" "diagnostics"
archive_script "scripts/check-specific-opportunity.js" "diagnostics"
archive_script "scripts/check-dallas-leads.js" "diagnostics"
archive_script "scripts/detailed-property-check.ts" "diagnostics"
archive_script "scripts/simple-queue-check.ts" "diagnostics"
archive_script "scripts/verify-balloon-properties.js" "diagnostics"
archive_script "scripts/verify-opportunity-ids.js" "diagnostics"
archive_script "scripts/debug-nearby-cities.js" "diagnostics"
archive_script "scripts/test-property-query.ts" "diagnostics"
archive_script "scripts/test-search-filters.ts" "diagnostics"
archive_script "scripts/validate-property-data.ts" "diagnostics"

echo ""
echo "Step 3: Archiving Sync/Reset Scripts..."
echo "-------------------------------------------"

archive_script "scripts/sync-missing-properties.ts" "sync"
archive_script "scripts/sync-remaining-properties.ts" "sync"
archive_script "scripts/sync-single-property.ts" "sync"
archive_script "scripts/sync-two-remaining.ts" "sync"
archive_script "scripts/reset-and-reprocess.ts" "sync"
archive_script "scripts/reset-property-queue.ts" "sync"
archive_script "scripts/reset-stuck-queue.ts" "sync"
archive_script "scripts/reset-all-articles.ts" "sync"
archive_script "scripts/clear-and-repopulate-queue.ts" "sync"

echo ""
echo "Step 4: Archiving Cleanup/Delete Scripts..."
echo "-------------------------------------------"

archive_script "scripts/delete-duplicates.js" "cleanup"
archive_script "scripts/delete-not-available-properties.js" "cleanup"
archive_script "scripts/delete-property-by-id.js" "cleanup"
archive_script "scripts/delete-all-zillow-imports.ts" "cleanup"
archive_script "scripts/cleanup-empty-articles.ts" "cleanup"
archive_script "scripts/cleanup-empty-zillow-imports.ts" "cleanup"
archive_script "scripts/cleanup-heygen-webhooks.mjs" "cleanup"
archive_script "scripts/remove-duplicates.ts" "cleanup"
archive_script "scripts/remove-invalid-properties.ts" "cleanup"

echo ""
echo "Step 5: Archiving Old Migration Scripts..."
echo "-------------------------------------------"

archive_script "scripts/import-balloon-payment-data.js" "migrations"
archive_script "scripts/import-csv-to-firebase.js" "migrations"
archive_script "scripts/import-from-json.ts" "migrations"
archive_script "scripts/migrate-property-data.ts" "migrations"
archive_script "scripts/update-property-financials-v2.js" "migrations"
archive_script "scripts/update-interest-rates-from-csv.js" "migrations"
archive_script "scripts/backfill-property-data.ts" "migrations"
archive_script "scripts/migrate-old-properties.ts" "migrations"

echo ""
echo "Step 6: Archiving Deprecated Zillow Scrapers..."
echo "-------------------------------------------"

archive_script "scripts/zillow-bookmarklet.js" "one-off"
archive_script "scripts/zillow-console-script.js" "one-off"
archive_script "scripts/zillow-save-bookmarklet.js" "one-off"
archive_script "scripts/zillow-scraper-debug.ts" "one-off"
archive_script "scripts/zillow-scraper-limited.ts" "one-off"

echo ""
echo "Step 7: Archiving One-Off Setup Scripts..."
echo "-------------------------------------------"

archive_script "scripts/create-test-property.ts" "one-off"
archive_script "scripts/generate-mock-data.ts" "one-off"
archive_script "scripts/test-workflow.ts" "one-off"
archive_script "scripts/one-time-fix.ts" "one-off"

echo ""
echo "Creating ARCHIVED_SCRIPTS_INDEX.md..."
cat > .archive/scripts/README.md << 'EOF'
# Archived Scripts Index

These scripts have been archived because they were:
- One-off migrations (completed)
- Emergency fixes for resolved issues
- Diagnostic scripts for past problems
- Deprecated implementations

## Directory Structure

- **emergency-fixes/** - Scripts that fixed stuck workflows, properties (Oct 2024)
- **diagnostics/** - Check/verify scripts used for debugging
- **migrations/** - One-time data migrations and imports
- **sync/** - Reset/sync operations (completed)
- **cleanup/** - Delete/cleanup operations (completed)
- **one-off/** - Deprecated scrapers and test scripts

## Restoration

If you need to restore any script:
```bash
cp .archive/scripts/[category]/[script-name] scripts/
```

## Archived Date
2025-10-30

## Active Scripts Remaining
See `/scripts/` directory for currently active automation scripts.
EOF

echo -e "${GREEN}✓ Created .archive/scripts/README.md${NC}"

echo ""
echo "=========================================="
echo "PHASE 2 COMPLETE"
echo "=========================================="
echo -e "${GREEN}Successfully archived: $archived_count scripts${NC}"
echo ""
echo "Remaining active scripts: $(ls -1 scripts/*.{ts,js,mjs} 2>/dev/null | wc -l)"
echo ""
echo "Next steps:"
echo "  - Review active scripts: ls scripts/"
echo "  - Review git status: git status"
echo "  - Run Phase 3: ./cleanup-phase3-organize-docs.sh"
echo ""
