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

// Test getAllPhoneFormats function locally
function getAllPhoneFormats(phone: string): string[] {
  if (!phone) {
    return [];
  }
  
  const cleaned = phone.replace(/\D/g, '');
  const last10 = cleaned.slice(-10);
  
  if (last10.length !== 10) {
    return [phone]; // Return original if not a valid format
  }
  
  const formats = [
    `+1${last10}`,                                                                // E.164: +19018319661
    last10,                                                                        // 10 digits: 9018319661
    `1${last10}`,                                                                  // 11 digits: 19018319661
    `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`,          // Formatted: (901) 831-9661
  ];
  
  return [...new Set(formats)]; // Remove duplicates
}

async function testPhoneLookup() {
  const testPhone = '9016796871'; // Juan's phone
  
  console.log('=== TESTING PHONE LOOKUP FOR:', testPhone, '===\n');
  
  // Generate all formats
  const formats = getAllPhoneFormats(testPhone);
  console.log('Phone formats to search:');
  formats.forEach(f => console.log(`  - "${f}"`));
  
  console.log('\n=== SEARCHING DATABASE ===\n');
  
  // Try each format
  for (const format of formats) {
    const usersSnapshot = await db.collection('users')
      .where('phone', '==', format)
      .limit(1)
      .get();
    
    if (!usersSnapshot.empty) {
      const user = usersSnapshot.docs[0].data();
      console.log(`✅ FOUND with format "${format}":`);
      console.log(`   ID: ${usersSnapshot.docs[0].id}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Phone in DB: ${user.phone}`);
      console.log(`   Role: ${user.role}`);
    } else {
      console.log(`❌ Not found with format: "${format}"`);
    }
  }
  
  // Also check what format is actually stored
  console.log('\n=== CHECKING ACTUAL STORED FORMAT ===\n');
  
  // Search by email to find Juan
  const byEmailSnapshot = await db.collection('users')
    .where('email', '==', 'martinez.juan.c.0519@gmail.com')
    .get();
  
  if (!byEmailSnapshot.empty) {
    byEmailSnapshot.docs.forEach(doc => {
      const user = doc.data();
      console.log(`Found by email:`);
      console.log(`  ID: ${doc.id}`);
      console.log(`  Phone stored as: "${user.phone}"`);
      console.log(`  Phone type: ${typeof user.phone}`);
      console.log(`  Phone length: ${user.phone ? user.phone.length : 0}`);
      
      // Check if this phone format is in our search list
      if (formats.includes(user.phone)) {
        console.log(`  ✅ This format IS in our search list`);
      } else {
        console.log(`  ❌ This format is NOT in our search list!`);
        console.log(`     This is why the user isn't found during login!`);
      }
    });
  }
  
  // Test with other problematic users
  console.log('\n=== CHECKING OTHER USERS FOR PHONE FORMAT ISSUES ===\n');
  
  const sampleUsers = await db.collection('users')
    .where('role', '==', 'buyer')
    .limit(20)
    .get();
  
  let formatMismatches = 0;
  sampleUsers.docs.forEach(doc => {
    const user = doc.data();
    if (user.phone) {
      const searchFormats = getAllPhoneFormats(user.phone);
      if (!searchFormats.includes(user.phone)) {
        formatMismatches++;
        if (formatMismatches <= 5) {
          console.log(`Format mismatch for user ${doc.id}:`);
          console.log(`  Stored as: "${user.phone}"`);
          console.log(`  Search formats: ${searchFormats.join(', ')}`);
        }
      }
    }
  });
  
  if (formatMismatches > 0) {
    console.log(`\n❌ Found ${formatMismatches} users with phone format mismatches`);
    console.log('These users will create new accounts on every login!');
  } else {
    console.log('✅ No phone format mismatches found in sample');
  }
}

testPhoneLookup().then(() => {
  console.log('\n✅ Test complete!');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});