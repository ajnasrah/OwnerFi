// Debug Firebase initialization
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
const result = config({ path: resolve(process.cwd(), '.env.local') });

console.log('\n🔍 Firebase Environment Variables Check:\n');

const requiredVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID'
];

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`❌ ${varName}: NOT FOUND`);
  }
});

console.log(`\n📊 Total env vars loaded: ${result.parsed ? Object.keys(result.parsed).length : 0}`);
console.log(`📊 Firebase check: ${!!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)}`);

// Try to initialize Firebase
console.log('\n🔥 Attempting Firebase initialization...\n');

import { db } from '../src/lib/firebase';

if (db) {
  console.log('✅ Firebase initialized successfully!');
  console.log(`   Database: ${db.app.options.projectId}`);
} else {
  console.log('❌ Firebase NOT initialized');
  console.log('   Check that NEXT_PUBLIC_ prefixed variables exist in .env.local');
}
