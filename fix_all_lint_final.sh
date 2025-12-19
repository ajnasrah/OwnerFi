#!/bin/bash

# Final comprehensive lint fix script for src/app/api
# This script runs all fix scripts and auto-fixes remaining issues

echo "🔧 Starting comprehensive lint fixes for src/app/api..."
echo ""

# Step 1: Run Python batch fixer
echo "📝 Step 1: Running batch fixer (common patterns)..."
python3 fix_lint_batch.py
echo ""

# Step 2: Run any-type fixer
echo "📝 Step 2: Running any-type fixer..."
python3 fix_remaining_any.py
echo ""

# Step 3: Run ESLint auto-fix for formatting issues
echo "📝 Step 3: Running ESLint auto-fix..."
npx eslint src/app/api --ext .ts,.tsx --fix
echo ""

# Step 4: Show remaining errors
echo "📊 Step 4: Checking remaining errors..."
echo ""
echo "Error count:"
npx eslint src/app/api --ext .ts,.tsx 2>&1 | grep -c "error" || echo "0"
echo ""
echo "Warning count:"
npx eslint src/app/api --ext .ts,.tsx 2>&1 | grep -c "warning" || echo "0"
echo ""

# Step 5: Show summary of remaining issues
echo "📋 Summary of remaining issues:"
npx eslint src/app/api --ext .ts,.tsx 2>&1 | grep -E "(error|warning)" | sort | uniq -c | sort -rn | head -20

echo ""
echo "✅ Automated fixes complete!"
echo ""
echo "To see full error list, run:"
echo "  npx eslint src/app/api --ext .ts,.tsx"
echo ""
echo "To fix specific files manually, see LINT_FIXES_APPLIED.md for patterns"
