#!/usr/bin/env tsx

// FIREBASE CONNECTION VALIDATOR - Ensures Firebase is working before running tests
// This validates that Firebase is initialized and we can read/write data

import { FirebaseDB } from '../lib/firebase-db';

async function validateFirebaseConnection() {
  
  try {
    
    // Test: Try to query existing buyerProfiles
    const existingBuyers = await FirebaseDB.queryDocuments('buyerProfiles', []);
    
    // Test: Try to query existing buyerLinks (for migration comparison)
    const existingLinks = await FirebaseDB.queryDocuments('buyerLinks', []);
    
    // Test: Check if we have realtor users
    const existingRealtors = await FirebaseDB.queryDocuments('users', [
      { field: 'role', operator: '==', value: 'realtor' }
    ]);
    
    // Test: Create a test document to verify write permissions
    const testData = {
      testId: `validation_test_${Date.now()}`,
      message: 'Firebase connection validation',
      timestamp: new Date().toISOString()
    };
    
    const testDoc = await FirebaseDB.createDocument('_test_validation', testData);
    
    // Clean up test document
    await FirebaseDB.deleteDocument('_test_validation', (testDoc as any).id);
    
    
    // Recommendations
    if (existingLinks.length > 0 && existingBuyers.length > 0) {
    }
    
    if (existingBuyers.length === 0 && existingLinks.length === 0) {
    }
    
    return {
      success: true,
      buyerProfiles: existingBuyers.length,
      buyerLinks: existingLinks.length,
      realtorUsers: existingRealtors.length
    };
    
  } catch (error) {
    
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

// Run validation
if (require.main === module) {
  validateFirebaseConnection().then(result => {
    if (!result.success) {
      process.exit(1);
    }
  });
}

export { validateFirebaseConnection };