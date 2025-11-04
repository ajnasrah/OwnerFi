import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function fixLikedPropertiesFieldName() {
  console.log('\n🔄 Fixing likedProperties field name inconsistency...\n');

  const buyerProfilesSnapshot = await db.collection('buyerProfiles').get();
  console.log(`📊 Found ${buyerProfilesSnapshot.size} buyer profiles\n`);

  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of buyerProfilesSnapshot.docs) {
    const data = doc.data();

    try {
      // Check if we need to migrate
      const hasOldField = data.likedProperties && Array.isArray(data.likedProperties);
      const hasNewField = data.likedPropertyIds && Array.isArray(data.likedPropertyIds);

      if (hasOldField && !hasNewField) {
        // Migrate: copy likedProperties to likedPropertyIds
        await db.collection('buyerProfiles').doc(doc.id).update({
          likedPropertyIds: data.likedProperties,
        });
        console.log(`✅ Fixed: ${data.email || doc.id} (${data.likedProperties.length} liked properties)`);
        fixed++;
      } else if (hasOldField && hasNewField) {
        // Both exist - merge them and ensure consistency
        const merged = Array.from(new Set([...data.likedPropertyIds, ...data.likedProperties]));
        await db.collection('buyerProfiles').doc(doc.id).update({
          likedPropertyIds: merged,
          likedProperties: merged, // Keep both in sync
        });
        console.log(`✅ Merged: ${data.email || doc.id} (${merged.length} liked properties)`);
        fixed++;
      } else if (!hasOldField && !hasNewField) {
        // No liked properties at all - initialize empty array
        await db.collection('buyerProfiles').doc(doc.id).update({
          likedPropertyIds: [],
        });
        skipped++;
      } else {
        // Already correct (has likedPropertyIds)
        skipped++;
      }
    } catch (error: any) {
      console.error(`❌ Error fixing ${doc.id}: ${error.message}`);
      errors++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Fixed: ${fixed}`);
  console.log(`   Skipped (already correct): ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`\n✅ Migration complete!\n`);
}

fixLikedPropertiesFieldName().catch(console.error);
