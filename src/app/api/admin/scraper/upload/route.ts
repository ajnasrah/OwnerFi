import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import * as XLSX from 'xlsx';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (if not already initialized)
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

interface PropertyURL {
  url: string;
  address?: string;
  price?: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read file
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    // Extract URLs
    let properties = extractURLs(data);

    if (properties.length === 0) {
      return NextResponse.json(
        { error: 'No valid Zillow URLs found in file' },
        { status: 400 }
      );
    }

    // Remove duplicates within the file
    const uniqueUrls = new Set<string>();
    const uniqueProperties: PropertyURL[] = [];
    let duplicatesInFile = 0;

    properties.forEach(prop => {
      if (!uniqueUrls.has(prop.url)) {
        uniqueUrls.add(prop.url);
        uniqueProperties.push(prop);
      } else {
        duplicatesInFile++;
      }
    });

    properties = uniqueProperties;

    // Check for existing properties in database
    const existingUrls = await checkExistingProperties(properties.map(p => p.url));
    const newProperties = properties.filter(p => !existingUrls.has(p.url));

    const alreadyExists = properties.length - newProperties.length;

    if (newProperties.length === 0) {
      return NextResponse.json(
        {
          error: 'All properties already exist in database',
          duplicatesInFile,
          alreadyInDatabase: alreadyExists,
          totalProcessed: properties.length
        },
        { status: 400 }
      );
    }

    // Create a job ID using batch_ prefix to match Firebase jobs
    const jobId = `batch_${Date.now()}`;

    // For small batches (<= 50), run synchronously
    // For large batches, process in background and might timeout
    if (newProperties.length <= 50) {
      console.log(`📊 [SYNC] Processing ${newProperties.length} properties synchronously`);
      try {
        await scrapeAndImport(jobId, newProperties);
      } catch (error: any) {
        console.error('❌ [ERROR] scrapeAndImport failed:', error);
        await db.collection('scraper_jobs').doc(jobId).update({
          status: 'error',
          error: error.message || 'Unknown error during scraping',
        });
      }
    } else {
      console.log(`📊 [ASYNC] Processing ${newProperties.length} properties in background (may timeout)`);
      // For large batches, start and return (may timeout)
      scrapeAndImport(jobId, newProperties).catch((error) => {
        console.error('❌ [ERROR] scrapeAndImport failed:', error);
        db.collection('scraper_jobs').doc(jobId).update({
          status: 'error',
          error: error.message || 'Unknown error during scraping',
        }).catch(console.error);
      });
    }

    return NextResponse.json({
      success: true,
      jobId,
      urlsFound: properties.length,
      duplicatesInFile,
      alreadyInDatabase: alreadyExists,
      newProperties: newProperties.length,
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process file' },
      { status: 500 }
    );
  }
}

function extractURLs(data: any[]): PropertyURL[] {
  const properties: PropertyURL[] = [];
  const urlKeys = ['url', 'URL', 'link', 'Link', 'property_url', 'Property URL'];

  data.forEach((row) => {
    let url: string | undefined;

    for (const key of urlKeys) {
      if (row[key] && typeof row[key] === 'string' && row[key].includes('zillow.com')) {
        url = row[key];
        break;
      }
    }

    if (!url) {
      for (const value of Object.values(row)) {
        if (typeof value === 'string' && value.includes('zillow.com')) {
          url = value;
          break;
        }
      }
    }

    if (url) {
      properties.push({
        url,
        address: row.address || row.Address,
        price: row.price || row.Price,
      });
    }
  });

  return properties;
}

async function checkExistingProperties(urls: string[]): Promise<Set<string>> {
  const existingUrls = new Set<string>();

  // Check in batches of 10 (Firestore 'in' query limit)
  const batchSize = 10;
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);

    // Check in zillow_imports collection
    const zillowImportsSnapshot = await db
      .collection('zillow_imports')
      .where('url', 'in', batch)
      .get();

    zillowImportsSnapshot.forEach(doc => {
      existingUrls.add(doc.data().url);
    });

    // Check in main properties collection
    const propertiesSnapshot = await db
      .collection('properties')
      .where('url', 'in', batch)
      .get();

    propertiesSnapshot.forEach(doc => {
      existingUrls.add(doc.data().url);
    });
  }

  return existingUrls;
}

async function scrapeAndImport(jobId: string, properties: PropertyURL[]) {
  const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });
  // Updated to use free tier actor: maxcopell/zillow-detail-scraper
  const actorId = 'maxcopell/zillow-detail-scraper';

  try {
    // Check if job already exists (prevent duplicate runs)
    const existingJob = await db.collection('scraper_jobs').doc(jobId).get();
    if (existingJob.exists) {
      console.log(`⚠️ Job ${jobId} already exists, skipping duplicate run`);
      return;
    }

    // Create job status
    await db.collection('scraper_jobs').doc(jobId).set({
      status: 'scraping',
      total: properties.length,
      imported: 0,
      progress: 0,
      startedAt: new Date(),
    });

    const batchSize = 50;
    let imported = 0;

    for (let i = 0; i < properties.length; i += batchSize) {
      const batch = properties.slice(i, i + batchSize);

      // Run Apify (maxcopell/zillow-detail-scraper uses startUrls format)
      const input = { startUrls: batch.map(p => ({ url: p.url })) };
      console.log(`🚀 [APIFY] Starting batch with ${batch.length} URLs`);
      const run = await client.actor(actorId).call(input);
      console.log(`✓ [APIFY] Run completed: ${run.id}`);

      // Don't use fields parameter - get ALL data from Apify to avoid missing fields
      const { items } = await client.dataset(run.defaultDatasetId).listItems({
        clean: false,
        limit: 1000,
      });
      console.log(`📦 [APIFY] Received ${items.length} items from dataset`);
      console.log(`📦 [APIFY] First item keys:`, items.length > 0 ? Object.keys(items[0]).slice(0, 25) : 'none');
      console.log(`📦 [APIFY] First item has attributionInfo:`, items.length > 0 ? !!items[0].attributionInfo : false);

      // Log sample of first item to see structure
      if (items.length > 0) {
        const sample = items[0];
        console.log(`🔍 [APIFY STRUCTURE]`, {
          hasAttributionInfo: !!sample.attributionInfo,
          attributionInfoKeys: sample.attributionInfo ? Object.keys(sample.attributionInfo) : [],
          topLevelKeys: Object.keys(sample).slice(0, 20)
        });
      }

      // Save to Firebase
      const firestoreBatch = db.batch();
      items.forEach((item: any) => {
        const propertyData = transformProperty(item);
        const docRef = db.collection('zillow_imports').doc();
        firestoreBatch.set(docRef, propertyData);
      });

      await firestoreBatch.commit();
      imported += items.length;

      // Update progress
      const progress = Math.round((imported / properties.length) * 100);
      await db.collection('scraper_jobs').doc(jobId).update({
        imported,
        progress,
      });

      // Small delay between batches
      if (i + batchSize < properties.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Mark complete
    await db.collection('scraper_jobs').doc(jobId).update({
      status: 'complete',
      imported,
      completedAt: new Date(),
    });

  } catch (error: any) {
    await db.collection('scraper_jobs').doc(jobId).update({
      status: 'error',
      error: error.message,
    });
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

  // Log what data structure we received from Apify
  console.log('🔍 [TRANSFORM START]', streetAddress, {
    hasAttributionInfo: !!apifyData.attributionInfo,
    attributionInfoType: typeof apifyData.attributionInfo,
    topLevelKeys: Object.keys(apifyData).length,
    hasAgentPhone: !!apifyData.agentPhoneNumber,
    hasBrokerPhone: !!apifyData.brokerPhoneNumber,
  });

  // Extract agent/broker from attributionInfo object
  const agentPhone = apifyData.attributionInfo?.agentPhoneNumber || apifyData.agentPhoneNumber || apifyData.agentPhone || '';
  const brokerPhone = apifyData.attributionInfo?.brokerPhoneNumber || apifyData.brokerPhoneNumber || apifyData.brokerPhone || '';
  const finalAgentPhone = agentPhone || brokerPhone;

  // DEBUG: Log attribution info extraction
  console.log('🔍 [TRANSFORM EXTRACT]', streetAddress, {
    agentPhone,
    brokerPhone,
    finalAgentPhone,
    agentName: apifyData.attributionInfo?.agentName || apifyData.agentName || '',
  });

  // Extract images from responsivePhotos
  const propertyImages = Array.isArray(apifyData.responsivePhotos)
    ? apifyData.responsivePhotos.map((p: any) => p.url).filter(Boolean)
    : Array.isArray(apifyData.photos)
    ? apifyData.photos.map((p: any) => typeof p === 'string' ? p : p.url || p.href).filter(Boolean)
    : Array.isArray(apifyData.images)
    ? apifyData.images
    : [];

  // Get main hero image
  const firstPropertyImage = apifyData.desktopWebHdpImageLink
    || apifyData.hiResImageLink
    || apifyData.mediumImageLink
    || (propertyImages.length > 0 ? propertyImages[0] : '')
    || '';

  return {
    url: apifyData.url || '',
    hdpUrl: apifyData.hdpUrl || '',
    virtualTourUrl: apifyData.virtualTourUrl || '',
    fullAddress: fullAddress || apifyData.fullAddress || '',
    streetAddress,
    city,
    state,
    zipCode,
    county: apifyData.county || '',
    subdivision: addressObj.subdivision || '',
    neighborhood: addressObj.neighborhood || '',
    zpid: apifyData.zpid || 0,
    parcelId: apifyData.parcelId || '',
    mlsId: apifyData.attributionInfo?.mlsId || apifyData.mlsid || '',
    bedrooms: apifyData.bedrooms || apifyData.beds || 0,
    bathrooms: apifyData.bathrooms || apifyData.baths || 0,
    squareFoot: apifyData.livingArea || apifyData.squareFoot || apifyData.livingAreaValue || 0,
    buildingType: apifyData.propertyTypeDimension || apifyData.buildingType || '',
    homeType: apifyData.homeType || '',
    homeStatus: apifyData.homeStatus || '',
    yearBuilt: apifyData.yearBuilt || 0,
    lotSquareFoot: apifyData.lotSize || apifyData.lotAreaValue || apifyData.lotSquareFoot || 0,
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
    agentName: apifyData.attributionInfo?.agentName || apifyData.agentName || apifyData.listingAgent || '',
    agentPhoneNumber: finalAgentPhone,
    agentEmail: apifyData.attributionInfo?.agentEmail || '',
    agentLicenseNumber: apifyData.attributionInfo?.agentLicenseNumber || '',
    brokerName: apifyData.attributionInfo?.brokerName || apifyData.brokerName || apifyData.brokerageName || '',
    brokerPhoneNumber: brokerPhone,
    propertyImages,
    firstPropertyImage,
    source: 'apify-zillow',
    importedAt: timestamp,
    scrapedAt: timestamp,
  };
}
