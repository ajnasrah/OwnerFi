import { ApifyClient } from "apify-client";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

async function deepDive() {
  console.log("=== DEEP DIVE INTO APIFY ACCOUNT ===\n");
  
  const user = await client.user().get();
  console.log("Account:", user.username);
  console.log("Email:", user.email);
  console.log("Plan:", user.plan?.id);
  console.log("Monthly credits:", "$" + user.plan?.monthlyUsageCreditsUsd);
  
  console.log("\n=== SCHEDULED ACTORS ===");
  try {
    const schedules = await client.schedules().list();
    console.log("Total schedules:", schedules.items.length);
    for (const s of schedules.items) {
      console.log("  -", s.name, "| Cron:", s.cronExpression, "| Enabled:", s.isEnabled);
    }
  } catch (e: any) {
    console.log("No schedules or error:", e.message);
  }
  
  console.log("\n=== ALL ACTOR RUNS (last 100) ===");
  const runs = await client.runs().list({ limit: 100, desc: true });
  
  const runsByDate: Record<string, { count: number; cost: number }> = {};
  
  for (const run of runs.items) {
    const date = new Date(run.startedAt).toISOString().split("T")[0];
    if (runsByDate[date] === undefined) runsByDate[date] = { count: 0, cost: 0 };
    runsByDate[date].count++;
    runsByDate[date].cost += run.usageTotalUsd || 0;
  }
  
  console.log("\nRuns by date:");
  Object.entries(runsByDate)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 15)
    .forEach(([date, data]) => {
      console.log("  " + date + ": " + data.count + " runs, $" + data.cost.toFixed(4));
    });
  
  console.log("\n=== ACTORS USED ===");
  const actorsUsed = new Set<string>();
  for (const run of runs.items) {
    actorsUsed.add(run.actId);
  }
  console.log("Unique actors:", [...actorsUsed]);
  
  if (runs.items.length > 0) {
    const latestRun = runs.items[0];
    console.log("\n=== MOST RECENT RUN ===");
    console.log("Run ID:", latestRun.id);
    console.log("Actor ID:", latestRun.actId);
    console.log("Started:", latestRun.startedAt);
    console.log("Status:", latestRun.status);
    console.log("Cost:", "$" + (latestRun.usageTotalUsd || 0).toFixed(4));
  }
  
  // Check billing
  console.log("\n=== BILLING INFO ===");
  try {
    const billing = await fetch("https://api.apify.com/v2/users/me/limits", {
      headers: { Authorization: "Bearer " + process.env.APIFY_API_KEY }
    });
    if (billing.ok) {
      const data = await billing.json();
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.log("Could not fetch billing");
  }
}

deepDive().catch(console.error);
