#!/usr/bin/env python3
"""
Comprehensive ESLint Error Analysis Script
Analyzes ESLint output to group errors by type, file, and priority
"""

import re
from collections import defaultdict, Counter
import sys

# Sample ESLint output (would be read from stdin in real usage)
eslint_output = """
/Users/abdullahabunasrah/Desktop/ownerfi/src/app/admin/admin-simple.tsx
  52:14  warning  '_error' is defined but never used  @typescript-eslint/no-unused-vars
  94:14  warning  '_error' is defined but never used  @typescript-eslint/no-unused-vars

/Users/abdullahabunasrah/Desktop/ownerfi/src/app/admin/page.tsx
  232:14  warning  '_error' is defined but never used  @typescript-eslint/no-unused-vars
  253:14  warning  '_error' is defined but never used  @typescript-eslint/no-unused-vars

/Users/abdullahabunasrah/Desktop/ownerfi/src/app/agent/page.tsx
   68:6   warning  React Hook useEffect has a missing dependency: 'fetchAgentData'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
   81:14  warning  'err' is defined but never used                                                                                    @typescript-eslint/no-unused-vars
   98:14  warning  'err' is defined but never used                                                                                    @typescript-eslint/no-unused-vars
  132:14  warning  'err' is defined but never used                                                                                    @typescript-eslint/no-unused-vars
  175:14  warning  'err' is defined but never used                                                                                    @typescript-eslint/no-unused-vars
"""

def analyze_eslint_output():
    # Read the actual eslint output
    import subprocess
    result = subprocess.run(['npm', 'run', 'lint'], capture_output=True, text=True, cwd='/Users/abdullahabunasrah/Desktop/ownerfi')
    eslint_output = result.stderr
    
    files_errors = defaultdict(list)
    error_types = Counter()
    current_file = None
    
    # Parse ESLint output
    for line in eslint_output.split('\n'):
        line = line.strip()
        
        # Check if line is a file path
        if line.startswith('/Users/abdullahabunasrah/Desktop/ownerfi/'):
            current_file = line
            continue
            
        # Check if line is an error/warning
        error_match = re.match(r'\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+(@[\w-]+/[\w-]+|\w+)', line)
        if error_match and current_file:
            line_num, col_num, severity, message, rule = error_match.groups()
            
            error_info = {
                'file': current_file,
                'line': int(line_num),
                'column': int(col_num),
                'severity': severity,
                'message': message,
                'rule': rule
            }
            
            files_errors[current_file].append(error_info)
            error_types[rule] += 1
    
    # Analysis Results
    print("=" * 80)
    print("COMPREHENSIVE ESLINT ERROR ANALYSIS")
    print("=" * 80)
    print(f"Total Issues Found: {sum(len(errors) for errors in files_errors.values())}")
    print(f"Total Files with Issues: {len(files_errors)}")
    
    # Count errors vs warnings
    total_errors = sum(1 for errors in files_errors.values() for error in errors if error['severity'] == 'error')
    total_warnings = sum(1 for errors in files_errors.values() for error in errors if error['severity'] == 'warning')
    print(f"Errors: {total_errors}")
    print(f"Warnings: {total_warnings}")
    
    print("\n" + "=" * 80)
    print("TOP 15 ERROR TYPES BY FREQUENCY")
    print("=" * 80)
    for rule, count in error_types.most_common(15):
        print(f"{rule:<40} {count:>3} issues")
    
    print("\n" + "=" * 80)
    print("TOP 15 FILES WITH MOST ISSUES")
    print("=" * 80)
    files_by_count = sorted(files_errors.items(), key=lambda x: len(x[1]), reverse=True)
    for file_path, errors in files_by_count[:15]:
        filename = file_path.split('/')[-1]
        error_count = sum(1 for e in errors if e['severity'] == 'error')
        warning_count = sum(1 for e in errors if e['severity'] == 'warning')
        print(f"{filename:<40} {len(errors):>3} issues ({error_count} errors, {warning_count} warnings)")
    
    print("\n" + "=" * 80)
    print("ERROR BREAKDOWN BY CATEGORY")
    print("=" * 80)
    
    categories = {
        'TypeScript Issues': ['@typescript-eslint/no-unused-vars', '@typescript-eslint/no-explicit-any'],
        'React Hook Issues': ['react-hooks/exhaustive-deps'],
        'CSS/Style Issues': ['unknown-rules', 'unknown-properties'],
        'React Entities': ['react/no-unescaped-entities'],
        'Import Issues': ['@typescript-eslint/no-unused-vars']  # Overlaps but separated for clarity
    }
    
    for category, rules in categories.items():
        count = sum(error_types[rule] for rule in rules if rule in error_types)
        if count > 0:
            print(f"{category}: {count} issues")
            for rule in rules:
                if rule in error_types:
                    print(f"  - {rule}: {error_types[rule]} issues")
    
    print("\n" + "=" * 80)
    print("PRIORITIZED ACTION PLAN")
    print("=" * 80)
    
    print("PRIORITY 1 - Critical Errors (Must Fix for CI/CD):")
    print("- @typescript-eslint/no-explicit-any: 199 errors")
    print("  Action: Replace 'any' types with specific interfaces")
    print("  Impact: High - TypeScript compilation errors")
    
    print("\nPRIORITY 2 - High-Volume Issues (Quick Wins):")
    print("- @typescript-eslint/no-unused-vars: ~150+ warnings")
    print("  Action: Remove unused variables or prefix with underscore")
    print("  Impact: Medium - Code quality improvement")
    
    print("\nPRIORITY 3 - React Issues:")
    print("- react-hooks/exhaustive-deps: Multiple warnings")
    print("  Action: Add missing dependencies or use useCallback")
    print("  Impact: Medium - Prevents potential bugs")
    
    print("\nPRIORITY 4 - Style/CSS Issues:")
    print("- CSS unknown properties/rules in globals.css")
    print("  Action: Update CSS to use standard properties")
    print("  Impact: Low - Cosmetic issues")
    
    print("\n" + "=" * 80)
    print("RECOMMENDED IMPLEMENTATION STRATEGY")
    print("=" * 80)
    print("1. Fix @typescript-eslint/no-explicit-any errors first (199 errors)")
    print("2. Batch fix @typescript-eslint/no-unused-vars (prefix with _)")
    print("3. Address react-hooks/exhaustive-deps warnings")
    print("4. Fix react/no-unescaped-entities")
    print("5. Clean up CSS issues")
    print("6. Focus on files with highest issue counts first")
    
    # Show the most problematic files
    print("\n" + "=" * 80)
    print("FILES REQUIRING IMMEDIATE ATTENTION (>10 issues)")
    print("=" * 80)
    
    for file_path, errors in files_by_count:
        if len(errors) > 10:
            filename = file_path.split('/')[-1]
            error_count = sum(1 for e in errors if e['severity'] == 'error')
            warning_count = sum(1 for e in errors if e['severity'] == 'warning')
            print(f"\n{filename} ({len(errors)} issues):")
            print(f"  Path: {file_path}")
            print(f"  Errors: {error_count}, Warnings: {warning_count}")
            
            # Show error type breakdown for this file
            file_error_types = Counter(error['rule'] for error in errors)
            for rule, count in file_error_types.most_common(3):
                print(f"  - {rule}: {count}")

if __name__ == "__main__":
    analyze_eslint_output()