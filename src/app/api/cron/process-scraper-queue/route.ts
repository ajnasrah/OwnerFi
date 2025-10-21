import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
  console.log('🔄 [QUEUE CRON] Starting queue processor');

  try {
    // Find pending items in queue (limit to 15 for faster processing)
    const pendingItems = await db
      .collection('scraper_queue')
      .where('status', '==', 'pending')
      .orderBy('addedAt', 'asc')
      .limit(15)
      .get();

    if (pendingItems.empty) {
      console.log('✅ [QUEUE CRON] No pending items in queue');
      return NextResponse.json({ message: 'No pending items in queue' });
    }

    const urls = pendingItems.docs.map(doc => doc.data().url);
    const docIds = pendingItems.docs.map(doc => doc.id);

    console.log(`📋 [QUEUE CRON] Processing ${urls.length} URLs from queue`);

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
    const run = await client.actor(actorId).call(input);

    console.log(`✓ [APIFY] Run completed: ${run.id}`);

    // Get results (no fields filter to get ALL data)
    const { items } = await client.dataset(run.defaultDatasetId).listItems({
      clean: false,
      limit: 1000,
    });

    console.log(`📦 [APIFY] Received ${items.length} items`);

    // Transform and save to Firebase
    const firestoreBatch = db.batch();
    let savedCount = 0;
    let skippedCount = 0;

    items.forEach((item: any) => {
      const propertyData = transformProperty(item);

      // Log contact info status for debugging
      if (!propertyData.agentPhoneNumber && !propertyData.brokerPhoneNumber) {
        console.log(`⚠️ No contact info for ZPID ${propertyData.zpid} - saving anyway`);
      }

      const docRef = db.collection('zillow_imports').doc();
      firestoreBatch.set(docRef, propertyData);
      savedCount++;
    });

    await firestoreBatch.commit();

    console.log(`✅ [FIREBASE] Saved ${savedCount} properties`);

    // Send properties with contact info to GHL webhook immediately
    const GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/U2B5lSlWrVBgVxHNq5AH/webhook-trigger/2be65188-9b2e-43f1-a9d8-33d9907b375c';

    const propertiesWithContact = items
      .map((item: any) => transformProperty(item))
      .filter((prop: any) => prop.agentPhoneNumber || prop.brokerPhoneNumber);

    console.log(`\n📤 [GHL WEBHOOK] Sending ${propertiesWithContact.length} properties with contact info`);

    let webhookSuccess = 0;
    let webhookFailed = 0;
    const webhookResults: any[] = [];

    for (const property of propertiesWithContact) {
      try {
        const webhookData = {
          property_id: property.zpid || '',
          full_address: property.fullAddress || '',
          street_address: property.streetAddress || '',
          city: property.city || '',
          state: property.state || '',
          zip: property.zipCode || '',
          bedrooms: property.bedrooms || 0,
          bathrooms: property.bathrooms || 0,
          square_foot: property.squareFoot || 0,
          building_type: property.buildingType || property.homeType || '',
          year_built: property.yearBuilt || 0,
          lot_square_foot: property.lotSquareFoot || 0,
          estimate: property.estimate || 0,
          hoa: property.hoa || 0,
          description: property.description || '',
          agent_name: property.agentName || '',
          agent_phone_number: property.agentPhoneNumber || property.brokerPhoneNumber || '',
          annual_tax_amount: property.annualTaxAmount || 0,
          price: property.price || 0,
          zillow_url: property.url || '',
          property_image: property.firstPropertyImage || '',
          broker_name: property.brokerName || '',
          broker_phone: property.brokerPhoneNumber || '',
        };

        const response = await fetch(GHL_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookData),
        });

        if (!response.ok) {
          throw new Error(`${response.status}: ${await response.text()}`);
        }

        webhookSuccess++;
        webhookResults.push({
          zpid: property.zpid,
          address: property.fullAddress,
          status: 'success',
        });

        // Update Firebase with GHL send status
        const docQuery = await db.collection('zillow_imports')
          .where('zpid', '==', property.zpid)
          .limit(1)
          .get();

        if (!docQuery.empty) {
          await docQuery.docs[0].ref.update({
            sentToGHL: true,
            ghlSentAt: new Date(),
            ghlSendStatus: 'success',
          });
        }

        console.log(`✅ Sent: ${property.fullAddress} (${property.agentPhoneNumber})`);

        // Small delay to avoid overwhelming webhook
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        webhookFailed++;
        webhookResults.push({
          zpid: property.zpid,
          address: property.fullAddress,
          status: 'failed',
          error: error.message,
        });

        // Update Firebase with failure status
        const docQuery = await db.collection('zillow_imports')
          .where('zpid', '==', property.zpid)
          .limit(1)
          .get();

        if (!docQuery.empty) {
          await docQuery.docs[0].ref.update({
            sentToGHL: false,
            ghlSendStatus: 'failed',
            ghlSendError: error.message,
          });
        }

        console.error(`❌ Failed: ${property.fullAddress} - ${error.message}`);
      }
    }

    console.log(`\n📊 [GHL WEBHOOK] Success: ${webhookSuccess}, Failed: ${webhookFailed}`);

    // Mark queue items as completed
    const completeBatch = db.batch();
    pendingItems.docs.forEach(doc => {
      completeBatch.update(doc.ref, {
        status: 'completed',
        completedAt: new Date(),
      });
    });
    await completeBatch.commit();

    console.log(`✅ [QUEUE CRON] Completed processing ${urls.length} URLs`);

    return NextResponse.json({
      success: true,
      processed: urls.length,
      saved: savedCount,
      webhookSent: webhookSuccess,
      webhookFailed: webhookFailed,
      webhookResults,
    });

  } catch (error: any) {
    console.error('❌ [QUEUE CRON] Error:', error);
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

  // ===== CONSTRUCT FULL URL =====
  let fullUrl = apifyData.url || '';
  if (!fullUrl || !fullUrl.startsWith('http')) {
    // If url is missing or relative, construct from hdpUrl or zpid
    if (apifyData.hdpUrl) {
      fullUrl = `https://www.zillow.com${apifyData.hdpUrl}`;
    } else if (apifyData.zpid) {
      fullUrl = `https://www.zillow.com/homedetails/${apifyData.zpid}_zpid/`;
    }
  }

  // ===== ENHANCED AGENT/BROKER EXTRACTION =====
  // Try attributionInfo first
  let agentPhone = apifyData.attributionInfo?.agentPhoneNumber
    || apifyData.agentPhoneNumber
    || apifyData.agentPhone
    || '';

  // If not found, try contactFormRenderData (nested structure)
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

  // Log extraction
  console.log(`✓ [TRANSFORM] ZPID ${apifyData.zpid}: ${agentName || 'No agent'} | ${finalAgentPhone || 'No phone'}`);

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
    description: apifyData.description || '',

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

    // GHL webhook tracking
    sentToGHL: false,
    ghlSentAt: null,
    ghlSendStatus: null,
    ghlSendError: null,
  };
}
