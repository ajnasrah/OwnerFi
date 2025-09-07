// Script to fix trial dates for existing accounts
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'ownerfi-e9b1c.appspot.com'
  });
}

const db = admin.firestore();

async function fixTrialDates() {
  try {
    // Find realtors on trial
    const realtorsSnapshot = await db.collection('realtors')
      .where('isOnTrial', '==', true)
      .get();
    
    console.log(`Found ${realtorsSnapshot.size} realtors on trial`);
    
    for (const doc of realtorsSnapshot.docs) {
      const realtor = doc.data();
      console.log(`\nProcessing realtor: ${realtor.firstName} ${realtor.lastName}`);
      
      // Check if dates need fixing
      const createdAt = realtor.createdAt?.toDate ? realtor.createdAt.toDate() : new Date(realtor.createdAt);
      
      // Calculate correct trial dates based on creation date
      const trialStart = new Date(createdAt);
      const trialEnd = new Date(createdAt);
      trialEnd.setDate(trialEnd.getDate() + 7);
      
      console.log(`  Created: ${createdAt.toISOString()}`);
      console.log(`  Trial should end: ${trialEnd.toISOString()}`);
      
      // Update the realtor document with correct dates
      await db.collection('realtors').doc(doc.id).update({
        trialStartDate: trialStart,
        trialEndDate: trialEnd,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Also fix the subscription record
      const subscriptionSnapshot = await db.collection('realtorSubscriptions')
        .where('realtorId', '==', doc.id)
        .where('plan', '==', 'trial')
        .get();
      
      if (!subscriptionSnapshot.empty) {
        const subDoc = subscriptionSnapshot.docs[0];
        await db.collection('realtorSubscriptions').doc(subDoc.id).update({
          currentPeriodStart: trialStart,
          currentPeriodEnd: trialEnd,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('  ✓ Fixed trial subscription dates');
      }
    }
    
    console.log('\nTrial dates fixed successfully!');
  } catch (error) {
    console.error('Error fixing trial dates:', error);
  }
}

fixTrialDates();