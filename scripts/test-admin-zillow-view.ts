/**
 * Test Admin Zillow Imports View
 * Simulates what admin panel should show
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

async function testAdminView() {
  console.log('🖥️  ADMIN ZILLOW_IMPORTS VIEW TEST\n');
  console.log('=' .repeat(80));

  // Simulate the new /api/admin/zillow-imports/all endpoint
  const snapshot = await db
    .collection('zillow_imports')
    .where('ownerFinanceVerified', '==', true)
    .get();

  const properties = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  console.log(`\n📊 Total properties: ${properties.length}`);

  // Calculate stats
  const byStatus = properties.reduce((acc: any, p: any) => {
    const status = p.status || 'null';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const byState = properties.reduce((acc: any, p: any) => {
    acc[p.state] = (acc[p.state] || 0) + 1;
    return acc;
  }, {});

  const byKeyword = properties.reduce((acc: any, p: any) => {
    const keyword = p.primaryKeyword || 'Unknown';
    acc[keyword] = (acc[keyword] || 0) + 1;
    return acc;
  }, {});

  console.log('\n📈 Status Breakdown:');
  Object.entries(byStatus)
    .sort((a: any, b: any) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

  console.log('\n🌎 Top 10 States:');
  Object.entries(byState)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([state, count]) => {
      console.log(`   ${state}: ${count}`);
    });

  console.log('\n🔑 Top Keywords:');
  Object.entries(byKeyword)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([keyword, count]) => {
      console.log(`   ${keyword}: ${count}`);
    });

  console.log('\n📄 Sample Properties (first 5):');
  properties.slice(0, 5).forEach((p: any, i: number) => {
    console.log(`\n   ${i + 1}. ${p.fullAddress || p.streetAddress}`);
    console.log(`      State: ${p.state}`);
    console.log(`      Price: $${p.price?.toLocaleString()}`);
    console.log(`      Keyword: "${p.primaryKeyword}"`);
    console.log(`      Status: ${p.status || 'null (awaiting terms)'}`);
    console.log(`      Monthly Payment: ${p.monthlyPayment ? '$' + p.monthlyPayment : 'Seller to Decide'}`);
  });

  console.log('\n\n' + '=' .repeat(80));
  console.log('✅ ADMIN VIEW READY');
  console.log('=' .repeat(80));
  console.log(`\n📊 Total: ${properties.length} properties available for admin panel`);
  console.log(`🟡 Awaiting Terms (status=null): ${byStatus['null'] || 0}`);
  console.log(`🟢 Verified (status=verified): ${byStatus['verified'] || 0}`);
  console.log('\n💡 Admin panel should display all these properties!');
  console.log('=' .repeat(80));
}

testAdminView().catch(console.error);
