#!/usr/bin/env tsx
// Delete articles with empty content (from failed web scraping)

import { db } from '../src/lib/firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

async function cleanupEmptyArticles() {
  console.log('🧹 Cleaning up articles with empty content...\n');

  const brands = ['ownerfi', 'carz', 'vassdistro'];
  let totalDeleted = 0;

  for (const brand of brands) {
    const collectionName = `${brand}_articles`;
    const articlesRef = collection(db, collectionName);

    console.log(`\n📁 Checking ${collectionName}...`);

    const snapshot = await getDocs(articlesRef);
    console.log(`   Found ${snapshot.size} total articles`);

    let deletedCount = 0;
    const deletePromises: Promise<void>[] = [];

    snapshot.docs.forEach((docSnap) => {
      const article = docSnap.data();
      const contentLength = (article.content || '').trim().length;

      // Delete articles with no content or very short content (likely broken)
      if (contentLength < 50) {
        deletePromises.push(deleteDoc(doc(db, collectionName, docSnap.id)));
        deletedCount++;
      }
    });

    await Promise.all(deletePromises);

    console.log(`   ❌ Deleted ${deletedCount} articles with insufficient content`);
    console.log(`   ✅ Kept ${snapshot.size - deletedCount} articles with good content`);

    totalDeleted += deletedCount;
  }

  console.log(`\n✅ Cleanup complete: ${totalDeleted} articles deleted\n`);
  console.log('📝 NEXT STEPS:');
  console.log('   1. Fetch fresh articles: curl https://ownerfi.ai/api/cron/fetch-feeds');
  console.log('   2. Rate articles: curl https://ownerfi.ai/api/cron/rate-articles');
  console.log('   3. Try workflow: POST /api/workflow/complete-viral\n');

  process.exit(0);
}

cleanupEmptyArticles().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
