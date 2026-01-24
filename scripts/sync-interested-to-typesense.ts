import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { indexRawFirestoreProperty } from '../src/lib/typesense/sync';

dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

// The interested property IDs we just synced
const propertyIds = [
  'zpid_340945',      // 14 Evergreen Ct
  'zpid_81070451',    // 35 Whispering Creek Cv
  'zpid_446666157',   // 8004 Kim Dr
  'zpid_42145694',    // 2579 Hale Ave
  'zpid_42196001',    // 3130 Harris Ave
  'zpid_42225442',    // 4518 Suncrest Dr
  'zpid_79783662',    // 1401 N Pierce St #21
  'zpid_35734753',    // 2104 Huntleigh Ct
  'zpid_455212883',   // 1011 Lexington Loop
  'zpid_41811854',    // 32 Russell Rd
  'zpid_362271',      // 13324 Alexander Rd
  'zpid_63255689',    // 1915 Talisker Dr
  'zpid_314021',      // 2501 S Pine St
  'zpid_72449648',    // 896 Orphanage Ave
  'zpid_42212613',    // 4903 Quince Rd
  'zpid_42230119',    // 2662 Orman Ave
  'zpid_42322966',    // 5550 Angelace Dr S
  'zpid_355248',      // 35 N Meadowcliff Dr
  'zpid_89278865',    // 4254 Rosebury Ln
  'zpid_94725291',    // 3520 Central Ave APT 207
  'zpid_42130008',    // 32 N Belvedere Blvd APT 10
  'zpid_55302375',    // 377 Fountain Lake Dr
  'zpid_42323347',    // 4355 Cleopatra Rd
  'zpid_273802',      // 3 Dunfrettin Pl
  'zpid_2064449382',  // 6905 Petworth Rd #6905
  'zpid_458697011',   // 7325 Knollwood Dr
  'zpid_2064459952',  // 4729 Wild Plum Ct #112
  'zpid_279654',      // 5908 Glenhaven Pl
  'zpid_42155191',    // 1234 Smith Ave
  'zpid_316168',      // 2217 Scott St
  'zpid_41812416',    // 124 Glendale St
  'zpid_2098195913',  // 300 E 3rd St APT 503
  'zpid_458491460',   // 620 Williams Ave
  'zpid_76144132',    // 207 Ross Ave
  'zpid_68520892',    // 1802 N Houston Levee Rd
  'zpid_89267669',    // 2864 Summer Oaks Pl
  'zpid_42212183',    // 4843 Verne Rd
  'zpid_324577',      // 14 Quail Creek Ct
];

async function main() {
  console.log('========================================');
  console.log('SYNCING INTERESTED PROPERTIES TO TYPESENSE');
  console.log('========================================\n');

  let success = 0;
  let failed = 0;

  for (const propId of propertyIds) {
    try {
      const doc = await db.collection('properties').doc(propId).get();

      if (!doc.exists) {
        console.log(`✗ ${propId}: Not found in properties`);
        failed++;
        continue;
      }

      const data = doc.data()!;

      await indexRawFirestoreProperty(propId, data, 'properties');
      console.log(`✓ ${propId}: ${data.address}, ${data.city} - indexed`);
      success++;

    } catch (error) {
      console.log(`✗ ${propId}: ${(error as Error).message}`);
      failed++;
    }
  }

  console.log('\n========================================');
  console.log('TYPESENSE SYNC SUMMARY');
  console.log('========================================\n');

  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
}

main()
  .then(() => {
    console.log('\nSync complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
