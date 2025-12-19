#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Fixes to apply
const fixes = [
  // Fix 1: Unused request parameter - prefix with underscore
  {
    name: 'Unused request parameter',
    pattern: /export async function (GET|POST|PUT|PATCH|DELETE)\(request: (Request|NextRequest)\) \{/g,
    test: (content) => {
      // Only fix if request is not used in the function
      const matches = [...content.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\(request: (Request|NextRequest)\) \{/g)];
      return matches.filter(match => {
        const fnStart = match.index;
        const restOfFile = content.slice(fnStart);
        // Find the end of this function (simplified - find next export or end of file)
        const nextExport = restOfFile.indexOf('\nexport ', 10);
        const fnContent = nextExport > 0 ? restOfFile.slice(0, nextExport) : restOfFile;
        // Check if 'request' is used (excluding the parameter declaration)
        const usages = fnContent.slice(50).match(/\brequest\./g) || [];
        const requestJsonUsage = fnContent.slice(50).match(/await request\.json\(\)/g) || [];
        const requestUrlUsage = fnContent.slice(50).match(/request\.url/g) || [];
        return usages.length === 0 && requestJsonUsage.length === 0 && requestUrlUsage.length === 0;
      }).length > 0;
    },
    replace: (content) => {
      // Only replace if request is not used
      const regex = /export async function (GET|POST|PUT|PATCH|DELETE)\(request: (Request|NextRequest)\) \{/g;
      return content.replace(regex, (match, method, reqType) => {
        const fnStart = content.indexOf(match);
        const restOfFile = content.slice(fnStart);
        const nextExport = restOfFile.indexOf('\nexport ', 10);
        const fnContent = nextExport > 0 ? restOfFile.slice(0, nextExport) : restOfFile;
        const usages = fnContent.slice(50).match(/\brequest\./g) || [];
        const requestJsonUsage = fnContent.slice(50).match(/await request\.json\(\)/g) || [];
        const requestUrlUsage = fnContent.slice(50).match(/request\.url/g) || [];
        if (usages.length === 0 && requestJsonUsage.length === 0 && requestUrlUsage.length === 0) {
          return `export async function ${method}(_request: ${reqType}) {`;
        }
        return match;
      });
    }
  },

  // Fix 2: catch (error: any) -> catch (error)
  {
    name: 'Remove any from catch blocks',
    pattern: /\} catch \(error: any\) \{/g,
    replace: (content) => content.replace(/\} catch \(error: any\) \{/g, '} catch (error) {')
  },

  // Fix 3: Unused error variable in catch blocks
  {
    name: 'Prefix unused error in catch',
    pattern: /\} catch \(error\) \{[\s\S]*?\n  \}/g,
    test: (content) => {
      const matches = [...content.matchAll(/\} catch \(error\) \{([\s\S]*?)\n  \}/g)];
      return matches.filter(match => {
        const catchBody = match[1];
        // Check if error is never used (not in console.log, console.error, etc.)
        return !catchBody.includes('error');
      }).length > 0;
    },
    replace: (content) => {
      return content.replace(/\} catch \(error\) \{([\s\S]*?)\n  \}/g, (match, catchBody) => {
        if (!catchBody.includes('error')) {
          return match.replace('} catch (error) {', '} catch (_error) {');
        }
        return match;
      });
    }
  },

  // Fix 4: Fix error.message access after catch (error)
  {
    name: 'Fix error.message access',
    pattern: /\} catch \(error\) \{[\s\S]*?return NextResponse\.json\(\{ error: error\.message \}/g,
    replace: (content) => {
      return content.replace(
        /(} catch \(error\) \{[\s\S]*?)(return NextResponse\.json\(\{ error: error\.message )/g,
        (match, beforeReturn, returnPart) => {
          // Add instanceof check before the return
          const indent = beforeReturn.match(/\n([ \t]+)return/)?.[1] || '    ';
          const errorVarLine = `${indent}const message = error instanceof Error ? error.message : 'Unknown error';\n`;
          return beforeReturn + errorVarLine + returnPart.replace('error.message', 'message');
        }
      );
    }
  },

  // Fix 5: Remove unused imports
  {
    name: 'Remove unused imports - where, or',
    pattern: /import \{[\s\S]*?\} from ['"]firebase\/firestore['"];/,
    replace: (content) => {
      const importMatch = content.match(/import \{([^}]+)\} from ['"]firebase\/firestore['"];/);
      if (importMatch) {
        const imports = importMatch[1].split(',').map(i => i.trim());
        const usedImports = imports.filter(imp => {
          // Check if import is used in the file
          const importName = imp.trim();
          const regex = new RegExp(`\\b${importName}\\(`, 'g');
          const usages = (content.match(regex) || []).length;
          // Count the import statement itself
          return usages > 0;
        });

        if (usedImports.length !== imports.length && usedImports.length > 0) {
          return content.replace(
            /import \{[^}]+\} from ['"]firebase\/firestore['"];/,
            `import {${usedImports.join(', ')}} from 'firebase/firestore';`
          );
        }
      }
      return content;
    }
  },

  // Fix 6: Remove unused variables
  {
    name: 'Remove unused variable declarations',
    test: (content) => {
      return content.match(/const (languageAgents|foundFormat|where|or)\s*=/);
    },
    replace: (content) => {
      // Comment out unused variables
      return content
        .replace(/^(\s*)(const languageAgents\s*=)/gm, '$1// $2')
        .replace(/^(\s*)(const foundFormat\s*=)/gm, '$1// $2');
    }
  },

  // Fix 7: Replace (hit: any) with proper type
  {
    name: 'Replace any with Record<string, unknown> for generic objects',
    pattern: /\((hit|doc|item|obj|data|result|facet|count|f|c): any\)/g,
    replace: (content) => content.replace(
      /\((hit|doc|item|obj|data|result|facet|count|f|c): any\)/g,
      '($1: Record<string, unknown>)'
    )
  },

  // Fix 8: Replace catch (err: any) patterns
  {
    name: 'Replace catch (err: any)',
    pattern: /catch \(err: any\)/g,
    replace: (content) => content.replace(/catch \(err: any\)/g, 'catch (err)')
  },
];

async function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  let changesApplied = [];

  for (const fix of fixes) {
    // Test if fix is needed
    if (fix.test) {
      if (!fix.test(content)) {
        continue;
      }
    } else if (fix.pattern) {
      if (!fix.pattern.test(content)) {
        continue;
      }
    }

    // Apply fix
    const newContent = fix.replace(content);
    if (newContent !== content) {
      changesApplied.push(fix.name);
      content = newContent;
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return changesApplied;
  }

  return [];
}

async function main() {
  console.log('Finding TypeScript files in src/app/api...');

  const files = glob.sync('src/app/api/**/*.{ts,tsx}', {
    ignore: ['**/*.d.ts', '**/node_modules/**'],
    absolute: true,
  });

  console.log(`Found ${files.length} files\n`);

  let totalFiles = 0;
  let totalChanges = 0;

  for (const file of files) {
    const changes = await fixFile(file);
    if (changes.length > 0) {
      totalFiles++;
      totalChanges += changes.length;
      console.log(`✓ ${path.relative(process.cwd(), file)}`);
      changes.forEach(change => console.log(`  - ${change}`));
    }
  }

  console.log(`\n✅ Fixed ${totalChanges} issues in ${totalFiles} files`);
  console.log('\nRun: npx eslint src/app/api --ext .ts,.tsx --fix');
  console.log('to auto-fix remaining formatting issues\n');
}

main().catch(console.error);
