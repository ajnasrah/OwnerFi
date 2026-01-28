/**
 * Sync all active properties from Firestore to Typesense
 * This ensures search results are up-to-date
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Typesense = require('typesense');

dotenv.config({ path: '.env.local' });

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

// Initialize Typesense
const typesenseClient = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST || 'localhost',
    port: parseInt(process.env.TYPESENSE_PORT || '8108'),
    protocol: process.env.TYPESENSE_PROTOCOL || 'https',
  }],
  apiKey: process.env.TYPESENSE_ADMIN_API_KEY || process.env.TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 10,
});

const COLLECTION_NAME = 'properties';

interface FirestoreProperty {
  fullAddress?: string;
  address?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  price?: number;
  listPrice?: number;
  monthlyPayment?: number;
  downPaymentAmount?: number;
  downPaymentPercent?: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFoot?: number;
  squareFeet?: number;
  yearBuilt?: number;
  estimate?: number;
  zestimate?: number;
  rentEstimate?: number;
  annualTaxAmount?: number;
  hoa?: number;
  daysOnZillow?: number;
  isActive?: boolean;
  isOwnerFinance?: boolean;
  ownerFinanceVerified?: boolean;
  isCashDeal?: boolean;
  needsWork?: boolean;
  homeStatus?: string;
  source?: string;
  homeType?: string;
  propertyType?: string;
  financingType?: string;
  zpid?: number | string;
  url?: string;
  firstPropertyImage?: string;
  imgSrc?: string;
  propertyImages?: string[];
  agentName?: string;
  agentPhoneNumber?: string;
  agentEmail?: string;
  interestRate?: number;
  loanTermYears?: number;
  balloonPaymentYears?: number;
  createdAt?: { _seconds?: number; seconds?: number; toMillis?: () => number } | Date | string | number;
  updatedAt?: { _seconds?: number; seconds?: number; toMillis?: () => number } | Date | string | number;
  nearbyCities?: string[];
  matchedKeywords?: string[];
  discountPercentage?: number;
}

function timestampToUnix(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const parsed = new Date(ts).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  if (ts.toMillis && typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts._seconds) return ts._seconds * 1000;
  if (ts.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

function transformForTypesense(id: string, data: FirestoreProperty) {
  const dealType = data.isOwnerFinance && data.isCashDeal
    ? 'both'
    : data.isOwnerFinance
      ? 'owner_finance'
      : data.isCashDeal
        ? 'cash_deal'
        : 'unknown';

  return {
    id,
    address: data.fullAddress || data.address || data.streetAddress || '',
    city: data.city || '',
    state: data.state || '',
    zipCode: data.zipCode || '',
    description: data.description || '',
    location: data.latitude && data.longitude ? [data.latitude, data.longitude] : undefined,
    dealType,
    listPrice: data.price || data.listPrice || 0,
    monthlyPayment: data.monthlyPayment || undefined,
    downPaymentAmount: data.downPaymentAmount || undefined,
    downPaymentPercent: data.downPaymentPercent || undefined,
    bedrooms: data.bedrooms || 0,
    bathrooms: data.bathrooms || 0,
    squareFeet: data.squareFoot || data.squareFeet || undefined,
    yearBuilt: data.yearBuilt || undefined,
    zestimate: data.estimate || data.zestimate || undefined,
    discountPercent: data.discountPercentage || undefined,
    rentEstimate: data.rentEstimate || undefined,
    annualTaxAmount: data.annualTaxAmount || undefined,
    monthlyHoa: data.hoa || undefined,
    daysOnZillow: data.daysOnZillow || undefined,
    isActive: data.isActive !== false,
    ownerFinanceVerified: data.isOwnerFinance || data.ownerFinanceVerified || false,
    needsWork: data.needsWork || false,
    homeStatus: data.homeStatus || undefined,
    sourceType: data.source || undefined,
    propertyType: data.homeType || data.propertyType || 'other',
    financingType: data.financingType || undefined,
    zpid: data.zpid ? String(data.zpid) : undefined,
    url: data.url || undefined,
    primaryImage: data.firstPropertyImage || data.imgSrc || (data.propertyImages?.[0]) || undefined,
    galleryImages: data.propertyImages || undefined,
    agentName: data.agentName || undefined,
    agentPhone: data.agentPhoneNumber || undefined,
    agentEmail: data.agentEmail || undefined,
    interestRate: data.interestRate || undefined,
    termYears: data.loanTermYears || undefined,
    balloonYears: data.balloonPaymentYears || undefined,
    createdAt: timestampToUnix(data.createdAt),
    updatedAt: timestampToUnix(data.updatedAt),
    nearbyCities: data.nearbyCities || undefined,
    ownerFinanceKeywords: data.matchedKeywords || undefined,
  };
}

async function syncAllToTypesense() {
  console.log('\n' + '='.repeat(60));
  console.log('  SYNCING ALL ACTIVE PROPERTIES TO TYPESENSE');
  console.log('='.repeat(60) + '\n');

  // Get all active properties
  console.log('Fetching active properties from Firestore...');
  const snapshot = await db.collection('properties')
    .where('isActive', '==', true)
    .get();

  console.log(`Found ${snapshot.size} active properties\n`);

  if (snapshot.size === 0) {
    console.log('No properties to sync');
    return;
  }

  // Transform all documents
  const documents: any[] = [];
  let skipped = 0;

  snapshot.docs.forEach((doc: { id: string; data: () => FirestoreProperty }) => {
    try {
      const data = doc.data();
      const transformed = transformForTypesense(doc.id, data);

      // Skip if missing required fields
      if (!transformed.address || !transformed.city || !transformed.state) {
        skipped++;
        return;
      }

      documents.push(transformed);
    } catch (err) {
      console.error(`Error transforming ${doc.id}:`, err);
      skipped++;
    }
  });

  console.log(`Prepared ${documents.length} documents for sync (${skipped} skipped)\n`);

  // Batch import to Typesense
  const BATCH_SIZE = 100;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);

    try {
      const results = await typesenseClient.collections(COLLECTION_NAME)
        .documents()
        .import(batch, { action: 'upsert' });

      for (const result of results) {
        if (result.success) {
          success++;
        } else {
          failed++;
          if (failed <= 5) {
            console.error('Import error:', result.error, result.document?.id);
          }
        }
      }

      const progress = Math.min(i + BATCH_SIZE, documents.length);
      console.log(`Progress: ${progress}/${documents.length} (${success} success, ${failed} failed)`);

    } catch (err: any) {
      console.error(`Batch import failed:`, err.message);
      failed += batch.length;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('  SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Total Active: ${snapshot.size}`);
  console.log(`  Synced: ${success}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log('');
}

syncAllToTypesense()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
