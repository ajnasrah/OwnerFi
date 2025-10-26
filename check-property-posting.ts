import { getAdminDb } from './src/lib/firebase-admin';

async function checkPropertyVideos() {
  const db = await getAdminDb() as any;

  if (!db) {
    console.error('Failed to initialize Firebase Admin');
    process.exit(1);
  }

  const snapshot = await db
    .collection('property_videos')
    .where('status', '==', 'posting')
    .limit(10)
    .get();

  console.log('Property videos in posting status:', snapshot.size);
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log('ID:', doc.id);
    console.log('  Address:', data.title || data.address);
    console.log('  Status:', data.status);
    console.log('  HeyGen ID:', data.heygenVideoId);
    console.log('  Submagic ID:', data.submagicProjectId);
    console.log('  Final Video URL:', data.finalVideoUrl ? 'Yes' : 'No');
    console.log('  Updated:', new Date(data.updatedAt || 0).toLocaleString());
    console.log('  Status Changed:', new Date(data.statusChangedAt || 0).toLocaleString());
    console.log('');
  });

  process.exit(0);
}

checkPropertyVideos();
