import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit as firestoreLimit,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSessionWithRole } from '@/lib/auth-utils';
import { logError } from '@/lib/logger';

interface TransactionHistory {
  id: string;
  type: 'lead_purchase' | 'credit_purchase' | 'subscription_credit' | 'trial_credit';
  description: string;
  creditsChange: number; // Positive for additions, negative for purchases
  runningBalance: number;
  timestamp: string;
  details?: {
    buyerName?: string;
    buyerCity?: string;
    purchasePrice?: number;
    subscriptionPlan?: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get realtor profile
    const realtorsQuery = query(
      collection(db, 'realtors'),
      where('userId', '==', session.user.id!)
    );
    const realtorDocs = await getDocs(realtorsQuery);

    if (realtorDocs.empty) {
      return NextResponse.json(
        { error: 'Realtor profile not found' },
        { status: 400 }
      );
    }

    const realtorDoc = realtorDocs.docs[0];
    const realtorId = realtorDoc.id;

    // Get transaction history from multiple sources
    const transactions: TransactionHistory[] = [];

    // 1. Lead Purchases (credits spent) - Remove problematic orderBy
    const purchasesQuery = query(
      collection(db, 'buyerLeadPurchases'),
      where('realtorId', '==', realtorId),
      firestoreLimit(50)
    );
    const purchasesDocs = await getDocs(purchasesQuery);

    for (const purchaseDoc of purchasesDocs.docs) {
      const purchase = purchaseDoc.data();
      
      // Get buyer details
      const buyerDoc = await getDoc(doc(db, 'buyerProfiles', purchase.buyerId));
      const buyerData = buyerDoc.exists() ? buyerDoc.data() : null;
      
      transactions.push({
        id: purchaseDoc.id,
        type: 'lead_purchase',
        description: `Purchased lead: ${buyerData?.firstName || 'Unknown'} ${buyerData?.lastName || 'Buyer'}`,
        creditsChange: -(purchase.creditsCost || 1),
        runningBalance: 0, // Will calculate later
        timestamp: purchase.createdAt?.toDate?.()?.toISOString() || purchase.purchasedAt,
        details: {
          buyerName: `${buyerData?.firstName || 'Unknown'} ${buyerData?.lastName || 'Buyer'}`,
          buyerCity: `${buyerData?.preferredCity || 'Unknown'}, ${buyerData?.preferredState || ''}`.trim().replace(', ', ''),
          purchasePrice: purchase.purchasePrice || 8.00
        }
      });
    }

    // 2. Credit Purchases/Subscriptions (credits added) - Remove problematic orderBy
    const subscriptionsQuery = query(
      collection(db, 'realtorSubscriptions'),
      where('realtorId', '==', realtorId)
    );
    const subscriptionDocs = await getDocs(subscriptionsQuery);

    for (const subDoc of subscriptionDocs.docs) {
      const subscription = subDoc.data();
      
      if (subscription.plan === 'trial') {
        transactions.push({
          id: `trial-${subDoc.id}`,
          type: 'trial_credit',
          description: 'Free trial credits',
          creditsChange: subscription.creditsPerMonth || 3,
          runningBalance: 0,
          timestamp: subscription.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          details: {
            subscriptionPlan: 'Free Trial'
          }
        });
      } else if (subscription.status === 'active') {
        transactions.push({
          id: `sub-${subDoc.id}`,
          type: 'subscription_credit',
          description: `Monthly credits - ${subscription.plan}`,
          creditsChange: subscription.creditsPerMonth || 0,
          runningBalance: 0,
          timestamp: subscription.currentPeriodStart?.toDate?.()?.toISOString() || new Date().toISOString(),
          details: {
            subscriptionPlan: subscription.plan
          }
        });
      }
    }

    // 3. Manual Credit Purchases (if any exist) - Remove problematic orderBy
    const creditPurchasesQuery = query(
      collection(db, 'creditPurchases'),
      where('realtorId', '==', realtorId)
    );
    const creditDocs = await getDocs(creditPurchasesQuery);

    for (const creditDoc of creditDocs.docs) {
      const purchase = creditDoc.data();
      
      transactions.push({
        id: creditDoc.id,
        type: 'credit_purchase',
        description: `Purchased ${purchase.creditsAmount} credits`,
        creditsChange: purchase.creditsAmount || 0,
        runningBalance: 0,
        timestamp: purchase.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        details: {
          purchasePrice: purchase.amount || 0
        }
      });
    }

    // Sort all transactions by timestamp (newest first)
    transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate running balances (working backwards from current balance)
    const currentBalance = realtorDoc.data()?.credits || 0;
    let runningBalance = currentBalance;

    // Work forwards through transactions to calculate running balance at each point
    for (let i = transactions.length - 1; i >= 0; i--) {
      runningBalance -= transactions[i].creditsChange;
      transactions[i].runningBalance = runningBalance + transactions[i].creditsChange;
    }

    return NextResponse.json({
      transactions: transactions.slice(0, 20), // Return last 20 transactions
      currentBalance,
      totalSpent: transactions
        .filter(t => t.creditsChange < 0)
        .reduce((sum, t) => sum + Math.abs(t.creditsChange), 0),
      totalEarned: transactions
        .filter(t => t.creditsChange > 0)
        .reduce((sum, t) => sum + t.creditsChange, 0)
    });

  } catch (error) {
    await logError('Failed to fetch transaction history', error, {
      action: 'transaction_history_error'
    });

    return NextResponse.json(
      { error: 'Failed to load transaction history' },
      { status: 500 }
    );
  }
}