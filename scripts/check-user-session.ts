import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getAllPhoneFormats } from '../src/lib/phone-utils';

const phone = process.argv[2] || '9018319661';
const formats = getAllPhoneFormats(phone);
console.log('Searching for USER with phone formats:', formats);

async function search() {
  // Check users collection first
  for (const format of formats) {
    const q = query(collection(db, 'users'), where('phone', '==', format));
    const snap = await getDocs(q);
    if (snap.empty === false) {
      console.log('✅ Found USER by phone:', format);
      const data = snap.docs[0].data();
      console.log('User record:', {
        id: snap.docs[0].id,
        phone: data.phone,
        role: data.role,
        name: data.name,
        email: data.email
      });

      // Now check if there's a buyer profile that matches
      console.log('\n--- Checking buyer profile linkage ---');

      // Check by userId
      const byUserId = query(collection(db, 'buyerProfiles'), where('userId', '==', snap.docs[0].id));
      const byUserIdSnap = await getDocs(byUserId);
      if (byUserIdSnap.empty === false) {
        console.log('✅ buyerProfile found by userId match');
        console.log('   Profile userId:', byUserIdSnap.docs[0].data().userId);
      } else {
        console.log('❌ No buyerProfile found by userId');
      }

      // Check by phone
      for (const f of formats) {
        const byPhone = query(collection(db, 'buyerProfiles'), where('phone', '==', f));
        const byPhoneSnap = await getDocs(byPhone);
        if (byPhoneSnap.empty === false) {
          console.log('✅ buyerProfile found by phone:', f);
          const profileData = byPhoneSnap.docs[0].data();
          console.log('   Profile phone:', profileData.phone);
          console.log('   Profile userId:', profileData.userId);
          console.log('   MISMATCH?', profileData.userId !== snap.docs[0].id);
          break;
        }
      }
      return;
    }
  }
  console.log('❌ No user found with this phone');
}

search().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
