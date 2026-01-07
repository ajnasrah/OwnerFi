import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

if (!projectId || !privateKey || !clientEmail) {
  console.error("Missing Firebase env vars");
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      clientEmail,
    })
  });
}

const db = getFirestore();

async function checkWebhooks() {
  console.log("=== CHECKING WEBHOOK STATUS ===\n");

  // 1. Check 6843 Wytham Dr specifically
  console.log("--- 6843 Wytham Dr Status ---");
  const queueSnap = await db.collection("agent_outreach_queue")
    .where("address", ">=", "6843 Wytham")
    .where("address", "<=", "6843 Wytham\uf8ff")
    .limit(1)
    .get();

  if (!queueSnap.empty) {
    const doc = queueSnap.docs[0];
    const data = doc.data();
    console.log("  ID:", doc.id);
    console.log("  status:", data.status);
    console.log("  agentResponse:", data.agentResponse);
    console.log("  sentToGhlAt:", data.sentToGhlAt?.toDate?.());
    console.log("  agentResponseAt:", data.agentResponseAt?.toDate?.());
  } else {
    console.log("  Not found in queue");
  }

  // 2. Check all agent responses in queue
  console.log("\n--- All Agent Responses in Queue ---");
  const allQueue = await db.collection("agent_outreach_queue").get();

  const stats = {
    total: 0,
    sent_to_ghl: 0,
    agent_yes: 0,
    agent_no: 0,
    pending: 0,
    other: 0
  };

  const withResponse: any[] = [];

  allQueue.forEach(doc => {
    const data = doc.data();
    stats.total++;

    if (data.status === "sent_to_ghl") stats.sent_to_ghl++;
    else if (data.status === "agent_yes") stats.agent_yes++;
    else if (data.status === "agent_no") stats.agent_no++;
    else if (data.status === "pending") stats.pending++;
    else stats.other++;

    if (data.agentResponse && data.agentResponse !== "none") {
      withResponse.push({
        id: doc.id,
        address: data.address,
        status: data.status,
        agentResponse: data.agentResponse,
        agentResponseAt: data.agentResponseAt?.toDate?.()
      });
    }
  });

  console.log("  Total in queue:", stats.total);
  console.log("  sent_to_ghl:", stats.sent_to_ghl);
  console.log("  agent_yes:", stats.agent_yes);
  console.log("  agent_no:", stats.agent_no);
  console.log("  pending:", stats.pending);
  console.log("  other:", stats.other);

  if (withResponse.length > 0) {
    console.log("\n--- Properties WITH Agent Response ---");
    withResponse.forEach(p => {
      console.log(`  ${p.address}: ${p.agentResponse} (${p.status})`);
    });
  } else {
    console.log("\n  ⚠️  NO properties have an agent response set!");
  }

  // 3. Check webhook_logs for any activity
  console.log("\n--- Recent Webhook Logs ---");
  const logsSnap = await db.collection("webhook_logs")
    .orderBy("timestamp", "desc")
    .limit(5)
    .get();

  if (logsSnap.empty) {
    console.log("  No webhook_logs found");
  } else {
    logsSnap.forEach(doc => {
      const data = doc.data();
      console.log(`  ${data.timestamp?.toDate?.()}: ${data.type} - ${data.status}`);
    });
  }

  // 4. Check for any recent updates to properties with agent responses
  console.log("\n--- Recently Updated Queue Items (last 24h) ---");
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentSnap = await db.collection("agent_outreach_queue")
    .where("updatedAt", ">", yesterday)
    .orderBy("updatedAt", "desc")
    .limit(10)
    .get();

  if (recentSnap.empty) {
    console.log("  No updates in last 24h");
  } else {
    recentSnap.forEach(doc => {
      const data = doc.data();
      console.log(`  ${data.address}: ${data.status} @ ${data.updatedAt?.toDate?.()}`);
    });
  }
}

checkWebhooks().catch(console.error).finally(() => process.exit(0));
