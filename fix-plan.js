// Fix plan to show Professional instead of Starter
async function fixPlan() {
  const response = await fetch('http://localhost:3000/api/admin/activate-subscription', {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      realtorId: 'idjfqlXrzobyRoFVRTUO',
      plan: 'professional',
      creditsToAdd: 0
    })
  });
  
  const data = await response.json();
  console.log('Fixed plan:', data);
}

fixPlan();