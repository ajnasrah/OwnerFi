#!/usr/bin/env python3
"""
Comprehensive lint fixer for src/app/api directory.
This script aggressively fixes all remaining common lint issues.
"""

import os
import re
from pathlib import Path
from typing import List, Tuple

def fix_comprehensive(filepath: Path) -> List[str]:
    """Apply all comprehensive fixes to a file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    changes = []

    # Fix 1: catch (error: any) -> catch (error)
    if re.search(r'catch \((error|err): any\)', content):
        content = re.sub(r'catch \(error: any\)', 'catch (error)', content)
        content = re.sub(r'catch \(err: any\)', 'catch (err)', content)
        changes.append('Removed any from catch blocks')

    # Fix 2: Unused request parameter
    # Match function signatures and check if request is used in function body
    for match in re.finditer(r'export async function (GET|POST|PUT|DELETE|PATCH)\(request: (Request|NextRequest)\)', content):
        method = match.group(1)
        req_type = match.group(2)
        func_start = match.end()

        # Find function body (until next 'export' or end of file)
        next_export = content.find('\nexport ', func_start)
        func_body = content[func_start:next_export] if next_export > 0 else content[func_start:]

        # Check if request is actually used (excluding the parameter itself)
        request_used = (
            'request.' in func_body or
            'await request.json()' in func_body or
            'request.url' in func_body or
            'new URL(request.url)' in func_body
        )

        if not request_used:
            old_sig = f'export async function {method}(request: {req_type})'
            new_sig = f'export async function {method}(_request: {req_type})'
            content = content.replace(old_sig, new_sig, 1)
            changes.append(f'Prefixed unused request parameter in {method}')

    # Fix 3: authOptions as any -> authOptions as typeof authOptions
    if 'authOptions as any' in content:
        content = content.replace('authOptions as any', 'authOptions as typeof authOptions')
        changes.append('Fixed authOptions type assertion')

    # Fix 4: error.message without instanceof check
    # Pattern: catch (error) { ... return NextResponse.json({ error: error.message }
    pattern = r'(catch \(error\) \{[^}]*?)(return NextResponse\.json\(\s*\{\s*error:\s*error\.message)'
    for match in re.finditer(pattern, content, re.MULTILINE | re.DOTALL):
        before_return = match.group(1)
        if 'instanceof Error' not in before_return:
            # Find the indentation
            indent_match = re.search(r'\n([ \t]+)return', before_return)
            indent = indent_match.group(1) if indent_match else '    '

            # Replace error.message with checked version
            old_text = match.group(0)
            new_text = before_return + f'{indent}const message = error instanceof Error ? error.message : \'Unknown error\';\n{indent}return NextResponse.json({{ error: message'
            content = content.replace(old_text, new_text, 1)
            changes.append('Added instanceof check for error.message')

    # Fix 5: Replace common any types with better types
    type_replacements = [
        # Function parameters
        (r'\(([a-z]+): any\)', r'(\1: unknown)'),
        (r', ([a-z]+): any\)', r', \1: unknown)'),
        (r', ([a-z]+): any,', r', \1: unknown,'),

        # Specific common patterns
        (r'\(hit: unknown\)', '(hit: Record<string, unknown>)'),
        (r'\(doc: unknown\)', '(doc: Record<string, unknown>)'),
        (r'\(item: unknown\)', '(item: Record<string, unknown>)'),
        (r'\(prop: unknown\)', '(prop: Record<string, unknown>)'),
        (r'\(deal: unknown\)', '(deal: Record<string, unknown>)'),
        (r'\(result: unknown\)', '(result: Record<string, unknown>)'),
        (r'\(data: unknown\)', '(data: Record<string, unknown>)'),
        (r'\(f: unknown\)', '(f: Record<string, unknown>)'),
        (r'\(c: unknown\)', '(c: Record<string, unknown>)'),
        (r'\(obj: unknown\)', '(obj: Record<string, unknown>)'),

        # Variable declarations
        (r': any\[\]', ': unknown[]'),
        (r': any =', ': unknown ='),
        (r': any;', ': unknown;'),

        # Return types
        (r'\): any \{', '): unknown {'),
        (r'\): any;', '): unknown;'),
    ]

    for pattern, replacement in type_replacements:
        if re.search(pattern, content):
            before_count = len(re.findall(pattern, content))
            content = re.sub(pattern, replacement, content)
            after_count = len(re.findall(pattern, content))
            if before_count > after_count:
                changes.append(f'Replaced {before_count} instances of {pattern[:20]}... with better type')

    # Fix 6: Unused error in catch block (prefix with underscore)
    # Match catch blocks where error is defined but not used
    catch_blocks = list(re.finditer(r'} catch \(error\) \{([^}]+)\}', content, re.MULTILINE))
    for match in reversed(catch_blocks):  # Process from end to preserve positions
        catch_body = match.group(1)
        # Check if error is used in the body (excluding the definition itself)
        if 'error' not in catch_body:
            old_catch = match.group(0)
            new_catch = old_catch.replace('} catch (error) {', '} catch (_error) {')
            content = content[:match.start()] + new_catch + content[match.end():]
            changes.append('Prefixed unused error variable')

    # Fix 7: Unused imports (where, or)
    # Check if 'where' and 'or' are imported but not used
    import_match = re.search(r'import \{([^}]+)\} from [\'"]firebase/firestore[\'"];', content)
    if import_match:
        imports = [i.strip() for i in import_match.group(1).split(',')]
        used_imports = []

        for imp in imports:
            import_name = imp.strip()
            # Check if used (look for function calls like where(), or())
            if re.search(rf'\b{import_name}\s*\(', content):
                used_imports.append(import_name)

        if len(used_imports) != len(imports) and len(used_imports) > 0:
            old_import = import_match.group(0)
            new_import = f"import {{{', '.join(used_imports)}}} from 'firebase/firestore';"
            content = content.replace(old_import, new_import)
            changes.append(f'Removed {len(imports) - len(used_imports)} unused imports')

    # Fix 8: Unused variable declarations
    # Comment out common unused variables
    unused_patterns = [
        (r'^(\s*)(const languageAgents\s*=)', r'\1// \2'),
        (r'^(\s*)(const foundFormat\s*=)', r'\1// \2'),
    ]

    for pattern, replacement in unused_patterns:
        if re.search(pattern, content, re.MULTILINE):
            content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
            changes.append('Commented out unused variable')

    # Fix 9: Specific any patterns in common locations
    specific_fixes = [
        ('mapPropertyFields(doc: any)', 'mapPropertyFields(doc: FirebaseFirestore.QueryDocumentSnapshot)'),
        ('normalizeProperty(doc: any,', 'normalizeProperty(doc: FirebaseFirestore.DocumentSnapshot,'),
    ]

    for old, new in specific_fixes:
        if old in content:
            content = content.replace(old, new)
            changes.append(f'Fixed specific any type: {old[:30]}...')

    # Write back if changes were made
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return changes

    return []

def main():
    api_dir = Path('src/app/api')
    if not api_dir.exists():
        print(f"Error: {api_dir} not found")
        print("Please run this script from the project root directory")
        return

    # Find all TypeScript files
    files = list(api_dir.glob('**/*.ts')) + list(api_dir.glob('**/*.tsx'))
    files = [f for f in files if not f.name.endswith('.d.ts')]

    print(f"🔍 Found {len(files)} TypeScript files in src/app/api")
    print()

    total_files_changed = 0
    total_changes = 0
    all_changes = []

    for filepath in sorted(files):
        changes = fix_comprehensive(filepath)
        if changes:
            total_files_changed += 1
            total_changes += len(changes)
            all_changes.extend(changes)
            print(f"✓ {filepath.relative_to('src/app/api')}")
            for change in changes:
                print(f"  - {change}")

    print()
    print(f"✅ Fixed {total_changes} issues in {total_files_changed} files")
    print()

    # Show summary of change types
    if all_changes:
        print("📊 Summary of changes:")
        from collections import Counter
        change_counts = Counter(all_changes)
        for change, count in change_counts.most_common(10):
            print(f"  {count}x - {change}")

if __name__ == '__main__':
    main()
