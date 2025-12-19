/**
 * Check ALL fields in our properties to find any estimate sources we're missing
 */

import { getAdminDb } from '../src/lib/firebase-admin';

async function main() {
  const db = await getAdminDb();
  if (!db) {
    console.error('Failed to get database');
    return;
  }

  // Get properties from both collections
  const cash = await db.collection('cash_houses').limit(100).get();
  const zillow = await db.collection('zillow_imports').where('ownerFinanceVerified', '==', true).limit(100).get();

  console.log('=== SCANNING ALL FIELDS IN PROPERTIES ===\n');

  const allFields = new Map<string, { count: number; samples: any[] }>();

  const allDocs = [...cash.docs, ...zillow.docs];

  for (const doc of allDocs) {
    const data = doc.data();
    scanObject(data, '', allFields);
  }

  // Sort by count and filter for potentially useful fields
  const sortedFields = Array.from(allFields.entries())
    .filter(([key]) => {
      const lowerKey = key.toLowerCase();
      return (
        lowerKey.includes('value') ||
        lowerKey.includes('estim') ||
        lowerKey.includes('price') ||
        lowerKey.includes('assess') ||
        lowerKey.includes('tax') ||
        lowerKey.includes('apprais') ||
        lowerKey.includes('worth') ||
        lowerKey.includes('market') ||
        lowerKey.includes('sold') ||
        lowerKey.includes('sale') ||
        lowerKey.includes('home') ||
        lowerKey.includes('property')
      );
    })
    .sort((a, b) => b[1].count - a[1].count);

  console.log('POTENTIALLY USEFUL VALUE/ESTIMATE FIELDS:');
  console.log('=========================================\n');

  for (const [field, info] of sortedFields) {
    // Skip obvious non-value fields
    if (field.includes('Image') || field.includes('Url') || field.includes('url') || field.includes('img')) continue;
    if (field.includes('Address') || field.includes('address')) continue;
    if (field.includes('Type') || field.includes('type') || field.includes('Status') || field.includes('status')) continue;

    const sampleStr = info.samples
      .slice(0, 3)
      .map(s => typeof s === 'object' ? JSON.stringify(s).slice(0, 50) : s)
      .join(', ');

    console.log(`${field}`);
    console.log(`  Found in: ${info.count}/${allDocs.length} docs`);
    console.log(`  Samples: ${sampleStr}`);
    console.log();
  }

  // Special: Check if any properties have Zillow's additional estimates
  console.log('\n=== CHECKING FOR ZILLOW SPECIAL FIELDS ===');

  const specialFields = [
    'homeValueForecastAmount',
    'homeValueForecastPercent',
    'taxAssessment',
    'taxAssessedValue',
    'redfin',
    'redfinEstimate',
    'realtor',
    'trulia',
    'taxHistory',
    'priceHistory',
    'nearbyHomes',
    'comparables',
    'comps',
  ];

  for (const field of specialFields) {
    let count = 0;
    let sample: any = null;

    for (const doc of allDocs) {
      const data = doc.data();
      if (data[field] !== undefined && data[field] !== null) {
        count++;
        if (!sample) sample = data[field];
      }
    }

    if (count > 0) {
      console.log(`${field}: ${count}/${allDocs.length} docs`);
      console.log(`  Sample: ${JSON.stringify(sample).slice(0, 100)}`);
    }
  }
}

function scanObject(obj: any, prefix: string, fields: Map<string, { count: number; samples: any[] }>) {
  if (!obj || typeof obj !== 'object') return;

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && value !== undefined && value !== '' && value !== 0) {
      const existing = fields.get(fullKey) || { count: 0, samples: [] };
      existing.count++;
      if (existing.samples.length < 3 && typeof value !== 'object') {
        existing.samples.push(value);
      }
      fields.set(fullKey, existing);
    }

    // Don't recurse into arrays or deeply nested objects (too noisy)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      try {
        const keys = Object.keys(value);
        if (keys.length < 20) {
          scanObject(value, fullKey, fields);
        }
      } catch {
        // Skip objects that can't be enumerated
      }
    }
  }
}

main().catch(console.error);
