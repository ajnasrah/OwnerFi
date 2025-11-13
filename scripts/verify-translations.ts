import * as fs from 'fs';
import * as path from 'path';

// Read the page.tsx file
const pagePath = path.join(__dirname, '../src/app/page.tsx');
const pageContent = fs.readFileSync(pagePath, 'utf-8');

// Extract all data-translate attributes
const dataTranslateRegex = /data-translate="([^"]+)"/g;
const matches = pageContent.matchAll(dataTranslateRegex);
const usedKeys = new Set<string>();

for (const match of matches) {
  usedKeys.add(match[1]);
}

console.log('📋 Found data-translate attributes in page.tsx:', usedKeys.size);
console.log('\nKeys used:');
Array.from(usedKeys).sort().forEach(key => {
  console.log(`  ✓ ${key}`);
});

// Import translations to verify they exist
const translationsPath = path.join(__dirname, '../src/lib/translations.ts');
const translationsContent = fs.readFileSync(translationsPath, 'utf-8');

console.log('\n🔍 Verifying all keys exist in translations...\n');

let allKeysExist = true;
for (const key of usedKeys) {
  const keyRegex = new RegExp(`${key.replace('.', '\\.')}:`);
  if (!keyRegex.test(translationsContent)) {
    console.log(`❌ MISSING: ${key}`);
    allKeysExist = false;
  }
}

if (allKeysExist) {
  console.log('✅ All translation keys exist!\n');
} else {
  console.log('\n⚠️  Some translation keys are missing!\n');
}

// Check for keys in HomePageClient.tsx
const clientPath = path.join(__dirname, '../src/app/HomePageClient.tsx');
const clientContent = fs.readFileSync(clientPath, 'utf-8');

console.log('🔍 Checking HomePageClient.tsx handlers...\n');

const translationLines = clientContent.match(/data-translate="([^"]+)"/g) || [];
console.log(`Found ${translationLines.length} translation handlers in HomePageClient\n`);

// Count how many keys are handled
const handledKeys = new Set<string>();
const querySelectorMatches = clientContent.matchAll(/\['data-translate="([^"]+)"\'\]/g);
for (const match of querySelectorMatches) {
  handledKeys.add(match[1]);
}

console.log(`📊 Statistics:`);
console.log(`   Keys in page.tsx: ${usedKeys.size}`);
console.log(`   Keys handled in HomePageClient: ${handledKeys.size}`);

if (usedKeys.size === handledKeys.size) {
  console.log('   ✅ All keys are handled!\n');
} else {
  console.log('   ⚠️  Some keys may not update on language change\n');

  // Find missing handlers
  const missingHandlers = Array.from(usedKeys).filter(key => !handledKeys.has(key));
  if (missingHandlers.length > 0) {
    console.log('   Missing handlers for:');
    missingHandlers.forEach(key => console.log(`     - ${key}`));
  }
}

console.log('\n✅ Verification complete!');
