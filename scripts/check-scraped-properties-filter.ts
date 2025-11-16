import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { filterPropertiesForOwnerFinancing } from '../src/lib/owner-financing-filter';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

async function main() {
  console.log('🔍 Checking how many scraped properties pass owner financing filter...\n');

  // Get all properties from apify_search_scraper source
  const snapshot = await db
    .collection('zillow_imports')
    .where('source', '==', 'apify_search_scraper')
    .get();

  console.log(`📊 Found ${snapshot.size} properties from Apify search scraper\n`);

  if (snapshot.size === 0) {
    console.log('No properties found. Run the scraper first with: npm run scrape-search');
    return;
  }

  // Convert to array
  const properties = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Run through filter
  const { filtered, stats } = filterPropertiesForOwnerFinancing(properties);

  console.log('📈 Filter Results:');
  console.log('─────────────────────────────────────────');
  console.log(`Total properties:           ${stats.total}`);
  console.log(`✅ Passed filter:           ${stats.withOwnerFinancing} (${((stats.withOwnerFinancing / stats.total) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed filter:           ${stats.withoutOwnerFinancing} (${((stats.withoutOwnerFinancing / stats.total) * 100).toFixed(1)}%)`);
  console.log(`   - No description:        ${stats.noDescription}`);
  console.log(`   - Explicitly rejected:   ${stats.explicitlyRejected}`);
  console.log(`   - No OF mention:         ${stats.withoutOwnerFinancing - stats.noDescription - stats.explicitlyRejected}`);
  console.log('─────────────────────────────────────────\n');

  // Show some examples
  if (filtered.length > 0) {
    console.log('✅ Example properties that PASSED:');
    for (let i = 0; i < Math.min(3, filtered.length); i++) {
      const prop = filtered[i] as any;
      console.log(`\n${i + 1}. ${prop.address || 'Unknown address'}`);
      console.log(`   Price: $${prop.price?.toLocaleString() || 'N/A'}`);
      console.log(`   URL: ${prop.url || 'N/A'}`);

      // Find what matched
      const desc = prop.description || '';
      const ownerFinanceMatch = desc.match(/owner\s*financ|seller\s*financ|owner\s*carry|seller\s*carry|creative\s*financ|flexible\s*financ|terms\s*available|rent.*to.*own|lease.*option|financing?\s*available/i);
      if (ownerFinanceMatch) {
        console.log(`   Match: "${ownerFinanceMatch[0]}"`);
      }
    }
  }

  const failed = properties.filter(p => !filtered.includes(p));
  if (failed.length > 0) {
    console.log('\n\n❌ Example properties that FAILED:');
    for (let i = 0; i < Math.min(3, failed.length); i++) {
      const prop = failed[i] as any;
      console.log(`\n${i + 1}. ${prop.address || 'Unknown address'}`);
      console.log(`   Price: $${prop.price?.toLocaleString() || 'N/A'}`);
      console.log(`   URL: ${prop.url || 'N/A'}`);
      console.log(`   Description: ${prop.description ? (prop.description.substring(0, 100) + '...') : 'No description'}`);
    }
  }

  console.log('\n\n💡 Summary:');
  console.log(`Out of ${stats.total} properties scraped, ${stats.withOwnerFinancing} actually mention owner financing.`);
  console.log(`That's a ${((stats.withOwnerFinancing / stats.total) * 100).toFixed(1)}% match rate.`);
}

main().catch(console.error);
