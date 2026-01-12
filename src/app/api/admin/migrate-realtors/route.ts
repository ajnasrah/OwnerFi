/**
 * EMERGENCY MIGRATION API: Add realtorData to ALL realtor users
 *
 * This endpoint finds all users with role='realtor' and ensures they have
 * realtorData embedded in their user document.
 *
 * Access: Admin only (protected by CRON_SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import { FirebaseDB } from '@/lib/firebase-db';
import { RealtorDataHelper, formatPhone } from '@/lib/realtor-models';
import { Timestamp } from 'firebase/firestore';

interface UserDoc {
  id: string;
  name?: string;
  email: string;
  phone?: string;
  role: string;
  realtorData?: any;
  [key: string]: any;
}

export async function POST(request: NextRequest) {
  try {
    // Verify CRON_SECRET for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('\n🚀 EMERGENCY MIGRATION: Adding realtorData to all realtor users\n');
    console.log('='.repeat(60));

    // Get all users with role='realtor'
    console.log('\n📋 Step 1: Fetching all realtor users...\n');
    const realtorUsers = await FirebaseDB.queryDocuments('users', [
      { field: 'role', operator: '==', value: 'realtor' }
    ]) as UserDoc[];

    console.log(`✅ Found ${realtorUsers.length} realtor users\n`);

    if (realtorUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No realtor users found',
        stats: {
          total: 0,
          fixed: 0,
          alreadyComplete: 0,
          errors: 0
        }
      });
    }

    const stats = {
      total: realtorUsers.length,
      fixed: 0,
      alreadyComplete: 0,
      errors: 0,
      processed: [] as Array<{
        email: string;
        status: 'fixed' | 'already_complete' | 'error';
        message?: string;
      }>
    };

    // Process each realtor
    for (let i = 0; i < realtorUsers.length; i++) {
      const user = realtorUsers[i];
      const num = i + 1;

      console.log(`\n[${num}/${realtorUsers.length}] Processing: ${user.email}`);

      try {
        // Check if realtorData already exists
        if (user.realtorData) {
          console.log(`  ✅ Already has realtorData`);
          stats.alreadyComplete++;
          stats.processed.push({
            email: user.email,
            status: 'already_complete'
          });
          continue;
        }

        // realtorData is missing - create it
        console.log(`  ⚠️  MISSING realtorData - creating now...`);

        // Parse name
        const nameParts = (user.name || '').split(' ');
        const firstName = nameParts[0] || 'First';
        const lastName = nameParts.slice(1).join(' ') || 'Last';

        // Create placeholder service area
        const serviceArea = {
          primaryCity: {
            name: 'Setup Required',
            state: 'Setup Required',
            stateCode: 'XX',
            placeId: 'setup-required',
            coordinates: { lat: 0, lng: 0 },
            formattedAddress: 'Setup Required'
          },
          nearbyCities: [],
          radiusMiles: 30,
          totalCitiesServed: 0,
          lastUpdated: Timestamp.now()
        };

        // Create realtorData with trial credits
        const realtorData = RealtorDataHelper.createRealtorData(
          firstName,
          lastName,
          formatPhone(user.phone || ''),
          user.email,
          serviceArea,
          '', // company - they can add later
          ''  // licenseNumber - they can add later
        );

        console.log(`     Created realtorData for ${firstName} ${lastName}`);

        // Update user document
        await FirebaseDB.updateDocument('users', user.id, {
          realtorData,
          updatedAt: Timestamp.now()
        });

        console.log(`  ✅ Successfully added realtorData`);
        stats.fixed++;
        stats.processed.push({
          email: user.email,
          status: 'fixed'
        });

        // Small delay to avoid rate limiting
        if (i < realtorUsers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        console.error(`  ❌ Error processing user:`, error);
        stats.errors++;
        stats.processed.push({
          email: user.email,
          status: 'error',
          message: error.message || 'Unknown error'
        });
      }
    }

    // Log final summary
    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 MIGRATION COMPLETE!\n');
    console.log('Summary:');
    console.log(`  Total realtor users: ${stats.total}`);
    console.log(`  ✅ Fixed (added realtorData): ${stats.fixed}`);
    console.log(`  ✓  Already complete: ${stats.alreadyComplete}`);
    console.log(`  ❌ Errors: ${stats.errors}`);
    console.log('\n' + '='.repeat(60));

    return NextResponse.json({
      success: true,
      message: `Migration complete. Fixed ${stats.fixed} users, ${stats.alreadyComplete} already had realtorData.`,
      stats: {
        total: stats.total,
        fixed: stats.fixed,
        alreadyComplete: stats.alreadyComplete,
        errors: stats.errors
      },
      details: stats.processed
    });

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Migration failed',
        message: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// SECURITY: GET handler removed
// Passing secrets via query params is insecure - use POST with Authorization header
