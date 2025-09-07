// Manual subscription activation
async function activateSubscription() {
  try {
    // Get your main realtor account
    const response = await fetch('http://localhost:3000/api/admin/check-credits');
    const data = await response.json();
    
    const mainAccount = data.accounts.find(acc => acc.email === 'abdullah@prosway.com');
    if (!mainAccount) {
      console.log('Main account not found');
      return;
    }
    
    console.log('Current account status:');
    console.log(`  Credits: ${mainAccount.credits}`);
    console.log(`  Trial: ${mainAccount.isOnTrial}`);
    
    // Manually activate Professional subscription
    const updateResponse = await fetch('http://localhost:3000/api/admin/activate-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realtorId: mainAccount.id,
        plan: 'professional',
        creditsToAdd: 10
      })
    });
    
    if (updateResponse.ok) {
      const result = await updateResponse.json();
      console.log('Subscription activated:', result);
    } else {
      console.log('Failed to activate subscription');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

activateSubscription();