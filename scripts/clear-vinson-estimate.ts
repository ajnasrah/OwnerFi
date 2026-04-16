import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();
const DOC_ID = 'zpid_313810057';

async function main() {
  const ref = db.collection('properties').doc(DOC_ID);
  const snap = await ref.get();
  if (!snap.exists) { console.log('Doc not found'); return; }
  const before = snap.data() || {};

  console.log('BEFORE:');
  console.log('  estimate:', before.estimate);
  console.log('  eightyPercentOfZestimate:', before.eightyPercentOfZestimate);
  console.log('  discountPercentage:', before.discountPercentage);
  console.log('  isCashDeal:', before.isCashDeal);
  console.log('  dealTypes:', before.dealTypes);

  await ref.update({
    estimate: admin.firestore.FieldValue.delete(),
    eightyPercentOfZestimate: admin.firestore.FieldValue.delete(),
    discountPercentage: admin.firestore.FieldValue.delete(),
    isCashDeal: false,
    dealTypes: admin.firestore.FieldValue.arrayRemove('cash_deal'),
    estimateClearedAt: new Date(),
    estimateClearedReason: 'Zillow no longer publishes a Zestimate for this property',
  });

  const after = (await ref.get()).data() || {};
  console.log('\nAFTER:');
  console.log('  estimate:', after.estimate);
  console.log('  eightyPercentOfZestimate:', after.eightyPercentOfZestimate);
  console.log('  discountPercentage:', after.discountPercentage);
  console.log('  isCashDeal:', after.isCashDeal);
  console.log('  dealTypes:', after.dealTypes);

  // Sync to Typesense
  try {
    const Typesense = (await import('typesense')).default;
    const ts = new Typesense.Client({
      nodes: [{
        host: process.env.TYPESENSE_HOST!,
        port: parseInt(process.env.TYPESENSE_PORT || '443'),
        protocol: process.env.TYPESENSE_PROTOCOL || 'https',
      }],
      apiKey: process.env.TYPESENSE_ADMIN_API_KEY!,
      connectionTimeoutSeconds: 10,
    });
    await ts.collections('properties').documents(DOC_ID).update({
      estimate: 0,
      eightyPercentOfZestimate: 0,
      discountPercentage: 0,
      isCashDeal: false,
      dealTypes: (after.dealTypes || []).filter((t: string) => t !== 'cash_deal'),
    });
    console.log('\n✓ Typesense updated');
  } catch (e: any) {
    console.log('\n⚠ Typesense update failed:', e.message);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
