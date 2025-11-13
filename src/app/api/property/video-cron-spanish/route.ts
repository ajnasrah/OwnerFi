// Property Video Cron Job (Spanish)
// Automatically finds eligible properties and generates Spanish videos
// Runs 5x daily: 12 PM, 3 PM, 6 PM, 9 PM, 12 AM EST (offset 1 hour from English)

import { NextRequest, NextResponse } from 'next/server';
import { isEligibleForVideo } from '@/lib/property-video-generator';
import type { PropertyListing } from '@/lib/property-schema';

const CRON_SECRET = process.env.CRON_SECRET;
const MAX_VIDEOS_PER_RUN = 1; // 1 per run × 5 runs = 5 per day

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const referer = request.headers.get('referer');
    const userAgent = request.headers.get('user-agent');

    const isFromDashboard = referer && referer.includes(request.headers.get('host') || '');
    const hasValidSecret = authHeader === `Bearer ${CRON_SECRET}`;
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (!isFromDashboard && !hasValidSecret && !isVercelCron) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🏡 Property video cron job triggered (SPANISH)');
    console.log(`📊 Using rotating property queue system`);

    // Import rotation queue functions
    const {
      getNextPropertyFromRotation,
      markPropertyCompleted,
      resetPropertyQueueCycle,
      getPropertyRotationStats,
      addToPropertyRotationQueue
    } = await import('@/lib/feed-store-firestore');

    // Get queue stats
    const stats = await getPropertyRotationStats();
    console.log(`📋 Queue stats: ${stats.queued} queued, ${stats.processing} processing, ${stats.total} total`);

    if (stats.nextProperty) {
      console.log(`   Next property: ${stats.nextProperty.address} (cycle ${stats.nextProperty.currentCycleCount + 1})`);
    }

    // Get next property from rotation queue
    let queueItem = await getNextPropertyFromRotation();

    // If queue empty, reset cycle and try again
    if (!queueItem) {
      console.log('⚠️  All properties completed this cycle!');
      console.log('🔄 Resetting queue for fresh cycle...');

      const resetCount = await resetPropertyQueueCycle();

      if (resetCount > 0) {
        console.log(`✅ Queue reset - ${resetCount} properties ready for new cycle`);
        // Try again after reset
        queueItem = await getNextPropertyFromRotation();
      } else {
        // Queue is truly empty - auto-populate with active properties
        console.log('⚠️  Queue is empty! Auto-populating with active properties...');

        try {
          const { db } = await import('@/lib/firebase');
          const { collection, query, where, getDocs } = await import('firebase/firestore');

          if (!db) {
            console.error('❌ Firebase not initialized');
            return NextResponse.json({
              success: false,
              error: 'Firebase not initialized',
              generated: 0
            }, { status: 500 });
          }

          // Get all active properties with images
          const propertiesQuery = query(
            collection(db, 'properties'),
            where('status', '==', 'active'),
            where('isActive', '==', true)
          );

          const snapshot = await getDocs(propertiesQuery);
          console.log(`   Found ${snapshot.size} active properties`);

          // Filter to properties with images only
          const eligibleProperties = snapshot.docs.filter(doc => {
            const property = doc.data();
            return property.imageUrls && property.imageUrls.length > 0;
          });

          console.log(`   ${eligibleProperties.length} have images`);

          // Add to rotation queue
          let added = 0;
          for (const docSnap of eligibleProperties) {
            try {
              await addToPropertyRotationQueue(docSnap.id);
              added++;
            } catch (error) {
              // Skip if already in queue (shouldn't happen since queue was empty)
              if (!(error instanceof Error && error.message.includes('already in rotation queue'))) {
                console.error(`   Error adding ${docSnap.data().address}:`, error);
              }
            }
          }

          console.log(`✅ Auto-populated queue with ${added} properties`);

          if (added > 0) {
            // Try to get next property after population
            queueItem = await getNextPropertyFromRotation();
          } else {
            return NextResponse.json({
              success: false,
              error: 'No eligible properties found to populate queue',
              generated: 0
            });
          }

        } catch (error) {
          console.error('❌ Error auto-populating queue:', error);
          return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to auto-populate queue',
            generated: 0
          }, { status: 500 });
        }
      }
    }

    // Sync queue with properties database (add new, remove deleted)
    console.log('🔄 Syncing queue with properties database...');
    try {
      const { db: adminDb } = await import('@/lib/firebase-admin');
      if (adminDb) {
          // Get all property IDs in queue
          const queueSnapshot = await adminDb.collection('property_rotation_queue').get();
          const queuePropertyIds = new Set(queueSnapshot.docs.map(doc => doc.data().propertyId));

          // Get all active property IDs from properties collection
          const propertiesSnapshot = await adminDb.collection('properties')
            .where('isActive', '==', true)
            .where('status', '==', 'active')
            .get();

          const activePropertyIds = new Set<string>();
          const newProperties: any[] = [];

          propertiesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.imageUrls && data.imageUrls.length > 0) {
              activePropertyIds.add(doc.id);
              if (!queuePropertyIds.has(doc.id)) {
                newProperties.push(doc.id);
              }
            }
          });

          // Add new properties to queue
          let addedCount = 0;
          for (const propId of newProperties) {
            try {
              await addToPropertyRotationQueue(propId);
              addedCount++;
            } catch (err) {
              // Skip if already exists
            }
          }

          // Remove deleted/inactive properties from queue
          let removedCount = 0;
          const batch = adminDb.batch();
          queueSnapshot.docs.forEach(doc => {
            const queueDocId = doc.id;
            if (!activePropertyIds.has(queueDocId)) {
              batch.delete(doc.ref);
              removedCount++;
            }
          });

          if (removedCount > 0) {
            await batch.commit();
          }

          if (addedCount > 0 || removedCount > 0) {
            console.log(`   ✅ Queue synced: +${addedCount} new, -${removedCount} deleted`);
          } else {
            console.log(`   ✅ Queue already in sync`);
          }
      }
    } catch (error) {
      console.error('   ⚠️  Queue sync failed (non-critical):', error);
    }

    if (!queueItem) {
      return NextResponse.json({
        success: true,
        message: 'No properties available after reset',
        generated: 0
      });
    }

    console.log(`\n🎥 Generating SPANISH video for: ${queueItem.address}`);
    console.log(`   City: ${queueItem.city}, ${queueItem.state}`);
    console.log(`   Down payment: $${queueItem.downPayment.toLocaleString()}`);
    console.log(`   Times shown: ${queueItem.videoCount}`);
    console.log(`   Queue position: ${queueItem.position}`);

    const results = [];

    try {
      // Generate 15-second SPANISH video using shared service
      const { generatePropertyVideo } = await import('@/lib/property-video-service');
      const result = await generatePropertyVideo(queueItem.propertyId, '15', 'es'); // SPANISH

      if (result.success) {
        console.log(`✅ Spanish video generation started for ${queueItem.address}`);

        // Mark property as completed for this cycle
        await markPropertyCompleted(queueItem.propertyId);

        results.push({
          propertyId: queueItem.propertyId,
          address: queueItem.address,
          variant: '15sec',
          language: 'es',
          success: true,
          workflowId: result.workflowId,
          timesShown: queueItem.videoCount + 1,
          cycleComplete: true
        });
      } else {
        const isValidationError = result.error === 'Property not eligible' || result.error === 'Invalid property data';
        const errorDetails = result.message || result.error;

        console.error(`❌ Failed: ${result.error}`);
        if (result.message) {
          console.error(`   Details: ${result.message}`);
        }

        if (!isValidationError) {
          await markPropertyCompleted(queueItem.propertyId);
        } else {
          console.warn(`⚠️  Property ${queueItem.propertyId} skipped due to validation errors`);
          const { resetPropertyToQueued } = await import('@/lib/feed-store-firestore');
          await resetPropertyToQueued(queueItem.propertyId);
        }

        results.push({
          propertyId: queueItem.propertyId,
          address: queueItem.address,
          variant: '15sec',
          language: 'es',
          success: false,
          error: result.error,
          errorDetails: errorDetails,
          skipped: isValidationError
        });
      }

    } catch (error) {
      console.error(`❌ Error for ${queueItem.address}:`, error);

      await markPropertyCompleted(queueItem.propertyId);

      results.push({
        propertyId: queueItem.propertyId,
        address: queueItem.address,
        variant: '15sec',
        language: 'es',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    const successCount = results.filter(r => r.success).length;
    const updatedStats = await getPropertyRotationStats();
    const skippedCount = results.filter((r: any) => r.skipped).length;

    console.log(`\n📊 Spanish property video cron summary:`);
    console.log(`   Queue total: ${stats.total} properties`);
    console.log(`   Remaining this cycle: ${updatedStats.queued}`);
    console.log(`   Video generated: ${successCount > 0 ? 'Yes' : 'No'}`);
    if (skippedCount > 0) {
      console.log(`   ⚠️  Skipped due to validation: ${skippedCount} (fix property data)`);
    }

    const errorMessage = skippedCount > 0
      ? `Property skipped due to validation errors: ${results[0].errorDetails || results[0].error}`
      : results[0]?.error || 'Unknown error';

    return NextResponse.json({
      success: successCount > 0,
      variant: '15sec',
      language: 'es',
      generated: successCount,
      skipped: skippedCount,
      property: results[0],
      queueStats: updatedStats,
      cycleProgress: {
        completed: stats.total - updatedStats.queued,
        remaining: updatedStats.queued,
        total: stats.total
      },
      message: successCount > 0
        ? `Spanish video generated successfully`
        : errorMessage,
      error: successCount > 0 ? undefined : errorMessage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Spanish property video cron error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
