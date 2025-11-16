/**
 * Comprehensive Property Validation
 * Checks EVERY property for data quality issues
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

interface PropertyIssue {
  id: string;
  address: string;
  issue: string;
  severity: 'critical' | 'warning' | 'info';
  details: any;
}

async function validateAllProperties() {
  console.log('🔍 COMPREHENSIVE PROPERTY VALIDATION\n');
  console.log('=' .repeat(80));
  console.log('Checking all 1,439 properties for issues...\n');

  const snapshot = await db
    .collection('zillow_imports')
    .where('ownerFinanceVerified', '==', true)
    .get();

  const issues: PropertyIssue[] = [];
  const properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  console.log(`Total properties to validate: ${properties.length}\n`);

  // ===== VALIDATION 1: Required Fields =====
  console.log('[1/10] Checking required fields...');
  properties.forEach((prop: any) => {
    const requiredFields = {
      'fullAddress': prop.fullAddress,
      'state': prop.state,
      'city': prop.city,
      'price': prop.price,
      'primaryKeyword': prop.primaryKeyword,
      'matchedKeywords': prop.matchedKeywords,
      'ownerFinanceVerified': prop.ownerFinanceVerified,
    };

    Object.entries(requiredFields).forEach(([field, value]) => {
      if (!value && value !== 0) {
        issues.push({
          id: prop.id,
          address: prop.fullAddress || prop.streetAddress || 'NO ADDRESS',
          issue: `Missing required field: ${field}`,
          severity: 'critical',
          details: { field, value }
        });
      }
    });
  });
  console.log(`   ✅ Checked required fields\n`);

  // ===== VALIDATION 2: Status Field =====
  console.log('[2/10] Validating status field...');
  const validStatuses = [null, 'found', 'verified', 'sold', 'pending'];
  properties.forEach((prop: any) => {
    if (!validStatuses.includes(prop.status)) {
      issues.push({
        id: prop.id,
        address: prop.fullAddress,
        issue: `Invalid status: "${prop.status}"`,
        severity: 'critical',
        details: { status: prop.status, expected: validStatuses }
      });
    }

    // All should have status=null since we just migrated
    if (prop.status !== null && prop.status !== undefined) {
      issues.push({
        id: prop.id,
        address: prop.fullAddress,
        issue: `Status should be null but is: "${prop.status}"`,
        severity: 'warning',
        details: { status: prop.status }
      });
    }
  });
  console.log(`   ✅ Checked status field\n`);

  // ===== VALIDATION 3: Financial Fields Should Be Null =====
  console.log('[3/10] Checking financial fields are null...');
  const financialFields = [
    'downPaymentAmount',
    'downPaymentPercent',
    'monthlyPayment',
    'interestRate',
    'loanTermYears',
    'balloonPaymentYears'
  ];

  properties.forEach((prop: any) => {
    financialFields.forEach(field => {
      const value = prop[field];
      if (value !== null && value !== undefined) {
        issues.push({
          id: prop.id,
          address: prop.fullAddress,
          issue: `Financial field "${field}" has value when it should be null`,
          severity: 'warning',
          details: { field, value, expected: null }
        });
      }
    });
  });
  console.log(`   ✅ Checked financial fields\n`);

  // ===== VALIDATION 4: No Calculations Present =====
  console.log('[4/10] Checking for unwanted calculations...');
  properties.forEach((prop: any) => {
    // Check for calculated fields that shouldn't exist
    const calculatedFields = [
      'calculatedMonthlyPayment',
      'calculatedInterestRate',
      'calculatedDownPayment',
      'amortizationSchedule'
    ];

    calculatedFields.forEach(field => {
      if (prop[field] !== undefined && prop[field] !== null) {
        issues.push({
          id: prop.id,
          address: prop.fullAddress,
          issue: `Calculated field "${field}" should not exist`,
          severity: 'warning',
          details: { field, value: prop[field] }
        });
      }
    });
  });
  console.log(`   ✅ Checked for calculations\n`);

  // ===== VALIDATION 5: Price Outliers =====
  console.log('[5/10] Checking for price outliers...');
  const prices = properties.map((p: any) => p.price).filter(p => p > 0);
  const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  properties.forEach((prop: any) => {
    if (!prop.price || prop.price === 0) {
      issues.push({
        id: prop.id,
        address: prop.fullAddress,
        issue: 'Missing or zero price',
        severity: 'critical',
        details: { price: prop.price }
      });
    } else if (prop.price < 10000) {
      issues.push({
        id: prop.id,
        address: prop.fullAddress,
        issue: 'Suspiciously low price',
        severity: 'warning',
        details: { price: prop.price, threshold: 10000 }
      });
    } else if (prop.price > 10000000) {
      issues.push({
        id: prop.id,
        address: prop.fullAddress,
        issue: 'Suspiciously high price',
        severity: 'warning',
        details: { price: prop.price, threshold: 10000000 }
      });
    }
  });

  console.log(`   Price range: $${minPrice.toLocaleString()} - $${maxPrice.toLocaleString()}`);
  console.log(`   Average: $${Math.round(avgPrice).toLocaleString()}\n`);

  // ===== VALIDATION 6: Bedroom/Bathroom Outliers =====
  console.log('[6/10] Checking bedroom/bathroom data...');
  properties.forEach((prop: any) => {
    if (prop.bedrooms && (prop.bedrooms < 0 || prop.bedrooms > 20)) {
      issues.push({
        id: prop.id,
        address: prop.fullAddress,
        issue: 'Invalid bedroom count',
        severity: 'warning',
        details: { bedrooms: prop.bedrooms }
      });
    }

    if (prop.bathrooms && (prop.bathrooms < 0 || prop.bathrooms > 20)) {
      issues.push({
        id: prop.id,
        address: prop.fullAddress,
        issue: 'Invalid bathroom count',
        severity: 'warning',
        details: { bathrooms: prop.bathrooms }
      });
    }
  });
  console.log(`   ✅ Checked bed/bath counts\n`);

  // ===== VALIDATION 7: State/City Format =====
  console.log('[7/10] Checking state/city format...');
  properties.forEach((prop: any) => {
    if (prop.state && prop.state.length !== 2) {
      issues.push({
        id: prop.id,
        address: prop.fullAddress,
        issue: 'State code must be 2 letters',
        severity: 'critical',
        details: { state: prop.state, length: prop.state.length }
      });
    }

    if (!prop.city) {
      issues.push({
        id: prop.id,
        address: prop.fullAddress,
        issue: 'Missing city',
        severity: 'critical',
        details: { city: prop.city }
      });
    }
  });
  console.log(`   ✅ Checked state/city format\n`);

  // ===== VALIDATION 8: Keyword Integrity =====
  console.log('[8/10] Checking keyword integrity...');
  properties.forEach((prop: any) => {
    if (!Array.isArray(prop.matchedKeywords)) {
      issues.push({
        id: prop.id,
        address: prop.fullAddress,
        issue: 'matchedKeywords is not an array',
        severity: 'critical',
        details: { matchedKeywords: prop.matchedKeywords }
      });
    } else if (prop.matchedKeywords.length === 0) {
      issues.push({
        id: prop.id,
        address: prop.fullAddress,
        issue: 'matchedKeywords array is empty',
        severity: 'critical',
        details: { matchedKeywords: prop.matchedKeywords }
      });
    }

    if (!prop.primaryKeyword) {
      issues.push({
        id: prop.id,
        address: prop.fullAddress,
        issue: 'Missing primaryKeyword',
        severity: 'critical',
        details: { primaryKeyword: prop.primaryKeyword }
      });
    }
  });
  console.log(`   ✅ Checked keywords\n`);

  // ===== VALIDATION 9: ZPID Uniqueness =====
  console.log('[9/10] Checking for duplicate ZPIDs...');
  const zpidMap = new Map();
  properties.forEach((prop: any) => {
    if (prop.zpid) {
      const zpid = String(prop.zpid);
      if (zpidMap.has(zpid)) {
        issues.push({
          id: prop.id,
          address: prop.fullAddress,
          issue: 'Duplicate ZPID',
          severity: 'warning',
          details: {
            zpid,
            duplicateOf: zpidMap.get(zpid).address,
            duplicateId: zpidMap.get(zpid).id
          }
        });
      } else {
        zpidMap.set(zpid, { id: prop.id, address: prop.fullAddress });
      }
    }
  });
  console.log(`   ✅ Checked ZPID uniqueness\n`);

  // ===== VALIDATION 10: Timestamps =====
  console.log('[10/10] Checking timestamps...');
  properties.forEach((prop: any) => {
    if (!prop.foundAt && !prop.importedAt) {
      issues.push({
        id: prop.id,
        address: prop.fullAddress,
        issue: 'Missing foundAt and importedAt timestamps',
        severity: 'warning',
        details: { foundAt: prop.foundAt, importedAt: prop.importedAt }
      });
    }
  });
  console.log(`   ✅ Checked timestamps\n`);

  // ===== SUMMARY =====
  console.log('\n' + '=' .repeat(80));
  console.log('📊 VALIDATION SUMMARY');
  console.log('=' .repeat(80));

  const criticalIssues = issues.filter(i => i.severity === 'critical');
  const warningIssues = issues.filter(i => i.severity === 'warning');
  const infoIssues = issues.filter(i => i.severity === 'info');

  console.log(`Total properties validated: ${properties.length}`);
  console.log(`Total issues found: ${issues.length}`);
  console.log(`  🔴 Critical: ${criticalIssues.length}`);
  console.log(`  🟡 Warnings: ${warningIssues.length}`);
  console.log(`  ℹ️  Info: ${infoIssues.length}`);

  if (criticalIssues.length > 0) {
    console.log('\n🔴 CRITICAL ISSUES (Top 10):');
    criticalIssues.slice(0, 10).forEach(issue => {
      console.log(`\n  Property: ${issue.address}`);
      console.log(`  Issue: ${issue.issue}`);
      console.log(`  Details:`, JSON.stringify(issue.details, null, 2));
    });
  }

  if (warningIssues.length > 0) {
    console.log('\n🟡 WARNINGS (Top 10):');
    warningIssues.slice(0, 10).forEach(issue => {
      console.log(`\n  Property: ${issue.address}`);
      console.log(`  Issue: ${issue.issue}`);
      console.log(`  Details:`, JSON.stringify(issue.details, null, 2));
    });
  }

  // Group issues by type
  const issuesByType = new Map<string, number>();
  issues.forEach(issue => {
    issuesByType.set(issue.issue, (issuesByType.get(issue.issue) || 0) + 1);
  });

  if (issuesByType.size > 0) {
    console.log('\n📈 Issues by Type:');
    Array.from(issuesByType.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
  }

  console.log('\n' + '=' .repeat(80));

  if (issues.length === 0) {
    console.log('✅ ALL PROPERTIES VALIDATED - NO ISSUES FOUND!');
    console.log('\n🎉 Every property has correct data and will display properly!');
  } else {
    console.log(`⚠️  Found ${issues.length} issues across ${properties.length} properties`);
    console.log(`📊 Success rate: ${((1 - issues.length / properties.length) * 100).toFixed(1)}%`);
  }

  console.log('=' .repeat(80));
}

validateAllProperties().catch(console.error);
