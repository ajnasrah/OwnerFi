/**
 * Check sign-up statistics for the last 48 hours
 * Shows both successful and failed sign-up attempts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  };

  initializeApp({
    credential: cert(serviceAccount as any)
  });
}

const db = getFirestore();

interface SignupLog {
  id: string;
  level: string;
  message: string;
  context?: string;
  userId?: string;
  createdAt: any;
}

async function checkSignupStats() {
  try {
    console.log('\n🔍 Checking sign-up statistics for the last 48 hours...\n');

    // Calculate 48 hours ago
    const now = Timestamp.now();
    const fortyEightHoursAgo = Timestamp.fromMillis(now.toMillis() - (48 * 60 * 60 * 1000));

    console.log(`📅 Current time: ${now.toDate()}`);
    console.log(`📅 48 hours ago: ${fortyEightHoursAgo.toDate()}\n`);

    // Query all signup-related logs from the last 48 hours
    const logsSnapshot = await db.collection('systemLogs')
      .where('createdAt', '>=', fortyEightHoursAgo)
      .orderBy('createdAt', 'desc')
      .get();

    console.log(`📊 Total logs in last 48 hours: ${logsSnapshot.size}\n`);

    // Filter for signup-related logs
    const signupActions = [
      'buyer_signup',
      'buyer_phone_signup',
      'realtor_phone_signup',
      'realtor_registration',
      'phone_signup_error',
      'buyer_signup_error',
      'realtor_registration_error'
    ];

    const signupLogs: SignupLog[] = [];
    logsSnapshot.forEach(doc => {
      const data = doc.data() as SignupLog;
      const context = data.context ? JSON.parse(data.context) : {};

      // Check if this is a signup-related log
      if (signupActions.includes(context.action)) {
        signupLogs.push({
          ...data,
          context: data.context
        });
      }
    });

    console.log(`📝 Sign-up related logs found: ${signupLogs.length}\n`);

    // Categorize sign-ups
    const successful: { [key: string]: SignupLog[] } = {
      buyer_signup: [],
      buyer_phone_signup: [],
      realtor_phone_signup: [],
      realtor_registration: []
    };

    const failed: { [key: string]: SignupLog[] } = {
      phone_signup_error: [],
      buyer_signup_error: [],
      realtor_registration_error: []
    };

    signupLogs.forEach(log => {
      const context = log.context ? JSON.parse(log.context) : {};
      const action = context.action;

      if (action && successful[action]) {
        successful[action].push(log);
      } else if (action && failed[action]) {
        failed[action].push(log);
      }
    });

    // Calculate totals
    const totalSuccessful = Object.values(successful).reduce((sum, logs) => sum + logs.length, 0);
    const totalFailed = Object.values(failed).reduce((sum, logs) => sum + logs.length, 0);

    // Display results
    console.log('═══════════════════════════════════════════════════════');
    console.log('                  SUCCESSFUL SIGN-UPS                  ');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`✅ Buyer Sign-ups (Email/Password): ${successful.buyer_signup.length}`);
    if (successful.buyer_signup.length > 0) {
      successful.buyer_signup.forEach(log => {
        const context = JSON.parse(log.context || '{}');
        console.log(`   - ${log.createdAt.toDate().toLocaleString()} | User: ${log.userId || 'N/A'}`);
      });
      console.log();
    }

    console.log(`✅ Buyer Sign-ups (Phone Auth): ${successful.buyer_phone_signup.length}`);
    if (successful.buyer_phone_signup.length > 0) {
      successful.buyer_phone_signup.forEach(log => {
        const context = JSON.parse(log.context || '{}');
        console.log(`   - ${log.createdAt.toDate().toLocaleString()} | User: ${log.userId || 'N/A'} | Phone: ${context.metadata?.phone || 'N/A'}`);
      });
      console.log();
    }

    console.log(`✅ Realtor Sign-ups (Phone Auth): ${successful.realtor_phone_signup.length}`);
    if (successful.realtor_phone_signup.length > 0) {
      successful.realtor_phone_signup.forEach(log => {
        const context = JSON.parse(log.context || '{}');
        console.log(`   - ${log.createdAt.toDate().toLocaleString()} | User: ${log.userId || 'N/A'} | Phone: ${context.metadata?.phone || 'N/A'}`);
      });
      console.log();
    }

    console.log(`✅ Realtor Sign-ups (Email/Password): ${successful.realtor_registration.length}`);
    if (successful.realtor_registration.length > 0) {
      successful.realtor_registration.forEach(log => {
        const context = JSON.parse(log.context || '{}');
        console.log(`   - ${log.createdAt.toDate().toLocaleString()} | User: ${log.userId || 'N/A'} | Email: ${context.metadata?.email || 'N/A'}`);
      });
      console.log();
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('                    FAILED SIGN-UPS                    ');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`❌ Phone Sign-up Errors: ${failed.phone_signup_error.length}`);
    if (failed.phone_signup_error.length > 0) {
      failed.phone_signup_error.forEach(log => {
        console.log(`   - ${log.createdAt.toDate().toLocaleString()} | Message: ${log.message}`);
      });
      console.log();
    }

    console.log(`❌ Buyer Sign-up Errors: ${failed.buyer_signup_error.length}`);
    if (failed.buyer_signup_error.length > 0) {
      failed.buyer_signup_error.forEach(log => {
        console.log(`   - ${log.createdAt.toDate().toLocaleString()} | Message: ${log.message}`);
      });
      console.log();
    }

    console.log(`❌ Realtor Registration Errors: ${failed.realtor_registration_error.length}`);
    if (failed.realtor_registration_error.length > 0) {
      failed.realtor_registration_error.forEach(log => {
        console.log(`   - ${log.createdAt.toDate().toLocaleString()} | Message: ${log.message}`);
      });
      console.log();
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('                       SUMMARY                         ');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`✅ Total Successful Sign-ups: ${totalSuccessful}`);
    console.log(`❌ Total Failed Sign-ups: ${totalFailed}`);
    console.log(`📊 Total Sign-up Attempts: ${totalSuccessful + totalFailed}`);

    if (totalSuccessful + totalFailed > 0) {
      const successRate = ((totalSuccessful / (totalSuccessful + totalFailed)) * 100).toFixed(2);
      console.log(`📈 Success Rate: ${successRate}%`);
    }

    console.log('\n✅ Done!\n');

  } catch (error) {
    console.error('❌ Error checking signup stats:', error);
    throw error;
  }
}

checkSignupStats();
