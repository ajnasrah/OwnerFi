import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  getDoc,
  updateDoc,
  increment
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logInfo, logError } from '@/lib/logger';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { credits, amount } = await request.json();
    
    // Validate request
    if (!credits || !amount || credits !== 1 || amount !== 300) {
      return NextResponse.json(
        { error: 'Invalid purchase: Only 1 credit for $300 allowed' },
        { status: 400 }
      );
    }

    // Get user's stored Stripe customer ID
    const userDoc = await getDoc(doc(db, 'users', session.user.id!));
    const userData = userDoc.exists() ? userDoc.data() : null;
    let stripeCustomerId = userData?.stripeCustomerId;

    // If no customer ID stored, try to find or create one
    if (!stripeCustomerId) {
      try {
        const customers = await stripe.customers.list({
          email: session.user.email,
          limit: 1
        });
        
        if (customers.data.length > 0) {
          stripeCustomerId = customers.data[0].id;
        } else {
          const customer = await stripe.customers.create({
            email: session.user.email,
            name: session.user.name || 'Unknown',
            metadata: {
              userId: session.user.id!,
              userType: 'realtor'
            }
          });
          stripeCustomerId = customer.id;
        }

        // Update user record with customer ID
        await updateDoc(doc(db, 'users', session.user.id!), {
          stripeCustomerId: stripeCustomerId
        });
      } catch (error) {
      }
    }

    // Create one-time payment checkout
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment', // ONE-TIME payment, not subscription
      payment_method_types: ['card'],
      customer: stripeCustomerId || undefined,
      customer_email: stripeCustomerId ? undefined : session.user.email,
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
        userId: session.user.id!,
        userEmail: session.user.email!,
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
      userId: session.user.id,
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