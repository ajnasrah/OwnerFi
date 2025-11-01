import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sanitizeDescription } from '@/lib/description-sanitizer';

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

export async function GET(request: NextRequest) {
  console.log('🔄 [CRON] Zillow scraper worker started');

  try {
    // Find pending jobs
    const pendingJobs = await db
      .collection('scraper_jobs')
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (pendingJobs.empty) {
      console.log('✅ [CRON] No pending jobs');
      return NextResponse.json({ message: 'No pending jobs' });
    }

    const jobDoc = pendingJobs.docs[0];
    const jobId = jobDoc.id;
    const jobData = jobDoc.data();

    console.log(`📋 [CRON] Processing job ${jobId} with ${jobData.urls.length} URLs`);

    // Mark as processing
    await jobDoc.ref.update({
      status: 'processing',
      startedAt: new Date(),
    });

    const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });
    const actorId = 'maxcopell/zillow-detail-scraper';

    const urls: string[] = jobData.urls || [];
    const batchSize = 50;
    let imported = 0;

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);

      console.log(`🚀 [APIFY] Starting batch ${i / batchSize + 1} with ${batch.length} URLs`);

      // Run Apify
      const input = { startUrls: batch.map(url => ({ url })) };
      const run = await client.actor(actorId).call(input);

      console.log(`✓ [APIFY] Run completed: ${run.id}`);

      // Get ALL data (no fields filter)
      const { items } = await client.dataset(run.defaultDatasetId).listItems({
        clean: false,
        limit: 1000,
      });

      console.log(`📦 [APIFY] Received ${items.length} items`);

      // Save to Firebase
      const firestoreBatch = db.batch();
      items.forEach((item: any) => {
        const propertyData = transformProperty(item);
        const docRef = db.collection('zillow_imports').doc();
        firestoreBatch.set(docRef, propertyData);
      });

      await firestoreBatch.commit();
      imported += items.length;

      console.log(`✅ [BATCH] Saved ${items.length} properties (${imported}/${urls.length} total)`);

      // Update progress
      const progress = Math.round((imported / urls.length) * 100);
      await jobDoc.ref.update({
        imported,
        progress,
      });
    }

    // Mark complete
    await jobDoc.ref.update({
      status: 'complete',
      completedAt: new Date(),
    });

    console.log(`✅ [CRON] Job ${jobId} completed: ${imported} properties imported`);

    return NextResponse.json({
      success: true,
      jobId,
      imported,
    });

  } catch (error: any) {
    console.error('❌ [CRON] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

function transformProperty(apifyData: any) {
  const timestamp = new Date();
  const addressObj = apifyData.address || {};
  const streetAddress = addressObj.streetAddress || apifyData.streetAddress || '';
  const city = addressObj.city || apifyData.city || '';
  const state = addressObj.state || apifyData.state || '';
  const zipCode = addressObj.zipcode || apifyData.zipcode || addressObj.zip || '';
  const fullAddress = `${streetAddress}, ${city}, ${state} ${zipCode}`.trim();

  // ===== ENHANCED AGENT/BROKER EXTRACTION =====
  // Try multiple paths for agent phone
  const agentPhone = apifyData.attributionInfo?.agentPhoneNumber
    || apifyData.agentPhoneNumber
    || apifyData.agentPhone
    || '';

  // Try multiple paths for broker phone
  const brokerPhone = apifyData.attributionInfo?.brokerPhoneNumber
    || apifyData.brokerPhoneNumber
    || apifyData.brokerPhone
    || '';

  // Use broker phone as fallback if agent phone is missing
  const finalAgentPhone = agentPhone || brokerPhone;

  // Extract agent name from multiple sources
  const agentName = apifyData.attributionInfo?.agentName
    || apifyData.agentName
    || apifyData.listingAgent
    || (Array.isArray(apifyData.attributionInfo?.listingAgents) && apifyData.attributionInfo.listingAgents[0]?.memberFullName)
    || '';

  // Extract broker name from multiple sources
  const brokerName = apifyData.attributionInfo?.brokerName
    || apifyData.brokerName
    || apifyData.brokerageName
    || (Array.isArray(apifyData.attributionInfo?.listingOffices) && apifyData.attributionInfo.listingOffices[0]?.officeName)
    || '';

  // DEBUG LOGGING - Remove after confirming data is saving correctly
  if (!agentPhone && !brokerPhone) {
    console.log(`⚠️ [CRON] NO PHONE NUMBERS for ZPID ${apifyData.zpid}:`, {
      agentPhoneFromAttr: apifyData.attributionInfo?.agentPhoneNumber,
      brokerPhoneFromAttr: apifyData.attributionInfo?.brokerPhoneNumber,
      hasAttributionInfo: !!apifyData.attributionInfo
    });
  } else {
    console.log(`✓ [CRON] FOUND CONTACT for ZPID ${apifyData.zpid}:`, {
      agentName,
      agentPhone,
      brokerName,
      brokerPhone,
      finalAgentPhone
    });
  }

  // Extract images from multiple possible sources
  const propertyImages = Array.isArray(apifyData.responsivePhotos)
    ? apifyData.responsivePhotos.map((p: any) => p.url).filter(Boolean)
    : Array.isArray(apifyData.photos)
    ? apifyData.photos.map((p: any) => typeof p === 'string' ? p : p.url || p.href).filter(Boolean)
    : Array.isArray(apifyData.images)
    ? apifyData.images
    : [];

  // Get main hero image from multiple sources
  const firstPropertyImage = apifyData.desktopWebHdpImageLink
    || apifyData.hiResImageLink
    || apifyData.mediumImageLink
    || (propertyImages.length > 0 ? propertyImages[0] : '')
    || '';

  return {
    url: apifyData.url || '',
    hdpUrl: apifyData.hdpUrl || '',
    virtualTourUrl: apifyData.virtualTourUrl || apifyData.thirdPartyVirtualTour?.externalUrl || '',
    fullAddress,
    streetAddress,
    city,
    state,
    zipCode,
    county: apifyData.county || '',
    subdivision: addressObj.subdivision || '',
    neighborhood: addressObj.neighborhood || '',
    zpid: apifyData.zpid || 0,
    parcelId: apifyData.parcelId || apifyData.resoFacts?.parcelNumber || '',
    mlsId: apifyData.attributionInfo?.mlsId || apifyData.mlsid || '',
    bedrooms: apifyData.bedrooms || apifyData.beds || 0,
    bathrooms: apifyData.bathrooms || apifyData.baths || 0,
    squareFoot: apifyData.livingArea || apifyData.livingAreaValue || apifyData.squareFoot || 0,
    buildingType: apifyData.propertyTypeDimension || apifyData.buildingType || apifyData.homeType || '',
    homeType: apifyData.homeType || '',
    homeStatus: apifyData.homeStatus || '',
    yearBuilt: apifyData.yearBuilt || 0,
    lotSquareFoot: apifyData.lotSize || apifyData.lotAreaValue || apifyData.resoFacts?.lotSize || 0,
    latitude: apifyData.latitude || 0,
    longitude: apifyData.longitude || 0,
    price: apifyData.price || apifyData.listPrice || 0,
    estimate: apifyData.zestimate || apifyData.homeValue || apifyData.estimate || 0,
    rentEstimate: apifyData.rentZestimate || 0,
    hoa: apifyData.monthlyHoaFee || apifyData.hoa || 0,
    annualTaxAmount: (Array.isArray(apifyData.taxHistory) && apifyData.taxHistory.find((t: any) => t.taxPaid)?.taxPaid) || 0,
    recentPropertyTaxes: (Array.isArray(apifyData.taxHistory) && apifyData.taxHistory[0]?.value) || 0,
    propertyTaxRate: apifyData.propertyTaxRate || 0,
    annualHomeownersInsurance: apifyData.annualHomeownersInsurance || 0,
    daysOnZillow: apifyData.daysOnZillow || 0,
    datePostedString: apifyData.datePostedString || '',
    listingDataSource: apifyData.listingDataSource || '',
    description: sanitizeDescription(apifyData.description), // Clean description at source

    // ===== CRITICAL CONTACT INFORMATION =====
    agentName,
    agentPhoneNumber: finalAgentPhone,
    agentEmail: apifyData.attributionInfo?.agentEmail || apifyData.agentEmail || '',
    agentLicenseNumber: apifyData.attributionInfo?.agentLicenseNumber
      || (Array.isArray(apifyData.attributionInfo?.listingAgents) && apifyData.attributionInfo.listingAgents[0]?.memberStateLicense)
      || '',
    brokerName,
    brokerPhoneNumber: brokerPhone,

    propertyImages,
    firstPropertyImage,
    photoCount: apifyData.photoCount || propertyImages.length || 0,
    source: 'apify-zillow',
    importedAt: timestamp,
    scrapedAt: timestamp,
  };
}
