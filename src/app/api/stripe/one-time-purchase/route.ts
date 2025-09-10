import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { logInfo, logError } from '@/lib/logger';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

// Force dynamic rendering to prevent build-time Firebase evaluation
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

    const { userId, userEmail, credits, amount } = await request.json();
    
    if (!userId || !userEmail) {
      return NextResponse.json(
        { error: 'Missing userId or userEmail' },
        { status: 400 }
      );
    }
    
    // Validate request
    if (!credits || !amount || credits !== 1 || amount !== 300) {
      return NextResponse.json(
        { error: 'Invalid purchase: Only 1 credit for $300 allowed' },
        { status: 400 }
      );
    }

    // Get user's stored Stripe customer ID
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    let stripeCustomerId = userData?.stripeCustomerId;

    // If no customer ID stored, try to find or create one
    if (!stripeCustomerId) {
      try {
        const customers = await stripe.customers.list({
          email: userEmail,
          limit: 1
        });
        
        if (customers.data.length > 0) {
          stripeCustomerId = customers.data[0].id;
        } else {
          const customer = await stripe.customers.create({
            email: userEmail,
            name: 'Unknown',
            metadata: {
              userId: userId,
              userType: 'realtor'
            }
          });
          stripeCustomerId = customer.id;
        }

        // Update user record with customer ID
        await adminDb.collection('users').doc(userId).update({
          stripeCustomerId: stripeCustomerId
        });
      } catch (error) {
        console.error('Customer lookup/creation failed:', error);
      }
    }

    // Create one-time payment checkout
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment', // ONE-TIME payment, not subscription
      payment_method_types: ['card'],
      customer: stripeCustomerId || undefined,
      customer_email: stripeCustomerId ? undefined : userEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Single Credit Purchase',
              description: '1 buyer lead credit for immediate use'
            },
            unit_amount: 30000 // $300.00 in cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId,
        userEmail: userEmail!,
        planId: 'payAsYouGo',
        type: 'credit_purchase',
        credits: '1',
        amount: '300',
        customerId: stripeCustomerId || 'unknown'
      },
      success_url: `${process.env.NEXTAUTH_URL}/realtor/settings?success=credit&credits=1`,
      cancel_url: `${process.env.NEXTAUTH_URL}/realtor/settings?canceled=true`,
    });

    await logInfo('Single credit checkout created', {
      action: 'single_credit_checkout',
      userId: userId,
      userType: 'realtor',
      metadata: {
        amount: 300,
        credits: 1,
        sessionId: checkoutSession.id
      }
    });

    return NextResponse.json({ 
      url: checkoutSession.url,
      sessionId: checkoutSession.id 
    });

  } catch (error) {
    console.error('Single credit purchase error:', error);
    
    await logError('Single credit purchase failed', {
      action: 'single_credit_purchase_error'
    }, error as Error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create credit purchase',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}