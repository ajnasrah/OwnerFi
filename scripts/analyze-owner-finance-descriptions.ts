/**
 * Analyze Property Descriptions for Owner Finance Validity
 *
 * This script:
 * 1. Fetches all buyer-visible properties from properties & zillow_imports collections
 * 2. Exports them to Excel
 * 3. Uses AI to determine if each description is a valid owner finance listing
 * 4. Generates a report of false positives
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

// Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface PropertyRecord {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  listPrice: number;
  description: string;
  source: 'curated' | 'zillow';
  isOwnerFinance?: boolean;
  aiReason?: string;
}

interface AnalysisResult {
  isOwnerFinance: boolean;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Analyze a property description using AI
 */
async function analyzeDescription(description: string, address: string): Promise<AnalysisResult> {
  if (!description || description.trim().length < 10) {
    return {
      isOwnerFinance: false,
      reason: 'No description or too short',
      confidence: 'high'
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert real estate analyst. Your job is to determine if a property listing description indicates the property is being offered with OWNER FINANCING / SELLER FINANCING.

Owner financing keywords include:
- "owner finance", "owner financing", "owner will finance", "owner carry"
- "seller finance", "seller financing", "seller will carry"
- "owner carry back", "contract for deed", "land contract"
- "no bank needed", "no bank qualifying", "no credit check"
- "rent to own", "lease option", "lease to own"
- "terms available", "flexible financing", "creative financing"
- "wrap mortgage", "subject to", "assumable loan"
- Down payment mentions with monthly payment terms

FALSE POSITIVES to watch for:
- Properties that only mention traditional financing (FHA, VA, conventional loans)
- "Pre-qualified" or "pre-approved" buyers only
- Auction properties
- Bank-owned / REO properties
- Foreclosure listings
- Properties just mentioning price without owner finance terms
- Generic real estate descriptions without financing terms

Respond with JSON only:
{
  "isOwnerFinance": true/false,
  "reason": "brief explanation",
  "confidence": "high/medium/low"
}`
        },
        {
          role: 'user',
          content: `Property: ${address}\n\nDescription:\n${description}`
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{}';
    const result = JSON.parse(content);

    return {
      isOwnerFinance: result.isOwnerFinance ?? false,
      reason: result.reason || 'Unknown',
      confidence: result.confidence || 'low'
    };
  } catch (error) {
    console.error(`Error analyzing ${address}:`, error);
    return {
      isOwnerFinance: true, // Default to keeping it on error
      reason: 'Analysis error - defaulting to keep',
      confidence: 'low'
    };
  }
}

/**
 * Fetch all buyer-visible properties
 */
async function fetchAllProperties(): Promise<PropertyRecord[]> {
  console.log('📥 Fetching all buyer-visible properties...\n');

  const properties: PropertyRecord[] = [];

  // Fetch from curated properties collection
  console.log('  Fetching from "properties" collection...');
  const curatedQuery = query(
    collection(db, 'properties'),
    where('isActive', '==', true)
  );
  const curatedSnapshot = await getDocs(curatedQuery);
  console.log(`  Found ${curatedSnapshot.size} curated properties`);

  curatedSnapshot.docs.forEach(doc => {
    const data = doc.data();
    properties.push({
      id: doc.id,
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      zipCode: data.zipCode || '',
      listPrice: data.listPrice || 0,
      description: data.description || '',
      source: 'curated'
    });
  });

  // Fetch from zillow_imports collection (verified owner finance only)
  console.log('  Fetching from "zillow_imports" collection...');
  const zillowQuery = query(
    collection(db, 'zillow_imports'),
    where('ownerFinanceVerified', '==', true)
  );
  const zillowSnapshot = await getDocs(zillowQuery);
  console.log(`  Found ${zillowSnapshot.size} Zillow imports`);

  zillowSnapshot.docs.forEach(doc => {
    const data = doc.data();
    properties.push({
      id: doc.id,
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      zipCode: data.zipCode || '',
      listPrice: data.listPrice || data.price || 0,
      description: data.description || '',
      source: 'zillow'
    });
  });

  console.log(`\n📊 Total properties: ${properties.length}\n`);
  return properties;
}

/**
 * Export properties to Excel
 */
function exportToExcel(properties: PropertyRecord[], filename: string) {
  const data = properties.map(p => ({
    'ID': p.id,
    'Address': p.address,
    'City': p.city,
    'State': p.state,
    'Zip': p.zipCode,
    'Price': p.listPrice,
    'Source': p.source,
    'Is Owner Finance': p.isOwnerFinance ? 'YES' : 'NO',
    'AI Reason': p.aiReason || '',
    'Description': p.description?.substring(0, 500) || '' // Truncate for Excel
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Properties');

  // Auto-size columns
  const colWidths = [
    { wch: 25 },  // ID
    { wch: 40 },  // Address
    { wch: 20 },  // City
    { wch: 8 },   // State
    { wch: 10 },  // Zip
    { wch: 12 },  // Price
    { wch: 10 },  // Source
    { wch: 15 },  // Is Owner Finance
    { wch: 50 },  // AI Reason
    { wch: 80 },  // Description
  ];
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, filename);
  console.log(`📁 Exported to ${filename}`);
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Owner Finance Description Analyzer\n');
  console.log('=' .repeat(50) + '\n');

  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY is not set in environment');
    process.exit(1);
  }

  // Fetch all properties
  const properties = await fetchAllProperties();

  if (properties.length === 0) {
    console.log('No properties found.');
    return;
  }

  // Export raw data first
  exportToExcel(properties, 'properties-raw.xlsx');

  // Analyze each description with AI
  console.log('\n🤖 Analyzing descriptions with AI...\n');

  const falsePositives: PropertyRecord[] = [];
  const validOwnerFinance: PropertyRecord[] = [];
  const noDescription: PropertyRecord[] = [];

  let processed = 0;
  const batchSize = 10;

  for (let i = 0; i < properties.length; i += batchSize) {
    const batch = properties.slice(i, Math.min(i + batchSize, properties.length));

    const results = await Promise.all(
      batch.map(async (property) => {
        const result = await analyzeDescription(
          property.description,
          `${property.address}, ${property.city}, ${property.state}`
        );

        property.isOwnerFinance = result.isOwnerFinance;
        property.aiReason = `[${result.confidence}] ${result.reason}`;

        return property;
      })
    );

    // Categorize results
    for (const property of results) {
      if (!property.description || property.description.trim().length < 10) {
        noDescription.push(property);
      } else if (property.isOwnerFinance) {
        validOwnerFinance.push(property);
      } else {
        falsePositives.push(property);
      }
    }

    processed += batch.length;
    console.log(`  Progress: ${processed}/${properties.length} (${Math.round(processed/properties.length*100)}%)`);

    // Small delay to avoid rate limiting
    if (i + batchSize < properties.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 ANALYSIS SUMMARY\n');
  console.log(`  ✅ Valid Owner Finance: ${validOwnerFinance.length}`);
  console.log(`  ❌ FALSE POSITIVES: ${falsePositives.length}`);
  console.log(`  ⚠️  No Description: ${noDescription.length}`);
  console.log(`  📋 Total Analyzed: ${properties.length}`);

  // Export results
  console.log('\n📁 Exporting results...\n');

  // Full results
  exportToExcel(properties, 'properties-analyzed.xlsx');

  // False positives only
  if (falsePositives.length > 0) {
    exportToExcel(falsePositives, 'FALSE-POSITIVES.xlsx');

    console.log('\n❌ FALSE POSITIVE DETAILS:\n');
    falsePositives.forEach((p, i) => {
      console.log(`${i + 1}. ${p.address}, ${p.city}, ${p.state}`);
      console.log(`   ID: ${p.id}`);
      console.log(`   Source: ${p.source}`);
      console.log(`   Reason: ${p.aiReason}`);
      console.log(`   Description: ${p.description?.substring(0, 200)}...`);
      console.log('');
    });
  }

  // No description properties
  if (noDescription.length > 0) {
    exportToExcel(noDescription, 'NO-DESCRIPTION.xlsx');
  }

  // Save JSON report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: properties.length,
      validOwnerFinance: validOwnerFinance.length,
      falsePositives: falsePositives.length,
      noDescription: noDescription.length
    },
    falsePositives: falsePositives.map(p => ({
      id: p.id,
      address: p.address,
      city: p.city,
      state: p.state,
      source: p.source,
      reason: p.aiReason,
      description: p.description
    }))
  };

  fs.writeFileSync('owner-finance-analysis-report.json', JSON.stringify(report, null, 2));
  console.log('\n💾 Full report saved to: owner-finance-analysis-report.json');

  console.log('\n✅ Analysis complete!');
}

main().catch(console.error);
