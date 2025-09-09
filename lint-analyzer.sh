#!/bin/bash

echo "================================================================================"
echo "COMPREHENSIVE ESLINT ERROR ANALYSIS"
echo "================================================================================"

# Run lint and capture output
npm run lint > lint_output.txt 2>&1

# Count total issues
total_issues=$(grep -E "^\s*[0-9]+:[0-9]+\s+(error|warning)" lint_output.txt | wc -l)
echo "Total Issues Found: $total_issues"

# Count errors vs warnings  
errors=$(grep -E "^\s*[0-9]+:[0-9]+\s+error" lint_output.txt | wc -l)
warnings=$(grep -E "^\s*[0-9]+:[0-9]+\s+warning" lint_output.txt | wc -l)
echo "Errors: $errors"
echo "Warnings: $warnings"

echo ""
echo "================================================================================"
echo "TOP ERROR TYPES BY FREQUENCY"
echo "================================================================================"

# Extract error types and count them
grep -E "^\s*[0-9]+:[0-9]+\s+(error|warning)" lint_output.txt | \
    grep -oE "@[a-zA-Z0-9-]+/[a-zA-Z0-9-]+|[a-zA-Z-]+/[a-zA-Z-]+|unknown-[a-zA-Z-]+" | \
    sort | uniq -c | sort -nr | head -15

echo ""
echo "================================================================================"
echo "FILES WITH MOST ISSUES (TOP 15)"
echo "================================================================================"

# Count issues per file
current_file=""
while IFS= read -r line; do
    if [[ $line =~ ^/Users/abdullahabunasrah/Desktop/ownerfi/ ]]; then
        current_file="$line"
        echo "$current_file" >> current_files.tmp
    elif [[ $line =~ ^[[:space:]]*[0-9]+:[0-9]+[[:space:]]+(error|warning) ]] && [[ -n "$current_file" ]]; then
        echo "$current_file" >> file_issues.tmp
    fi
done < lint_output.txt

if [[ -f file_issues.tmp ]]; then
    sort file_issues.tmp | uniq -c | sort -nr | head -15 | while read count file; do
        filename=$(basename "$file")
        printf "%-40s %3d issues\n" "$filename" "$count"
    done
fi

echo ""
echo "================================================================================"
echo "ERROR BREAKDOWN BY CATEGORY"
echo "================================================================================"

typescript_unused=$(grep -c "@typescript-eslint/no-unused-vars" lint_output.txt)
typescript_any=$(grep -c "@typescript-eslint/no-explicit-any" lint_output.txt)
react_hooks=$(grep -c "react-hooks/exhaustive-deps" lint_output.txt)
react_entities=$(grep -c "react/no-unescaped-entities" lint_output.txt)
css_unknown=$(grep -c "unknown-" lint_output.txt)
next_image=$(grep -c "@next/next/no-img-element" lint_output.txt)

echo "TypeScript Issues:"
echo "  - @typescript-eslint/no-unused-vars: $typescript_unused"
echo "  - @typescript-eslint/no-explicit-any: $typescript_any"
echo ""
echo "React Issues:"
echo "  - react-hooks/exhaustive-deps: $react_hooks"  
echo "  - react/no-unescaped-entities: $react_entities"
echo ""
echo "CSS/Style Issues:"
echo "  - unknown CSS properties/rules: $css_unknown"
echo ""
echo "Next.js Issues:"
echo "  - @next/next/no-img-element: $next_image"

echo ""
echo "================================================================================"
echo "PRIORITIZED ACTION PLAN"
echo "================================================================================"

echo "PRIORITY 1 - BLOCKING ERRORS (Must Fix for CI/CD):"
echo "- @typescript-eslint/no-explicit-any: $typescript_any errors"
echo "  Action: Replace 'any' types with specific TypeScript interfaces"
echo "  Files: Check lib/data-tracker.ts, lib/payment-source-tracking.ts"
echo "  Impact: HIGH - These are compilation errors that block deployment"
echo ""

echo "PRIORITY 2 - HIGH-VOLUME WARNINGS (Quick Wins):"
echo "- @typescript-eslint/no-unused-vars: $typescript_unused warnings"
echo "  Action: Prefix unused variables with underscore or remove them"
echo "  Impact: MEDIUM - Improves code quality, easy batch fix"
echo ""

echo "PRIORITY 3 - REACT ISSUES:"
echo "- react-hooks/exhaustive-deps: $react_hooks warnings"
echo "  Action: Add missing dependencies to useEffect or use useCallback"
echo "  Impact: MEDIUM - Prevents potential runtime bugs"
echo ""
echo "- react/no-unescaped-entities: $react_entities warnings"  
echo "  Action: Escape HTML entities (&gt; to &amp;gt;)"
echo "  Impact: LOW - Cosmetic issue"

echo ""
echo "PRIORITY 4 - CSS/STYLE ISSUES:"
echo "- CSS unknown properties: $css_unknown warnings"
echo "  Action: Update globals.css to use standard CSS properties"
echo "  Impact: LOW - Cosmetic, doesn't break functionality"

echo ""
echo "================================================================================"
echo "IMPLEMENTATION STRATEGY"
echo "================================================================================"
echo "1. IMMEDIATE (Critical Path):"
echo "   - Fix all @typescript-eslint/no-explicit-any errors ($typescript_any issues)"
echo "   - Focus on lib/data-tracker.ts and lib/payment-source-tracking.ts first"
echo ""
echo "2. BATCH PROCESSING (High Impact, Low Effort):"
echo "   - Run find/replace for @typescript-eslint/no-unused-vars ($typescript_unused issues)"
echo "   - Prefix unused error variables with underscore: 'error' -> '_error'"
echo ""
echo "3. SYSTEMATIC FIXES:"
echo "   - Address react-hooks/exhaustive-deps warnings ($react_hooks issues)"
echo "   - Fix unescaped entities in React components ($react_entities issues)"
echo ""
echo "4. CLEANUP:"
echo "   - Update CSS unknown properties ($css_unknown issues)"
echo "   - Replace img tags with Next.js Image components"

echo ""
echo "================================================================================"
echo "FILES REQUIRING IMMEDIATE ATTENTION (>5 issues each)"
echo "================================================================================"

if [[ -f file_issues.tmp ]]; then
    sort file_issues.tmp | uniq -c | sort -nr | while read count file; do
        if [[ $count -gt 5 ]]; then
            filename=$(basename "$file")
            echo "$filename: $count issues"
            echo "  Path: $file"
            
            # Show what types of errors are in this file
            current_file_search=$(echo "$file" | sed 's/[[\.*^$()+?{|]/\\&/g')
            grep -A 20 "^$current_file_search$" lint_output.txt | \
                grep -E "^\s*[0-9]+:[0-9]+\s+(error|warning)" | \
                head -5 | while read issue_line; do
                echo "    $issue_line"
            done
            echo ""
        fi
    done
fi

# Cleanup temp files
rm -f current_files.tmp file_issues.tmp lint_output.txt

echo "Analysis complete. Focus on Priority 1 items first to unblock CI/CD pipeline."