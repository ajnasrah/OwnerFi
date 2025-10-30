const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function getCosts() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  console.log('📊 COMPLETE COST REPORT - Last 30 Days\n');
  console.log('Period:', thirtyDaysAgo.toLocaleDateString(), 'to', now.toLocaleDateString());
  console.log('='.repeat(80));

  // Get ALL cost entries (no index needed)
  const entries = await db.collection('cost_entries').get();

  console.log(`\nTotal Cost Entries in DB: ${entries.size}`);

  const brands = {
    ownerfi: { heygen: 0, submagic: 0, late: 0, openai: 0, r2: 0, total: 0 },
    carz: { heygen: 0, submagic: 0, late: 0, openai: 0, r2: 0, total: 0 },
    vassdistro: { heygen: 0, submagic: 0, late: 0, openai: 0, r2: 0, total: 0 },
    podcast: { heygen: 0, submagic: 0, late: 0, openai: 0, r2: 0, total: 0 },
    benefit: { heygen: 0, submagic: 0, late: 0, openai: 0, r2: 0, total: 0 },
  };

  let filtered = 0;

  entries.forEach(doc => {
    const data = doc.data();
    const timestamp = data.timestamp;
    const brand = data.brand;
    const service = data.service;
    const cost = data.costUSD || 0;

    // Filter to last 30 days
    if (timestamp >= thirtyDaysAgo.getTime()) {
      filtered++;
      if (brands[brand] && brands[brand][service] !== undefined) {
        brands[brand][service] += cost;
        brands[brand].total += cost;
      }
    }
  });

  console.log(`Entries in last 30 days: ${filtered}\n`);
  console.log('='.repeat(80));

  let grandTotal = 0;

  Object.entries(brands).forEach(([brand, services]) => {
    const brandName = brand.toUpperCase();
    console.log(`\n🏢 ${brandName}`);
    console.log('-'.repeat(40));
    console.log(`  HeyGen:   $${services.heygen.toFixed(2)}`);
    console.log(`  Submagic: $${services.submagic.toFixed(2)}`);
    console.log(`  Late:     $${services.late.toFixed(2)}`);
    console.log(`  OpenAI:   $${services.openai.toFixed(2)}`);
    console.log(`  R2:       $${services.r2.toFixed(2)}`);
    console.log(`  --------`);
    console.log(`  TOTAL:    $${services.total.toFixed(2)}`);
    grandTotal += services.total;
  });

  console.log('\n' + '='.repeat(80));
  console.log(`💰 GRAND TOTAL (ALL BRANDS, 30 days): $${grandTotal.toFixed(2)}`);
  console.log('='.repeat(80));

  await admin.app().delete();
}

getCosts().catch(console.error);
