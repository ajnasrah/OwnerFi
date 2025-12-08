import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

async function fixBulkAgentYes() {
  console.log('='.repeat(80));
  console.log('FIXING BULK-PROCESSED AGENT_YES ITEMS');
  console.log('='.repeat(80));

  // Get all agent_yes items
  const agentYes = await db.collection('agent_outreach_queue')
    .where('status', '==', 'agent_yes')
    .get();

  console.log(`\nTotal agent_yes items: ${agentYes.size}`);

  // Separate real vs bulk
  const bulkProcessed: FirebaseFirestore.DocumentSnapshot[] = [];
  const realResponses: FirebaseFirestore.DocumentSnapshot[] = [];

  agentYes.docs.forEach(doc => {
    const d = doc.data();
    // Bulk processed items have this specific note
    if (d.agentNote === 'Bulk processed - agent confirmed via GHL') {
      bulkProcessed.push(doc);
    } else {
      realResponses.push(doc);
    }
  });

  console.log(`\n📊 BREAKDOWN:`);
  console.log(`   Real webhook responses: ${realResponses.size}`);
  console.log(`   Bulk script processed: ${bulkProcessed.length}`);

  // Show real responses
  if (realResponses.length > 0) {
    console.log('\n✅ REAL AGENT RESPONSES (keeping as agent_yes):');
    realResponses.forEach(doc => {
      const d = doc.data();
      console.log(`   - ${d.address}, ${d.city} ${d.state}`);
      console.log(`     Agent Note: ${d.agentNote || 'N/A'}`);
      console.log(`     Response At: ${d.agentResponseAt?.toDate?.()}`);
    });
  }

  // Reset bulk processed ones
  if (bulkProcessed.length > 0) {
    console.log(`\n🔄 RESETTING ${bulkProcessed.length} bulk-processed items to 'sent_to_ghl'...`);

    let resetCount = 0;
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of bulkProcessed) {
      batch.update(doc.ref, {
        status: 'sent_to_ghl',
        agentResponse: FieldValue.delete(),
        agentResponseAt: FieldValue.delete(),
        agentNote: FieldValue.delete(),
        routedTo: FieldValue.delete(),
        updatedAt: new Date(),
      });

      batchCount++;
      resetCount++;

      // Commit every 500
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`   Committed batch: ${resetCount}/${bulkProcessed.length}`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
      console.log(`   Committed final batch: ${resetCount}/${bulkProcessed.length}`);
    }

    console.log(`\n✅ Reset ${resetCount} items back to 'sent_to_ghl'`);
  }

  // Also need to remove the fake entries from zillow_imports
  console.log('\n' + '='.repeat(80));
  console.log('CHECKING ZILLOW_IMPORTS FOR BULK-ADDED ENTRIES');
  console.log('='.repeat(80));

  const bulkImports = await db.collection('zillow_imports')
    .where('agentNote', '==', 'Bulk processed - agent confirmed via GHL')
    .get();

  console.log(`\nFound ${bulkImports.size} bulk-added entries in zillow_imports`);

  if (bulkImports.size > 0) {
    console.log(`🗑️  Deleting ${bulkImports.size} bulk-added entries from zillow_imports...`);

    let deleteCount = 0;
    let deleteBatch = db.batch();
    let deleteBatchCount = 0;

    for (const doc of bulkImports.docs) {
      deleteBatch.delete(doc.ref);
      deleteBatchCount++;
      deleteCount++;

      if (deleteBatchCount >= 500) {
        await deleteBatch.commit();
        console.log(`   Deleted batch: ${deleteCount}/${bulkImports.size}`);
        deleteBatch = db.batch();
        deleteBatchCount = 0;
      }
    }

    if (deleteBatchCount > 0) {
      await deleteBatch.commit();
      console.log(`   Deleted final batch: ${deleteCount}/${bulkImports.size}`);
    }

    console.log(`\n✅ Deleted ${deleteCount} bulk entries from zillow_imports`);
  }

  // Check cash_deals too
  console.log('\n' + '='.repeat(80));
  console.log('CHECKING CASH_DEALS FOR BULK-ADDED ENTRIES');
  console.log('='.repeat(80));

  const bulkCashDeals = await db.collection('cash_deals')
    .where('agentNote', '==', 'Bulk processed - agent confirmed via GHL')
    .get();

  console.log(`\nFound ${bulkCashDeals.size} bulk-added entries in cash_deals`);

  if (bulkCashDeals.size > 0) {
    console.log(`🗑️  Deleting ${bulkCashDeals.size} bulk-added entries from cash_deals...`);

    let cashDeleteCount = 0;
    let cashBatch = db.batch();
    let cashBatchCount = 0;

    for (const doc of bulkCashDeals.docs) {
      cashBatch.delete(doc.ref);
      cashBatchCount++;
      cashDeleteCount++;

      if (cashBatchCount >= 500) {
        await cashBatch.commit();
        console.log(`   Deleted batch: ${cashDeleteCount}/${bulkCashDeals.size}`);
        cashBatch = db.batch();
        cashBatchCount = 0;
      }
    }

    if (cashBatchCount > 0) {
      await cashBatch.commit();
      console.log(`   Deleted final batch: ${cashDeleteCount}/${bulkCashDeals.size}`);
    }

    console.log(`\n✅ Deleted ${cashDeleteCount} bulk entries from cash_deals`);
  }

  // Final summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`\n✅ Real agent responses preserved: ${realResponses.length}`);
  console.log(`✅ Bulk items reset to sent_to_ghl: ${bulkProcessed.length}`);
  console.log(`✅ Bulk entries removed from zillow_imports: ${bulkImports.size}`);
  console.log(`✅ Bulk entries removed from cash_deals: ${bulkCashDeals.size}`);
  console.log('\n');
}

fixBulkAgentYes()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
