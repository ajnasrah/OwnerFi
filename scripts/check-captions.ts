/**
 * Check captions in benefit workflows
 */

import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit } from 'firebase/firestore';

async function checkCaptions() {
  console.log('🔍 Checking benefit workflow captions...\n');

  try {
    // Query recent benefit workflows (completed and posting)
    const q = query(
      collection(db, 'benefit_workflow_queue'),
      where('status', 'in', ['completed', 'posting']),
      orderBy('createdAt', 'desc'),
      firestoreLimit(10)
    );

    const snapshot = await getDocs(q);
    console.log(`📦 Found ${snapshot.size} recent completed/posting workflows\n`);

    for (const doc of snapshot.docs) {
      const data = doc.data();

      console.log('━'.repeat(80));
      console.log(`ID: ${doc.id}`);
      console.log(`Status: ${data.status}`);
      console.log(`Benefit Title: ${data.benefitTitle || 'MISSING'}`);
      console.log(`\nCaption stored: ${data.caption ? 'YES' : 'NO'}`);

      if (data.caption) {
        console.log(`Caption preview: ${data.caption.substring(0, 100)}...`);
      } else {
        console.log(`⚠️  NO CAPTION - will use fallback: "Learn about owner financing! 🏡"`);
      }

      console.log(`\nTitle stored: ${data.title ? 'YES' : 'NO'}`);
      if (data.title) {
        console.log(`Title: ${data.title}`);
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCaptions().catch(error => {
  console.error('\n❌ Script error:', error);
  process.exit(1);
});
