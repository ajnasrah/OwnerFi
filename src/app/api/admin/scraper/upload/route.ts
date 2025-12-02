import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ExtendedSession } from '@/types/session';
import * as XLSX from 'xlsx';

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

export async function POST(request: NextRequest) {
  try {
    // Admin access control
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel/CSV
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    // Extract Zillow URLs
    const urlKeys = ['url', 'URL', 'link', 'Link', 'property_url', 'Property URL', 'Zillow URL', 'zillow_url'];
    const urls: string[] = [];

    for (const row of data) {
      let url: string | undefined;

      // Check known URL column names
      for (const key of urlKeys) {
        if (row[key] && typeof row[key] === 'string' && row[key].includes('zillow.com')) {
          url = row[key].trim();
          break;
        }
      }

      // If not found, check all values
      if (!url) {
        for (const value of Object.values(row)) {
          if (typeof value === 'string' && value.includes('zillow.com')) {
            url = value.trim();
            break;
          }
        }
      }

      if (url) {
        urls.push(url);
      }
    }

    if (urls.length === 0) {
      return NextResponse.json({
        error: 'No Zillow URLs found in file',
      }, { status: 400 });
    }

    // Deduplicate within file
    const uniqueUrls = [...new Set(urls)];
    const duplicatesInFile = urls.length - uniqueUrls.length;

    // Check which URLs already exist in queue or imports
    const existingInQueue = new Set<string>();
    const existingInImports = new Set<string>();

    // Batch check in queue (10 at a time for Firestore 'in' limit)
    for (let i = 0; i < uniqueUrls.length; i += 10) {
      const batch = uniqueUrls.slice(i, i + 10);
      const queueSnap = await db.collection('scraper_queue')
        .where('url', 'in', batch)
        .select()
        .get();
      queueSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.url) existingInQueue.add(data.url);
      });
    }

    // Batch check in imports
    for (let i = 0; i < uniqueUrls.length; i += 10) {
      const batch = uniqueUrls.slice(i, i + 10);
      const importsSnap = await db.collection('zillow_imports')
        .where('url', 'in', batch)
        .select()
        .get();
      importsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.url) existingInImports.add(data.url);
      });
    }

    // Filter to only new URLs
    const newUrls = uniqueUrls.filter(url =>
      !existingInQueue.has(url) && !existingInImports.has(url)
    );

    const alreadyInDatabase = uniqueUrls.length - newUrls.length;

    if (newUrls.length === 0) {
      return NextResponse.json({
        success: true,
        urlsFound: urls.length,
        duplicatesInFile,
        alreadyInDatabase,
        newProperties: 0,
        message: 'All URLs already exist in queue or database',
      });
    }

    // Add new URLs to scraper_queue
    const BATCH_SIZE = 500;
    for (let i = 0; i < newUrls.length; i += BATCH_SIZE) {
      const batchUrls = newUrls.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      for (const url of batchUrls) {
        const docRef = db.collection('scraper_queue').doc();
        batch.set(docRef, {
          url,
          address: '',
          price: '',
          status: 'pending',
          addedAt: new Date(),
          source: 'admin_bulk_upload',
        });
      }

      await batch.commit();
    }

    // Generate a job ID for status tracking
    const jobId = `bulk_${Date.now()}`;

    // Store job metadata for status polling
    await db.collection('scraper_jobs').doc(jobId).set({
      status: 'queued',
      total: newUrls.length,
      imported: 0,
      createdAt: new Date(),
      createdBy: session.user.id,
    });

    // Trigger queue processor (fire and forget)
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
    fetch(`${BASE_URL}/api/cron/process-scraper-queue`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      }
    }).catch(err => console.error('Failed to trigger queue processor:', err));

    return NextResponse.json({
      success: true,
      jobId,
      urlsFound: urls.length,
      duplicatesInFile,
      alreadyInDatabase,
      newProperties: newUrls.length,
      message: `Added ${newUrls.length} URLs to scraper queue`,
    });

  } catch (error: any) {
    console.error('Bulk upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process file' },
      { status: 500 }
    );
  }
}
