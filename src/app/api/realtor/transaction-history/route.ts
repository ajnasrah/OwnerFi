// Simplified transaction history - just return basic transaction data
import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  limit as firestoreLimit
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSessionWithRole } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get realtor profile
    const realtorsQuery = query(
      collection(db, 'realtors'),
      where('userId', '==', session.user.id!)
    );
    const realtorDocs = await getDocs(realtorsQuery);

    if (realtorDocs.empty) {
      return NextResponse.json({ error: 'Realtor profile not found' }, { status: 400 });
    }

    const realtorDoc = realtorDocs.docs[0];
    const realtorId = realtorDoc.id;
    const currentBalance = realtorDoc.data()?.credits || 0;

    const transactions = [];

    // Get lead purchases (credits spent)
    const purchasesQuery = query(
      collection(db, 'buyerLeadPurchases'),
      where('realtorId', '==', realtorId),
      firestoreLimit(50)
    );
    const purchasesDocs = await getDocs(purchasesQuery);

    // Process each lead purchase and get actual buyer details
    for (const doc of purchasesDocs.docs) {
      const purchase = doc.data();
      
      // Get actual buyer details from buyerProfiles
      let buyerName = purchase.buyerName || 'Unknown Buyer';
      let buyerLocation = 'Unknown';
      
      if (purchase.buyerId) {
        try {
          const buyerQuery = query(
            collection(db, 'buyerProfiles'),
            where('__name__', '==', purchase.buyerId)
          );
          const buyerDocs = await getDocs(buyerQuery);
          
          if (!buyerDocs.empty) {
            const buyer = buyerDocs.docs[0].data();
            buyerName = `${buyer.firstName || 'Unknown'} ${buyer.lastName || 'Buyer'}`;
            buyerLocation = `${buyer.preferredCity || 'Unknown'}, ${buyer.preferredState || ''}`;
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
          buyerCity: buyerLocation,
          purchasePrice: purchase.purchasePrice || 8.00
        }
      });
    }

    // Get credit additions from transactions collection
    const transactionsQuery = query(
      collection(db, 'transactions'),
      where('realtorId', '==', realtorId),
      firestoreLimit(50)
    );
    const transactionDocs = await getDocs(transactionsQuery);

    transactionDocs.docs.forEach(doc => {
      const tx = doc.data();
      transactions.push({
        id: doc.id,
        type: 'credit_purchase',
        description: tx.description || `Added ${tx.credits} credits`,
        creditsChange: tx.credits || 0,
        runningBalance: currentBalance, // Simplified
        timestamp: tx.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        details: {
          purchasePrice: tx.amount || 0
        }
      });
    });

    // Add trial credits as first transaction
    transactions.unshift({
      id: 'trial-credits',
      type: 'trial_credit',
      description: 'Trial credits',
      creditsChange: 3,
      runningBalance: 0, // Will be calculated
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
      details: {}
    });

    // Sort chronologically (oldest first) for calculation
    transactions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Calculate running balance starting from 0
    let balance = 0;
    transactions.forEach(transaction => {
      balance += transaction.creditsChange;
      transaction.runningBalance = balance;
    });

    // Reverse for display (newest first)
    transactions.reverse();

    return NextResponse.json({
      transactions: transactions.slice(0, 20),
      currentBalance: balance,
      totalSpent: transactions.filter(t => t.creditsChange < 0).reduce((sum, t) => sum + Math.abs(t.creditsChange), 0),
      totalEarned: transactions.filter(t => t.creditsChange > 0).reduce((sum, t) => sum + t.creditsChange, 0)
    });

  } catch (error) {
    console.error('Transaction history error:', error);
    return NextResponse.json({ error: 'Failed to load transaction history' }, { status: 500 });
  }
}