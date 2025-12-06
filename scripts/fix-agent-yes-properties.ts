import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sanitizeDescription } from '../src/lib/description-sanitizer';

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

  for (const doc of agentYesSnapshot.docs) {
    const data = doc.data();
    const zpid = data.zpid;

    try {
      // Check if this zpid exists in zillow_imports
      const zillowSnapshot = await db
        .collection('zillow_imports')
        .where('zpid', '==', zpid)
        .limit(1)
        .get();

      if (!zillowSnapshot.empty) {
        // Property exists - just need to set ownerFinanceVerified
        const zillowDoc = zillowSnapshot.docs[0];
        const zillowData = zillowDoc.data();

        if (zillowData.ownerFinanceVerified === true) {
          skipped++;
          continue;
        }

        console.log(`📝 Updating: ${data.address}`);

        if (!DRY_RUN) {
          await zillowDoc.ref.update({
            ownerFinanceVerified: true,
            isActive: true,
            agentConfirmedOwnerFinance: true,
            updatedAt: new Date(),
          });
        }

        updated++;
      } else {
        // Property doesn't exist - need to import it
        console.log(`📥 Importing: ${data.address}`);

        if (!DRY_RUN) {
          // Import to zillow_imports with proper flags
          const descriptionText = sanitizeDescription(data.rawData?.description || '');

          await db.collection('zillow_imports').add({
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

            // Property details
            bedrooms: data.beds || 0,
            bathrooms: data.baths || 0,
            livingArea: data.squareFeet || 0,
            homeType: data.propertyType || 'SINGLE_FAMILY',
            homeStatus: 'FOR_SALE',

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

            // Source tracking
            source: 'agent_outreach',
            agentConfirmedOwnerFinance: true,
            agentConfirmedAt: data.agentResponseAt || new Date(),
            agentNote: data.agentNote || null,
            originalQueueId: doc.id,

            // CRITICAL FLAGS
            ownerFinanceVerified: true,
            isActive: true,

            // Metadata
            importedAt: new Date(),
            lastStatusCheck: new Date(),
            lastScrapedAt: new Date(),

            // Full raw data for reference
            rawData: data.rawData || null,
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
  console.log(`Imported (new to zillow_imports): ${imported}`);
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
