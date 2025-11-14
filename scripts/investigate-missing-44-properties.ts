import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!
    })
  });
}

const db = getFirestore();

async function investigateMissingProperties() {
  try {
    console.log('\n🔍 Investigating Missing 44 Properties');
    console.log('='.repeat(80));

    // Get all GHL properties
    const propertiesSnapshot = await db.collection('properties')
      .where('source', '==', 'gohighlevel')
      .get();

    console.log(`\nTotal GHL properties in database: ${propertiesSnapshot.size}`);

    // Analyze by date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);

    // Group by date
    const byDate: Map<string, any[]> = new Map();
    const byOpportunityId: Map<string, any> = new Map();

    propertiesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || new Date(data.dateAdded);
      const dateStr = createdAt.toISOString().split('T')[0];

      if (!byDate.has(dateStr)) {
        byDate.set(dateStr, []);
      }
      byDate.get(dateStr)!.push({
        id: doc.id,
        opportunityId: data.opportunityId,
        address: data.address,
        city: data.city,
        state: data.state,
        price: data.price,
        createdAt: createdAt
      });

      // Track by opportunity ID for duplicate detection
      byOpportunityId.set(data.opportunityId, {
        id: doc.id,
        ...data
      });
    });

    // Show creation pattern
    console.log('\n\n📊 Property Creation Pattern (Last 30 Days):');
    console.log('='.repeat(80));

    const sortedDates = Array.from(byDate.keys())
      .filter(date => new Date(date) >= last30Days)
      .sort();

    sortedDates.forEach(date => {
      const props = byDate.get(date)!;
      const isToday = new Date(date).toDateString() === today.toDateString();
      console.log(`${isToday ? '🆕 TODAY' : '   '} ${date}: ${props.length} properties`);
    });

    // Analyze today's properties in detail
    const todayStr = today.toISOString().split('T')[0];
    const todayProps = byDate.get(todayStr) || [];

    console.log('\n\n📅 Today\'s Properties (Detailed):');
    console.log('='.repeat(80));

    todayProps.forEach((prop, i) => {
      console.log(`\n${i + 1}. ${prop.address}, ${prop.city}, ${prop.state}`);
      console.log(`   Opportunity ID: ${prop.opportunityId}`);
      console.log(`   Property ID: ${prop.id}`);
      console.log(`   Created: ${prop.createdAt.toLocaleString()}`);
      console.log(`   Price: $${prop.price?.toLocaleString()}`);
    });

    // Check for common patterns in missing properties
    console.log('\n\n🔬 Analysis of Property Creation Timeline:');
    console.log('='.repeat(80));

    const last7Days = Array.from(byDate.keys())
      .filter(date => {
        const d = new Date(date);
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return d >= sevenDaysAgo;
      })
      .sort();

    console.log('\nLast 7 days breakdown:');
    last7Days.forEach(date => {
      const props = byDate.get(date)!;
      console.log(`  ${date}: ${props.length} properties`);
    });

    const totalLast7Days = last7Days.reduce((sum, date) => sum + byDate.get(date)!.length, 0);
    const avgPerDay = (totalLast7Days / 7).toFixed(1);

    console.log(`\nAverage per day (last 7 days): ${avgPerDay} properties`);
    console.log(`Today: ${todayProps.length} properties`);

    if (todayProps.length < 10) {
      console.log('\n⚠️  Today is below average!');
    }

    // Check if there are duplicate opportunity IDs
    console.log('\n\n🔍 Checking for Issues:');
    console.log('='.repeat(80));

    // Check for duplicate addresses
    const addressCounts: Map<string, number> = new Map();
    propertiesSnapshot.docs.forEach(doc => {
      const addr = doc.data().address?.toLowerCase() || '';
      addressCounts.set(addr, (addressCounts.get(addr) || 0) + 1);
    });

    const duplicateAddresses = Array.from(addressCounts.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);

    if (duplicateAddresses.length > 0) {
      console.log(`\n⚠️  Found ${duplicateAddresses.length} duplicate addresses:`);
      duplicateAddresses.slice(0, 10).forEach(([addr, count]) => {
        console.log(`  ${addr}: ${count} times`);
      });
      console.log('\nThis could indicate:');
      console.log('  - Properties being updated instead of created as new');
      console.log('  - Webhook being called multiple times for same property');
    } else {
      console.log('\n✅ No duplicate addresses found');
    }

    // Hypothesis about missing 44 properties
    console.log('\n\n💡 Hypothesis - Why Only 6 Properties Created Today:');
    console.log('='.repeat(80));

    console.log('\nPossible explanations:');
    console.log('\n1. ❓ Only 6 opportunities were actually sent to the webhook today');
    console.log('   - The other 44 might have been created on different days');
    console.log('   - Or the webhook trigger is only configured for specific pipeline stages');
    console.log('   - Check GHL automation settings');

    console.log('\n2. ❓ The other 44 failed webhook validation');
    console.log('   - Missing required fields (address, city, state, or price)');
    console.log('   - Check GHL custom field mapping');
    console.log('   - Webhook returns 400 error when validation fails');

    console.log('\n3. ❓ Properties were updated instead of created');
    console.log('   - If opportunity already exists, webhook updates instead of creating new');
    console.log('   - Check opportunity IDs in GHL vs database');

    console.log('\n4. ❓ Webhook was not configured to trigger on all opportunities');
    console.log('   - Different pipeline stages might not trigger webhook');
    console.log('   - Only certain statuses trigger the webhook');

    console.log('\n\n📋 Next Steps to Find Missing Properties:');
    console.log('='.repeat(80));

    console.log('\n1. Check GoHighLevel Webhook Logs:');
    console.log('   - Go to: GHL → Settings → Webhooks');
    console.log('   - Find webhook: /api/gohighlevel/webhook/save-property');
    console.log('   - Check "Recent Deliveries" for failed attempts');
    console.log('   - Look for 400 errors (validation failures)');

    console.log('\n2. Check GoHighLevel Opportunities:');
    console.log('   - Count how many opportunities exist in GHL');
    console.log('   - Filter by creation date = today');
    console.log('   - Compare count with database (should be 6)');

    console.log('\n3. Check Webhook Trigger Configuration:');
    console.log('   - Verify webhook triggers on "Opportunity Created"');
    console.log('   - Check if it triggers on "Opportunity Updated"');
    console.log('   - Ensure all pipeline stages trigger the webhook');

    console.log('\n4. Manual Test:');
    console.log('   - Create a test opportunity in GHL');
    console.log('   - Verify webhook is called');
    console.log('   - Check if validation passes');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

investigateMissingProperties();
