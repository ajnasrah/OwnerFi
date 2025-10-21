import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
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

    // Read and parse file
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

    // Remove duplicates within file
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

    // Create job and save URLs to pending queue
    const jobId = `job_${Date.now()}`;

    await db.collection('scraper_jobs').doc(jobId).set({
      status: 'pending',
      total: newProperties.length,
      imported: 0,
      progress: 0,
      createdAt: new Date(),
      urls: newProperties.map(p => p.url),
    });

    return NextResponse.json({
      success: true,
      jobId,
      urlsFound: properties.length,
      duplicatesInFile,
      alreadyInDatabase: alreadyExists,
      newProperties: newProperties.length,
      message: 'Job queued for processing. Check status in a moment.',
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
