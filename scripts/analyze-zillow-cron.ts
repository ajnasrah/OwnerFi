import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

async function main() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  console.log("=== ZILLOW STATUS CHECKER CRON ANALYSIS ===\n");
  console.log("Time range: Last 24 hours");
  console.log("From:", yesterday.toISOString());
  console.log("To:  ", now.toISOString());

  // Query cron_logs for refresh-zillow-status runs (filter in memory to avoid composite index)
  const allCronLogs = await db.collection("cron_logs")
    .where("type", "==", "refresh-zillow-status")
    .get();

  const cronLogs = {
    docs: allCronLogs.docs.filter(doc => {
      const data = doc.data();
      const startedAt = data.startedAt?.toDate?.();
      return startedAt && startedAt >= yesterday;
    }).sort((a, b) => {
      const aTime = a.data().startedAt?.toDate?.()?.getTime() || 0;
      const bTime = b.data().startedAt?.toDate?.()?.getTime() || 0;
      return bTime - aTime;
    }),
    size: 0
  };
  cronLogs.size = cronLogs.docs.length;

  console.log("\n--- CRON RUNS (from cron_logs) ---");
  console.log("Total runs in last 24h:", cronLogs.size);

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalDeleted = 0;
  let totalNoResult = 0;
  let totalStatusChanged = 0;
  let successfulRuns = 0;
  let failedRuns = 0;

  cronLogs.docs.forEach(doc => {
    const data = doc.data();
    if (data.status === "completed" && data.results) {
      successfulRuns++;
      totalProcessed += data.results.processed || 0;
      totalUpdated += data.results.updated || 0;
      totalDeleted += data.results.deleted || 0;
      totalNoResult += data.results.noResult || 0;
      totalStatusChanged += data.results.statusChanged || 0;
    } else if (data.status === "failed") {
      failedRuns++;
    }
  });

  console.log("Successful runs:", successfulRuns);
  console.log("Failed runs:", failedRuns);

  console.log("\n--- AGGREGATE STATS (last 24h) ---");
  console.log("Total properties checked:", totalProcessed);
  console.log("Properties updated:", totalUpdated);
  console.log("Properties deleted/marked inactive:", totalDeleted);
  console.log("No result (off-market):", totalNoResult);
  console.log("Status changes detected:", totalStatusChanged);

  // Query status_change_reports for more details (filter in memory)
  const allReports = await db.collection("status_change_reports").get();
  const reports = {
    docs: allReports.docs.filter(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.();
      return createdAt && createdAt >= yesterday;
    }).sort((a, b) => {
      const aTime = a.data().createdAt?.toDate?.()?.getTime() || 0;
      const bTime = b.data().createdAt?.toDate?.()?.getTime() || 0;
      return bTime - aTime;
    }),
    size: 0
  };
  reports.size = reports.docs.length;

  console.log("\n--- STATUS CHANGE REPORTS ---");
  console.log("Reports in last 24h:", reports.size);

  // Show recent deletions
  const allDeletions: Array<{address: string; reason: string; date: Date}> = [];
  reports.docs.forEach(doc => {
    const data = doc.data();
    if (data.deletions && data.deletions.length > 0) {
      data.deletions.forEach((d: {address: string; reason: string}) => {
        allDeletions.push({
          address: d.address,
          reason: d.reason,
          date: data.createdAt?.toDate?.() || data.date?.toDate?.() || new Date()
        });
      });
    }
  });

  console.log("\n--- DELETIONS/MARKED INACTIVE (sample) ---");
  if (allDeletions.length === 0) {
    console.log("No deletions recorded in status_change_reports");
  } else {
    console.log("Total deletions recorded:", allDeletions.length);
    console.log("\nRecent examples:");
    allDeletions.slice(0, 10).forEach((d, i) => {
      console.log(`  ${i+1}. ${d.address}`);
      console.log(`     Reason: ${d.reason}`);
    });
  }

  // Show last 5 runs details
  console.log("\n--- LAST 5 RUNS DETAIL ---");
  cronLogs.docs.slice(0, 5).forEach((doc, i) => {
    const data = doc.data();
    const startTime = data.startedAt?.toDate?.() || new Date();
    console.log(`\nRun ${i+1}: ${data.runId}`);
    console.log(`  Started: ${startTime.toISOString()}`);
    console.log(`  Status: ${data.status}`);
    if (data.results) {
      console.log(`  Processed: ${data.results.processed}`);
      console.log(`  Updated: ${data.results.updated}`);
      console.log(`  Deleted: ${data.results.deleted}`);
      console.log(`  No result: ${data.results.noResult}`);
    }
    if (data.error) {
      console.log(`  Error: ${data.error}`);
    }
  });
}

main().catch(console.error);
