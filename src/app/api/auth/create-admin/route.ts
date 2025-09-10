import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logInfo, logError } from '@/lib/logger';

// One-time admin account creation (for development)
export async function POST(request: NextRequest) {
  try {
    const { email, password, secretKey } = await request.json();

    // Simple security check - require a secret key
    if (secretKey !== 'create-admin-2025') {
      return NextResponse.json(
        { error: 'Invalid secret key' },
        { status: 403 }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', email.toLowerCase())
    );
    const existingUsers = await getDocs(usersQuery);

    if (!existingUsers.empty) {
      return NextResponse.json(
        { error: 'Account already exists with this email' },
        { status: 400 }
      );
    }

    // Hash the password
    const hashedPassword = await hash(password, 12);
    
    // Create admin user
    const userId = doc(collection(db, 'users')).id;
    await setDoc(doc(db, 'users', userId), {
      id: userId,
      email: email.toLowerCase(),
      name: 'Admin User',
      role: 'admin',
      password: hashedPassword,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await logInfo('Admin account created', {
      action: 'admin_account_created',
      userId: userId,
      metadata: {
        email: email.toLowerCase()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Admin account created successfully',
      email: email.toLowerCase()
    });

  } catch (error) {
    await logError('Failed to create admin account', {
      action: 'create_admin_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to create admin account' },
      { status: 500 }
    );
  }
}