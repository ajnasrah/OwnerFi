// Add back the 10 Professional credits
async function addCredits() {
  const response = await fetch('http://localhost:3000/api/admin/add-credits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      realtorId: 'idjfqlXrzobyRoFVRTUO',
      credits: 10,
      description: 'Professional Package credits (corrected)'
    })
  });
  
  const data = await response.json();
  console.log('Added credits:', data);
}

addCredits();