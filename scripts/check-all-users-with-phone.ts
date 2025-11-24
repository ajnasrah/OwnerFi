import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getAllPhoneFormats } from '../src/lib/phone-utils';

const phone = process.argv[2] || '9018319661';
const formats = getAllPhoneFormats(phone);
console.log('Searching for ALL users/profiles with phone formats:', formats);

async function search() {
  console.log('\n=== USERS COLLECTION ===');
  for (const format of formats) {
    const q = query(collection(db, 'users'), where('phone', '==', format));
    const snap = await getDocs(q);
    for (const doc of snap.docs) {
      const data = doc.data();
      console.log(`User [${format}]:`, {
        id: doc.id,
        phone: data.phone,
        role: data.role,
        name: data.name,
        email: data.email
      });
    }
  }

  console.log('\n=== BUYER PROFILES COLLECTION ===');
  for (const format of formats) {
    const q = query(collection(db, 'buyerProfiles'), where('phone', '==', format));
    const snap = await getDocs(q);
    for (const doc of snap.docs) {
      const data = doc.data();
      console.log(`BuyerProfile [${format}]:`, {
        id: doc.id,
        phone: data.phone,
        userId: data.userId,
        city: data.city || data.preferredCity,
        email: data.email
      });
    }
  }
}

search().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
