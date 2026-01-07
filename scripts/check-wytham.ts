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

async function checkProperty() {
  console.log("Searching for 6843 Wytham Dr...\n");

  // Search for the property by address
  const propsSnap = await db.collection("properties")
    .where("streetAddress", ">=", "6843 Wytham")
    .where("streetAddress", "<=", "6843 Wytham\uf8ff")
    .limit(5)
    .get();

  if (propsSnap.empty) {
    console.log("Property not found by exact match, searching all...");
    const allProps = await db.collection("properties").get();
    for (const doc of allProps.docs) {
      const data = doc.data();
      if (data.streetAddress?.toLowerCase().includes("wytham") ||
          data.address?.toLowerCase().includes("wytham")) {
        printProperty(doc.id, data);
        return;
      }
    }
    console.log("Property not found anywhere in properties collection");
    return;
  }

  for (const doc of propsSnap.docs) {
    printProperty(doc.id, doc.data());
  }
}

function printProperty(id: string, data: any) {
  console.log("=== PROPERTY FOUND ===");
  console.log("Doc ID:", id);
  console.log("Address:", data.streetAddress || data.address);
  console.log("");
  console.log("--- Key Fields ---");
  console.log("isOwnerFinance:", data.isOwnerFinance);
  console.log("isCashDeal:", data.isCashDeal);
  console.log("");
  console.log("--- Agent Response ---");
  console.log("agentResponse:", data.agentResponse);
  console.log("agentContactedAt:", data.agentContactedAt?.toDate?.());
  console.log("agentRespondedAt:", data.agentRespondedAt?.toDate?.());
  console.log("");
  console.log("--- Cash Deal Criteria ---");
  console.log("percentOfArv:", data.percentOfArv);
  console.log("needsWork:", data.needsWork);
  console.log("zestimate:", data.zestimate);
  console.log("price:", data.price);
  console.log("");
  console.log("--- Status ---");
  console.log("status:", data.status);
  console.log("updatedAt:", data.updatedAt?.toDate?.());
}

checkProperty().catch(console.error).finally(() => process.exit(0));
