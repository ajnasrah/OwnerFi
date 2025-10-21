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
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    console.log(`Received ${files.length} files for batch upload`);

    // Create a batch job ID
    const batchJobId = `batch_${Date.now()}`;

    // Collect all URLs from all files
    let allProperties: PropertyURL[] = [];
    let fileResults: any[] = [];

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const workbook = XLSX.read(buffer);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data: any[] = XLSX.utils.sheet_to_json(worksheet);

        const properties = extractURLs(data);
        allProperties.push(...properties);

        fileResults.push({
          filename: file.name,
          urlsFound: properties.length,
          status: 'processed'
        });
      } catch (error: any) {
        console.error(`Error processing file ${file.name}:`, error);
        fileResults.push({
          filename: file.name,
          urlsFound: 0,
          status: 'error',
          error: error.message
        });
      }
    }

    if (allProperties.length === 0) {
      return NextResponse.json(
        { error: 'No valid Zillow URLs found in any files', fileResults },
        { status: 400 }
      );
    }

    // Remove duplicates within all files combined
    const uniqueUrls = new Set<string>();
    const uniqueProperties: PropertyURL[] = [];
    let duplicatesInFiles = 0;

    allProperties.forEach(prop => {
      if (!uniqueUrls.has(prop.url)) {
        uniqueUrls.add(prop.url);
        uniqueProperties.push(prop);
      } else {
        duplicatesInFiles++;
      }
    });

    // Check for existing properties in database
    const existingUrls = await checkExistingProperties(uniqueProperties.map(p => p.url));

    // Also check against contacted properties (will be populated after scraping with agent info)
    // For now, just filter by URL existence
    const newProperties = uniqueProperties.filter(p => !existingUrls.has(p.url));

    const alreadyExists = uniqueProperties.length - newProperties.length;

    if (newProperties.length === 0) {
      return NextResponse.json(
        {
          error: 'All properties already exist in database',
          filesProcessed: files.length,
          totalUrls: allProperties.length,
          duplicatesInFiles,
          alreadyInDatabase: alreadyExists,
          fileResults
        },
        { status: 400 }
      );
    }

    // Start scraping in background
    scrapeAndImport(batchJobId, newProperties).catch(console.error);

    return NextResponse.json({
      success: true,
      batchJobId,
      filesProcessed: files.length,
      totalUrls: allProperties.length,
      duplicatesInFiles,
      alreadyInDatabase: alreadyExists,
      newProperties: newProperties.length,
      fileResults
    });

  } catch (error: any) {
    console.error('Batch upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process files' },
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

  const batchSize = 10;
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);

    const zillowImportsSnapshot = await db
      .collection('zillow_imports')
      .where('url', 'in', batch)
      .get();

    zillowImportsSnapshot.forEach(doc => {
      existingUrls.add(doc.data().url);
    });

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

// Helper function to extract street number and first word for strict matching
function extractAddressKey(address: string): string {
  if (!address) return '';
  const parts = address.trim().toLowerCase().match(/^(\d+)\s+(\w+)/);
  return parts ? `${parts[1]} ${parts[2]}` : address.trim().toLowerCase();
}

// Filter out properties that have been contacted with the same agent
async function filterContactedProperties(items: any[]): Promise<any[]> {
  const filtered: any[] = [];

  for (const item of items) {
    const addressObj = item.address || {};
    const streetAddress = addressObj.streetAddress || item.streetAddress || '';
    const agentName = item.agentName || item.listingAgent || '';

    if (!streetAddress || !agentName) {
      // If no address or agent info, include it
      filtered.push(item);
      continue;
    }

    // Extract address key (street number + first word)
    const addressKey = extractAddressKey(streetAddress);
    const normalizedAgent = agentName.trim().toLowerCase();
    const compositeKey = `${addressKey}__${normalizedAgent}`;

    // Check if this property+agent combination has been contacted
    const contacted = await db.collection('contacted_properties').doc(compositeKey).get();

    if (!contacted.exists) {
      // Not contacted before, include it
      filtered.push(item);
    } else {
      console.log(`Skipping ${streetAddress} - already contacted ${agentName}`);
    }
  }

  return filtered;
}

async function scrapeAndImport(batchJobId: string, properties: PropertyURL[]) {
  const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });
  // Updated to use free tier actor: maxcopell/zillow-detail-scraper
  const actorId = 'maxcopell/zillow-detail-scraper';

  try {
    // Update job status
    await db.collection('scraper_jobs').doc(batchJobId).set({
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

      // maxcopell/zillow-detail-scraper uses startUrls format
      const input = { startUrls: batch.map(p => ({ url: p.url })) };
      const run = await client.actor(actorId).call(input);
      const { items } = await client.dataset(run.defaultDatasetId).listItems();

      // Check each property against contacted properties
      const filteredItems = await filterContactedProperties(items);

      const firestoreBatch = db.batch();
      filteredItems.forEach((item: any) => {
        const propertyData = transformProperty(item);
        const docRef = db.collection('zillow_imports').doc();
        firestoreBatch.set(docRef, propertyData);
      });

      await firestoreBatch.commit();
      imported += filteredItems.length;

      const progress = Math.round((imported / properties.length) * 100);
      await db.collection('scraper_jobs').doc(batchJobId).update({
        imported,
        progress,
      });

      if (i + batchSize < properties.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    await db.collection('scraper_jobs').doc(batchJobId).update({
      status: 'complete',
      imported,
      completedAt: new Date(),
    });

  } catch (error: any) {
    await db.collection('scraper_jobs').doc(batchJobId).update({
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
    || apifyData.contactFormRenderData?.data?.agent_module?.display_name
    || '';

  // Extract broker name from multiple sources
  const brokerName = apifyData.attributionInfo?.brokerName
    || apifyData.brokerName
    || apifyData.brokerageName
    || (Array.isArray(apifyData.attributionInfo?.listingOffices) && apifyData.attributionInfo.listingOffices[0]?.officeName)
    || '';

  // DEBUG LOGGING - Remove after confirming data is saving correctly
  if (!agentPhone && !brokerPhone) {
    console.log(`⚠️ NO PHONE NUMBERS for ZPID ${apifyData.zpid}:`, {
      agentPhoneFromAttr: apifyData.attributionInfo?.agentPhoneNumber,
      brokerPhoneFromAttr: apifyData.attributionInfo?.brokerPhoneNumber,
      hasAttributionInfo: !!apifyData.attributionInfo
    });
  } else {
    console.log(`✓ FOUND CONTACT for ZPID ${apifyData.zpid}:`, {
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
    url: fullUrl,
    hdpUrl: apifyData.hdpUrl || '',
    virtualTourUrl: apifyData.virtualTourUrl || apifyData.thirdPartyVirtualTour?.externalUrl || '',
    fullAddress: fullAddress || apifyData.fullAddress || '',
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
