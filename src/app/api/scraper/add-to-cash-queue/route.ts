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

    console.log(`💰 [CASH DEALS] Request: ${url} | ${address}`);

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

    // Check if URL already exists in cash deals queue
    const existingInQueue = await db
      .collection('cash_deals_queue')
      .where('url', '==', url)
      .limit(1)
      .get();

    if (!existingInQueue.empty) {
      return NextResponse.json(
        {
          success: false,
          message: 'URL already in cash deals queue',
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

    // Check if already in cash_houses collection
    const existingInCashHouses = await db
      .collection('cash_houses')
      .where('url', '==', url)
      .limit(1)
      .get();

    if (!existingInCashHouses.empty) {
      return NextResponse.json(
        {
          success: false,
          message: 'URL already processed in cash houses',
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

    // Add to cash deals queue
    await db.collection('cash_deals_queue').add({
      url,
      address: address || '',
      price: price || '',
      status: 'pending',
      addedAt: new Date(),
      source: 'chrome-extension',
    });

    console.log(`✅ [CASH DEALS] Added to queue: ${url}`);

    // Trigger immediate processing (don't wait for cron)
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.vercel.app';
    fetch(`${BASE_URL}/api/cron/process-cash-deals-queue`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'User-Agent': 'vercel-cron/1.0'
      }
    }).catch(err => console.error('⚠️ Failed to trigger immediate cash deals processing:', err));

    return NextResponse.json(
      {
        success: true,
        message: 'Added to cash deals queue. Processing started immediately.',
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );

  } catch (error: any) {
    console.error('Error adding to cash deals queue:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add to cash deals queue' },
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
