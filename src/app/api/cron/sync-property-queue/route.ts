// Sync Property Queue Cron
// Ensures all active properties with images are in the rotation queue
// Runs every 6 hours to catch any properties that were missed during auto-add

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;
export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (authHeader !== `Bearer ${CRON_SECRET}` && !isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 [SYNC-QUEUE] Starting property queue sync...');

    const { db } = await import('@/lib/firebase');
    const { collection, getDocs, doc, setDoc, query, where } = await import('firebase/firestore');

    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    // 1. Get all active properties with images
    console.log('📊 Loading properties...');
    const propertiesSnapshot = await getDocs(collection(db, 'properties'));
    const activeProperties = new Map();

    propertiesSnapshot.docs.forEach(doc => {
      const prop = doc.data();
      if (prop.status === 'active' && prop.isActive && prop.imageUrls && prop.imageUrls.length > 0) {
        activeProperties.set(doc.id, {
          id: doc.id,
          address: prop.address,
          city: prop.city,
          state: prop.state,
        });
      }
    });

    console.log(`   Found ${activeProperties.size} active properties with images`);

    // 2. Get properties already in queue
    console.log('📊 Loading queue...');
    const queueSnapshot = await getDocs(collection(db, 'property_videos'));
    const queuedPropertyIds = new Set();

    queueSnapshot.docs.forEach(doc => {
      const workflow = doc.data();
      queuedPropertyIds.add(workflow.propertyId);
    });

    console.log(`   ${queuedPropertyIds.size} properties already in queue`);

    // 3. Find missing properties
    const missingProperties: any[] = [];
    activeProperties.forEach((prop, propId) => {
      if (!queuedPropertyIds.has(propId)) {
        missingProperties.push(prop);
      }
    });

    console.log(`📋 Missing from queue: ${missingProperties.length} properties`);

    if (missingProperties.length === 0) {
      console.log('✅ All properties already in queue');
      return NextResponse.json({
        success: true,
        message: 'Queue already synced',
        totalProperties: activeProperties.size,
        inQueue: queuedPropertyIds.size,
        added: 0
      });
    }

    // 4. Add missing properties to queue
    console.log('🔧 Adding missing properties to queue...');

    let added = 0;
    let failed = 0;

    for (const prop of missingProperties) {
      try {
        const workflowId = `prop-${prop.id}-${Date.now()}`;
        const workflowData = {
          propertyId: prop.id,
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: 'cron_sync',
        };

        await setDoc(doc(db, 'property_videos', workflowId), workflowData);
        added++;

        if (added % 50 === 0) {
          console.log(`   Progress: ${added}/${missingProperties.length}...`);
        }
      } catch (error) {
        failed++;
        console.error(`   ❌ Failed to add ${prop.id}:`, error);
      }
    }

    console.log(`\n✅ [SYNC-QUEUE] Sync complete: ${added} added, ${failed} failed`);

    return NextResponse.json({
      success: true,
      totalProperties: activeProperties.size,
      inQueue: queuedPropertyIds.size,
      missing: missingProperties.length,
      added,
      failed
    });

  } catch (error) {
    console.error('❌ [SYNC-QUEUE] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
