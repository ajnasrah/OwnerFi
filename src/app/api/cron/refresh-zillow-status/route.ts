import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sanitizeDescription } from '@/lib/description-sanitizer';
import { hasStrictOwnerFinancing } from '@/lib/owner-financing-filter-strict';

// Type for Apify Zillow scraper response
interface ZillowApifyItem {
  zpid?: string | number;
  id?: string | number;
  homeStatus?: string;
  price?: number;
  listPrice?: number;
  daysOnZillow?: number;
  description?: string;
  bedrooms?: number;
  bathrooms?: number;
  livingArea?: number;
  livingAreaValue?: number;
  squareFoot?: number;
  lotAreaValue?: number;
  lotSize?: number;
  lotSquareFoot?: number;
  yearBuilt?: number;
  homeType?: string;
  propertyType?: string;
  buildingType?: string;
  latitude?: number;
  longitude?: number;
  zestimate?: number;
  estimate?: number;
  rentZestimate?: number;
  rentEstimate?: number;
  monthlyHoaFee?: number;
  hoaFee?: number;
  hoa?: number;
  annualTaxAmount?: number;
  propertyTaxRate?: number;
  annualHomeownersInsurance?: number;
  hiResImageLink?: string;
  responsivePhotos?: Array<{
    mixedSources?: {
      jpeg?: Array<{ url: string }>;
    };
  }>;
  propertyImages?: string[];
  attributionInfo?: {
    agentName?: string;
    agentPhoneNumber?: string;
    agentEmail?: string;
    brokerName?: string;
    brokerPhoneNumber?: string;
  };
  agentName?: string;
  agentPhoneNumber?: string;
  brokerName?: string;
  address?: {
    streetAddress?: string;
  };
}

// Initialize Firebase Admin
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

/**
 * Cron job to refresh Zillow property statuses
 *
 * STEALTH MODE:
 * - Runs DAILY (not every 3 days)
 * - Processes only 50-100 properties per run
 * - Uses small batches (10-15 properties) with random delays
 * - Rotates through all properties over ~17 days
 * - Avoids Zillow's bot detection
 */
export async function GET(request: NextRequest) {
  console.log('🔄 [CRON] Starting Zillow status refresh (STEALTH MODE)');

  // Security check - only allow cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error('❌ [CRON] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Runs every 2 hours (12x/day) × 125 = 1500 properties/day
    const MAX_PROPERTIES_PER_RUN = 125;
    const BATCH_SIZE = 25; // Larger batches = fewer API calls
    const MIN_DELAY = 1500; // 1.5 seconds (Apify handles rate limiting)
    const MAX_DELAY = 2500; // 2.5 seconds max
    const DELETE_INACTIVE = true; // Delete sold/pending properties

    // Get all properties, then filter/sort in memory
    // This avoids Firestore index issues on first run
    const allSnapshot = await db.collection('zillow_imports').get();

    console.log(`📊 [CRON] Total properties in database: ${allSnapshot.size}`);

    if (allSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No properties in database'
      });
    }

    // Filter to only properties WITH URLs first, then sort by lastStatusCheck
    const allProperties = allSnapshot.docs
      .filter(doc => doc.data().url) // FILTER FIRST - only properties with URLs
      .map(doc => ({
        doc,
        lastCheck: doc.data().lastStatusCheck?.toDate?.()?.getTime() || 0,
      }))
      .sort((a, b) => a.lastCheck - b.lastCheck);

    console.log(`📊 [CRON] ${allProperties.length} properties with URLs (${allSnapshot.size - allProperties.length} without URLs skipped)`);

    // Take top N for this run
    const selectedDocs = allProperties.slice(0, MAX_PROPERTIES_PER_RUN).map(p => p.doc);

    if (selectedDocs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No properties to refresh'
      });
    }

    // Extract URLs and create ZPID to document ID mapping
    const zpidToDocId = new Map<string, string>();
    const properties = selectedDocs.map(doc => {
      const zpid = String(doc.data().zpid || '');
      if (zpid) {
        zpidToDocId.set(zpid, doc.id); // Map ZPID to actual Firestore doc ID
      }
      return {
        id: doc.id,
        url: doc.data().url,
        zpid: doc.data().zpid,
        address: doc.data().fullAddress || doc.data().streetAddress,
        currentStatus: doc.data().homeStatus,
        lastCheck: doc.data().lastStatusCheck?.toDate?.() || null,
      };
    });

    console.log(`📋 [CRON] Processing ${properties.length} properties`);

    const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });
    const actorId = 'maxcopell/zillow-detail-scraper';

    let updated = 0;
    let statusChanged = 0;
    let deleted = 0;
    let errors = 0;
    const statusChanges: Array<{
      address: string;
      oldStatus: string;
      newStatus: string;
    }> = [];
    const deletedProperties: Array<{
      address: string;
      status: string;
      reason: string;
    }> = [];

    // Process in small batches with random delays
    for (let i = 0; i < properties.length; i += BATCH_SIZE) {
      const batch = properties.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(properties.length / BATCH_SIZE);

      console.log(`\n🔄 [BATCH ${batchNum}/${totalBatches}] Processing ${batch.length} properties`);

      try {
        // Run Apify scraper
        const input = {
          startUrls: batch.map(p => ({ url: p.url }))
        };

        console.log(`   🚀 Starting Apify run...`);
        const run = await client.actor(actorId).call(input);

        console.log(`   📥 Fetching results...`);
        const { items } = await client.dataset(run.defaultDatasetId).listItems({
          clean: false,
          limit: 1000,
        });

        // Cast to typed items
        const typedItems = items as ZillowApifyItem[];

        console.log(`   ✓ Got ${typedItems.length} results`);

        // Update Firestore with new status
        const firestoreBatch = db.batch();

        for (const item of typedItems) {
          const zpid = String(item.zpid || item.id || '');
          if (!zpid) continue;

          // Use the actual document ID (not ZPID) from our mapping
          const actualDocId = zpidToDocId.get(zpid);
          if (!actualDocId) {
            console.warn(`   ⚠️  No document ID mapping for ZPID ${zpid}`);
            continue;
          }

          const docRef = db.collection('zillow_imports').doc(actualDocId);

          // Find the original property
          const originalProp = batch.find(p => String(p.zpid) === zpid);
          const oldStatus = originalProp?.currentStatus || 'UNKNOWN';
          const newStatus = item.homeStatus || 'UNKNOWN';

          // Track status changes
          if (oldStatus !== newStatus) {
            statusChanged++;
            statusChanges.push({
              address: originalProp?.address || item.address?.streetAddress || 'Unknown',
              oldStatus,
              newStatus,
            });
            console.log(`   📍 Status change: ${originalProp?.address}`);
            console.log(`      ${oldStatus} → ${newStatus}`);
          }

          // Check if property is inactive
          const inactiveStatuses = [
            'PENDING',                    // Under contract
            'SOLD',                       // Already sold
            'RECENTLY_SOLD',              // Recently sold
            'OFF_MARKET',                 // No longer listed
            'FOR_RENT',                   // Changed to rental
            'CONTINGENT',                 // Contingent offer accepted
            'ACCEPTING_BACKUP_OFFERS',    // Under contract, accepting backups
            'BACKUP_OFFERS',              // Backup offers status
          ];
          const isInactive = inactiveStatuses.includes(newStatus);

          if (isInactive && DELETE_INACTIVE) {
            // Delete inactive properties
            firestoreBatch.delete(docRef);
            deleted++;
            deletedProperties.push({
              address: originalProp?.address || item.address?.streetAddress || 'Unknown',
              status: newStatus,
              reason: 'Property no longer FOR_SALE',
            });
            console.log(`   🗑️  DELETING PROPERTY (Status: ${newStatus})`);
            console.log(`      Address: ${originalProp?.address}`);
            console.log(`      ZPID: ${originalProp?.zpid}`);
            console.log(`      ℹ️  If relisted later, this ZPID can be imported again with new agent info`);
          } else {
            // Property is still active (FOR_SALE) - check if it still mentions owner financing
            const ownerFinanceCheck = hasStrictOwnerFinancing(item.description);

            if (!ownerFinanceCheck.passes && DELETE_INACTIVE) {
              // Delete properties that no longer mention owner financing
              firestoreBatch.delete(docRef);
              deleted++;
              deletedProperties.push({
                address: originalProp?.address || item.address?.streetAddress || 'Unknown',
                status: newStatus,
                reason: 'No longer offers owner financing (seller changed mind)',
              });
              console.log(`   🗑️  DELETING PROPERTY (No owner financing keywords)`);
              console.log(`      Address: ${originalProp?.address}`);
              console.log(`      ZPID: ${originalProp?.zpid}`);
              console.log(`      Status: ${newStatus} (active, but keywords removed)`);
              console.log(`      ℹ️  If owner financing is added back later, can be imported again`);
            } else {
              // Update ALL fields from Apify response (full refresh)
              const updateData: Record<string, unknown> = {
                // Core status fields
                homeStatus: newStatus,
                price: item.price || item.listPrice || 0,
                listPrice: item.listPrice || item.price || 0,
                daysOnZillow: item.daysOnZillow || 0,
                description: sanitizeDescription(item.description),
                lastStatusCheck: new Date(),
                lastScrapedAt: new Date(),

                // Property details
                bedrooms: item.bedrooms ?? null,
                bathrooms: item.bathrooms ?? null,
                squareFoot: item.livingArea || item.livingAreaValue || item.squareFoot || null,
                lotSquareFoot: item.lotAreaValue || item.lotSize || item.lotSquareFoot || null,
                yearBuilt: item.yearBuilt ?? null,
                homeType: item.homeType || item.propertyType || null,
                buildingType: item.buildingType || item.homeType || null,

                // Location data
                latitude: item.latitude ?? null,
                longitude: item.longitude ?? null,

                // Estimates
                estimate: item.zestimate || item.estimate || null,
                rentEstimate: item.rentZestimate || item.rentEstimate || null,

                // Costs
                hoa: item.monthlyHoaFee || item.hoaFee || item.hoa || 0,
                annualTaxAmount: item.propertyTaxRate ? (item.price * item.propertyTaxRate / 100) : (item.annualTaxAmount || null),
                propertyTaxRate: item.propertyTaxRate ?? null,
                annualHomeownersInsurance: item.annualHomeownersInsurance ?? null,

                // Agent info (only update if present in response)
                ...(item.attributionInfo?.agentName && { agentName: item.attributionInfo.agentName }),
                ...(item.attributionInfo?.agentPhoneNumber && { agentPhoneNumber: item.attributionInfo.agentPhoneNumber }),
                ...(item.attributionInfo?.agentEmail && { agentEmail: item.attributionInfo.agentEmail }),
                ...(item.attributionInfo?.brokerName && { brokerName: item.attributionInfo.brokerName }),
                ...(item.attributionInfo?.brokerPhoneNumber && { brokerPhoneNumber: item.attributionInfo.brokerPhoneNumber }),
                // Also check direct fields (different Apify output formats)
                ...(item.agentName && { agentName: item.agentName }),
                ...(item.agentPhoneNumber && { agentPhoneNumber: item.agentPhoneNumber }),
                ...(item.brokerName && { brokerName: item.brokerName }),

                // Images (only update if we have new ones)
                ...(item.hiResImageLink && { firstPropertyImage: item.hiResImageLink }),
                ...(item.responsivePhotos?.length && {
                  propertyImages: item.responsivePhotos.map((p: { mixedSources?: { jpeg?: Array<{ url: string }> } }) =>
                    p.mixedSources?.jpeg?.[0]?.url
                  ).filter(Boolean),
                  photoCount: item.responsivePhotos.length,
                }),
                // Also check direct propertyImages field
                ...(item.propertyImages?.length && {
                  propertyImages: item.propertyImages,
                  photoCount: item.propertyImages.length,
                  firstPropertyImage: item.propertyImages[0],
                }),
              };

              // Remove null/undefined values to avoid overwriting good data
              const cleanedData = Object.fromEntries(
                Object.entries(updateData).filter(([_, v]) => v !== null && v !== undefined)
              );

              firestoreBatch.update(docRef, cleanedData);
              updated++;
            }
          }
        }

        await firestoreBatch.commit();
        console.log(`   ✅ Batch complete: ${typedItems.length} processed (${updated} updated, ${deleted} deleted)`);

        // Random delay between batches to look more human
        if (i + BATCH_SIZE < properties.length) {
          const delay = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY) + MIN_DELAY);
          console.log(`   ⏳ Random delay: ${(delay / 1000).toFixed(1)}s before next batch...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error: any) {
        console.error(`   ❌ Batch error:`, error.message);
        errors++;
      }
    }

    // Save status change report
    if (statusChanges.length > 0 || deletedProperties.length > 0) {
      await db.collection('status_change_reports').add({
        date: new Date(),
        totalChecked: properties.length,
        statusChanges: statusChanges.length,
        deleted: deletedProperties.length,
        changes: statusChanges,
        deletions: deletedProperties,
        createdAt: new Date(),
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ [CRON] Status refresh complete');
    console.log('='.repeat(60));
    console.log(`Total properties checked: ${properties.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Status changes: ${statusChanged}`);
    console.log(`Deleted (inactive): ${deleted}`);
    console.log(`Errors: ${errors}`);

    if (statusChanges.length > 0) {
      console.log('\n📊 Status Changes:');
      statusChanges.forEach(change => {
        console.log(`   ${change.address}`);
        console.log(`   ${change.oldStatus} → ${change.newStatus}`);
      });
    }

    if (deletedProperties.length > 0) {
      console.log('\n🗑️  Deleted Properties:');
      deletedProperties.forEach(prop => {
        console.log(`   ${prop.address} - ${prop.status}`);
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Status refresh complete',
      stats: {
        totalProperties: properties.length,
        updated,
        statusChanged,
        deleted,
        errors,
        statusChanges: statusChanges.length > 0 ? statusChanges : undefined,
        deletedProperties: deletedProperties.length > 0 ? deletedProperties : undefined,
      },
    });

  } catch (error: any) {
    console.error('❌ [CRON] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
