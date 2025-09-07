import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// One-time function to make existing user an admin
export async function POST(request: NextRequest) {
  try {
    const { email, secretKey } = await request.json();

    // Secure admin authentication
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret || secretKey !== adminSecret) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 403 }
      );
    }

    // Find the user
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', email.toLowerCase())
    );
    const userDocs = await getDocs(usersQuery);

    if (userDocs.empty) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userDoc = userDocs.docs[0];
    
    // Update user role to admin
    await updateDoc(doc(db, 'users', userDoc.id), {
      role: 'admin',
      updatedAt: serverTimestamp()
    });

    return NextResponse.json({
      success: true,
      message: `User ${email} is now an admin`,
      userId: userDoc.id
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update user role' },
      { status: 500 }
    );
  }
}