// Simplified transaction history - just return basic transaction data
import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 503 });
    }

  try {
    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get realtor profile
    const realtorDocs = await adminDb.collection('realtors').where('userId', '==', session.user.id!).get();

    if (realtorDocs.empty) {
      return NextResponse.json({ error: 'Realtor profile not found' }, { status: 400 });
    }

    const realtorDoc = realtorDocs.docs[0];
    const realtorId = realtorDoc.id;
    const realtorProfile = realtorDoc.data();
    const currentBalance = realtorProfile?.credits || 0;

    const transactions = [];

    // Get lead purchases (credits spent)
    const purchasesQuery = query(
      adminDb.collection('buyerLeadPurchases'),
      where('realtorId', '==', realtorId),
      firestoreLimit(50)
    );
    const purchasesDocs = await purchasesQuery.get();

    // Process each lead purchase and get actual buyer details
    for (const doc of purchasesDocs.docs) {
      const purchase = doc.data();
      
      // Get actual buyer details from buyerProfiles
      let buyerName = purchase.buyerName || 'Unknown Buyer';
      let buyerLocation = 'Unknown';
      
      if (purchase.buyerId) {
        try {
          const buyerDocs = await adminDb.collection('buyerProfiles').where('__name__', '==', purchase.buyerId).get();
          
          if (!buyerDocs.empty) {
            const buyer = buyerDocs.docs[0].data();
            buyerName = `${buyer.firstName || 'Unknown'} ${buyer.lastName || 'Buyer'}`;
            // Read location from nested searchCriteria structure
            const primaryCity = buyer.searchCriteria?.cities?.[0] || 'Unknown';
            const primaryState = buyer.searchCriteria?.state || '';
            buyerLocation = `${primaryCity}, ${primaryState}`;
          }
        } catch (error) {
          console.error('Failed to get buyer details:', error);
        }
      }
      
      transactions.push({
        id: doc.id,
        type: 'lead_purchase',
        description: `Purchased lead: ${buyerName}`,
        creditsChange: -(purchase.creditsCost || 1),
        runningBalance: currentBalance,
        timestamp: purchase.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        details: {
          buyerName: buyerName,
          buyerCity: buyerLocation
        }
      });
    }

    // Get credit additions from transactions collection
    const transactionsQuery = query(
      adminDb.collection('transactions'),
      where('realtorId', '==', realtorId),
      firestoreLimit(50)
    );
    const transactionDocs = await transactionsQuery.get();

    transactionDocs.docs.forEach(doc => {
      const tx = doc.data();
      transactions.push({
        id: doc.id,
        type: 'credit_purchase',
        description: tx.description || `Added ${tx.credits} credits`,
        creditsChange: tx.credits || 0,
        runningBalance: currentBalance, // Simplified
        timestamp: tx.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        details: {}
      });
    });

    // Add trial credits as first transaction with correct amount
    const trialCredits = 3;
    transactions.unshift({
      id: 'trial-credits',
      type: 'trial_credit',
      description: `Trial credits (${trialCredits} credits)`,
      creditsChange: trialCredits,
      runningBalance: 0, // Will be calculated
      timestamp: realtorProfile?.createdAt?.toDate?.()?.toISOString() || new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      details: {}
    });

    // Sort chronologically (newest first) for display
    transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate running balance backwards from current balance
    // Show the balance AFTER each transaction (where credits went)
    let runningBalance = currentBalance;
    for (let i = 0; i < transactions.length; i++) {
      // For each transaction, first adjust the balance by the inverse of the change
      // to get what it was before, then set that as the running balance after the transaction
      const balanceAfterTransaction = runningBalance;
      runningBalance -= transactions[i].creditsChange;
      transactions[i].runningBalance = balanceAfterTransaction;
    }

    return NextResponse.json({
      transactions: transactions.slice(0, 20),
      currentBalance: currentBalance,
      totalSpent: transactions.filter(t => t.creditsChange < 0).reduce((sum, t) => sum + Math.abs(t.creditsChange), 0),
      totalEarned: transactions.filter(t => t.creditsChange > 0).reduce((sum, t) => sum + t.creditsChange, 0)
    });

  } catch (error) {
    console.error('Transaction history error:', error);
    return NextResponse.json({ error: 'Failed to load transaction history' }, { status: 500 });
  }
}