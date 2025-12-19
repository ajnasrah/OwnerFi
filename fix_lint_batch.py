#!/usr/bin/env python3

import os
import re
from pathlib import Path

def fix_file(filepath):
    """Fix common lint errors in a single file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    changes = []

    # Fix 1: Remove "// eslint-disable-next-line @typescript-eslint/no-explicit-any" comments
    # and fix the any type on the next line
    pattern = r'// eslint-disable-next-line @typescript-eslint/no-explicit-any\s*\n\s*const session = await getServerSession\(authOptions as any\)'
    if re.search(pattern, content):
        content = re.sub(pattern, 'const session = await getServerSession(authOptions as typeof authOptions)', content)
        changes.append('Fixed authOptions any type')

    # Fix 2: catch (error: any) -> catch (error)
    if re.search(r'catch \(error: any\)', content):
        content = re.sub(r'catch \(error: any\)', 'catch (error)', content)
        changes.append('Removed any from catch blocks')

    # Fix 3: catch (err: any) -> catch (err)
    if re.search(r'catch \(err: any\)', content):
        content = re.sub(r'catch \(err: any\)', 'catch (err)', content)
        changes.append('Removed any from catch(err) blocks')

    # Fix 4: Prefix unused request parameter
    # Check if function has request parameter but doesn't use it
    func_pattern = r'export async function (GET|POST|PUT|PATCH|DELETE)\(request: (Request|NextRequest)\) \{'
    for match in re.finditer(func_pattern, content):
        func_start = match.end()
        # Find the next export or end of file
        next_export = content.find('\nexport ', func_start)
        func_body = content[func_start:next_export] if next_export > 0 else content[func_start:]

        # Check if request is used
        if not re.search(r'\brequest\.', func_body) and 'await request.json()' not in func_body and 'request.url' not in func_body:
            # Replace this specific occurrence
            old_sig = match.group(0)
            new_sig = old_sig.replace('(request:', '(_request:')
            content = content.replace(old_sig, new_sig, 1)
            changes.append(f'Prefixed unused request in {match.group(1)}')

    # Fix 5: Fix error.message access without instanceof check
    error_message_pattern = r'(catch \(error\) \{[\s\S]*?)(return NextResponse\.json\(\{ error: error\.message \})'
    matches = list(re.finditer(error_message_pattern, content))
    if matches:
        for match in reversed(matches):  # Process from end to start to preserve positions
            before_return = match.group(1)
            return_part = match.group(2)

            # Check if instanceof check already exists
            if 'error instanceof Error' not in before_return:
                # Add the instanceof check
                # Find indentation
                indent_match = re.search(r'\n([ \t]+)return', before_return)
                indent = indent_match.group(1) if indent_match else '    '

                new_code = before_return + f'{indent}const message = error instanceof Error ? error.message : \'Unknown error\';\n    '
                new_code += return_part.replace('error.message', 'message')

                content = content[:match.start()] + new_code + content[match.end():]
                changes.append('Added instanceof check for error.message')

    # Fix 6: Replace common any types with better types
    replacements = [
        (r'\(hit: any\)', '(hit: Record<string, unknown>)'),
        (r'\(doc: any\)', '(doc: Record<string, unknown>)'),
        (r'\(item: any\)', '(item: Record<string, unknown>)'),
        (r'\(f: any\)', '(f: Record<string, unknown>)'),
        (r'\(c: any\)', '(c: Record<string, unknown>)'),
        (r'\(result: any\)', '(result: Record<string, unknown>)'),
        (r'\(data: any\)', '(data: Record<string, unknown>)'),
        (r'\(obj: any\)', '(obj: Record<string, unknown>)'),
        (r'\(prop: any\)', '(prop: Record<string, unknown>)'),
        (r'\(deal: any\)', '(deal: Record<string, unknown>)'),
    ]

    for pattern, replacement in replacements:
        if re.search(pattern, content):
            content = re.sub(pattern, replacement, content)
            changes.append(f'Replaced {pattern} with better type')

    # Fix 7: Replace `: any[]` with better types in common cases
    array_replacements = [
        (r'let propertiesConstraints: any\[\]', 'let propertiesConstraints: unknown[]'),
        (r'const constraints: any\[\]', 'const constraints: unknown[]'),
        (r'let filters: any\[\]', 'let filters: unknown[]'),
    ]

    for pattern, replacement in array_replacements:
        if re.search(pattern, content):
            content = re.sub(pattern, replacement, content)
            changes.append(f'Fixed array type')

    # Fix 8: Remove unused variables (comment them out)
    unused_vars = ['languageAgents', 'foundFormat']
    for var in unused_vars:
        pattern = f'^([ \\t]*)(const {var}\\s*=)'
        if re.search(pattern, content, re.MULTILINE):
            content = re.sub(pattern, r'\1// \2', content, flags=re.MULTILINE)
            changes.append(f'Commented out unused variable {var}')

    # Fix 9: Fix Timestamp any types
    timestamp_pattern = r'\(a\.createdAt as any\)\.toDate\(\)\.getTime\(\)'
    if re.search(timestamp_pattern, content):
        content = re.sub(
            r'\(a\.createdAt as any\)\.toDate\(\)\.getTime\(\)',
            '(a.createdAt as { toDate: () => Date }).toDate().getTime()',
            content
        )
        content = re.sub(
            r'\(b\.createdAt as any\)\.toDate\(\)\.getTime\(\)',
            '(b.createdAt as { toDate: () => Date }).toDate().getTime()',
            content
        )
        content = re.sub(
            r'new Date\(a\.createdAt as any\)\.getTime\(\)',
            'new Date(a.createdAt as string | number).getTime()',
            content
        )
        content = re.sub(
            r'new Date\(b\.createdAt as any\)\.getTime\(\)',
            'new Date(b.createdAt as string | number).getTime()',
            content
        )
        changes.append('Fixed Timestamp type assertions')

    # Fix 10: Replace more specific any types with unknowns
    more_any_patterns = [
        (r': any\)', ': unknown)'),
        (r'field: any', 'field: unknown'),
        (r'value: any', 'value: unknown'),
        (r'metadata: any', 'metadata: Record<string, unknown>'),
        (r'params: any', 'params: Record<string, unknown>'),
        (r'options: any', 'options: Record<string, unknown>'),
        (r'response: any', 'response: unknown'),
        (r'body: any', 'body: unknown'),
    ]

    for pattern, replacement in more_any_patterns:
        if pattern in content:
            content = content.replace(pattern, replacement)
            changes.append(f'Replaced {pattern} with {replacement}')

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
        changes = fix_file(filepath)
        if changes:
            total_files_changed += 1
            total_changes += len(changes)
            print(f"✓ {filepath}")
            for change in changes:
                print(f"  - {change}")

    print()
    print(f"✅ Fixed {total_changes} issues in {total_files_changed} files")

if __name__ == '__main__':
    main()
