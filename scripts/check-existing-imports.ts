import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

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

async function checkExistingImports() {
  console.log('=== CHECKING EXISTING ZILLOW_IMPORTS ===\n');

  // Get recent imports
  const importsSnap = await db.collection('zillow_imports')
    .orderBy('foundAt', 'desc')
    .limit(10)
    .get();

  console.log(`Checking ${importsSnap.size} recent properties:\n`);

  const ownerFinanceKeywords = [
    'owner financing', 'seller financing', 'owner carry', 'seller carry',
    'creative financing', 'flexible financing', 'terms available', 'owner terms',
    'rent to own', 'lease option', 'lease purchase', 'land contract',
    'contract for deed', 'owner will finance', 'seller will finance'
  ];

  let withOwnerFinance = 0;
  let withoutOwnerFinance = 0;

  for (const doc of importsSnap.docs) {
    const data = doc.data();
    const desc = (data.description || '').toLowerCase();

    console.log(`Address: ${data.fullAddress || data.streetAddress || 'N/A'}`);
    console.log(`Price: $${data.price?.toLocaleString() || 'N/A'}`);
    console.log(`Status: ${data.homeStatus || data.status || 'N/A'}`);
    console.log(`Matched Keywords: ${data.matchedKeywords?.join(', ') || 'N/A'}`);

    // Check for owner finance keywords in description
    const foundKeywords: string[] = [];
    for (const kw of ownerFinanceKeywords) {
      if (desc.includes(kw)) {
        foundKeywords.push(kw);
      }
    }

    if (foundKeywords.length > 0 || data.matchedKeywords?.length > 0) {
      console.log(`✅ HAS OWNER FINANCE`);
      withOwnerFinance++;
    } else {
      console.log(`❌ NO OWNER FINANCE FOUND`);
      console.log(`   Desc preview: ${desc.substring(0, 150)}...`);
      withoutOwnerFinance++;
    }
    console.log('---\n');
  }

  console.log('=== SUMMARY ===');
  console.log(`With owner finance: ${withOwnerFinance}`);
  console.log(`Without owner finance: ${withoutOwnerFinance}`);

  // Check overall stats
  const totalSnap = await db.collection('zillow_imports').count().get();
  const verifiedSnap = await db.collection('zillow_imports')
    .where('ownerFinanceVerified', '==', true)
    .count().get();

  console.log(`\nTotal in zillow_imports: ${totalSnap.data().count}`);
  console.log(`With ownerFinanceVerified=true: ${verifiedSnap.data().count}`);
}

checkExistingImports().catch(console.error);
