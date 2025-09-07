// Script to fix trial dates via API
async function fixTrialDates() {
  try {
    // Get current profile to check trial status
    const profileResponse = await fetch('http://localhost:3001/api/realtor/profile');
    const profileData = await profileResponse.json();
    
    if (!profileData.profile) {
      console.log('No profile found');
      return;
    }
    
    const profile = profileData.profile;
    
    if (profile.isOnTrial) {
      console.log('Current profile on trial:');
      console.log(`  Name: ${profile.firstName} ${profile.lastName}`);
      console.log(`  Created: ${profile.createdAt}`);
      console.log(`  Trial Start: ${profile.trialStartDate}`);
      console.log(`  Trial End: ${profile.trialEndDate}`);
      
      // Calculate actual trial days remaining based on created date
      const createdDate = new Date(profile.createdAt);
      const now = new Date();
      const daysSinceCreation = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
      const actualDaysRemaining = Math.max(0, 7 - daysSinceCreation);
      
      console.log(`\n  Days since account creation: ${daysSinceCreation}`);
      console.log(`  Actual trial days remaining: ${actualDaysRemaining}`);
      
      // Show what the dates should be
      const correctTrialEnd = new Date(createdDate);
      correctTrialEnd.setDate(correctTrialEnd.getDate() + 7);
      console.log(`  Trial should end on: ${correctTrialEnd.toISOString()}`);
    } else {
      console.log('Profile is not on trial');
    }
  } catch (error) {
    console.error('Error checking trial dates:', error);
  }
}

fixTrialDates();