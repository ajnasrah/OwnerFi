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

async function checkWebhookActivity() {
  try {
    // Check all GHL properties to see when they were created
    console.log('\n📊 Analyzing GHL Property Creation History');
    console.log('='.repeat(80));

    const propertiesSnapshot = await db.collection('properties')
      .where('source', '==', 'gohighlevel')
      .get();

    console.log(`Total GHL properties in database: ${propertiesSnapshot.size}\n`);

    // Group by date
    const byDate: Record<string, number> = {};
    propertiesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || new Date(data.dateAdded);
      const dateStr = createdAt.toLocaleDateString();
      byDate[dateStr] = (byDate[dateStr] || 0) + 1;
    });

    console.log('Properties created by date:');
    Object.entries(byDate)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .forEach(([date, count]) => {
        console.log(`  ${date}: ${count} properties`);
      });

    // Check today's properties specifically
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysProps = propertiesSnapshot.docs
      .map(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate?.() || new Date(data.dateAdded);
        return { id: doc.id, data, createdAt };
      })
      .filter(p => p.createdAt >= today);

    console.log(`\n\n📅 Today's Properties (${today.toLocaleDateString()})`);
    console.log('='.repeat(80));

    todaysProps.forEach(prop => {
      console.log(`\nProperty: ${prop.data.address}, ${prop.data.city}, ${prop.data.state}`);
      console.log(`  ID: ${prop.id}`);
      console.log(`  Opportunity ID: ${prop.data.opportunityId}`);
      console.log(`  Created: ${prop.createdAt.toLocaleString()}`);
      console.log(`  Status: ${prop.data.status} | Active: ${prop.data.isActive}`);
    });

    // Check for any logs or webhook_calls collection
    console.log('\n\n🔍 Checking for webhook/notification logs...');
    console.log('='.repeat(80));

    const collections = await db.listCollections();
    const logCollections = collections.filter(c =>
      c.id.includes('log') ||
      c.id.includes('webhook') ||
      c.id.includes('notification')
    );

    if (logCollections.length > 0) {
      console.log(`Found log-related collections: ${logCollections.map(c => c.id).join(', ')}`);
    } else {
      console.log('No log collections found');
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkWebhookActivity();
