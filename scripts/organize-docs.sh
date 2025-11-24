#!/bin/bash

# Documentation Organization Script
# Organizes 133 root markdown files into /docs/ structure

set -e

echo "════════════════════════════════════════════════════"
echo "📚 DOCUMENTATION ORGANIZATION SCRIPT"
echo "════════════════════════════════════════════════════"
echo ""
echo "This will organize 133 markdown files into /docs/ structure:"
echo "  📁 docs/guides/ - User and developer guides"
echo "  📁 docs/architecture/ - System design docs"
echo "  📁 docs/incidents/ - Bug fixes and issues"
echo "  📁 docs/migrations/ - Migration reports"
echo "  📁 docs/testing/ - Test results and reports"
echo "  📁 docs/operations/ - Operational procedures"
echo "  📁 docs/archive/ - Old/completed docs"
echo ""
echo "Files kept in root: README.md, ENVIRONMENT_VARIABLES.md"
echo ""
echo "Starting in 3 seconds..."
sleep 3

# Create documentation directories
echo ""
echo "📁 Creating /docs/ structure..."
mkdir -p docs/guides
mkdir -p docs/architecture
mkdir -p docs/incidents
mkdir -p docs/migrations
mkdir -p docs/testing
mkdir -p docs/operations
mkdir -p docs/archive

moved=0

echo ""
echo "📄 Moving files..."
echo ""

# GUIDES - How-to and usage documentation
echo "📖 Moving GUIDES..."
for file in *GUIDE*.md *HOW_TO*.md *TUTORIAL*.md 2>/dev/null; do
  if [ -f "$file" ] && [ "$file" != "README.md" ]; then
    echo "  → docs/guides/$file"
    mv "$file" docs/guides/
    moved=$((moved + 1))
  fi
done

# ARCHITECTURE - System design and structure
echo "🏗️  Moving ARCHITECTURE..."
for file in *SYSTEM*.md *ARCHITECTURE*.md *DESIGN*.md *STRUCTURE*.md 2>/dev/null; do
  if [ -f "$file" ] && [ "$file" != "README.md" ]; then
    echo "  → docs/architecture/$file"
    mv "$file" docs/architecture/
    moved=$((moved + 1))
  fi
done

# INCIDENTS - Bug fixes, errors, and critical fixes
echo "🔧 Moving INCIDENTS..."
for file in *FIX*.md *BUG*.md *ERROR*.md *CRITICAL*.md *ISSUE*.md *PROBLEM*.md 2>/dev/null; do
  if [ -f "$file" ] && [ "$file" != "README.md" ]; then
    echo "  → docs/incidents/$file"
    mv "$file" docs/incidents/
    moved=$((moved + 1))
  fi
done

# MIGRATIONS - Database and code migrations
echo "🔄 Moving MIGRATIONS..."
for file in *MIGRATION*.md *MIGRATE*.md *UPGRADE*.md *CONSOLIDATION*.md 2>/dev/null; do
  if [ -f "$file" ] && [ "$file" != "README.md" ]; then
    echo "  → docs/migrations/$file"
    mv "$file" docs/migrations/
    moved=$((moved + 1))
  fi
done

# TESTING - Test results and verification
echo "🧪 Moving TESTING..."
for file in TEST*.md *TEST*.md *VERIFICATION*.md *VALIDATION*.md 2>/dev/null; do
  if [ -f "$file" ] && [ "$file" != "README.md" ]; then
    echo "  → docs/testing/$file"
    mv "$file" docs/testing/
    moved=$((moved + 1))
  fi
done

# OPERATIONS - Deployment, monitoring, performance
echo "⚙️  Moving OPERATIONS..."
for file in *DEPLOYMENT*.md *DEPLOY*.md *MONITOR*.md *PERFORMANCE*.md *CRON*.md *OPTIMIZATION*.md 2>/dev/null; do
  if [ -f "$file" ] && [ "$file" != "README.md" ]; then
    echo "  → docs/operations/$file"
    mv "$file" docs/operations/
    moved=$((moved + 1))
  fi
done

# SUMMARIES - Move summaries to appropriate category or archive
echo "📊 Moving SUMMARIES..."
for file in *SUMMARY*.md *REPORT*.md *ANALYSIS*.md *COMPLETE*.md *CLEANUP*.md 2>/dev/null; do
  if [ -f "$file" ] && [ "$file" != "README.md" ] && [ "$file" != "CLEANUP_ANALYSIS_2025-11-23.md" ]; then
    # Check if it's migration-related
    if echo "$file" | grep -qiE "migration|migrate|consolidation"; then
      echo "  → docs/migrations/$file"
      mv "$file" docs/migrations/
    # Check if it's incident-related
    elif echo "$file" | grep -qiE "fix|bug|error|critical"; then
      echo "  → docs/incidents/$file"
      mv "$file" docs/incidents/
    # Otherwise, archive it
    else
      echo "  → docs/archive/$file"
      mv "$file" docs/archive/
    fi
    moved=$((moved + 1))
  fi
done

# Everything else goes to archive
echo "📦 Moving remaining docs to archive..."
for file in *.md; do
  if [ -f "$file" ] && [ "$file" != "README.md" ] && [ "$file" != "ENVIRONMENT_VARIABLES.md" ] && [ "$file" != "CLEANUP_ANALYSIS_2025-11-23.md" ]; then
    echo "  → docs/archive/$file"
    mv "$file" docs/archive/
    moved=$((moved + 1))
  fi
done

echo ""
echo "════════════════════════════════════════════════════"
echo "✅ DOCUMENTATION ORGANIZATION COMPLETE"
echo "════════════════════════════════════════════════════"
echo "Total files moved: $moved"
echo ""
echo "📁 Documentation structure:"
ls -lR docs/ | grep "^d" | wc -l | xargs echo "  Directories created:"
find docs/ -name "*.md" | wc -l | xargs echo "  Total docs organized:"
echo ""
echo "Files kept in root:"
ls -1 *.md 2>/dev/null | while read f; do echo "  ✅ $f"; done
echo ""
