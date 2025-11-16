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

    // Query for all logs since Monday
    const logsRef = db.collection('systemLogs');
    const snapshot = await logsRef
      .where('createdAt', '>=', mondayDate)
      .orderBy('createdAt', 'asc')
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
      console.log('📝 PROPERTY DELETIONS:');
      console.log('='.repeat(80));
      propertyDeletions.forEach(log => {
        console.log(`[${log.timestamp}] ${log.action}: ${log.message}`);
        if (log.metadata) {
          console.log('  Metadata:', JSON.stringify(log.metadata, null, 2));
        }
        console.log('');
      });
    }

    if (allWebhookRequests.length > 0) {
      console.log('📡 ALL WEBHOOK REQUESTS SINCE MONDAY:');
      console.log('='.repeat(80));
      allWebhookRequests.forEach(log => {
        console.log(`[${log.timestamp}] ${log.message}`);
        if (log.action) {
          console.log(`  Action: ${log.action}`);
        }
        if (log.metadata) {
          console.log('  Metadata:', JSON.stringify(log.metadata, null, 2));
        }
        console.log('');
      });
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
