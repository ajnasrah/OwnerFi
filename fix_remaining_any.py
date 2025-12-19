#!/usr/bin/env python3

import os
import re
from pathlib import Path

def fix_any_types(filepath):
    """Fix remaining 'any' types in a file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    changes = []

    # Pattern 1: Function parameter types like (name: any)
    # Be careful not to replace in comments
    param_patterns = [
        (r'\(([a-zA-Z_][a-zA-Z0-9_]*): any\)', r'(\1: unknown)'),
        (r', ([a-zA-Z_][a-zA-Z0-9_]*): any\)', r', \1: unknown)'),
        (r', ([a-zA-Z_][a-zA-Z0-9_]*): any,', r', \1: unknown,'),
    ]

    for pattern, replacement in param_patterns:
        if re.search(pattern, content):
            before_count = content.count(': any')
            content = re.sub(pattern, replacement, content)
            after_count = content.count(': any')
            if before_count > after_count:
                changes.append(f'Fixed parameter any type')

    # Pattern 2: Variable declarations: const x: any =
    var_pattern = r'\b(const|let|var) ([a-zA-Z_][a-zA-Z0-9_]*): any\s*='
    if re.search(var_pattern, content):
        content = re.sub(var_pattern, r'\1 \2: unknown =', content)
        changes.append('Fixed variable any type')

    # Pattern 3: Return types: ): any {
    return_pattern = r'\): any\s*\{'
    if re.search(return_pattern, content):
        content = re.sub(return_pattern, r'): unknown {', content)
        changes.append('Fixed return any type')

    # Pattern 4: Array types: any[]
    if re.search(r': any\[\]', content):
        content = re.sub(r': any\[\]', r': unknown[]', content)
        changes.append('Fixed any[] type')

    # Pattern 5: Type assertions in specific patterns
    # Like: x as any
    # But be very conservative here - only replace obvious cases
    # Replace things like: .map((x: any) => ...)
    map_filter_pattern = r'\.(map|filter|forEach|find|some|every)\(([a-z]+): any\)'
    if re.search(map_filter_pattern, content):
        content = re.sub(map_filter_pattern, r'.\1(\2: unknown)', content)
        changes.append('Fixed callback any type')

    # Pattern 6: Generic object types in specific contexts
    # Replace patterns like: errors: any
    field_patterns = [
        (r'errors: any', 'errors: Record<string, unknown>'),
        (r'headers: any', 'headers: Record<string, unknown>'),
        (r'query: any', 'query: Record<string, unknown>'),
        (r'filters: any', 'filters: unknown[]'),
        (r'items: any', 'items: unknown[]'),
        (r'results: any', 'results: unknown[]'),
        (r'documents: any', 'documents: unknown[]'),
    ]

    for pattern, replacement in field_patterns:
        if pattern in content:
            content = content.replace(pattern, replacement)
            changes.append(f'Fixed {pattern}')

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return changes

    return []

def main():
    # Find all TypeScript files in src/app/api
    api_dir = Path('src/app/api')
    if not api_dir.exists():
        print(f"Error: {api_dir} not found")
        return

    files = list(api_dir.glob('**/*.ts')) + list(api_dir.glob('**/*.tsx'))
    files = [f for f in files if not f.name.endswith('.d.ts')]

    print(f"Found {len(files)} TypeScript files")
    print()

    total_files_changed = 0
    total_changes = 0

    for filepath in sorted(files):
        changes = fix_any_types(filepath)
        if changes:
            total_files_changed += 1
            total_changes += len(changes)
            print(f"✓ {filepath}")
            for change in changes:
                print(f"  - {change}")

    print()
    print(f"✅ Fixed {total_changes} any type issues in {total_files_changed} files")

if __name__ == '__main__':
    main()
