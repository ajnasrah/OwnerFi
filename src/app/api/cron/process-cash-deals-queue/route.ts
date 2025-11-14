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
  console.log('💰 [CASH DEALS CRON] Starting queue processor');

  try {
    // Reset stuck processing items (older than 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const stuckItems = await db
      .collection('cash_deals_queue')
      .where('status', '==', 'processing')
      .get();

    if (!stuckItems.empty) {
      const resetBatch = db.batch();
      let resetCount = 0;

      stuckItems.docs.forEach(doc => {
        const data = doc.data();
        const processingStartedAt = data.processingStartedAt?.toDate?.();

        if (!processingStartedAt || processingStartedAt < tenMinutesAgo) {
          resetBatch.update(doc.ref, {
            status: 'pending',
            processingStartedAt: null,
          });
          resetCount++;
        }
      });

      if (resetCount > 0) {
        await resetBatch.commit();
        console.log(`🔄 [CASH DEALS] Reset ${resetCount} stuck items back to pending`);
      }
    }

    // Find pending items in queue (limit to 25 for optimal processing)
    const pendingItems = await db
      .collection('cash_deals_queue')
      .where('status', '==', 'pending')
      .orderBy('addedAt', 'asc')
      .limit(25)
      .get();

    if (pendingItems.empty) {
      console.log('✅ [CASH DEALS] No pending items in queue');
      return NextResponse.json({ message: 'No pending items in cash deals queue' });
    }

    const urls = pendingItems.docs.map(doc => doc.data().url);
    const docIds = pendingItems.docs.map(doc => doc.id);

    console.log(`📋 [CASH DEALS] Processing ${urls.length} URLs from queue`);

    // Mark as processing
    const batch = db.batch();
    pendingItems.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'processing',
        processingStartedAt: new Date(),
      });
    });
    await batch.commit();

    // Call Apify to scrape
    const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });
    const actorId = 'maxcopell/zillow-detail-scraper';

    console.log(`🚀 [APIFY] Starting scraper with ${urls.length} URLs`);

    const input = { startUrls: urls.map(url => ({ url })) };

    // Start the run but don't wait for it to finish
    const run = await client.actor(actorId).start(input);
    console.log(`✓ [APIFY] Run started: ${run.id}`);

    // Wait for the run to finish with a timeout
    console.log(`⏳ [APIFY] Waiting for run to complete...`);
    const finishedRun = await client.run(run.id).waitForFinish({ waitSecs: 240 }); // 4 minute max wait

    console.log(`✓ [APIFY] Run completed: ${finishedRun.id} (status: ${finishedRun.status})`);

    // Get results (no fields filter to get ALL data)
    const { items } = await client.dataset(finishedRun.defaultDatasetId).listItems({
      clean: false,
      limit: 1000,
    });

    console.log(`📦 [APIFY] Received ${items.length} items`);

    // Filter and save to Firebase - ONLY properties with price < 80% of Zestimate
    const firestoreBatch = db.batch();
    let savedCount = 0;
    let filteredOutCount = 0;
    let missingZestimateCount = 0;
    const savedProperties: Array<{ docRef: any, data: any }> = [];

    items.forEach((item: any) => {
      const propertyData = transformProperty(item);

      // Check if we have both price and zestimate
      if (!propertyData.price || !propertyData.estimate) {
        console.log(`⚠️ Missing price or zestimate for ${propertyData.zpid} - filtering out`);
        missingZestimateCount++;
        return;
      }

      // Calculate 80% of Zestimate
      const eightyPercentOfZestimate = propertyData.estimate * 0.8;

      // Only save if price is less than 80% of Zestimate
      if (propertyData.price < eightyPercentOfZestimate) {
        const discountPercentage = ((propertyData.estimate - propertyData.price) / propertyData.estimate * 100).toFixed(2);
        console.log(`✅ CASH DEAL: ${propertyData.fullAddress} - Price: $${propertyData.price.toLocaleString()}, Zestimate: $${propertyData.estimate.toLocaleString()} (${discountPercentage}% discount)`);

        // Add discount percentage to the data
        propertyData.discountPercentage = parseFloat(discountPercentage);
        propertyData.eightyPercentOfZestimate = Math.round(eightyPercentOfZestimate);

        const docRef = db.collection('cash_houses').doc();
        firestoreBatch.set(docRef, propertyData);
        savedProperties.push({ docRef, data: propertyData });
        savedCount++;
      } else {
        const discountPercentage = ((propertyData.estimate - propertyData.price) / propertyData.estimate * 100).toFixed(2);
        console.log(`❌ FILTERED OUT: ${propertyData.fullAddress} - Price: $${propertyData.price.toLocaleString()}, Zestimate: $${propertyData.estimate.toLocaleString()} (only ${discountPercentage}% discount)`);
        filteredOutCount++;
      }
    });

    await firestoreBatch.commit();

    console.log(`\n📊 [CASH DEALS SUMMARY]`);
    console.log(`✅ Saved: ${savedCount} properties (price < 80% of Zestimate)`);
    console.log(`❌ Filtered out: ${filteredOutCount} properties (price >= 80% of Zestimate)`);
    console.log(`⚠️ Missing data: ${missingZestimateCount} properties (no price or zestimate)`);

    // Mark queue items as completed
    const completeBatch = db.batch();
    pendingItems.docs.forEach(doc => {
      completeBatch.update(doc.ref, {
        status: 'completed',
        completedAt: new Date(),
      });
    });
    await completeBatch.commit();

    console.log(`✅ [CASH DEALS] Completed processing ${urls.length} URLs`);

    return NextResponse.json({
      success: true,
      processed: urls.length,
      saved: savedCount,
      filteredOut: filteredOutCount,
      missingData: missingZestimateCount,
      properties: savedProperties.map(p => ({
        zpid: p.data.zpid,
        address: p.data.fullAddress,
        price: p.data.price,
        zestimate: p.data.estimate,
        discountPercentage: p.data.discountPercentage,
      })),
    });

  } catch (error: any) {
    console.error('❌ [CASH DEALS CRON] Error:', error);
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

  // Construct full URL
  let fullUrl = apifyData.url || '';
  if (!fullUrl || !fullUrl.startsWith('http')) {
    if (apifyData.hdpUrl) {
      fullUrl = `https://www.zillow.com${apifyData.hdpUrl}`;
    } else if (apifyData.zpid) {
      fullUrl = `https://www.zillow.com/homedetails/${apifyData.zpid}_zpid/`;
    }
  }

  // Extract agent/broker info
  let agentPhone = apifyData.attributionInfo?.agentPhoneNumber
    || apifyData.agentPhoneNumber
    || apifyData.agentPhone
    || '';

  if (!agentPhone && apifyData.contactFormRenderData?.data?.agent_module?.phone) {
    const phoneObj = apifyData.contactFormRenderData.data.agent_module.phone;
    if (phoneObj.areacode && phoneObj.prefix && phoneObj.number) {
      agentPhone = `${phoneObj.areacode}-${phoneObj.prefix}-${phoneObj.number}`;
    }
  }

  const brokerPhone = apifyData.attributionInfo?.brokerPhoneNumber
    || apifyData.brokerPhoneNumber
    || apifyData.brokerPhone
    || '';

  const finalAgentPhone = agentPhone || brokerPhone;

  const agentName = apifyData.attributionInfo?.agentName
    || apifyData.agentName
    || apifyData.listingAgent
    || (Array.isArray(apifyData.attributionInfo?.listingAgents) && apifyData.attributionInfo.listingAgents[0]?.memberFullName)
    || apifyData.contactFormRenderData?.data?.agent_module?.display_name
    || '';

  const brokerName = apifyData.attributionInfo?.brokerName
    || apifyData.brokerName
    || apifyData.brokerageName
    || (Array.isArray(apifyData.attributionInfo?.listingOffices) && apifyData.attributionInfo.listingOffices[0]?.officeName)
    || '';

  // Extract images
  const propertyImages = Array.isArray(apifyData.responsivePhotos)
    ? apifyData.responsivePhotos.map((p: any) => p.url).filter(Boolean)
    : Array.isArray(apifyData.photos)
    ? apifyData.photos.map((p: any) => typeof p === 'string' ? p : p.url || p.href).filter(Boolean)
    : Array.isArray(apifyData.images)
    ? apifyData.images
    : [];

  const firstPropertyImage = apifyData.desktopWebHdpImageLink
    || apifyData.hiResImageLink
    || apifyData.mediumImageLink
    || (propertyImages.length > 0 ? propertyImages[0] : '')
    || '';

  return {
    url: fullUrl,
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
    description: sanitizeDescription(apifyData.description),

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
    source: 'apify-zillow-cash-deals',
    importedAt: timestamp,
    scrapedAt: timestamp,
  };
}
