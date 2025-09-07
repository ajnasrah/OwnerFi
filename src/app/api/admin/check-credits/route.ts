import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    // Find all realtors with your email/name
    const realtorsQuery = query(
      collection(db, 'realtors')
    );
    const realtorDocs = await getDocs(realtorsQuery);
    
    const accounts = [];
    
    for (const doc of realtorDocs.docs) {
      const data = doc.data();
      if (data.firstName?.toLowerCase().includes('abdullah') || 
          data.email?.includes('abunasrah') ||
          data.lastName?.toLowerCase().includes('abunasrah')) {
        accounts.push({
          id: doc.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          credits: data.credits,
          isOnTrial: data.isOnTrial,
          userId: data.userId,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        });
      }
    }
    
    // Also check transactions to see credit movements
    const transactionsQuery = query(collection(db, 'transactions'));
    const transactionDocs = await getDocs(transactionsQuery);
    
    const creditTransactions = [];
    for (const doc of transactionDocs.docs) {
      const data = doc.data();
      if (accounts.some(acc => acc.id === data.realtorId)) {
        creditTransactions.push({
          id: doc.id,
          realtorId: data.realtorId,
          type: data.type,
          credits: data.credits,
          description: data.description,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        });
      }
    }
    
    // Sort transactions by date
    creditTransactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return NextResponse.json({
      accounts,
      totalAccounts: accounts.length,
      totalCredits: accounts.reduce((sum, acc) => sum + (acc.credits || 0), 0),
      recentTransactions: creditTransactions.slice(0, 10)
    });
    
  } catch (error) {
    console.error('Failed to check credits:', error);
    return NextResponse.json(
      { error: 'Failed to check credits' },
      { status: 500 }
    );
  }
}