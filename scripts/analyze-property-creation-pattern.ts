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

async function analyzePropertyPattern() {
  try {
    console.log('\n📊 Property Creation Pattern Analysis');
    console.log('='.repeat(80));

    // Get all GHL properties
    const propertiesSnapshot = await db.collection('properties')
      .where('source', '==', 'gohighlevel')
      .get();

    console.log(`\nTotal GHL properties: ${propertiesSnapshot.size}`);

    // Analyze by date
    const byDate: Map<string, any[]> = new Map();

    propertiesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || new Date(data.dateAdded);
      const dateStr = createdAt.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!byDate.has(dateStr)) {
        byDate.set(dateStr, []);
      }
      byDate.get(dateStr)!.push({
        id: doc.id,
        address: data.address,
        city: data.city,
        state: data.state,
        price: data.price,
        createdAt: createdAt
      });
    });

    // Sort dates
    const sortedDates = Array.from(byDate.keys()).sort();

    console.log('\n\n📅 Properties by Date:');
    console.log('='.repeat(80));

    sortedDates.forEach(date => {
      const props = byDate.get(date)!;
      console.log(`\n${date} (${new Date(date).toLocaleDateString()}): ${props.length} properties`);
    });

    // Analyze today and recent days
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);

    console.log('\n\n📈 Last 7 Days Activity:');
    console.log('='.repeat(80));

    let totalLast7Days = 0;
    sortedDates.forEach(date => {
      const dateObj = new Date(date);
      if (dateObj >= last7Days) {
        const props = byDate.get(date)!;
        totalLast7Days += props.length;

        console.log(`\n${date}:`);
        props.forEach((p, i) => {
          console.log(`  ${i + 1}. ${p.address}, ${p.city}, ${p.state} - $${p.price?.toLocaleString()}`);
          console.log(`     Created: ${p.createdAt.toLocaleTimeString()}`);
        });
      }
    });

    console.log(`\n\nTotal last 7 days: ${totalLast7Days} properties`);

    // Analyze property data completeness
    console.log('\n\n🔍 Data Completeness Analysis (All Properties):');
    console.log('='.repeat(80));

    let missingAddress = 0;
    let missingCity = 0;
    let missingState = 0;
    let missingPrice = 0;
    let missingBeds = 0;
    let missingBaths = 0;

    propertiesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!data.address || data.address.trim() === '') missingAddress++;
      if (!data.city || data.city.trim() === '') missingCity++;
      if (!data.state || data.state.trim() === '') missingState++;
      if (!data.price || data.price <= 0) missingPrice++;
      if (!data.bedrooms || data.bedrooms === 0) missingBeds++;
      if (!data.bathrooms || data.bathrooms === 0) missingBaths++;
    });

    console.log(`\nMissing/Invalid Fields:`);
    console.log(`  Address: ${missingAddress}/${propertiesSnapshot.size}`);
    console.log(`  City: ${missingCity}/${propertiesSnapshot.size}`);
    console.log(`  State: ${missingState}/${propertiesSnapshot.size}`);
    console.log(`  Price: ${missingPrice}/${propertiesSnapshot.size}`);
    console.log(`  Bedrooms: ${missingBeds}/${propertiesSnapshot.size}`);
    console.log(`  Bathrooms: ${missingBaths}/${propertiesSnapshot.size}`);

    console.log('\n\n💡 Analysis:');
    console.log('='.repeat(80));

    const todayStr = today.toISOString().split('T')[0];
    const todayCount = byDate.get(todayStr)?.length || 0;

    if (todayCount < 10) {
      console.log(`\n⚠️  Only ${todayCount} properties created today.`);
      console.log('\nPossible reasons:');
      console.log('1. The other 44 properties were not sent to the webhook');
      console.log('2. The properties failed validation (missing required fields)');
      console.log('3. The properties were created on a different day');
      console.log('4. The webhook was not triggered for those opportunities');
      console.log('\nTo investigate:');
      console.log('• Check GoHighLevel webhook logs for failed calls');
      console.log('• Verify all 50 opportunities have complete data (address, city, state, price)');
      console.log('• Confirm webhook is configured to trigger on opportunity create/update');
    }

    // Check for batch creation patterns (might indicate bulk import)
    console.log('\n\n🕐 Timing Analysis (Today):');
    console.log('='.repeat(80));

    const todayProps = byDate.get(todayStr) || [];
    if (todayProps.length > 0) {
      // Sort by time
      todayProps.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      console.log(`\nProperties created in chronological order:`);
      todayProps.forEach((p, i) => {
        const timeStr = p.createdAt.toLocaleTimeString();
        const timeDiff = i > 0 ?
          Math.round((p.createdAt.getTime() - todayProps[i-1].createdAt.getTime()) / 1000) :
          0;

        console.log(`${i + 1}. ${timeStr} (${timeDiff > 0 ? `+${timeDiff}s` : 'first'}) - ${p.city}, ${p.state}`);
      });

      // Check if properties were created in quick succession (batch import)
      const timeDiffs = [];
      for (let i = 1; i < todayProps.length; i++) {
        const diff = (todayProps[i].createdAt.getTime() - todayProps[i-1].createdAt.getTime()) / 1000;
        timeDiffs.push(diff);
      }

      if (timeDiffs.length > 0) {
        const avgDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
        console.log(`\nAverage time between properties: ${avgDiff.toFixed(1)} seconds`);

        if (avgDiff < 5) {
          console.log('✅ Properties created rapidly - likely from bulk webhook calls');
        } else if (avgDiff < 60) {
          console.log('⚠️  Properties created within minutes - possible manual creation');
        } else {
          console.log('ℹ️  Properties created over longer period');
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

analyzePropertyPattern();
