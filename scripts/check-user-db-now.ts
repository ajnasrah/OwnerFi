import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getAllPhoneFormats } from '../src/lib/phone-utils';

async function checkUser() {
  const phone = '9018319661';
  const formats = getAllPhoneFormats(phone);

  console.log('Checking for phone formats:', formats);
  console.log('---');

  // Check users collection
  console.log('🔍 Checking USERS collection:');
  let foundInUsers = false;
  for (const format of formats) {
    const q = query(collection(db!, 'users'), where('phone', '==', format));
    const docs = await getDocs(q);
    if (!docs.empty) {
      foundInUsers = true;
      docs.forEach(doc => {
        const data = doc.data();
        console.log(`  Found with format "${format}":`, {
          id: doc.id,
          phone: data.phone,
          role: data.role,
          name: data.name,
          email: data.email
        });
      });
    }
  }
  if (!foundInUsers) {
    console.log('  ❌ No users found with this phone!');
  }

  // Check buyers collection
  console.log('\n🔍 Checking BUYERS collection:');
  let foundInBuyers = false;
  for (const format of formats) {
    const q = query(collection(db!, 'buyers'), where('phone', '==', format));
    const docs = await getDocs(q);
    if (!docs.empty) {
      foundInBuyers = true;
      docs.forEach(doc => {
        const data = doc.data();
        console.log(`  Found with format "${format}":`, {
          id: doc.id,
          phone: data.phone,
          name: data.name || data.firstName,
          userId: data.userId
        });
      });
    }
  }
  if (!foundInBuyers) {
    console.log('  ❌ No buyers found with this phone!');
  }

  process.exit(0);
}

checkUser().catch(console.error);
