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

async function main() {
  const snap = await db.collection('properties')
    .where('isActive', '==', true)
    .where('isOwnerfinance', '==', true)
    .get();

  console.log(`Active + isOwnerfinance=true: ${snap.size}`);

  const hidden: any[] = [];
  const bucketed = { over100: 0, over120: 0, over150: 0, over200: 0 };

  for (const doc of snap.docs) {
    const d = doc.data();
    const listPrice = d.listPrice || d.price || 0;
    const zest = d.zestimate || d.estimate || 0;
    if (!listPrice || !zest) continue;
    const pct = (listPrice / zest) * 100;
    if (pct <= 100) continue;

    hidden.push({
      id: doc.id, address: d.address, city: d.city, state: d.state,
      listPrice, zestimate: zest, percentOfArv: Math.round(pct * 10) / 10,
      source: d.source, agentConfirmed: d.agentConfirmedOwnerfinance
    });

    if (pct > 200) bucketed.over200++;
    else if (pct > 150) bucketed.over150++;
    else if (pct > 120) bucketed.over120++;
    else bucketed.over100++;
  }

  hidden.sort((a, b) => b.percentOfArv - a.percentOfArv);

  console.log(`\nActive OF hidden by ARV filter (listPrice > Zestimate): ${hidden.length}\n`);
  console.log('By percentOfArv bucket:');
  console.log(`  100-120%: ${bucketed.over100}`);
  console.log(`  120-150%: ${bucketed.over120}`);
  console.log(`  150-200%: ${bucketed.over150}`);
  console.log(`  >200%:    ${bucketed.over200}`);

  console.log(`\nAgent-confirmed among hidden: ${hidden.filter(h => h.agentConfirmed).length}`);
  console.log(`agent_outreach source among hidden: ${hidden.filter(h => h.source === 'agent_outreach').length}`);

  console.log('\nTop 20 worst (highest %ARV):');
  hidden.slice(0, 20).forEach(h =>
    console.log(`  ${h.percentOfArv}% | ${h.address}, ${h.city} ${h.state} | $${h.listPrice.toLocaleString()} list / $${h.zestimate.toLocaleString()} zest | src=${h.source}${h.agentConfirmed ? ' ✓agent' : ''}`)
  );
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
