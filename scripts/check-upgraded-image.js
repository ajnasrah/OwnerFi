const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env.local') });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    })
  });
}

const db = admin.firestore();

async function checkImage() {
  const snapshot = await db.collection('properties')
    .where('address', '==', '19820 N 13th Ave Unit 226')
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const prop = snapshot.docs[0].data();
    console.log('Property: 19820 N 13th Ave Unit 226, Phoenix, Az 85027');
    console.log('ImageURL:', prop.imageUrls?.[0] || 'none');
    console.log('');
    if (prop.imageUrls?.[0]?.includes('uncropped')) {
      console.log('✅ Image upgraded successfully to full-size!');
    } else if (prop.imageUrls?.[0]?.includes('p_c.jpg')) {
      console.log('❌ Still using thumbnail');
    } else {
      console.log('Image format:', prop.imageUrls?.[0]?.split('/').pop());
    }
  }
}

checkImage().then(() => process.exit(0));
