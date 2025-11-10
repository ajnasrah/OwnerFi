const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      clientEmail,
    })
  });
}

const db = admin.firestore();

async function checkProperty() {
  const snapshot = await db.collection('properties')
    .where('address', '==', '13996 Godbold Rd')
    .get();

  if (snapshot.empty) {
    console.log('❌ Property not found with address: 13996 Godbold Rd');
    process.exit(1);
  }

  console.log('Found property:\n');
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log('Property ID:', doc.id);
    console.log('Address:', data.address);
    console.log('City:', data.city);
    console.log('State:', data.state);
    console.log('\nImage Data:');
    console.log('  imageUrl:', data.imageUrl || 'NOT SET');
    console.log('  imageUrls:', data.imageUrls || 'NOT SET');
    console.log('\nFull imageUrls:', JSON.stringify(data.imageUrls, null, 2));
  });

  process.exit(0);
}

checkProperty().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
