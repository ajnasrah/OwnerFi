import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { unifiedDb } from '@/lib/unified-db';
import { logError, logInfo } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, firstName, lastName, email, password, userType, languages } = body;

    // Use name if provided, otherwise combine firstName + lastName
    const fullName = name || `${firstName || ''} ${lastName || ''}`.trim();

    // Validation
    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await unifiedDb.users.findByEmail(email.toLowerCase());
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create user account - default to buyer if no userType specified
    const newUser = await unifiedDb.users.create({
      name: fullName.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: userType || 'buyer',
      languages: languages || ['English']
    });

    await logInfo('Created new buyer account', {
      action: 'buyer_signup',
      userId: newUser.id,
      userType: userType || 'buyer',
      email: email.toLowerCase(),
      languages: languages || ['English']
    });

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
      userId: newUser.id,
      redirectTo: (userType || 'buyer') === 'buyer' ? '/dashboard/setup' : '/realtor/setup'
    });

  } catch (error) {
    await logError('Failed to create buyer account', {
      action: 'buyer_signup_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}