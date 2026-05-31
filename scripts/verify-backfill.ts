import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

async function verifyBackfill() {
  const { db } = getFirebaseAdmin();
  
  console.log('=== VERIFYING BACKFILL RESULTS ===\n');
  
  // Check total owner finance properties
  const totalOF = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .count()
    .get();
  
  console.log('Total owner finance properties in database:', totalOF.data().count);
  
  // Check recent owner finance (without compound index)
  const recentOF = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();
  
  console.log(`\nMost recent owner finance properties: ${recentOF.size}`);
  
  if (recentOF.size > 0) {
    console.log('\nSample properties added/updated:');
    recentOF.docs.slice(0, 5).forEach(doc => {
      const data = doc.data();
      console.log(`- ${data.fullAddress} ($${data.price?.toLocaleString()})`);
      console.log(`  Source: ${data.source} | ZPID: ${data.zpid}`);
    });
  }
  
  // Check backfill source
  const backfillProps = await db.collection('properties')
    .where('source', '==', 'backfill')
    .count()
    .get();
  
  console.log(`\nTotal properties with source='backfill': ${backfillProps.data().count}`);
  
  // Sample backfill property
  const sampleBackfill = await db.collection('properties')
    .where('source', '==', 'backfill')
    .limit(1)
    .get();
  
  if (!sampleBackfill.empty) {
    const data = sampleBackfill.docs[0].data();
    console.log('\nSample backfill property:');
    console.log(`- ${data.fullAddress}`);
    console.log(`  Filters: OF=${data.isOwnerFinance}, Cash=${data.isCashDeal}`);
  }
}

verifyBackfill().catch(console.error);