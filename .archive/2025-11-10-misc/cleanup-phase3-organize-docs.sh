#!/bin/bash

# PHASE 3: ORGANIZE DOCUMENTATION
# Moves scattered markdown files into organized /docs/ structure
# Created: 2025-10-30
# Risk Level: LOW - Files are moved, not deleted

# set -e  # Disabled to continue through missing files

echo "=========================================="
echo "OWNERFI CLEANUP - PHASE 3: ORGANIZE DOCS"
echo "=========================================="
echo ""

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

moved_count=0

# Function to move doc
move_doc() {
    local doc=$1
    local category=$2

    if [ -f "$doc" ]; then
        mkdir -p "docs/$category"
        mv "$doc" "docs/$category/"
        echo -e "${GREEN}✓ Moved:${NC} $doc → docs/$category/"
        ((moved_count++))
    fi
}

echo "Creating documentation directory structure..."
mkdir -p docs/{archive,guides,troubleshooting,systems,test-results}
echo -e "${BLUE}Created docs/ structure${NC}"
echo ""

echo "Step 1: Archiving completion reports..."
echo "-------------------------------------------"

move_doc "ABDULLAH_QUEUE_SYSTEM_COMPLETE.md" "archive"
move_doc "ANALYTICS_INTEGRATION_COMPLETE.md" "archive"
move_doc "BUYER_SYSTEM_REFACTORING_COMPLETE.md" "archive"
move_doc "DASHBOARDS_SETUP_COMPLETE.md" "archive"
move_doc "DEPLOYMENT_COMPLETE.md" "archive"
move_doc "PERFORMANCE_FIXES_APPLIED.md" "archive"
move_doc "VERIFICATION_COMPLETE.md" "archive"
move_doc "WEEK2_FIXES_IMPLEMENTED.md" "archive"
move_doc "CRITICAL_FIXES_IMPLEMENTED.md" "archive"
move_doc "COST_FIXES_IMPLEMENTED.md" "archive"

echo ""
echo "Step 2: Moving test results..."
echo "-------------------------------------------"

move_doc "ANALYTICS_TEST_RESULTS.md" "test-results"
move_doc "REAL_TEST_RESULTS.md" "test-results"
move_doc "TEST_RESULTS.md" "test-results"
move_doc "INITIAL_TEST_RESULTS.md" "test-results"

echo ""
echo "Step 3: Moving issue tracking docs..."
echo "-------------------------------------------"

move_doc "COST_DISASTERS_FOUND.md" "troubleshooting"
move_doc "CRITICAL_FIX_INSTRUCTIONS.md" "troubleshooting"
move_doc "CRITICAL_PROPERTY_BUYER_FIXES.md" "troubleshooting"
move_doc "FAILURE_TRACKING_SYSTEM.md" "troubleshooting"

echo ""
echo "Step 4: Moving system guides..."
echo "-------------------------------------------"

move_doc "AUTO_CLEANUP_README.md" "guides"
move_doc "BENEFIT_VIDEOS_README.md" "guides"
move_doc "DEPLOYMENT_GUIDE.md" "guides"
move_doc "WEBHOOK_REGISTRATION_GUIDE.md" "guides"
move_doc "SOCIAL_MEDIA_SYSTEM_DOCUMENTATION.md" "systems"
move_doc "ENVIRONMENT_VARIABLES.md" "guides"

echo ""
echo "Step 5: Creating documentation index..."

cat > docs/README.md << 'EOF'
# OwnerFi Documentation

Complete documentation for the OwnerFi owner financing platform.

## Directory Structure

### 📚 Guides (`/guides/`)
Step-by-step guides for system setup and configuration:
- Deployment procedures
- Webhook registration
- Environment configuration
- Auto-cleanup system

### 🏗️ Systems (`/systems/`)
Architecture and system documentation:
- Social media automation system
- Property workflow system
- Analytics and tracking

### 🐛 Troubleshooting (`/troubleshooting/`)
Issue resolution and debugging guides:
- Common problems and solutions
- Critical fixes applied
- Failure tracking

### 📦 Archive (`/archive/`)
Historical completion reports and resolved issues:
- Feature completion reports
- Performance fixes applied
- System refactoring records

### 🧪 Test Results (`/test-results/`)
Testing documentation and results:
- Analytics integration tests
- System verification tests
- Performance benchmarks

## Key Documentation Files

### Active Systems
- [Social Media System](systems/SOCIAL_MEDIA_SYSTEM_DOCUMENTATION.md)
- [Auto Cleanup](guides/AUTO_CLEANUP_README.md)
- [Deployment Guide](guides/DEPLOYMENT_GUIDE.md)

### Configuration
- [Environment Variables](guides/ENVIRONMENT_VARIABLES.md)
- [Webhook Registration](guides/WEBHOOK_REGISTRATION_GUIDE.md)

### Troubleshooting
- [Failure Tracking System](troubleshooting/FAILURE_TRACKING_SYSTEM.md)
- [Critical Fixes](troubleshooting/CRITICAL_FIX_INSTRUCTIONS.md)

## Main README
See [README.md](../README.md) in project root for getting started.

## Contributing to Docs
When adding new documentation:
1. Place in appropriate directory
2. Update this index
3. Use clear, descriptive filenames
4. Include date and purpose in frontmatter

---
Last updated: 2025-10-30
EOF

echo -e "${GREEN}✓ Created docs/README.md${NC}"

echo ""
echo "=========================================="
echo "PHASE 3 COMPLETE"
echo "=========================================="
echo -e "${GREEN}Successfully organized: $moved_count documents${NC}"
echo ""
echo "Documentation structure:"
tree -L 2 docs/ 2>/dev/null || find docs -type f -name "*.md" | sort
echo ""
echo "Next steps:"
echo "  - Review docs/README.md"
echo "  - Review git status: git status"
echo "  - Continue to Phase 4 (manual code consolidation)"
echo ""
