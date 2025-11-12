import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

async function checkQueue() {
  const slug = 'austin-tx-is-america-s-strongest-buyer-s-market-with-over-twice-as-many-home-sellers-as-buyers';

  console.log(`🔍 Checking queue for: ${slug}\n`);

  // Check property_rotation_queue
  const queueSnapshot = await db.collection('property_rotation_queue')
    .where('propertySlug', '==', slug)
    .get();

  if (!queueSnapshot.empty) {
    console.log(`✅ Found ${queueSnapshot.size} queue entry(ies):\n`);
    queueSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`📋 Queue entry: ${doc.id}`);
      console.log(JSON.stringify(data, null, 2));
      console.log('\n📊 Analysis:');
      console.log(`   Status: ${data.status}`);
      console.log(`   Brand: ${data.brand}`);
      console.log(`   Priority: ${data.priority}`);
      console.log(`   Created: ${data.createdAt ? new Date(data.createdAt).toISOString() : 'Unknown'}`);
      console.log(`   Scheduled for: ${data.scheduledFor ? new Date(data.scheduledFor).toISOString() : 'Unknown'}`);
      console.log(`   Last attempted: ${data.lastAttemptedAt ? new Date(data.lastAttemptedAt).toISOString() : 'Never'}`);
      console.log(`   Retry count: ${data.retryCount || 0}`);
      if (data.error) {
        console.log(`   Error: ${data.error}`);
      }
    });
  } else {
    console.log('❌ No queue entries found');
  }

  // Check if there's an article with this slug
  console.log('\n📰 Checking articles collection...');
  const articleSnapshot = await db.collection('articles')
    .where('slug', '==', slug)
    .get();

  if (!articleSnapshot.empty) {
    console.log(`✅ Found ${articleSnapshot.size} article(s):\n`);
    articleSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`📄 Article: ${doc.id}`);
      console.log(`   Title: ${data.title}`);
      console.log(`   Feed: ${data.feedSlug}`);
      console.log(`   Published: ${data.publishedAt ? new Date(data.publishedAt).toISOString() : 'Unknown'}`);
    });
  } else {
    console.log('❌ No articles found');
  }

  console.log('\n💡 POSSIBLE CAUSES:');
  console.log('   1. This might be a feed article that hasn\'t been converted to a property');
  console.log('   2. The queue entry might exist but the workflow was never triggered');
  console.log('   3. The property creation failed silently');
  console.log('   4. This might be displayed in a UI that\'s pulling from a different source');
}

checkQueue().catch(console.error);
