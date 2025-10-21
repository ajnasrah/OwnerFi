import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(request: NextRequest) {
  try {
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

    return NextResponse.json(
      {
        success: true,
        message: 'Added to scraper queue',
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
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
