import { ApifyClient } from 'apify-client';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sanitizeDescription } from '../src/lib/description-sanitizer';
import * as dotenv from 'dotenv';

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

async function processManually() {
  console.log('💰 [MANUAL] Starting cash deals processing...\n');

  // Get ALL pending items (fetch in batches to avoid memory issues)
  let allPendingDocs: any[] = [];
  let lastDoc: any = null;
  let fetchMore = true;

  while (fetchMore && allPendingDocs.length < 25) {
    let query = db.collection('cash_deals_queue').limit(100);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const batch = await query.get();

    if (batch.empty) {
      fetchMore = false;
    } else {
      const pending = batch.docs.filter(doc => doc.data().status === 'pending');
      allPendingDocs.push(...pending);
      lastDoc = batch.docs[batch.docs.length - 1];

      if (batch.docs.length < 100 || allPendingDocs.length >= 25) {
        fetchMore = false;
      }
    }
  }

  const pendingDocs = allPendingDocs.slice(0, 25);

  if (pendingDocs.length === 0) {
    console.log('✅ No pending items in queue\n');
    return;
  }

  const urls = pendingDocs.map(doc => doc.data().url);

  console.log(`📋 Processing ${urls.length} URLs from queue\n`);

  // Mark as processing
  const batch = db.batch();
  pendingDocs.forEach(doc => {
    batch.update(doc.ref, {
      status: 'processing',
      processingStartedAt: new Date(),
    });
  });
  await batch.commit();

  // Call Apify
  const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });
  const actorId = 'maxcopell/zillow-detail-scraper';

  console.log(`🚀 [APIFY] Starting scraper with ${urls.length} URLs\n`);

  const input = { startUrls: urls.map(url => ({ url })) };
  const run = await client.actor(actorId).start(input);

  console.log(`⏳ [APIFY] Waiting for run to complete...\n`);
  const finishedRun = await client.run(run.id).waitForFinish({ waitSecs: 240 });

  console.log(`✓ [APIFY] Run completed: ${finishedRun.status}\n`);

  // Get results
  const { items } = await client.dataset(finishedRun.defaultDatasetId).listItems({
    clean: false,
    limit: 1000,
  });

  console.log(`📦 [APIFY] Received ${items.length} items\n`);

  // Filter and save
  const firestoreBatch = db.batch();
  let savedCount = 0;
  let filteredOutCount = 0;
  let missingDataCount = 0;

  items.forEach((item: any) => {
    const propertyData = transformProperty(item);

    if (!propertyData.price || !propertyData.estimate) {
      console.log(`⚠️  Missing data: ${propertyData.zpid}`);
      missingDataCount++;
      return;
    }

    const eightyPercent = propertyData.estimate * 0.8;

    if (propertyData.price < eightyPercent) {
      const discount = ((propertyData.estimate - propertyData.price) / propertyData.estimate * 100).toFixed(2);
      console.log(`✅ CASH DEAL: ${propertyData.fullAddress}`);
      console.log(`   Price: $${propertyData.price.toLocaleString()}, Zestimate: $${propertyData.estimate.toLocaleString()} (${discount}% off)\n`);

      propertyData.discountPercentage = parseFloat(discount);
      propertyData.eightyPercentOfZestimate = Math.round(eightyPercent);

      const docRef = db.collection('cash_houses').doc();
      firestoreBatch.set(docRef, propertyData);
      savedCount++;
    } else {
      const discount = ((propertyData.estimate - propertyData.price) / propertyData.estimate * 100).toFixed(2);
      console.log(`❌ Filtered: ${propertyData.fullAddress} (only ${discount}% off)`);
      filteredOutCount++;
    }
  });

  await firestoreBatch.commit();

  // Mark queue items as completed
  const completeBatch = db.batch();
  pendingDocs.forEach(doc => {
    completeBatch.update(doc.ref, {
      status: 'completed',
      completedAt: new Date(),
    });
  });
  await completeBatch.commit();

  console.log(`\n📊 SUMMARY:`);
  console.log(`✅ Saved: ${savedCount} cash deals`);
  console.log(`❌ Filtered out: ${filteredOutCount} (didn't meet 80% criteria)`);
  console.log(`⚠️  Missing data: ${missingDataCount}\n`);
}

function transformProperty(apifyData: any) {
  const timestamp = new Date();
  const addressObj = apifyData.address || {};
  const streetAddress = addressObj.streetAddress || apifyData.streetAddress || '';
  const city = addressObj.city || apifyData.city || '';
  const state = addressObj.state || apifyData.state || '';
  const zipCode = addressObj.zipcode || apifyData.zipcode || addressObj.zip || '';
  const fullAddress = `${streetAddress}, ${city}, ${state} ${zipCode}`.trim();

  let fullUrl = apifyData.url || '';
  if (!fullUrl || !fullUrl.startsWith('http')) {
    if (apifyData.hdpUrl) {
      fullUrl = `https://www.zillow.com${apifyData.hdpUrl}`;
    } else if (apifyData.zpid) {
      fullUrl = `https://www.zillow.com/homedetails/${apifyData.zpid}_zpid/`;
    }
  }

  let agentPhone = apifyData.attributionInfo?.agentPhoneNumber || apifyData.agentPhoneNumber || '';
  if (!agentPhone && apifyData.contactFormRenderData?.data?.agent_module?.phone) {
    const phoneObj = apifyData.contactFormRenderData.data.agent_module.phone;
    if (phoneObj.areacode && phoneObj.prefix && phoneObj.number) {
      agentPhone = `${phoneObj.areacode}-${phoneObj.prefix}-${phoneObj.number}`;
    }
  }

  const brokerPhone = apifyData.attributionInfo?.brokerPhoneNumber || '';
  const finalAgentPhone = agentPhone || brokerPhone;

  const agentName = apifyData.attributionInfo?.agentName || apifyData.agentName || '';
  const brokerName = apifyData.attributionInfo?.brokerName || '';

  const propertyImages = Array.isArray(apifyData.responsivePhotos)
    ? apifyData.responsivePhotos.map((p: any) => p.url).filter(Boolean)
    : Array.isArray(apifyData.photos)
    ? apifyData.photos.map((p: any) => typeof p === 'string' ? p : p.url || p.href).filter(Boolean)
    : [];

  const firstPropertyImage = apifyData.desktopWebHdpImageLink
    || apifyData.hiResImageLink
    || (propertyImages.length > 0 ? propertyImages[0] : '');

  return {
    url: fullUrl,
    hdpUrl: apifyData.hdpUrl || '',
    fullAddress,
    streetAddress,
    city,
    state,
    zipCode,
    zpid: apifyData.zpid || 0,
    bedrooms: apifyData.bedrooms || apifyData.beds || 0,
    bathrooms: apifyData.bathrooms || apifyData.baths || 0,
    squareFoot: apifyData.livingArea || apifyData.livingAreaValue || 0,
    homeType: apifyData.homeType || '',
    homeStatus: apifyData.homeStatus || '',
    yearBuilt: apifyData.yearBuilt || 0,
    lotSquareFoot: apifyData.lotSize || apifyData.lotAreaValue || 0,
    price: apifyData.price || apifyData.listPrice || 0,
    estimate: apifyData.zestimate || apifyData.homeValue || 0,
    rentEstimate: apifyData.rentZestimate || 0,
    description: sanitizeDescription(apifyData.description),
    agentName,
    agentPhoneNumber: finalAgentPhone,
    brokerName,
    brokerPhoneNumber: brokerPhone,
    propertyImages,
    firstPropertyImage,
    source: 'apify-zillow-cash-deals',
    importedAt: timestamp,
    scrapedAt: timestamp,
  };
}

processManually().catch(console.error);
