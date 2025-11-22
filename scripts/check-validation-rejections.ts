import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!
    })
  });
}

const db = getFirestore();

async function checkValidationRejections() {
  try {
    console.log('\n🔍 Checking recent validation rejections from webhook logs...\n');
    console.log('='.repeat(80));

    // Get recent logs with validation rejections
    const logsSnapshot = await db.collection('systemLogs')
      .limit(2000)
      .get();

    const rejectedProperties: any[] = [];

    logsSnapshot.docs.forEach(doc => {
      const data = doc.data();

      // Parse context
      let parsedContext: any = {};
      if (data.context) {
        try {
          parsedContext = typeof data.context === 'string'
            ? JSON.parse(data.context)
            : data.context;
        } catch (e) {
          parsedContext = { raw: data.context };
        }
      }

      // Check for validation rejection logs
      if (parsedContext.action === 'property_validation_rejected' ||
          parsedContext.action === 'ghl_validation_rejected') {
        const timestamp = data.createdAt?.toDate?.() || new Date();
        rejectedProperties.push({
          timestamp,
          opportunityId: parsedContext.metadata?.opportunityId,
          address: parsedContext.metadata?.address,
          reason: parsedContext.metadata?.reason,
          issues: parsedContext.metadata?.issues || []
        });
      }
    });

    if (rejectedProperties.length === 0) {
      console.log('✅ No validation rejections found in recent logs');
      console.log('\nThis means either:');
      console.log('1. Your webhook is working fine and no properties have been rejected');
      console.log('2. You are sending to a different webhook endpoint');
      console.log('3. The webhook is not being triggered at all');
      return;
    }

    // Sort by most recent first
    rejectedProperties.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    console.log(`\n❌ Found ${rejectedProperties.length} rejected properties\n`);
    console.log('='.repeat(80));

    // Show each rejected property with details
    rejectedProperties.forEach((prop, index) => {
      console.log(`\n${index + 1}. REJECTED PROPERTY`);
      console.log('-'.repeat(80));
      console.log(`⏰ Time: ${prop.timestamp.toLocaleString()}`);
      console.log(`🏠 Address: ${prop.address || 'Unknown'}`);
      console.log(`🆔 Opportunity ID: ${prop.opportunityId || 'Unknown'}`);
      console.log(`📝 Rejection Reason: ${prop.reason || 'Not specified'}`);

      if (prop.issues && prop.issues.length > 0) {
        console.log(`\n❌ VALIDATION ISSUES (${prop.issues.length}):`);
        prop.issues.forEach((issue: any, i: number) => {
          const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
          console.log(`\n   ${i + 1}. ${icon} ${issue.field?.toUpperCase() || 'UNKNOWN FIELD'}`);
          console.log(`      Issue: ${issue.issue}`);
          console.log(`      Actual Value: ${issue.actualValue}`);
          if (issue.expectedRange) {
            console.log(`      Expected Range: ${issue.expectedRange}`);
          }
          if (issue.suggestion) {
            console.log(`      💡 Suggestion: ${issue.suggestion}`);
          }
        });
      }
    });

    console.log('\n\n' + '='.repeat(80));
    console.log('📋 COMMON REJECTION REASONS:');
    console.log('='.repeat(80));

    // Analyze common issues
    const issueFrequency = new Map<string, number>();
    rejectedProperties.forEach(prop => {
      prop.issues?.forEach((issue: any) => {
        const key = `${issue.field}: ${issue.issue}`;
        issueFrequency.set(key, (issueFrequency.get(key) || 0) + 1);
      });
    });

    Array.from(issueFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([issue, count]) => {
        console.log(`\n❌ ${issue}`);
        console.log(`   Occurred ${count} time(s)`);
      });

    console.log('\n\n' + '='.repeat(80));
    console.log('💡 HOW TO FIX:');
    console.log('='.repeat(80));
    console.log('\n1. Check your GoHighLevel webhook payload data');
    console.log('2. Ensure all financial fields are correctly populated:');
    console.log('   - Price (must be > $10,000)');
    console.log('   - Down Payment Amount (must be > 0 and < price)');
    console.log('   - Down Payment Percent (must be 1-100%)');
    console.log('   - Interest Rate (should be 5-15%)');
    console.log('   - Term Years (should be 10-40 years)');
    console.log('   - Monthly Payment (must be > 0)');
    console.log('\n3. Validation Rules that cause AUTO-REJECTION:');
    console.log('   ❌ Price < $10,000');
    console.log('   ❌ Down payment < 1% or > 100%');
    console.log('   ❌ Down payment amount doesn\'t match percentage');
    console.log('   ❌ Interest rate > 20%');
    console.log('   ❌ Term years <= 0 or > 50');
    console.log('   ❌ Monthly payment <= 0');
    console.log('   ❌ Payment doesn\'t match amortization formula (off by >50%)');
    console.log('   ❌ Payment doesn\'t cover monthly interest');
    console.log('   ❌ Annual payments > 15% of price');
    console.log('\n4. To bypass validation temporarily (for testing):');
    console.log('   - Use the /api/gohighlevel/webhook/save-property endpoint');
    console.log('   - It has less strict validation (only checks required fields)');
    console.log('\n');

  } catch (error) {
    console.error('❌ Error checking validation rejections:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

checkValidationRejections();
