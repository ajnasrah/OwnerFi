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
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);

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

    // Create a job ID
    const jobId = `job_${Date.now()}`;

    // Start scraping in background with only new properties
    scrapeAndImport(jobId, newProperties).catch(console.error);

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
    // Update job status
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
      const run = await client.actor(actorId).call(input);
      const { items } = await client.dataset(run.defaultDatasetId).listItems();

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

  return {
    url: apifyData.url || '',
    fullAddress: fullAddress || apifyData.fullAddress || '',
    streetAddress,
    city,
    state,
    zipCode,
    bedrooms: apifyData.bedrooms || apifyData.beds || 0,
    bathrooms: apifyData.bathrooms || apifyData.baths || 0,
    squareFoot: apifyData.livingArea || apifyData.squareFoot || apifyData.livingAreaValue || 0,
    buildingType: apifyData.propertyType || apifyData.homeType || apifyData.buildingType || '',
    yearBuilt: apifyData.yearBuilt || 0,
    lotSquareFoot: apifyData.lotSize || apifyData.lotAreaValue || apifyData.lotSquareFoot || 0,
    price: apifyData.price || apifyData.listPrice || 0,
    estimate: apifyData.zestimate || apifyData.homeValue || apifyData.estimate || 0,
    hoa: apifyData.monthlyHoaFee || apifyData.hoa || 0,
    annualTaxAmount: apifyData.taxAnnualAmount || apifyData.annualTax || apifyData.annualTaxAmount || 0,
    recentPropertyTaxes: apifyData.recentTaxAssessment || apifyData.latestTaxAssessment || apifyData.recentPropertyTaxes || 0,
    description: apifyData.description || '',
    agentName: apifyData.agentName || apifyData.listingAgent || '',
    agentPhoneNumber: apifyData.agentPhoneNumber || apifyData.agentPhone || '',
    brokerName: apifyData.brokerName || apifyData.brokerageName || '',
    brokerPhoneNumber: apifyData.brokerPhoneNumber || apifyData.brokerPhone || '',
    propertyImages: Array.isArray(apifyData.photos)
      ? apifyData.photos.map((p: any) => typeof p === 'string' ? p : p.url || p.href).filter(Boolean)
      : Array.isArray(apifyData.images)
      ? apifyData.images
      : [],
    source: 'apify-zillow',
    importedAt: timestamp,
    scrapedAt: timestamp,
  };
}
