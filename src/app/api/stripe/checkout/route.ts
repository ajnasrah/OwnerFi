import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import Stripe from 'stripe';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-08-27.basil',
  });
}

// New credit package system - matches simple-checkout
const CREDIT_PACKAGES = {
  '1_credit': { credits: 1, price: 300, name: '1 Lead Credit', recurring: false },
  '4_credits': { credits: 4, price: 500, name: '4 Lead Credits (Monthly)', recurring: true },
  '10_credits': { credits: 10, price: 1000, name: '10 Lead Credits (Monthly)', recurring: true },
  '60_credits': { credits: 60, price: 3000, name: '60 Lead Credits', recurring: false },
};

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  try {
    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { creditPackId, successUrl, cancelUrl } = await request.json();
    
    const package_ = CREDIT_PACKAGES[creditPackId as keyof typeof CREDIT_PACKAGES];
    if (!package_) {
      return NextResponse.json({ error: 'Invalid credit package' }, { status: 400 });
    }

    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: package_.recurring ? 'subscription' : 'payment',
      customer_email: session.user.email,
      metadata: {
        userId: session.user.id!,
        userEmail: session.user.email,
        creditPackId: creditPackId,
        credits: package_.credits.toString()
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            ...(package_.recurring ? {
              recurring: { interval: 'month' },
            } : {}),
            product_data: {
              name: package_.name,
              description: `${package_.credits} buyer lead credits${package_.recurring ? ' (renews monthly)' : ''}`,
            },
            unit_amount: package_.price * 100, // Convert to cents
          },
          quantity: 1,
        },
      ],
      success_url: successUrl || `${process.env.NEXTAUTH_URL}/realtor-dashboard?payment=success&credits=${package_.credits}`,
      cancel_url: cancelUrl || `${process.env.NEXTAUTH_URL}/buy-credits?payment=cancelled`,
    });

    return NextResponse.json({
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}