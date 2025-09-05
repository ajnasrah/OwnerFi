import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db as firebaseDb } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    // Get all buyer profiles
    const buyersQuery = query(collection(firebaseDb, 'buyerProfiles'));
    const buyerDocs = await getDocs(buyersQuery);
    const buyerProfiles = buyerDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Get users for each buyer
    const buyersWithUsers = [];
    for (const buyer of buyerProfiles) {
      let user = null;
      if (buyer.userId) {
        const userQuery = query(collection(firebaseDb, 'users'), where('id', '==', buyer.userId));
        const userDocs = await getDocs(userQuery);
        if (!userDocs.empty) {
          user = { id: userDocs.docs[0].id, ...userDocs.docs[0].data() };
        }
      }
      buyersWithUsers.push({ buyer, user });
    }

    return NextResponse.json({
      totalBuyers: buyersWithUsers.length,
      buyers: buyersWithUsers.map(b => ({
        id: b.buyer.id,
        name: `${b.buyer.firstName} ${b.buyer.lastName}`,
        phone: b.buyer.phone,
        budget: `$${b.buyer.maxMonthlyPayment}/month, $${b.buyer.maxDownPayment} down`,
        location: `${b.buyer.preferredCity}, ${b.buyer.preferredState}`,
        radius: `${b.buyer.searchRadius} miles`,
        isActive: b.buyer.isActive,
        profileComplete: b.buyer.profileComplete,
        createdAt: b.buyer.createdAt,
        userExists: !!b.user,
        userRole: b.user?.role
      }))
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get buyers', details: (error as Error).message },
      { status: 500 }
    );
  }
}