import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

async function checkMemphisProperties() {
  if (!db) {
    console.log('DB not initialized');
    return;
  }

  // Check total active properties in Tennessee
  const tnQuery = query(
    collection(db, 'properties'),
    where('isActive', '==', true),
    where('state', '==', 'TN')
  );
  const tnSnapshot = await getDocs(tnQuery);
  const tnProperties = tnSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log('Total active TN properties:', tnProperties.length);

  // Check Memphis specifically
  const memphisProperties = tnProperties.filter((p: any) =>
    p.city?.toLowerCase().includes('memphis')
  );
  console.log('Memphis properties:', memphisProperties.length);

  // Show sample Memphis properties
  console.log('\nSample Memphis properties:');
  memphisProperties.slice(0, 10).forEach((p: any) => {
    console.log(`- ${p.address}, ${p.city}: Monthly $${p.monthlyPayment}, Down $${p.downPaymentAmount}`);
  });

  // Check if there are budget constraints
  const monthlyPayments = tnProperties.map((p: any) => p.monthlyPayment || 9999).filter((v: number) => v < 9999);
  const downPayments = tnProperties.map((p: any) => p.downPaymentAmount || 9999).filter((v: number) => v < 9999);

  if (monthlyPayments.length > 0) {
    console.log('\nMonthly payment range:',
      Math.min(...monthlyPayments),
      'to',
      Math.max(...monthlyPayments)
    );
  }

  if (downPayments.length > 0) {
    console.log('Down payment range:',
      Math.min(...downPayments),
      'to',
      Math.max(...downPayments)
    );
  }

  process.exit(0);
}

checkMemphisProperties();
