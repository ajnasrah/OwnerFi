import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

async function diagnoseWebhookIssues() {
  console.log('🔍 Diagnosing GHL webhook issues with description field...\n');

  try {
    // Get all GHL properties (no orderBy to avoid needing index)
    const snapshot = await db.collection('properties')
      .where('source', '==', 'gohighlevel')
      .limit(50)
      .get();

    console.log(`📊 Found ${snapshot.size} recent GHL properties\n`);

    const issues = {
      missingDescription: 0,
      emptyDescription: 0,
      missingAddress: 0,
      missingCity: 0,
      missingState: 0,
      invalidPrice: 0,
      missingImage: 0,
      total: snapshot.size
    };

    const problematicProperties: any[] = [];

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const propertyIssues: string[] = [];

      // Check for issues
      if (!data.description) {
        issues.missingDescription++;
        propertyIssues.push('NO_DESCRIPTION');
      } else if (data.description.trim() === '') {
        issues.emptyDescription++;
        propertyIssues.push('EMPTY_DESCRIPTION');
      }

      if (!data.address || data.address.trim() === '') {
        issues.missingAddress++;
        propertyIssues.push('NO_ADDRESS');
      }

      if (!data.city || data.city.trim() === '') {
        issues.missingCity++;
        propertyIssues.push('NO_CITY');
      }

      if (!data.state || data.state.trim() === '') {
        issues.missingState++;
        propertyIssues.push('NO_STATE');
      }

      if (!data.price || data.price <= 0) {
        issues.invalidPrice++;
        propertyIssues.push('INVALID_PRICE');
      }

      if (!data.imageUrls || data.imageUrls.length === 0) {
        issues.missingImage++;
        propertyIssues.push('NO_IMAGE');
      }

      if (propertyIssues.length > 0) {
        problematicProperties.push({
          id: doc.id,
          opportunityId: data.opportunityId,
          address: data.address || 'MISSING',
          city: data.city || 'MISSING',
          state: data.state || 'MISSING',
          price: data.price || 0,
          description: data.description ? `${data.description.substring(0, 50)}...` : 'MISSING',
          issues: propertyIssues,
          updatedAt: data.updatedAt?.toDate?.() || data.lastUpdated
        });
      }
    });

    console.log('📈 ISSUE SUMMARY:');
    console.log('─'.repeat(60));
    console.log(`Total Properties:       ${issues.total}`);
    console.log(`Missing Description:    ${issues.missingDescription} (${Math.round(issues.missingDescription/issues.total*100)}%)`);
    console.log(`Empty Description:      ${issues.emptyDescription} (${Math.round(issues.emptyDescription/issues.total*100)}%)`);
    console.log(`Missing Address:        ${issues.missingAddress} (${Math.round(issues.missingAddress/issues.total*100)}%)`);
    console.log(`Missing City:           ${issues.missingCity} (${Math.round(issues.missingCity/issues.total*100)}%)`);
    console.log(`Missing State:          ${issues.missingState} (${Math.round(issues.missingState/issues.total*100)}%)`);
    console.log(`Invalid Price:          ${issues.invalidPrice} (${Math.round(issues.invalidPrice/issues.total*100)}%)`);
    console.log(`Missing Image:          ${issues.missingImage} (${Math.round(issues.missingImage/issues.total*100)}%)`);
    console.log('─'.repeat(60));

    if (problematicProperties.length > 0) {
      console.log(`\n⚠️  PROBLEMATIC PROPERTIES (${problematicProperties.length}):\n`);

      problematicProperties.slice(0, 10).forEach((prop, idx) => {
        console.log(`${idx + 1}. ${prop.id}`);
        console.log(`   Opportunity ID: ${prop.opportunityId}`);
        console.log(`   Address: ${prop.address}, ${prop.city}, ${prop.state}`);
        console.log(`   Price: $${prop.price}`);
        console.log(`   Description: ${prop.description}`);
        console.log(`   Issues: ${prop.issues.join(', ')}`);
        console.log(`   Updated: ${prop.updatedAt}`);
        console.log('');
      });

      if (problematicProperties.length > 10) {
        console.log(`   ... and ${problematicProperties.length - 10} more\n`);
      }
    } else {
      console.log('\n✅ No problematic properties found!\n');
    }

    // Check for recent errors
    console.log('\n🔍 Checking for webhook errors in logs collection...');
    try {
      const errorSnapshot = await db.collection('logs')
        .where('level', '==', 'error')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();

      if (errorSnapshot.size > 0) {
        console.log(`\n❌ Found ${errorSnapshot.size} recent errors:\n`);
        errorSnapshot.docs.forEach((doc, idx) => {
          const error = doc.data();
          console.log(`${idx + 1}. ${error.message}`);
          console.log(`   Action: ${error.action}`);
          console.log(`   Timestamp: ${error.timestamp?.toDate?.() || error.timestamp}`);
          if (error.metadata) {
            console.log(`   Metadata: ${JSON.stringify(error.metadata, null, 2)}`);
          }
          console.log('');
        });
      } else {
        console.log('✅ No recent errors in logs\n');
      }
    } catch (logError) {
      console.log(`⚠️  Could not check logs: ${logError}\n`);
    }

  } catch (error) {
    console.error('❌ Error running diagnostics:', error);
    process.exit(1);
  }

  process.exit(0);
}

diagnoseWebhookIssues();
