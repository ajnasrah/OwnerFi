import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
export async function POST(request: NextRequest) {
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 503 });
    }

  try {
    const body = await request.json();
    const { keepAccountId, transferCredits } = body;
    
    if (!keepAccountId) {
      return NextResponse.json(
        { error: 'keepAccountId is required' },
        { status: 400 }
      );
    }
    
    // Find all Abdullah accounts
    const realtorsQuery = query(adminDb.collection('realtors'));
    const realtorDocs = await realtorsQuery.get();
    
    const accounts = [];
    let mainAccount = null;
    
    for (const docRef of realtorDocs.docs) {
      const data = docRef.data();
      if (data.firstName?.toLowerCase().includes('abdullah') || 
          data.email?.includes('abunasrah') ||
          data.lastName?.toLowerCase().includes('abunasrah')) {
        
        const account = {
          id: docRef.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          credits: data.credits || 0,
          isOnTrial: data.isOnTrial,
          userId: data.userId
        };
        
        if (docRef.id === keepAccountId) {
          mainAccount = account;
        } else {
          accounts.push(account);
        }
      }
    }
    
    if (!mainAccount) {
      return NextResponse.json(
        { error: 'Main account not found' },
        { status: 404 }
      );
    }
    
    let totalCreditsTransferred = 0;
    const deletedAccounts = [];
    
    if (transferCredits) {
      // Transfer credits from other accounts to main account
      for (const account of accounts) {
        totalCreditsTransferred += account.credits;
        deletedAccounts.push({
          email: account.email,
          credits: account.credits
        });
        
        // Delete the duplicate account
        await deleteDoc(adminDb.collection('realtors').doc(account.id));
      }
      
      // Update main account with consolidated credits
      await adminDb.collection('realtors').doc(keepAccountId).update({
        credits: mainAccount.credits + totalCreditsTransferred,
        updatedAt: new Date()
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Consolidated ${accounts.length} accounts`,
      mainAccount: {
        id: mainAccount.id,
        email: mainAccount.email,
        oldCredits: mainAccount.credits,
        newCredits: mainAccount.credits + totalCreditsTransferred,
        creditsAdded: totalCreditsTransferred
      },
      deletedAccounts,
      totalCreditsTransferred
    });
    
  } catch (error) {
    console.error('Failed to consolidate accounts:', error);
    return NextResponse.json(
      { error: 'Failed to consolidate accounts' },
      { status: 500 }
    );
  }
}