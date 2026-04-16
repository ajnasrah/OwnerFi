const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

async function main() {
  const { db } = getFirebaseAdmin();
  // Is there any webhook activity at all today?
  const today = new Date();
  today.setUTCHours(0,0,0,0);
  
  // Check queue for ANY status changes today
  const q = await db.collection('agent_outreach_queue')
    .where('updatedAt','>=',today).get();
  console.log(`Queue docs updated today (UTC): ${q.size}`);
  const byStatusToday: Record<string, number> = {};
  q.forEach(d => {
    const s = d.data().status || 'unknown';
    byStatusToday[s] = (byStatusToday[s] || 0) + 1;
  });
  console.log('  By status:', byStatusToday);
  
  // Any updatedAt by the webhook path (look for agentResponseAt today)?
  const respToday = q.docs.filter(d => {
    const t = d.data().agentResponseAt?.toDate?.();
    return t && t >= today;
  });
  console.log(`  With agentResponseAt today: ${respToday.length}`);
  
  // Check all log collections for webhook activity
  for (const coll of ['webhook_debug_logs', 'webhook_logs', 'ghl_webhook_logs', 'api_logs']) {
    try {
      const s = await db.collection(coll).limit(5).get();
      if (!s.empty) {
        console.log(`\n[${coll}] exists, ${s.size}+ docs. Recent:`);
        s.forEach(d => {
          const x = d.data();
          const t = x.timestamp?.toDate?.() || x.receivedAt?.toDate?.() || x.createdAt?.toDate?.();
          console.log(` ${t?.toISOString()} ${x.status || x.endpoint || x.event || ''}`);
        });
      } else {
        console.log(`[${coll}] empty or doesn't exist`);
      }
    } catch (e) {
      console.log(`[${coll}] error: ${e instanceof Error ? e.message : e}`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
