import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function checkEmptyDescriptions() {
  console.log('\n🔍 CHECKING PROPERTIES WITHOUT DESCRIPTIONS\n');
  console.log('='.repeat(80));

  // Get all properties from zillow_imports
  const allProperties = await db.collection('zillow_imports').get();

  console.log(`\n📦 Total properties in zillow_imports: ${allProperties.size}`);

  let noDescription = 0;
  let emptyDescription = 0;
  let hasDescription = 0;
  let nullDescription = 0;
  let undefinedDescription = 0;

  const recentNoDesc: any[] = [];

  allProperties.docs.forEach(doc => {
    const data = doc.data();
    const desc = data.description;

    if (desc === null) {
      nullDescription++;
      noDescription++;
      if (recentNoDesc.length < 10) {
        recentNoDesc.push({ id: doc.id, data, reason: 'null' });
      }
    } else if (desc === undefined) {
      undefinedDescription++;
      noDescription++;
      if (recentNoDesc.length < 10) {
        recentNoDesc.push({ id: doc.id, data, reason: 'undefined' });
      }
    } else if (typeof desc === 'string' && desc.trim().length === 0) {
      emptyDescription++;
      noDescription++;
      if (recentNoDesc.length < 10) {
        recentNoDesc.push({ id: doc.id, data, reason: 'empty string' });
      }
    } else if (typeof desc === 'string' && desc.trim().length > 0) {
      hasDescription++;
    } else {
      noDescription++;
      if (recentNoDesc.length < 10) {
        recentNoDesc.push({ id: doc.id, data, reason: 'other type' });
      }
    }
  });

  console.log('\n📊 DESCRIPTION BREAKDOWN');
  console.log('-'.repeat(80));
  console.log(`✅ Has description: ${hasDescription} (${((hasDescription / allProperties.size) * 100).toFixed(1)}%)`);
  console.log(`❌ No description: ${noDescription} (${((noDescription / allProperties.size) * 100).toFixed(1)}%)`);
  console.log(`   - null: ${nullDescription}`);
  console.log(`   - undefined: ${undefinedDescription}`);
  console.log(`   - empty string: ${emptyDescription}`);

  // Show samples of properties without descriptions
  if (recentNoDesc.length > 0) {
    console.log('\n📋 SAMPLE PROPERTIES WITHOUT DESCRIPTIONS');
    console.log('-'.repeat(80));

    recentNoDesc.slice(0, 5).forEach((item, idx) => {
      const { data, reason } = item;
      const foundAt = data.foundAt?.toDate?.() || 'Unknown';

      console.log(`\n${idx + 1}. ${data.fullAddress || 'No address'}`);
      console.log(`   Description: ${reason}`);
      console.log(`   ZPID: ${data.zpid || 'N/A'}`);
      console.log(`   Price: $${data.price?.toLocaleString() || 'N/A'}`);
      console.log(`   URL: ${data.url || 'N/A'}`);
      console.log(`   Added: ${foundAt instanceof Date ? foundAt.toLocaleString() : foundAt}`);
      console.log(`   Status: ${data.homeStatus || 'Unknown'}`);
      console.log(`   Owner Finance Verified: ${data.ownerFinanceVerified || false}`);
      console.log(`   Matched Keywords: ${data.matchedKeywords?.join(', ') || 'None'}`);
      console.log(`   Primary Keyword: ${data.primaryKeyword || 'None'}`);
    });
  }

  // Check when these properties were added
  console.log('\n📅 WHEN WERE PROPERTIES WITHOUT DESCRIPTIONS ADDED?');
  console.log('-'.repeat(80));

  const last3Days = new Date();
  last3Days.setDate(last3Days.getDate() - 3);

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  let noDescLast3Days = 0;
  let noDescLast7Days = 0;

  allProperties.docs.forEach(doc => {
    const data = doc.data();
    const desc = data.description;
    const foundAt = data.foundAt?.toDate?.();

    const hasNoDesc = !desc || (typeof desc === 'string' && desc.trim().length === 0);

    if (hasNoDesc && foundAt) {
      if (foundAt >= last3Days) {
        noDescLast3Days++;
      }
      if (foundAt >= last7Days) {
        noDescLast7Days++;
      }
    }
  });

  console.log(`Last 3 days: ${noDescLast3Days} properties without descriptions`);
  console.log(`Last 7 days: ${noDescLast7Days} properties without descriptions`);

  // Check if any have ownerFinanceVerified = true
  console.log('\n⚠️  PROPERTIES WITHOUT DESCRIPTIONS BUT MARKED AS VERIFIED');
  console.log('-'.repeat(80));

  let verifiedWithoutDesc = 0;
  const verifiedSamples: any[] = [];

  allProperties.docs.forEach(doc => {
    const data = doc.data();
    const desc = data.description;
    const hasNoDesc = !desc || (typeof desc === 'string' && desc.trim().length === 0);

    if (hasNoDesc && data.ownerFinanceVerified === true) {
      verifiedWithoutDesc++;
      if (verifiedSamples.length < 5) {
        verifiedSamples.push({ id: doc.id, data });
      }
    }
  });

  console.log(`\nTotal: ${verifiedWithoutDesc} properties`);

  if (verifiedSamples.length > 0) {
    console.log('\nSample Properties:');
    verifiedSamples.forEach((item, idx) => {
      const { data } = item;
      console.log(`\n${idx + 1}. ${data.fullAddress || 'No address'}`);
      console.log(`   ZPID: ${data.zpid || 'N/A'}`);
      console.log(`   URL: ${data.url || 'N/A'}`);
      console.log(`   Matched Keywords: ${data.matchedKeywords?.join(', ') || 'None'}`);
      console.log(`   Primary Keyword: ${data.primaryKeyword || 'None'}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Analysis complete!\n');
}

// Run the analysis
checkEmptyDescriptions()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
