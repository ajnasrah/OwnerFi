import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';

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

export async function POST(request: NextRequest) {
  try {
    // Auth: require admin session or CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const hasCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!hasCronAuth) {
      const session = await getServerSession(authOptions as any) as ExtendedSession | null;
      if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
        return NextResponse.json(
          { error: 'Unauthorized. Admin access or valid CRON_SECRET required.' },
          {
            status: 401,
            headers: {
              'Access-Control-Allow-Origin': '*',
            }
          }
        );
      }
    }

    const body = await request.json();
    const { url, address, price } = body;

    console.log(`📥 Bookmarklet request: ${url} | ${address}`);

    // Validate required fields
    if (!url || !url.includes('zillow.com')) {
      return NextResponse.json(
        { error: 'Invalid Zillow URL' },
        { status: 400 },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    // Check if URL already exists in queue
    const existingInQueue = await db
      .collection('scraper_queue')
      .where('url', '==', url)
      .limit(1)
      .get();

    if (!existingInQueue.empty) {
      return NextResponse.json(
        {
          success: false,
          message: 'URL already in queue',
          alreadyExists: true
        },
        {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    // Check if already scraped
    const existingInImports = await db
      .collection('zillow_imports')
      .where('url', '==', url)
      .limit(1)
      .get();

    if (!existingInImports.empty) {
      return NextResponse.json(
        {
          success: false,
          message: 'URL already scraped and imported',
          alreadyExists: true
        },
        {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    // Add to queue
    await db.collection('scraper_queue').add({
      url,
      address: address || '',
      price: price || '',
      status: 'pending',
      addedAt: new Date(),
      source: 'bookmarklet',
    });

    console.log(`✅ Added to queue: ${url}`);

    // Trigger immediate processing (don't wait for cron)
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.vercel.app';
    fetch(`${BASE_URL}/api/cron/process-scraper-queue`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'User-Agent': 'vercel-cron/1.0'
      }
    }).catch(err => console.error('⚠️ Failed to trigger immediate queue processing:', err));

    return NextResponse.json(
      {
        success: true,
        message: 'Added to scraper queue. Processing started immediately.',
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );

  } catch (error: any) {
    console.error('Error adding to queue:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add to queue' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
