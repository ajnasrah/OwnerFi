/**
 * Retroactive Validation Scan
 * Scans all existing properties and flags those that should have been caught by validation
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { validatePropertyFinancials, type PropertyFinancialData } from '../src/lib/property-validation';
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

interface ScanStats {
  total: number;
  scanned: number;
  alreadyFlagged: number;
  newlyFlagged: number;
  autoReject: number;
  noFinancials: number;
  passed: number;
  errors: number;
}

async function scanAndFlagProperties(dryRun: boolean = false) {
  console.log('🔍 Starting retroactive validation scan...');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (will update database)'}\n`);

  const stats: ScanStats = {
    total: 0,
    scanned: 0,
    alreadyFlagged: 0,
    newlyFlagged: 0,
    autoReject: 0,
    noFinancials: 0,
    passed: 0,
    errors: 0
  };

  const flaggedProperties: Array<{
    id: string;
    address: string;
    issues: string[];
    severity: 'error' | 'warning';
  }> = [];

  try {
    // Get total count first
    const snapshot = await db.collection('properties').count().get();
    stats.total = snapshot.data().count;
    console.log(`Total properties in database: ${stats.total}\n`);

    // Process in batches to avoid memory issues
    const batchSize = 100;
    let lastDoc: any = null;
    let hasMore = true;

    while (hasMore) {
      let query = db.collection('properties')
        .orderBy('createdAt')
        .limit(batchSize);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const batch = await query.get();

      if (batch.empty) {
        hasMore = false;
        break;
      }

      // Process each property in the batch
      for (const doc of batch.docs) {
        stats.scanned++;
        const data = doc.data();

        // Progress indicator
        if (stats.scanned % 100 === 0) {
          console.log(`Progress: ${stats.scanned}/${stats.total} (${((stats.scanned/stats.total)*100).toFixed(1)}%)`);
        }

        try {
          // Check if already flagged
          if (data.needsReview === true) {
            stats.alreadyFlagged++;
            continue;
          }

          // Check if property has financial data
          const hasFinancials = data.listPrice || data.price;
          if (!hasFinancials) {
            stats.noFinancials++;
            continue;
          }

          // Prepare validation data
          const validationData: PropertyFinancialData = {
            listPrice: data.listPrice || data.price || 0,
            monthlyPayment: data.monthlyPayment || 0,
            downPaymentAmount: data.downPaymentAmount || 0,
            downPaymentPercent: data.downPaymentPercent || 0,
            interestRate: data.interestRate || 0,
            termYears: data.termYears || 0,
            address: data.address || '',
            city: data.city || '',
            state: data.state || ''
          };

          // Run validation
          const validation = validatePropertyFinancials(validationData);

          // Check if property should be flagged
          if (validation.needsReview || validation.shouldAutoReject) {
            const severity = validation.shouldAutoReject ? 'error' : 'warning';

            if (validation.shouldAutoReject) {
              stats.autoReject++;
            } else {
              stats.newlyFlagged++;
            }

            flaggedProperties.push({
              id: doc.id,
              address: `${data.address}, ${data.city}, ${data.state}`,
              issues: validation.issues.map(i => `${i.field}: ${i.issue}`),
              severity
            });

            // Update property with validation flags (unless dry run)
            if (!dryRun) {
              const updateData: any = {
                needsReview: true,
                reviewReasons: validation.issues.map(issue => {
                  const reason: any = {
                    field: issue.field,
                    issue: issue.issue,
                    severity: issue.severity,
                    actualValue: issue.actualValue
                  };
                  // Only add optional fields if they have values
                  if (issue.expectedRange) reason.expectedRange = issue.expectedRange;
                  if (issue.suggestion) reason.suggestion = issue.suggestion;
                  return reason;
                }),
                validationScannedAt: new Date().toISOString()
              };

              await doc.ref.update(updateData);
            }
          } else {
            stats.passed++;
          }

        } catch (error) {
          stats.errors++;
          console.error(`Error processing property ${doc.id}:`, error);
        }
      }

      lastDoc = batch.docs[batch.docs.length - 1];

      if (batch.docs.length < batchSize) {
        hasMore = false;
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('VALIDATION SCAN COMPLETE');
    console.log('='.repeat(80));
    console.log(`\nTotal properties: ${stats.total}`);
    console.log(`Scanned: ${stats.scanned}`);
    console.log(`\nResults:`);
    console.log(`  ✅ Passed validation: ${stats.passed}`);
    console.log(`  ⚠️  Already flagged: ${stats.alreadyFlagged}`);
    console.log(`  🔴 Critical errors (auto-reject): ${stats.autoReject}`);
    console.log(`  ⚠️  Warnings (needs review): ${stats.newlyFlagged}`);
    console.log(`  ℹ️  No financial data: ${stats.noFinancials}`);
    console.log(`  ❌ Processing errors: ${stats.errors}`);

    // Show breakdown of issues found
    if (flaggedProperties.length > 0) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`FLAGGED PROPERTIES (${flaggedProperties.length} total)`);
      console.log('='.repeat(80));

      // Group by issue type
      const issueBreakdown: Record<string, number> = {};
      flaggedProperties.forEach(prop => {
        prop.issues.forEach(issue => {
          const key = issue.split(':')[0]; // Get field name
          issueBreakdown[key] = (issueBreakdown[key] || 0) + 1;
        });
      });

      console.log('\nIssue breakdown:');
      Object.entries(issueBreakdown)
        .sort((a, b) => b[1] - a[1])
        .forEach(([field, count]) => {
          console.log(`  ${field}: ${count}`);
        });

      // Show top 10 flagged properties
      console.log('\nTop 10 flagged properties:');
      flaggedProperties.slice(0, 10).forEach((prop, idx) => {
        console.log(`\n${idx + 1}. ${prop.severity === 'error' ? '🔴' : '⚠️'} ${prop.address}`);
        prop.issues.slice(0, 3).forEach(issue => {
          console.log(`   - ${issue}`);
        });
        if (prop.issues.length > 3) {
          console.log(`   ... and ${prop.issues.length - 3} more issues`);
        }
      });

      if (flaggedProperties.length > 10) {
        console.log(`\n... and ${flaggedProperties.length - 10} more properties`);
      }
    }

    console.log('\n' + '='.repeat(80));

    if (dryRun) {
      console.log('\n⚠️  DRY RUN MODE - No changes were made to the database');
      console.log('Run without --dry-run flag to apply changes\n');
    } else {
      console.log('\n✅ Database has been updated with validation flags\n');
    }

  } catch (error) {
    console.error('Fatal error during scan:', error);
    throw error;
  }
}

// Check for command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

scanAndFlagProperties(dryRun)
  .then(() => {
    console.log('Scan completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Scan failed:', error);
    process.exit(1);
  });
