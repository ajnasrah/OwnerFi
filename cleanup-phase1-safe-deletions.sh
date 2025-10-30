#!/bin/bash

# PHASE 1: SAFE DELETIONS - Empty directories and backup files
# This script removes files/directories that are confirmed empty or duplicates
# Created: 2025-10-30
# Risk Level: LOW - All items are safe to delete

# set -e  # Exit on error - disabled to continue through warnings

echo "=========================================="
echo "OWNERFI CLEANUP - PHASE 1: SAFE DELETIONS"
echo "=========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

deleted_count=0
error_count=0

# Function to safely delete directory
delete_dir() {
    local dir=$1
    if [ -d "$dir" ] && [ -z "$(ls -A "$dir")" ]; then
        rm -rf "$dir"
        echo -e "${GREEN}✓ Deleted empty directory:${NC} $dir"
        ((deleted_count++))
    elif [ -d "$dir" ] && [ -n "$(ls -A "$dir")" ]; then
        echo -e "${YELLOW}⚠ Skipped (not empty):${NC} $dir"
        ((error_count++))
    else
        echo -e "${YELLOW}⚠ Already gone:${NC} $dir"
    fi
}

# Function to safely delete file
delete_file() {
    local file=$1
    if [ -f "$file" ]; then
        rm "$file"
        echo -e "${GREEN}✓ Deleted backup file:${NC} $file"
        ((deleted_count++))
    else
        echo -e "${YELLOW}⚠ Already gone:${NC} $file"
    fi
}

echo "Step 1: Deleting empty API directories..."
echo "-------------------------------------------"

# Empty API directories (confirmed empty via find command)
delete_dir "src/app/api/scraper/properties"
delete_dir "src/app/api/scraper/zillow"
delete_dir "src/app/api/auth/make-admin"
delete_dir "src/app/api/auth/create-admin"
delete_dir "src/app/api/auth/signup-v2"
delete_dir "src/app/api/health"
delete_dir "src/app/api/admin/scraper/batch-upload"
delete_dir "src/app/api/admin/debug-realtors"
delete_dir "src/app/api/admin/debug-profile"
delete_dir "src/app/api/admin/create-stripe-subscription"
delete_dir "src/app/api/admin/upload-properties"
delete_dir "src/app/api/admin/mock-buyers"
delete_dir "src/app/api/admin/find-stripe-customer"
delete_dir "src/app/api/admin/test-bed-bath-upload"
delete_dir "src/app/api/admin/cleanup-duplicates"
delete_dir "src/app/api/admin/consolidate-accounts"
delete_dir "src/app/api/admin/create-mock-buyers"
delete_dir "src/app/api/admin/create-mock-buyer"
delete_dir "src/app/api/admin/fix-credits"
delete_dir "src/app/api/admin/debug-buyers"

# Additional empty directories from comprehensive scan
delete_dir "src/app/api/scheduler"
delete_dir "src/app/api/startup"
delete_dir "src/app/api/test-cities"
delete_dir "src/app/api/test-env"
delete_dir "src/app/api/debug-buyer"
delete_dir "src/app/api/make/webhook"
delete_dir "src/app/api/webhooks/ghl"
delete_dir "src/app/api/buyer/property-actions"
delete_dir "src/app/api/buyer/register"
delete_dir "src/app/api/properties/populate-images"
delete_dir "src/app/api/properties/generate-street-view"
delete_dir "src/app/api/properties/auto-generate-images"
delete_dir "src/app/api/workflow/auto-video"
delete_dir "src/app/api/workflow/viral-video"
delete_dir "src/app/api/cron/check-stuck-video-processing"

echo ""
echo "Step 2: Deleting backup files..."
echo "-------------------------------------------"

delete_file ".env.local.bak"
delete_file ".env.local.bak2"
delete_file "src/app/globals.css.backup"

echo ""
echo "Step 3: Deleting duplicate config file..."
echo "-------------------------------------------"

# The "firestore 2.indexes.json" file appears to be an accidental duplicate
if [ -f "firestore 2.indexes.json" ]; then
    # First, let's verify it's truly a duplicate by comparing
    if [ -f "firestore.indexes.json" ]; then
        echo "Checking if 'firestore 2.indexes.json' is a duplicate..."
        if diff -q "firestore.indexes.json" "firestore 2.indexes.json" > /dev/null 2>&1; then
            delete_file "firestore 2.indexes.json"
            echo -e "${GREEN}✓ Files were identical - safe to delete${NC}"
        else
            echo -e "${YELLOW}⚠ Files differ - keeping both for manual review${NC}"
            echo "  Main:      $(wc -c < firestore.indexes.json) bytes"
            echo "  Duplicate: $(wc -c < "firestore 2.indexes.json") bytes"
            ((error_count++))
        fi
    else
        delete_file "firestore 2.indexes.json"
    fi
else
    echo -e "${YELLOW}⚠ Already gone:${NC} firestore 2.indexes.json"
fi

echo ""
echo "Step 4: Cleaning up empty parent directories..."
echo "-------------------------------------------"

# Remove empty parent directories left behind
find src/app/api -type d -empty -delete 2>/dev/null && echo -e "${GREEN}✓ Cleaned up empty parent directories${NC}" || true

echo ""
echo "=========================================="
echo "PHASE 1 COMPLETE"
echo "=========================================="
echo -e "${GREEN}Successfully deleted: $deleted_count items${NC}"
if [ $error_count -gt 0 ]; then
    echo -e "${YELLOW}Skipped/Warnings: $error_count items${NC}"
fi
echo ""
echo "Next steps:"
echo "  - Review git status: git status"
echo "  - Run Phase 2: ./cleanup-phase2-archive-scripts.sh"
echo ""
