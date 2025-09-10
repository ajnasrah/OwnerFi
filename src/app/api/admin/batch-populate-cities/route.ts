import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { batchProcessNearbyCities } from '@/lib/background-jobs';
import { adminDb } from '@/lib/firebase-admin';

/**
 * ADMIN: Batch process nearby cities for all properties
 * OPTIMIZED: Uses parallel processing, batch writes, and rate limiting
 */
export async function POST(request: NextRequest) {
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 503 });
    }

  try {
    // Admin access control
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const { force } = await request.json();
    const startTime = Date.now();

    // Get properties that need nearby cities populated
    let propertiesQuery;
    
    if (force) {
      // Process all properties
      propertiesQuery = query(adminDb.collection('properties'));
    } else {
      // Only process properties without nearbyCities
      propertiesQuery = query(
        adminDb.collection('properties'),
        where('nearbyCitiesUpdatedAt', '==', null)
      );
    }

    const snapshot = await propertiesQuery.get();
    const propertiesToProcess = snapshot.docs
      .map(doc => ({ 
        id: doc.id, 
        city: (doc.data() as any).city?.split(',')[0].trim(),
        state: (doc.data() as any).state,
        hasNearbyCities: (doc.data() as any).nearbyCities?.length > 0
      }))
      .filter(p => p.city && p.state && (force || !p.hasNearbyCities));

    console.log(`🏠 Found ${propertiesToProcess.length} properties to process`);

    if (propertiesToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No properties need nearby cities populated',
        processed: 0,
        time: Date.now() - startTime
      });
    }

    // OPTIMIZED: Batch process with parallel operations and rate limiting
    await batchProcessNearbyCities(propertiesToProcess);

    const totalTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: `Batch processed ${propertiesToProcess.length} properties`,
      summary: {
        total: propertiesToProcess.length,
        processingTime: totalTime,
        avgTimePerProperty: Math.round(totalTime / propertiesToProcess.length)
      },
      performance: {
        totalTime,
        propertiesPerSecond: Math.round((propertiesToProcess.length / totalTime) * 1000)
      }
    });

  } catch (error) {
    console.error('Batch populate nearby cities error:', error);
    return NextResponse.json(
      { error: 'Batch operation failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}