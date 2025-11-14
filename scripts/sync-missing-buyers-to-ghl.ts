/**
 * Sync all existing buyers to GoHighLevel
 * This script sends all buyer profiles to GHL that haven't been synced yet
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

interface BuyerProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  preferredCity?: string;
  preferredState?: string;
  maxMonthlyPayment: number;
  maxDownPayment: number;
  searchRadius?: number;
  languages?: string[];
  createdAt?: any;
}

async function syncBuyerToGHL(buyer: BuyerProfile): Promise<{ success: boolean; error?: string }> {
  try {
    const GHL_BUYER_WEBHOOK_URL = process.env.GHL_BUYER_WEBHOOK_URL;

    if (!GHL_BUYER_WEBHOOK_URL) {
      console.error('❌ GHL_BUYER_WEBHOOK_URL not configured');
      return { success: false, error: 'Webhook URL not configured' };
    }

    // Send buyer data to GoHighLevel webhook
    const buyerPayload = {
      buyer_id: buyer.id,
      user_id: buyer.userId,
      first_name: buyer.firstName || '',
      last_name: buyer.lastName || '',
      full_name: `${buyer.firstName} ${buyer.lastName}`.trim(),
      email: buyer.email,
      phone: buyer.phone || '',
      city: buyer.preferredCity || buyer.city || '',
      state: buyer.preferredState || buyer.state || '',
      max_monthly_payment: buyer.maxMonthlyPayment || 0,
      max_down_payment: buyer.maxDownPayment || 0,
      search_radius: buyer.searchRadius || 25,
      languages: buyer.languages?.join(', ') || 'English',
      source: 'ownerfi_platform_backfill',
      created_at: buyer.createdAt || new Date().toISOString()
    };

    const response = await fetch(GHL_BUYER_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buyerPayload)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return { success: false, error: `Webhook error: ${response.status} - ${errorText}` };
    }

    return { success: true };

  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function main() {
  console.log('🚀 Starting buyer sync to GoHighLevel...\n');

  try {
    // Fetch all buyer profiles
    const buyerProfilesSnapshot = await db.collection('buyerProfiles').get();
    const totalBuyers = buyerProfilesSnapshot.size;

    console.log(`📊 Found ${totalBuyers} buyer profiles\n`);

    if (totalBuyers === 0) {
      console.log('✅ No buyers to sync');
      return;
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ buyerId: string; email: string; error: string }> = [];

    // Process buyers in batches with rate limiting
    for (const doc of buyerProfilesSnapshot.docs) {
      const buyerData = doc.data() as BuyerProfile;
      const buyer: BuyerProfile = {
        id: doc.id,
        ...buyerData
      };

      console.log(`\n📤 Syncing: ${buyer.email} (${buyer.firstName} ${buyer.lastName})`);
      console.log(`   ID: ${buyer.id}`);
      console.log(`   Location: ${buyer.preferredCity || buyer.city}, ${buyer.preferredState || buyer.state}`);
      console.log(`   Budget: $${buyer.maxMonthlyPayment}/mo, $${buyer.maxDownPayment} down`);

      const result = await syncBuyerToGHL(buyer);

      if (result.success) {
        successCount++;
        console.log(`   ✅ Success`);
      } else {
        failedCount++;
        console.log(`   ❌ Failed: ${result.error}`);
        errors.push({
          buyerId: buyer.id,
          email: buyer.email,
          error: result.error || 'Unknown error'
        });
      }

      // Rate limiting - wait 200ms between requests to avoid overwhelming GHL
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SYNC SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total buyers: ${totalBuyers}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    console.log('='.repeat(60));

    if (errors.length > 0) {
      console.log('\n❌ ERRORS:');
      errors.forEach(({ buyerId, email, error }) => {
        console.log(`\n  Buyer: ${email} (${buyerId})`);
        console.log(`  Error: ${error}`);
      });
    }

    console.log('\n✅ Sync complete!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
