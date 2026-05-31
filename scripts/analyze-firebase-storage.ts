import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

interface CollectionStats {
  name: string;
  count: number;
  sampleAge?: string;
  purpose: string;
  recommendation: 'keep' | 'clean' | 'delete' | 'archive';
}

async function analyzeFirebaseStorage() {
  const { db } = getFirebaseAdmin();
  
  console.log('🔍 FIREBASE STORAGE ANALYSIS');
  console.log('=' .repeat(60) + '\n');
  
  const collections: CollectionStats[] = [];
  
  // List of known collections to analyze
  const collectionNames = [
    'properties',
    'agent_outreach_queue',
    'agent_outreach_attempts',
    'agent_scrape_results',
    'scraper_queue',
    'scraper_runs',
    'users',
    'buyers',
    'realtors',
    'investors',
    'cron_logs',
    'cron_meta',
    'status_change_reports',
    'video_queue',
    'video_queue_spanish',
    'workflow_states',
    'workflow_states_spanish',
    'workflow_logs',
    'workflow_logs_spanish',
    'feed_store',
    'articles',
    'ab_tests',
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
    'temp_collections'
  ];
  
  console.log('📊 ANALYZING COLLECTIONS...\n');
  
  for (const collName of collectionNames) {
    try {
      const snapshot = await db.collection(collName).count().get();
      const count = snapshot.data().count;
      
      if (count === 0) {
        collections.push({
          name: collName,
          count: 0,
          purpose: 'Empty collection',
          recommendation: 'delete'
        });
        continue;
      }
      
      // Get a sample document to check age
      const sampleDoc = await db.collection(collName)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get()
        .catch(() => db.collection(collName).limit(1).get());
      
      let sampleAge = 'Unknown';
      let purpose = 'Unknown';
      let recommendation: 'keep' | 'clean' | 'delete' | 'archive' = 'keep';
      
      if (!sampleDoc.empty) {
        const data = sampleDoc.docs[0].data();
        const createdAt = data.createdAt?.toDate?.() || data.date?.toDate?.() || data.timestamp?.toDate?.();
        
        if (createdAt) {
          const ageInDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
          sampleAge = `${ageInDays} days old`;
          
          // Determine purpose and recommendation based on collection name and age
          if (collName.includes('temp') || collName.includes('migration') || collName.includes('dealtype_updates')) {
            purpose = 'Temporary/Migration data';
            recommendation = ageInDays > 30 ? 'delete' : 'clean';
          } else if (collName.includes('log') || collName.includes('attempts')) {
            purpose = 'Logging data';
            recommendation = ageInDays > 90 ? 'clean' : 'keep';
          } else if (collName.includes('queue')) {
            purpose = 'Queue system';
            recommendation = collName.includes('scraper_queue') ? 'delete' : 'keep'; // Old scraper queue
          } else if (collName.includes('video') || collName.includes('workflow')) {
            purpose = 'Video/Workflow system';
            recommendation = collName.includes('spanish') ? 'clean' : 'keep'; // Spanish might be unused
          } else if (collName === 'failed_properties') {
            purpose = 'Error tracking';
            recommendation = ageInDays > 30 ? 'clean' : 'keep';
          } else if (collName === 'ab_tests' || collName === 'ab_test_assignments') {
            purpose = 'A/B testing';
            recommendation = ageInDays > 180 ? 'archive' : 'keep';
          } else if (collName === 'properties') {
            purpose = 'Core property data';
            recommendation = 'keep'; // But could clean old/sold
          } else {
            purpose = 'Active collection';
            recommendation = 'keep';
          }
        }
      }
      
      collections.push({
        name: collName,
        count,
        sampleAge,
        purpose,
        recommendation
      });
      
    } catch (error) {
      // Collection doesn't exist
      continue;
    }
  }
  
  // Sort by recommendation priority
  collections.sort((a, b) => {
    const priority = { 'delete': 0, 'clean': 1, 'archive': 2, 'keep': 3 };
    return priority[a.recommendation] - priority[b.recommendation];
  });
  
  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('📋 STORAGE CLEANUP RECOMMENDATIONS');
  console.log('='.repeat(60) + '\n');
  
  const deleteCollections = collections.filter(c => c.recommendation === 'delete');
  const cleanCollections = collections.filter(c => c.recommendation === 'clean');
  const archiveCollections = collections.filter(c => c.recommendation === 'archive');
  const keepCollections = collections.filter(c => c.recommendation === 'keep');
  
  if (deleteCollections.length > 0) {
    console.log('🗑️ COLLECTIONS TO DELETE:\n');
    deleteCollections.forEach(c => {
      console.log(`  ${c.name}:`);
      console.log(`    Documents: ${c.count}`);
      console.log(`    Purpose: ${c.purpose}`);
      console.log(`    Last activity: ${c.sampleAge}`);
    });
  }
  
  if (cleanCollections.length > 0) {
    console.log('\n🧹 COLLECTIONS TO CLEAN (remove old data):\n');
    cleanCollections.forEach(c => {
      console.log(`  ${c.name}:`);
      console.log(`    Documents: ${c.count}`);
      console.log(`    Purpose: ${c.purpose}`);
      console.log(`    Last activity: ${c.sampleAge}`);
    });
  }
  
  if (archiveCollections.length > 0) {
    console.log('\n📦 COLLECTIONS TO ARCHIVE:\n');
    archiveCollections.forEach(c => {
      console.log(`  ${c.name}:`);
      console.log(`    Documents: ${c.count}`);
      console.log(`    Purpose: ${c.purpose}`);
    });
  }
  
  // Calculate storage impact
  const totalToDelete = deleteCollections.reduce((sum, c) => sum + c.count, 0);
  const totalToClean = cleanCollections.reduce((sum, c) => sum + c.count, 0);
  
  console.log('\n📊 ESTIMATED STORAGE IMPACT:\n');
  console.log(`  Documents to delete: ${totalToDelete.toLocaleString()}`);
  console.log(`  Documents to clean: ${totalToClean.toLocaleString()} (partial)`);
  console.log(`  Estimated storage saved: ~${((totalToDelete + totalToClean * 0.5) * 0.001).toFixed(1)} MB`);
  
  // Specific property cleanup analysis
  console.log('\n🏠 PROPERTY COLLECTION ANALYSIS:\n');
  
  const [activeProps, inactiveProps, soldProps, oldProps] = await Promise.all([
    db.collection('properties').where('isActive', '==', true).count().get(),
    db.collection('properties').where('isActive', '==', false).count().get(),
    db.collection('properties').where('homeStatus', 'in', ['SOLD', 'RECENTLY_SOLD', 'OFF_MARKET']).count().get(),
    db.collection('properties')
      .where('lastScrapedAt', '<', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
      .count().get()
  ]);
  
  console.log(`  Total properties: ${activeProps.data().count + inactiveProps.data().count}`);
  console.log(`  Active: ${activeProps.data().count}`);
  console.log(`  Inactive: ${inactiveProps.data().count}`);
  console.log(`  Sold/Off-market: ${soldProps.data().count} (can be deleted)`);
  console.log(`  Not scraped in 90+ days: ${oldProps.data().count} (can be archived)`);
  
  process.exit(0);
}

analyzeFirebaseStorage().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});