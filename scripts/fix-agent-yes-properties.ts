import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sanitizeDescription } from '../src/lib/description-sanitizer';
import { indexRawFirestoreProperty } from '../src/lib/typesense/sync';

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

const DRY_RUN = !process.argv.includes('--live');

async function fixAgentYesProperties() {
  console.log('=== FIX AGENT YES PROPERTIES ===\n');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN' : '⚠️  LIVE - MAKING CHANGES'}\n`);
  console.log('Target: unified "properties" collection\n');

  // Get all agent_yes properties from queue
  const agentYesSnapshot = await db
    .collection('agent_outreach_queue')
    .where('status', '==', 'agent_yes')
    .get();

  console.log(`Found ${agentYesSnapshot.size} properties with agent_yes status\n`);

  let updated = 0;
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let typesenseSynced = 0;

  for (const doc of agentYesSnapshot.docs) {
    const data = doc.data();
    const zpid = data.zpid;
    const docId = `zpid_${zpid}`;

    try {
      // Check if this zpid exists in unified properties collection
      const existingDoc = await db.collection('properties').doc(docId).get();

      if (existingDoc.exists) {
        // Property exists - check if already verified
        const existingData = existingDoc.data()!;

        if (existingData.ownerFinanceVerified === true) {
          console.log(`⏭️  Skipping (already verified): ${data.address}`);
          skipped++;
          continue;
        }

        console.log(`📝 Updating: ${data.address}`);

        if (!DRY_RUN) {
          await existingDoc.ref.update({
            ownerFinanceVerified: true,
            isOwnerFinance: true,
            isActive: true,
            agentConfirmedOwnerFinance: true,
            dealTypes: [...new Set([...(existingData.dealTypes || []), 'owner_finance'])],
            source: 'agent_outreach',
            updatedAt: new Date(),
          });

          // Sync to Typesense
          try {
            const updatedDoc = await db.collection('properties').doc(docId).get();
            await indexRawFirestoreProperty(docId, updatedDoc.data()!, 'properties');
            typesenseSynced++;
          } catch (e) {
            console.log(`   ⚠️ Typesense sync failed`);
          }
        }

        updated++;
      } else {
        // Property doesn't exist - import it
        console.log(`📥 Importing: ${data.address}`);

        if (!DRY_RUN) {
          const descriptionText = sanitizeDescription(data.rawData?.description || '');

          // Get image from rawData
          const imgSrc = data.rawData?.hiResImageLink || data.rawData?.imgSrc || null;

          const propertyData = {
            // Core identifiers
            zpid: data.zpid,
            url: data.url,

            // Address
            address: data.address || '',
            streetAddress: data.address || '',
            fullAddress: `${data.address}, ${data.city}, ${data.state} ${data.zipCode}`,
            city: data.city || '',
            state: data.state || '',
            zipCode: data.zipCode || '',

            // Pricing
            price: data.price || 0,
            listPrice: data.price || 0,
            zestimate: data.zestimate || null,
            priceToZestimateRatio: data.priceToZestimateRatio || null,

            // Property details
            bedrooms: data.beds || 0,
            bathrooms: data.baths || 0,
            squareFoot: data.squareFeet || 0,
            homeType: data.propertyType || 'SINGLE_FAMILY',
            homeStatus: 'FOR_SALE',

            // Images
            imgSrc,
            firstPropertyImage: imgSrc,

            // Agent info
            agentName: data.agentName,
            agentPhoneNumber: data.agentPhone,
            agentEmail: data.agentEmail || null,

            // Description
            description: descriptionText,

            // Financing Type
            financingType: 'Owner Finance',
            allFinancingTypes: ['Owner Finance'],
            financingTypeLabel: 'Owner Finance',

            // CRITICAL FLAGS - unified collection schema
            ownerFinanceVerified: true,
            isOwnerFinance: true,
            isCashDeal: false,
            dealTypes: ['owner_finance'],
            isActive: true,
            agentConfirmedOwnerFinance: true,

            // Source tracking
            source: 'agent_outreach',
            agentConfirmedAt: data.agentResponseAt?.toDate?.() || new Date(),
            agentNote: data.agentNote || null,
            originalQueueId: doc.id,

            // Metadata
            importedAt: new Date(),
            createdAt: new Date(),
            lastStatusCheck: new Date(),
            lastScrapedAt: new Date(),

            // Full raw data for reference
            rawData: data.rawData || null,
          };

          // Save to unified properties collection
          await db.collection('properties').doc(docId).set(propertyData);

          // Sync to Typesense
          try {
            await indexRawFirestoreProperty(docId, propertyData, 'properties');
            typesenseSynced++;
            console.log(`   ✅ Synced to Typesense`);
          } catch (e) {
            console.log(`   ⚠️ Typesense sync failed`);
          }

          // Update queue to mark as properly routed
          await doc.ref.update({
            routedTo: 'properties',
            routedAt: new Date(),
          });
        }

        imported++;
      }
    } catch (error: any) {
      console.error(`❌ Error processing ${data.address}: ${error.message}`);
      errors++;
    }
  }

  console.log('\n=== RESULTS ===\n');
  console.log(`Updated (set ownerFinanceVerified=true): ${updated}`);
  console.log(`Imported (new to properties): ${imported}`);
  console.log(`Synced to Typesense: ${typesenseSynced}`);
  console.log(`Skipped (already verified): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total processed: ${updated + imported + skipped + errors}`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN - No changes made');
    console.log('Run with --live to apply changes');
  } else {
    console.log('\n✅ Changes applied successfully');
  }
}

fixAgentYesProperties()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
