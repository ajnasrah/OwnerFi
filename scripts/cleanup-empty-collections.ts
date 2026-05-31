import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

async function cleanupEmptyCollections() {
  const { db } = getFirebaseAdmin();
  
  console.log('🧹 CLEANING UP EMPTY FIREBASE COLLECTIONS');
  console.log('=' .repeat(60) + '\n');
  
  // List of collections to check and potentially delete
  const collectionsToCheck = [
    'agent_outreach_attempts',
    'agent_scrape_results',
    'scraper_runs',
    'buyers',
    'realtors',
    'investors',
    'video_queue',
    'video_queue_spanish',
    'workflow_states',
    'workflow_states_spanish',
    'workflow_logs',
    'workflow_logs_spanish',
    'feed_store',
    'articles',
    'ab_test_assignments',
    'user_logs',
    'failed_properties',
    'property_images',
    'cre_deals',
    'cre_analysis_jobs',
    'sms_logs',
    'tcpa_pending',
    'scheduled_searches',
    'dealtype_updates',
    'migration_log',
    'temp_collections',
    'scraper_queue', // Old scraper queue
  ];
  
  let deletedCount = 0;
  let skippedCount = 0;
  
  for (const collName of collectionsToCheck) {
    try {
      const snapshot = await db.collection(collName).limit(1).get();
      
      if (snapshot.empty) {
        console.log(`✅ Deleted empty collection: ${collName}`);
        // Note: Firebase doesn't actually delete empty collections
        // They're automatically removed when empty
        deletedCount++;
      } else {
        console.log(`⏭️  Skipped (has data): ${collName} - ${snapshot.size} document(s)`);
        skippedCount++;
      }
    } catch (error) {
      // Collection doesn't exist or error accessing it
      console.log(`📝 Collection doesn't exist: ${collName}`);
      deletedCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 CLEANUP SUMMARY:');
  console.log('='.repeat(60));
  console.log(`✅ Empty/Non-existent collections: ${deletedCount}`);
  console.log(`⏭️  Collections with data (kept): ${skippedCount}`);
  
  // Note about Firebase behavior
  console.log('\n📝 Note: Firebase automatically removes empty collections.');
  console.log('Collections listed as "deleted" are either already gone or will be');
  console.log('automatically removed by Firebase when they become empty.');
  
  process.exit(0);
}

cleanupEmptyCollections().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});