/**
 * For each "Interested" CSV row, check if we can resolve the property by zpid
 * from the queue. Show where the zpid lookup fails and whether an address
 * lookup would succeed.
 */
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

function normalizeAddr(addr: string): string {
  return String(addr || '').toLowerCase().trim().replace(/[#,\.]/g, '').replace(/\s+/g, ' ');
}

async function main() {
  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities (3).csv';
  const rows: any[] = parse(fs.readFileSync(csvPath), {
    columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true
  });

  const interested = rows.filter(r => String(r.stage || '').trim().toLowerCase() === 'interested');
  console.log(`CSV "Interested" rows: ${interested.length}\n`);

  const stats = {
    queueHasZpid_propertyExists: 0,
    queueHasZpid_propertyMissing_butAddrMatches: 0,
    queueHasZpid_propertyMissing_andAddrMissing: 0,
    queueMissingZpid_addrMatches: 0,
    queueMissingZpid_addrMissing: 0,
    queueDocMissing: 0,
    noFirebaseId: 0,
  };

  const fallbackWins: any[] = []; // cases where address fallback would have saved us

  for (const row of interested) {
    const firebaseId = row.firebase_id?.trim();
    const csvAddr = row['Property Address']?.trim();
    const csvCity = row['Property city']?.trim();
    const csvState = row['State ']?.trim();

    if (!firebaseId) { stats.noFirebaseId++; continue; }

    const qDoc = await db.collection('agent_outreach_queue').doc(firebaseId).get();
    if (!qDoc.exists) { stats.queueDocMissing++; continue; }
    const q = qDoc.data()!;
    const zpid = q.zpid;

    // Try zpid lookup
    let propDoc: any = null;
    if (zpid) {
      const p = await db.collection('properties').doc(`zpid_${zpid}`).get();
      if (p.exists) propDoc = { id: p.id, data: p.data() };
    }

    // Try address lookup (city+state+address)
    let addrMatch: any = null;
    if (!propDoc && csvCity && csvState) {
      const snap = await db.collection('properties')
        .where('city', '==', csvCity).where('state', '==', csvState).get();
      const targetAddr = normalizeAddr(csvAddr);
      for (const d of snap.docs) {
        const dAddr = normalizeAddr(d.data().address || d.data().streetAddress || '');
        if (dAddr === targetAddr) { addrMatch = { id: d.id, data: d.data() }; break; }
      }
    }

    if (zpid && propDoc) stats.queueHasZpid_propertyExists++;
    else if (zpid && !propDoc && addrMatch) {
      stats.queueHasZpid_propertyMissing_butAddrMatches++;
      fallbackWins.push({ firebaseId, csvAddr, queueZpid: zpid, foundDocId: addrMatch.id, foundZpid: addrMatch.data.zpid });
    }
    else if (zpid && !propDoc && !addrMatch) stats.queueHasZpid_propertyMissing_andAddrMissing++;
    else if (!zpid && addrMatch) {
      stats.queueMissingZpid_addrMatches++;
      fallbackWins.push({ firebaseId, csvAddr, queueZpid: null, foundDocId: addrMatch.id, foundZpid: addrMatch.data.zpid });
    }
    else if (!zpid && !addrMatch) stats.queueMissingZpid_addrMissing++;
  }

  console.log(`=== ZPID LOOKUP ANALYSIS ===`);
  console.log(`✅ zpid found + property exists: ${stats.queueHasZpid_propertyExists}`);
  console.log(`🟡 zpid found but property missing, BUT address fallback would find it: ${stats.queueHasZpid_propertyMissing_butAddrMatches}`);
  console.log(`❌ zpid found but property missing AND no address match: ${stats.queueHasZpid_propertyMissing_andAddrMissing}`);
  console.log(`🟡 zpid MISSING from queue, but address fallback would find: ${stats.queueMissingZpid_addrMatches}`);
  console.log(`❌ zpid missing AND no address match: ${stats.queueMissingZpid_addrMissing}`);
  console.log(`❓ queue doc missing: ${stats.queueDocMissing}`);
  console.log(`❓ no firebase_id in CSV: ${stats.noFirebaseId}`);

  const saved = stats.queueHasZpid_propertyMissing_butAddrMatches + stats.queueMissingZpid_addrMatches;
  console.log(`\n>>> Address-fallback would save ${saved} of ${interested.length} Interested rows <<<`);

  if (fallbackWins.length) {
    console.log(`\n=== CASES ADDRESS FALLBACK WOULD FIX ===`);
    fallbackWins.slice(0, 15).forEach(f =>
      console.log(`  ${f.firebaseId} | ${f.csvAddr} | queueZpid=${f.queueZpid || '(none)'} → found ${f.foundDocId} zpid=${f.foundZpid}`)
    );
    if (fallbackWins.length > 15) console.log(`  ...and ${fallbackWins.length - 15} more`);
    fs.writeFileSync('scripts/zpid-fallback-cases.json', JSON.stringify(fallbackWins, null, 2));
    console.log(`\n→ scripts/zpid-fallback-cases.json`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
