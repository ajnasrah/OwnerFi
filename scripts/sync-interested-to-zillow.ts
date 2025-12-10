/**
 * Sync "Interested" Contacted Agents to zillow_imports
 *
 * This script finds properties in contacted_agents that are marked as "Interested"
 * (verified owner finance) but don't have Zillow data, scrapes them from Zillow,
 * and adds them to zillow_imports so they appear on the website and get monitored.
 *
 * Usage:
 *   npx tsx scripts/sync-interested-to-zillow.ts
 *   npx tsx scripts/sync-interested-to-zillow.ts --dry-run
 */

import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ApifyClient } from 'apify-client';

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

const DRY_RUN = process.argv.includes('--dry-run');

interface ContactedAgent {
  id: string;
  propertyAddress: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  stage?: string;
  status?: string;
}

async function findInterestedNotInZillow(): Promise<ContactedAgent[]> {
  console.log('🔍 Finding "Interested" properties not in zillow_imports...\n');

  // Get all contacted_agents
  const contactedSnapshot = await db.collection('contacted_agents').get();
  console.log(`   Total in contacted_agents: ${contactedSnapshot.size}`);

  // Filter to "Interested" stage (various formats)
  const interestedContacts: ContactedAgent[] = [];
  for (const doc of contactedSnapshot.docs) {
    const data = doc.data();
    const stage = (data.stage || '').toLowerCase();

    // Match "Interested" stage - exclude "not interested"
    // Stage values in DB: '"Interested "', '"not interested "', '"pending "'
    const isInterested = stage.includes('interested') && !stage.includes('not interested');

    if (isInterested) {
      interestedContacts.push({
        id: doc.id,
        propertyAddress: data.propertyAddress || '',
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        stage: data.stage,
        status: data.status,
      });
    }
  }

  console.log(`   "Interested" properties: ${interestedContacts.length}`);

  if (interestedContacts.length === 0) {
    return [];
  }

  // Get all addresses from zillow_imports
  const zillowSnapshot = await db.collection('zillow_imports').get();
  const zillowAddresses = new Set<string>();

  for (const doc of zillowSnapshot.docs) {
    const data = doc.data();
    const addr = (data.fullAddress || data.address || data.streetAddress || '').toLowerCase().trim();
    if (addr) {
      // Normalize for comparison
      zillowAddresses.add(normalizeAddress(addr));
    }
  }

  console.log(`   Properties in zillow_imports: ${zillowSnapshot.size}`);

  // Find interested properties NOT in zillow_imports
  const notInZillow = interestedContacts.filter(contact => {
    const normalizedAddr = normalizeAddress(contact.propertyAddress);
    return !zillowAddresses.has(normalizedAddr);
  });

  console.log(`   "Interested" NOT in zillow_imports: ${notInZillow.length}`);

  return notInZillow;
}

function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .trim()
    .replace(/[#,\.]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|circle|cir|boulevard|blvd|way|place|pl)\b/gi, '')
    .trim();
}

async function searchZillowByAddress(address: string): Promise<string | null> {
  console.log(`   🔎 Searching Zillow for: ${address}`);

  const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });

  try {
    // Use Zillow search scraper to find by address
    // Format search URL like: https://www.zillow.com/homes/665-Lancelot-Ln_rb/
    const searchUrl = `https://www.zillow.com/homes/${address.replace(/[,#]/g, '').replace(/\s+/g, '-')}_rb/`;

    const run = await client.actor('maxcopell/zillow-scraper').call({
      startUrls: [{ url: searchUrl }],
      maxItems: 5,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 5 });

    if (items.length === 0) {
      console.log(`      ❌ No Zillow results for: ${address}`);
      return null;
    }

    // Find best match
    const normalizedSearch = normalizeAddress(address);
    for (const item of items as any[]) {
      const itemAddr = item.address || item.streetAddress || '';
      if (normalizeAddress(itemAddr).includes(normalizedSearch.split(' ')[0])) {
        const url = item.detailUrl || item.url || `https://www.zillow.com/homedetails/${item.zpid}_zpid/`;
        console.log(`      ✅ Found: ${url}`);
        return url;
      }
    }

    // Return first result if no exact match
    const firstItem = items[0] as any;
    const url = firstItem.detailUrl || firstItem.url || (firstItem.zpid ? `https://www.zillow.com/homedetails/${firstItem.zpid}_zpid/` : null);
    if (url) {
      console.log(`      ✅ Found (first result): ${url}`);
    }
    return url;

  } catch (error: any) {
    console.log(`      ❌ Search error: ${error.message}`);
    return null;
  }
}

async function scrapeZillowDetails(url: string): Promise<any | null> {
  console.log(`   📥 Scraping property details...`);

  const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });

  try {
    const run = await client.actor('maxcopell/zillow-detail-scraper').call({
      startUrls: [{ url }],
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 1 });

    if (items.length === 0) {
      console.log(`      ❌ No details returned`);
      return null;
    }

    console.log(`      ✅ Got property details`);
    return items[0];

  } catch (error: any) {
    console.log(`      ❌ Scrape error: ${error.message}`);
    return null;
  }
}

async function addToZillowImports(
  contactedAgent: ContactedAgent,
  zillowData: any
): Promise<boolean> {
  if (DRY_RUN) {
    console.log(`   [DRY RUN] Would add to zillow_imports: ${contactedAgent.propertyAddress}`);
    return true;
  }

  try {
    const zpid = zillowData.zpid || zillowData.id;
    const url = zillowData.url || `https://www.zillow.com/homedetails/${zpid}_zpid/`;

    // Check if already exists by zpid
    const existing = await db.collection('zillow_imports')
      .where('zpid', '==', zpid)
      .limit(1)
      .get();

    if (!existing.empty) {
      console.log(`   ⚠️  ZPID ${zpid} already in zillow_imports, skipping`);
      return false;
    }

    // Build address
    const streetAddress = zillowData.address?.streetAddress || zillowData.streetAddress || contactedAgent.propertyAddress;
    const city = zillowData.address?.city || zillowData.city || '';
    const state = zillowData.address?.state || zillowData.state || '';
    const zipCode = zillowData.address?.zipcode || zillowData.zipCode || '';
    const fullAddress = `${streetAddress}, ${city}, ${state} ${zipCode}`.trim().replace(/,\s*,/g, ',');

    await db.collection('zillow_imports').add({
      // Core identifiers
      zpid: zpid,
      url: url,

      // Address
      streetAddress,
      fullAddress,
      city,
      state,
      zipCode,

      // Pricing
      price: zillowData.price || zillowData.listPrice || 0,
      listPrice: zillowData.listPrice || zillowData.price || 0,
      zestimate: zillowData.zestimate || zillowData.estimate || null,

      // Property details
      bedrooms: zillowData.bedrooms ?? null,
      bathrooms: zillowData.bathrooms ?? null,
      livingArea: zillowData.livingArea || zillowData.livingAreaValue || zillowData.squareFoot || null,
      lotSquareFoot: zillowData.lotAreaValue || zillowData.lotSize || null,
      yearBuilt: zillowData.yearBuilt ?? null,
      homeType: zillowData.homeType || zillowData.propertyType || 'SINGLE_FAMILY',
      homeStatus: zillowData.homeStatus || 'FOR_SALE',

      // Location
      latitude: zillowData.latitude ?? null,
      longitude: zillowData.longitude ?? null,

      // Description
      description: zillowData.description || '',

      // Agent info (from contacted_agents - more reliable)
      agentName: contactedAgent.contactName || zillowData.attributionInfo?.agentName || zillowData.agentName,
      agentPhoneNumber: contactedAgent.contactPhone || zillowData.attributionInfo?.agentPhoneNumber || zillowData.agentPhoneNumber,
      agentEmail: contactedAgent.contactEmail || zillowData.attributionInfo?.agentEmail,

      // Images
      firstPropertyImage: zillowData.hiResImageLink || zillowData.imgSrc,
      propertyImages: zillowData.propertyImages || [],

      // Estimates
      estimate: zillowData.zestimate || zillowData.estimate || null,
      rentEstimate: zillowData.rentZestimate || zillowData.rentEstimate || null,

      // Costs
      hoa: zillowData.monthlyHoaFee || zillowData.hoaFee || 0,
      annualTaxAmount: zillowData.annualTaxAmount ?? null,

      // Source tracking - CRITICAL FLAGS
      source: 'agent_outreach',
      agentConfirmedOwnerFinance: true,
      agentConfirmedAt: new Date(),
      ownerFinanceVerified: true,
      isActive: true,

      // Link back to contacted_agents
      contactedAgentId: contactedAgent.id,

      // Financing type (default since agent confirmed)
      financingType: 'Owner Finance',
      allFinancingTypes: ['Owner Finance'],
      financingTypeLabel: 'Owner Finance',

      // Timestamps
      importedAt: new Date(),
      foundAt: new Date(),
      lastStatusCheck: new Date(),
      lastScrapedAt: new Date(),
    });

    // Update contacted_agents with zpid for future reference
    await db.collection('contacted_agents').doc(contactedAgent.id).update({
      zpid: zpid,
      url: url,
      syncedToZillowImports: true,
      syncedAt: new Date(),
    });

    console.log(`   ✅ Added to zillow_imports: ${fullAddress}`);
    return true;

  } catch (error: any) {
    console.log(`   ❌ Error adding to zillow_imports: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🔄 SYNC INTERESTED CONTACTS TO ZILLOW IMPORTS');
  console.log('='.repeat(60));
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  // Find properties to sync
  const toSync = await findInterestedNotInZillow();

  if (toSync.length === 0) {
    console.log('\n✅ No "Interested" properties need syncing');
    return;
  }

  console.log(`\n📋 Properties to sync: ${toSync.length}`);
  toSync.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.propertyAddress} (${p.contactName})`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('🔄 PROCESSING PROPERTIES');
  console.log('='.repeat(60) + '\n');

  let synced = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < toSync.length; i++) {
    const contact = toSync[i];
    console.log(`\n[${i + 1}/${toSync.length}] ${contact.propertyAddress}`);

    // Search Zillow by address
    const zillowUrl = await searchZillowByAddress(contact.propertyAddress);

    if (!zillowUrl) {
      notFound++;
      continue;
    }

    // Scrape property details
    const zillowData = await scrapeZillowDetails(zillowUrl);

    if (!zillowData) {
      errors++;
      continue;
    }

    // Add to zillow_imports
    const success = await addToZillowImports(contact, zillowData);

    if (success) {
      synced++;
    } else {
      errors++;
    }

    // Small delay between properties
    if (i < toSync.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`   Synced to zillow_imports: ${synced}`);
  console.log(`   Not found on Zillow: ${notFound}`);
  console.log(`   Errors: ${errors}`);
  console.log('='.repeat(60) + '\n');
}

main().then(() => process.exit(0)).catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
