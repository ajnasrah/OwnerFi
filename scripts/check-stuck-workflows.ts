// Check for stuck workflows across all brands
import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

async function checkStuckWorkflows() {
  if (!db) {
    console.error('Firebase not initialized');
    return;
  }

  console.log('🔍 Checking for stuck workflows...\n');

  const brands = ['carz', 'ownerfi', 'vassdistro', 'benefit', 'property', 'podcast'];
  const collections = brands.map(b => `${b}_workflow_queue`);

  for (let i = 0; i < collections.length; i++) {
    const collectionName = collections[i];
    const brand = brands[i];

    console.log(`\n📊 ${brand.toUpperCase()} workflows:`);

    try {
      // Check heygen_processing
      const heygenQuery = query(
        collection(db, collectionName),
        where('status', '==', 'heygen_processing')
      );
      const heygenSnapshot = await getDocs(heygenQuery);

      if (heygenSnapshot.size > 0) {
        console.log(`  ⏳ HeyGen processing: ${heygenSnapshot.size}`);
        heygenSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const age = Date.now() - (data.updatedAt || data.createdAt);
          const minutes = Math.floor(age / 60000);
          console.log(`     - ${doc.id}: ${minutes} min old`);
        });
      }

      // Check submagic_processing
      const submagicQuery = query(
        collection(db, collectionName),
        where('status', '==', 'submagic_processing')
      );
      const submagicSnapshot = await getDocs(submagicQuery);

      if (submagicSnapshot.size > 0) {
        console.log(`  ⏳ Submagic processing: ${submagicSnapshot.size}`);
        submagicSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const age = Date.now() - (data.updatedAt || data.createdAt);
          const minutes = Math.floor(age / 60000);
          console.log(`     - ${doc.id}: ${minutes} min old`);
        });
      }

      // Check posting
      const postingQuery = query(
        collection(db, collectionName),
        where('status', '==', 'posting')
      );
      const postingSnapshot = await getDocs(postingQuery);

      if (postingSnapshot.size > 0) {
        console.log(`  ⏳ Posting: ${postingSnapshot.size}`);
        postingSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const age = Date.now() - (data.updatedAt || data.createdAt);
          const minutes = Math.floor(age / 60000);
          console.log(`     - ${doc.id}: ${minutes} min old`);
        });
      }

      // Check failed
      const failedQuery = query(
        collection(db, collectionName),
        where('status', '==', 'failed')
      );
      const failedSnapshot = await getDocs(failedQuery);

      if (failedSnapshot.size > 0) {
        console.log(`  ❌ Failed: ${failedSnapshot.size}`);
        failedSnapshot.docs.slice(0, 3).forEach(doc => {
          const data = doc.data();
          console.log(`     - ${doc.id}: ${data.error || 'Unknown error'}`);
        });
      }

    } catch (error) {
      console.error(`  Error checking ${brand}:`, error);
    }
  }

  console.log('\n✅ Check complete');
}

checkStuckWorkflows()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
