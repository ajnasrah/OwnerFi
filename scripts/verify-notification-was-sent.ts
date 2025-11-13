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

async function verifyNotificationSent() {
  try {
    console.log('\n🔍 Verifying Notification Logic Execution');
    console.log('='.repeat(80));

    const propertyId = '5di4UYPJgQdJwEH1Cfh4'; // San Antonio property
    const buyerPhone = '2063954410'; // Abir Besbes

    // Get the property
    const propertyDoc = await db.collection('properties').doc(propertyId).get();
    const property = propertyDoc.data()!;

    console.log(`\nProperty: ${property.address}, ${property.city}, ${property.state}`);
    console.log(`Status: ${property.status}`);
    console.log(`Active: ${property.isActive}`);
    console.log(`Created: ${property.createdAt?.toDate().toLocaleString()}`);

    // Get the buyer
    const buyersSnapshot = await db.collection('buyerProfiles')
      .where('phone', '==', buyerPhone)
      .get();

    if (buyersSnapshot.empty) {
      console.log('\n❌ Buyer not found');
      return;
    }

    const buyerDoc = buyersSnapshot.docs[0];
    const buyer = buyerDoc.data();

    console.log(`\nBuyer: ${buyer.firstName} ${buyer.lastName}`);
    console.log(`Active: ${buyer.isActive}`);

    // Check if property is in buyer's matched IDs
    const isMatched = buyer.matchedPropertyIds?.includes(propertyId);
    console.log(`\nProperty in buyer's matchedPropertyIds: ${isMatched ? '✅ YES' : '❌ NO'}`);

    if (isMatched) {
      console.log(`Last match update: ${buyer.lastMatchUpdate?.toDate().toLocaleString()}`);

      // Compare times
      const propertyCreated = property.createdAt?.toDate();
      const lastMatchUpdate = buyer.lastMatchUpdate?.toDate();

      if (propertyCreated && lastMatchUpdate) {
        const timeDiff = Math.abs(lastMatchUpdate.getTime() - propertyCreated.getTime()) / 1000;
        console.log(`Time between property creation and match: ${timeDiff.toFixed(0)} seconds`);

        if (timeDiff < 60) {
          console.log('✅ Match was made immediately after property creation (< 60s)');
          console.log('   This confirms the webhook matching logic executed successfully');
        }
      }
    }

    // Now let's check what SHOULD have happened
    console.log('\n\n📋 Expected Execution Flow:');
    console.log('='.repeat(80));

    const conditions = [
      {
        condition: property.status === 'active',
        label: '1. Property status is "active"',
        result: property.status === 'active'
      },
      {
        condition: property.isActive === true,
        label: '2. Property isActive is true',
        result: property.isActive === true
      },
      {
        condition: property.state === buyer.preferredState,
        label: '3. Property state matches buyer state',
        result: property.state === buyer.preferredState
      },
      {
        condition: buyer.isActive === true,
        label: '4. Buyer isActive is true',
        result: buyer.isActive === true
      },
      {
        condition: isMatched,
        label: '5. Property was added to matchedPropertyIds',
        result: isMatched
      }
    ];

    conditions.forEach(c => {
      console.log(`${c.result ? '✅' : '❌'} ${c.label}: ${c.result}`);
    });

    const allConditionsMet = conditions.every(c => c.result);

    console.log(`\n\n🎯 CONCLUSION:`);
    console.log('='.repeat(80));

    if (allConditionsMet) {
      console.log('✅ All conditions were met for notification to be sent');
      console.log('\n📱 According to the code, a notification SHOULD have been sent to:');
      console.log(`   URL: ${process.env.GOHIGHLEVEL_WEBHOOK_URL}`);
      console.log(`   Phone: ${buyer.phone}`);
      console.log(`   Buyer: ${buyer.firstName} ${buyer.lastName}`);
      console.log('\n⚠️  However, there is NO persistent logging in the code');
      console.log('   We cannot verify if:');
      console.log('   - The fetch request was made');
      console.log('   - GHL webhook received it');
      console.log('   - GHL webhook sent the SMS');
      console.log('   - The SMS was delivered to the buyer');
      console.log('\n💡 The test we just ran proves the webhook URL works.');
      console.log('   If the notification wasn\'t received, possible reasons:');
      console.log('   1. GHL workflow is not configured to send SMS');
      console.log('   2. Phone number format issue in GHL');
      console.log('   3. SMS sending failed on GHL side');
      console.log('   4. Buyer\'s phone is invalid/blocked');
    } else {
      console.log('❌ Not all conditions were met');
      console.log('   The notification logic would not have executed');
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyNotificationSent();
