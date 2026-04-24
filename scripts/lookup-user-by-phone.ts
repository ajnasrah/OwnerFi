import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

async function lookupUserByPhone(phone: string) {
  try {
    // Normalize phone number (remove non-digits, add +1 if needed)
    const normalizedPhone = phone.replace(/\D/g, '');
    const phoneVariants = [
      normalizedPhone,
      `+1${normalizedPhone}`,
      `+${normalizedPhone}`
    ];

    console.log('Searching for phone variants:', phoneVariants);

    // Search in users collection
    for (const phoneVariant of phoneVariants) {
      const usersSnapshot = await db.collection('users')
        .where('phone', '==', phoneVariant)
        .limit(1)
        .get();

      if (!usersSnapshot.empty) {
        const user = usersSnapshot.docs[0];
        const userData = user.data();
        
        console.log('\n=== USER FOUND ===');
        console.log('User ID:', user.id);
        console.log('Phone:', userData.phone);
        console.log('Email:', userData.email);
        console.log('Name:', userData.name || 'Not set');
        console.log('Role:', userData.role);
        
        // Debug timestamp formats
        console.log('\nDEBUG - Raw timestamp values:');
        console.log('lastSignIn raw:', userData.lastSignIn);
        console.log('createdAt raw:', userData.createdAt);
        
        // Handle different timestamp formats (Firebase Timestamp vs milliseconds vs ISO string)
        let lastSignInDate = 'Never';
        if (userData.lastSignIn) {
          if (userData.lastSignIn.toDate) {
            // Firebase Timestamp object
            lastSignInDate = userData.lastSignIn.toDate().toLocaleString();
          } else if (typeof userData.lastSignIn === 'number') {
            // Milliseconds
            lastSignInDate = new Date(userData.lastSignIn).toLocaleString();
          } else if (typeof userData.lastSignIn === 'string') {
            // ISO string
            lastSignInDate = new Date(userData.lastSignIn).toLocaleString();
          } else if (userData.lastSignIn._seconds) {
            // Firebase Timestamp in raw format
            lastSignInDate = new Date(userData.lastSignIn._seconds * 1000).toLocaleString();
          }
        }
        
        let createdAtDate = 'Unknown';
        if (userData.createdAt) {
          if (userData.createdAt.toDate) {
            // Firebase Timestamp object
            createdAtDate = userData.createdAt.toDate().toLocaleString();
          } else if (typeof userData.createdAt === 'number') {
            // Milliseconds
            createdAtDate = new Date(userData.createdAt).toLocaleString();
          } else if (typeof userData.createdAt === 'string') {
            // ISO string
            createdAtDate = new Date(userData.createdAt).toLocaleString();
          } else if (userData.createdAt._seconds) {
            // Firebase Timestamp in raw format
            createdAtDate = new Date(userData.createdAt._seconds * 1000).toLocaleString();
          }
        }
        
        console.log('Last Sign In:', lastSignInDate);
        console.log('Created At:', createdAtDate);
        
        // Check saved properties
        const savedPropsSnapshot = await db.collection('users')
          .doc(user.id)
          .collection('savedProperties')
          .get();
        
        console.log('\n=== SAVED PROPERTIES ===');
        console.log('Total Saved Properties:', savedPropsSnapshot.size);
        
        // Check user's filters
        console.log('\n=== USER FILTERS ===');
        const userFilter = await db.collection('userFilters').doc(user.id).get();
        if (userFilter.exists) {
          const filterData = userFilter.data();
          console.log('Has filters configured: Yes');
          console.log('Locations:', JSON.stringify(filterData?.locations || []));
          console.log('ZIP codes:', JSON.stringify(filterData?.zips || []));
          console.log('Deal type:', filterData?.dealType || 'not set');
          console.log('Price range:', JSON.stringify(filterData?.price || {}));
          console.log('Beds:', filterData?.beds || 'any');
          console.log('Baths:', filterData?.baths || 'any');
          console.log('Exclude land:', filterData?.excludeLand || false);
        } else {
          console.log('Has filters configured: No');
        }
        
        // Get recent properties from main collection based on user's role
        const role = userData.role || 'buyer';
        console.log('\n=== CHECKING AVAILABLE PROPERTIES ===');
        console.log('User role:', role);
        
        if (role === 'buyer') {
          // Test BOTH query methods that the dashboard uses
          console.log('\n1. Testing isOwnerFinance query (Firestore fallback):');
          const isOwnerFinanceQuery = await db.collection('properties')
            .where('isOwnerFinance', '==', true)
            .where('isActive', '==', true)
            .limit(10)
            .get();
          console.log(`   Found ${isOwnerFinanceQuery.size} properties with isOwnerFinance=true`);
          
          console.log('\n2. Testing dealType query (Typesense uses this):');
          const dealTypeQuery1 = await db.collection('properties')
            .where('dealType', '==', 'owner_finance')
            .where('isActive', '==', true)
            .limit(10)
            .get();
          console.log(`   Found ${dealTypeQuery1.size} properties with dealType='owner_finance'`);
          
          const dealTypeQuery2 = await db.collection('properties')
            .where('dealType', '==', 'both')
            .where('isActive', '==', true)
            .limit(10)
            .get();
          console.log(`   Found ${dealTypeQuery2.size} properties with dealType='both'`);
          
          // Use the isOwnerFinance query for display
          const allOwnerFinanceSnapshot = isOwnerFinanceQuery;
          
          console.log('\nSample of available owner finance properties:');
          if (allOwnerFinanceSnapshot.empty) {
            console.log('NO ACTIVE OWNER FINANCE PROPERTIES FOUND!');
          } else {
            allOwnerFinanceSnapshot.docs.slice(0, 5).forEach(doc => {
              const prop = doc.data();
              console.log(`- ${prop.streetAddress || 'No address'}, ${prop.city}, ${prop.state} - $${prop.price || 'N/A'}`);
              console.log(`  isActive: ${prop.isActive}, isOwnerFinance: ${prop.isOwnerFinance}, dealType: ${prop.dealType}`);
            });
          }
          
          // Now check with user's specific filters if they have any
          if (userFilter.exists) {
            const filterData = userFilter.data();
            if (filterData?.locations && filterData.locations.length > 0) {
              console.log('\nChecking properties in user\'s filtered locations:', filterData.locations);
              
              let filteredQuery = db.collection('properties')
                .where('isOwnerFinance', '==', true)
                .where('isActive', '==', true);
              
              // Add location filter if specified
              if (filterData.locations.length > 0) {
                filteredQuery = filteredQuery.where('city', 'in', filterData.locations.slice(0, 10)); // Firestore limit
              }
              
              const filteredSnapshot = await filteredQuery.limit(10).get();
              console.log(`Properties matching user's location filters: ${filteredSnapshot.size}`);
              
              if (filteredSnapshot.empty) {
                console.log('NO PROPERTIES IN USER\'S SELECTED LOCATIONS!');
                // Check what cities actually have properties
                const citiesWithProperties = await db.collection('properties')
                  .where('isOwnerFinance', '==', true)
                  .where('isActive', '==', true)
                  .limit(20)
                  .get();
                
                const cities = new Set();
                citiesWithProperties.docs.forEach(doc => {
                  const city = doc.data().city;
                  if (city) cities.add(city);
                });
                console.log('Cities that actually have owner finance properties:', Array.from(cities));
              }
            }
          }
          
          console.log('\n=== DASHBOARD PROPERTIES COUNT ===');
          console.log('Total available (without filters):', allOwnerFinanceSnapshot.size);
        } else if (role === 'realtor' || role === 'investor') {
          // Realtors and investors see both owner finance and cash deals
          const ownerFinanceSnapshot = await db.collection('properties')
            .where('isOwnerFinance', '==', true)
            .where('isActive', '==', true)
            .limit(50)
            .get();
          
          const cashDealSnapshot = await db.collection('properties')
            .where('isCashDeal', '==', true)
            .where('isActive', '==', true)
            .limit(50)
            .get();
          
          console.log('\n=== DASHBOARD PROPERTIES VISIBILITY ===');
          console.log('Owner Finance Properties Available:', ownerFinanceSnapshot.size);
          console.log('Cash Deal Properties Available:', cashDealSnapshot.size);
          console.log('Total Available:', ownerFinanceSnapshot.size + cashDealSnapshot.size);
        }
        
        return;
      }
    }
    
    console.log('No user found with phone:', phone);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the lookup
const phoneNumber = '9016796871';
lookupUserByPhone(phoneNumber).then(() => process.exit(0));
