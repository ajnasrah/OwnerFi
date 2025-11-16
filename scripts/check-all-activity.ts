import { getAdminDb } from '../src/lib/firebase-admin';

async function checkAllActivity() {
  try {
    const db = await getAdminDb();
    if (!db) {
      throw new Error('Failed to initialize Firebase Admin');
    }

    console.log('🔍 Analyzing all system activity since Monday...\n');

    const mondayDate = new Date('2025-11-11T00:00:00Z');
    console.log(`Looking for activity since: ${mondayDate.toISOString()}\n`);

    const logsRef = db.collection('systemLogs');
    const snapshot = await logsRef
      .where('createdAt', '>=', mondayDate)
      .limit(5000)
      .get();

    console.log(`Total logs analyzed: ${snapshot.size}\n`);

    // Categorize all activity
    const activityByType = new Map<string, number>();
    const activityByAction = new Map<string, any[]>();
    const errors: any[] = [];
    const warnings: any[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const message = data.message || '';
      const contextStr = data.context || '';
      const level = data.level || 'info';

      let context: any = {};
      try {
        context = typeof contextStr === 'string' ? JSON.parse(contextStr) : contextStr;
      } catch (e) {
        context = {};
      }

      const action = context?.action || 'unknown';

      // Count by action type
      activityByType.set(action, (activityByType.get(action) || 0) + 1);

      // Store samples of each action
      if (!activityByAction.has(action)) {
        activityByAction.set(action, []);
      }
      if (activityByAction.get(action)!.length < 3) {
        activityByAction.get(action)!.push({
          timestamp: data.createdAt?.toDate?.() || data.createdAt,
          level,
          message,
          metadata: context?.metadata,
        });
      }

      // Collect errors and warnings
      if (level === 'error') {
        errors.push({
          timestamp: data.createdAt?.toDate?.() || data.createdAt,
          message,
          action,
          metadata: context?.metadata,
        });
      } else if (level === 'warn') {
        warnings.push({
          timestamp: data.createdAt?.toDate?.() || data.createdAt,
          message,
          action,
          metadata: context?.metadata,
        });
      }
    });

    console.log('='.repeat(80));
    console.log('📊 ACTIVITY SUMMARY BY TYPE');
    console.log('='.repeat(80));

    // Sort by count
    const sortedActivity = Array.from(activityByType.entries())
      .sort((a, b) => b[1] - a[1]);

    sortedActivity.forEach(([action, count]) => {
      console.log(`${action.padEnd(40)} ${count.toString().padStart(6)} events`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('⚠️  WARNINGS AND ERRORS');
    console.log('='.repeat(80));
    console.log(`Total Errors: ${errors.length}`);
    console.log(`Total Warnings: ${warnings.length}\n`);

    if (errors.length > 0) {
      console.log('Recent Errors (last 10):');
      errors.slice(-10).forEach(log => {
        console.log(`[${log.timestamp}] ${log.action}: ${log.message}`);
        if (log.metadata) {
          console.log(`  Details: ${JSON.stringify(log.metadata, null, 2)}`);
        }
      });
      console.log('');
    }

    if (warnings.length > 0) {
      console.log('Recent Warnings (last 10):');
      warnings.slice(-10).forEach(log => {
        console.log(`[${log.timestamp}] ${log.action}: ${log.message}`);
        if (log.metadata) {
          console.log(`  Details: ${JSON.stringify(log.metadata, null, 2)}`);
        }
      });
      console.log('');
    }

    console.log('='.repeat(80));
    console.log('📝 SAMPLE ACTIVITIES (3 examples per type)');
    console.log('='.repeat(80));

    // Show top 15 most common activities with samples
    sortedActivity.slice(0, 15).forEach(([action, count]) => {
      console.log(`\n${action} (${count} total):`);
      const samples = activityByAction.get(action) || [];
      samples.forEach((sample, idx) => {
        console.log(`  ${idx + 1}. [${sample.timestamp}] ${sample.message}`);
        if (sample.metadata && Object.keys(sample.metadata).length > 0) {
          const keys = Object.keys(sample.metadata).slice(0, 5);
          console.log(`     Fields: ${keys.join(', ')}`);
        }
      });
    });

    // Look for specific interesting patterns
    console.log('\n' + '='.repeat(80));
    console.log('🔍 NOTABLE PATTERNS');
    console.log('='.repeat(80));

    // API endpoints hit
    const apiCalls = new Map<string, number>();
    snapshot.forEach((doc) => {
      const data = doc.data();
      const message = data.message || '';
      if (message.includes('webhook') || message.includes('API') || message.includes('route')) {
        const contextStr = data.context || '';
        let context: any = {};
        try {
          context = typeof contextStr === 'string' ? JSON.parse(contextStr) : contextStr;
        } catch (e) {}

        const endpoint = context?.metadata?.endpoint ||
                        context?.metadata?.path ||
                        context?.action ||
                        'unknown';
        apiCalls.set(endpoint, (apiCalls.get(endpoint) || 0) + 1);
      }
    });

    if (apiCalls.size > 0) {
      console.log('\nAPI/Webhook Activity:');
      Array.from(apiCalls.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([endpoint, count]) => {
          console.log(`  ${endpoint.padEnd(50)} ${count} calls`);
        });
    }

    // User activity
    const userActions = new Map<string, Set<string>>();
    snapshot.forEach((doc) => {
      const data = doc.data();
      const userId = data.userId;
      const contextStr = data.context || '';
      let context: any = {};
      try {
        context = typeof contextStr === 'string' ? JSON.parse(contextStr) : contextStr;
      } catch (e) {}

      const action = context?.action;

      if (userId && action) {
        if (!userActions.has(userId)) {
          userActions.set(userId, new Set());
        }
        userActions.get(userId)!.add(action);
      }
    });

    if (userActions.size > 0) {
      console.log('\nUser Activity Summary:');
      userActions.forEach((actions, userId) => {
        console.log(`  ${userId}: ${actions.size} different action types`);
      });
    }

  } catch (error) {
    console.error('Error checking logs:', error);
    throw error;
  }
}

checkAllActivity()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
