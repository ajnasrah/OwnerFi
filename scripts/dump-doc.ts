import { getAdminDb } from '../src/lib/firebase-admin';

async function main() {
  const db = await getAdminDb();
  if (!db) return;

  const zpid = 70589260;
  const snapshot = await db.collection("zillow_imports")
    .where("zpid", "==", zpid)
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.log("Not found");
    return;
  }

  const data = snapshot.docs[0].data();
  console.log("=== ALL FIELDS ===\n");
  console.log(JSON.stringify(data, null, 2));
}

main();
