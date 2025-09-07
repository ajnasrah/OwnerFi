// Script to add missing credits for already approved disputes

async function fixApprovedDisputes() {
  const response = await fetch('http://localhost:3001/api/admin/disputes');
  const data = await response.json();
  
  const approvedDisputes = data.resolvedDisputes?.filter(d => d.status === 'approved' && !d.refundAmount) || [];
  
  console.log(`Found ${approvedDisputes.length} approved disputes without refunds`);
  
  for (const dispute of approvedDisputes) {
    console.log(`\nProcessing dispute ${dispute.id.substring(0, 8)}...`);
    console.log(`  Realtor: ${dispute.realtorName}`);
    console.log(`  Buyer: ${dispute.buyerName}`);
    
    // Re-approve with 1 credit refund
    const fixResponse = await fetch('http://localhost:3001/api/admin/disputes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        disputeId: dispute.id,
        action: 'approve',
        refundCredits: 1,
        adminNotes: 'Fixed missing refund from previous approval'
      })
    });
    
    if (fixResponse.ok) {
      console.log(`  ✓ Added 1 credit refund`);
    } else {
      console.log(`  ✗ Failed to add refund`);
    }
  }
  
  console.log('\nDone! Credits should now be refunded.');
}

fixApprovedDisputes();