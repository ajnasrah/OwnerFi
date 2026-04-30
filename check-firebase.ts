import { getFirebaseAdmin } from './src/lib/scraper-v2/firebase-admin';

async function checkFirebase() {
  try {
    const { db } = getFirebaseAdmin();
    
    console.log('Checking Firebase properties collection...');
    
    // Get properties with recent timestamps (likely from today's run)
    const today = new Date().toISOString().split('T')[0];
    console.log('Looking for properties from:', today);
    
    const snapshot = await db.collection('properties')
      .where('scrapedAt', '>=', today + 'T00:00:00.000Z')
      .orderBy('scrapedAt', 'desc')
      .limit(20)
      .get();
    
    console.log(`Found ${snapshot.size} recent properties`);
    
    if (snapshot.size > 0) {
      console.log('\nRecent properties:');
      snapshot.docs.forEach((doc, i) => {
        const data = doc.data();
        console.log(`${i+1}. ZPID: ${data.zpid} | ${data.address || 'No address'} | Scraped: ${data.scrapedAt}`);
      });
    }
    
    // Count total properties to see current database size
    const totalSnapshot = await db.collection('properties').count().get();
    console.log(`\nTotal properties in database: ${totalSnapshot.data().count}`);
    
    // Check for properties from target zip codes
    const targetZips = ['38118', '38128', '38134', '38115', '38116', '38125', '38127']; // Memphis zips
    
    console.log('\nChecking target zip codes:');
    for (const zip of targetZips.slice(0, 3)) { // Check first 3 zips
      const zipSnapshot = await db.collection('properties')
        .where('zipCode', '==', zip)
        .count()
        .get();
      console.log(`  ${zip}: ${zipSnapshot.data().count} properties`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkFirebase();