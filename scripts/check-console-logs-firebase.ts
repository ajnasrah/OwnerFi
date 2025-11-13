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

async function checkForAnyLogs() {
  try {
    console.log('\n🔍 Searching for ANY log collections in Firebase');
    console.log('='.repeat(80));

    const collections = await db.listCollections();
    console.log(`\nFound ${collections.length} collections total\n`);

    const logRelated = collections.filter(c =>
      c.id.toLowerCase().includes('log') ||
      c.id.toLowerCase().includes('notification') ||
      c.id.toLowerCase().includes('sms') ||
      c.id.toLowerCase().includes('webhook') ||
      c.id.toLowerCase().includes('event')
    );

    if (logRelated.length > 0) {
      console.log(`📋 Found ${logRelated.length} potentially relevant collections:`);
      logRelated.forEach(c => console.log(`  - ${c.id}`));

      // Check each collection for recent documents
      for (const collection of logRelated) {
        console.log(`\n\n📂 Collection: ${collection.id}`);
        console.log('-'.repeat(80));

        const snapshot = await db.collection(collection.id).limit(10).get();
        console.log(`Total documents: ${snapshot.size}`);

        if (snapshot.size > 0) {
          console.log('\nSample documents:');
          snapshot.docs.slice(0, 5).forEach((doc, i) => {
            const data = doc.data();
            console.log(`\n${i + 1}. Document ID: ${doc.id}`);
            console.log(`   Fields: ${Object.keys(data).join(', ')}`);

            // Show timestamp if available
            const timestamp = data.timestamp || data.createdAt || data.updatedAt || data.date;
            if (timestamp) {
              const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
              console.log(`   Timestamp: ${date.toLocaleString()}`);
            }
          });
        }
      }
    } else {
      console.log('❌ No log-related collections found');
    }

    // Since there's no logging, let's check the actual property and buyer to infer
    console.log('\n\n🔍 Inferring what happened from property/buyer data');
    console.log('='.repeat(80));

    const propertyId = '5di4UYPJgQdJwEH1Cfh4';
    const propertyDoc = await db.collection('properties').doc(propertyId).get();
    const property = propertyDoc.data()!;

    const buyersSnapshot = await db.collection('buyerProfiles')
      .where('phone', '==', '2063954410')
      .get();
    const buyer = buyersSnapshot.docs[0].data();

    const propertyCreated = property.createdAt?.toDate();
    const lastMatchUpdate = buyer.lastMatchUpdate?.toDate();

    console.log(`\nProperty created: ${propertyCreated?.toLocaleString()}`);
    console.log(`Buyer match updated: ${lastMatchUpdate?.toLocaleString()}`);

    if (propertyCreated && lastMatchUpdate) {
      const timeDiff = Math.abs(lastMatchUpdate.getTime() - propertyCreated.getTime());
      console.log(`Time difference: ${timeDiff}ms (${(timeDiff/1000).toFixed(1)}s)`);

      if (timeDiff < 5000) {
        console.log('\n✅ INFERENCE: Webhook matching logic DID execute');
        console.log('   The buyer was matched within 5 seconds of property creation.');
        console.log('   This means the webhook code at lines 774-900 ran successfully.');
        console.log('\n📱 INFERENCE: Notification code path WAS reached');
        console.log('   All conditions were met:');
        console.log(`   - property.status === 'active': ${property.status === 'active'}`);
        console.log(`   - property.isActive === true: ${property.isActive === true}`);
        console.log(`   - Matched buyers found: YES (Abir Besbes)`);
        console.log(`   - GOHIGHLEVEL_WEBHOOK_URL configured: ${!!process.env.GOHIGHLEVEL_WEBHOOK_URL}`);
        console.log('\n❓ QUESTION: Was the fetch() call made?');
        console.log('   We tested the webhook manually - it works (200 OK)');
        console.log('   Since all conditions were met, the fetch() SHOULD have been called.');
        console.log('\n   However, without logs we cannot confirm:');
        console.log('   1. If the fetch() actually executed');
        console.log('   2. If GHL received it (likely yes based on our test)');
        console.log('   3. If GHL\'s workflow processed it');
        console.log('   4. If GHL sent the SMS');
      }
    }

    console.log('\n\n💡 RECOMMENDATION:');
    console.log('='.repeat(80));
    console.log('Add persistent logging to the webhook to track notifications:');
    console.log('');
    console.log('// In save-property/route.ts after line 876');
    console.log('await db.collection("notificationLogs").add({');
    console.log('  timestamp: serverTimestamp(),');
    console.log('  propertyId,');
    console.log('  buyerId: buyer.id,');
    console.log('  buyerPhone: buyer.phone,');
    console.log('  status: response.ok ? "sent" : "failed",');
    console.log('  statusCode: response.status,');
    console.log('  trigger: isUpdate ? "buyer_criteria_changed" : "new_property_added"');
    console.log('});');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkForAnyLogs();
