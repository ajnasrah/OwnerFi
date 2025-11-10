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

async function verifyDashboard() {
  console.log('✅ DASHBOARD NUMBER VERIFICATION\n');
  console.log('='.repeat(80));

  // Get October 2025 data (what the dashboard should be showing)
  const monthlyCosts = await db.collection('monthly_costs')
    .where('month', '==', '2025-10')
    .get();

  let totalCost = 0;
  let totalSubmagicVideos = 0;
  let totalHeygenVideos = 0;
  let totalLatePosts = 0;

  console.log('\n📊 EXPECTED DASHBOARD NUMBERS (October 2025):\n');

  monthlyCosts.forEach(doc => {
    const data = doc.data();
    totalCost += data.total || 0;
    totalSubmagicVideos += data.submagic?.units || 0;
    totalHeygenVideos += data.heygen?.units || 0;
    totalLatePosts += data.late?.units || 0;

    console.log(`${data.brand.toUpperCase()}:`);
    console.log(`  Total: $${(data.total || 0).toFixed(2)}`);
    console.log(`  Submagic Videos: ${data.submagic?.units || 0}`);
  });

  const totalVideos = totalSubmagicVideos + totalHeygenVideos;
  const costPerVideo = totalVideos > 0 ? totalCost / totalVideos : 0;

  console.log('\n' + '='.repeat(80));
  console.log('\n🎯 EXPECTED DASHBOARD VALUES:\n');
  console.log(`October 2025 Total:       $${totalCost.toFixed(2)}`);
  console.log(`Total Videos Produced:    ${totalVideos}`);
  console.log(`  - Submagic:             ${totalSubmagicVideos}`);
  console.log(`  - HeyGen:               ${totalHeygenVideos}`);
  console.log(`Cost Per Video:           $${costPerVideo.toFixed(2)}`);
  console.log(`Posts Published:          ${totalLatePosts}`);

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ VERIFICATION CHECKLIST:\n');
  console.log('When you view the dashboard at http://localhost:3000/admin/costs\n');
  console.log(`☐ "October 2025" card shows: $${totalCost.toFixed(2)}`);
  console.log(`☐ "Cost Per Video (All Services)" shows: $${costPerVideo.toFixed(2)}`);
  console.log(`☐ "Total Videos Produced" shows: ${totalVideos}`);
  console.log(`☐ "Posts Published" shows: ${totalLatePosts}`);
  console.log(`☐ "Monthly Cost by Service" > Submagic shows: $${(totalSubmagicVideos * 1.27).toFixed(2)}`);

  console.log('\n' + '='.repeat(80));
  console.log('\n📝 CALCULATION METHOD:\n');
  console.log(`Cost Per Video = Total Spend ÷ Total Videos`);
  console.log(`              = $${totalCost.toFixed(2)} ÷ ${totalVideos}`);
  console.log(`              = $${costPerVideo.toFixed(2)}`);
  console.log('\nThis includes ALL costs: HeyGen, Submagic, OpenAI, R2, Late');
  console.log('Videos are counted from actual Submagic + HeyGen API usage');

  console.log('\n' + '='.repeat(80));

  await admin.app().delete();
}

verifyDashboard().catch(console.error);
