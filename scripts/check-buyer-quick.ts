import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getAllPhoneFormats } from '../src/lib/phone-utils';

const phone = process.argv[2] || '9018319661';
const formats = getAllPhoneFormats(phone);
console.log('Searching formats:', formats);

async function search() {
  for (const format of formats) {
    const q = query(collection(db, 'buyerProfiles'), where('phone', '==', format));
    const snap = await getDocs(q);
    if (snap.empty === false) {
      console.log('✅ Found BUYER PROFILE by:', format);
      const data = snap.docs[0].data();
      console.log('Profile:', {
        id: snap.docs[0].id,
        phone: data.phone,
        userId: data.userId,
        city: data.city || data.preferredCity,
        state: data.state || data.preferredState,
        profileComplete: data.profileComplete,
        maxMonthlyPayment: data.maxMonthlyPayment,
        maxDownPayment: data.maxDownPayment
      });
      return;
    }
  }

  // Also check users collection
  console.log('Not found in buyerProfiles, checking users...');
  for (const format of formats) {
    const q = query(collection(db, 'users'), where('phone', '==', format));
    const snap = await getDocs(q);
    if (snap.empty === false) {
      console.log('✅ Found USER by:', format);
      const data = snap.docs[0].data();
      console.log('User:', {
        id: snap.docs[0].id,
        phone: data.phone,
        role: data.role,
        name: data.name
      });

      // Check if there's a buyer profile with this userId
      const userQ = query(collection(db, 'buyerProfiles'), where('userId', '==', snap.docs[0].id));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty === false) {
        console.log('✅ Found BUYER PROFILE by userId:');
        const profileData = userSnap.docs[0].data();
        console.log('Profile:', {
          id: userSnap.docs[0].id,
          phone: profileData.phone,
          city: profileData.city || profileData.preferredCity,
          profileComplete: profileData.profileComplete
        });
      } else {
        console.log('❌ No buyerProfile found for this user');
      }
      return;
    }
  }
  console.log('❌ Not found anywhere');
}

search().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
