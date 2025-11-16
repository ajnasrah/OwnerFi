import { getAdminDb } from '../src/lib/firebase-admin';

async function checkDeleteWebhookLogs() {
  try {
    const db = await getAdminDb();
    if (!db) {
      throw new Error('Failed to initialize Firebase Admin');
    }

    console.log('🔍 Searching for delete-property webhook activity...\n');

    // Monday November 11, 2025
    const mondayDate = new Date('2025-11-11T00:00:00Z');
    console.log(`Looking for activity since: ${mondayDate.toISOString()}\n`);

    // Query for all logs since Monday (without orderBy to avoid index issues)
    const logsRef = db.collection('systemLogs');
    const snapshot = await logsRef
      .where('createdAt', '>=', mondayDate)
      .limit(5000) // Limit to avoid timeout
      .get();

    console.log(`Total logs since Monday: ${snapshot.size}\n`);

    const deleteWebhookLogs: any[] = [];
    const signatureFailures: any[] = [];
    const propertyDeletions: any[] = [];
    const allWebhookRequests: any[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const message = data.message || '';
      const contextStr = data.context || '';
      let context: any = {};

      try {
        context = typeof contextStr === 'string' ? JSON.parse(contextStr) : contextStr;
      } catch (e) {
        context = {};
      }

      // Parse the log entry
      const logEntry = {
        id: doc.id,
        timestamp: data.createdAt?.toDate?.() || data.createdAt,
        level: data.level,
        message,
        action: context?.action,
        metadata: context?.metadata,
      };

      // Check for delete webhook activity
      if (
        message.toLowerCase().includes('delete') &&
        message.toLowerCase().includes('webhook')
      ) {
        deleteWebhookLogs.push(logEntry);
      }

      // Check for webhook requests
      if (
        message.toLowerCase().includes('webhook') &&
        (message.toLowerCase().includes('request') || message.toLowerCase().includes('received'))
      ) {
        allWebhookRequests.push(logEntry);
      }

      // Check for signature verification failures
      if (
        context?.action === 'signature_verification_failed' ||
        (message.toLowerCase().includes('signature') &&
        (message.toLowerCase().includes('failed') || message.toLowerCase().includes('invalid')))
      ) {
        signatureFailures.push(logEntry);
      }

      // Check for property deletions
      if (
        context?.action === 'property_deleted' ||
        context?.action === 'webhook_received' ||
        context?.action === 'webhook_request'
      ) {
        propertyDeletions.push(logEntry);
      }
    });

    // Sort by timestamp
    const sortByTimestamp = (a: any, b: any) => {
      const aTime = a.timestamp?.getTime?.() || 0;
      const bTime = b.timestamp?.getTime?.() || 0;
      return aTime - bTime;
    };

    deleteWebhookLogs.sort(sortByTimestamp);
    signatureFailures.sort(sortByTimestamp);
    propertyDeletions.sort(sortByTimestamp);
    allWebhookRequests.sort(sortByTimestamp);

    console.log('='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Delete webhook logs: ${deleteWebhookLogs.length}`);
    console.log(`Signature verification failures: ${signatureFailures.length}`);
    console.log(`Property deletion actions: ${propertyDeletions.length}`);
    console.log(`All webhook requests: ${allWebhookRequests.length}`);
    console.log('='.repeat(80) + '\n');

    if (deleteWebhookLogs.length > 0) {
      console.log('🚨 DELETE WEBHOOK ACTIVITY:');
      console.log('='.repeat(80));
      deleteWebhookLogs.forEach(log => {
        console.log(`[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`);
        if (log.metadata) {
          console.log('  Metadata:', JSON.stringify(log.metadata, null, 2));
        }
        console.log('');
      });
    }

    if (signatureFailures.length > 0) {
      console.log('🚨 SIGNATURE VERIFICATION FAILURES:');
      console.log('='.repeat(80));
      signatureFailures.forEach(log => {
        console.log(`[${log.timestamp}] ${log.message}`);
        if (log.metadata) {
          console.log('  Metadata:', JSON.stringify(log.metadata, null, 2));
        }
        console.log('');
      });
    }

    if (propertyDeletions.length > 0) {
      console.log('📝 PROPERTY DELETIONS (first 20):');
      console.log('='.repeat(80));
      propertyDeletions.slice(0, 20).forEach(log => {
        console.log(`[${log.timestamp}] ${log.action}: ${log.message}`);
        if (log.metadata) {
          console.log('  Metadata:', JSON.stringify(log.metadata, null, 2));
        }
        console.log('');
      });
      if (propertyDeletions.length > 20) {
        console.log(`... and ${propertyDeletions.length - 20} more\n`);
      }
    }

    if (allWebhookRequests.length > 0) {
      console.log('📡 ALL WEBHOOK REQUESTS (first 30):');
      console.log('='.repeat(80));
      allWebhookRequests.slice(0, 30).forEach(log => {
        console.log(`[${log.timestamp}] ${log.message}`);
        if (log.action) {
          console.log(`  Action: ${log.action}`);
        }
        if (log.metadata && log.metadata.propertyId) {
          console.log(`  Property ID: ${log.metadata.propertyId}`);
        }
        console.log('');
      });
      if (allWebhookRequests.length > 30) {
        console.log(`... and ${allWebhookRequests.length - 30} more\n`);
      }
    }

    if (
      deleteWebhookLogs.length === 0 &&
      signatureFailures.length === 0 &&
      propertyDeletions.length === 0
    ) {
      console.log('✅ No delete-property webhook activity found since Monday');
    }

  } catch (error) {
    console.error('Error checking logs:', error);
    throw error;
  }
}

checkDeleteWebhookLogs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
