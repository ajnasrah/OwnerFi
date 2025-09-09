import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { 
  collection, 
  getDocs,
  query,
  where,
  limit as firestoreLimit
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { batchProcessNearbyCities } from '@/lib/background-jobs';

/**
 * ADMIN: Batch process nearby cities for all properties
 * OPTIMIZED: Uses parallel processing, batch writes, and rate limiting
 */
export async function POST(request: NextRequest) {
  try {
    // Admin access control
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== 'admin') {
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
      propertiesQuery = query(collection(db, 'properties'));
    } else {
      // Only process properties without nearbyCities
      propertiesQuery = query(
        collection(db, 'properties'),
        where('nearbyCitiesUpdatedAt', '==', null)
      );
    }

    const snapshot = await getDocs(propertiesQuery);
    const propertiesToProcess = snapshot.docs
      .map(doc => ({ 
        id: doc.id, 
        city: doc.data().city?.split(',')[0].trim(),
        state: doc.data().state,
        hasNearbyCities: doc.data().nearbyCities?.length > 0
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