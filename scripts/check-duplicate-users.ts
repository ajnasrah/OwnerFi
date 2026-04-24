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

async function checkDuplicateUsers() {
  console.log('=== CHECKING FOR DUPLICATE USER ACCOUNTS ===\n');
  
  // Get all users and group by email and name
  const allUsersSnapshot = await db.collection('users').get();
  
  const emailMap = new Map<string, any[]>();
  const nameMap = new Map<string, any[]>();
  const phoneMap = new Map<string, any[]>();
  
  allUsersSnapshot.docs.forEach(doc => {
    const user = { id: doc.id, ...doc.data() };
    
    // Group by email
    if (user.email) {
      const email = user.email.toLowerCase();
      if (!emailMap.has(email)) emailMap.set(email, []);
      emailMap.get(email)!.push(user);
    }
    
    // Group by name
    if (user.name) {
      const name = user.name.toLowerCase();
      if (!nameMap.has(name)) nameMap.set(name, []);
      nameMap.get(name)!.push(user);
    }
    
    // Group by phone (normalize first)
    if (user.phone) {
      // Extract just digits for comparison
      const phoneDigits = user.phone.replace(/\D/g, '').slice(-10);
      if (phoneDigits.length === 10) {
        if (!phoneMap.has(phoneDigits)) phoneMap.set(phoneDigits, []);
        phoneMap.get(phoneDigits)!.push(user);
      }
    }
  });
  
  // Find duplicates
  console.log('=== DUPLICATE ANALYSIS ===\n');
  
  let duplicateEmails = 0;
  let duplicateNames = 0;
  let duplicatePhones = 0;
  
  console.log('DUPLICATE EMAILS:');
  emailMap.forEach((users, email) => {
    if (users.length > 1) {
      duplicateEmails++;
      console.log(`\nEmail: ${email} (${users.length} accounts)`);
      users.forEach(u => {
        const lastSignIn = u.lastSignIn ? 
          (u.lastSignIn._seconds ? new Date(u.lastSignIn._seconds * 1000).toLocaleString() : 'Invalid') 
          : 'Never';
        console.log(`  - ID: ${u.id}`);
        console.log(`    Phone: ${u.phone || 'Not set'}`);
        console.log(`    Name: ${u.name || 'Not set'}`);
        console.log(`    Role: ${u.role}`);
        console.log(`    Last Sign In: ${lastSignIn}`);
      });
    }
  });
  
  if (duplicateEmails === 0) {
    console.log('  No duplicate emails found');
  }
  
  console.log('\n\nDUPLICATE NAMES:');
  let juanDuplicates: any[] = [];
  nameMap.forEach((users, name) => {
    if (users.length > 1) {
      duplicateNames++;
      
      // Special check for Juan Martinez
      if (name.includes('juan') && name.includes('martinez')) {
        juanDuplicates = users;
      }
      
      // Only show first 5 duplicate names
      if (duplicateNames <= 5) {
        console.log(`\nName: ${name} (${users.length} accounts)`);
        users.forEach(u => {
          const lastSignIn = u.lastSignIn ? 
            (u.lastSignIn._seconds ? new Date(u.lastSignIn._seconds * 1000).toLocaleString() : 'Invalid') 
            : 'Never';
          console.log(`  - ID: ${u.id}`);
          console.log(`    Phone: ${u.phone || 'Not set'}`);
          console.log(`    Email: ${u.email || 'Not set'}`);
          console.log(`    Role: ${u.role}`);
          console.log(`    Last Sign In: ${lastSignIn}`);
        });
      }
    }
  });
  
  if (duplicateNames > 5) {
    console.log(`\n... and ${duplicateNames - 5} more duplicate names`);
  }
  
  console.log('\n\nDUPLICATE PHONE NUMBERS:');
  let phoneDupCount = 0;
  phoneMap.forEach((users, phoneDigits) => {
    if (users.length > 1) {
      duplicatePhones++;
      phoneDupCount++;
      
      // Show first 10
      if (phoneDupCount <= 10) {
        console.log(`\nPhone ending in: ...${phoneDigits.slice(-4)} (${users.length} accounts)`);
        users.forEach(u => {
          const lastSignIn = u.lastSignIn ? 
            (u.lastSignIn._seconds ? new Date(u.lastSignIn._seconds * 1000).toLocaleString() : 'Invalid') 
            : 'Never';
          console.log(`  - ID: ${u.id}`);
          console.log(`    Phone format: ${u.phone}`);
          console.log(`    Name: ${u.name || 'Not set'}`);
          console.log(`    Email: ${u.email || 'Not set'}`);
          console.log(`    Role: ${u.role}`);
          console.log(`    Last Sign In: ${lastSignIn}`);
        });
      }
    }
  });
  
  if (phoneDupCount > 10) {
    console.log(`\n... and ${phoneDupCount - 10} more duplicate phone numbers`);
  }
  
  // Special focus on Juan Martinez
  if (juanDuplicates.length > 0) {
    console.log('\n\n=== JUAN MARTINEZ DUPLICATES ===');
    console.log(`Found ${juanDuplicates.length} accounts for Juan Martinez:`);
    juanDuplicates.forEach(u => {
      const lastSignIn = u.lastSignIn ? 
        (u.lastSignIn._seconds ? new Date(u.lastSignIn._seconds * 1000).toLocaleString() : 'Invalid') 
        : 'Never';
      console.log(`\n  ID: ${u.id}`);
      console.log(`  Phone: ${u.phone || 'Not set'}`);
      console.log(`  Email: ${u.email || 'Not set'}`);
      console.log(`  Role: ${u.role}`);
      console.log(`  Last Sign In: ${lastSignIn}`);
      console.log(`  Created At: ${u.createdAt ? 
        (u.createdAt._seconds ? new Date(u.createdAt._seconds * 1000).toLocaleString() : 'Invalid')
        : 'Unknown'}`);
    });
  }
  
  console.log('\n\n=== SUMMARY ===');
  console.log(`Total users: ${allUsersSnapshot.size}`);
  console.log(`Duplicate emails: ${duplicateEmails}`);
  console.log(`Duplicate names: ${duplicateNames}`);
  console.log(`Duplicate phone numbers: ${duplicatePhones}`);
  
  if (duplicatePhones > 0) {
    console.log('\n❌ CRITICAL: Multiple users have duplicate phone numbers!');
    console.log('This is why users create new accounts on every login!');
    console.log('The phone lookup is not finding existing accounts due to format mismatches.');
  }
}

checkDuplicateUsers().then(() => {
  console.log('\n✅ Analysis complete!');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});