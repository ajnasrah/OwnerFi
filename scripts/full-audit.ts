// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { TARGETED_CASH_ZIPS } from '../src/lib/scraper-v2/search-config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Typesense = require('typesense');

const typesense = new Typesense.Client({
  nodes: [{ host: process.env.TYPESENSE_HOST || process.env.NEXT_PUBLIC_TYPESENSE_HOST, port: 443, protocol: 'https' }],
  apiKey: process.env.TYPESENSE_ADMIN_API_KEY || process.env.TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 10,
});

const ALLOWED = new Set(['FOR_SALE','FOR_AUCTION','FORECLOSURE','FORECLOSED','PRE_FORECLOSURE']);

async function main() {
  const { db } = getFirebaseAdmin();

  console.log('========== TARGETED ZIPS: FIRESTORE ==========');
  const chunks: string[][] = [];
  for (let i = 0; i < TARGETED_CASH_ZIPS.length; i += 30) chunks.push(TARGETED_CASH_ZIPS.slice(i, i + 30));

  let totalInZips = 0, activeForSale = 0, ofFlagged = 0, cashFlagged = 0, sentToGHL = 0;
  const statusCount: Record<string, number> = {};
  for (const chunk of chunks) {
    const snap = await db.collection('properties').where('zipCode','in',chunk).get();
    snap.forEach(doc => {
      totalInZips++;
      const d = doc.data();
      const hs = String(d.homeStatus || '').toUpperCase();
      statusCount[hs || '(empty)'] = (statusCount[hs || '(empty)'] || 0) + 1;
      if (d.isActive !== false && ALLOWED.has(hs)) activeForSale++;
      if (d.isOwnerfinance) ofFlagged++;
      if (d.isCashDeal) cashFlagged++;
      if (d.sentToGHL) sentToGHL++;
    });
  }
  console.log(`Total in 59 zips: ${totalInZips}`);
  console.log('By homeStatus:');
  Object.entries(statusCount).sort((a,b)=>b[1]-a[1]).forEach(([s,c])=>console.log(`  ${s}: ${c}`));
  console.log(`Active + for-sale:    ${activeForSale}`);
  console.log(`isOwnerfinance=true:  ${ofFlagged}`);
  console.log(`isCashDeal=true:      ${cashFlagged}`);
  console.log(`sentToGHL=true:       ${sentToGHL}`);

  console.log('\n========== TARGETED ZIPS: TYPESENSE ==========');
  // Check each zip in Typesense
  const tsByZip: Record<string, number> = {};
  for (const z of TARGETED_CASH_ZIPS) {
    try {
      const r = await typesense.collections('properties').documents().search({
        q: '*', filter_by: `zipCode:=${z}`, per_page: 0,
      });
      if (r.found > 0) tsByZip[z] = r.found;
    } catch {}
  }
  const tsTotal = Object.values(tsByZip).reduce((a,b)=>a+b, 0);
  console.log(`Total in Typesense (59 zips): ${tsTotal}`);
  Object.entries(tsByZip).sort((a,b)=>b[1]-a[1]).slice(0, 15).forEach(([z,c])=>console.log(`  ${z}: ${c}`));

  // Sanity: any sold/pending leaked into Typesense?
  try {
    const sold = await typesense.collections('properties').documents().search({
      q: '*', filter_by: `status:=sold || status:=pending`, per_page: 0,
    });
    console.log(`\nTypesense docs w/ status=sold|pending: ${sold.found}`);
  } catch {}

  console.log('\n========== AGENT RESPONSES (LAST 24H) ==========');
  const since = new Date(Date.now() - 24*60*60*1000);
  const yes = await db.collection('properties').where('agentConfirmedAt','>=',since).get();
  const queue = await db.collection('agent_outreach_queue').where('agentResponseAt','>=',since).get();
  const queueYES = queue.docs.filter(d=>d.data().status==='agent_yes').length;
  const queueNO  = queue.docs.filter(d=>d.data().status==='agent_no').length;
  console.log(`Properties agentConfirmedAt (24h):  ${yes.size}`);
  console.log(`Queue agentResponseAt (24h) YES: ${queueYES}  NO: ${queueNO}`);

  console.log('\n========== DEDUPE COVERAGE ==========');
  // How many of the blasted zips have a Firestore doc that will block tomorrow's cron re-send
  let inDBFromBlast = 0;
  for (const chunk of chunks) {
    const snap = await db.collection('properties')
      .where('zipCode','in',chunk)
      .where('backfillSource','==','one-off-blast')
      .get();
    inDBFromBlast += snap.size;
  }
  console.log(`Firestore docs w/ backfillSource='one-off-blast': ${inDBFromBlast}`);
}

main().catch(e => { console.error(e); process.exit(1); });
