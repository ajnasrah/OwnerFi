import { getAdminDb } from '../src/lib/firebase-admin';

async function checkYouTubePosts() {
  console.log('=== Checking YouTube Posts (Last 7 days) ===\n');

  const db = await getAdminDb();
  if (!db) {
    console.error('❌ Failed to initialize Firebase Admin');
    return;
  }

  const brands = [
    { name: 'ownerfi', collection: 'ownerfi_workflow_queue' },
    { name: 'carz', collection: 'carz_workflow_queue' },
    { name: 'abdullah', collection: 'abdullah_workflow_queue' }
  ];

  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  for (const brand of brands) {
    console.log(`\n${brand.name.toUpperCase()}:`);
    try {
      const snapshot = await db.collection(brand.collection)
        .where('status', '==', 'completed')
        .where('createdAt', '>=', sevenDaysAgo)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      if (snapshot.empty) {
        console.log('  No completed workflows in last 7 days');
        continue;
      }

      console.log(`  Found ${snapshot.size} completed workflows\n`);

      snapshot.forEach(doc => {
        const data = doc.data();
        const date = data.completedAt ? new Date(data.completedAt).toLocaleString() : 'unknown';

        console.log(`  Workflow: ${doc.id}`);
        console.log(`    Completed: ${date}`);
        console.log(`    Late Post ID: ${data.latePostId || 'N/A'}`);

        // Check for any YouTube-related data
        const hasYouTubeData =
          data.youtubeVideoId ||
          data.youtubeUrl ||
          data.latePostId?.includes('youtube') ||
          (data.platforms && data.platforms.includes('youtube'));

        console.log(`    YouTube Post: ${hasYouTubeData ? '✅ YES' : '❌ NO'}`);

        if (data.youtubeVideoId) {
          console.log(`    YouTube Video ID: ${data.youtubeVideoId}`);
        }
        if (data.youtubeUrl) {
          console.log(`    YouTube URL: ${data.youtubeUrl}`);
        }
        if (data.platforms) {
          console.log(`    Platforms: ${data.platforms.join(', ')}`);
        }
        console.log('');
      });
    } catch (e: any) {
      console.log(`  Error: ${e.message}`);
    }
  }

  console.log('\n=== Summary ===');
  console.log('If you see "YouTube Post: ❌ NO" for all workflows, that means');
  console.log('YouTube posts are not being created even though workflows complete.');
  console.log('\nPossible causes:');
  console.log('1. YouTube not in platforms list (already checked - it IS there)');
  console.log('2. YouTube credentials not loaded at runtime');
  console.log('3. YouTube upload silently failing without saving result');
  console.log('4. Late.dev handling YouTube instead of direct API');
}

checkYouTubePosts().catch(console.error);
