import { NextRequest, NextResponse } from 'next/server';
import { recalculateAllMatchesEfficient } from '@/lib/matching-efficient';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    })
  });
}

/**
 * CRON endpoint to recalculate all property-buyer matches
 * Uses memory-efficient cursor-based pagination
 * Should be run daily during off-peak hours
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Log start
    const db = admin.firestore();
    await db.collection('cron_logs').add({
      job: 'recalculate-matches',
      status: 'started',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('🔄 Starting efficient match recalculation...');
    
    // Run the efficient recalculation
    const result = await recalculateAllMatchesEfficient();
    
    // Log success
    await db.collection('cron_logs').add({
      job: 'recalculate-matches',
      status: 'completed',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        totalProperties: result.totalProperties,
        totalBuyers: result.totalBuyers,
        totalMatches: result.totalMatches
      }
    });

    console.log(`✅ Match recalculation complete:
      - Properties processed: ${result.totalProperties}
      - Buyers processed: ${result.totalBuyers}
      - Matches created: ${result.totalMatches}`);

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Match recalculation failed:', error);
    
    // Log failure
    const db = admin.firestore();
    await db.collection('cron_logs').add({
      job: 'recalculate-matches',
      status: 'failed',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Failed to recalculate matches' },
      { status: 500 }
    );
  }
}