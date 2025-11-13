/**
 * Check HeyGen video status for stuck workflows
 */
import { db } from '../src/lib/firebase';
import { collection, getDocs, query, where, limit as firestoreLimit } from 'firebase/firestore';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

async function checkHeyGenVideos() {
  const brands = ['ownerfi', 'carz', 'vassdistro', 'benefit', 'property', 'abdullah', 'personal'];

  console.log('\n🔍 Checking HeyGen video statuses...\n');

  for (const brand of brands) {
    const collectionName = `${brand}_workflow_queue`;

    try {
      const q = query(
        collection(db, collectionName),
        where('status', '==', 'heygen_processing'),
        firestoreLimit(10)
      );

      const snapshot = await getDocs(q);

      if (snapshot.size === 0) continue;

      const brandUpper = brand.toUpperCase();
      console.log(`\n📂 ${brandUpper} (${snapshot.size} videos):`);
      console.log('━'.repeat(80));

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const videoId = data.heygenVideoId;

        if (!videoId) {
          console.log(`\n❌ ${doc.id}: No HeyGen video ID`);
          continue;
        }

        try {
          const response = await fetch(
            `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
            { headers: { 'x-api-key': HEYGEN_API_KEY! } }
          );

          if (!response.ok) {
            console.log(`\n⚠️  ${doc.id}: API error ${response.status}`);
            continue;
          }

          const heygenData = await response.json();
          const status = heygenData.data?.status;
          const videoUrl = heygenData.data?.video_url;
          const createdAt = data.createdAt ? new Date(data.createdAt).toLocaleString() : 'unknown';
          const ageMinutes = data.createdAt ? Math.round((Date.now() - data.createdAt) / 60000) : 0;

          console.log(`\n📹 ${doc.id}`);
          console.log(`   HeyGen ID: ${videoId}`);
          console.log(`   Status: ${status}`);
          console.log(`   Has URL: ${!!videoUrl}`);
          console.log(`   Created: ${createdAt} (${ageMinutes}min ago)`);
          console.log(`   Article: ${data.articleTitle || data.title || 'N/A'}`);

        } catch (error) {
          console.log(`\n❌ ${doc.id}: Error checking status`);
          console.error(error);
        }
      }
    } catch (error) {
      console.error(`\n❌ Error querying ${brand}:`, error);
    }
  }
}

checkHeyGenVideos().catch(console.error);
