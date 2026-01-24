import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

// All synced property IDs
const propertyIds = [
  'zpid_340945', 'zpid_81070451', 'zpid_446666157', 'zpid_42145694',
  'zpid_42196001', 'zpid_42225442', 'zpid_79783662', 'zpid_35734753',
  'zpid_455212883', 'zpid_41811854', 'zpid_362271', 'zpid_63255689',
  'zpid_314021', 'zpid_72449648', 'zpid_42212613', 'zpid_42230119',
  'zpid_42322966', 'zpid_355248', 'zpid_89278865', 'zpid_94725291',
  'zpid_42130008', 'zpid_55302375', 'zpid_42323347', 'zpid_273802',
  'zpid_2064449382', 'zpid_458697011', 'zpid_2064459952', 'zpid_279654',
  'zpid_42155191', 'zpid_316168', 'zpid_41812416', 'zpid_2098195913',
  'zpid_458491460', 'zpid_76144132', 'zpid_68520892', 'zpid_89267669',
  'zpid_42212183', 'zpid_324577',
];

async function main() {
  console.log('Fixing missing fields on interested properties...\n');

  let fixed = 0;
  let alreadyCorrect = 0;

  for (const propId of propertyIds) {
    const doc = await db.collection('properties').doc(propId).get();

    if (!doc.exists) {
      console.log(`✗ ${propId}: Not found`);
      continue;
    }

    const data = doc.data()!;
    const needsFix = !data.status || data.status !== 'active' ||
                     !data.dealType || data.dealType !== 'owner_finance';

    if (needsFix) {
      await db.collection('properties').doc(propId).update({
        status: 'active',
        dealType: 'owner_finance',
        ownerFinanceVerified: true,
        isActive: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`✓ Fixed: ${propId} - ${data.address}`);
      fixed++;
    } else {
      alreadyCorrect++;
    }
  }

  console.log(`\nFixed: ${fixed}`);
  console.log(`Already correct: ${alreadyCorrect}`);

  // Verify counts
  console.log('\n--- Verification ---');

  const ownerFinanceCount = await db.collection('properties')
    .where('dealType', '==', 'owner_finance')
    .where('isActive', '==', true)
    .where('status', '==', 'active')
    .count()
    .get();

  console.log(`\nProperties with dealType=owner_finance, isActive=true, status=active: ${ownerFinanceCount.data().count}`);
}

main()
  .then(() => {
    console.log('\nFix complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
