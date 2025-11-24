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

async function deleteBadProperties() {
  console.log('\n🗑️  DELETING PROPERTIES WITH NEGATIVE KEYWORDS\n');
  console.log('='.repeat(80));

  // The 5 problematic properties
  const propertiesToDelete = [
    {
      id: 'IEkJ0xU7XKDkAubepVRo',
      address: '1580 Elmore Ave, Idaho Falls, ID 83402',
      reason: 'Says "No owner-carry or creative financing offered"',
    },
    {
      id: 'S9gVOzfGWDzrR2y6jfuz',
      address: '1414 Greendale Ave, Memphis, TN 38127',
      reason: 'Says "No wholesalers or seller financing offers"',
    },
    {
      id: 'jEXDiHo8D3dkup4bakss',
      address: '1380 Gill Ave, Memphis, TN 38106',
      reason: 'Says "No wholesalers or seller financing offers"',
    },
    {
      id: 'oXtrHmD6b82YdDWVtBWX',
      address: '3230 Yale Ave, Memphis, TN 38112',
      reason: 'Says "No Seller-financing offered"',
    },
    {
      id: 'ounsULsNmvCvPNf1k5S4',
      address: '637-639 E 102nd St, Cleveland, OH 44108',
      reason: 'Says "No wholesalers or owner-financing"',
    },
  ];

  console.log(`\nFound ${propertiesToDelete.length} properties to delete:\n`);

  propertiesToDelete.forEach((prop, idx) => {
    console.log(`${idx + 1}. ${prop.address}`);
    console.log(`   Reason: ${prop.reason}`);
    console.log(`   Doc ID: ${prop.id}`);
    console.log('');
  });

  console.log('='.repeat(80));
  console.log('\n🔄 Starting deletion...\n');

  let deletedCount = 0;
  let failedCount = 0;

  for (const property of propertiesToDelete) {
    try {
      // Verify it exists first
      const doc = await db.collection('zillow_imports').doc(property.id).get();

      if (!doc.exists) {
        console.log(`⚠️  ${property.address}`);
        console.log(`   Already deleted or doesn't exist`);
        failedCount++;
        continue;
      }

      // Delete the document
      await db.collection('zillow_imports').doc(property.id).delete();

      console.log(`✅ ${property.address}`);
      console.log(`   Successfully deleted`);
      deletedCount++;

    } catch (error) {
      console.log(`❌ ${property.address}`);
      console.log(`   Error: ${error}`);
      failedCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 DELETION SUMMARY\n');
  console.log(`Total properties processed: ${propertiesToDelete.length}`);
  console.log(`Successfully deleted: ${deletedCount}`);
  console.log(`Failed: ${failedCount}`);

  if (deletedCount === propertiesToDelete.length) {
    console.log('\n✅ All bad properties successfully deleted!');
  } else if (deletedCount > 0) {
    console.log('\n⚠️  Some properties were deleted, but some failed.');
  } else {
    console.log('\n❌ No properties were deleted.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Cleanup complete!\n');
}

// Run deletion
deleteBadProperties()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
