const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
async function main() {
  const { db } = getFirebaseAdmin();
  const id = 'N5EceS3SOwvDK3oj6grL';
  const d = await db.collection('agent_outreach_queue').doc(id).get();
  console.log(`agent_outreach_queue/${id}:`, d.exists ? 'EXISTS' : 'NOT FOUND');
  if (d.exists) {
    const x: any = d.data();
    console.log('  status:', x.status);
    console.log('  zpid:', x.zpid);
    console.log('  address:', x.address);
    console.log('  phoneNormalized:', x.phoneNormalized);
    console.log('  sentToGHLAt:', x.sentToGHLAt?.toDate?.()?.toISOString());
    console.log('  source:', x.source);
    console.log('  agentResponse:', x.agentResponse);
    console.log('  agentResponseAt:', x.agentResponseAt?.toDate?.()?.toISOString());
  }
}
main().catch(e => { console.error(e); process.exit(1); });
