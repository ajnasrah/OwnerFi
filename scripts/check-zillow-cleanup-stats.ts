/**
 * Check Zillow Status Checker Cleanup Statistics
 *
 * Queries the status_change_reports collection to see:
 * - Total properties deleted
 * - Deletion reasons
 * - Recent cleanup activity
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Initialize Firebase
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

async function checkCleanupStats() {
  console.log('📊 Zillow Status Checker - Cleanup Statistics\n');
  console.log('='.repeat(80));

  try {
    // Get all status change reports
    const reportsSnapshot = await db
      .collection('status_change_reports')
      .orderBy('date', 'desc')
      .limit(100)
      .get();

    if (reportsSnapshot.empty) {
      console.log('❌ No status change reports found');
      return;
    }

    console.log(`\n✅ Found ${reportsSnapshot.size} reports\n`);
    console.log('='.repeat(80));

    let totalDeleted = 0;
    let totalStatusChanges = 0;
    let totalChecked = 0;

    const deletionReasons: Record<string, number> = {};
    const deletedByStatus: Record<string, number> = {};
    const recentReports: Array<any> = [];

    for (const doc of reportsSnapshot.docs) {
      const data = doc.data();
      const date = data.date?.toDate?.() || new Date(data.date);

      totalDeleted += data.deleted || 0;
      totalStatusChanges += data.statusChanges || 0;
      totalChecked += data.totalChecked || 0;

      // Track deletion reasons
      if (data.deletions && Array.isArray(data.deletions)) {
        data.deletions.forEach((deletion: any) => {
          const reason = deletion.reason || 'Unknown';
          const status = deletion.status || 'Unknown';

          deletionReasons[reason] = (deletionReasons[reason] || 0) + 1;
          deletedByStatus[status] = (deletedByStatus[status] || 0) + 1;
        });
      }

      // Store recent reports for detailed view
      if (recentReports.length < 10) {
        recentReports.push({
          date,
          totalChecked: data.totalChecked || 0,
          statusChanges: data.statusChanges || 0,
          deleted: data.deleted || 0,
          deletions: data.deletions || [],
          changes: data.changes || []
        });
      }
    }

    // Summary
    console.log('\n📊 OVERALL STATISTICS');
    console.log('='.repeat(80));
    console.log(`Total properties checked: ${totalChecked.toLocaleString()}`);
    console.log(`Total status changes: ${totalStatusChanges.toLocaleString()}`);
    console.log(`Total properties deleted: ${totalDeleted.toLocaleString()}`);
    console.log(`Reports analyzed: ${reportsSnapshot.size}`);

    // Deletion reasons breakdown
    console.log('\n🗑️  DELETION REASONS');
    console.log('='.repeat(80));
    Object.entries(deletionReasons)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => {
        console.log(`${count.toString().padStart(6)} - ${reason}`);
      });

    // Deleted by status
    console.log('\n📊 DELETED BY STATUS');
    console.log('='.repeat(80));
    Object.entries(deletedByStatus)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        console.log(`${count.toString().padStart(6)} - ${status}`);
      });

    // Recent activity (last 10 reports)
    console.log('\n📅 RECENT ACTIVITY (Last 10 Reports)');
    console.log('='.repeat(80));
    recentReports.forEach((report, index) => {
      console.log(`\n${index + 1}. ${report.date.toLocaleDateString()} ${report.date.toLocaleTimeString()}`);
      console.log(`   Checked: ${report.totalChecked}, Status Changes: ${report.statusChanges}, Deleted: ${report.deleted}`);

      if (report.deletions && report.deletions.length > 0) {
        console.log(`   Deletions:`);
        report.deletions.slice(0, 5).forEach((d: any) => {
          console.log(`   - ${d.address} (${d.status}) - ${d.reason}`);
        });
        if (report.deletions.length > 5) {
          console.log(`   ... and ${report.deletions.length - 5} more`);
        }
      }

      if (report.changes && report.changes.length > 0) {
        console.log(`   Status Changes:`);
        report.changes.slice(0, 3).forEach((c: any) => {
          console.log(`   - ${c.address}: ${c.oldStatus} → ${c.newStatus}`);
        });
        if (report.changes.length > 3) {
          console.log(`   ... and ${report.changes.length - 3} more`);
        }
      }
    });

    // Check current database size
    console.log('\n📊 CURRENT DATABASE STATUS');
    console.log('='.repeat(80));
    const currentSnapshot = await db.collection('zillow_imports').get();
    console.log(`Current properties in zillow_imports: ${currentSnapshot.size.toLocaleString()}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Analysis complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkCleanupStats()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
