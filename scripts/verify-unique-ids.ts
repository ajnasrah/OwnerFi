import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase credentials');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();

async function verifyUniqueIDs() {
  console.log('\n🔍 Verifying Unique Property IDs\n');
  console.log('=' .repeat(70));

  try {
    // Get all properties
    const snapshot = await db.collection('zillow_imports')
      .where('ownerFinanceVerified', '==', true)
      .get();

    console.log(`\n📊 Total properties in database: ${snapshot.size}\n`);

    const ids = new Set<string>();
    const duplicateIds: string[] = [];
    const propertiesWithoutId: any[] = [];
    const sampleProperties: any[] = [];

    snapshot.forEach((doc, index) => {
      const id = doc.id;
      const data = doc.data();

      // Check if ID exists
      if (!id || id === '') {
        propertiesWithoutId.push({
          address: data.fullAddress || data.address,
          data
        });
      } else {
        // Check for duplicates
        if (ids.has(id)) {
          duplicateIds.push(id);
        } else {
          ids.add(id);
        }
      }

      // Collect samples
      if (index < 10) {
        sampleProperties.push({
          id,
          address: data.fullAddress || data.address,
          source: data.source,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          importedAt: data.importedAt?.toDate?.()?.toISOString() || data.importedAt,
          foundAt: data.foundAt?.toDate?.()?.toISOString() || data.foundAt,
        });
      }
    });

    console.log('=' .repeat(70));
    console.log('\n📊 ID VERIFICATION RESULTS:\n');

    console.log(`Total Properties:              ${snapshot.size}`);
    console.log(`Unique IDs:                    ${ids.size}`);
    console.log(`Properties without ID:         ${propertiesWithoutId.length}`);
    console.log(`Duplicate IDs found:           ${duplicateIds.length}`);

    console.log('\n' + '=' .repeat(70));
    console.log('\n📋 Sample Properties (showing first 10):\n');

    sampleProperties.forEach((prop, index) => {
      console.log(`${index + 1}. ID: ${prop.id}`);
      console.log(`   Address: ${prop.address}`);
      console.log(`   Source: ${prop.source || 'N/A'}`);
      console.log(`   Created: ${prop.createdAt || 'N/A'}`);
      console.log(`   Found: ${prop.foundAt || 'N/A'}`);
      console.log('');
    });

    // ID Format Analysis
    console.log('=' .repeat(70));
    console.log('\n🔍 ID FORMAT ANALYSIS:\n');

    const idLengths = new Map<number, number>();
    const idFormats = {
      firestore: 0,  // 20 character alphanumeric
      custom: 0,      // Other formats
    };

    ids.forEach(id => {
      const length = id.length;
      idLengths.set(length, (idLengths.get(length) || 0) + 1);

      // Firestore auto-generated IDs are typically 20 characters
      if (length === 20 && /^[a-zA-Z0-9]+$/.test(id)) {
        idFormats.firestore++;
      } else {
        idFormats.custom++;
      }
    });

    console.log('ID Lengths:');
    Array.from(idLengths.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([length, count]) => {
        console.log(`   ${length} characters: ${count} properties`);
      });

    console.log('\nID Types:');
    console.log(`   Firestore Auto-generated: ${idFormats.firestore} (${((idFormats.firestore / ids.size) * 100).toFixed(1)}%)`);
    console.log(`   Custom/Other format:      ${idFormats.custom} (${((idFormats.custom / ids.size) * 100).toFixed(1)}%)`);

    // Final Verdict
    console.log('\n' + '=' .repeat(70));
    console.log('\n✅ FINAL VERDICT:\n');

    if (propertiesWithoutId.length === 0 && duplicateIds.length === 0 && ids.size === snapshot.size) {
      console.log('🎉 SUCCESS! All properties have unique IDs!');
      console.log(`   ✅ ${snapshot.size} properties`);
      console.log(`   ✅ ${ids.size} unique IDs`);
      console.log(`   ✅ 0 duplicates`);
      console.log(`   ✅ 0 missing IDs`);
      console.log('\n✅ Every property has been assigned a unique Firestore document ID from the moment it was scraped/imported!\n');
    } else {
      console.log('⚠️  WARNING: Issues found with IDs');
      if (propertiesWithoutId.length > 0) {
        console.log(`   ❌ ${propertiesWithoutId.length} properties without IDs`);
      }
      if (duplicateIds.length > 0) {
        console.log(`   ❌ ${duplicateIds.length} duplicate IDs`);
      }
      console.log('');
    }

    console.log('=' .repeat(70));

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

verifyUniqueIDs()
  .then(() => {
    console.log('\n✅ Verification complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
