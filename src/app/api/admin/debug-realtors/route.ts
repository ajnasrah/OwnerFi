import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db as firebaseDb } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    // Get all realtor profiles
    const realtorsQuery = query(collection(firebaseDb, 'realtors'));
    const realtorDocs = await getDocs(realtorsQuery);
    const realtorProfiles = realtorDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Get users for each realtor
    const realtorsWithUsers = [];
    for (const realtor of realtorProfiles) {
      let user = null;
      if ('userId' in realtor && realtor.userId) {
        const userQuery = query(collection(firebaseDb, 'users'), where('id', '==', realtor.userId));
        const userDocs = await getDocs(userQuery);
        if (!userDocs.empty) {
          user = { id: userDocs.docs[0].id, ...userDocs.docs[0].data() };
        }
      }
      realtorsWithUsers.push({ realtor, user });
    }

    return NextResponse.json({
      totalRealtors: realtorsWithUsers.length,
      realtors: realtorsWithUsers.map(r => ({
        id: r.realtor.id,
        name: `${r.realtor.firstName} ${r.realtor.lastName}`,
        email: r.realtor.email,
        phone: r.realtor.phone,
        company: r.realtor.company,
        serviceArea: r.realtor.primaryCity && r.realtor.primaryState 
          ? `${r.realtor.primaryCity}, ${r.realtor.primaryState} (${r.realtor.serviceRadius} mi)`
          : 'Not set',
        credits: r.realtor.credits,
        isOnTrial: r.realtor.isOnTrial,
        profileComplete: r.realtor.profileComplete,
        isActive: r.realtor.isActive,
        createdAt: r.realtor.createdAt,
        userExists: !!r.user,
        userRole: r.user?.role
      }))
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get realtors', details: (error as Error).message },
      { status: 500 }
    );
  }
}