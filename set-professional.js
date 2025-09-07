// Set Professional plan
async function setProfessional() {
  const response = await fetch('http://localhost:3000/api/admin/activate-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      realtorId: 'idjfqlXrzobyRoFVRTUO',
      plan: 'professional',
      creditsToAdd: 0 // Don't add more credits
    })
  });
  
  const data = await response.json();
  console.log('Result:', data);
}

setProfessional();