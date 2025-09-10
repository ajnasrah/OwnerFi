import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { unifiedDb, generateId } from '@/lib/unified-db';
import { logError, logInfo } from '@/lib/logger';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, phone, company, licenseState, role } = body;

    // Validation
    if (!name || !email || !password || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, password, and phone are required' },
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

    // Create user account - Stripe customer will be created on first payment
    const newUser = await unifiedDb.users.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone.trim(),
      company: company?.trim() || null,
      licenseState: licenseState?.trim() || null,
      stripeCustomerId: null, // Will be populated on first payment
      role: 'realtor'
    });

    await logInfo('Created new realtor account', {
      action: 'realtor_signup',
      userId: newUser.id,
      userType: 'realtor',
      metadata: {
        email: email.toLowerCase()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Realtor account created successfully',
      userId: newUser.id
    });

  } catch (error) {
    await logError('Failed to create realtor account', {
      action: 'realtor_signup_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}