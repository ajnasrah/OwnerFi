// Script to check Dallas buyer leads and diagnose the count discrepancy
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkDallasLeads() {
  try {
    console.log('Checking Dallas buyer leads...\n');

    // Get all buyer profiles
    const allBuyersSnapshot = await db.collection('buyerProfiles').get();
    console.log(`Total buyer profiles in database: ${allBuyersSnapshot.size}`);

    // Filter for Dallas
    const dallasBuyers = [];
    const dallasAvailableBuyers = [];
    const dallasInactiveBuyers = [];
    const dallasIncompleteProfiles = [];

    allBuyersSnapshot.forEach(doc => {
      const buyer = { id: doc.id, ...doc.data() };

      // Check if buyer is in Dallas
      const city = (buyer.preferredCity || buyer.city || '').toLowerCase();
      if (city === 'dallas') {
        dallasBuyers.push(buyer);

        // Check availability flags
        if (buyer.isAvailableForPurchase && buyer.isActive && buyer.profileComplete) {
          dallasAvailableBuyers.push(buyer);
        } else {
          // Diagnose why not available
          if (!buyer.isAvailableForPurchase) {
            console.log(`  - ${buyer.firstName} ${buyer.lastName}: Not available for purchase`);
          }
          if (!buyer.isActive) {
            dallasInactiveBuyers.push(buyer);
            console.log(`  - ${buyer.firstName} ${buyer.lastName}: Inactive`);
          }
          if (!buyer.profileComplete) {
            dallasIncompleteProfiles.push(buyer);
            console.log(`  - ${buyer.firstName} ${buyer.lastName}: Profile incomplete`);
          }
        }
      }
    });

    console.log(`\n=== DALLAS BUYER SUMMARY ===`);
    console.log(`Total Dallas buyers: ${dallasBuyers.length}`);
    console.log(`Available for purchase: ${dallasAvailableBuyers.length}`);
    console.log(`Inactive: ${dallasInactiveBuyers.length}`);
    console.log(`Incomplete profiles: ${dallasIncompleteProfiles.length}`);

    // Now check using the same query as the app
    console.log('\n=== TESTING APP QUERY ===');
    const appQuerySnapshot = await db.collection('buyerProfiles')
      .where('preferredState', '==', 'TX')
      .where('isAvailableForPurchase', '==', true)
      .where('isActive', '==', true)
      .where('profileComplete', '==', true)
      .get();

    console.log(`Query returned: ${appQuerySnapshot.size} buyers in TX`);

    // Count Dallas buyers from this query
    let dallasFromQuery = 0;
    appQuerySnapshot.forEach(doc => {
      const buyer = doc.data();
      const city = (buyer.preferredCity || buyer.city || '').toLowerCase();
      if (city === 'dallas') {
        dallasFromQuery++;
      }
    });

    console.log(`Dallas buyers from TX query: ${dallasFromQuery}`);

    // List all available Dallas buyers
    console.log('\n=== AVAILABLE DALLAS BUYERS ===');
    dallasAvailableBuyers.forEach((buyer, index) => {
      console.log(`${index + 1}. ${buyer.firstName} ${buyer.lastName}`);
      console.log(`   Email: ${buyer.email}`);
      console.log(`   City: ${buyer.preferredCity || buyer.city}`);
      console.log(`   State: ${buyer.preferredState || buyer.state || 'TX'}`);
      console.log(`   Budget: $${buyer.maxMonthlyPayment}/mo, $${buyer.maxDownPayment} down`);
      console.log(`   Flags: Available=${buyer.isAvailableForPurchase}, Active=${buyer.isActive}, Complete=${buyer.profileComplete}`);
      console.log('');
    });

    // Check if there's a mismatch in state field names
    console.log('\n=== CHECKING STATE FIELD CONSISTENCY ===');
    dallasBuyers.forEach(buyer => {
      if (!buyer.preferredState && buyer.state) {
        console.log(`⚠️ ${buyer.firstName} ${buyer.lastName} has 'state' but no 'preferredState'`);
      }
      if (buyer.preferredState !== 'TX' && buyer.state === 'TX') {
        console.log(`⚠️ ${buyer.firstName} ${buyer.lastName} has mismatched state fields`);
      }
    });

  } catch (error) {
    console.error('Error checking Dallas leads:', error);
  } finally {
    await admin.app().delete();
  }
}

// Run the script
checkDallasLeads();