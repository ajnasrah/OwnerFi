/**
 * Migration Script: Convert All Buyer Profiles to New Clean Structure
 * 
 * Run this once to migrate existing buyer profiles to the new architecture
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  // Your Firebase config here
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateBuyerProfiles() {
  try {
    console.log('🔄 Starting buyer profile migration...');
    
    // Get all buyer profiles
    const buyerProfilesSnapshot = await getDocs(collection(db, 'buyerProfiles'));
    const profiles = buyerProfilesSnapshot.docs;
    
    console.log(`📋 Found ${profiles.length} buyer profiles to migrate`);
    
    for (const profileDoc of profiles) {
      const profileData = profileDoc.data();
      const profileId = profileDoc.id;
      
      console.log(`🔄 Migrating profile: ${profileData.firstName} ${profileData.lastName}`);
      
      // Convert to new clean structure
      const newStructure = {
        // Keep basic info
        userId: profileData.userId,
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        email: profileData.email || '',
        phone: profileData.phone || '',
        
        // Convert to new searchCriteria structure
        searchCriteria: {
          cities: profileData.cities || profileData.searchAreaCities || [profileData.preferredCity],
          state: profileData.preferredState,
          maxMonthlyPayment: profileData.maxMonthlyPayment || 0,
          maxDownPayment: profileData.maxDownPayment || 0,
          minBedrooms: profileData.minBedrooms || null,
          minBathrooms: profileData.minBathrooms || null,
          searchRadius: profileData.searchRadius || 25
        },
        
        profileComplete: true,
        
        // Remove old fields by not including them
        // This will clean up: preferredCity, preferredState, maxMonthlyPayment, maxDownPayment, etc.
        
        updatedAt: serverTimestamp(),
        migratedAt: new Date().toISOString()
      };
      
      // Update the profile
      await updateDoc(doc(db, 'buyerProfiles', profileId), newStructure);
      
      console.log(`✅ Migrated: ${profileData.preferredCity || 'Unknown'} → ${newStructure.searchCriteria.cities[0]}`);
    }
    
    console.log(`🎉 Migration complete! Migrated ${profiles.length} buyer profiles`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run migration
migrateBuyerProfiles();