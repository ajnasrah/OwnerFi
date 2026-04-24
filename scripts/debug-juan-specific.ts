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

async function debugJuanSpecific() {
  console.log('=== DEBUGGING JUAN\'S SPECIFIC ISSUE ===\n');
  
  // Check for multiple accounts with same email or phone variations
  const phoneVariations = [
    '9016796871',
    '+19016796871', 
    '19016796871',
    '(901) 679-6871',
    '901-679-6871',
    '901.679.6871'
  ];
  
  console.log('Checking all phone variations for duplicates...\n');
  
  const allAccounts = [];
  for (const phoneVar of phoneVariations) {
    const snapshot = await db.collection('users')
      .where('phone', '==', phoneVar)
      .get();
    
    if (!snapshot.empty) {
      snapshot.docs.forEach(doc => {
        const user = doc.data();
        allAccounts.push({
          id: doc.id,
          phone: user.phone,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt?._seconds ? new Date(user.createdAt._seconds * 1000) : null,
          lastSignIn: user.lastSignIn?._seconds ? new Date(user.lastSignIn._seconds * 1000) : null
        });
        console.log(`Found account with phone "${phoneVar}":`);
        console.log(`  ID: ${doc.id}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Created: ${user.createdAt?._seconds ? new Date(user.createdAt._seconds * 1000).toLocaleString() : 'Unknown'}`);
      });
    }
  }
  
  // Check by email
  console.log('\n=== CHECKING BY EMAIL ===');
  const emailSnapshot = await db.collection('users')
    .where('email', '==', 'martinez.juan.c.0519@gmail.com')
    .get();
  
  console.log(`Found ${emailSnapshot.size} accounts with Juan's email`);
  emailSnapshot.docs.forEach(doc => {
    const user = doc.data();
    console.log(`  ID: ${doc.id}, Phone: ${user.phone}, Role: ${user.role}`);
  });
  
  // Check buyerProfiles
  console.log('\n=== CHECKING BUYER PROFILES ===');
  for (const account of allAccounts) {
    const profileSnapshot = await db.collection('buyerProfiles')
      .where('userId', '==', account.id)
      .get();
    
    if (!profileSnapshot.empty) {
      console.log(`Profile found for user ${account.id}:`);
      profileSnapshot.docs.forEach(doc => {
        const profile = doc.data();
        console.log(`  Profile ID: ${doc.id}`);
        console.log(`  Phone in profile: ${profile.phone}`);
        console.log(`  isInvestor: ${profile.isInvestor}`);
      });
    }
    
    // Also check by phone in buyerProfile
    const profileByPhone = await db.collection('buyerProfiles')
      .where('phone', '==', account.phone)
      .get();
    
    if (!profileByPhone.empty && profileByPhone.docs[0].id !== profileSnapshot.docs[0]?.id) {
      console.log(`  ⚠️  DIFFERENT profile found by phone!`);
      profileByPhone.docs.forEach(doc => {
        console.log(`    Profile ID: ${doc.id}, userId: ${doc.data().userId}`);
      });
    }
  }
  
  // Check sessions/auth issues
  console.log('\n=== POSSIBLE CAUSES FOR JUAN\'S ISSUE ===');
  
  if (allAccounts.length > 1) {
    console.log('❌ MULTIPLE ACCOUNTS: Juan has duplicate accounts with different phone formats');
    console.log('   This would cause login confusion');
  }
  
  // Check if phone format in DB doesn't match what's being searched
  const juanUser = await db.collection('users').doc('WKqyrh3lNTkCyhL40RG8').get();
  if (juanUser.exists) {
    const userData = juanUser.data()!;
    console.log('\nJuan\'s main account:');
    console.log(`  Phone stored as: "${userData.phone}"`);
    console.log(`  Email: ${userData.email}`);
    console.log(`  Role: ${userData.role}`);
    
    // Check if he has browser cache issues
    if (userData.lastSignIn?._seconds) {
      const lastSignIn = new Date(userData.lastSignIn._seconds * 1000);
      const hoursSinceSignIn = (Date.now() - lastSignIn.getTime()) / (1000 * 60 * 60);
      console.log(`  Last sign in: ${lastSignIn.toLocaleString()} (${hoursSinceSignIn.toFixed(1)} hours ago)`);
      
      if (hoursSinceSignIn < 1) {
        console.log('  ✅ Recently signed in - session should be active');
      }
    }
  }
  
  // Check for data inconsistencies
  console.log('\n=== CHECKING FOR DATA INCONSISTENCIES ===');
  
  // Check if Juan's filters might be causing issues
  const filterSnapshot = await db.collection('userFilters').doc('WKqyrh3lNTkCyhL40RG8').get();
  if (filterSnapshot.exists) {
    const filters = filterSnapshot.data()!;
    console.log('Juan has filters configured:');
    console.log(`  Locations: ${JSON.stringify(filters.locations || [])}`);
    console.log(`  Deal type: ${filters.dealType}`);
    
    if (filters.locations && filters.locations.length > 0) {
      // Check if properties exist in his locations
      const propCheck = await db.collection('properties')
        .where('city', 'in', filters.locations.slice(0, 10))
        .where('dealType', 'in', ['owner_finance', 'cash', 'both'])
        .limit(5)
        .get();
      
      console.log(`  Properties in his filtered locations: ${propCheck.size}`);
      if (propCheck.empty) {
        console.log('  ❌ NO PROPERTIES IN HIS FILTERED LOCATIONS!');
      }
    }
  } else {
    console.log('Juan has NO filters configured');
  }
  
  // Summary
  console.log('\n=== MOST LIKELY CAUSE ===');
  if (allAccounts.length === 1 && allAccounts[0].phone === '+19016796871') {
    console.log('✅ Juan\'s account setup looks correct');
    console.log('\nThe issue is likely:');
    console.log('1. Browser cache/cookies - he needs to clear browser data');
    console.log('2. He\'s using a different phone format when logging in');
    console.log('3. The environment variable fixes just deployed need a redeploy to take effect');
  }
}

debugJuanSpecific().then(() => {
  console.log('\n✅ Debug complete!');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});