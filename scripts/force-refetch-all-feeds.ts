import { getAdminDb } from '../src/lib/firebase-admin';

async function forceRefetchAll() {
  const adminDb = await getAdminDb();

  console.log('🔄 Resetting lastFetched for all feeds...\n');

  const feedsSnapshot = await adminDb.collection('feed_sources').get();

  console.log(`Found ${feedsSnapshot.size} feeds`);

  for (const feedDoc of feedsSnapshot.docs) {
    await adminDb.collection('feed_sources').doc(feedDoc.id).update({
      lastFetched: 0 // Reset to 0 so they fetch immediately
    });
    console.log(`✅ Reset: ${feedDoc.id}`);
  }

  console.log('\n✅ All feeds reset! Now trigger fetch:');
  console.log(`   curl -X POST "https://ownerfi.ai/api/cron/fetch-rss" -H "Authorization: Bearer YOUR_CRON_SECRET"`);
}

forceRefetchAll().catch(console.error);
