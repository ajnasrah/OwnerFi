/**
 * Move "Interested" properties from agent_outreach_queue to properties collection
 * (Same as agent-response webhook when agent says YES)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

const firebaseIds = [
  'la1BjnzLremS4ebdEZiG',
  '19dNzZdxqvxFLpvmiXhq',
  'Ntx5bwm71IqJUysNaX7x',
  'MtE6y00RyuHbE56TEnzP',
  'bUuLlw6PGhKo613WvJF0',
  'fqKWUeIcqRG8qeFE0DpB',
  'WyH1JaOsXCIpQhNsO1Pt',
  'AcFaxQ5njdQs1Dr8kGpO',
  'aPVGh1r6Ncfj6jZPtTMa',
  'moJwP2Dzh8rmNoAfFIM0',
  'L5ymA7jRmjy1Pls6K6DS',
  'YXMFipyTyh9sp1ttlyj6',
  'bmkJUNTAdIpEE5puzml6',
  'MCRcB8eBSDlsZODHSvgI',
  'Kkrj43Adc045utlkwz4q',
  'bBSX4sdng6AHoH71uF59',
  's8v99VFQkRU141Bi3ZfI',
  'bFzKD5dA6o3rj1vFChne',
  'hBaLk7Cx2gYIoFnaDWzP',
  'HTSC9UByiKiK8xvU922c',
  'eONeCDfCaDOp3qb8SoJN',
  '2IbhtbUMubyh5gaWc6OR',
  'fSdh53FUlwsQYct0fMvy',
  'n3TJYpRI26o8f6L0eblE',
  'sEohmDbgViu7nH2Cu6hQ',
  'nZuC30zwCXsNpfLdMGrT',
  'g9LDNU7CJTPaLtAsxADG',
  'ddBnOIh5QMw2FJxULHPb',
  'Bl8RtgSLP7Wb7IqZkSUz',
];

async function activate() {
  console.log(`\n🚀 Activating ${firebaseIds.length} properties...\n`);

  let success = 0;
  let failed = 0;

  for (const id of firebaseIds) {
    const queueDoc = await db.collection('agent_outreach_queue').doc(id).get();

    if (!queueDoc.exists) {
      console.log(`❌ ${id} - not found in queue`);
      failed++;
      continue;
    }

    const p = queueDoc.data()!;
    const isOwnerFinance = p.dealType === 'potential_owner_finance';

    // Copy to properties collection (same as agent-response webhook)
    await db.collection('properties').doc(`zpid_${p.zpid}`).set({
      zpid: p.zpid,
      url: p.url,
      address: p.address || '',
      streetAddress: p.address || '',
      fullAddress: `${p.address}, ${p.city}, ${p.state} ${p.zipCode}`,
      city: p.city || '',
      state: p.state || '',
      zipCode: p.zipCode || '',
      price: p.price || 0,
      listPrice: p.price || 0,
      zestimate: p.zestimate || null,
      bedrooms: p.beds || 0,
      bathrooms: p.baths || 0,
      squareFoot: p.squareFeet || 0,
      homeType: p.propertyType || 'SINGLE_FAMILY',
      homeStatus: 'FOR_SALE',
      agentName: p.agentName,
      agentPhoneNumber: p.agentPhone,
      agentEmail: p.agentEmail || null,
      description: p.rawData?.description || '',
      imgSrc: p.rawData?.imgSrc || '',
      imageUrls: p.rawData?.imgSrc ? [p.rawData.imgSrc] : [],
      // Flags for website display
      isOwnerFinance,
      isCashDeal: !isOwnerFinance,
      dealTypes: isOwnerFinance ? ['owner_finance'] : ['cash_deal'],
      isActive: true,
      ownerFinanceVerified: true,
      agentConfirmedAt: new Date(),
      source: 'agent_outreach',
      originalQueueId: id,
      importedAt: new Date(),
      createdAt: new Date(),
    });

    // Update queue status
    await queueDoc.ref.update({
      status: 'agent_yes',
      agentResponse: 'yes',
      agentResponseAt: new Date(),
      routedTo: 'properties',
    });

    console.log(`✅ ${p.address}, ${p.city} ${p.state}`);
    success++;
  }

  console.log(`\n📊 Done: ${success} activated, ${failed} failed\n`);
}

activate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
