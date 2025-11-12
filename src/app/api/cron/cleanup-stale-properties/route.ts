// Stale Property Cleanup Cron Job
// Automatically deletes properties older than 60 days with no updates
// Runs weekly on Sundays at 2 AM via Vercel Cron

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  console.log('🧹 Starting stale property cleanup cron job...');

  try {
    // Verify Vercel Cron authentication
    const authHeader = request.headers.get('authorization');
    const CRON_SECRET = process.env.CRON_SECRET;

    // Check if request is from Vercel Cron (has x-vercel-cron header)
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';

    if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
      console.error('❌ Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await getAdminDb();

    if (!db) {
      console.error('❌ Failed to initialize Firebase Admin');
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Calculate cutoff date (60 days ago)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    console.log(`📅 Cutoff date: ${sixtyDaysAgo.toISOString()}`);
    console.log(`🔍 Finding properties with no updates since ${sixtyDaysAgo.toLocaleDateString()}...`);

    // Get all properties
    const propertiesSnapshot = await db.collection('properties').get();

    const staleProperties: Array<{
      id: string;
      address: string;
      updatedAt: Date;
      source: string;
    }> = [];

    // Filter properties older than 60 days
    propertiesSnapshot.docs.forEach(doc => {
      const data = doc.data();

      // Get the most recent update timestamp
      const updatedAt = data.updatedAt || data.createdAt;

      if (!updatedAt) {
        // No timestamp - consider it stale
        staleProperties.push({
          id: doc.id,
          address: `${data.address}, ${data.city}, ${data.state}`,
          updatedAt: new Date(0), // Unix epoch for missing timestamps
          source: data.source || 'unknown'
        });
        return;
      }

      // Convert Firestore timestamp to Date
      const lastUpdate = updatedAt.toDate ? updatedAt.toDate() : new Date(updatedAt);

      // Check if older than 60 days
      if (lastUpdate < sixtyDaysAgo) {
        staleProperties.push({
          id: doc.id,
          address: `${data.address}, ${data.city}, ${data.state}`,
          updatedAt: lastUpdate,
          source: data.source || 'unknown'
        });
      }
    });

    console.log(`📊 Found ${staleProperties.length} stale properties (out of ${propertiesSnapshot.size} total)`);

    if (staleProperties.length === 0) {
      console.log('✅ No stale properties to clean up!');
      return NextResponse.json({
        success: true,
        deleted: 0,
        totalProperties: propertiesSnapshot.size,
        message: 'No stale properties found',
        timestamp: new Date().toISOString()
      });
    }

    // Log sample of properties to be deleted
    console.log('\n🗑️  Properties to be deleted (sample):');
    staleProperties.slice(0, 10).forEach((prop, idx) => {
      console.log(`${idx + 1}. ${prop.address}`);
      console.log(`   Last updated: ${prop.updatedAt.toLocaleDateString()}`);
      console.log(`   Source: ${prop.source}`);
    });

    if (staleProperties.length > 10) {
      console.log(`   ... and ${staleProperties.length - 10} more`);
    }

    // Delete stale properties
    let deletedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const property of staleProperties) {
      try {
        await db.collection('properties').doc(property.id).delete();
        deletedCount++;
      } catch (error) {
        errorCount++;
        const errorMsg = `${property.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`❌ Failed to delete ${property.address}:`, error);
      }
    }

    console.log(`\n✅ Cleanup completed!`);
    console.log(`   Deleted: ${deletedCount} properties`);
    console.log(`   Errors: ${errorCount} properties`);
    console.log(`   Remaining: ${propertiesSnapshot.size - deletedCount} properties`);

    // Log breakdown by source
    const sourceBreakdown = staleProperties.reduce((acc, prop) => {
      acc[prop.source] = (acc[prop.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\n📊 Deleted properties by source:');
    Object.entries(sourceBreakdown).forEach(([source, count]) => {
      console.log(`   ${source}: ${count}`);
    });

    // Send alert if there were errors
    if (errorCount > 0) {
      console.error(`⚠️  ${errorCount} properties failed to delete`);

      const { alertSystemError } = await import('@/lib/error-monitoring');
      await alertSystemError(
        'Stale Property Cleanup',
        `${errorCount} properties failed to delete during cleanup`,
        {
          deleted: deletedCount,
          errors: errorCount,
          errorDetails: errors.slice(0, 10) // Include first 10 errors
        }
      ).catch(err => {
        console.warn('Failed to send alert:', err.message);
      });
    }

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      errors: errorCount,
      totalProperties: propertiesSnapshot.size,
      cutoffDate: sixtyDaysAgo.toISOString(),
      sourceBreakdown,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Stale property cleanup cron error:', error);

    // Send alert
    const { alertSystemError } = await import('@/lib/error-monitoring');
    await alertSystemError(
      'Stale Property Cleanup Cron',
      error instanceof Error ? error.message : 'Unknown error during property cleanup',
      { error: String(error) }
    ).catch(err => {
      console.warn('Failed to send alert:', err.message);
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
