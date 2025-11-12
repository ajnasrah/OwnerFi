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

async function checkWorkflow() {
  const slug = 'austin-tx-is-america-s-strongest-buyer-s-market-with-over-twice-as-many-home-sellers-as-buyers';

  console.log(`🔍 Investigating stuck pending workflow: ${slug}\n`);

  // Check workflows collection
  const workflowRef = db.collection('workflows').doc(slug);
  const workflowDoc = await workflowRef.get();

  if (workflowDoc.exists) {
    const data = workflowDoc.data();
    console.log('📄 Workflow document:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n📊 Workflow Analysis:');
    console.log(`   Status: ${data?.status}`);
    console.log(`   Created: ${data?.createdAt ? new Date(data.createdAt).toISOString() : 'Unknown'}`);
    console.log(`   Updated: ${data?.updatedAt ? new Date(data.updatedAt).toISOString() : 'Unknown'}`);
  } else {
    console.log('❌ No workflow document found');
  }

  // Check circuit breaker
  console.log('\n🔧 Checking circuit breaker...');
  const circuitBreakerRef = db.collection('circuit_breaker').doc(slug);
  const circuitBreakerDoc = await circuitBreakerRef.get();

  if (circuitBreakerDoc.exists) {
    const data = circuitBreakerDoc.data();
    console.log('⚠️  Circuit breaker document found:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n📊 Circuit Breaker Analysis:');
    console.log(`   Status: ${data?.status}`);
    console.log(`   Failure count: ${data?.failureCount || 0}`);
    console.log(`   Last failure: ${data?.lastFailure ? new Date(data.lastFailure).toISOString() : 'None'}`);
    console.log(`   Error: ${data?.error || 'None'}`);
  } else {
    console.log('✅ No circuit breaker document found');
  }

  // Check property_videos collection
  console.log('\n📹 Checking property_videos collection...');
  const propertyVideosSnapshot = await db.collection('property_videos')
    .where('propertySlug', '==', slug)
    .get();

  if (!propertyVideosSnapshot.empty) {
    console.log(`Found ${propertyVideosSnapshot.size} property_videos document(s):`);
    propertyVideosSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\n   Document ID: ${doc.id}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Brand: ${data.brand}`);
      console.log(`   Has finalVideoUrl: ${!!data.finalVideoUrl}`);
      console.log(`   Has latePostId: ${!!data.latePostId}`);
      console.log(`   Created: ${data.createdAt ? new Date(data.createdAt).toISOString() : 'Unknown'}`);
    });
  } else {
    console.log('❌ No property_videos documents found');
  }

  // Check properties collection
  console.log('\n🏠 Checking properties collection...');
  const propertyRef = db.collection('properties').doc(slug);
  const propertyDoc = await propertyRef.get();

  if (propertyDoc.exists) {
    const data = propertyDoc.data();
    console.log('✅ Property document found:');
    console.log(`   Title: ${data?.title}`);
    console.log(`   Address: ${data?.address}`);
    console.log(`   Exported to DB: ${data?.exportedToDatabase || false}`);
  } else {
    console.log('❌ No property document found');
  }

  console.log('\n💡 DIAGNOSIS:');
  console.log('   A workflow stuck in "pending" status typically means:');
  console.log('   1. The workflow was created but never started');
  console.log('   2. There may be a circuit breaker preventing it from running');
  console.log('   3. The initial trigger failed or was never called');
  console.log('   4. The queue system didn\'t pick it up');
}

checkWorkflow().catch(console.error);
