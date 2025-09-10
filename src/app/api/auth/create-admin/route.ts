import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { logInfo, logError } from '@/lib/logger';
import { adminDb } from '@/lib/firebase-admin';

// One-time admin account creation (for development)
export async function POST(request: NextRequest) {
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 503 });
    }

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
      adminDb.collection('users'),
      where('email', '==', email.toLowerCase())
    );
    const existingUsers = await usersQuery.get();

    if (!existingUsers.empty) {
      return NextResponse.json(
        { error: 'Account already exists with this email' },
        { status: 400 }
      );
    }

    // Hash the password
    const hashedPassword = await hash(password, 12);
    
    // Create admin user
    const userId = doc(adminDb.collection('users')).id;
    await adminDb.collection('users').doc(userId).set({
      id: userId,
      email: email.toLowerCase(),
      name: 'Admin User',
      role: 'admin',
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date()
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