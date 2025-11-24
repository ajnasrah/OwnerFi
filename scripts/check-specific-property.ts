import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();

async function checkProperty() {
  console.log('\n🔍 SEARCHING FOR: 131 Hilltop Dr, Trinidad, TX 75163\n');
  console.log('='.repeat(80));

  // Get all properties and search
  const allProps = await db.collection('zillow_imports').get();

  console.log(`\nTotal properties in database: ${allProps.size}\n`);

  // Search for the specific property
  const matches = allProps.docs.filter(doc => {
    const data = doc.data();
    const addr = (data.fullAddress || '').toLowerCase();
    return addr.includes('131 hilltop') && addr.includes('trinidad');
  });

  console.log(`Found ${matches.length} matching properties\n`);

  if (matches.length > 0) {
    matches.forEach((doc, idx) => {
      const data = doc.data();
      console.log(`\n--- PROPERTY ${idx + 1} ---`);
      console.log(`Document ID: ${doc.id}`);
      console.log(`Full Address: ${data.fullAddress}`);
      console.log(`Street Address: ${data.streetAddress}`);
      console.log(`ZPID: ${data.zpid}`);
      console.log(`Price: $${data.price?.toLocaleString() || 'N/A'}`);
      console.log(`URL: ${data.url}`);

      console.log(`\n📝 DESCRIPTION INFO:`);
      console.log(`  Type: ${typeof data.description}`);
      console.log(`  Is Null: ${data.description === null}`);
      console.log(`  Is Undefined: ${data.description === undefined}`);
      console.log(`  Length: ${data.description?.length || 0}`);

      if (data.description) {
        console.log(`  First 300 chars: ${data.description.substring(0, 300)}...`);
      } else {
        console.log(`  Value: ${data.description}`);
      }

      console.log(`\n✅ FILTER STATUS:`);
      console.log(`  Owner Finance Verified: ${data.ownerFinanceVerified}`);
      console.log(`  Matched Keywords: ${data.matchedKeywords?.join(', ') || 'NONE'}`);
      console.log(`  Primary Keyword: ${data.primaryKeyword || 'NONE'}`);

      console.log(`\n📅 TIMESTAMPS:`);
      console.log(`  Found At: ${data.foundAt?.toDate?.() || 'N/A'}`);
      console.log(`  Imported At: ${data.importedAt?.toDate?.() || 'N/A'}`);

      console.log(`\n📦 SOURCE:`);
      console.log(`  Source: ${data.source}`);
      console.log(`  Home Status: ${data.homeStatus}`);
    });
  } else {
    console.log('❌ Property NOT found in database');
    console.log('\nSearching for similar properties in Trinidad, TX...\n');

    const trinidadProps = allProps.docs.filter(doc => {
      const addr = (doc.data().fullAddress || '').toLowerCase();
      return addr.includes('trinidad') && addr.includes('tx');
    });

    console.log(`Found ${trinidadProps.length} properties in Trinidad, TX\n`);

    trinidadProps.slice(0, 10).forEach((doc, idx) => {
      const data = doc.data();
      console.log(`${idx + 1}. ${data.fullAddress}`);
      console.log(`   ZPID: ${data.zpid}`);
      console.log(`   Has Description: ${!!data.description}`);
      console.log(`   Description Length: ${data.description?.length || 0}`);
      console.log('');
    });
  }

  console.log('='.repeat(80));
  console.log('✅ Search complete!\n');

  process.exit(0);
}

checkProperty();
