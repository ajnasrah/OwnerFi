// Populate Property Rotation Queue
// One-time API to add all eligible properties to rotating queue

import { NextRequest, NextResponse } from 'next/server';
import {
  addToPropertyRotationQueue,
  getPropertyRotationStats
} from '@/lib/feed-store-firestore';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;

export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    // Verify admin authorization
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${ADMIN_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🏡 Populating property rotation queue...\n');

    if (!db) {
      return NextResponse.json(
        { error: 'Firebase not initialized' },
        { status: 500 }
      );
    }

    // Get current queue stats
    const currentStats = await getPropertyRotationStats();
    console.log(`📊 Current queue: ${currentStats.total} properties`);

    // Get all active properties with < $15k down
    console.log('🔍 Finding eligible properties...');
    const propertiesQuery = query(
      collection(db, 'properties'),
      where('status', '==', 'active'),
      where('isActive', '==', true),
      where('downPaymentAmount', '<', 15000)
    );

    const snapshot = await getDocs(propertiesQuery);
    console.log(`   Found ${snapshot.size} eligible properties`);

    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No eligible properties found',
        added: 0
      });
    }

    // Filter to properties with images
    const eligibleProperties = snapshot.docs.filter(doc => {
      const property = doc.data();
      return property.imageUrls && property.imageUrls.length > 0;
    });

    console.log(`✅ ${eligibleProperties.length} properties have images`);

    // Add to rotation queue
    let added = 0;
    let skipped = 0;
    const addedProperties = [];

    for (const docSnap of eligibleProperties) {
      const property = docSnap.data();

      try {
        await addToPropertyRotationQueue(docSnap.id);
        added++;
        addedProperties.push({
          id: docSnap.id,
          address: property.address,
          city: property.city,
          state: property.state,
          downPayment: property.downPaymentAmount
        });
        console.log(`✅ Added: ${property.address}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('already in rotation queue')) {
          skipped++;
        } else {
          console.error(`❌ Error adding ${property.address}:`, error);
        }
      }
    }

    // Get final stats
    const finalStats = await getPropertyRotationStats();

    console.log('\n📊 Population complete!');
    console.log(`   Added: ${added}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total in queue: ${finalStats.total}`);

    return NextResponse.json({
      success: true,
      added,
      skipped,
      totalInQueue: finalStats.total,
      nextProperty: finalStats.nextProperty,
      rotationDays: finalStats.total > 0 ? Math.ceil(finalStats.total / 5) : 0,
      addedProperties: addedProperties.slice(0, 10), // First 10 for preview
      message: `Successfully populated rotation queue with ${added} properties`
    });

  } catch (error) {
    console.error('❌ Error populating queue:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Show current queue stats without authorization
  try {
    const stats = await getPropertyRotationStats();

    return NextResponse.json({
      success: true,
      stats,
      rotationDays: stats.total > 0 ? Math.ceil(stats.total / 5) : 0,
      message: stats.total === 0
        ? 'Queue is empty - use POST to populate'
        : `${stats.total} properties in rotation`
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
