import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sanitizeDescription } from '@/lib/description-sanitizer';
import { hasStrictOwnerFinancing } from '@/lib/owner-financing-filter-strict';
import { detectNeedsWork, getMatchingKeywords } from '@/lib/property-needs-work-detector';

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
 * UNIFIED STATUS REFRESH:
 * - Processes zillow_imports (owner finance), cash_houses, AND agent_outreach_queue collections
 * - Runs hourly with stealth batching
 * - Deletes sold/off-market properties from zillow_imports and cash_houses
 * - Updates status in agent_outreach_queue (marks off-market but doesn't delete)
 * - Auto-discovers cash deals from owner finance properties
 *
 * STEALTH MODE:
 * - Processes only 80 properties per run (split between collections)
 * - Uses small batches (40 properties) with random delays
 * - Avoids Zillow's bot detection
 */
export async function GET(request: NextRequest) {
  console.log('🔄 [CRON] Starting Zillow status refresh (UNIFIED - Owner Finance + Cash Houses + Agent Outreach)');

  // Security check - only allow cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error('❌ [CRON] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Runs every hour (24x/day) × 125 = 3000 properties/day
    // Split between zillow_imports (owner finance) and cash_houses
    const MAX_PROPERTIES_PER_RUN = 125;
    const BATCH_SIZE = 42; // 3 batches × ~60s each = ~3-4 min with buffer
    const MIN_DELAY = 500; // 0.5 second
    const MAX_DELAY = 1000; // 1 second max
    const DELETE_INACTIVE = true; // Delete sold/pending properties

    // ============================================
    // STEP 1: Gather properties from ALL collections
    // ============================================

    // Get zillow_imports (owner finance properties)
    const ownerFinanceSnapshot = await db.collection('zillow_imports').get();
    console.log(`📊 [CRON] Owner Finance (zillow_imports): ${ownerFinanceSnapshot.size} total`);

    // Get cash_houses
    const cashHousesSnapshot = await db.collection('cash_houses').get();
    console.log(`📊 [CRON] Cash Houses: ${cashHousesSnapshot.size} total`);

    // Get agent_outreach_queue (pending agent response - need to monitor for off-market)
    // Only get properties with status 'sent_to_ghl' (awaiting agent response)
    const agentOutreachSnapshot = await db.collection('agent_outreach_queue')
      .where('status', '==', 'sent_to_ghl')
      .get();
    console.log(`📊 [CRON] Agent Outreach Queue (sent_to_ghl): ${agentOutreachSnapshot.size} total`);

    const totalProperties = ownerFinanceSnapshot.size + cashHousesSnapshot.size + agentOutreachSnapshot.size;
    console.log(`📊 [CRON] Combined total: ${totalProperties} properties`);

    if (ownerFinanceSnapshot.empty && cashHousesSnapshot.empty && agentOutreachSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No properties in database'
      });
    }

    // Combine and sort all properties by lastStatusCheck (oldest first)
    // Tag each with its source collection
    const allOwnerFinance = ownerFinanceSnapshot.docs
      .filter(doc => doc.data().url)
      .map(doc => ({
        doc,
        collection: 'zillow_imports' as const,
        lastCheck: doc.data().lastStatusCheck?.toDate?.()?.getTime() || 0,
      }));

    const allCashHouses = cashHousesSnapshot.docs
      .filter(doc => doc.data().url)
      .map(doc => ({
        doc,
        collection: 'cash_houses' as const,
        lastCheck: doc.data().lastStatusCheck?.toDate?.()?.getTime() || 0,
      }));

    const allAgentOutreach = agentOutreachSnapshot.docs
      .filter(doc => doc.data().url)
      .map(doc => ({
        doc,
        collection: 'agent_outreach_queue' as const,
        lastCheck: doc.data().lastStatusCheck?.toDate?.()?.getTime() || 0,
      }));

    // Merge and sort by oldest check first
    const combinedProperties = [...allOwnerFinance, ...allCashHouses, ...allAgentOutreach]
      .sort((a, b) => a.lastCheck - b.lastCheck);

    console.log(`📊 [CRON] ${combinedProperties.length} properties with URLs (${allOwnerFinance.length} owner finance, ${allCashHouses.length} cash houses, ${allAgentOutreach.length} agent outreach)`);

    // Take top N for this run
    const selectedProperties = combinedProperties.slice(0, MAX_PROPERTIES_PER_RUN);

    // Count how many from each collection
    const ownerFinanceCount = selectedProperties.filter(p => p.collection === 'zillow_imports').length;
    const cashHousesCount = selectedProperties.filter(p => p.collection === 'cash_houses').length;
    const agentOutreachCount = selectedProperties.filter(p => p.collection === 'agent_outreach_queue').length;
    console.log(`📋 [CRON] This run: ${ownerFinanceCount} owner finance + ${cashHousesCount} cash houses + ${agentOutreachCount} agent outreach = ${selectedProperties.length} total`);

    if (selectedProperties.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No properties to refresh'
      });
    }

    // Create mappings for all collections
    const zpidToDocInfo = new Map<string, { docId: string; collection: 'zillow_imports' | 'cash_houses' | 'agent_outreach_queue' }>();
    const properties = selectedProperties.map(item => {
      const data = item.doc.data();
      const zpid = String(data.zpid || '');
      if (zpid) {
        zpidToDocInfo.set(zpid, { docId: item.doc.id, collection: item.collection });
      }
      return {
        id: item.doc.id,
        collection: item.collection,
        url: data.url,
        zpid: data.zpid,
        address: data.fullAddress || data.streetAddress,
        currentStatus: data.homeStatus,
        lastCheck: data.lastStatusCheck?.toDate?.() || null,
        agentConfirmedOwnerFinance: data.agentConfirmedOwnerFinance,
        source: data.source,
      };
    });

    console.log(`📋 [CRON] Processing ${properties.length} properties from both collections`);

    const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });
    const actorId = 'maxcopell/zillow-detail-scraper';

    let updated = 0;
    let statusChanged = 0;
    let deleted = 0;
    let errors = 0;
    let noResultCount = 0; // Properties with no Apify result (URL removed, etc.)
    let cashDealsFound = 0; // Cash deals discovered
    let needsWorkFound = 0; // Needs work properties discovered
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
    const newCashDeals: Array<{
      address: string;
      price: number;
      estimate: number;
      discountPercent: number;
      needsWork: boolean;
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
        const processedZpids = new Set<string>(); // Track which properties got results

        for (const item of typedItems) {
          const zpid = String(item.zpid || item.id || '');
          if (!zpid) continue;

          // Use the actual document ID and collection from our mapping
          const docInfo = zpidToDocInfo.get(zpid);
          if (!docInfo) {
            console.warn(`   ⚠️  No document ID mapping for ZPID ${zpid}`);
            continue;
          }

          processedZpids.add(zpid); // Mark as processed
          const docRef = db.collection(docInfo.collection).doc(docInfo.docId);
          const isOwnerFinanceCollection = docInfo.collection === 'zillow_imports';
          const isCashHouseCollection = docInfo.collection === 'cash_houses';
          const isAgentOutreachCollection = docInfo.collection === 'agent_outreach_queue';

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
            'OTHER',                      // Suspicious - often means listing removed
            'UNKNOWN',                    // Apify couldn't determine - likely off-market
            // Note: ACCEPTING_BACKUP_OFFERS kept active - still a valid opportunity
          ];
          const isInactive = inactiveStatuses.includes(newStatus);

          // Also check for price = 0 or null, which indicates off-market
          const hasNoPrice = !item.price && !item.listPrice;
          const isPriceZero = (item.price === 0 || item.listPrice === 0);

          if ((isInactive || hasNoPrice || isPriceZero) && DELETE_INACTIVE) {
            // Delete inactive properties or those with no/zero price (off-market indicator)
            const reason = isInactive
              ? 'Property no longer FOR_SALE'
              : hasNoPrice
                ? 'No price data (likely off-market)'
                : 'Price is $0 (likely off-market)';

            if (isAgentOutreachCollection) {
              // DON'T delete from agent_outreach_queue - mark as property_off_market instead
              firestoreBatch.update(docRef, {
                status: 'property_off_market',
                homeStatus: newStatus,
                offMarketReason: reason,
                offMarketDetectedAt: new Date(),
                lastStatusCheck: new Date(),
              });
              console.log(`   ⚠️  MARKING OFF-MARKET (agent_outreach_queue): ${originalProp?.address}`);
              console.log(`      Status: ${newStatus}, Reason: ${reason}`);
            } else {
              // Delete from zillow_imports and cash_houses
              firestoreBatch.delete(docRef);
              deleted++;
              deletedProperties.push({
                address: originalProp?.address || item.address?.streetAddress || 'Unknown',
                status: newStatus,
                reason,
              });
              console.log(`   🗑️  DELETING PROPERTY (${reason})`);
              console.log(`      Status: ${newStatus}, Price: ${item.price || item.listPrice || 'N/A'}`);
              console.log(`      Address: ${originalProp?.address}`);
              console.log(`      ZPID: ${originalProp?.zpid}`);
              console.log(`      ℹ️  If relisted later, this ZPID can be imported again with new agent info`);
            }
          } else {
            // Property is still active (FOR_SALE)
            // For owner finance properties (zillow_imports): check if still mentions owner financing
            // For cash houses: no owner financing check needed, just update

            let shouldDelete = false;
            let deleteReason = '';

            if (isOwnerFinanceCollection) {
              // OWNER FINANCE COLLECTION - Check for owner financing keywords
              // BYPASS: Skip owner finance keyword check for agent-confirmed properties
              const isAgentConfirmed = originalProp?.agentConfirmedOwnerFinance === true || originalProp?.source === 'agent_outreach';
              const ownerFinanceCheck = hasStrictOwnerFinancing(item.description);

              if (!ownerFinanceCheck.passes && DELETE_INACTIVE && !isAgentConfirmed) {
                // Delete properties that no longer mention owner financing
                shouldDelete = true;
                deleteReason = 'No longer offers owner financing (seller changed mind)';
              } else if (isAgentConfirmed && !ownerFinanceCheck.passes) {
                console.log(`   ✅ KEEPING (agent confirmed): ${originalProp?.address}`);
              }
            }
            // Cash houses don't need owner financing check - they're kept as long as they're FOR_SALE

            if (shouldDelete && !isAgentOutreachCollection) {
              // Only delete from zillow_imports/cash_houses, NOT from agent_outreach_queue
              firestoreBatch.delete(docRef);
              deleted++;
              deletedProperties.push({
                address: originalProp?.address || item.address?.streetAddress || 'Unknown',
                status: newStatus,
                reason: deleteReason,
              });
              console.log(`   🗑️  DELETING PROPERTY (${deleteReason})`);
              console.log(`      Collection: ${docInfo.collection}`);
              console.log(`      Address: ${originalProp?.address}`);
              console.log(`      ZPID: ${originalProp?.zpid}`);
              console.log(`      Status: ${newStatus} (active, but keywords removed)`);
              console.log(`      ℹ️  If owner financing is added back later, can be imported again`);
            } else if (isAgentOutreachCollection) {
              // For agent_outreach_queue: only update minimal fields (status tracking)
              const agentOutreachUpdate: Record<string, unknown> = {
                homeStatus: newStatus,
                price: item.price || item.listPrice || 0,
                zestimate: item.zestimate || item.estimate || null,
                lastStatusCheck: new Date(),
                lastScrapedAt: new Date(),
              };
              firestoreBatch.update(docRef, agentOutreachUpdate);
              updated++;
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
                consecutiveNoResults: 0, // Reset failure counter on success
                lastStatusCheckNote: null, // Clear any failure notes

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

              // ============================================
              // CASH DEAL DISCOVERY - Check if property qualifies
              // Only for owner finance properties (zillow_imports)
              // Cash houses are already cash deals, no need to re-discover
              // ============================================
              if (isOwnerFinanceCollection) {
                const price = item.price || item.listPrice || 0;
                const estimate = item.zestimate || item.estimate || 0;

                if (price > 0 && estimate > 0) {
                const eightyPercentOfZestimate = estimate * 0.8;
                const discountPercent = ((estimate - price) / estimate) * 100;
                const needsWork = detectNeedsWork(item.description);
                const needsWorkKeywords = needsWork ? getMatchingKeywords(item.description) : [];

                // Check if qualifies as cash deal: price < 80% of Zestimate OR needs work
                const meetsDiscountCriteria = price < eightyPercentOfZestimate;
                const meetsNeedsWorkCriteria = needsWork;

                if (meetsDiscountCriteria || meetsNeedsWorkCriteria) {
                  // Check if already in cash_houses by ZPID
                  const existingCashDeal = await db.collection('cash_houses')
                    .where('zpid', '==', Number(zpid) || zpid)
                    .limit(1)
                    .get();

                  if (existingCashDeal.empty) {
                    // Add to cash_houses collection
                    const cashDealData = {
                      // Copy core data from zillow_imports
                      zpid: Number(zpid) || zpid,
                      url: originalProp?.url,
                      fullAddress: originalProp?.address || item.address?.streetAddress,
                      streetAddress: item.address?.streetAddress,
                      price,
                      listPrice: item.listPrice || price,
                      estimate,
                      zestimate: estimate,
                      description: sanitizeDescription(item.description),
                      bedrooms: item.bedrooms,
                      bathrooms: item.bathrooms,
                      squareFoot: item.livingArea || item.livingAreaValue || item.squareFoot,
                      lotSquareFoot: item.lotAreaValue || item.lotSize,
                      yearBuilt: item.yearBuilt,
                      homeType: item.homeType || item.propertyType,
                      homeStatus: newStatus,
                      latitude: item.latitude,
                      longitude: item.longitude,
                      hoa: item.monthlyHoaFee || item.hoaFee || 0,
                      annualTaxAmount: item.annualTaxAmount,
                      rentEstimate: item.rentZestimate || item.rentEstimate,

                      // Agent info
                      agentName: item.attributionInfo?.agentName || item.agentName,
                      agentPhoneNumber: item.attributionInfo?.agentPhoneNumber || item.agentPhoneNumber,
                      brokerName: item.attributionInfo?.brokerName || item.brokerName,

                      // Images
                      imgSrc: item.hiResImageLink || item.propertyImages?.[0],
                      propertyImages: item.propertyImages || item.responsivePhotos?.map((p: any) => p.mixedSources?.jpeg?.[0]?.url).filter(Boolean),

                      // Cash deal specific fields
                      discountPercentage: parseFloat(discountPercent.toFixed(2)),
                      eightyPercentOfZestimate: Math.round(eightyPercentOfZestimate),
                      needsWork,
                      needsWorkKeywords,
                      dealType: meetsDiscountCriteria ? 'discount' : 'needs_work',
                      source: 'auto_discovery_zillow_refresh',

                      // Timestamps
                      createdAt: new Date(),
                      discoveredAt: new Date(),
                      imageEnhanced: true,
                      imageEnhancedAt: new Date().toISOString(),
                    };

                    firestoreBatch.set(db.collection('cash_houses').doc(), cashDealData);

                    if (meetsNeedsWorkCriteria && !meetsDiscountCriteria) {
                      needsWorkFound++;
                      console.log(`   🔨 NEW NEEDS WORK: ${originalProp?.address} - Keywords: ${needsWorkKeywords.join(', ')}`);
                    } else {
                      cashDealsFound++;
                      console.log(`   💰 NEW CASH DEAL: ${originalProp?.address} - $${price.toLocaleString()} vs $${estimate.toLocaleString()} (${discountPercent.toFixed(1)}% discount)`);
                    }

                    newCashDeals.push({
                      address: originalProp?.address || item.address?.streetAddress || 'Unknown',
                      price,
                      estimate,
                      discountPercent: parseFloat(discountPercent.toFixed(2)),
                      needsWork,
                    });
                  }
                }
                }
              } // End of isOwnerFinanceCollection check for cash deal discovery
            }
          }
        }

        // Handle properties that didn't get Apify results
        // Delete immediately on first failure - if Apify can't find it, it's likely off-market
        const MAX_CONSECUTIVE_NO_RESULTS = 1;
        let batchNoResult = 0;
        for (const prop of batch) {
          const propZpid = String(prop.zpid || '');
          if (propZpid && !processedZpids.has(propZpid)) {
            // Use the correct collection for each property
            const docRef = db.collection(prop.collection).doc(prop.id);

            // Get current failure count from the property data
            const propDoc = await docRef.get();
            const currentFailures = propDoc.data()?.consecutiveNoResults || 0;
            const newFailures = currentFailures + 1;

            if (newFailures >= MAX_CONSECUTIVE_NO_RESULTS) {
              // Delete after 1 consecutive failure
              firestoreBatch.delete(docRef);
              deleted++;
              deletedProperties.push({
                address: prop.address || 'Unknown',
                status: 'NO_RESULT',
                reason: `${newFailures} consecutive Apify failures - URL likely invalid (${prop.collection})`,
              });
              console.log(`   🗑️  DELETING from ${prop.collection} (${newFailures} consecutive failures): ${prop.address}`);
            } else {
              // Track the failure, will try again next rotation
              firestoreBatch.update(docRef, {
                lastStatusCheck: new Date(),
                lastStatusCheckNote: `No Apify result (failure ${newFailures}/${MAX_CONSECUTIVE_NO_RESULTS})`,
                consecutiveNoResults: newFailures,
              });
              console.log(`   ⚠️  No result (${newFailures}/${MAX_CONSECUTIVE_NO_RESULTS}): ${prop.address} [${prop.collection}]`);
            }
            batchNoResult++;
            noResultCount++;
          }
        }
        if (batchNoResult > 0) {
          console.log(`   📝 Processed ${batchNoResult} properties with no Apify result`);
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
    console.log('✅ [CRON] Status refresh complete (UNIFIED)');
    console.log('='.repeat(60));
    console.log(`📊 COLLECTIONS PROCESSED:`);
    console.log(`   Owner Finance (zillow_imports): ${ownerFinanceCount} properties`);
    console.log(`   Cash Houses: ${cashHousesCount} properties`);
    console.log(`   Agent Outreach Queue: ${agentOutreachCount} properties`);
    console.log(`   Total: ${properties.length} properties`);
    console.log('');
    console.log(`📈 RESULTS:`);
    console.log(`   Updated with fresh data: ${updated}`);
    console.log(`   No Apify result (URL invalid/removed): ${noResultCount}`);
    console.log(`   Status changes: ${statusChanged}`);
    console.log(`   Deleted (inactive/sold): ${deleted}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   ✓ All ${updated + noResultCount + deleted} properties processed`);
    console.log('');
    console.log('💰 CASH DEALS DISCOVERY (from owner finance):');
    console.log(`   New cash deals found: ${cashDealsFound}`);
    console.log(`   Needs work properties: ${needsWorkFound}`);
    console.log(`   Total added to cash_houses: ${cashDealsFound + needsWorkFound}`);

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
      message: 'Status refresh complete (UNIFIED - Owner Finance + Cash Houses + Agent Outreach)',
      stats: {
        // Collection breakdown
        collections: {
          ownerFinance: ownerFinanceCount,
          cashHouses: cashHousesCount,
          agentOutreach: agentOutreachCount,
          total: properties.length,
        },
        // Processing results
        updated,
        noResult: noResultCount,
        statusChanged,
        deleted,
        errors,
        allProcessed: updated + noResultCount + deleted,
        statusChanges: statusChanges.length > 0 ? statusChanges : undefined,
        deletedProperties: deletedProperties.length > 0 ? deletedProperties : undefined,
        // Cash deals discovery stats (from owner finance only)
        cashDeals: {
          newDealsFound: cashDealsFound,
          needsWorkFound: needsWorkFound,
          totalAdded: cashDealsFound + needsWorkFound,
          deals: newCashDeals.length > 0 ? newCashDeals : undefined,
        },
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
