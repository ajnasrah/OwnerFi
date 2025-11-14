import * as fs from 'fs';
import * as path from 'path';

interface PropertyData {
  zpid?: string | number;
  description?: string;
  address?: any;
  streetAddress?: string;
  city?: string;
  state?: string;
  price?: number;
  url?: string;
}

// Read the JSON file
const jsonPath = path.join(process.cwd(), 'apify-output/zillow-details-complete.json');
const data: PropertyData[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

console.log(`\n📊 Analyzing ${data.length} properties for owner financing mentions\n`);

// Categories
const hasOwnerFinancing: PropertyData[] = [];
const noOwnerFinancing: PropertyData[] = [];
const noDescription: PropertyData[] = [];
const emptyDescription: PropertyData[] = [];

// Patterns to detect
const positivePatterns = [
  /owner.{0,5}financ/i,
  /seller.{0,5}financ/i,
  /owner.{0,5}carry/i,
  /seller.{0,5}carry/i,
  /finance.{0,5}available/i,
  /financing.{0,5}available/i,
  /creative.{0,5}financ/i,
];

const negativePatterns = [
  /no.{0,5}owner.{0,5}financ/i,
  /not.{0,5}owner.{0,5}financ/i,
  /owner.{0,5}financ.{0,10}not.{0,5}available/i,
];

for (const property of data) {
  const desc = property.description;

  if (desc === null || desc === undefined) {
    noDescription.push(property);
    continue;
  }

  if (typeof desc === 'string' && desc.trim().length === 0) {
    emptyDescription.push(property);
    continue;
  }

  // Check for negative mentions first (higher priority)
  const hasNegative = negativePatterns.some(pattern => pattern.test(desc));
  if (hasNegative) {
    noOwnerFinancing.push(property);
    continue;
  }

  // Check for positive mentions
  const hasPositive = positivePatterns.some(pattern => pattern.test(desc));
  if (hasPositive) {
    hasOwnerFinancing.push(property);
  } else {
    noOwnerFinancing.push(property);
  }
}

// Summary
console.log('='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));
console.log(`✅ Has Owner Financing: ${hasOwnerFinancing.length} (${((hasOwnerFinancing.length / data.length) * 100).toFixed(1)}%)`);
console.log(`❌ No Owner Financing: ${noOwnerFinancing.length} (${((noOwnerFinancing.length / data.length) * 100).toFixed(1)}%)`);
console.log(`📝 No Description: ${noDescription.length} (${((noDescription.length / data.length) * 100).toFixed(1)}%)`);
console.log(`📄 Empty Description: ${emptyDescription.length} (${((emptyDescription.length / data.length) * 100).toFixed(1)}%)`);
console.log('');

// Show sample properties with owner financing
console.log('='.repeat(70));
console.log('SAMPLE PROPERTIES WITH OWNER FINANCING (First 5)');
console.log('='.repeat(70));
hasOwnerFinancing.slice(0, 5).forEach((prop, i) => {
  const addr = prop.streetAddress || prop.address?.streetAddress || 'Unknown';
  const city = prop.city || prop.address?.city || '';
  const state = prop.state || prop.address?.state || '';
  console.log(`\n${i + 1}. ${addr}, ${city}, ${state}`);
  console.log(`   ZPID: ${prop.zpid}`);
  console.log(`   Price: $${prop.price?.toLocaleString()}`);

  // Extract the relevant portion mentioning financing
  const desc = prop.description || '';
  const matches = positivePatterns.flatMap(pattern => {
    const match = desc.match(pattern);
    return match ? [match[0]] : [];
  });

  if (matches.length > 0) {
    console.log(`   Financing Mention: "${matches[0]}"`);
  }

  // Show snippet around the match
  const firstMatch = positivePatterns.find(pattern => pattern.test(desc));
  if (firstMatch) {
    const matchIndex = desc.search(firstMatch);
    const start = Math.max(0, matchIndex - 100);
    const end = Math.min(desc.length, matchIndex + 150);
    const snippet = desc.slice(start, end).replace(/\n/g, ' ');
    console.log(`   Context: "...${snippet}..."`);
  }
});

// Show sample properties WITHOUT owner financing
console.log('\n' + '='.repeat(70));
console.log('SAMPLE PROPERTIES WITHOUT OWNER FINANCING (First 5)');
console.log('='.repeat(70));
noOwnerFinancing.slice(0, 5).forEach((prop, i) => {
  const addr = prop.streetAddress || prop.address?.streetAddress || 'Unknown';
  const city = prop.city || prop.address?.city || '';
  const state = prop.state || prop.address?.state || '';
  console.log(`\n${i + 1}. ${addr}, ${city}, ${state}`);
  console.log(`   ZPID: ${prop.zpid}`);
  console.log(`   Price: $${prop.price?.toLocaleString()}`);

  const desc = prop.description || '';
  if (desc.length > 0) {
    const snippet = desc.slice(0, 200).replace(/\n/g, ' ');
    console.log(`   Description: "${snippet}..."`);
  } else {
    console.log(`   Description: (empty or null)`);
  }
});

// Save filtered results
const outputDir = path.join(process.cwd(), 'scraper-output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Save properties with owner financing
fs.writeFileSync(
  path.join(outputDir, 'owner-financing-properties.json'),
  JSON.stringify(hasOwnerFinancing, null, 2)
);

// Save stats
const stats = {
  total: data.length,
  hasOwnerFinancing: hasOwnerFinancing.length,
  noOwnerFinancing: noOwnerFinancing.length,
  noDescription: noDescription.length,
  emptyDescription: emptyDescription.length,
  percentageWithFinancing: ((hasOwnerFinancing.length / data.length) * 100).toFixed(2) + '%',
};

fs.writeFileSync(
  path.join(outputDir, 'owner-financing-analysis.json'),
  JSON.stringify(stats, null, 2)
);

console.log('\n' + '='.repeat(70));
console.log('✅ Analysis complete!');
console.log(`   Owner financing properties saved to: scraper-output/owner-financing-properties.json`);
console.log(`   Stats saved to: scraper-output/owner-financing-analysis.json`);
console.log('='.repeat(70) + '\n');
