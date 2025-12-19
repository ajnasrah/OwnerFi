#!/usr/bin/env tsx

/**
 * Script to automatically fix common ESLint errors in src/app/api
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

interface Fix {
  pattern: RegExp;
  replacement: string | ((match: string, ...args: string[]) => string);
  description: string;
}

const fixes: Fix[] = [
  // Fix unused 'request' parameter - prefix with underscore
  {
    pattern: /export async function (GET|POST|PUT|DELETE|PATCH)\(request: Request\) \{/g,
    replacement: 'export async function $1(_request: Request) {',
    description: 'Prefix unused request parameter with underscore'
  },
  // Fix unused 'error' in catch blocks - remove typing
  {
    pattern: /\} catch \(error: any\) \{/g,
    replacement: '} catch (error) {',
    description: 'Remove any type from catch error'
  },
  // Fix error.message access - use proper error handling
  {
    pattern: /catch \(error\) \{\s*console\.error\((.*?), error\);\s*return NextResponse\.json\(\{ error: error\.message \}/gs,
    replacement: (match: string, logMsg: string) => {
      return `catch (error) {\n    console.error(${logMsg}, error);\n    const message = error instanceof Error ? error.message : 'Unknown error';\n    return NextResponse.json({ error: message }`;
    },
    description: 'Fix error.message access with proper instanceof check'
  },
];

async function fixFile(filePath: string): Promise<number> {
  let content = fs.readFileSync(filePath, 'utf-8');
  let fixCount = 0;

  for (const fix of fixes) {
    const matches = content.match(fix.pattern);
    if (matches) {
      fixCount += matches.length;
      if (typeof fix.replacement === 'function') {
        content = content.replace(fix.pattern, fix.replacement);
      } else {
        content = content.replace(fix.pattern, fix.replacement);
      }
    }
  }

  if (fixCount > 0) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  return fixCount;
}

async function main() {
  const files = await glob('src/app/api/**/*.ts', {
    ignore: ['**/*.d.ts', '**/node_modules/**'],
    absolute: true,
  });

  console.log(`Found ${files.length} files to check`);

  let totalFixes = 0;
  const fixedFiles: string[] = [];

  for (const file of files) {
    const fixCount = await fixFile(file);
    if (fixCount > 0) {
      totalFixes += fixCount;
      fixedFiles.push(path.relative(process.cwd(), file));
      console.log(`✓ Fixed ${fixCount} issues in ${path.basename(file)}`);
    }
  }

  console.log(`\n✅ Fixed ${totalFixes} issues across ${fixedFiles.length} files`);

  if (fixedFiles.length > 0) {
    console.log('\nFixed files:');
    fixedFiles.forEach(f => console.log(`  - ${f}`));
  }
}

main().catch(console.error);
